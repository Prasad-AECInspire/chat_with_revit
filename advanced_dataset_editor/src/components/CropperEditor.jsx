import React, { useRef, useState } from "react";
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.min.css";
import { motion } from "framer-motion";
import GridSelector from "./GridSelector";

// Preset aspect ratios for manual crop mode
const PRESET_RATIOS = [
  { label: "Free", value: NaN },
  { label: "1:1", value: 1 },
  { label: "16:9", value: 16 / 9 },
  { label: "4:3", value: 4 / 3 },
];

const CropperEditor = ({ imageSrc, onCancel, onSave, isSaving }) => {
  const cropperRef = useRef(null);
  const [mode, setMode] = useState("crop"); // 'crop' | 'grid'
  const [activeRatioLabel, setActiveRatioLabel] = useState("1:1");
  const [activeRatioValue, setActiveRatioValue] = useState(1);

  // Editable output crop size (for manual mode export)
  const [cropW, setCropW] = useState(640);
  const [cropH, setCropH] = useState(640);

  // Editable grid cell size
  const [gridSize, setGridSize] = useState(640);
  const [gridSizeInput, setGridSizeInput] = useState("640");

  const applyGridSize = () => {
    const v = parseInt(gridSizeInput, 10);
    if (!isNaN(v) && v >= 32 && v <= 8192) setGridSize(v);
    else setGridSizeInput(String(gridSize));
  };

  const handleSave = () => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;
    const canvas = cropper.getCroppedCanvas({
      width: cropW,
      height: cropH,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
    });
    onSave(canvas.toDataURL("image/png"));
  };

  const btn = "inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-white/10 hover:border-yellow-400/50 text-zinc-300 hover:text-yellow-300 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-30 active:scale-95";
  const inputCls = "w-20 bg-zinc-900/80 border border-white/10 focus:border-yellow-400/50 rounded-lg px-2 py-1 text-xs font-mono text-zinc-200 outline-none transition-all text-center";

  return (
    <div className="w-full space-y-5">
      {/* ── Header Row ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white leading-none mb-1">
            {mode === "grid" ? "Grid Partitioning" : "Precision Crop"}
          </h2>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
            {mode === "grid" ? `Split image into ${gridSize}×${gridSize}px tiles` : "Select region manually"}
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex p-1 bg-zinc-900/80 backdrop-blur-md rounded-2xl border border-white/5 shadow-inner">
          <button onClick={() => setMode("crop")}
            className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${mode === "crop" ? "bg-white/10 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"}`}>
            Manual
          </button>
          <button onClick={() => setMode("grid")}
            className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${mode === "grid" ? "bg-yellow-400 text-black shadow-lg" : "text-zinc-500 hover:text-zinc-300"}`}>
            Grid Mode
          </button>
        </div>
      </div>

      {/* ── Viewport ── */}
      {mode === "crop" ? (
        <div className="relative bg-black rounded-[28px] overflow-hidden border border-white/10 shadow-2xl" style={{ height: "480px" }}>
          <Cropper
            src={imageSrc}
            style={{ height: "100%", width: "100%" }}
            aspectRatio={activeRatioValue}
            guides
            ref={cropperRef}
            viewMode={1}
            dragMode="move"
            background={false}
            responsive
            checkOrientation={false}
            className="cropper-modern-skin"
          />
        </div>
      ) : (
        // Grid mode: full height component, no aspect-video clip
        <div style={{ height: "520px" }}>
          <GridSelector
            imageSrc={imageSrc}
            gridSize={gridSize}
            onCancel={() => setMode("crop")}
            onSave={onSave}
            isSaving={isSaving}
          />
        </div>
      )}

      {/* ── Controls Bar (Manual Mode) ── */}
      {mode === "crop" && (
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 px-1">
          {/* Left: aspect ratio presets + output size */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Preset ratios */}
            <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-zinc-900/50 rounded-2xl border border-white/5">
              {PRESET_RATIOS.map((r) => (
                <button key={r.label}
                  onClick={() => { setActiveRatioLabel(r.label); setActiveRatioValue(r.value); }}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-tight transition-all border ${
                    activeRatioLabel === r.label
                      ? "bg-white/10 border-white/20 text-white shadow-lg"
                      : "border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                  }`}>
                  {r.label}
                </button>
              ))}
            </div>

            {/* Editable output size */}
            <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900/50 rounded-2xl border border-white/5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Output</span>
              <input
                type="number" value={cropW} min={32} max={8192}
                onChange={(e) => setCropW(parseInt(e.target.value) || cropW)}
                className={inputCls} title="Width (px)"
              />
              <span className="text-zinc-600 font-bold">×</span>
              <input
                type="number" value={cropH} min={32} max={8192}
                onChange={(e) => setCropH(parseInt(e.target.value) || cropH)}
                className={inputCls} title="Height (px)"
              />
              <span className="text-[10px] text-zinc-600">px</span>
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-4">
            <button onClick={onCancel} className="px-4 py-2 text-[10px] font-bold text-zinc-600 hover:text-red-500 uppercase tracking-widest transition-colors">
              Cancel
            </button>
            <motion.button onClick={handleSave} disabled={isSaving}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-yellow-400 hover:bg-yellow-300 border border-transparent text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-[0_0_20px_rgba(245,197,24,0.2)] active:scale-95 disabled:opacity-30">
              {isSaving ? "Saving…" : "Apply & Save Crop"}
            </motion.button>
          </div>
        </div>
      )}

      {/* ── Grid Size Controls (Grid Mode) ── */}
      {mode === "grid" && (
        <div className="flex items-center gap-3 px-1">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Cell Size</span>
          <input
            type="number" value={gridSizeInput} min={32} max={8192}
            onChange={(e) => setGridSizeInput(e.target.value)}
            onBlur={applyGridSize}
            onKeyDown={(e) => e.key === "Enter" && applyGridSize()}
            className="w-24 bg-zinc-900/80 border border-white/10 focus:border-yellow-400/50 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 outline-none transition-all"
          />
          <span className="text-[10px] text-zinc-600">px</span>
          <button onClick={applyGridSize} className={btn}>Apply</button>
          <div className="flex gap-1.5 ml-2">
            {[256, 512, 640, 1280].map((s) => (
              <button key={s} onClick={() => { setGridSize(s); setGridSizeInput(String(s)); }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${gridSize === s ? "bg-yellow-400/20 border-yellow-400/40 text-yellow-300" : "border-white/10 text-zinc-500 hover:text-zinc-300 hover:border-white/20"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CropperEditor;
