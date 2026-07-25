import { useEffect, useMemo, useRef } from "react";
import { emitter } from "./WodniackRuntime";
import "./WodniackSeparator.css";

/**
 * The `<a-separator>` element from AntoineW/AW-2025-Portfolio
 * `src/components/ASeparator.astro`: the given strings are encoded to binary,
 * every bit is a two-state glyph, and while the strip is on screen each bit has
 * a 10% chance per tick of flipping — a quietly restless divider.
 */

type WodniackSeparatorProps = {
  className?: string;
  variant?: "primary" | "secondary";
  strings?: string[];
};

function toBinary(value: string) {
  return value
    .split("")
    .map((char) => char.charCodeAt(0).toString(2))
    .join(" ");
}

export function WodniackSeparator({
  className,
  variant = "primary",
  strings = ["Do", "Things", "Your", "Way"],
}: WodniackSeparatorProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const binaries = useMemo(() => strings.map(toBinary), [strings]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const chars = root.querySelectorAll<HTMLElement>(".wdk-sep__char");

    const tick = () => {
      chars.forEach((char) => {
        if (char.classList.contains("wdk-sep__char--blank") || Math.random() > 0.1) return;

        char.classList.remove("wdk-sep__char--0");
        char.classList.remove("wdk-sep__char--1");
        char.classList.add(`wdk-sep__char--${Math.random() > 0.5 ? "0" : "1"}`);
      });
    };

    const onIntersect = (event: Event) => {
      const detail = (event as CustomEvent<{ isIntersecting: boolean }>).detail;

      if (detail.isIntersecting) emitter.on("tick", tick);
      else emitter.off("tick", tick);
    };

    root.addEventListener("intersect", onIntersect);

    if (root.getBoundingClientRect().top < window.innerHeight) emitter.on("tick", tick);

    return () => {
      root.removeEventListener("intersect", onIntersect);
      emitter.off("tick", tick);
    };
  }, [binaries]);

  return (
    <div
      className={`wdk-sep wdk-sep--${variant}${className ? ` ${className}` : ""}`}
      ref={rootRef}
      data-intersect
      aria-hidden
    >
      <span className="wdk-sep__triangle" />

      <span className="wdk-sep__binaries">
        {binaries.map((binary, binaryIndex) => (
          <span className="wdk-sep__group" key={`${binary}-${binaryIndex}`}>
            <span className="wdk-sep__code">
              {binary.split("").map((char, charIndex) => (
                <span
                  className={`wdk-sep__char wdk-sep__char--${char === " " ? "blank" : char}`}
                  key={charIndex}
                >
                  {char}
                </span>
              ))}
            </span>
            <span className="wdk-sep__stripes" />
          </span>
        ))}
      </span>

      <span className="wdk-sep__triangle" />
    </div>
  );
}
