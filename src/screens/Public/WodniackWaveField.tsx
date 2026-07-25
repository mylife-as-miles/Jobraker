import { useEffect, useRef } from "react";
import { Noise } from "./WodniackNoise";
import { emitter } from "./WodniackRuntime";
import "./WodniackWaveField.css";

/**
 * The `<a-waves>` custom element from AntoineW/AW-2025-Portfolio
 * `src/components/AWaves.astro`, as a React component.
 *
 * A grid of SVG polylines displaced by 2D Perlin noise, with a spring-loaded
 * cursor force pushing points around as the pointer sweeps through. The
 * constants (gaps, noise scaling, tension, friction, clamp) are the source's
 * verbatim — they're what gives the field its specific drape.
 */

type Point = {
  x: number;
  y: number;
  wave: { x: number; y: number };
  cursor: { x: number; y: number; vx: number; vy: number };
};

type WodniackWaveFieldProps = {
  className?: string;
  /** Scales the cursor force; the reference hero uses 1. */
  strength?: number;
  /** Respond to the pointer immediately instead of waiting for the intro handoff. */
  interactive?: boolean;
};

export function WodniackWaveField({
  className,
  strength = 1,
  interactive = false,
}: WodniackWaveFieldProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const strengthRef = useRef(strength);
  strengthRef.current = strength;

  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    if (!root || !svg) return;

    const mouse = { x: -10, y: 0, lx: 0, ly: 0, sx: 0, sy: 0, v: 0, vs: 0, a: 0, set: false };
    const noise = new Noise(Math.random());

    let bounding = { left: 0, top: 0, width: 0, height: 0 };
    let lines: Point[][] = [];
    let paths: SVGPathElement[] = [];
    let isInteractive = interactive;
    let isPaused = true;

    const setSize = () => {
      const rect = root.getBoundingClientRect();

      svg.style.width = "";
      svg.style.height = "";

      bounding = {
        left: rect.left,
        top: rect.top + window.scrollY,
        width: root.clientWidth,
        height: root.clientHeight,
      };

      svg.style.width = `${bounding.width}px`;
      svg.style.height = `${bounding.height}px`;
    };

    const moved = (point: Point, withCursorForce = true) => ({
      x: Math.round((point.x + point.wave.x + (withCursorForce ? point.cursor.x : 0)) * 10) / 10,
      y: Math.round((point.y + point.wave.y + (withCursorForce ? point.cursor.y : 0)) * 10) / 10,
    });

    const drawLines = () => {
      lines.forEach((points, lIndex) => {
        const first = moved(points[0], false);

        let d = `M ${first.x} ${first.y}`;

        points.forEach((point, pIndex) => {
          const isLast = pIndex === points.length - 1;
          const p1 = moved(point, !isLast);

          d += `L ${p1.x} ${p1.y}`;
        });

        paths[lIndex]?.setAttribute("d", d);
      });
    };

    const setLines = () => {
      const { width, height } = bounding;

      lines = [];
      paths.forEach((path) => path.remove());
      paths = [];

      const xGap = 10;
      const yGap = 32;

      const oWidth = width + 200;
      const oHeight = height + 30;

      const totalLines = Math.ceil(oWidth / xGap);
      const totalPoints = Math.ceil(oHeight / yGap);

      const xStart = (width - xGap * totalLines) / 2;
      const yStart = (height - yGap * totalPoints) / 2;

      for (let i = 0; i <= totalLines; i++) {
        const points: Point[] = [];

        for (let j = 0; j <= totalPoints; j++) {
          points.push({
            x: xStart + xGap * i,
            y: yStart + yGap * j,
            wave: { x: 0, y: 0 },
            cursor: { x: 0, y: 0, vx: 0, vy: 0 },
          });
        }

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.classList.add("wdk-waves__line");

        svg.appendChild(path);
        paths.push(path);

        lines.push(points);
      }

      if (isPaused) drawLines();
    };

    const movePoints = (time: number) => {
      lines.forEach((points) => {
        points.forEach((p) => {
          // Wave movement
          const move =
            noise.perlin2((p.x + time * 0.0125) * 0.002, (p.y + time * 0.005) * 0.0015) * 12;
          p.wave.x = Math.cos(move) * 32;
          p.wave.y = Math.sin(move) * 16;

          // Mouse effect
          if (isInteractive) {
            const dx = p.x - mouse.sx;
            const dy = p.y - mouse.sy;
            const d = Math.hypot(dx, dy);
            const l = Math.max(175, mouse.vs);

            if (d < l) {
              const s = 1 - d / l;
              const f = Math.cos(d * 0.001) * s;

              p.cursor.vx += Math.cos(mouse.a) * f * l * mouse.vs * 0.00065 * strengthRef.current;
              p.cursor.vy += Math.sin(mouse.a) * f * l * mouse.vs * 0.00065 * strengthRef.current;
            }

            p.cursor.vx += (0 - p.cursor.x) * 0.005; // String tension
            p.cursor.vy += (0 - p.cursor.y) * 0.005;

            p.cursor.vx *= 0.925; // Friction/duration
            p.cursor.vy *= 0.925;

            p.cursor.x += p.cursor.vx * 2; // Strength
            p.cursor.y += p.cursor.vy * 2;

            p.cursor.x = Math.min(100, Math.max(-100, p.cursor.x)); // Clamp movement
            p.cursor.y = Math.min(100, Math.max(-100, p.cursor.y));
          }
        });
      });
    };

    const tick = (time: number) => {
      // Smooth mouse movement
      mouse.sx += (mouse.x - mouse.sx) * 0.1;
      mouse.sy += (mouse.y - mouse.sy) * 0.1;

      // Mouse velocity
      const dx = mouse.x - mouse.lx;
      const dy = mouse.y - mouse.ly;
      const d = Math.hypot(dx, dy);

      mouse.v = d;
      mouse.vs += (d - mouse.vs) * 0.1;
      mouse.vs = Math.min(100, mouse.vs);

      mouse.lx = mouse.x;
      mouse.ly = mouse.y;

      mouse.a = Math.atan2(dy, dx);

      root.style.setProperty("--x", `${mouse.sx}px`);
      root.style.setProperty("--y", `${mouse.sy}px`);

      movePoints(time);
      drawLines();
    };

    const updateMousePosition = (x: number, y: number) => {
      mouse.x = x - bounding.left;
      mouse.y = y - bounding.top + window.scrollY;

      if (!mouse.set) {
        mouse.sx = mouse.x;
        mouse.sy = mouse.y;
        mouse.lx = mouse.x;
        mouse.ly = mouse.y;

        mouse.set = true;
      }
    };

    const onMouseMove = (x: number, y: number) => updateMousePosition(x, y);

    const onTouchMove = (event: TouchEvent) => {
      event.preventDefault();
      const touch = event.touches[0];
      updateMousePosition(touch.clientX, touch.clientY);
    };

    const onResize = () => {
      setSize();
      setLines();
    };

    const onIntersect = (event: Event) => {
      const detail = (event as CustomEvent<{ isIntersecting: boolean }>).detail;
      isPaused = !detail.isIntersecting;

      if (isPaused) emitter.off("tick", tick);
      else emitter.on("tick", tick);
    };

    const onIntroEnd = () => { isInteractive = true; };

    emitter.on("mousemove", onMouseMove);
    emitter.on("resize", onResize);
    root.addEventListener("touchmove", onTouchMove);
    root.addEventListener("intersect", onIntersect);
    document.addEventListener("wdk:intro", onIntroEnd);

    setSize();
    setLines();

    // The shared observer may have already fired before this mounted.
    if (root.getBoundingClientRect().top < window.innerHeight) {
      isPaused = false;
      emitter.on("tick", tick);
    }

    return () => {
      emitter.off("mousemove", onMouseMove);
      emitter.off("resize", onResize);
      emitter.off("tick", tick);
      root.removeEventListener("touchmove", onTouchMove);
      root.removeEventListener("intersect", onIntersect);
      document.removeEventListener("wdk:intro", onIntroEnd);
      paths.forEach((path) => path.remove());
    };
  }, [interactive]);

  return (
    <div className={`wdk-waves${className ? ` ${className}` : ""}`} ref={rootRef} data-intersect>
      <svg ref={svgRef} />
    </div>
  );
}
