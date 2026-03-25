import React, { useState } from "react";
import axios from "axios";
import ImageUpload from "./ImageUpload";
import CropperEditor from "./CropperEditor";
import DestinationInput from "./DestinationInput";
import ImageViewer from "./ImageViewer";

const ImageCropper = ({ setCurrentView, onImagesExport }) => {
  const [imageSrc, setImageSrc] = useState(null);
  const [destinationPath, setDestinationPath] = useState("");
  const [filename, setFilename] = useState(""); // New state for filename
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState(null);

  /* ... existing state ... */
  const [isCropping, setIsCropping] = useState(false);

  // ── Shared Tailwind class helpers ──────────────────────────
  const btn = "inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-white/10 hover:border-yellow-400/50 text-zinc-300 hover:text-yellow-300 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-lg active:scale-95";
  const btnPrimary = "inline-flex items-center gap-1.5 px-4 py-2 bg-yellow-400 hover:bg-yellow-300 border border-transparent text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-[0_0_20px_rgba(245,197,24,0.2)] active:scale-95";
  const cardCls = "bg-zinc-950/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl transition-all";

  const handleImageUpload = (src) => {
    setImageSrc(src);
    setIsCropping(false);
    setMessage(null);
  };

  const handleStartCrop = () => {
    setIsCropping(true);
    setMessage(null);
  };

  const handleBackToView = () => {
    setIsCropping(false);
    setMessage(null);
  };

  const handleCancel = () => {
    setImageSrc(null);
    setIsCropping(false);
    setMessage(null);
  };

  const handleSave = async (data) => {
    if (!destinationPath) {
      setMessage({
        type: "error",
        text: "Please enter a destination folder path.",
      });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    const saveImage = async (base64, name) => {
      return axios.post("http://localhost:3001/save-image", {
        imageBase64: base64,
        destinationPath: destinationPath,
        filename: name,
      });
    };

    try {
      if (Array.isArray(data)) {
        // Handle multiple images (Grid Mode)
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < data.length; i++) {
          const base64 = data[i];
          const baseName = filename.trim() ? filename.trim() : `cropped-image-${Date.now()}`;
          const nameWithoutExt = baseName.replace(/\.[^/.]+$/, "");
          const extension = baseName.includes(".") ? baseName.split(".").pop() : "";

          const uniqueName = `${nameWithoutExt}_${i + 1}${extension ? `.${extension}` : ""}`;

          try {
            await saveImage(base64, uniqueName);
            successCount++;
          } catch (err) {
            console.error(`Failed to save image ${i + 1}`, err);
            failCount++;
          }
        }

        if (failCount === 0) {
          setMessage({
            type: "success",
            text: `Successfully saved ${successCount} images to ${destinationPath}`,
          });
        } else {
          setMessage({
            type: "warning",
            text: `Saved ${successCount} images. Failed to save ${failCount} images.`,
          });
        }
      } else {
        const response = await saveImage(data, filename);
        if (response.data.success) {
          setMessage({
            type: "success",
            text: `Saved successfully to ${response.data.path}`,
          });
        }
      }

      if (onImagesExport) {
        onImagesExport(data);
      }
    } catch (error) {
      console.error(error);
      setMessage({
        type: "error",
        text: error.response?.data?.error || "Failed to save image. Ensure backend is running and path is valid.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans p-6 overflow-x-hidden animate-in">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header Controls */}
        <div className="flex items-center justify-between">
          <button onClick={() => setCurrentView("editor")} className={btn}>
            <span className="text-lg">←</span> Back to Editor
          </button>
          <div className="flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
             <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Image Lab Active</span>
          </div>
        </div>

        {/* Hero Section */}
        <header className="text-center space-y-2 relative py-8">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-yellow-400/10 blur-[120px] rounded-full -z-10" />
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">AEC Image Cropper</h1>
          <p className="text-zinc-500 font-medium max-w-md mx-auto">High-precision cropping and batch processing for architectural datasets.</p>
        </header>

        {/* Main Interface Table/Card */}
        <main className="relative z-10">
          {!imageSrc ? (
            <div className={cardCls}>
               <div className="border-2 border-dashed border-white/5 rounded-2xl p-12 text-center hover:border-yellow-400/30 transition-colors group">
                 <ImageUpload onImageUpload={handleImageUpload} />
               </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-700">
              <div className={cardCls}>
                <DestinationInput
                  path={destinationPath}
                  setPath={setDestinationPath}
                  filename={filename}
                  setFilename={setFilename}
                />
              </div>

              <div className={`${cardCls} min-h-[500px] flex items-center justify-center`}>
                {!isCropping ? (
                  <ImageViewer
                    imageSrc={imageSrc}
                    onCancel={handleCancel}
                    onStartCrop={handleStartCrop}
                  />
                ) : (
                  <CropperEditor
                    imageSrc={imageSrc}
                    onCancel={handleBackToView}
                    onSave={handleSave}
                    isSaving={isSaving}
                  />
                )}
              </div>
            </div>
          )}
        </main>

        {/* Toast Notification Container */}
        {message && (
          <div className="fixed bottom-8 right-8 z-[100] animate-in slide-in-from-right-8 fade-in">
            <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-xl ${
              message.type === "error" 
                ? "bg-red-500/10 border-red-500/20 text-red-100" 
                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-100"
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${
                message.type === "error" ? "bg-red-500/20 text-red-500" : "bg-emerald-500/20 text-emerald-500"
              }`}>
                {message.type === "error" ? "⚠️" : "✅"}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest opacity-50 mb-0.5">{message.type}</p>
                <p className="text-sm font-medium">{message.text}</p>
              </div>
              <button onClick={() => setMessage(null)} className="ml-4 p-1 hover:bg-white/5 rounded-lg opacity-30 hover:opacity-100 transition-all">✕</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageCropper;
