import React, { useState, useEffect, useRef } from "react";

const ContextMenu = ({ x, y, visible, onClose, options, annotation }) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) onClose();
    };
    if (visible) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("contextmenu", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("contextmenu", handleClickOutside);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div
      ref={menuRef}
      style={{ left: x, top: y }}
      className="fixed z-[9999] min-w-[200px] bg-zinc-950/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
    >
      <div className="py-2">
        {options.map((option, index) => (
          <div
            key={index}
            onClick={() => {
              if (!option.disabled) {
                option.action(annotation);
                onClose();
              }
            }}
            className={`flex items-center gap-3 px-4 py-2.5 text-[11px] font-bold transition-all duration-200
              ${
                option.disabled
                  ? "text-zinc-600 cursor-not-allowed opacity-50"
                  : "text-zinc-400 hover:bg-cyan-500/10 hover:text-cyan-400 cursor-pointer active:bg-cyan-500/20"
              }`}
          >
            {option.icon && (
               <span className="text-sm opacity-80 group-hover:opacity-100">{option.icon}</span>
            )}
            <span className="uppercase tracking-widest">{option.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ContextMenu;
