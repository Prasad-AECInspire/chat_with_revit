import React, { useState, useRef, useEffect } from "react";

const SearchableDropdown = ({ options, value, onChange, placeholder = "Search..." }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredOptions = options.filter((o) =>
        o.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelect = (option) => {
        onChange(option);
        setIsOpen(false);
        setSearchTerm("");
    };

    return (
        <div className="relative w-full group/dropdown" ref={dropdownRef}>
            <div
                className="relative flex items-center cursor-pointer"
                onClick={() => setIsOpen(!isOpen)}
            >
                <input
                    type="text"
                    value={isOpen ? searchTerm : value}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={placeholder}
                    readOnly={!isOpen}
                    className="w-full bg-zinc-900/50 hover:bg-zinc-900 border border-white/5 rounded-xl px-4 pr-10 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 transition-all cursor-pointer shadow-inner"
                />
                <div className="absolute right-3.5 pointer-events-none transition-transform duration-300">
                    <svg className={`w-3 h-3 text-zinc-500 transition-transform ${isOpen ? "rotate-180 text-yellow-400" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>

            {isOpen && (
                <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-[100] bg-zinc-950/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-h-64 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-200">
                    {filteredOptions.length > 0 ? (
                        <div className="p-1.5 space-y-1">
                            {filteredOptions.map((option, index) => (
                                <div
                                    key={index}
                                    onClick={() => handleSelect(option)}
                                    className={`px-3 py-2 rounded-xl text-[11px] font-bold cursor-pointer transition-all flex items-center justify-between group/item ${
                                        option === value
                                            ? "bg-yellow-400 text-black shadow-lg shadow-yellow-400/20"
                                            : "text-zinc-400 hover:bg-white/[0.05] hover:text-white"
                                    }`}
                                >
                                    <span>{option}</span>
                                    {option === value && (
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="px-4 py-8 text-center">
                            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">No matching labels</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchableDropdown;
