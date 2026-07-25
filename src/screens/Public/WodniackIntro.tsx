import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { emitter, prefersReducedMotion, ticker } from "./WodniackRuntime";
import "./WodniackIntro.css";

/**
 * Intro curtain ported from the `.site-intro` timeline in
 * AntoineW/AW-2025-Portfolio `src/pages/index.astro`: five vertical strokes
 * wipe up, three horizontal joints snap across, the strokes collapse, and the
 * page frame draws itself over three seconds while the curtain goes
 * transparent. The `intro` event it dispatches at -=1.85 is what starts the
 * header and hero reveals.
 */

const V_LINES = [1, 2, 3, 4, 5];
const H_LINES = [1, 2, 3];

type WodniackIntroProps = {
  /** Called once the curtain is gone and scrolling should be released. */
  onDone: () => void;
};

export function WodniackIntro({ onDone }: WodniackIntroProps) {
  const introRef = useRef<HTMLDivElement | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const intro = introRef.current;
    if (!intro) return;

    const finish = () => {
      document.documentElement.classList.remove("wdk-scroll-blocked");
      doneRef.current();
      ticker.nextTick(() => emitter.emit("updateViewport"));
    };

    const announce = () => {
      document.documentElement.dataset.wdkIntroDone = "true";
      document.dispatchEvent(new CustomEvent("wdk:intro"));
    };

    if (prefersReducedMotion()) {
      announce();
      finish();
      return;
    }

    document.documentElement.classList.add("wdk-scroll-blocked");

    const linesV = intro.querySelectorAll(".wdk-intro-path--v");
    const linesH = intro.querySelectorAll(".wdk-intro-path--h");
    const borderTop = intro.querySelector(".wdk-intro-border--top");
    const borderLeft = intro.querySelector(".wdk-intro-border--left");
    const borderRight = intro.querySelector(".wdk-intro-border--right");

    const tl = gsap.timeline();

    tl.set(intro, { background: "transparent" });

    tl.fromTo(linesV, { scaleY: 0 }, { scaleY: 1, duration: 1, ease: "power4.inOut", stagger: 0.15 }, 0);
    tl.fromTo(linesH, { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: "power4.inOut", stagger: 0 }, 1);

    tl.set(linesV, { transformOrigin: "50% 0" });

    tl.fromTo(
      linesV,
      { scaleY: 1 },
      { scaleY: 0, duration: 1, ease: "power4.in", immediateRender: false, stagger: 0.1 },
      2,
    );
    tl.fromTo(
      linesH,
      { scaleY: 1 },
      { scaleY: 0, duration: 0.5, ease: "power4.in", immediateRender: false, stagger: 0.1 },
      2.1,
    );

    tl.fromTo(borderTop, { scaleY: 0 }, { scaleY: 1, duration: 3, ease: "power3.inOut" }, 1);
    tl.fromTo(
      [borderLeft, borderRight],
      { scaleX: 0 },
      { scaleX: 1, duration: 3, ease: "power3.inOut" },
      1,
    );

    tl.call(announce, undefined, "-=1.85");
    tl.call(finish, undefined, 5);

    return () => {
      tl.kill();
      document.documentElement.classList.remove("wdk-scroll-blocked");
    };
  }, []);

  return (
    <div className="wdk-intro" ref={introRef} aria-hidden>
      <div className="wdk-intro-mark">
        {V_LINES.map((n) => (
          <div key={`v${n}`} className={`wdk-intro-path wdk-intro-path--v wdk-intro-path--v-${n}`} />
        ))}
        {H_LINES.map((n) => (
          <div key={`h${n}`} className={`wdk-intro-path wdk-intro-path--h wdk-intro-path--h-${n}`} />
        ))}
      </div>

      <div className="wdk-intro-border wdk-intro-border--top" />
      <div className="wdk-intro-border wdk-intro-border--left" />
      <div className="wdk-intro-border wdk-intro-border--right" />
    </div>
  );
}
