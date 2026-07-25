import { useEffect, useMemo, useRef } from "react";
import { gsap } from "gsap";
import { WodniackWaveField } from "./WodniackWaveField";
import { WodniackSeparator } from "./WodniackSeparator";
import { emitter } from "./WodniackRuntime";
import "./WodniackHero.css";

/**
 * `SHero` from AntoineW/AW-2025-Portfolio `src/components/SHero.astro`.
 *
 * Each title character is a clipped window over a triple copy of its own glyph
 * (one row, one column). Sliding the inner span a full 100% in any direction
 * lands on an identical glyph, so a character can "fall" in a random direction
 * and arrive looking untouched — that's the whole kinetic trick. Roughly 1% of
 * ticks pick a random char and a random direction.
 *
 * The intro reveals the wave lines, sweeps a black border up behind the
 * content, wipes the content block open, and drops the chars into place.
 */

const DIRECTIONS = ["bottom", "left", "top", "right"] as const;

type WodniackHeroProps = {
  /** Two words, e.g. ["Product", "Designer"]. */
  words: [string, string];
  /** Chunked name for the upper separator. */
  nameChunks: string[];
  /** Lower separator strings. */
  footChunks: string[];
};

function Word({ value }: { value: string }) {
  const chars = useMemo(() => Array.from(value), [value]);

  return (
    <span className="wdk-hero__word">
      {chars.map((char, index) => (
        <span className={`wdk-hero__char wdk-hero__char--${char.toLowerCase()}`} key={index}>
          <span className="wdk-hero__char-inner" data-letter={char.toUpperCase()}>
            {char}
          </span>
        </span>
      ))}
    </span>
  );
}

