import React, { useState, useEffect } from "react";

const DatasetMonitor = ({
  images,
  classes,
  datasetSplit,
  availableSplits,
  onDatasetSplitChange,
  onImageSelect,
  onBackToEditor,
}) => {
  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedSplit, setSelectedSplit] = useState(datasetSplit);
  const [filteredImages, setFilteredImages] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [imagesPerPage] = useState(20);
  const [batchSize] = useState(50); // Batch size for grouping images
  const [selectedImageBatch, setSelectedImageBatch] = useState([]); // Images in the same batch as selected image

  // Filter images based on selected class and split
  useEffect(() => {
    let filtered = images;

    // Filter by class
    if (selectedClass !== "all") {
      const classId = classes.indexOf(selectedClass);
      if (classId !== -1) {
        filtered = filtered.filter(
          (image) =>
            image.annotations &&
            image.annotations.some(
              (annotation) => annotation.classId === classId
            )
        );
      }
    }

    setFilteredImages(filtered);
    setCurrentPage(1); // Reset to first page when filters change
    setSelectedImageBatch([]); // Clear batch when filters change
  }, [images, classes, selectedClass, selectedSplit]);

  // Handle split change
  const handleSplitChange = (newSplit) => {
    setSelectedSplit(newSplit);
    onDatasetSplitChange(newSplit);
  };

  // Handle image click to show batch
  const handleImageClick = (imageIndexInFiltered, image) => {
    // Find which batch this image belongs to
    const batchIndex = Math.floor(imageIndexInFiltered / batchSize);
    const batchStart = batchIndex * batchSize;
    const batchEnd = Math.min(batchStart + batchSize, filteredImages.length);
    const batchImages = filteredImages.slice(batchStart, batchEnd);

    setSelectedImageBatch(batchImages);

    // Find the global index in the master images list
    const masterIndex = images.findIndex((img) => img.id === image.id);
    onImageSelect(masterIndex);
  };

  // Pagination
  const indexOfLastImage = currentPage * imagesPerPage;
  const indexOfFirstImage = indexOfLastImage - imagesPerPage;
  const currentImages = filteredImages.slice(
    indexOfFirstImage,
    indexOfLastImage
  );
  const totalPages = Math.ceil(filteredImages.length / imagesPerPage);

  // Handle page change
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // ── Shared Tailwind class helpers ──────────────────────────
  const btn = "inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-white/10 hover:border-cyan-500/50 text-zinc-300 hover:text-cyan-400 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed active:scale-95";
  const cardCls = "bg-zinc-900/30 backdrop-blur-sm border border-white/5 rounded-2xl p-5 shadow-inner transition-all";
  const labelCls = "text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1 block mb-2";
  const selectCls = "w-full bg-zinc-900/80 border border-white/5 rounded-xl px-4 py-3 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all appearance-none cursor-pointer";

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans flex flex-col overflow-hidden animate-in">
      
      {/* ── Top Navigation ── */}
      <header className="h-20 flex-shrink-0 border-b border-white/10 bg-zinc-950/50 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-50">
        <div className="flex items-center gap-5">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-xl shadow-inner">🔍</div>
          <div>
            <h1 className="text-lg font-black tracking-tighter text-white leading-none mb-1">Dataset Monitor</h1>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Visual Inspection Engine</p>
          </div>
        </div>
        <button onClick={onBackToEditor} className={btn}>
          <span className="text-lg">←</span> Back to Editor
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* ── Filter Sidebar ── */}
        <aside className="w-[380px] border-r border-white/10 bg-zinc-950/30 flex flex-col overflow-y-auto custom-scrollbar p-8 space-y-8">
          
          <section className="space-y-6">
             <header>
               <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Filter Hierarchy</h3>
               <p className="text-[10px] text-zinc-600 font-medium">Drill down into specific subsets of your data repository.</p>
             </header>

             <div className="space-y-4">
                {/* Class Filter */}
                <div className="space-y-2 relative">
                  <label className={labelCls}>Semantic Class</label>
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className={selectCls}
                  >
                    <option value="all">All Classes</option>
                    {classes.map((cls, index) => (
                      <option key={index} value={cls}>{cls}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-[38px] pointer-events-none text-zinc-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>

                {/* Split Selection */}
                <div className="space-y-2 relative">
                  <label className={labelCls}>Logical Split</label>
                  <select
                    value={selectedSplit}
                    onChange={(e) => handleSplitChange(e.target.value)}
                    className={selectCls}
                  >
                    <option value="train">Train</option>
                    <option value="valid">Valid</option>
                    <option value="test">Test</option>
                    {availableSplits.map((split) => (
                      <option key={split} value={split}>{split.charAt(0).toUpperCase() + split.slice(1)}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-[38px] pointer-events-none text-zinc-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
                <p className="text-[10px] text-cyan-500 font-mono italic px-1">Retrieved {filteredImages.length} matches</p>
             </div>
          </section>

          <section className="space-y-4">
             <h3 className={labelCls}>Distribution Analytics</h3>
             {classes.map((cls, index) => {
               const classId = index;
               const classImageCount = images.filter(image => 
                 image.annotations && image.annotations.some(ann => ann.classId === classId)
               ).length;
               const percentage = images.length > 0 ? ((classImageCount / images.length) * 100).toFixed(1) : 0;

               return (
                 <div key={index} className="space-y-1.5 group">
                   <div className="flex justify-between text-[10px] font-bold px-1">
                     <span className="text-zinc-400 group-hover:text-white transition-colors uppercase tracking-tight">{cls}</span>
                     <span className="text-zinc-600 font-mono">{classImageCount} <span className="opacity-40">|</span> {percentage}%</span>
                   </div>
                   <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-white/5">
                     <div 
                        className="h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_8px_rgba(6,182,212,0.3)]"
                        style={{ 
                          backgroundColor: `hsl(${index * 40}, 60%, 50%)`,
                          width: `${percentage}%` 
                        }} 
                     />
                   </div>
                 </div>
               );
             })}
          </section>

          <section className="mt-auto pt-8 border-t border-white/5">
              <div className={cardCls + " p-4 space-y-3"}>
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-emerald-500 shadow-inner">📈</div>
                    <div>
                       <p className="text-[10px] font-bold text-white leading-none mb-1">Telemetry Summary</p>
                       <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Active Repository</p>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-2">
                    <div className="bg-black/40 rounded-xl p-2.5 border border-white/5">
                       <p className="text-[9px] text-zinc-600 font-bold uppercase mb-1">Total</p>
                       <p className="text-xs font-mono font-bold text-zinc-300">{images.length}</p>
                    </div>
                    <div className="bg-black/40 rounded-xl p-2.5 border border-white/5">
                       <p className="text-[9px] text-zinc-600 font-bold uppercase mb-1">Filtered</p>
                       <p className="text-xs font-mono font-bold text-cyan-500">{filteredImages.length}</p>
                    </div>
                 </div>
              </div>
          </section>
        </aside>

        {/* ── Image Canvas ── */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-12 bg-zinc-900/10 relative">
           <div className="max-w-7xl mx-auto space-y-8">
             
             <header className="flex items-center justify-between mb-2">
                <div>
                   <h2 className="text-2xl font-black text-white tracking-tight">
                     {selectedImageBatch.length > 0 ? "Batch Inspector" : "Asset Library"}
                   </h2>
                   <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">
                     {selectedImageBatch.length > 0 ? `Isolating sequence: ${selectedImageBatch.length} items` : "Browsing full dataset collection"}
                   </p>
                </div>
                {selectedImageBatch.length > 0 && (
                   <button onClick={() => setSelectedImageBatch([])} className={btn}>
                     ← Return to main grid
                   </button>
                )}
             </header>

             {filteredImages.length > 0 ? (
               <div className="image-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                 {(selectedImageBatch.length > 0 ? selectedImageBatch : currentImages).map((image, index) => {
                   const globalIndex = selectedImageBatch.length > 0 
                     ? filteredImages.findIndex(img => img.id === image.id)
                     : indexOfFirstImage + index;
                   
                   const annotationCount = image.annotations ? image.annotations.length : 0;
                   const classDistribution = {};
                   if (image.annotations) {
                     image.annotations.forEach(ann => {
                       const name = classes[ann.classId] || "Unknown";
                       classDistribution[name] = (classDistribution[name] || 0) + 1;
                     });
                   }

                   return (
                     <motion.div
                       key={image.id}
                       initial={{ opacity: 0, scale: 0.95 }}
                       animate={{ opacity: 1, scale: 1 }}
                       whileHover={{ y: -4, scale: 1.02 }}
                       onClick={() => handleImageClick(globalIndex, image)}
                       className="group cursor-pointer"
                     >
                       <div className="relative aspect-square bg-zinc-900 rounded-[24px] overflow-hidden border border-white/5 group-hover:border-cyan-500/30 transition-all shadow-xl">
                         <img src={image.src} alt={image.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                         <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                         
                         {/* Annotation Indicator */}
                         <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 text-[9px] font-black text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                           {annotationCount} ANNS
                         </div>
                       </div>
                       <div className="mt-3 px-2">
                         <h4 className="text-[10px] font-bold text-zinc-300 truncate w-full group-hover:text-white transition-colors tracking-tight">{image.name}</h4>
                         <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mt-0.5">
                            {Object.keys(classDistribution).length > 0 
                              ? Object.keys(classDistribution).slice(0, 1).join("") + (Object.keys(classDistribution).length > 1 ? "..." : "")
                              : "No labels"
                            }
                         </p>
                       </div>
                     </motion.div>
                   );
                 })}
               </div>
             ) : (
               <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
                  <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center text-4xl grayscale opacity-50">🎑</div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">No Assets Found</h3>
                    <p className="text-xs text-zinc-600 max-w-xs mx-auto">No images match the current semantic or logical filters in your active workspace.</p>
                  </div>
                  <button onClick={() => setSelectedClass("all")} className={btn + " mt-4"}>Reset all filters</button>
               </div>
             )}

             {/* Pagination Footer */}
             {!selectedImageBatch.length && totalPages > 1 && (
                <div className="flex items-center justify-center gap-6 mt-16 pt-8 border-t border-white/5">
                   <button 
                      onClick={() => paginate(currentPage - 1)} 
                      disabled={currentPage === 1}
                      className="w-10 h-10 flex items-center justify-center bg-zinc-900 hover:bg-zinc-800 border border-white/10 rounded-xl disabled:opacity-20 transition-all"
                   >
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                   </button>
                   
                   <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Page</span>
                      <div className="px-3 py-1 bg-white/5 rounded-lg border border-white/10 text-xs font-mono font-bold text-cyan-500">{currentPage}</div>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">of {totalPages}</span>
                   </div>

                   <button 
                      onClick={() => paginate(currentPage + 1)} 
                      disabled={currentPage === totalPages}
                      className="w-10 h-10 flex items-center justify-center bg-zinc-900 hover:bg-zinc-800 border border-white/10 rounded-xl disabled:opacity-20 transition-all"
                   >
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                   </button>
                </div>
             )}
           </div>
        </main>
      </div>

      {/* ── Status Bar ── */}
      <footer className="h-10 flex-shrink-0 bg-zinc-950 border-t border-white/5 px-8 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-600">
         <div className="flex items-center gap-6">
           <span className="flex items-center gap-1.5">
             <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/50 shadow-[0_0_8px_rgba(6,182,212,0.5)]" /> 
             Inspector Mode: {selectedSplit}
           </span>
         </div>
         <span className="font-mono text-zinc-500 italic">v4.0.0-VisualEng // {filteredImages.length} Images Streamed</span>
      </footer>
    </div>
  );
};

export default DatasetMonitor;
