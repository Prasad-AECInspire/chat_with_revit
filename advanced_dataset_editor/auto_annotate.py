import os
import argparse
from ultralytics import YOLO
import cv2

def auto_annotate(model_path, input_path, output_path, conf=0.25):
    # Load the model
    model = YOLO(model_path)
    
    # Check if input is a directory or a single file
    if os.path.isdir(input_path):
        image_files = [f for f in os.listdir(input_path) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
    else:
        image_files = [os.path.basename(input_path)]
        input_path = os.path.dirname(input_path)

    if not os.path.exists(output_path):
        os.makedirs(output_path)

    for img_file in image_files:
        img_path = os.path.join(input_path, img_file)
        results = model.predict(img_path, conf=conf)
        
        # Get image dimensions
        img = cv2.imread(img_path)
        h, w, _ = img.shape
        
        # Prepare YOLO format annotations
        label_file = os.path.join(output_path, os.path.splitext(img_file)[0] + ".txt")
        
        with open(label_file, 'w') as f:
            for result in results:
                boxes = result.boxes
                for box in boxes:
                    # Get normalized coordinates
                    # YOLO format: class_id x_center y_center width height (all normalized 0-1)
                    cls = int(box.cls[0])
                    xywhn = box.xywhn[0].tolist()
                    
                    f.write(f"{cls} {xywhn[0]} {xywhn[1]} {xywhn[2]} {xywhn[3]}\n")
        
        print(f"Processed {img_file} -> {label_file}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Auto-annotate images using a YOLO model")
    parser.add_argument("--model", type=str, default=r"D:\Object Detection\Lighting-Fixture\05-01-26\best (31).pt", help="Path to YOLO model (.pt)")
    parser.add_argument("--input", type=str, required=True, help="Path to input image or directory")
    parser.add_argument("--output", type=str, required=True, help="Path to output directory for .txt labels")
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold")
    
    args = parser.parse_args()
    auto_annotate(args.model, args.input, args.output, args.conf)
