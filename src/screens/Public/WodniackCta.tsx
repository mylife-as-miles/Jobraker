import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { emitter, viewport } from "./WodniackRuntime";
import "./WodniackCta.css";

/**
 * `SCTA` from AntoineW/AW-2025-Portfolio `src/components/SCTA.astro`.
 *
 * A grid of points behind the call to action is displaced by radial waves
 * emanating from the button: a slow "pulse" on a repeating timeline, and a
 * harder "shock" the moment you hover. The wave maths (tension, friction,
 * strength, the eased radial offset) is the source's verbatim. Hovering also
 * blows the small GO button up into the full circular call to action.
 */

const LINES = [
  ["L", "e", "t’", "s"],
  ["R", "o", "c", "k"],
];

type WodniackCtaProps = {
  email: string | null;
  label: string;
};

type Point = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  wx: number;
  wy: number;
  mx: number;
  my: number;
  ox: number;
  oy: number;
  dx: number;
  dy: number;
  dist: number;
};

export function WodniackCta({ email, label }: WodniackCtaProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const container = root.querySelector<HTMLElement>(".wdk-cta__inner");
    const gridEl = root.querySelector<HTMLElement>(".wdk-cta__grid");
    const svg = root.querySelector<SVGSVGElement>(".wdk-cta__grid-svg");
    const path = root.querySelector<SVGPathElement>(".wdk-cta__grid-path");
    const buttonText = root.querySelector<HTMLElement>(".wdk-cta__button-text");
    if (!container || !gridEl || !svg || !path || !buttonText) return;

    const grid = { width: 0, height: 0, gapX: 0, gapY: 0, vLines: 12, hLines: 8, points: [] as Point[][] };
    const wave = { progress: 0, speed: 15, strength: 1, state: "pulse", op: 0 };
    const bounding = { width: 0, height: 0 };
    let ctaMaxSize = 1;
    let isHovered = false;
    let tl: gsap.core.Timeline | null = null;

    const easeOut = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

    const setSize = () => {
      const box = container.getBoundingClientRect();
      bounding.width = box.width;
      bounding.height = box.height;

      const gridBox = gridEl.getBoundingClientRect();
      grid.width = gridBox.width;
      grid.height = gridBox.height;

      ctaMaxSize = Math.hypot(grid.width, grid.height) * 0.5;
    };

    const setGrid = () => {
      svg.style.width = `${grid.width}px`;
      svg.style.height = `${grid.height}px`;

      grid.points = [];
      grid.vLines = viewport.width > 767 ? 12 : 8;
      grid.gapX = grid.width / grid.vLines;
      grid.gapY = bounding.height / 8;
      grid.hLines = Math.max(1, Math.floor(grid.height / Math.max(grid.gapY, 1)));

      const offsetY = grid.height - grid.gapY * grid.hLines;
      const center = { x: grid.width / 2, y: grid.height - bounding.height / 2 };

      for (let i = 0; i <= grid.vLines; i++) {
        const row: Point[] = [];

        for (let j = 0; j <= grid.hLines; j++) {
          const x = grid.gapX * i;
          const y = grid.gapY * j + (j !== 0 ? offsetY : 0);

          const dx = x - center.x;
          const dy = y - center.y;
          const angle = Math.atan2(dy, dx);
          const dist = Math.hypot(dx, dy);

          row.push({
            x, y,
            vx: 0, vy: 0, wx: 0, wy: 0, mx: 0, my: 0, ox: 0, oy: 0,
            dx: dist === 0 ? 0 : Math.cos(angle) * (grid.width / 2 / dist) * 5,
            dy: dist === 0 ? 0 : Math.sin(angle) * (grid.width / 2 / dist) * 5,
            dist,
          });
        }

        grid.points.push(row);
      }
    };

    const movePoints = () => {
      const diagonal = Math.hypot(viewport.height, viewport.width);

      grid.points.forEach((col) => {
        col.forEach((point, y) => {
          if (y === 0 || point.dist === 0) return;

          const d = Math.abs(point.dist - wave.progress);
          const l = 30;

          if (d < l) {
            const s = 1 - d / l;
            const a = Math.atan2(point.dy, point.dx);
            const f = Math.cos(d * 0.01) * s;

            point.vx += Math.cos(a) * f * l * 0.5 * wave.strength;
            point.vy += Math.sin(a) * f * l * 0.5 * wave.strength;
          }

          point.vx += (0 - point.wx) * 0.001; // String tension
          point.vy += (0 - point.wy) * 0.001;

          point.vx *= 0.9; // Friction or duration
          point.vy *= 0.9;

          point.wx += point.vx * 3; // Strength
          point.wy += point.vy * 3;

          point.wx *= 0.9;
          point.wy *= 0.9;

          point.mx = point.wx * 0.1;
          point.my = point.wy * 0.1;

          point.ox = easeOut(point.dx / diagonal) * grid.gapX * 75 * (point.dist / ctaMaxSize);
          point.oy = easeOut(point.dy / diagonal) * grid.gapY * 75 * (point.dist / ctaMaxSize);
        });
      });
    };

    const movedPoint = (point: Point) => ({
      x: point.x + point.mx + point.ox * wave.op,
      y: point.y + point.my + point.oy * wave.op,
    });

    const drawLines = () => {
      let d = "";

      grid.points.forEach((col) => {
        col.forEach((point, i) => {
          const p = movedPoint(point);
          d += `${i === 0 ? "M" : "L"} ${p.x} ${p.y} `;
        });
      });

      for (let y = 0; y < grid.hLines; y++) {
        grid.points.forEach((col, x) => {
          const p = movedPoint(col[y]);
          d += `${x === 0 ? "M" : "L"} ${p.x} ${p.y} `;
        });
      }

      path.setAttribute("d", d);
    };

    const wavePulse = () => {
      if (isHovered) return;

      wave.progress = 0;
      wave.state = "pulse";
      wave.speed = viewport.width > 767 ? 15 : 10;
      wave.strength = viewport.width > 767 ? 1 : 0.35;
    };

    const waveShock = () => {
      if (!isHovered || wave.state === "shock") return;

      wave.progress = 0;
      wave.state = "shock";
      wave.speed = 30;
      wave.strength = 5;
    };

    const tick = () => {
      if (wave.progress < grid.height && wave.state !== "paused") wave.progress += wave.speed;

      movePoints();
      drawLines();
    };

    const createPulseTimeline = () => {
      tl = gsap.timeline({ repeat: -1, repeatDelay: 0.5 });

      tl.call(() => { wave.state = "pulse"; });
      tl.fromTo(buttonText, { scale: 0.85 }, { scale: 1.05, duration: 2.7, ease: "power2.in" });
      tl.call(wavePulse, []);
      tl.to(buttonText, { scale: 0.85, duration: 0.15, ease: "power4.out" });
    };

    const hoverTarget = root.querySelector<HTMLElement>(".wdk-cta__hover");

    const onEnter = () => {
      isHovered = true;
      setActive(true);
      waveShock();
      gsap.to(wave, { op: 1, duration: 1.2, ease: "power3.out" });
    };

    const onLeave = () => {
      isHovered = false;
      setActive(false);
      gsap.to(wave, { op: 0, duration: 1, ease: "power3.inOut" });
    };

    /*
     * Touch devices never fire hover, so the call to action would stay a bare
     * GO dot. Open it once the section settles in the middle of the viewport
     * instead, and close it again on the way out.
     */
    const coarse = window.matchMedia("(hover: none)").matches;
    let centreObserver: IntersectionObserver | undefined;

    if (coarse) {
      centreObserver = new IntersectionObserver(
        ([entry]) => (entry.isIntersecting ? onEnter() : onLeave()),
        { threshold: 0.6 },
      );
      if (container) centreObserver.observe(container);
    }

    const onResize = () => {
      setSize();
      setGrid();
    };

    const onIntersect = (event: Event) => {
      const detail = (event as CustomEvent<{ isIntersecting: boolean }>).detail;

      if (detail.isIntersecting) emitter.on("tick", tick);
      else emitter.off("tick", tick);
    };

    setSize();
    setGrid();
    drawLines();
    createPulseTimeline();

    hoverTarget?.addEventListener("mouseenter", onEnter);
    hoverTarget?.addEventListener("mouseleave", onLeave);
    emitter.on("resize", onResize);
    root.addEventListener("intersect", onIntersect);

    if (root.getBoundingClientRect().top < viewport.height) emitter.on("tick", tick);

    return () => {
      centreObserver?.disconnect();
      hoverTarget?.removeEventListener("mouseenter", onEnter);
      hoverTarget?.removeEventListener("mouseleave", onLeave);
      emitter.off("resize", onResize);
      emitter.off("tick", tick);
      root.removeEventListener("intersect", onIntersect);
      tl?.kill();
    };
  }, []);

  const mailto = email ? `mailto:${email}` : "#top";

  return (
    <section className="wdk-cta" ref={rootRef} data-intersect>
      <div id="contact" className="wdk-cta__inner">
        <div className={`wdk-cta__hover${active ? " is-active" : ""}`}>
          <a href={mailto} className="wdk-cta__button" aria-label={label}>
            <span className="wdk-cta__button-inner" />
            <span className="wdk-cta__button-text">GO</span>
          </a>

          <div className="wdk-cta__cta" aria-hidden={!active}>
            {LINES.map((line, i) => (
              <div className={`wdk-cta__line wdk-cta__line--${i === 0 ? "top" : "bottom"}`} key={i}>
                <div className="wdk-cta__line-text">
                  {line.map((char, j) => (
                    <span className="wdk-cta__char" key={j}>
                      {[0, 1, 2, 3].map((k) => (
                        <span className="wdk-cta__char-slice" key={k}>
                          {char}
                        </span>
                      ))}
                    </span>
                  ))}
                </div>
              </div>
            ))}

            {email ? (
              <a href={mailto} className="wdk-cta__link">
                {email}
              </a>
            ) : null}

            <div className="wdk-cta__stars" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <svg className="wdk-cta__star" viewBox="0 0 49 49" key={i}>
                  <path d="m24.5 0 3.3 21.2L49 24.5l-21.2 3.3L24.5 49l-3.3-21.2L0 24.5l21.2-3.3L24.5 0z" />
                </svg>
              ))}
            </div>

            <div className="wdk-cta__dots" aria-hidden />
          </div>
        </div>
      </div>

      <div className="wdk-cta__grid" aria-hidden>
        <svg className="wdk-cta__grid-svg">
          <path className="wdk-cta__grid-path" d="" />
        </svg>
      </div>
    </section>
  );
}
