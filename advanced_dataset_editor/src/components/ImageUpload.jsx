import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { clsx } from "clsx";

const ImageUpload = ({ onImageUpload }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const processFile = (file) => {
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        onImageUpload(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      alert("Please upload an image file.");
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <motion.div
        className={clsx(
          "relative group border-2 border-dashed rounded-[32px] p-12 transition-all duration-500 cursor-pointer overflow-hidden",
          isDragging 
            ? "border-cyan-500 bg-cyan-500/10 shadow-[0_0_40px_rgba(6,182,212,0.1)]" 
            : "border-white/10 bg-zinc-950/50 hover:border-white/20 hover:bg-zinc-900/50"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        {/* Decorative background glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*"
          className="hidden"
        />
 
        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="w-20 h-20 rounded-[24px] bg-zinc-900 border border-white/5 flex items-center justify-center text-4xl shadow-2xl group-hover:border-cyan-500/30 group-hover:text-cyan-400 transition-all duration-500 group-hover:bg-cyan-500/10 group-hover:shadow-cyan-500/10">
            <svg
              className="w-10 h-10"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
 
          <div className="text-center space-y-2">
            <h3 className="text-xl font-bold text-white tracking-tight">Drop your image here</h3>
            <p className="text-sm text-zinc-500 font-medium">Drag and drop or <span className="text-cyan-500 underline underline-offset-4">click to browse</span></p>
            <div className="pt-4 flex items-center justify-center gap-3">
               {["PNG", "JPG", "WEBP"].map(ext => (
                 <span key={ext} className="px-2 py-1 rounded-md bg-white/[0.03] border border-white/5 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{ext}</span>
               ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ImageUpload;