export function WodniackHero({ words, nameChunks, footChunks }: WodniackHeroProps) {
  const rootRef = useRef<HTMLElement | null>(null);

  /*
   * The reference hard-codes 15vw because "Creative Developer" fits at that
   * size in Bigger Display. Job titles here are arbitrary and the display font
   * is a fallback stack, so shrink until the line fits — but only while the two
   * words share a row, since below the tablet breakpoint the design wraps them
   * on purpose.
   */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const title = root.querySelector<HTMLElement>(".wdk-hero__title");
    if (!title) return;

    const fit = () => {
      title.style.fontSize = "";

      const wordEls = Array.from(root.querySelectorAll<HTMLElement>(".wdk-hero__word"));
      const wraps = wordEls.length > 1 && wordEls[0].offsetTop !== wordEls[1].offsetTop;
      if (wraps) return;

      if (title.scrollWidth <= title.clientWidth) return;

      // The star keeps a fixed px width and margin, so it does not scale with
      // the type. Solve for the ratio on the part that does, rather than
      // iterating a whole-line ratio that converges asymptotically.
      const star = root.querySelector<HTMLElement>(".wdk-hero__star");
      const starStyle = star ? getComputedStyle(star) : null;
      const fixed = star
        ? star.getBoundingClientRect().width +
          parseFloat(starStyle!.marginLeft) +
          parseFloat(starStyle!.marginRight)
        : 0;

      const scalable = title.scrollWidth - fixed;
      if (scalable <= 0) return;

      // Advance widths do not scale perfectly linearly (hinting, subpixel
      // rounding), so iterate the fixed-width-aware ratio to convergence.
      for (let pass = 0; pass < 12 && title.scrollWidth > title.clientWidth; pass++) {
        const current = parseFloat(getComputedStyle(title).fontSize);
        const ratio = (title.clientWidth - fixed) / (title.scrollWidth - fixed);
        const next = Math.max(16, current * ratio - 0.5);

        if (Math.abs(next - current) < 0.25) break;
        title.style.fontSize = `${next}px`;
      }
    };

    fit();
    emitter.on("resize", fit);
    document.fonts?.ready.then(fit).catch(() => {});

    return () => emitter.off("resize", fit);
  }, [words]);

  /* Random character drops, gated on the section being on screen. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const chars = Array.from(root.querySelectorAll<HTMLElement>(".wdk-hero__char"));
    let isWaiting = true;
    const timers = new Set<number>();

    const animateChar = () => {
      if (isWaiting || Math.random() > 0.01) return;

      const char = chars[Math.floor(Math.random() * chars.length)];
      if (!char) return;

      if (DIRECTIONS.some((direction) => char.classList.contains(`to-${direction}`))) return;

      const className = `to-${DIRECTIONS[Math.floor(Math.random() * 4)]}`;
      char.classList.add(className);

      const timer = window.setTimeout(() => {
        char.classList.remove(className);
        timers.delete(timer);
      }, 2000);
      timers.add(timer);
    };

    const onIntersect = (event: Event) => {
      const detail = (event as CustomEvent<{ isIntersecting: boolean }>).detail;

      if (detail.isIntersecting) emitter.on("tick", animateChar);
      else emitter.off("tick", animateChar);
    };

    const release = () => { isWaiting = false; };

    root.addEventListener("intersect", onIntersect);
    document.addEventListener("wdk:intro", release);
    emitter.on("tick", animateChar);

    return () => {
      root.removeEventListener("intersect", onIntersect);
      document.removeEventListener("wdk:intro", release);
      emitter.off("tick", animateChar);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  /* Intro — offsets, durations and eases as in the source timeline. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(root, { opacity: 1 });
      return;
    }

    let tl: gsap.core.Timeline | null = null;

    const play = () => {
      if (tl) return;

      const waves = root.querySelector(".wdk-hero__waves");
      const content = root.querySelector<HTMLElement>(".wdk-hero__content");
      const border = root.querySelector(".wdk-hero__border");
      const chars = root.querySelectorAll(".wdk-hero__char-inner");
      const separators = root.querySelectorAll(".wdk-hero__separator");
      const star = root.querySelector(".wdk-hero__star");
      if (!content) return;

      tl = gsap.timeline();

      tl.set(root, { opacity: 1 }, 0);

      tl.to(border, { scaleY: 0.025, y: -content.clientHeight, duration: 1, ease: "expo.inOut" }, 0);
      tl.fromTo(waves, { y: "100%" }, { y: "0%", duration: 1.35, ease: "expo.out" }, 0);

      tl.fromTo(
        content,
        { clipPath: "polygon(0 0, 100% 0, 100% 0, 0 0)" },
        { clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)", duration: 1, ease: "expo.inOut" },
        1,
      );

      tl.to(border, { scaleY: 1, y: 0, duration: 1, ease: "expo.inOut" }, 1);

      if (star) tl.fromTo(star, { rotate: 90 }, { rotate: 0, duration: 2, ease: "expo.out" }, 1.5);

      tl.fromTo(
        chars,
        { y: "-200%" },
        { y: "-100%", duration: 2, ease: "expo.inOut", stagger: 0.02 },
        0.45,
      );

      tl.fromTo(
        separators,
        { y: (index: number) => (index % 2 === 0 ? "-100%" : "100%") },
        { y: "0%", duration: 1.5, ease: "expo.inOut" },
        0.75,
      );
    };

    document.addEventListener("wdk:intro", play, { once: true });
    if (document.documentElement.dataset.wdkIntroDone === "true") play();

    return () => {
      document.removeEventListener("wdk:intro", play);
      tl?.kill();
    };
  }, []);

  return (
    <section id="top" className="wdk-hero" ref={rootRef} data-intersect>
      <WodniackWaveField className="wdk-hero__waves" />

      <div className="wdk-hero__content">
        <WodniackSeparator className="wdk-hero__separator" strings={nameChunks} />

        <h1 className="wdk-hero__title">
          <Word value={words[0]} />

          <svg
            className="wdk-hero__star"
            viewBox="0 0 48 48"
            width="48"
            height="48"
            aria-hidden
            focusable="false"
          >
            <path
              d="M24 0c1.2 12.1 11.9 22.8 24 24-12.1 1.2-22.8 11.9-24 24-1.2-12.1-11.9-22.8-24-24C12.1 22.8 22.8 12.1 24 0Z"
              fill="currentColor"
            />
          </svg>

          <Word value={words[1]} />
        </h1>

        <WodniackSeparator className="wdk-hero__separator" strings={footChunks} />
      </div>

      <div className="wdk-hero__border" />
    </section>
  );
}
