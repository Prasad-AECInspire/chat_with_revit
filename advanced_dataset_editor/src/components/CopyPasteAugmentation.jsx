import React, { useState, useRef, useEffect } from 'react';
import { Play, Download, Settings, Info, Trash2, Eye, AlertCircle, BarChart2, Edit3, X, Check, Minus, Plus } from 'lucide-react';
import JSZip from 'jszip';

export default function CopyPasteAugmentationApp({ setCurrentView, images: propImages, classes: propClasses, datasetConfig }) {
  const [images, setImages] = useState([]);
  const [labels, setLabels] = useState([]);
  const [processedImages, setProcessedImages] = useState([]); // Store modified images
  const [processedLabels, setProcessedLabels] = useState([]); // Store modified labels
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Transform Settings
  const [enableBrightness, setEnableBrightness] = useState(true);
  const [enableFeathering, setEnableFeathering] = useState(true); // New: Edge Blending

  const [processing, setProcessing] = useState(false);
  const [classStats, setClassStats] = useState({});
  const [previewMode, setPreviewMode] = useState('original'); // 'original' or 'processed'

  // Zoom & Pan State
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const startPan = useRef({ x: 0, y: 0 });

  // Per-Class Configuration State
  // { classId: { targetCount: 100, minScale: 0.8, maxScale: 1.2, enabled: true } }
  const [classSettings, setClassSettings] = useState({});
  const [editingClassId, setEditingClassId] = useState(null); // Which row is being edited
  const [editForm, setEditForm] = useState({ targetCount: 100, minScale: 0.8, maxScale: 1.2 });
  const [globalTargetInput, setGlobalTargetInput] = useState(100); // For bulk set

  const canvasRef = useRef(null);

  // Initialize from Props
  useEffect(() => {
    if (propImages && propImages.length > 0) {
      // Convert prop images to internal format if needed
      // propImages are { id, name, src, annotations, split }
      // We need 'data' (Image object) for canvas operations

      const loadImages = async () => {
        const loaded = await Promise.all(propImages.map(async (img) => {
          const imageObj = new Image();
          imageObj.src = img.src;
          await new Promise((r) => {
            if (imageObj.complete) r();
            else imageObj.onload = r;
          });

          return {
            ...img,
            data: imageObj // Add the HTMLImageElement
          };
        }));

        setImages(loaded);

        // Extract labels and NORMALIZE properties
        const extractedLabels = loaded.map(img => ({
          name: img.name.replace(/\.(jpg|jpeg|png)$/i, '.txt'),
          split: img.split,
          annotations: (img.annotations || []).map(ann => ({
            classId: ann.classId,
            // Map App.js properties (centerX/Y, width, height) to internal (x, y, w, h)
            x: ann.x !== undefined ? ann.x : (ann.centerX !== undefined ? ann.centerX : 0),
            y: ann.y !== undefined ? ann.y : (ann.centerY !== undefined ? ann.centerY : 0),
            w: ann.w !== undefined ? ann.w : (ann.width !== undefined ? ann.width : 0),
            h: ann.h !== undefined ? ann.h : (ann.height !== undefined ? ann.height : 0),
            isAugmented: ann.isAugmented
          }))
        }));
        setLabels(extractedLabels);

        // Stats
        const stats = {};
        extractedLabels.forEach(label => {
          label.annotations.forEach(ann => {
            stats[ann.classId] = (stats[ann.classId] || 0) + 1;
          });
        });
        setClassStats(stats);

        // Initialize Default Settings for all detected classes
        const defaults = {};
        if (propClasses) {
          propClasses.forEach((name, idx) => {
            defaults[idx] = {
              targetCount: 100,
              minScale: 0.8,
              maxScale: 1.2,
              enabled: true
            };
          });
        } else {
          Object.keys(stats).forEach(id => {
            defaults[id] = {
              targetCount: 100,
              minScale: 0.8,
              maxScale: 1.2,
              enabled: true
            };
          });
        }
        setClassSettings(defaults);
      };

      loadImages();
    }
  }, [propImages, propClasses]);


  // Calculate class distribution updates
  useEffect(() => {
    // If we have processed labels, show stats for them, otherwise show original
    const targetLabels = processedLabels.length > 0 ? processedLabels : labels;

    if (targetLabels.length > 0) {
      const stats = {};
      targetLabels.forEach(labelData => {
        labelData.annotations.forEach(ann => {
          stats[ann.classId] = (stats[ann.classId] || 0) + 1;
        });
      });
      setClassStats(stats);
    }
  }, [processedLabels]); // removed labels dep to avoid double calc, init handles first one

  // Extract symbol from image
  const extractSymbol = (img, annotation, padding = 5) => {
    // Basic dimensions
    const imgW = img.width;
    const imgH = img.height;

    // Ensure we have valid normalized coordinates
    const annX = annotation.x || 0;
    const annY = annotation.y || 0;
    const annW = annotation.w || 0;
    const annH = annotation.h || 0;

    const centerX = annX * imgW;
    const centerY = annY * imgH;
    const boxW = annW * imgW;
    const boxH = annH * imgH;

    // Canvas size should cover the box + padding in all directions
    // Ensure symmetric size so center remains center
    const extractW = Math.max(1, Math.ceil(boxW + padding * 2));
    const extractH = Math.max(1, Math.ceil(boxH + padding * 2));

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = extractW;
    canvas.height = extractH;
    const ctx = canvas.getContext('2d');

    // We want to copy from Image at (centerX - extractW/2) to (centerX + extractW/2)
    // To (0, 0) to (extractW, extractH)

    let sx = Math.floor(centerX - extractW / 2);
    let sy = Math.floor(centerY - extractH / 2);
    let sw = extractW;
    let sh = extractH;

    let dx = 0;
    let dy = 0;

    // Handle bounds/clipping
    if (sx < 0) {
      dx -= sx; // Shift destination right
      sw += sx; // Reduce source width (sx is negative)
      sx = 0;
    }
    if (sy < 0) {
      dy -= sy;
      sh += sy;
      sy = 0;
    }
    if (sx + sw > imgW) {
      sw = imgW - sx; // Cap width
    }
    if (sy + sh > imgH) {
      sh = imgH - sy;
    }

    // Final check for valid dimensions
    if (sw > 0 && sh > 0) {
      ctx.drawImage(img, sx, sy, sw, sh, dx, dy, sw, sh);

      // --- FEATHERING LOGIC (Alpha Blending) ---
      if (enableFeathering) {
        // Apply a localized alpha mask to fade edges
        const featherSize = Math.min(sw, sh) * 0.1; // 10% fade

        // We use 'destination-in' to keep existing content only where new shape is valid
        // Effectively masking using the alpha of what we draw next
        ctx.globalCompositeOperation = 'destination-in';

        // Create gradient mask
        // Ideally a radial gradient or rect gradient. Simple rect gradient for box.
        // Horizontal keys
        const gradH = ctx.createLinearGradient(0, 0, extractW, 0);
        gradH.addColorStop(0, 'rgba(0,0,0,0)');
        gradH.addColorStop(featherSize / extractW, 'rgba(0,0,0,1)');
        gradH.addColorStop(1 - (featherSize / extractW), 'rgba(0,0,0,1)');
        gradH.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = gradH;
        ctx.fillRect(0, 0, extractW, extractH);

        // Vertical keys
        const gradV = ctx.createLinearGradient(0, 0, 0, extractH);
        gradV.addColorStop(0, 'rgba(0,0,0,0)');
        gradV.addColorStop(featherSize / extractH, 'rgba(0,0,0,1)');
        gradV.addColorStop(1 - (featherSize / extractH), 'rgba(0,0,0,1)');
        gradV.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = gradV;
        ctx.fillRect(0, 0, extractW, extractH);

        // Reset composite
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    return {
      canvas,
      originalW: boxW,
      originalH: boxH,
      classId: annotation.classId
    };
  };

  // Helper: Apply Transformations (Brightness)
  const applyTransformations = (sourceCanvas, brightness) => {
    if (sourceCanvas.width === 0 || sourceCanvas.height === 0) {
      return sourceCanvas;
    }

    const canvas = document.createElement('canvas');
    canvas.width = sourceCanvas.width;
    canvas.height = sourceCanvas.height;
    const ctx = canvas.getContext('2d');

    // Draw Source
    ctx.drawImage(sourceCanvas, 0, 0);

    // 2. Brightness (Manual pixel manip for consistency)
    if (brightness !== 1.0) {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        // Only adjust if pixel has significance (alpha > 0)
        if (data[i + 3] > 0) {
          // Apply factor, clamp to 0-255
          data[i] = Math.min(255, Math.max(0, data[i] * brightness));     // R
          data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * brightness)); // G
          data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * brightness)); // B
        }
        // Alpha (i+3) unchanged
      }
      ctx.putImageData(imgData, 0, 0);
    }

    return canvas;
  };



  // Check if position is valid (no overlap with existing symbols)
  const isValidPosition = (x, y, w, h, existingAnnotations, imgW, imgH, minDistance = 0.05) => {
    // Check boundaries
    if (x - w / 2 < 0 || x + w / 2 > 1 || y - h / 2 < 0 || y + h / 2 > 1) {
      return false;
    }

    // Check overlap with existing annotations
    for (const ann of existingAnnotations) {
      const dx = Math.abs(x - ann.x);
      const dy = Math.abs(y - ann.y);
      const minDist = Math.max(w, h, ann.w, ann.h) / 2 + minDistance;

      if (dx < minDist && dy < minDist) {
        return false;
      }
    }

    return true;
  };

  // Copy-Paste Augmentation Logic (In-Place + Balance + Transforms)
  const performAugmentation = async () => {
    if (images.length === 0) {
      alert('No dataset loaded. Please upload a dataset in the main editor first.');
      return;
    }

    setProcessing(true);

    // Identify Classes to Augment based on Config Table
    const selectedClassEntries = Object.entries(classSettings).filter(([id, settings]) => settings.enabled);
    const selectedClassList = selectedClassEntries.map(([id]) => parseInt(id));

    if (selectedClassList.length === 0) {
      alert("Please enable at least one class in the table below to augment.");
      setProcessing(false);
      return;
    }

    // Calculate ORIGINAL stats for logic (ignore satisfied modified stats)
    const originalStats = {};
    labels.forEach(label => {
      label.annotations.forEach(ann => {
        originalStats[ann.classId] = (originalStats[ann.classId] || 0) + 1;
      });
    });

    // 1. Symbol Extraction Pool (Bucketed by Class)
    const symbolPool = {}; // Key: ClassId, Value: Array of symbols

    selectedClassList.forEach(id => symbolPool[id] = []);

    for (let imgIdx = 0; imgIdx < images.length; imgIdx++) {
      const imgObj = images[imgIdx];
      const label = labels[imgIdx]; // mapped 1:1 in hydrator logic

      if (label) {
        const rareSymbols = label.annotations.filter(ann => selectedClassList.includes(ann.classId));
        rareSymbols.forEach(ann => {
          const extracted = extractSymbol(imgObj.data, ann);
          if (!symbolPool[ann.classId]) symbolPool[ann.classId] = [];
          symbolPool[ann.classId].push(extracted);
        });
      }
    }

    // Check if we found symbols for categories
    const availableClasses = Object.keys(symbolPool).filter(id => symbolPool[id].length > 0);
    if (availableClasses.length === 0) {
      alert("No instances of the enabled classes were found in the dataset to act as source templates.");
      setProcessing(false);
      return;
    }

    // 2. Clone Labels to modify them
    const newLabels = JSON.parse(JSON.stringify(labels));
    const pendingPastes = {}; // Key: imageId, Value: Array of paste ops

    // 3. Injection Phase
    // Loop through each SELECTED class
    for (const classIdStr of availableClasses) {
      const classId = parseInt(classIdStr);
      const symbols = symbolPool[classId];
      const currentCount = originalStats[classId] || 0; // Use ORIGINAL count
      const settings = classSettings[classId];

      // Determine NEEDED count
      let needed = settings.targetCount - currentCount;

      if (needed <= 0) continue;

      // Perform injections
      for (let i = 0; i < needed; i++) {
        // Pick RANDOM symbol from the pool for this class
        const symbol = symbols[Math.floor(Math.random() * symbols.length)];

        // Apply Transforms (Brightness)
        const brightness = enableBrightness ? (0.8 + Math.random() * 0.4) : 1.0; // 0.8 to 1.2

        // Create a transformed visual for this specific injection instance
        const transformedCanvas = applyTransformations(symbol.canvas, brightness);

        let placed = false;
        let attempts = 0;
        const maxPlacementAttempts = 20;

        while (!placed && attempts < maxPlacementAttempts) {
          // Pick a random image from the entire dataset
          const targetImgIndex = Math.floor(Math.random() * images.length);
          const targetImg = images[targetImgIndex];

          // Find label
          const targetLabel = newLabels[targetImgIndex]; // 1:1 mapping

          if (!targetLabel) {
            attempts++;
            continue;
          }

          // No Rotation
          const rotated = transformedCanvas;

          // Determine Random Scale from Per-Class Settings
          const randomScale = settings.minScale + Math.random() * (settings.maxScale - settings.minScale);

          // AABB Calculation (simplified for 0 rotation)
          const rotW_abs = symbol.originalW;
          const rotH_abs = symbol.originalH;

          const newW = (rotW_abs / targetImg.data.width) * randomScale;
          const newH = (rotH_abs / targetImg.data.height) * randomScale;

          const newX = 0.1 + Math.random() * 0.8;
          const newY = 0.1 + Math.random() * 0.8;

          if (isValidPosition(newX, newY, newW, newH, targetLabel.annotations, targetImg.data.width, targetImg.data.height)) {
            // Success
            targetLabel.annotations.push({
              classId: symbol.classId,
              x: newX,
              y: newY,
              w: newW,
              h: newH,
              isAugmented: true
            });

            if (!pendingPastes[targetImg.id]) pendingPastes[targetImg.id] = [];

            pendingPastes[targetImg.id].push({
              img: rotated,
              x: newX * targetImg.data.width - rotated.width / 2,
              y: newY * targetImg.data.height - rotated.height / 2,
            });

            placed = true;
          }
          attempts++;
        }
      }
    }

    // 4. Rendering Phase
    const newProcessedImages = await Promise.all(images.map(async (imgObj) => {
      if (!pendingPastes[imgObj.id]) {
        return imgObj;
      }

      const pastes = pendingPastes[imgObj.id];

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = imgObj.data.width;
      canvas.height = imgObj.data.height;

      ctx.drawImage(imgObj.data, 0, 0);

      pastes.forEach(paste => {
        ctx.drawImage(paste.img, paste.x, paste.y);
      });

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
      const newSrc = URL.createObjectURL(blob);
      const newImg = new Image();
      newImg.src = newSrc;

      await new Promise(r => newImg.onload = r);

      return {
        ...imgObj,
        data: newImg,
        src: newSrc,
        isModified: true
      };
    }));

    setProcessedImages(newProcessedImages);
    setProcessedLabels(newLabels);
    setPreviewMode('processed');
    setProcessing(false);
    alert(`Augmentation Complete! Dataset enriched with new instances.`);
  };

  // Download Modified Dataset
  const downloadAugmentedDataset = async () => {
    if (processedImages.length === 0) return;

    setProcessing(true);
    const zip = new JSZip();

    // Add optional dataset.yaml
    if (datasetConfig) {
      // Reconstruct basic yaml if prop is object, or pass if string?
      // App.js passes object. We should dump needed parts or request text.
      // For simple solution, we can construct minimal yaml.
      let yamlText = `train: train/images\nval: valid/images\n\nnc: ${propClasses?.length || 0}\nnames: [${(propClasses || []).map(c => `"${c}"`).join(', ')}]`;
      zip.file("dataset.yaml", yamlText);
    }

    // Add ALL images (Processed or Original)
    for (const imgObj of processedImages) {
      // Get blob data
      let blob;
      if (imgObj.isModified) {
        // It's a processed image, need to get blob from its data source (which is an Image element)
        // Fastest way since we ALREADY have the blob src in memory is fetching it
        blob = await fetch(imgObj.src).then(r => r.blob());
      } else {
        // It's original, we might need to re-fetch or use canvas. 
        // If we kept the original file blob it would be faster, but we have img element.
        const canvas = document.createElement('canvas');
        canvas.width = imgObj.data.width;
        canvas.height = imgObj.data.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgObj.data, 0, 0);
        blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
      }

      const splitFolder = imgObj.split || 'train';
      zip.file(`${splitFolder}/images/${imgObj.name}`, blob);
    }

    // Add ALL Labels (Processed)
    for (const label of processedLabels) {
      const labelContent = label.annotations
        .map(ann => `${ann.classId} ${ann.x.toFixed(6)} ${ann.y.toFixed(6)} ${ann.w.toFixed(6)} ${ann.h.toFixed(6)}`)
        .join('\n');

      const splitFolder = label.split || 'train';
      zip.file(`${splitFolder}/labels/${label.name}`, labelContent);
    }

    // Generate ZIP
    const content = await zip.generateAsync({ type: "blob" });

    // Trigger download
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = "augmented_dataset_inplace.zip";
    a.click();
    URL.revokeObjectURL(url);
    setProcessing(false);
  };

  // Bulk apply target count
  const applyGlobalTarget = () => {
    setClassSettings(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        next[key] = { ...next[key], targetCount: globalTargetInput };
      });
      return next;
    });
  };

  // Save edited row
  const saveRow = (id) => {
    setClassSettings(prev => ({
      ...prev,
      [id]: { ...prev[id], ...editForm }
    }));
    setEditingClassId(null);
  };

  // Draw preview
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Determine which dataset to show
    const sourceImages = previewMode === 'processed' && processedImages.length > 0 ? processedImages : images;
    // Labels array aligns with images array by index in this refactor 1:1
    const sourceLabels = previewMode === 'processed' && processedLabels.length > 0 ? processedLabels : labels;

    if (sourceImages.length > 0 && currentImageIndex < sourceImages.length) {
      const imgObj = sourceImages[currentImageIndex];
      if (!imgObj.data) return; // Wait for load

      const img = imgObj.data;
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Draw bounding boxes
      const label = sourceLabels[currentImageIndex];

      if (label) {
        label.annotations.forEach(ann => {
          // Highlight augmented boxes specially
          const isAugmented = ann.isAugmented;

          let color = '#3b82f6'; // Blue (Common)
          if (isAugmented) color = '#22c55e'; // Green (New Paste)

          ctx.strokeStyle = color;
          ctx.lineWidth = 2;

          const x = (ann.x - ann.w / 2) * img.width;
          const y = (ann.y - ann.h / 2) * img.height;
          const w = ann.w * img.width;
          const h = ann.h * img.height;

          ctx.strokeRect(x, y, w, h);

          // Draw label
          ctx.fillStyle = color;
          ctx.font = '14px monospace';
          ctx.fillText(`Class ${ann.classId}`, x, y - 5);
        });
      }
    }
  }, [currentImageIndex, images, labels, processedImages, processedLabels, previewMode]);

  // ── Shared Tailwind class helpers ──────────────────────────
  const btn = "inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-white/10 hover:border-yellow-400/50 text-zinc-300 hover:text-yellow-300 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-lg active:scale-95";
  const btnPrimary = "inline-flex items-center gap-2 px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 border border-transparent text-black rounded-xl text-xs font-black transition-all cursor-pointer shadow-[0_0_20px_rgba(245,197,24,0.3)] active:scale-95 uppercase tracking-widest";
  const cardCls = "bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-2xl transition-all";
  const inputCls = "bg-zinc-900 border border-white/5 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-yellow-400/50 transition-all";
  const labelCls = "text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1 block mb-2";

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans flex flex-col overflow-hidden animate-in">
      
      {/* ── Top Navigation ── */}
      <header className="h-20 flex-shrink-0 border-b border-white/10 bg-zinc-950/50 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-50">
        <div className="flex items-center gap-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xl shadow-inner">🧩</div>
          <div>
            <h1 className="text-lg font-black tracking-tighter text-white leading-none mb-1 text-emerald-400">Copy-Paste Enrichment</h1>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">In-Place Dataset Augmentation</p>
          </div>
        </div>
        <button className={btn} onClick={() => setCurrentView('editor')}>
          <span className="text-lg">←</span> Back to Editor
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* ── Configuration Sidebar ── */}
        <aside className="w-[480px] border-r border-white/10 bg-zinc-950/30 flex flex-col overflow-y-auto custom-scrollbar p-8 space-y-8">
          
          {/* Transformation Controls */}
          <section className={cardCls}>
            <div className="flex items-center gap-2 mb-6">
              <Settings size={16} className="text-yellow-400" />
              <h3 className="text-[10px] font-bold text-zinc-200 uppercase tracking-widest leading-none">Global Processing</h3>
            </div>
            
            <div className="space-y-4">
              <label className="flex items-center gap-3 p-3 bg-zinc-900/50 border border-white/5 rounded-2xl cursor-pointer hover:bg-zinc-900 transition-colors group">
                <input
                  type="checkbox"
                  checked={enableFeathering}
                  onChange={(e) => setEnableFeathering(e.target.checked)}
                  className="w-4 h-4 rounded border-white/10 bg-black text-yellow-400 focus:ring-offset-black"
                />
                <div>
                   <p className="text-xs font-bold text-zinc-200 group-hover:text-white transition-colors">Edge Feathering</p>
                   <p className="text-[10px] text-zinc-500 font-medium">Soft scaling for topological blend</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-zinc-900/50 border border-white/5 rounded-2xl cursor-pointer hover:bg-zinc-900 transition-colors group">
                <input
                  type="checkbox"
                  checked={enableBrightness}
                  onChange={(e) => setEnableBrightness(e.target.checked)}
                  className="w-4 h-4 rounded border-white/10 bg-black text-yellow-400 focus:ring-offset-black"
                />
                <div>
                   <p className="text-xs font-bold text-zinc-200 group-hover:text-white transition-colors">Brightness Jitter</p>
                   <p className="text-[10px] text-zinc-500 font-medium">±20% photometric random variance</p>
                </div>
              </label>
            </div>
          </section>

          {/* Core Settings Table */}
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
               <h3 className={labelCls + " mb-0"}>Class Matrix</h3>
               <div className="flex items-center gap-2">
                 <input
                    type="number"
                    value={globalTargetInput}
                    onChange={(e) => setGlobalTargetInput(parseInt(e.target.value))}
                    className="w-16 bg-zinc-900 border border-white/5 rounded-lg px-2 py-1 text-[10px] font-mono text-yellow-400 focus:outline-none"
                  />
                  <button onClick={applyGlobalTarget} className="text-[9px] font-black text-zinc-500 hover:text-yellow-400 uppercase tracking-widest transition-colors">Apply All</button>
               </div>
            </div>

            <div className="bg-zinc-900/50 border border-white/10 rounded-[24px] overflow-hidden shadow-xl">
              <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-zinc-950 border-b border-white/5 text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                    <tr>
                      <th className="px-4 py-3 w-10">
                         <input
                            type="checkbox"
                            checked={Object.keys(classSettings).length > 0 && Object.values(classSettings).every(s => s.enabled)}
                            onChange={(e) => {
                              const newVal = e.target.checked;
                              setClassSettings(prev => {
                                const next = { ...prev };
                                Object.keys(next).forEach(key => { next[key].enabled = newVal; });
                                return next;
                              });
                            }}
                            className="w-4 h-4 rounded border-white/10 bg-black text-yellow-400"
                          />
                      </th>
                      <th className="px-4 py-3">Symbol Class</th>
                      <th className="px-4 py-3">NC</th>
                      <th className="px-4 py-3 text-right">Target</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {propClasses && Object.keys(classSettings).length > 0 ? (
                      Object.entries(classSettings).map(([idStr, settings]) => {
                        const id = parseInt(idStr);
                        const currentCount = classStats[id] || 0;
                        const isEditing = editingClassId === id;
                        const needed = Math.max(0, settings.targetCount - currentCount);

                        return (
                          <tr key={id} className={`group transition-colors ${isEditing ? "bg-yellow-400/5" : "hover:bg-white/[0.02]"}`}>
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={settings.enabled}
                                onChange={(e) => {
                                  setClassSettings(prev => ({
                                    ...prev,
                                    [id]: { ...prev[id], enabled: e.target.checked }
                                  }));
                                }}
                                className="w-4 h-4 rounded border-white/10 bg-black text-yellow-400"
                              />
                            </td>
                            <td className="px-4 py-3" onClick={() => setEditingClassId(id)}>
                               <p className="text-[11px] font-bold text-zinc-300 group-hover:text-white transition-colors">{propClasses[id] || `Class ${id}`}</p>
                               <p className="text-[9px] text-zinc-600 font-mono mt-0.5">{settings.minScale}x - {settings.maxScale}x</p>
                            </td>
                            <td className="px-4 py-3">
                               <span className="text-[10px] font-mono text-zinc-500">{currentCount}</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                               {isEditing ? (
                                 <input
                                   type="number"
                                   value={editForm.targetCount}
                                   onChange={(e) => setEditForm({ ...editForm, targetCount: parseInt(e.target.value) })}
                                   onBlur={() => saveRow(id)}
                                   onKeyDown={(e) => e.key === 'Enter' && saveRow(id)}
                                   className="w-16 bg-black border border-yellow-400/50 rounded-lg px-2 py-1 text-[10px] font-mono text-yellow-400 text-right focus:outline-none"
                                   autoFocus
                                 />
                               ) : (
                                 <div className="flex flex-col items-end" onClick={() => {
                                    setEditingClassId(id);
                                    setEditForm({ targetCount: settings.targetCount, minScale: settings.minScale, maxScale: settings.maxScale });
                                 }}>
                                    <span className="text-[10px] font-black text-white">{settings.targetCount}</span>
                                    {needed > 0 && <span className="text-[8px] font-bold text-emerald-500/70 tracking-tighter">+{needed} MORE</span>}
                                 </div>
                               )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr><td colSpan="4" className="px-4 py-8 text-center text-[10px] font-bold text-zinc-600 uppercase tracking-widest">No classes detected</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Primary Operations */}
          <section className="pt-4 space-y-4">
             <button
                onClick={performAugmentation}
                disabled={processing || images.length === 0}
                className={btnPrimary + " w-full py-4 text-center justify-center"}
              >
                {processing ? (
                   <div className="flex items-center gap-3 animate-pulse">
                      <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                      AUGMENTING POOL...
                   </div>
                ) : (
                  <div className="flex items-center gap-2">
                     <Play size={18} fill="currentColor" />
                     EXECUTE ENRICHMENT
                  </div>
                )}
             </button>

             {processedImages.length > 0 && (
               <div className="flex gap-3">
                  <button onClick={downloadAugmentedDataset} className="flex-1 py-4 bg-zinc-900 hover:bg-zinc-800 text-yellow-300 font-black text-[10px] rounded-2xl transition-all shadow-xl active:scale-95 uppercase tracking-widest border border-white/5">
                    📥 DOWNLOAD (ZIP)
                  </button>
                  <button onClick={() => { setProcessedImages([]); setProcessedLabels([]); setPreviewMode('original'); }} className="px-5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl border border-red-500/20 transition-all">
                    <Trash2 size={18} />
                  </button>
               </div>
             )}
          </section>
        </aside>

        {/* ── Preview Canvas ── */}
        <main className="flex-1 overflow-hidden flex flex-col bg-zinc-950">
           {/* Preview Header / Navbar */}
           <div className="h-16 flex-shrink-0 border-b border-white/5 flex items-center justify-between px-8 bg-black/40">
              <div className="flex p-1 bg-zinc-900/80 backdrop-blur-md rounded-2xl border border-white/5">
                <button
                  onClick={() => setPreviewMode('original')}
                  className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                    previewMode === 'original' ? "bg-white/10 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Source Feed
                </button>
                <button
                  onClick={() => { setPreviewMode('processed'); setCurrentImageIndex(0); }}
                  disabled={processedImages.length === 0}
                  className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                    previewMode === 'processed' ? "bg-emerald-500 text-black shadow-lg" : "text-zinc-500 hover:text-zinc-300 disabled:opacity-20"
                  }`}
                >
                  Processed Result
                </button>
              </div>

              {/* Navigation & Zoom */}
              <div className="flex items-center gap-6">
                 {images.length > 0 && (
                   <div className="flex items-center gap-4">
                      <button 
                         onClick={() => setCurrentImageIndex(Math.max(0, currentImageIndex - 1))}
                         disabled={currentImageIndex === 0}
                         className="p-2 hover:bg-white/5 rounded-lg text-zinc-500 disabled:opacity-20 transition-all"
                      >
                         <Minus size={18} />
                      </button>
                      <div className="text-center min-w-[80px]">
                         <p className="text-[10px] font-black text-white leading-none mb-0.5">{currentImageIndex + 1}</p>
                         <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">OF {images.length} TOTAL</p>
                      </div>
                      <button 
                         onClick={() => setCurrentImageIndex(Math.min(images.length - 1, currentImageIndex + 1))}
                         disabled={currentImageIndex >= images.length - 1}
                         className="p-2 hover:bg-white/5 rounded-lg text-zinc-500 disabled:opacity-20 transition-all"
                      >
                         <Plus size={18} />
                      </button>
                   </div>
                 )}
                 <div className="w-px h-6 bg-white/10" />
                 <div className="flex items-center gap-2">
                    <button onClick={() => setTransform(t => ({ ...t, scale: Math.max(0.1, t.scale - 0.1) }))} className="p-2 hover:bg-white/5 rounded-lg text-zinc-500 transition-all">
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                    </button>
                    <span className="text-[10px] font-mono font-bold text-yellow-400 w-12 text-center">{Math.round(transform.scale * 100)}%</span>
                    <button onClick={() => setTransform(t => ({ ...t, scale: Math.min(5, t.scale + 0.1) }))} className="p-2 hover:bg-white/5 rounded-lg text-zinc-500 transition-all">
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </button>
                 </div>
              </div>
           </div>

           {/* Viewport Canvas Container */}
           <div 
              className="flex-1 relative cursor-grab active:cursor-grabbing overflow-hidden group select-none"
              style={{ backgroundColor: '#050505' }}
              onWheel={(e) => {
                e.preventDefault();
                const scaleBy = 1.1;
                const oldScale = transform.scale;
                const direction = e.deltaY > 0 ? -1 : 1;
                const newScale = direction > 0 ? Math.min(10, oldScale * scaleBy) : Math.max(0.1, oldScale / scaleBy);
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const newX = x - (x - transform.x) * (newScale / oldScale);
                const newY = y - (y - transform.y) * (newScale / oldScale);
                setTransform({ x: newX, y: newY, scale: newScale });
              }}
              onMouseDown={(e) => { setIsPanning(true); startPan.current = { x: e.clientX - transform.x, y: e.clientY - transform.y }; }}
              onMouseMove={(e) => { if (!isPanning) return; setTransform(t => ({ ...t, x: e.clientX - startPan.current.x, y: e.clientY - startPan.current.y })); }}
              onMouseUp={() => setIsPanning(false)}
              onMouseLeave={() => setIsPanning(false)}
           >
              {images.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 space-y-4">
                   <div className="w-24 h-24 rounded-full bg-zinc-900 flex items-center justify-center text-4xl opacity-20 grayscale mb-4">🖼️</div>
                   <h3 className="text-xl font-bold text-white mb-1">Preview Terminal Offline</h3>
                   <p className="text-xs text-zinc-600 max-w-xs mx-auto uppercase tracking-widest font-black opacity-40">Load source telemetry from the primary editor first.</p>
                </div>
              ) : (
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 border border-white/5 shadow-2xl"
                  style={{
                    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                    transformOrigin: '0 0',
                    imageRendering: 'pixelated'
                  }}
                />
              )}

              {/* Legend Overlay */}
              <div className="absolute bottom-8 left-8 flex items-center gap-6 px-5 py-3 bg-zinc-950/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl">
                 <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Base Dataset</span>
                 </div>
                 {previewMode === 'processed' && (
                    <div className="flex items-center gap-3">
                       <div className="w-3 h-3 rounded bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                       <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Injected Symbol</span>
                    </div>
                 )}
                 <div className="w-px h-4 bg-white/10" />
                 <div className="flex items-center gap-2">
                    <Info size={14} className="text-zinc-600" />
                    <span className="text-[10px] font-bold text-zinc-600 uppercase">Mousewheel: Zoom | Click+Drag: Pan</span>
                 </div>
              </div>
           </div>
        </main>
      </div>

      {/* ── Status Bar ── */}
      <footer className="h-10 flex-shrink-0 bg-zinc-950 border-t border-white/5 px-8 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-600">
         <div className="flex items-center gap-6">
           <span className="flex items-center gap-1.5">
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> 
             System: {previewMode}
           </span>
         </div>
         <span className="font-mono text-zinc-500 italic">v4.0.0-AugEngine // {propClasses?.length || 0} Symbols Registered</span>
      </footer>
    </div>
  );
}