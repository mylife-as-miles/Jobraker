"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

type Option = { value: string; label: string };

type SortDropdownProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export default function SortDropdown({ value, onChange, className }: SortDropdownProps) {
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
    <div className={`relative inline-block text-sm ${className || "w-[180px]"}`} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={toggleOpen}
        className={[
          "inline-flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm",
          "bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] text-foreground",
          "border-[#1dff00]/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-sm",
          "transition-all duration-200 hover:border-[#1dff00]/35 hover:bg-[#111722]",
          isOpen ? "border-[#1dff00]/40 ring-1 ring-[#1dff00]/20" : "",
        ].join(" ")}
      >
        <span className="truncate font-medium">{selectedOption.label}</span>
        <ChevronDown
          className={`ml-2 h-4 w-4 text-foreground/65 transition-transform duration-200 ${isOpen ? "rotate-180 text-[#d8ffe2]" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full z-50 mt-2 w-full min-w-[180px] overflow-hidden rounded-2xl border border-[#1dff00]/18 bg-[#0d131c]/96 shadow-[0_18px_48px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div
            role="listbox"
            aria-label="Sort options"
            className="p-2"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt)}
                className={[
                  "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors duration-150",
                  value === opt.value
                    ? "bg-[#1dff00]/10 text-[#d8ffe2]"
                    : "text-foreground/72 hover:bg-white/[0.04] hover:text-foreground",
                ].join(" ")}
              >
                <span className="truncate font-medium">{opt.label}</span>
                {value === opt.value && (
                  <Check className="h-4 w-4 text-[#1dff00]" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
