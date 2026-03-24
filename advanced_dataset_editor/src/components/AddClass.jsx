import React from "react";

const AddClass = ({ setNewClassName, addNewClass, newClassName }) => {
  return (
    <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-cyan-400">➕</span>
        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Add Label</h4>
      </div>
      <div className="flex flex-col gap-3">
        <input
          type="text"
          value={newClassName}
          onChange={(e) => setNewClassName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addNewClass()}
          placeholder="New label name..."
          className="bg-zinc-900 border border-white/10 focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/10 rounded-xl px-4 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-all w-full shadow-inner"
        />
        <button
          onClick={addNewClass}
          className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 border border-transparent text-black rounded-xl text-xs font-bold transition-all cursor-pointer shadow-[0_0_20px_rgba(6,182,212,0.2)] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
          disabled={!newClassName.trim()}
        >
          Register Class
        </button>
      </div>
    </div>
  );
};

export default AddClass;
