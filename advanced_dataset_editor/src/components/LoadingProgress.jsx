import React from "react";

const formatBytes = (bytes, decimals = 2) => {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + " " + sizes[i];
};

const LoadingProgress = ({ current = 0, total = 0, stage = "Loading...", memoryUsage = null, showMemory = true, onCancel = null }) => {
  const percentage = total > 0 ? (current / total) * 100 : 0;
  const memPct = memoryUsage?.percentage || 0;
  const memWarn = memPct > 85;

  return (
    <div className="fixed inset-0 z-[9998] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="bg-zinc-950/80 border border-white/10 rounded-[32px] p-10 min-w-[420px] shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-48 h-48 bg-yellow-400/5 blur-[80px] -mr-24 -mt-24 rounded-full transition-all group-hover:bg-yellow-400/10" />

        {/* Header */}
        <div className="flex items-center justify-between mb-8 relative z-10">
          <div>
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-1">
              System Pipeline
            </h2>
            <div className="flex items-center gap-3">
               <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shadow-[0_0_8px_rgba(245,197,24,0.8)]" />
               <h3 className="text-sm font-bold text-white tracking-tight">
                 {stage || "Synchronizing Resources..."}
               </h3>
            </div>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-1.5 bg-zinc-900 hover:bg-red-500/10 border border-white/5 hover:border-red-500/30 text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-red-400 rounded-full transition-all active:scale-95"
            >
              Terminate
            </button>
          )}
        </div>

        {/* Progress */}
        <div className="mb-8 relative z-10">
          <div className="flex justify-between items-end mb-3">
            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
              Processing <span className="text-zinc-400">{current}</span> / <span className="text-zinc-400">{total}</span>
            </span>
            <span className="text-xs font-black text-yellow-400 font-mono tracking-tighter">
              {percentage.toFixed(1)}%
            </span>
          </div>
          <div className="w-full h-2 bg-black/50 border border-white/5 rounded-full overflow-hidden shadow-inner ring-1 ring-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-blue-500 transition-all duration-300 shadow-[0_0_15px_rgba(245,197,24,0.4)]"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Memory */}
        {showMemory && memoryUsage && (
          <div className="mb-8 p-4 bg-zinc-900/40 border border-white/5 rounded-2xl relative z-10">
            <div className={`flex justify-between items-center mb-3 ${memWarn ? "text-amber-400" : "text-zinc-500"}`}>
              <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Memory Allocation</span>
              <span className="text-[10px] font-mono opacity-80">{formatBytes(memoryUsage.processMemory || 0)} / {formatBytes(memoryUsage.totalMemory || 0)}</span>
            </div>
            <div className="w-full h-1 bg-black rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${memWarn ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]" : "bg-blue-500/40"}`}
                style={{ width: `${memPct}%` }}
              />
            </div>
            {memWarn && (
              <p className="mt-3 text-[9px] text-amber-500/80 font-bold uppercase tracking-widest text-center animate-pulse">
                Critical Pressure Detected
              </p>
            )}
          </div>
        )}

        {/* Footer Info */}
        <div className="pt-6 border-t border-white/5 grid grid-cols-2 gap-4 opacity-40 relative z-10">
           <div className="flex gap-2">
              <span className="text-[10px]">💡</span>
              <p className="text-[9px] font-medium text-zinc-400 leading-normal">Optimizing cache buffers for integrity</p>
           </div>
           <div className="flex gap-2">
              <span className="text-[10px]">🔄</span>
              <p className="text-[9px] font-medium text-zinc-400 leading-normal">Managed garbage collection active</p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingProgress;
