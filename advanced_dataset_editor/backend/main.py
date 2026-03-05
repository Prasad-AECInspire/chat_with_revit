from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
import cv2
import numpy as np
import io
import os
import shutil
import zipfile
import aiofiles
from PIL import Image
import base64
import torch
import torchvision.models as models
import torchvision.transforms as transforms
from sklearn.metrics.pairwise import cosine_similarity
from pydantic import BaseModel
from typing import List

app = FastAPI()

# Enable CORS for the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the model
MODEL_PATH = r"C:\APPDATA3\advanced_dataset_editor\epoch70 3.pt"
model = YOLO(MODEL_PATH)

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    # Read image
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")
    img_array = np.array(image)
    
    # Run prediction
    results = model.predict(img_array, conf=0.1)
    
    annotations = []
    for result in results:
        boxes = result.boxes
        for box in boxes:
            cls = int(box.cls[0])
            xywhn = box.xywhn[0].tolist()
            
            # Calculate coordinates
            x_center, y_center, width, height = xywhn
            x_min = x_center - width / 2
            y_min = y_center - height / 2
            x_max = x_center + width / 2
            y_max = y_center + height / 2
            
            # Filter out edge predictions (likely cut-off symbols)
            margin = 0.01 
            if x_min < margin or y_min < margin or x_max > (1 - margin) or y_max > (1 - margin):
                continue
                
            annotations.append({
                "classId": 0,
                "className": "symbol", # Force class name to symbol
                "centerX": xywhn[0],
                "centerY": xywhn[1],
                "width": xywhn[2],
                "height": xywhn[3],
                "type": "rectangle"
            })
            
    return {
        "annotations": annotations,
        "modelClasses": {0: "symbol"} # Return the full class mapping as a dict
    }

# Initialize ResNet for feature extraction
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
try:
    resnet = models.resnet18(weights=models.ResNet18_Weights.IMAGENET1K_V1)
except:
    # Fallback for older torchvision or if weights enum not available
    resnet = models.resnet18(pretrained=True)
    
resnet = torch.nn.Sequential(*list(resnet.children())[:-1]) # Remove classification layer
resnet.to(device)
resnet.eval()

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

class FindSimilarRequest(BaseModel):
    target_crops: List[str] # Base64 strings
    candidate_crops: List[str] # Base64 strings
    threshold: float = 0.85 # Default threshold

def pad_to_square(img, background_color=(0, 0, 0)):
    width, height = img.size
    if width == height:
        return img
    elif width > height:
        result = Image.new(img.mode, (width, width), background_color)
        result.paste(img, (0, (width - height) // 2))
        return result
    else:
        result = Image.new(img.mode, (height, height), background_color)
        result.paste(img, ((height - width) // 2, 0))
        return result

@app.post("/find_similar")
async def find_similar(request: FindSimilarRequest):
    # Helper to process images
    def process_images(base64_strings):
        batch_tensors = []
        valid_indices = []
        for i, b64 in enumerate(base64_strings):
            try:
                # Remove header if present
                if "," in b64:
                    b64 = b64.split(",")[1]
                img_data = base64.b64decode(b64)
                img = Image.open(io.BytesIO(img_data)).convert("RGB")
                
                # PAD TO SQUARE before resize to preserve aspect ratio
                img = pad_to_square(img)
                
                batch_tensors.append(transform(img))
                valid_indices.append(i)
            except Exception as e:
                print(f"Error processing image {i}: {e}")
                pass
        
        if not batch_tensors:
            return None, []
            
        return torch.stack(batch_tensors).to(device), valid_indices

    # Process targets
    target_tensors, _ = process_images(request.target_crops)
    # Process candidates
    candidate_tensors, candidate_indices = process_images(request.candidate_crops)
    if candidate_tensors is None:
        return {"match_indices": []}

    with torch.no_grad():
        target_features = resnet(target_tensors).squeeze().cpu().numpy()
        candidate_features = resnet(candidate_tensors).squeeze().cpu().numpy()

    # Handle single sample edge case (squeeze might remove extra dim or not enough)
    if target_features.ndim == 1:
        target_features = target_features.reshape(1, -1)
    if candidate_features.ndim == 1:
        candidate_features = candidate_features.reshape(1, -1)

    # Compute mean embedding for targets
    target_embedding = np.mean(target_features, axis=0).reshape(1, -1)

    # Compute similarity
    similarities = cosine_similarity(target_embedding, candidate_features)[0]

    # Filter by threshold (use user provided or default)
    threshold = request.threshold
    matches = []
    for idx, float_sim in enumerate(similarities):
        if float_sim > threshold:
             matches.append(candidate_indices[idx])

    return {"match_indices": matches}

import os
import shutil
import zipfile
import aiofiles
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse

@app.post("/autosave")
async def autosave(
    file: UploadFile = File(...),
    directory: str = Form(...)
):
    try:
        # Validate directory exists or try to create it
        if not os.path.exists(directory):
            try:
                os.makedirs(directory, exist_ok=True)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Cannot create directory: {e}")
        
        # Save uploaded zip temporarily
        temp_zip_path = os.path.join(directory, "temp_autosave.zip")
        async with aiofiles.open(temp_zip_path, 'wb') as out_file:
            content = await file.read()
            await out_file.write(content)
            
        # Extract Zip directly into the directory
        with zipfile.ZipFile(temp_zip_path, 'r') as zip_ref:
            zip_ref.extractall(directory)
            
        # Clean up the temp zip
        os.remove(temp_zip_path)
        
        return {"status": "success", "message": f"Successfully synced dataset to {directory}"}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/load_dataset")
async def load_dataset(
    background_tasks: BackgroundTasks,
    directory: str = Form(...)
):
    try:
        if not os.path.exists(directory) or not os.path.isdir(directory):
            raise HTTPException(status_code=400, detail="Invalid directory path")
            
        # Create a temp zip file
        import tempfile
        temp_dir = tempfile.gettempdir()
        temp_zip_path = os.path.join(temp_dir, f"loaded_dataset_{os.urandom(4).hex()}.zip")
        
        # Zip up the directory
        with zipfile.ZipFile(temp_zip_path, 'w', zipfile.ZIP_DEFLATED) as zip_ref:
            for root, dirs, files in os.walk(directory):
                # Optionally skip temporary files if needed
                if "temp_autosave.zip" in files:
                    files.remove("temp_autosave.zip")
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, directory)
                    zip_ref.write(file_path, arcname)
                    
        # Schedule the temp file to be deleted after sending
        background_tasks.add_task(os.remove, temp_zip_path)
        
        return FileResponse(
            path=temp_zip_path, 
            filename="loaded_dataset.zip", 
            media_type="application/zip"
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

