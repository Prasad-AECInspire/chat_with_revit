import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";

const GridSelector = ({ imageSrc, gridSize, onCancel, onSave, isSaving }) => {
  const [selectedCells, setSelectedCells] = useState([]);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const imgRef = useRef(null);
  const isDragging = useRef(false);
  const dragAction = useRef("select");

  const overlap = 128; // 🔥 change here if needed
  const stride = gridSize - overlap;

  // Load image dimensions
  useEffect(() => {
    setSelectedCells([]);
    const img = new Image();
    img.src = imageSrc;
    img.onload = () =>
      setImageDimensions({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
  }, [imageSrc, gridSize]);

  useEffect(() => {
    const up = () => {
      isDragging.current = false;
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  const updateCell = (x, y, action) => {
    setSelectedCells((prev) => {
      const exists = prev.some((c) => c.x === x && c.y === y);
      if (action === "select" && !exists) return [...prev, { x, y }];
      if (action === "deselect" && exists)
        return prev.filter((c) => c.x !== x || c.y !== y);
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

  // ✅ Correct grid calculation
  const cols =
    imageDimensions.width > 0
      ? Math.floor((imageDimensions.width - gridSize) / stride) + 1
      : 0;

  const rows =
    imageDimensions.height > 0
      ? Math.floor((imageDimensions.height - gridSize) / stride) + 1
      : 0;

  // ✅ SAVE WITH CLAMP (no black images)
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

        // 🔥 CLAMP FIX
        const x = Math.min(cell.x * stride, img.naturalWidth - gridSize);
        const y = Math.min(cell.y * stride, img.naturalHeight - gridSize);

        ctx.drawImage(
          img,
          x,
          y,
          gridSize,
          gridSize,
          0,
          0,
          gridSize,
          gridSize
        );

        return canvas.toDataURL("image/png");
      });

      onSave(blobs);
    };
  };

  return (
    <div className="flex flex-col w-full h-full min-h-[500px] bg-zinc-950 rounded-[32px] overflow-hidden border border-white/5 shadow-2xl">
      <div className="flex-1 flex items-center justify-center bg-black p-4 relative overflow-auto">
        {imageDimensions.width > 0 ? (
          <div className="relative inline-block" style={{ userSelect: "none" }}>
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Grid source"
              draggable={false}
              className="block max-w-full max-h-[60vh] object-contain rounded-lg pointer-events-none"
            />

            {imgRef.current && (
              <div
                className="absolute inset-0 z-10"
                onMouseLeave={() => {
                  isDragging.current = false;
                }}
              >
                {Array.from({ length: rows }).map((_, r) =>
                  Array.from({ length: cols }).map((_, c) => {
                    const isSelected = selectedCells.some(
                      (cell) => cell.x === c && cell.y === r
                    );

                    const imgWidth = imgRef.current?.clientWidth || 1;
                    const imgHeight = imgRef.current?.clientHeight || 1;

                    const scaleX = imgWidth / imageDimensions.width;
                    const scaleY = imgHeight / imageDimensions.height;

                    // ✅ REAL POSITION (stride-based)
                    const left = c * stride * scaleX;
                    const top = r * stride * scaleY;
                    const width = gridSize * scaleX;
                    const height = gridSize * scaleY;

                    return (
                      <div
                        key={`${r}-${c}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleMouseDown(c, r);
                        }}
                        onMouseEnter={() => handleMouseEnter(c, r)}
                        className={`absolute border ${isSelected
                            ? "bg-yellow-400/25 border-yellow-300"
                            : "border-white/15 hover:border-white/40 hover:bg-white/5"
                          }`}
                        style={{
                          left: `${left}px`,
                          top: `${top}px`,
                          width: `${width}px`,
                          height: `${height}px`,
                        }}
                      />
                    );
                  })
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-zinc-500">Loading image...</div>
        )}
      </div>

      <div className="px-6 py-4 flex justify-between items-center border-t border-white/10">
        <div className="text-xs text-zinc-400">
          {cols} × {rows} cells | overlap: {overlap}px
        </div>

        <div className="flex gap-3">
          <button onClick={() => setSelectedCells([])}>Clear</button>
          <button onClick={onCancel}>Cancel</button>
          <motion.button
            onClick={handleSave}
            disabled={selectedCells.length === 0}
          >
            Export {selectedCells.length}
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default GridSelector;