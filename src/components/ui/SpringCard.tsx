import React, { useState } from "react";
import { cn } from "@/lib/utils";

export interface SpringCardProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  collapsedHeight?: number | string;
  expandedHeight?: number | string;
  title?: React.ReactNode;
  secondaryText?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * SpringCard: Card that expands and collapses its height when clicked.
 * Animates height with a spring-like cubic-bezier(0.34, 1.56, 0.64, 1) over 0.5s.
 * Secondary text fades in with a small delay once expanded.
 */
export function SpringCard({
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  collapsedHeight = 64,
  expandedHeight = 120,
  title,
  secondaryText,
  children,
  className,
  style,
  onClick,
  ...props
}: SpringCardProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const handleToggle = (e: React.MouseEvent<HTMLDivElement>) => {
    const next = !isOpen;
    if (!isControlled) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
    onClick?.(e);
  };

  const cHeight = typeof collapsedHeight === "number" ? `${collapsedHeight}px` : collapsedHeight;
  const eHeight = typeof expandedHeight === "number" ? `${expandedHeight}px` : expandedHeight;

  return (
    <div
      onClick={handleToggle}
      aria-expanded={isOpen}
      data-state={isOpen ? "open" : "closed"}
      className={cn(
        "card spring-card cursor-pointer rounded-2xl border border-border/50 bg-card p-4 shadow-sm select-none transition-all hover:border-brand/40",
        isOpen && "expanded",
        className
      )}
      style={{
        height: isOpen ? eHeight : cHeight,
        overflow: "hidden",
        transition:
          "height 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.3s ease, background-color 0.3s ease, box-shadow 0.3s ease",
        ...style,
      }}
      {...props}
    >
      {title && (
        <div className="font-semibold text-foreground flex items-center justify-between">
          <span>{title}</span>
        </div>
      )}
      {secondaryText && (
        <div
          className="spring-secondary-text text-sm text-muted-foreground mt-2 leading-relaxed"
          style={{
            opacity: isOpen ? 1 : 0,
            transition: "opacity 0.35s ease 0.15s",
          }}
        >
          {secondaryText}
        </div>
      )}
      {children && (
        <div
          className="spring-secondary-text"
          style={{
            opacity: isOpen ? 1 : 0,
            transition: "opacity 0.35s ease 0.15s",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default SpringCard;
