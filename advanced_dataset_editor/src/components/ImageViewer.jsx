import React, { useRef, useState, useEffect } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { clsx } from "clsx";

const ImageViewer = ({ imageSrc, onCancel, onStartCrop }) => {
  const [scale, setScale] = useState(1);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const handleZoomIn = () => setScale((prev) => prev + 0.5);
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.5, 0.1)); // Preventing negative or zero scale
  const handleReset = () => {
    setScale(1);
    x.set(0);
    y.set(0);
  };

  useEffect(() => {
    const onWheel = (e) => {
      e.preventDefault(); // Prevent default scroll
      const step = 0.2;
      if (e.deltaY < 0) {
        // Zoom In
        setScale((prev) => prev + step);
      } else {
        // Zoom Out
        setScale((prev) => Math.max(prev - step, 0.1));
      }
    };

    // Add listener to window or specific container if possible to capture scroll cleanly?
    // Actually, let's keep it on the container but we need a ref for the container.
    const element = document.getElementById("image-viewer-viewport");
    if (element) {
      element.addEventListener("wheel", onWheel, { passive: false });
    }

    return () => {
      if (element) {
        element.removeEventListener("wheel", onWheel);
      }
    };
  }, []);

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-4xl bg-zinc-900/30 rounded-[32px] p-4 border border-white/5 shadow-2xl">
        {/* Viewport */}
        <div id="image-viewer-viewport" className="relative aspect-video bg-black rounded-2xl overflow-hidden cursor-move border border-white/5 group">
          <motion.img
            src={imageSrc}
            alt="Preview"
            drag
            animate={{ scale }}
            style={{ x, y, touchAction: "none" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full h-full object-contain pointer-events-none"
          />
 
          {/* Floating Controls Overlay */}
          <div className="absolute inset-x-0 bottom-6 flex justify-center pointer-events-none">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl pointer-events-auto">
              <button onClick={handleZoomOut} className="w-8 h-8 flex items-center justify-center hover:bg-white/5 rounded-xl transition-all text-zinc-500 hover:text-yellow-400" title="Zoom Out">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
              </button>
 
              <span className="px-3 text-[10px] font-bold font-mono text-zinc-400 min-w-[50px] text-center">{Math.round(scale * 100)}%</span>
 
              <button onClick={handleZoomIn} className="w-8 h-8 flex items-center justify-center hover:bg-white/5 rounded-xl transition-all text-zinc-500 hover:text-yellow-400" title="Zoom In">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </button>
 
              <div className="w-px h-4 bg-white/10 mx-1" />
 
              <button onClick={handleReset} className="w-8 h-8 flex items-center justify-center hover:bg-white/5 rounded-xl transition-all text-zinc-500 hover:text-emerald-500" title="Reset View">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
            </div>
          </div>
        </div>
 
        {/* Actions Footer */}
        <div className="flex items-center justify-between mt-6 px-2">
          <button onClick={onCancel} className="px-4 py-2 text-[10px] font-bold text-zinc-600 hover:text-red-500 uppercase tracking-[0.2em] transition-colors">
            Discard Upload
          </button>
 
          <motion.button
            onClick={onStartCrop}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-8 py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs rounded-2xl transition-all shadow-xl shadow-yellow-400/20 uppercase tracking-widest"
          >
            Enter Crop Mode
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default ImageViewer;
