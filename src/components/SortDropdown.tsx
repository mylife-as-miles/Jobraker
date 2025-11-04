"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

type Option = { value: string; label: string };

type SortDropdownProps = {
  value: string;
  onChange: (value: string) => void;
};

export default function SortDropdown({ value, onChange }: SortDropdownProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const options: Option[] = [
    { value: "score", label: "Best match" },
    { value: "recent", label: "Most recent" },
    { value: "company", label: "Company" },
    { value: "status", label: "Status" },
  ];

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  const toggleOpen = () => {
    setIsOpen((prev) => !prev);
  };

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

  const handleSelect = (opt: Option) => {
    onChange(opt.value);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-sm" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={toggleOpen}
        className="inline-flex items-center justify-between w-[180px] px-3 py-2 rounded-md bg-neutral-900 text-white border border-neutral-700 hover:bg-neutral-800 transition-colors"
      >
        <span className="truncate">{selectedOption.label}</span>
        <ChevronDown
          className={`ml-2 h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 bottom-full mb-1 w-[180px] bg-neutral-900 border border-neutral-700 rounded-md shadow-lg">
          <div role="listbox" aria-label="Sort options" className="p-1">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt)}
                className="w-full flex items-center justify-between px-3 py-2 rounded text-left text-sm text-white bg-neutral-900 hover:bg-neutral-800"
              >
                <span className="truncate">{opt.label}</span>
                {value === opt.value && <Check className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
