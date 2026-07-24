import { useEffect, useRef } from "react";

const LINE_COUNT = 30;
const POINT_GAP = 28;

type WodniackWaveFieldProps = {
  className?: string;
  stroke?: string;
  dot?: string;
  interactive?: boolean;
  strength?: number;
};

type Point = { x: number; y: number };

function makePath(points: Point[]) {
  if (!points.length) return "";
  return points.reduce(
    (path, point, index) => `${path}${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)} `,
    "",
  );
}

export function WodniackWaveField({
  className = "",
  stroke = "currentColor",
  dot = "currentColor",
  interactive = true,
  strength = 1,
}: WodniackWaveFieldProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pathRefs = useRef<Array<SVGPathElement | null>>([]);
  const dotRef = useRef<SVGCircleElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    if (!root || !svg) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const size = { width: 0, height: 0 };
    const pointer = {
      x: -240,
      y: 0,
      targetX: -240,
      targetY: 0,
      velocity: 0,
      visible: false,
    };
    let frame = 0;
    let visible = true;
    let pageVisible = document.visibilityState === "visible";

    const measure = () => {
      const rect = root.getBoundingClientRect();
      size.width = Math.max(1, rect.width);
      size.height = Math.max(1, rect.height);
      svg.setAttribute("viewBox", `0 0 ${size.width} ${size.height}`);
    };

    const draw = (now: number) => {
      const { width, height } = size;
      if (!width || !height) return;

      pointer.x += (pointer.targetX - pointer.x) * 0.085;
      pointer.y += (pointer.targetY - pointer.y) * 0.085;
      pointer.velocity *= 0.91;

      const time = now * 0.001;
      const xGap = width / Math.max(1, LINE_COUNT - 1);
      const radius = Math.max(150, Math.min(width, height) * 0.26);

      pathRefs.current.forEach((path, lineIndex) => {
        if (!path) return;
        const points: Point[] = [];
        const baseX = lineIndex * xGap;

        for (let y = -POINT_GAP; y <= height + POINT_GAP; y += POINT_GAP) {
          const ambient =
            Math.sin(y * 0.012 + time * 1.05 + lineIndex * 0.19) * 17 * strength +
            Math.sin(y * 0.0045 - time * 0.52 + lineIndex * 0.08) * 9 * strength;
          let x = baseX + ambient;
          let movedY = y;

          if (interactive && pointer.visible) {
            const dx = x - pointer.x;
            const dy = movedY - pointer.y;
            const distance = Math.max(0.001, Math.hypot(dx, dy));
            if (distance < radius) {
              const influence = Math.pow(1 - distance / radius, 2);
              const force = (42 + pointer.velocity * 0.45) * influence * strength;
              x += (dx / distance) * force;
              movedY += (dy / distance) * force * 0.48;
            }
          }

          points.push({ x, y: movedY });
        }

        path.setAttribute("d", makePath(points));
      });

      if (dotRef.current) {
        dotRef.current.setAttribute("cx", String(pointer.x));
        dotRef.current.setAttribute("cy", String(pointer.y));
        dotRef.current.style.opacity = pointer.visible ? "1" : "0";
      }
    };

    const tick = (now: number) => {
      draw(now);
      if (!reducedMotion && visible && pageVisible) {
        frame = requestAnimationFrame(tick);
      } else {
        frame = 0;
      }
    };

    const start = () => {
      if (frame || reducedMotion || !visible || !pageVisible) return;
      frame = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!interactive) return;
      const rect = root.getBoundingClientRect();
      const nextX = event.clientX - rect.left;
      const nextY = event.clientY - rect.top;
      pointer.velocity = Math.min(100, Math.hypot(nextX - pointer.targetX, nextY - pointer.targetY));
      pointer.targetX = nextX;
      pointer.targetY = nextY;
      pointer.visible = true;
      start();
    };

    const onPointerLeave = () => {
      pointer.targetX = -240;
      pointer.visible = false;
    };

    const onVisibility = () => {
      pageVisible = document.visibilityState === "visible";
      if (pageVisible) start();
      else stop();
    };

    measure();
    draw(performance.now());

    const resizeObserver = new ResizeObserver(() => {
      measure();
      draw(performance.now());
    });
    resizeObserver.observe(root);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? false;
        if (visible) start();
        else stop();
      },
      { rootMargin: "120px", threshold: 0 },
    );
    intersectionObserver.observe(root);

    root.addEventListener("pointermove", onPointerMove, { passive: true });
    root.addEventListener("pointerenter", onPointerMove, { passive: true });
    root.addEventListener("pointerleave", onPointerLeave, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerenter", onPointerMove);
      root.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [interactive, strength]);

  return (
    <div ref={rootRef} className={`relative h-full w-full overflow-hidden ${className}`}>
      <svg ref={svgRef} className="block h-full w-full" aria-hidden>
        {Array.from({ length: LINE_COUNT }).map((_, index) => (
          <path
            key={index}
            ref={(node: SVGPathElement | null) => {
              pathRefs.current[index] = node;
            }}
            fill="none"
            stroke={stroke}
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <circle
          ref={dotRef}
          r="4"
          fill={dot}
          style={{ opacity: 0, transition: "opacity 180ms ease" }}
        />
      </svg>
    </div>
  );
}
