import React, { useState } from "react";
import { useDropzone } from "react-dropzone";

const ImageUploader = ({ onUpload, setCurrentView }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleDrop = async (acceptedFiles) => {
    setSelectedFiles((prev) => [...prev, ...acceptedFiles]);
  };

  const handleUploadClick = async () => {
    if (selectedFiles.length === 0) return;
    setIsUploading(true);
    try {
      await onUpload(selectedFiles);
      setSelectedFiles([]);
    } catch (error) {
      console.error("Error preparing files:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"] },
    onDrop: handleDrop,
    maxFiles: 10,
    maxSize: 10 * 1024 * 1024,
  });

  return (
    <div className="flex-1 flex items-start justify-center pt-10 bg-black overflow-y-auto">
      <div className="flex flex-col gap-5 w-full max-w-xl px-6">

        <button
          onClick={() => setCurrentView("editor")}
          className="self-start flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-white/10 hover:border-white/20 text-zinc-400 hover:text-zinc-100 rounded-md text-xs transition-all"
        >
          ← Back to editor
        </button>

        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
            ${isDragActive
              ? "border-yellow-400 bg-yellow-400/5 text-yellow-300"
              : "border-white/10 bg-zinc-950 text-zinc-500 hover:border-white/20 hover:text-zinc-400"
            }`}
        >
          <input {...getInputProps()} />
          <div className="text-3xl mb-3">📁</div>
          {isDragActive
            ? <p className="text-sm">Drop the files here...</p>
            : <p className="text-sm">Drag & drop images here, or <span className="text-yellow-300 underline">click to select</span></p>
          }
          <p className="text-xs text-zinc-600 mt-2">PNG, JPG, GIF, WEBP — max 10MB each</p>
        </div>

        {/* File list */}
        {selectedFiles.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Selected Images ({selectedFiles.length})
            </h3>
            <div className="max-h-64 overflow-y-auto bg-zinc-950 border border-white/10 rounded-xl divide-y divide-white/5">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between px-3.5 py-2.5">
                  <span className="text-xs text-zinc-300 font-mono truncate max-w-[80%]">
                    {file.name}
                    <span className="text-zinc-600 ml-2">({(file.size / 1024).toFixed(1)} KB)</span>
                  </span>
                  <button
                    onClick={() => removeFile(index)}
                    className="text-zinc-600 hover:text-red-400 text-base leading-none transition-colors ml-2"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={handleUploadClick}
              disabled={isUploading}
              className={`self-center px-8 py-2.5 rounded-lg text-sm font-semibold transition-all
                ${isUploading
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  : "bg-yellow-400/15 hover:bg-yellow-400/25 border border-yellow-400/30 hover:border-yellow-400 text-yellow-300"
                }`}
            >
              {isUploading ? "Uploading..." : `Upload ${selectedFiles.length} Image${selectedFiles.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageUploader;
