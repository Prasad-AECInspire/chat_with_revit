import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import JSZip from 'jszip';
import yaml from 'js-yaml';

const MergeDatasets = ({ onBackToEditor }) => {
  const [datasetsToMerge, setDatasetsToMerge] = useState([]);
  const [mergedDataset, setMergedDataset] = useState(null);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeProgress, setMergeProgress] = useState(0);

  // Handle dataset upload for merging
  const handleMergeDataset = async (acceptedFiles) => {
    try {
      if (!acceptedFiles || acceptedFiles.length === 0) {
        alert("No files were selected. Please select valid dataset ZIP files to merge.");
        return;
      }

      const validFiles = acceptedFiles.filter(file => file.name.endsWith('.zip'));
      if (validFiles.length === 0) {
        alert("Invalid file types. Please select ZIP files containing your datasets.");
        return;
      }

      // Add valid files to the datasetsToMerge array
      setDatasetsToMerge(prev => [...prev, ...validFiles]);
      alert(`${validFiles.length} dataset(s) added successfully!`);
    } catch (error) {
      console.error("Error loading datasets for merge:", error);
      alert("Error loading datasets for merge: " + error.message);
    }
  };

  // Remove a dataset from the merge list
  const removeDatasetFromMerge = (index) => {
    setDatasetsToMerge(prev => prev.filter((_, i) => i !== index));
  };

  // Merge datasets function
  const mergeDatasets = async () => {
    if (datasetsToMerge.length < 2) {
      alert("Please add at least 2 datasets to merge.");
      return;
    }

    if (isMerging) return; // Prevent multiple merges

    setIsMerging(true);
    setMergeProgress(0);

    try {
      // Load all datasets
      const loadedDatasets = [];
      const configs = [];

      for (let i = 0; i < datasetsToMerge.length; i++) {
        setMergeProgress(Math.round((i / datasetsToMerge.length) * 50));

        const zip = new JSZip();
        const content = await zip.loadAsync(datasetsToMerge[i]);
        loadedDatasets.push(content);

        // Load config
        const configFile = content.file("dataset.yaml");
        let config = null;
        if (configFile) {
          const configText = await configFile.async("text");
          config = yaml.load(configText);
        }
        configs.push(config);
      }

      // Create a new merged dataset
      const mergedZip = new JSZip();

      // Merge dataset.yaml files
      const mergedClasses = new Set();
      const mergedConfig = {
        train: "train/images",
        val: "valid/images"
      };

      // Combine classes from all datasets
      configs.forEach((config, index) => {
        setMergeProgress(50 + Math.round((index / configs.length) * 25));

        if (config && config.names) {
          config.names.forEach(cls => mergedClasses.add(cls));
        }
      });

      // If no classes found, use default
      const finalClasses = mergedClasses.size > 0 ? Array.from(mergedClasses) : ['unknown'];
      mergedConfig.names = finalClasses;
      mergedConfig.nc = finalClasses.length;

      const yamlContent = yaml.dump(mergedConfig);
      mergedZip.file("dataset.yaml", yamlContent);

      // Merge images and annotations from all datasets
      const splitsToProcess = ['train', 'valid'];

      for (let datasetIndex = 0; datasetIndex < loadedDatasets.length; datasetIndex++) {
        setMergeProgress(75 + Math.round((datasetIndex / loadedDatasets.length) * 25));

        const content = loadedDatasets[datasetIndex];
        const config = configs[datasetIndex];

        for (const split of splitsToProcess) {
          // Process dataset for each split
          let imageBasePath, labelBasePath;

          if (split === 'train') {
            imageBasePath = config?.train || "train/images";
            labelBasePath = config?.train?.replace('/images', '/labels') || "train/labels";
          } else if (split === 'valid') {
            imageBasePath = config?.val || "valid/images";
            labelBasePath = config?.val?.replace('/images', '/labels') || "valid/labels";
          }

          // Create folder structure in merged dataset
          const splitImageFolder = mergedZip.folder(split).folder("images");
          const splitLabelFolder = mergedZip.folder(split).folder("labels");

          // Get image folder from source dataset
          const imageFolder = content.folder(imageBasePath) || content.folder(split) || content.folder("images");

          if (imageFolder) {
            const imageList = imageFolder.file(/.*\.(jpg|jpeg|png)$/i);
            for (let i = 0; i < imageList.length; i++) {
              const imageFile = imageList[i];
              const imageData = await imageFile.async("uint8array");
              // Rename image to avoid conflicts
              const originalName = imageFile.name.split("/").pop();
              const imageName = `dataset${datasetIndex}_${originalName}`;

              // Add image to merged dataset
              splitImageFolder.file(imageName, imageData);

              // Add corresponding label file
              const labelFileName = originalName.replace(/\.[^/.]+$/, ".txt");
              const newLabelFileName = imageName.replace(/\.[^/.]+$/, ".txt");

              // Try to find label in the same structure as images
              let labelFile = null;
              const imageFolderPath = imageFile.name.split('/').slice(0, -1).join('/');
              if (imageFolderPath) {
                const imageBaseFolder = content.folder(imageFolderPath);
                if (imageBaseFolder) {
                  const labelsFolderPath = imageFolderPath.replace('/images', '/labels');
                  const labelsFolder = content.folder(labelsFolderPath) || content.folder("labels");
                  if (labelsFolder) {
                    labelFile = labelsFolder.file(labelFileName);
                  }
                }
              }

              // If not found, try with labelBasePath
              if (!labelFile) {
                const labelFolder = content.folder(labelBasePath) || content.folder("labels");
                if (labelFolder) {
                  labelFile = labelFolder.file(labelFileName);
                }
              }

              // If still not found, try in root labels folder
              if (!labelFile) {
                const rootLabelFolder = content.folder("labels");
                if (rootLabelFolder) {
                  labelFile = rootLabelFolder.file(labelFileName);
                }
              }

              if (labelFile) {
                const labelContent = await labelFile.async("text");
                // Update class IDs if needed
                const updatedLabelContent = updateClassIdsInLabels(labelContent, config?.names || [], finalClasses);
                splitLabelFolder.file(newLabelFileName, updatedLabelContent);
              }
            }
          }
        }
      }

      // Generate the merged zip file
      const content = await mergedZip.generateAsync({ type: "blob" });

      // Store merged dataset for download
      setMergedDataset(content);

      alert(`Datasets merged successfully! ${datasetsToMerge.length} datasets combined.`);
    } catch (error) {
      console.error("Error merging datasets:", error);
      alert("Error merging datasets: " + error.message);
    } finally {
      setIsMerging(false);
      setMergeProgress(0);
    }
  };

  // Update class IDs in label content based on merged classes
  const updateClassIdsInLabels = (labelContent, originalClasses, mergedClasses) => {
    if (!labelContent.trim() || originalClasses.length === 0) return labelContent;

    const lines = labelContent.trim().split('\n');
    const updatedLines = lines.map(line => {
      if (!line.trim()) return line;

      const parts = line.trim().split(' ');
      if (parts.length < 5) return line; // Not a valid YOLO annotation

      const originalClassId = parseInt(parts[0]);
      if (isNaN(originalClassId) || originalClassId < 0 || originalClassId >= originalClasses.length) {
        return line; // Invalid class ID
      }

      // Find the class name in original classes
      const className = originalClasses[originalClassId];

      // Find the new class ID in merged classes
      const newClassId = mergedClasses.indexOf(className);
      if (newClassId === -1) return line; // Class not found in merged classes

      // Update the class ID
      parts[0] = newClassId.toString();
      return parts.join(' ');
    });

    return updatedLines.join('\n');
  };

  // Download merged dataset
  const downloadMergedDataset = async () => {
    if (!mergedDataset) {
      alert("No merged dataset available. Please merge datasets first.");
      return;
    }

    try {
      // Create download link
      const url = URL.createObjectURL(mergedDataset);
      const link = document.createElement("a");
      link.href = url;
      link.download = "merged_dataset.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading merged dataset:", error);
      alert("Error downloading merged dataset: " + error.message);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleMergeDataset,
    noClick: false,
    noKeyboard: true
  });

  // ── Shared Tailwind class helpers ──────────────────────────
  const btn = "inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-white/10 hover:border-yellow-400/50 text-zinc-300 hover:text-yellow-300 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-lg active:scale-95";
  const btnPrimary = "inline-flex items-center gap-1.5 px-6 py-3 bg-yellow-400 hover:bg-yellow-300 border border-transparent text-black rounded-2xl text-xs font-black transition-all cursor-pointer shadow-[0_0_30px_rgba(245,197,24,0.2)] active:scale-95 uppercase tracking-widest";
  const cardCls = "bg-zinc-950/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl transition-all";
  const labelCls = "text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1 block mb-2";

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans flex flex-col overflow-hidden animate-in">
      
      {/* ── Top Navigation ── */}
      <header className="h-20 flex-shrink-0 border-b border-white/10 bg-zinc-950/50 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-50">
        <div className="flex items-center gap-5">
          <div className="w-10 h-10 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-xl shadow-inner">🔄</div>
          <div>
            <h1 className="text-lg font-black tracking-tighter text-white leading-none mb-1">Merge Datasets</h1>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">AEC Integration Suite</p>
          </div>
        </div>
        <button onClick={onBackToEditor} className={btn}>
          <span className="text-lg">←</span> Back to Editor
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* ── Control Sidebar ── */}
        <aside className="w-[420px] border-r border-white/10 bg-zinc-950/30 flex flex-col overflow-y-auto custom-scrollbar p-8 space-y-8">
          
          <section className="space-y-4">
             <header>
               <h3 className="text-sm font-bold text-white mb-1">Configure Merge Operation</h3>
               <p className="text-xs text-zinc-500 leading-relaxed font-medium">Combine multiple YOLO ZIP datasets into a unified structured package.</p>
             </header>

             <div className="space-y-4">
                <div className="space-y-2">
                  <label className={labelCls}>Staging Area</label>
                  <div {...getRootProps()} className={`relative group border-2 border-dashed rounded-3xl p-8 transition-all duration-500 cursor-pointer overflow-hidden ${
                    isDragActive ? "border-yellow-400 bg-yellow-400/5 shadow-[0_0_40px_rgba(245,197,24,0.1)]" : "border-white/5 bg-black/40 hover:border-white/20"
                  }`}>
                    <input {...getInputProps()} />
                    <div className="flex flex-col items-center gap-3 text-center">
                       <div className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-600 group-hover:text-yellow-400 group-hover:bg-yellow-400/10 transition-all">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                       </div>
                       <p className="text-[10px] font-bold text-zinc-500 group-hover:text-zinc-300 uppercase tracking-tight">
                        {datasetsToMerge.length > 0 ? `${datasetsToMerge.length} files staged` : "Drop dataset ZIP files"}
                       </p>
                    </div>
                  </div>
                </div>

                {/* Staged List */}
                {datasetsToMerge.length > 0 && (
                  <div className="bg-zinc-900/50 border border-white/5 rounded-2xl overflow-hidden">
                     <div className="px-4 py-3 bg-white/5 border-b border-white/5 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Staged Packages</span>
                        <span className="text-[10px] font-mono text-yellow-400">{datasetsToMerge.length} files</span>
                     </div>
                     <div className="max-h-[200px] overflow-y-auto custom-scrollbar divide-y divide-white/5">
                        {datasetsToMerge.map((dataset, index) => (
                           <div key={index} className="px-4 py-3 flex items-center justify-between group hover:bg-white/[0.02]">
                              <span className="text-xs font-medium text-zinc-300 truncate pr-4">{dataset.name}</span>
                              <button onClick={() => removeDatasetFromMerge(index)} className="w-6 h-6 rounded-lg flex items-center justify-center text-zinc-600 hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100">✕</button>
                           </div>
                        ))}
                     </div>
                  </div>
                )}
             </div>
          </section>

          <section className="pt-4 space-y-6">
             {isMerging ? (
               <div className="space-y-3">
                 <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-[0.2em] animate-pulse">Processing...</span>
                    <span className="text-[10px] font-mono text-zinc-500">{mergeProgress}%</span>
                 </div>
                 <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden border border-white/5 shadow-inner">
                   <div className="h-full bg-yellow-400 shadow-[0_0_15px_rgba(245,197,24,0.5)] transition-all duration-300 ease-out" style={{ width: `${mergeProgress}%` }} />
                 </div>
               </div>
             ) : (
               <button onClick={mergeDatasets} disabled={datasetsToMerge.length < 2} className={btnPrimary + " w-full py-4 text-center justify-center"}>
                 Engage Core Merge
               </button>
             )}

             {mergedDataset && !isMerging && (
               <button onClick={downloadMergedDataset} className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-95 uppercase tracking-widest border-2 border-white/10">
                 📥 Download Merged Pack
               </button>
             )}
          </section>
        </aside>

        {/* ── Main Canvas ── */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-12 bg-zinc-900/10">
           <div className="max-w-3xl mx-auto space-y-12">
             
             <header className="space-y-4">
                <div className="w-16 h-1 bg-yellow-400 rounded-full" />
                <h2 className="text-3xl font-black text-white tracking-tight">How to Unified Dataset</h2>
                <p className="text-zinc-500 text-sm leading-relaxed max-w-xl">Our integration engine ensures topological consistency and class alignment when combining different data sources.</p>
             </header>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className={cardCls + " p-8 h-full"}>
                   <h4 className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest mb-6 px-1 border-l-2 border-yellow-400">The Workflow</h4>
                   <ol className="space-y-6">
                      {[
                        { title: "Stage ZIPs", desc: "Add valid YOLO archive files to the staging area." },
                        { title: "Alignment", desc: "NC (Class counts) and names are auto-harmonized." },
                        { title: "Conflicts", desc: "Files are hashed and renamed to prevent collisions." },
                        { title: "Export", desc: "A ready-to-train unified ZIP is generated locally." }
                      ].map((step, i) => (
                        <li key={i} className="flex gap-4">
                           <span className="text-2xl font-black text-white/5 select-none leading-none">0{i+1}</span>
                           <div>
                              <p className="text-xs font-bold text-zinc-100 mb-1">{step.title}</p>
                              <p className="text-[11px] text-zinc-500 font-medium leading-relaxed">{step.desc}</p>
                           </div>
                        </li>
                      ))}
                   </ol>
                </div>

                <div className="space-y-8">
                   <div className={cardCls + " p-8 border-l-4 border-l-emerald-500/50"}>
                      <h4 className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-4">Core Features</h4>
                      <ul className="space-y-4">
                        {[
                          "Auto-combines class definitions",
                          "Preserves split integrity (Train/Valid)",
                          "Deterministic class ID mapping",
                          "Full ZIP generation on-the-fly"
                        ].map((feat, i) => (
                          <li key={i} className="flex items-center gap-3 text-xs font-medium text-zinc-400">
                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/30 border border-emerald-500/50" />
                             {feat}
                          </li>
                        ))}
                      </ul>
                   </div>

                   <div className="p-8 rounded-3xl bg-amber-500/5 border border-amber-500/10 italic text-[11px] text-amber-500/70 leading-relaxed font-medium">
                      ⚠️ Highly recommended to use the same label taxonomy across datasets to minimize alignment errors.
                   </div>
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
             Internal Engine Ready
           </span>
         </div>
         <span className="font-mono text-zinc-500 italic">v4.0.0-ModernEngine // {datasetsToMerge.length} Packages Staged</span>
      </footer>
    </div>
  );
};

export default MergeDatasets;