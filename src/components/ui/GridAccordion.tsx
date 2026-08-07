import React, { useState } from "react";
import { cn } from "../../lib/utils";

export interface GridAccordionProps {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onToggle?: (open: boolean) => void;
  className?: string;
  headerClassName?: string;
  panelClassName?: string;
  /** Custom SVG chevron or icon component. Defaults to the 16x16 vector path. */
  chevron?: React.ReactNode;
}

export function GridAccordion({
  title,
  children,
  defaultOpen = false,
  isOpen: controlledIsOpen,
  onToggle,
  className,
  headerClassName,
  panelClassName,
  chevron,
}: GridAccordionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledIsOpen !== undefined;
  const open = isControlled ? controlledIsOpen : internalOpen;

  const handleToggle = () => {
    const next = !open;
    if (!isControlled) {
      setInternalOpen(next);
    }
    onToggle?.(next);
  };

  const defaultChevronIcon = (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <path d="M4 6.5L8 10.5L12 6.5" />
    </svg>
  );

  return (
    <div
      className={cn(
        "t-acc border border-border/60 rounded-xl overflow-hidden bg-card/40",
        className
      )}
      data-open={open ? "true" : "false"}
      data-state={open ? "open" : "closed"}
    >
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        className={cn(
          "t-acc-head flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-foreground hover:bg-white/5 transition-colors cursor-pointer select-none",
          headerClassName
        )}
      >
        <span className="flex-1 text-left">{title}</span>
        <span className="t-acc-chevron text-muted-foreground ml-2 shrink-0">
          {chevron || defaultChevronIcon}
        </span>
      </button>
      <div className="t-acc-panel">
        <div
          className={cn(
            "t-acc-panel-inner px-4 pb-4 pt-1 text-sm text-muted-foreground",
            panelClassName
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
