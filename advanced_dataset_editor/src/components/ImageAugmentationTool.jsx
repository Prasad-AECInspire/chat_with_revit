import React, { useState, useRef } from "react";
import {
  Upload,
  Download,
  RotateCw,
  Sun,
  FlipHorizontal,
  FlipVertical,
  Zap,
  Image as ImageIcon,
  Sliders,
} from "lucide-react";

const ImageAugmentationTool = () => {
  const [images, setImages] = useState([]);
  const [augmentedImages, setAugmentedImages] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  // Augmentation configuration
  const [config, setConfig] = useState({
    enableRotation: true,
    enableCustomRotation: false,
    customAngles: [15, 30, 45],
    enableBrightness: true,
    brightnessRange: [-20, 20],
    contrastRange: [0.9, 1.1],
    enableFlip: true,
    enableNoise: false,
    noiseIntensity: 0.05,
    enableColorJitter: false,
    trainSplit: 80,
    valSplit: 20,
    testSplit: 0,
  });

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));

    const loadedImages = [];
    let loaded = 0;

    imageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          loadedImages.push({
            name: file.name,
            data: event.target.result,
            width: img.width,
            height: img.height,
          });
          loaded++;
          if (loaded === imageFiles.length) {
            setImages(loadedImages);
          }
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const rotateImage = (canvas, ctx, angle) => {
    const width = canvas.width;
    const height = canvas.height;

    // Create temporary canvas
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width = width;
    tempCanvas.height = height;

    // Copy original
    tempCtx.drawImage(canvas, 0, 0);

    // Clear and rotate
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate((angle * Math.PI) / 180);
    ctx.translate(-width / 2, -height / 2);
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.restore();
  };

  const adjustBrightnessContrast = (canvas, ctx, brightness, contrast) => {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, data[i] * contrast + brightness));
      data[i + 1] = Math.min(
        255,
        Math.max(0, data[i + 1] * contrast + brightness)
      );
      data[i + 2] = Math.min(
        255,
        Math.max(0, data[i + 2] * contrast + brightness)
      );
    }

    ctx.putImageData(imageData, 0, 0);
  };

  const flipImage = (canvas, ctx, direction) => {
    const width = canvas.width;
    const height = canvas.height;

    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width = width;
    tempCanvas.height = height;
    tempCtx.drawImage(canvas, 0, 0);

    ctx.clearRect(0, 0, width, height);
    ctx.save();

    if (direction === "horizontal") {
      ctx.scale(-1, 1);
      ctx.drawImage(tempCanvas, -width, 0);
    } else {
      ctx.scale(1, -1);
      ctx.drawImage(tempCanvas, 0, -height);
    }

    ctx.restore();
  };

  const addNoise = (canvas, ctx, intensity) => {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * intensity * 255;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }

    ctx.putImageData(imageData, 0, 0);
  };

  const applyAugmentations = async () => {
    if (images.length === 0) return;

    setProcessing(true);
    setProgress(0);
    const augmented = [];

    for (let imgIdx = 0; imgIdx < images.length; imgIdx++) {
      const image = images[imgIdx];
      const baseCanvas = document.createElement("canvas");
      const baseCtx = baseCanvas.getContext("2d");

      const img = new Image();
      await new Promise((resolve) => {
        img.onload = resolve;
        img.src = image.data;
      });

      baseCanvas.width = img.width;
      baseCanvas.height = img.height;
      baseCtx.drawImage(img, 0, 0);

      // Original
      augmented.push({
        name: `${image.name.split(".")[0]}_original.jpg`,
        data: baseCanvas.toDataURL("image/jpeg", 0.95),
        label: "original",
      });

      // Standard rotations
      if (config.enableRotation) {
        for (const angle of [90, 180, 270]) {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          rotateImage(canvas, ctx, angle);
          augmented.push({
            name: `${image.name.split(".")[0]}_rot${angle}.jpg`,
            data: canvas.toDataURL("image/jpeg", 0.95),
            label: `rot_${angle}`,
          });
        }
      }

      // Custom angle rotations
      if (config.enableCustomRotation && config.customAngles.length > 0) {
        for (const angle of config.customAngles) {
          if (angle !== 0 && angle !== 90 && angle !== 180 && angle !== 270) {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            rotateImage(canvas, ctx, angle);
            augmented.push({
              name: `${image.name.split(".")[0]}_rot${angle}.jpg`,
              data: canvas.toDataURL("image/jpeg", 0.95),
              label: `rot_${angle}`,
            });
          }
        }
      }

      // Brightness/Contrast variations
      if (config.enableBrightness) {
        const variants = [
          {
            brightness: config.brightnessRange[0],
            contrast: config.contrastRange[0],
            label: "dark",
          },
          {
            brightness: config.brightnessRange[1],
            contrast: config.contrastRange[1],
            label: "bright",
          },
        ];

        for (const variant of variants) {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          adjustBrightnessContrast(
            canvas,
            ctx,
            variant.brightness,
            variant.contrast
          );
          augmented.push({
            name: `${image.name.split(".")[0]}_${variant.label}.jpg`,
            data: canvas.toDataURL("image/jpeg", 0.95),
            label: variant.label,
          });
        }
      }

      // Flips
      if (config.enableFlip) {
        for (const direction of ["horizontal", "vertical"]) {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          flipImage(canvas, ctx, direction);
          augmented.push({
            name: `${image.name.split(".")[0]}_${direction[0]}flip.jpg`,
            data: canvas.toDataURL("image/jpeg", 0.95),
            label: `${direction[0]}flip`,
          });
        }
      }

      // Noise
      if (config.enableNoise && Math.random() < 0.5) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        addNoise(canvas, ctx, config.noiseIntensity);
        augmented.push({
          name: `${image.name.split(".")[0]}_noise.jpg`,
          data: canvas.toDataURL("image/jpeg", 0.95),
          label: "noise",
        });
      }

      setProgress(((imgIdx + 1) / images.length) * 100);
    }

    setAugmentedImages(augmented);
    setProcessing(false);
  };

  const downloadAll = () => {
    augmentedImages.forEach((img, idx) => {
      setTimeout(() => {
        const link = document.createElement("a");
        link.href = img.data;
        link.download = img.name;
        link.click();
      }, idx * 100);
    });
  };

  const multiplier = () => {
    let mult = 1;
    if (config.enableRotation) mult *= 4;
    if (config.enableBrightness) mult *= 3;
    if (config.enableFlip) mult *= 3;
    if (config.enableNoise) mult *= 1.5;
    return mult.toFixed(1);
  };

  // ── Shared Tailwind class helpers ──────────────────────────
  const btn = "inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-white/10 hover:border-yellow-400/50 text-zinc-300 hover:text-yellow-300 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-lg active:scale-95";
  const btnPrimary = "inline-flex items-center gap-1.5 px-6 py-3 bg-yellow-400 hover:bg-yellow-300 border border-transparent text-black rounded-xl text-sm font-bold transition-all cursor-pointer shadow-[0_0_20px_rgba(245,197,24,0.3)] active:scale-95 disabled:opacity-30";
  const cardCls = "bg-zinc-950/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl hover:border-white/20 transition-all group";
  const inputCls = "bg-zinc-900 border border-white/10 focus:border-yellow-400/50 focus:ring-4 focus:ring-yellow-400/10 rounded-xl px-4 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-all w-full";
  const labelCls = "block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-3 ml-1";

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans p-8 animate-in">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-zinc-950/50 backdrop-blur-xl border border-white/10 p-8 rounded-[32px] shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400/5 blur-[100px] -mr-32 -mt-32 rounded-full transition-all group-hover:bg-yellow-400/10" />
          <div className="relative z-10 flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-yellow-300 shadow-lg shadow-yellow-400/5">
              <Zap className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white mb-1">
                Image Augmentation Tool
              </h1>
              <p className="text-zinc-500 font-medium uppercase tracking-widest text-[10px]">
                Autonomous Dataset Expansion & Variation Engine
              </p>
            </div>
          </div>
          <div className="relative z-10 flex items-center gap-3">
             {images.length > 0 && (
               <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">{images.length} Source Images</span>
               </div>
             )}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Configuration Panel */}
          <aside className="lg:col-span-4 space-y-6">
            <div className={cardCls}>
              <div className="flex items-center gap-3 mb-6">
                <Sliders className="w-4 h-4 text-yellow-300" />
                <h2 className="text-xs font-bold text-white uppercase tracking-[0.2em]">Augmentation Suite</h2>
              </div>

              <div className="space-y-4">
                {[
                  { id: 'enableRotation', icon: RotateCw, label: 'Standard Rotation', sub: '90°, 180°, 270° variations', color: 'text-blue-400' },
                  { id: 'enableBrightness', icon: Sun, label: 'Luminance & Contrast', sub: 'Simulate lighting conditions', color: 'text-yellow-400' },
                  { id: 'enableFlip', icon: FlipHorizontal, label: 'Axial Reflections', sub: 'Horizontal and vertical flips', color: 'text-emerald-400' },
                  { id: 'enableNoise', icon: Zap, label: 'Gaussian Noise', sub: 'Enhance model robustness', color: 'text-red-400' }
                ].map((opt) => (
                  <label key={opt.id} className="flex items-start gap-4 p-4 rounded-2xl bg-zinc-900/50 border border-white/5 hover:border-white/10 transition-all cursor-pointer group/opt">
                    <input
                      type="checkbox"
                      checked={config[opt.id]}
                      onChange={(e) => setConfig({ ...config, [opt.id]: e.target.checked })}
                      className="mt-1 w-4 h-4 border-2 border-white/10 rounded bg-zinc-950 checked:bg-yellow-400 checked:border-yellow-400 transition-all cursor-pointer"
                    />
                    <div className="flex-1">
                       <div className="flex items-center gap-2 mb-0.5">
                         <opt.icon className={`w-3 h-3 ${opt.color}`} />
                         <span className="text-xs font-bold text-white group-hover/opt:text-yellow-300 transition-colors">{opt.label}</span>
                       </div>
                       <p className="text-[10px] text-zinc-500 font-medium leading-relaxed">{opt.sub}</p>
                    </div>
                  </label>
                ))}

                {/* Custom Rotation Toggle */}
                <div className={`p-4 rounded-2xl border transition-all ${config.enableCustomRotation ? 'bg-yellow-400/5 border-yellow-400/20' : 'bg-zinc-900/50 border-white/5 opacity-60'}`}>
                  <label className="flex items-center gap-4 cursor-pointer mb-3">
                    <input
                      type="checkbox"
                      checked={config.enableCustomRotation}
                      onChange={(e) => setConfig({ ...config, enableCustomRotation: e.target.checked })}
                      className="w-4 h-4 border-2 border-white/10 rounded bg-zinc-950 checked:bg-yellow-400 checked:border-yellow-400 transition-all cursor-pointer"
                    />
                    <span className="text-xs font-bold text-white">Advanced Angle Set</span>
                  </label>
                  {config.enableCustomRotation && (
                    <div className="space-y-2 animate-in slide-in-from-top-1">
                      <p className="text-[10px] text-zinc-500 ml-1">Comma-separated degrees</p>
                      <input
                        type="text"
                        placeholder="e.g., 15, 30, 45"
                        value={config.customAngles.join(", ")}
                        onChange={(e) => {
                          const angles = e.target.value
                            .split(",")
                            .map((a) => parseInt(a.trim()))
                            .filter((a) => !isNaN(a));
                          setConfig({ ...config, customAngles: angles });
                        }}
                        className={inputCls}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Data Multiplier Summary */}
              <div className="mt-8 relative overflow-hidden rounded-2xl bg-gradient-to-br from-yellow-400 to-blue-600 p-6 shadow-xl group/mult">
                <div className="absolute -right-4 -bottom-4 text-white/10 grayscale">
                    <Zap className="w-24 h-24 rotate-12 transition-transform group-hover/mult:scale-110" />
                </div>
                <div className="relative z-10">
                  <p className="text-[9px] font-black text-white/60 uppercase tracking-[0.2em] mb-1">Impact Multiplier</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-white tracking-tighter">{multiplier()}x</span>
                    <span className="text-xs font-bold text-white/80">Synthetic Boost</span>
                  </div>
                  <div className="mt-3 h-1 w-full bg-black/20 rounded-full overflow-hidden">
                     <div className="h-full bg-white/40 animate-pulse" style={{ width: '40%' }} />
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Workspace */}
          <main className="lg:col-span-8 space-y-6">
            {/* Upload Area */}
            <div className={`${cardCls} flex flex-col p-0 overflow-hidden`}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-20 flex flex-col items-center justify-center gap-4 hover:bg-white/[0.02] transition-colors group/upload relative"
              >
                <div className="w-20 h-20 rounded-[28px] bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-500 group-hover/upload:text-yellow-300 group-hover/upload:border-yellow-400/30 group-hover/upload:bg-yellow-400/5 transition-all duration-500">
                  <Upload className="w-8 h-8 group-hover/upload:-translate-y-1 transition-transform" />
                </div>
                <div className="text-center">
                  <span className="block text-sm font-bold text-white mb-1 uppercase tracking-widest">Stage Source Images</span>
                  <p className="text-[11px] text-zinc-600 font-medium">Drag & Drop or Click to browse local filesystem</p>
                </div>
              </button>
            </div>

            {/* Execution Controls */}
            {images.length > 0 && (
              <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-4">
                  <button
                    onClick={applyAugmentations}
                    disabled={processing}
                    className={`${btnPrimary} flex-1 group/proc relative overflow-hidden`}
                  >
                     <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/proc:animate-shimmer" />
                     {processing ? (
                       <div className="flex items-center gap-3">
                         <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                         <span>Compiling... {Math.round(progress)}%</span>
                       </div>
                     ) : (
                       <span className="flex items-center gap-2">🚀 Spark Generation Process</span>
                     )}
                  </button>

                  {augmentedImages.length > 0 && (
                    <button
                      onClick={downloadAll}
                      className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 border border-white/10 rounded-xl text-sm font-bold text-white transition-all shadow-xl flex items-center gap-2 active:scale-95"
                    >
                      <Download className="w-4 h-4" />
                      Archive All
                    </button>
                  )}
                </div>

                {/* Progress Bar Container */}
                {processing && (
                  <div className="space-y-3 p-6 bg-zinc-900/50 border border-white/5 rounded-2xl shadow-inner">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500">
                      <span>Neural Processing Pipeline</span>
                      <span className="text-yellow-400">{Math.round(progress)}%</span>
                    </div>
                    <div className="bg-black/50 rounded-full h-2 overflow-hidden overflow-hidden ring-1 ring-white/5">
                      <div
                        className="bg-gradient-to-r from-yellow-500 to-blue-500 h-full transition-all duration-300 rounded-full shadow-[0_0_10px_rgba(245,197,24,0.5)]"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Visual Output Grid */}
            {augmentedImages.length > 0 && (
              <div className={cardCls}>
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-[0.2em] mb-1">Synthetic Previews</h3>
                    <p className="text-[10px] text-zinc-500">First {Math.min(12, augmentedImages.length)} of {augmentedImages.length} generated instances</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-600">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {augmentedImages.slice(0, 12).map((img, idx) => (
                    <div
                      key={idx}
                      className="relative group aspect-square rounded-2xl overflow-hidden bg-black border border-white/5 shadow-lg group-hover:border-yellow-400/30 transition-all duration-500"
                    >
                      <img
                        src={img.data}
                        alt={img.label}
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                         <span className="text-[10px] font-black text-white uppercase tracking-widest bg-yellow-400/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-yellow-400/30">
                           {img.label}
                         </span>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-3 flex justify-end">
                         <div className="w-6 h-6 rounded-lg bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-[10px] text-zinc-400">
                           #{idx + 1}
                         </div>
                      </div>
                    </div>
                  ))}
                </div>

                {augmentedImages.length > 12 && (
                  <div className="mt-8 pt-6 border-t border-white/5 text-center">
                    <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.3em]">
                      + {augmentedImages.length - 12} additional variations processed
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Empty State */}
            {images.length === 0 && !processing && (
              <div className="h-[400px] flex flex-col items-center justify-center text-center bg-zinc-950/30 border-2 border-dashed border-white/5 rounded-[40px] opacity-40">
                <div className="w-20 h-20 rounded-full bg-zinc-900/50 flex items-center justify-center mb-6">
                  <ImageIcon className="w-10 h-10 text-zinc-700" />
                </div>
                <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest leading-none mb-2">No Data Staged</h3>
                <p className="text-xs text-zinc-700 max-w-xs leading-relaxed">Stage images from your local system to begin the AI synthesis pipeline.</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default ImageAugmentationTool;
