"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

type Option = { value: string; label: string };

export default function SortDropdown() {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<string>("Best match");
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  const options: Option[] = [
    { value: "score", label: "Best match" },
    { value: "recent", label: "Most recent" },
    { value: "company", label: "Company" },
    { value: "status", label: "Status" },
  ];

  const updateCoords = () => {
    const btn = triggerRef.current;
    if (!btn) return setCoords(null);
    const rect = btn.getBoundingClientRect();
    setCoords({
      top: rect.bottom + 6 + window.scrollY, // added spacing below button
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  };

  const toggleOpen = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) requestAnimationFrame(updateCoords);
      return next;
    });
  };

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  // Recalculate position when open
  useEffect(() => {
    if (!isOpen) return;
    const handleReposition = () => updateCoords();
    window.addEventListener("scroll", handleReposition, { passive: true });
    window.addEventListener("resize", handleReposition);
    return () => {
      window.removeEventListener("scroll", handleReposition);
      window.removeEventListener("resize", handleReposition);
    };
  }, [isOpen]);

  const handleSelect = (opt: Option) => {
    setSelected(opt.label);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-sm" ref={rootRef}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={toggleOpen}
        className="inline-flex items-center justify-between w-[180px] px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-800 hover:bg-gray-50 transition"
      >
        <span className="truncate">{selected}</span>
        <ChevronDown
          className={`ml-2 h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && coords && (
        <div
          style={{
            position: "absolute",
            top: "100%", // directly below the button
            left: 0,
            marginTop: "6px",
            width: coords.width,
          }}
          className="z-[9999] mt-1"
        >
          <div className="bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden max-h-[180px] overflow-y-auto">
            <div role="listbox" aria-label="Sort options" className="p-1">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm rounded transition ${
                    selected === opt.label
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {selected === opt.label && <Check className="h-4 w-4 text-gray-700" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
