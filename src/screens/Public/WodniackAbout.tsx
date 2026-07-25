import { useEffect, useRef } from "react";
import { emitter, viewport } from "./WodniackRuntime";
import "./WodniackAbout.css";

/**
 * `SAbout` from AntoineW/AW-2025-Portfolio `src/components/SAbout.astro`.
 *
 * A bordered card floats on a drifting `--offset-y` tied to scroll progress,
 * and an SVG "tunnel" of straight lines is rebuilt every frame connecting the
 * section's outer rectangle to the card's moving inner rectangle. Hovering a
 * tile flings physics-driven particles onto a canvas behind the content.
 *
 * Content is profile-driven; the reference's award grid is replaced by
 * highlight tiles laid out on the same 4-column collage system.
 */

type CounterTile = { key: string; name: string; counters: string[] };
type TextTile = { key: string; text: string };

type WodniackAboutProps = {
  paragraphs: string[];
  counters: CounterTile[];
  texts: TextTile[];
};

/** Particle thrown when a tile is touched — the reference throws smileys. */
class Particle {
  width = 48;
  height = 48;
  r = 0;
  a = 0.25 + Math.random() * 0.75;
  vx = (Math.random() * 2 - 1) * 5;
  vy = Math.random() * -10 - 5;
  vr = (Math.random() * 2 - 1) * 10;
  va = Math.random() * 0.01;

  constructor(
    private ctx: CanvasRenderingContext2D,
    private colour: string,
    public x: number,
    public y: number,
  ) {}

  move() {
    this.vy += 0.45;

    this.x += this.vx;
    this.y += this.vy;
    this.r += this.vr;
    this.a += this.va;
  }

  draw() {
    const { ctx } = this;
    const size = this.width * this.a;
    const cx = this.x + size * 0.5;
    const cy = this.y + size * 0.5;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((this.r * Math.PI) / 180);

    // Four-point star, matching the motif used elsewhere in the template.
    const outer = size * 0.5;
    const inner = size * 0.11;
    ctx.beginPath();
    ctx.moveTo(0, -outer);
    ctx.quadraticCurveTo(inner, -inner, outer, 0);
    ctx.quadraticCurveTo(inner, inner, 0, outer);
    ctx.quadraticCurveTo(-inner, inner, -outer, 0);
    ctx.quadraticCurveTo(-inner, -inner, 0, -outer);
    ctx.closePath();

    ctx.fillStyle = this.colour;
    ctx.fill();

    ctx.restore();
  }
}

