import React, { useRef, useState, useEffect, useCallback } from "react";
import { cn } from "../../lib/utils";

export interface SkeletonRevealProps {
  skeleton: React.ReactNode;
  children: React.ReactNode;
  loading?: boolean;
  className?: string;
  onRevealed?: () => void;
  showReplayButton?: boolean;
}

function readMs(name: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function SkeletonReveal({
  skeleton,
  children,
  loading = false,
  className,
  onRevealed,
  showReplayButton = false,
}: SkeletonRevealProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const skelRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const [revealed, setRevealed] = useState(!loading);

  const replay = useCallback(() => {
    const wrap = wrapRef.current;
    const skel = skelRef.current;
    if (!wrap || !skel) return;

    if (timerRef.current) window.clearTimeout(timerRef.current);

    // Snap-back: kill transitions for one frame so reverse (revealed -> skeleton) is instant
    wrap.classList.add("is-resetting");
    setRevealed(false);
    skel.classList.remove("is-pulsing");

    // Force reflow
    void skel.offsetWidth;

    wrap.classList.remove("is-resetting");
    skel.classList.add("is-pulsing");

    const dur = readMs("--pulse-dur", 1000);
    const count =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--pulse-count")
      ) || 1;

    timerRef.current = window.setTimeout(() => {
      setRevealed(true);
      onRevealed?.();
      timerRef.current = null;
    }, dur * count);
  }, [onRevealed]);

  useEffect(() => {
    if (!loading && !revealed) {
      setRevealed(true);
      onRevealed?.();
    }
  }, [loading, revealed, onRevealed]);

  return (
    <div className={cn("inline-flex flex-col gap-2", className)}>
      {showReplayButton && (
        <button
          type="button"
          onClick={replay}
          className="self-start text-xs font-semibold px-2.5 py-1 rounded-md bg-brand/10 hover:bg-brand/20 text-brand border border-brand/20 transition-all cursor-pointer"
        >
          Replay Reveal
        </button>
      )}
      <div
        ref={wrapRef}
        className={cn("t-skel w-full h-full", revealed && "is-revealed")}
      >
        <div ref={skelRef} className="t-skel-skeleton is-pulsing" aria-hidden={revealed}>
          {skeleton}
        </div>
        <div className="t-skel-content">{children}</div>
      </div>
    </div>
  );
}
