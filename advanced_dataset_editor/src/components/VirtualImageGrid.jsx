import React, { useMemo } from "react";

const VirtualImageGrid = ({ images = [], onImageClick, selectedIndex, columnCount = 2, itemSize = 120 }) => {
  const imageList = useMemo(() => images || [], [images]);

  return (
    <div className="w-full h-full overflow-y-auto">
      <div
        className="grid gap-1.5 p-1"
        style={{ gridTemplateColumns: `repeat(${columnCount}, 1fr)` }}
      >
        {imageList.map((image, index) => {
          const isSelected = index === selectedIndex;
          const count = image?.annotations?.length || 0;
          return (
            <div
              key={`${image?.name}-${index}`}
              onClick={() => onImageClick?.(index)}
              className={`flex flex-col rounded-lg border cursor-pointer transition-all overflow-hidden
                ${isSelected
                  ? "border-yellow-400 bg-yellow-400/8 shadow-[0_0_0_1px_#f5c518]"
                  : "border-white/6 bg-zinc-900 hover:border-white/14 hover:bg-zinc-800"
                }`}
            >
              {/* Image */}
              <div className="relative w-full bg-black overflow-hidden" style={{ height: 70 }}>
                {image?.src
                  ? <img src={image.src} alt={image?.name || `Image ${index}`} loading="lazy" className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-zinc-800" />
                }
                {count > 0 && (
                  <span className="absolute top-1 right-1 bg-yellow-400/80 text-black text-[9px] font-bold font-mono px-1 rounded">
                    {count}
                  </span>
                )}
              </div>
              {/* Info */}
              <div className="px-1.5 py-1 border-t border-white/5">
                <p className="text-[10px] font-mono text-zinc-300 truncate" title={image?.name}>
                  {image?.name || `img_${index}`}
                </p>
                <p className="text-[9px] text-zinc-600">{count} ann{count !== 1 ? "s" : ""}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VirtualImageGrid;
