import React, { useRef, useState, useCallback, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

export interface DissolveClearInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  containerClassName?: string;
  inputClassName?: string;
  onClear?: () => void;
  /** Brand color glow for dark mode dissolve streak (defaults to green #2fd968) */
  glowColor?: string;
}

export const DissolveClearInput = React.forwardRef<HTMLInputElement, DissolveClearInputProps>(
  (
    {
      value,
      onChange,
      placeholder = "",
      containerClassName,
      inputClassName,
      onClear,
      glowColor = "rgba(47, 217, 104, 0.85)",
      disabled,
      ...props
    },
    forwardedRef
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mirrorRef = useRef<HTMLDivElement>(null);
    const placeholderRef = useRef<HTMLDivElement>(null);
    const glowRef = useRef<HTMLDivElement>(null);
    const innerInputRef = useRef<HTMLInputElement>(null);

    const [isClearing, setIsClearing] = useState(false);
    const animationFrameRef = useRef<number | null>(null);

    const hasValue = Boolean(value && value.length > 0);

    const handleClear = useCallback(() => {
      if (!hasValue || isClearing) return;

      setIsClearing(true);

      const container = containerRef.current;
      const mirror = mirrorRef.current;
      const placeholderEl = placeholderRef.current;
      const glow = glowRef.current;

      if (!container || !mirror || !glow) {
        onChange("");
        onClear?.();
        setIsClearing(false);
        return;
      }

      // Read computed properties from CSS custom properties or fallback
      const rootStyle = getComputedStyle(document.documentElement);
      const readVar = (name: string, fallback: number) => {
        const val = parseFloat(rootStyle.getPropertyValue(name));
        return Number.isFinite(val) ? val : fallback;
      };

      const duration = readVar("--clear-dur", 1000);
      const outFly = readVar("--clear-out-fly", 12);
      const inFly = readVar("--clear-in-fly", 12);
      const blurAmount = readVar("--clear-blur", 2);
      const glowOpacityMax = readVar("--glow-opacity", 0.85);

      // Measure words inside mirror
      const words = value.split(/\s+/).filter(Boolean);
      const wordCount = Math.max(1, words.length);

      const startTime = performance.now();

      const cubicEaseOut = (t: number) => 1 - Math.pow(1 - t, 3);

      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        const ease = cubicEaseOut(progress);

        // 1. Outgoing text (mirror) floats upward, fades out, and blurs
        const translateYMirror = -outFly * ease;
        const opacityMirror = Math.max(0, 1 - ease * 1.2);
        const blurVal = blurAmount * ease;

        mirror.style.transform = `translateY(${translateYMirror}px)`;
        mirror.style.opacity = `${opacityMirror}`;
        mirror.style.filter = `blur(${blurVal}px)`;

        // 2. Incoming placeholder floats into position from below
        if (placeholderEl) {
          const translateYPlaceholder = inFly * (1 - ease);
          const opacityPlaceholder = ease;
          placeholderEl.style.transform = `translateY(${translateYPlaceholder}px)`;
          placeholderEl.style.opacity = `${opacityPlaceholder}`;
        }

        // 3. Glow streak layers per word
        const glowPeakAt = 0.15;
        let glowOpacity = 0;
        if (progress <= glowPeakAt) {
          glowOpacity = (progress / glowPeakAt) * glowOpacityMax;
        } else {
          glowOpacity = Math.max(0, (1 - (progress - glowPeakAt) / (1 - glowPeakAt)) * glowOpacityMax);
        }

        glow.style.opacity = `${glowOpacity}`;

        // Build radial gradient streak stack
        const gradientLayers: string[] = [];
        const radius = 25 + progress * 45;
        for (let i = 0; i < wordCount; i++) {
          const posX = ((i + 0.5) / wordCount) * 100;
          const posY = 50 - ease * 25;
          gradientLayers.push(
            `radial-gradient(ellipse ${radius}% 85% at ${posX}% ${posY}%, ${glowColor} 0%, transparent 75%)`
          );
        }
        glow.style.background = gradientLayers.join(", ");

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          // Animation finished: reset inline styles and update value
          mirror.style.transform = "";
          mirror.style.opacity = "";
          mirror.style.filter = "";

          if (placeholderEl) {
            placeholderEl.style.transform = "";
            placeholderEl.style.opacity = "";
          }

          glow.style.opacity = "0";
          glow.style.background = "";

          onChange("");
          onClear?.();
          setIsClearing(false);
        }
      };

      animationFrameRef.current = requestAnimationFrame(animate);
    }, [hasValue, isClearing, value, onChange, onClear, glowColor]);

    useEffect(() => {
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }, []);

    return (
      <div
        ref={containerRef}
        className={cn(
          "t-clear group relative flex items-center w-full rounded-xl border border-input bg-card/60 px-4 py-2.5 transition-colors focus-within:border-brand",
          hasValue && "has-value",
          isClearing && "is-clearing",
          containerClassName
        )}
      >
        {/* Real Input */}
        <input
          ref={(node) => {
            (innerInputRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
            if (typeof forwardedRef === "function") forwardedRef(node);
            else if (forwardedRef)
              (forwardedRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
          }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            "w-full bg-transparent text-foreground placeholder:text-transparent outline-none z-10 font-medium text-sm sm:text-base",
            inputClassName
          )}
          {...props}
        />

        {/* Visual Mirror for Value */}
        <div
          ref={mirrorRef}
          className="t-clear-mirror px-4 text-foreground font-medium text-sm sm:text-base"
          aria-hidden="true"
        >
          {value}
        </div>

        {/* Fake Placeholder */}
        <div
          ref={placeholderRef}
          className="t-clear-placeholder px-4 text-foreground/50 font-medium text-sm sm:text-base"
          aria-hidden="true"
        >
          {placeholder}
        </div>

        {/* Glow Streak Layer */}
        <div ref={glowRef} className="t-clear-glow" aria-hidden="true" />

        {/* Clear Button */}
        {hasValue && (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled || isClearing}
            aria-label="Clear input"
            className="z-20 p-1.5 rounded-full hover:bg-white/10 text-foreground/60 hover:text-foreground transition-all active:scale-95 cursor-pointer ml-1 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }
);

DissolveClearInput.displayName = "DissolveClearInput";
