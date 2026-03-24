import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";

const GridSelector = ({ imageSrc, gridSize, onCancel, onSave, isSaving }) => {
  const [selectedCells, setSelectedCells] = useState([]);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const imgRef = useRef(null);
  const isDragging = useRef(false);
  const dragAction = useRef("select");

  // Load natural image dimensions
  useEffect(() => {
    setSelectedCells([]);
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
  }, [imageSrc, gridSize]);

  useEffect(() => {
    const up = () => { isDragging.current = false; };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  const updateCell = (x, y, action) => {
    setSelectedCells((prev) => {
      const exists = prev.some((c) => c.x === x && c.y === y);
      if (action === "select" && !exists) return [...prev, { x, y }];
      if (action === "deselect" && exists) return prev.filter((c) => c.x !== x || c.y !== y);
      return prev;
    });
  };

  const handleMouseDown = (x, y) => {
    isDragging.current = true;
    const isSelected = selectedCells.some((c) => c.x === x && c.y === y);
    dragAction.current = isSelected ? "deselect" : "select";
    updateCell(x, y, dragAction.current);
  };

  const handleMouseEnter = (x, y) => {
    if (isDragging.current) updateCell(x, y, dragAction.current);
  };

  const handleSave = () => {
    if (selectedCells.length === 0) return;
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      const blobs = selectedCells.map((cell) => {
        const canvas = document.createElement("canvas");
        canvas.width = gridSize;
        canvas.height = gridSize;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, cell.x * gridSize, cell.y * gridSize, gridSize, gridSize, 0, 0, gridSize, gridSize);
        return canvas.toDataURL("image/png");
      });
      onSave(blobs);
    };
  };

  const cols = imageDimensions.width > 0 ? Math.ceil(imageDimensions.width / gridSize) : 0;
  const rows = imageDimensions.height > 0 ? Math.ceil(imageDimensions.height / gridSize) : 0;

  return (
    <div className="flex flex-col w-full h-full min-h-[500px] bg-zinc-950 rounded-[32px] overflow-hidden border border-white/5 shadow-2xl">
      {/* Image + Grid overlay — fills available space */}
      <div className="flex-1 flex items-center justify-center bg-black p-4 relative overflow-auto">
        {imageDimensions.width > 0 ? (
          <div className="relative inline-block" style={{ userSelect: "none" }}>
            {/* The actual image */}
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Grid source"
              draggable={false}
              className="block max-w-full max-h-[60vh] object-contain rounded-lg pointer-events-none"
              style={{ display: "block" }}
            />

            {/* Grid overlay — sized to match the rendered image */}
            {imgRef.current && (
              <div
                className="absolute inset-0 z-10"
                style={{ cursor: "crosshair" }}
                onMouseLeave={() => { isDragging.current = false; }}
              >
                {Array.from({ length: rows }).map((_, r) =>
                  Array.from({ length: cols }).map((_, c) => {
                    const isSelected = selectedCells.some((cell) => cell.x === c && cell.y === r);
                    const left = `${(c / cols) * 100}%`;
                    const top = `${(r / rows) * 100}%`;
                    const width = `${(1 / cols) * 100}%`;
                    const height = `${(1 / rows) * 100}%`;
                    return (
                      <div
                        key={`${r}-${c}`}
                        onMouseDown={(e) => { e.preventDefault(); handleMouseDown(c, r); }}
                        onMouseEnter={() => handleMouseEnter(c, r)}
                        className={`absolute border transition-all duration-150 ${
                          isSelected
                            ? "bg-cyan-500/25 border-cyan-400 shadow-[inset_0_0_16px_rgba(6,182,212,0.2)]"
                            : "border-white/15 hover:border-white/40 hover:bg-white/5"
                        }`}
                        style={{ left, top, width, height }}
                      >
                        {isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-4 h-4 bg-cyan-500 rounded-full flex items-center justify-center shadow-lg">
                              <svg className="w-2.5 h-2.5 text-black" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center opacity-30 text-sm font-bold tracking-widest uppercase text-zinc-500">
            Loading image...
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-8 py-4 bg-zinc-950/90 border-t border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-6 text-xs">
          <div>
            <p className="text-[9px] font-bold uppercase text-zinc-500 tracking-widest mb-0.5">Grid</p>
            <p className="font-mono font-bold text-zinc-300">{cols} × {rows} cells</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div>
            <p className="text-[9px] font-bold uppercase text-zinc-500 tracking-widest mb-0.5">Cell Size</p>
            <p className="font-mono font-bold text-zinc-300">{gridSize}px</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div>
            <p className="text-[9px] font-bold uppercase text-zinc-500 tracking-widest mb-0.5">Selected</p>
            <p className="font-mono font-bold text-cyan-400">{selectedCells.length} cells</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={() => setSelectedCells([])} className="px-3 py-1.5 text-[10px] font-bold text-zinc-600 hover:text-zinc-300 uppercase tracking-widest transition-colors">
            Clear
          </button>
          <button onClick={onCancel} className="px-3 py-1.5 text-[10px] font-bold text-zinc-600 hover:text-red-400 uppercase tracking-widest transition-colors">
            Cancel
          </button>
          <motion.button
            onClick={handleSave}
            disabled={isSaving || selectedCells.length === 0}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 disabled:grayscale text-black rounded-xl text-[10px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all"
          >
            {isSaving ? "Exporting..." : `Export ${selectedCells.length} Crops`}
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default GridSelector;