export function WodniackAbout({ paragraphs, counters, texts }: WodniackAboutProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<SVGSVGElement | null>(null);
  const pathRef = useRef<SVGPathElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const inner = innerRef.current;
    const svg = gridRef.current;
    const path = pathRef.current;
    const canvas = canvasRef.current;
    if (!root || !inner || !svg || !path || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let bounding = { left: 0, top: 0, width: 0, height: 0, innerWidth: 0, innerHeight: 0, offsetY: 0 };
    const scroll = { start: 0, end: 0, p: 0, sp: 0 };
    let lines: Array<[{ x: number; y: number }, { x: number; y: number }]> = [];
    const particles: Particle[] = [];
    let isForced = false;

    const setSize = () => {
      const rect = root.getBoundingClientRect();

      bounding = {
        left: rect.left,
        top: rect.top,
        width: root.clientWidth,
        height: root.clientHeight,
        innerWidth: inner.clientWidth,
        innerHeight: inner.clientHeight,
        offsetY: bounding.offsetY,
      };

      svg.style.width = `${bounding.width}px`;
      svg.style.height = `${bounding.height}px`;

      canvas.width = bounding.width;
      canvas.height = bounding.height;
    };

    const onScroll = (scrollY: number) => {
      const trigger = scrollY + viewport.height;

      if (trigger < scroll.start) scroll.p = 0;
      else if (trigger > scroll.end) scroll.p = 1;
      else scroll.p = (trigger - scroll.start) / (scroll.end - scroll.start);
    };

    const setScroll = () => {
      scroll.start = bounding.top + window.scrollY;
      scroll.end = bounding.top + window.scrollY + bounding.height + viewport.height;

      onScroll(window.scrollY);
      scroll.sp = scroll.p;
    };

    const drawLines = () => {
      let d = "";
      lines.forEach(([p1, p2]) => {
        d += `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} `;
      });
      path.setAttribute("d", d);
    };

    /** Straight lines from the section's outer rect to the card's inner rect. */
    const setLines = () => {
      lines = [];

      const innerX = (bounding.width - bounding.innerWidth) / 2;
      const innerY = (bounding.height - bounding.innerHeight) / 2 + bounding.offsetY;

      const vLines = viewport.width > 767 ? 12 : 8;
      const hLines = 4;

      const outerGapX = bounding.width / vLines;
      const outerGapY = bounding.height / vLines;
      const innerGapX = bounding.innerWidth / vLines;
      const innerGapY = bounding.innerHeight / vLines;
      const hGap = 1 / hLines;

      const outer = { x1: 0, x2: bounding.width, y1: 0, y2: bounding.height };
      const box = {
        x1: innerX,
        x2: innerX + bounding.innerWidth,
        y1: innerY,
        y2: innerY + bounding.innerHeight,
      };

      const corners = [
        [{ x: outer.x1, y: outer.y1 }, { x: box.x1, y: box.y1 }],
        [{ x: outer.x2, y: outer.y1 }, { x: box.x2, y: box.y1 }],
        [{ x: outer.x2, y: outer.y2 }, { x: box.x2, y: box.y2 }],
        [{ x: outer.x1, y: outer.y2 }, { x: box.x1, y: box.y2 }],
      ];

      // Top & bottom, vertical
      for (let i = 1; i < vLines; i++) {
        lines.push([{ x: outerGapX * i, y: outer.y1 }, { x: innerX + innerGapX * i, y: box.y1 }]);
        lines.push([{ x: outerGapX * i, y: outer.y2 }, { x: innerX + innerGapX * i, y: box.y2 }]);
      }

      // Left & right, vertical
      for (let i = 0; i <= vLines; i++) {
        lines.push([{ x: outer.x1, y: outerGapY * i }, { x: box.x1, y: innerY + innerGapY * i }]);
        lines.push([{ x: outer.x2, y: outerGapY * i }, { x: box.x2, y: innerY + innerGapY * i }]);
      }

      // Horizontal rings, eased toward the card so they bunch near the edges.
      const ring = (a: number, b: number) => {
        for (let i = 1; i < hLines; i++) {
          const index = 1 - Math.pow(1 - hGap * i, 2);
          const l1 = corners[a];
          const l2 = corners[b];

          lines.push([
            {
              x: l1[0].x + (l1[1].x - l1[0].x) * index,
              y: l1[0].y + (l1[1].y - l1[0].y) * index,
            },
            {
              x: l2[0].x + (l2[1].x - l2[0].x) * index,
              y: l2[0].y + (l2[1].y - l2[0].y) * index,
            },
          ]);
        }
      };

      ring(0, 1); // top
      ring(3, 2); // bottom
      ring(1, 2); // right
      ring(0, 3); // left

      drawLines();
    };

    const tick = () => {
      scroll.sp += (scroll.p - scroll.sp) * 0.2;
      const sd = Math.round((scroll.p - scroll.sp) * 1000) / 1000;

      bounding.offsetY = (viewport.width > 767 ? 400 : 200) * (scroll.sp * 2 - 1);
      root.style.setProperty("--offset-y", `${bounding.offsetY}px`);

      if (sd !== 0 || isForced) setLines();

      if (particles.length) {
        for (let i = particles.length - 1; i >= 0; i--) {
          particles[i].move();
          if (particles[i].y > bounding.height) particles.splice(i, 1);
        }

        ctx.clearRect(0, 0, bounding.width, bounding.height);
        particles.forEach((particle) => particle.draw());
      }

      isForced = false;
    };

    const onResize = (widthChanged: boolean) => {
      if (!widthChanged) return;
      setSize();
      setScroll();
      isForced = true;
    };

    const onIntersect = (event: Event) => {
      const detail = (event as CustomEvent<{ isIntersecting: boolean }>).detail;

      if (detail.isIntersecting) emitter.on("tick", tick);
      else emitter.off("tick", tick);
    };

    const throwParticles = (tile: HTMLElement) => {
      const rootBox = root.getBoundingClientRect();
      const tileBox = tile.getBoundingClientRect();

      const x = tileBox.left + tileBox.width * 0.5 - rootBox.left;
      const y = tileBox.top + tileBox.height * 0.5 - rootBox.top;

      const colour = getComputedStyle(root).getPropertyValue("--wdk-red").trim() || "#f40c3f";
      const max = viewport.width > 767 ? 10 : 5;

      for (let i = 0; i < max; i++) particles.push(new Particle(ctx, colour, x, y));
    };

    const tiles = Array.from(root.querySelectorAll<HTMLElement>(".wdk-about__tile--live"));
    const cleanups: Array<() => void> = [];

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-revealed");
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.5 },
    );

    tiles.forEach((tile) => {
      revealObserver.observe(tile);

      const onInteraction = () => {
        tile.classList.add("is-active");
        throwParticles(tile);
        const timer = window.setTimeout(() => tile.classList.remove("is-active"), 100);
        cleanups.push(() => window.clearTimeout(timer));
      };

      tile.addEventListener("mouseenter", onInteraction, { passive: true });
      tile.addEventListener("touchstart", onInteraction, { passive: true });

      cleanups.push(() => {
        tile.removeEventListener("mouseenter", onInteraction);
        tile.removeEventListener("touchstart", onInteraction);
      });
    });

    emitter.on("resize", onResize);
    emitter.on("scroll", onScroll);
    root.addEventListener("intersect", onIntersect);

    setSize();
    setScroll();
    setLines();

    if (root.getBoundingClientRect().top < viewport.height) emitter.on("tick", tick);

    return () => {
      emitter.off("resize", onResize);
      emitter.off("scroll", onScroll);
      emitter.off("tick", tick);
      root.removeEventListener("intersect", onIntersect);
      revealObserver.disconnect();
      cleanups.forEach((fn) => fn());
    };
  }, [counters, texts]);

  return (
    <section id="about" className="wdk-about" ref={rootRef} data-intersect>
      <div className="wdk-about__inner" ref={innerRef}>
        <div className="wdk-about__block">
          <h2 className="wdk-about__title">About</h2>

          <div className="wdk-about__content">
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </div>

        <div className="wdk-about__block">
          <h2 className="wdk-about__title">Highlights</h2>

          <ul className="wdk-about__tiles">
            {counters.map((tile) => (
              <li
                className="wdk-about__tile wdk-about__tile--live wdk-about__tile--counter"
                key={tile.key}
              >
                <span className="wdk-about__tile-inner">
                  <span className="wdk-about__tile-name">{tile.name}</span>
                  {tile.counters.map((counter) => (
                    <span className="wdk-about__tile-counter" key={counter}>
                      ({counter})
                    </span>
                  ))}
                </span>

                <span className="wdk-about__tile-mask" />
              </li>
            ))}

            {texts.map((tile) => (
              <li
                className="wdk-about__tile wdk-about__tile--live wdk-about__tile--text"
                key={tile.key}
              >
                <span className="wdk-about__tile-inner">
                  <span className="wdk-about__tile-text">{tile.text}</span>
                </span>

                <span className="wdk-about__tile-mask" />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <svg className="wdk-about__grid" ref={gridRef} aria-hidden>
        <path ref={pathRef} d="" />
      </svg>

      <canvas className="wdk-about__canvas" ref={canvasRef} aria-hidden />
    </section>
  );
}
