import React from "react";

const DestinationInput = ({ path, setPath, filename, setFilename }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
      {/* Destination Path */}
      <div className="md:col-span-3 space-y-2">
        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Storage Destination</label>
        <div className="relative group">
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="e.g. C:\Datasets\ProjectX\Exports"
            className="w-full bg-zinc-900/50 border border-white/5 hover:border-white/10 rounded-2xl px-5 py-4 pr-12 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all shadow-inner"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 group-hover:text-cyan-500 transition-colors">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
        </div>
        <p className="text-[10px] text-zinc-600 px-1 font-medium leading-relaxed italic">
          Path to local storage folder. Ensure directory permissions are set.
        </p>
      </div>
 
      {/* Filename */}
      <div className="md:col-span-1 space-y-2">
        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Label / ID</label>
        <div className="relative group">
          <input
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder="img_export"
            className="w-full bg-zinc-900/50 border border-white/5 hover:border-white/10 rounded-2xl px-5 py-4 pr-12 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all shadow-inner text-center font-mono"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 group-hover:text-cyan-500 transition-colors">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
        </div>
        <p className="text-[10px] text-zinc-600 px-1 font-medium leading-relaxed italic text-center">Batch sequential ID appended automatically.</p>
      </div>
    </div>
  );
};

export default DestinationInput;
