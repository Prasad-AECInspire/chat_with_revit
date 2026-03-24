import React, { useState, useEffect, useMemo } from "react";

const ImageSelectionModal = ({ isOpen, files, onConfirm, onCancel }) => {
  const [selectedPaths, setSelectedPaths] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const itemsPerPage = 24;

  // ── Shared Tailwind class helpers ──────────────────────────
  const btn = "inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-white/10 hover:border-cyan-500/50 text-zinc-400 hover:text-cyan-400 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed active:scale-95";
  const btnPrimary = "inline-flex items-center gap-1.5 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 border border-transparent text-black rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.2)] active:scale-95 disabled:opacity-30";
  const inputCls = "bg-black/50 border border-white/10 focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/10 rounded-lg px-4 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-all w-full";

  useEffect(() => {
    if (isOpen) {
      setSelectedPaths(new Set());
      setCurrentPage(1);
      setSearchTerm("");
    }
  }, [isOpen]);

  const filteredFiles = useMemo(() => {
    if (!files) return [];
    if (!searchTerm) return files;
    return files.filter((f) =>
      (typeof f === "string" ? f : f.path)
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    );
  }, [files, searchTerm]);

  const totalPages = Math.ceil(filteredFiles.length / itemsPerPage);
  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredFiles.slice(start, start + itemsPerPage);
  }, [filteredFiles, currentPage]);

  const toggleSelection = (path) => {
    const s = new Set(selectedPaths);
    s.has(path) ? s.delete(path) : s.add(path);
    setSelectedPaths(s);
  };

  const selectAllOnPage = () => {
    const s = new Set(selectedPaths);
    currentItems.forEach((item) =>
      s.add(typeof item === "string" ? item : item.path)
    );
    setSelectedPaths(s);
  };

  const deselectAllOnPage = () => {
    const s = new Set(selectedPaths);
    currentItems.forEach((item) =>
      s.delete(typeof item === "string" ? item : item.path)
    );
    setSelectedPaths(s);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="bg-zinc-950/80 border border-white/10 rounded-[32px] shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col w-full h-full max-w-6xl max-h-[85vh] overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[100px] -mr-32 -mt-32 rounded-full" />

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-white/5 bg-zinc-950/50 relative z-10">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight mb-0.5">
              Resource Selection
            </h2>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">
              Select images to stage for processing
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="px-4 py-1.5 bg-zinc-900 border border-white/5 rounded-full flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                {selectedPaths.size} Selected
              </span>
            </div>
            <div className="h-6 w-px bg-white/5 mx-2" />
            <button onClick={onCancel} className={btn}>
              Abort
            </button>
            <button
              onClick={() => onConfirm(Array.from(selectedPaths))}
              disabled={selectedPaths.size === 0}
              className={btnPrimary}
            >
              Commit Selection
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex gap-3 px-8 py-4 border-b border-white/5 bg-zinc-950/30 backdrop-blur-md relative z-10">
          <div className="relative flex-1 group">
            <input
              type="text"
              placeholder="Filter by filename..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className={inputCls}
            />
          </div>
          <button onClick={selectAllOnPage} className={btn}>
            Select Page
          </button>
          <button onClick={deselectAllOnPage} className={btn}>
            Clear Page
          </button>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative z-10">
          <div
            className="grid gap-6 px-1"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
          >
            {currentItems.map((item, index) => {
              const path = typeof item === "string" ? item : item.path;
              const filename = path.split(/[\\/]/).pop();
              const isSelected = selectedPaths.has(path);
              const imageUrl = `${
                process.env.API_URL
              }/Datasets/image?path=${encodeURIComponent(path)}`;
              return (
                <div
                  key={index}
                  onClick={() => toggleSelection(path)}
                  className={`group cursor-pointer rounded-2xl overflow-hidden border-2 transition-all duration-300 relative aspect-square ${
                    isSelected
                      ? "border-cyan-500 bg-cyan-500/10 shadow-[0_0_20px_rgba(6,182,212,0.15)] ring-4 ring-cyan-500/10"
                      : "border-white/5 bg-zinc-900 hover:border-white/20 hover:scale-[1.02]"
                  }`}
                >
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 overflow-hidden">
                    <img
                      src={imageUrl}
                      alt={filename}
                      loading="lazy"
                      crossOrigin="Anonymous"
                      className={`w-full h-full object-contain transition-transform duration-500 ${
                        isSelected ? "scale-105" : "group-hover:scale-110"
                      }`}
                    />
                  </div>
                  
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center shadow-lg shadow-black/50 animate-in zoom-in-50">
                       <span className="text-[10px] text-black font-black">✓</span>
                    </div>
                  )}

                  <div
                    className={`absolute bottom-0 left-0 right-0 px-3 py-2 text-[9px] font-bold truncate text-center backdrop-blur-md transition-colors ${
                      isSelected
                        ? "text-cyan-400 bg-cyan-950/80"
                        : "text-zinc-500 bg-black/60 group-hover:bg-black/80 group-hover:text-zinc-300"
                    }`}
                  >
                    {filename}
                  </div>
                </div>
              );
            })}
          </div>
          {currentItems.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center opacity-30 pb-20">
              <span className="text-4xl mb-4">🔍</span>
              <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                No matching resources found
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-8 py-6 border-t border-white/5 bg-zinc-950/80 relative z-10">
          <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
            Page <span className="text-zinc-400">{currentPage}</span> of{" "}
            <span className="text-zinc-400">{Math.max(1, totalPages)}</span>
          </p>
          <div className="flex items-center gap-3">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className={btn}
            >
              Previous
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className={btn}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageSelectionModal;
