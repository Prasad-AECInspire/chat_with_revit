import React, { useEffect } from "react";

const Notification = ({ id, message, type, duration, onClose }) => {
  useEffect(() => {
    if (duration !== Infinity) {
      const timer = setTimeout(() => { 
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case "success": return "✦";
      case "error": return "✕";
      case "warning": return "⟁";
      default: return "ℹ";
    }
  };

  const statusConfig = {
    success: { border: "border-emerald-500/50", text: "text-emerald-400", bg: "bg-emerald-500/5", iconBg: "bg-emerald-500/20" },
    error: { border: "border-red-500/50", text: "text-red-400", bg: "bg-red-500/5", iconBg: "bg-red-500/20" },
    warning: { border: "border-amber-500/50", text: "text-amber-400", bg: "bg-amber-500/5", iconBg: "bg-amber-500/20" },
    info: { border: "border-yellow-400/50", text: "text-yellow-300", bg: "bg-yellow-400/5", iconBg: "bg-yellow-400/20" }
  };

  const config = statusConfig[type] || statusConfig.info;

  return (
    <div
      onClick={onClose}
      className={`group flex items-center justify-between gap-4 px-6 py-4 bg-zinc-950/80 backdrop-blur-xl border ${config.border} rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.3)] cursor-pointer min-w-[320px] max-w-md animate-in slide-in-from-right-4 fade-in duration-300 relative overflow-hidden`}
    >
      <div className={`absolute inset-0 ${config.bg} opacity-20`} />
      
      <div className="flex items-center gap-4 flex-1 relative z-10">
        <div className={`w-8 h-8 rounded-lg ${config.iconBg} flex items-center justify-center ${config.text} text-sm font-black`}>
          {getIcon()}
        </div>
        <span className="text-xs font-bold text-zinc-100 leading-snug tracking-tight">{message}</span>
      </div>
      
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="text-zinc-500 hover:text-white text-xs font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-all relative z-10"
      >
        Dismiss
      </button>
    </div>
  );
};

export default Notification;
