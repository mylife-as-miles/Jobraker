import { useEffect, useMemo, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SlowMo } from "gsap/EasePack";
import { emitter, viewport } from "./WodniackRuntime";
import { initials, yearRange } from "./WodniackPortfolioCore";
import "./WodniackWork.css";

gsap.registerPlugin(ScrollTrigger, SlowMo);

/**
 * `SWork` from AntoineW/AW-2025-Portfolio `src/components/SWork.astro`
 * (+ `AWork.astro`).
 *
 * A fixed dark stage sits under a primary-coloured mask with a capsule-shaped
 * hole punched in it. Scrolling scales that mask up until the hole is larger
 * than the viewport, so the stage is revealed through an opening iris. At the
 * same time the W-O-R-K letters spawn ghost copies that stream outward in 3D,
 * cards fly past on the z-axis, and a drifting dot field converges behind
 * everything.
 *
 * The reference fills the cards with project videos; this drives them from the
 * profile's roles instead, since that is the media we have.
 */

const TITLE = ["W", "O", "R", "K"];

type Experience = {
  title: string;
  company: string;
  location: string | null;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
};

type WodniackWorkProps = {
  experiences: Experience[];
};

/** Cards repeat so a short role list still fills the flight path. */
function buildCards(experiences: Experience[]) {
  if (!experiences.length) return [];

  const target = Math.max(12, experiences.length * 4);
  const cards: Array<Experience & { key: string; index: number }> = [];

  for (let i = 0; i < target; i++) {
    const source = experiences[i % experiences.length];
    cards.push({ ...source, key: `${source.company}-${i}`, index: i });
  }

  return cards;
}

export function WodniackWork({ experiences }: WodniackWorkProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const cards = useMemo(() => buildCards(experiences), [experiences]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !cards.length) return;

    const container = root.querySelector<HTMLElement>(".wdk-work__inner");
    const scene = root.querySelector<HTMLElement>(".wdk-work__scene");
    const titleInner = root.querySelector<HTMLElement>(".wdk-work__title-inner");
    const ruler = root.querySelector<HTMLElement>(".wdk-work__ruler");
    const canvas = root.querySelector<HTMLCanvasElement>(".wdk-work__canvas");
    const maskEl = root.querySelector<HTMLElement>(".wdk-work__mask");
    const maskSvg = root.querySelector<SVGSVGElement>(".wdk-work__mask-svg");
    const pathOuter = root.querySelector<SVGPathElement>(".wdk-work__mask-outer-path");
    const pathInner = root.querySelector<SVGPathElement>(".wdk-work__mask-inner-path");
    const pathLines = root.querySelector<SVGPathElement>(".wdk-work__mask-lines");
    if (!container || !scene || !titleInner || !ruler || !canvas || !maskEl || !maskSvg) return;
    if (!pathOuter || !pathInner || !pathLines) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cardEls = Array.from(root.querySelectorAll<HTMLElement>(".wdk-work__card"));
    const letterEls = Array.from(titleInner.querySelectorAll<HTMLElement>(".wdk-work__letter"));

    type Ghost = { el: HTMLElement };
    type Letter = { el: HTMLElement; ghosts: Ghost[]; freq: number; total: number };
    type Point = { x: number; y: number; dx: number; dy: number; flowX: number };

    const letters: Letter[] = letterEls.map((el) => ({ el, ghosts: [], freq: 1, total: 0 }));
    let points: Point[] = [];
    let bounding = { left: 0, top: 0, width: 0, height: 0 };
    let speed = 1;
    let maxScale = 1;

    const proxy = { animationProgress: 0, pointsProgress: 0, state: 0 };
    const last = { animationProgress: -1, pointsProgress: -1 };
    let smoothScrollProgress = 0;
    let tl: gsap.core.Timeline | null = null;

    const setCtxStyle = () => {
      ctx.strokeStyle = getComputedStyle(root).getPropertyValue("--wdk-primary").trim() || "#fff2ed";
    };

    const setSize = () => {
      root.style.setProperty("--height", `${Math.max(cards.length * 50, 250)}lvh`);

      const rect = container.getBoundingClientRect();

      bounding = { left: rect.left, top: rect.top, width: viewport.width, height: viewport.height };

      canvas.width = bounding.width;
      canvas.height = bounding.height;

      speed = Math.hypot(bounding.width, bounding.height) * 4;
    };

    /** Capsule hole geometry, derived from the invisible ruler element. */
    const setMask = () => {
      const width = maskEl.clientWidth;
      const height = maskEl.clientHeight;

      maskSvg.style.width = `${width}px`;
      maskSvg.style.height = `${height}px`;

      const elBox = root.getBoundingClientRect();
      const rulerBox = ruler.getBoundingClientRect();
      const rulerWidth = rulerBox.width;
      const rulerHeight = rulerBox.height;
      const offsetX = rulerBox.left - elBox.left;
      const offsetY = rulerBox.top - elBox.top;

      const dOuter = `M -1 0 L ${width + 2} 0 L ${width + 2} ${height} L -1 ${height} Z`;

      const corners = {
        tl: { x: offsetX, y: offsetY },
        tr: { x: offsetX + rulerWidth, y: offsetY },
        br: { x: offsetX + rulerWidth, y: offsetY + rulerHeight },
        bl: { x: offsetX, y: offsetY + rulerHeight },
      };

      let size = (corners.tr.x - corners.tl.x) / 2;

      maxScale = viewport.width / Math.max(size, 1);

      let dInner = `M ${corners.tl.x} ${corners.tl.y + size} A ${size} ${size} 0 0 1 ${corners.tr.x} ${corners.tr.y + size} L ${corners.br.x} ${corners.br.y - size} A ${size} ${size} 0 0 1 ${corners.bl.x} ${corners.bl.y - size} Z`;
      const linesClip = `${dOuter} ${dInner}`;

      pathOuter.setAttribute("d", `${dOuter} ${dInner}`);

      const thickness = viewport.width > 767 ? 16 : 8;
      corners.tl.x += thickness;
      corners.tl.y += thickness;
      corners.tr.x -= thickness;
      corners.tr.y += thickness;
      corners.br.x -= thickness;
      corners.br.y -= thickness;
      corners.bl.x += thickness;
      corners.bl.y -= thickness;

      size = (corners.tr.x - corners.tl.x) / 2;

      dInner = `M ${corners.tl.x} ${corners.tl.y + size} A ${size} ${size} 0 0 1 ${corners.tr.x} ${corners.tr.y + size} L ${corners.br.x} ${corners.br.y - size} A ${size} ${size} 0 0 1 ${corners.bl.x} ${corners.bl.y - size} Z`;

      pathInner.setAttribute("d", `${dOuter} ${dInner}`);

      const vLines = viewport.width > 767 ? 12 : 8;
      const gapX = width / vLines;
      const gapY = height * 0.1;
      const hLines = Math.ceil(height / gapY);

      let dLines = "";
      for (let i = 1; i < vLines; i++) dLines += `M ${gapX * i} 0 L ${gapX * i} ${height} `;
      for (let i = 0; i < hLines; i++) dLines += `M 0 ${gapY * i} L ${width} ${gapY * i} `;

      pathLines.setAttribute("d", dLines);
      pathLines.style.clipPath = `path(evenodd, '${linesClip}')`;
    };

    /** Ghost copies of each letter, streaming across the stage. */
    const setLetters = () => {
      letters.forEach((letter, j) => {
        letter.ghosts.forEach((ghost) => ghost.el.remove());
        letter.ghosts = [];

        const box = letter.el.getBoundingClientRect();
        const top = box.top - bounding.top;
        const left = box.left;

        letter.freq = 1 + Math.random();

        const multiplier = viewport.width > 767 ? 0.75 : 0.5;
        letter.total = Math.round((bounding.width / Math.max(box.width, 1)) * multiplier) + 2;

        for (let i = 0; i < letter.total; i++) {
          const el = document.createElement("span");
          el.classList.add("wdk-work__ghost");
          el.innerText = letter.el.innerText;
          el.dataset.letter = letter.el.innerText;

          scene.appendChild(el);

          el.style.top = `${top}px`;
          el.style.left = `${left}px`;
          el.style.zIndex = String(
            j !== 1 && j !== 2 && (j + letters.length + i) % 5 === 0 ? 3 : 1,
          );

          el.style.setProperty("--ix", String(i - letter.total * 0.5));
          el.style.setProperty("--iy", String(((j + 1) / (letters.length + 1) - 0.5) * 2));
          el.style.setProperty("--ap", String(Math.abs(i / letter.total - 0.5) * 2));
          el.style.setProperty("--p", String((i / letter.total - 0.5) * 2));

          letter.ghosts.push({ el });
        }
      });
    };

    const setCards = () => {
      cardEls.forEach((el, i) => {
        el.style.setProperty("--size", String(0.5 + Math.random() * 0.5));
        el.style.setProperty("--y", String((0.5 + Math.random() * 0.5) * (i % 2 ? -1 : 1)));
      });
    };

    const setPoints = () => {
      points = [];

      const gap = 24;
      const cols = Math.ceil((bounding.width * 1.2) / gap);
      const rows = Math.ceil((bounding.height * 1.2) / gap);

      const offsetX = (bounding.width - cols * gap) * 0.5;
      const offsetY = (bounding.height - rows * gap) * 0.5;

      const hWidth = bounding.width * 0.5;
      const hHeight = bounding.height * 0.5;

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * gap + offsetX;
          const y = j * gap + offsetY;

          points.push({ x, y, dx: hWidth - x, dy: hHeight - y, flowX: 0 });
        }
      }
    };

    const setTimeline = () => {
      tl?.kill();

      tl = gsap.timeline({
        scrollTrigger: { trigger: root, start: "top 25%", end: "bottom 75%", scrub: 1 },
        onUpdate: () => scene.style.setProperty("--state", String(proxy.state)),
      });

      tl.fromTo(maskEl, { scale: 1 }, { scale: maxScale, duration: 0.75, ease: "power4.in" }, 0);
      tl.fromTo(scene, { scale: 0.75 }, { scale: 1, duration: 0.75, ease: "power3.in" }, 0);
      tl.fromTo(
        container,
        { clipPath: "inset(0 1rem)" },
        { clipPath: "inset(0 0rem)", duration: 0.75, ease: "power3.in" },
        0,
      );
      tl.fromTo(proxy, { pointsProgress: 0 }, { pointsProgress: 1, duration: 1, ease: "power4.inOut" }, 0);
      tl.fromTo(proxy, { state: 0 }, { state: 1, duration: 0.75, ease: "power4.in" }, 0);

      tl.fromTo(
        cardEls,
        { "--progress": 1 },
        { "--progress": -1, ease: "slow(0.15, 0.6)", stagger: 0.25 },
        0.75,
      );

      tl.fromTo(
        proxy,
        { animationProgress: 0 },
        { animationProgress: 10000, duration: tl.totalDuration(), ease: "power1.out" },
        0.75,
      );

      tl.fromTo(
        proxy,
        { state: 1 },
        { state: 0, duration: 0.75, ease: "power4.inOut", immediateRender: false },
        "-=1",
      );
      tl.fromTo(
        maskEl,
        { scale: maxScale },
        { scale: 1, duration: 0.75, ease: "power4.inOut", immediateRender: false },
        "-=1",
      );
      tl.fromTo(
        scene,
        { scale: 1 },
        { scale: 0.75, duration: 0.75, ease: "power3.inOut", immediateRender: false },
        "-=1",
      );
      tl.fromTo(
        container,
        { clipPath: "inset(0 0rem)" },
        { clipPath: "inset(0 1rem)", duration: 0.75, ease: "power3.inOut", immediateRender: false },
        "-=1",
      );
      tl.fromTo(
        proxy,
        { pointsProgress: 1 },
        { pointsProgress: 0, duration: 1, ease: "power4.inOut" },
        "-=1",
      );
    };

    const moveLetters = () => {
      letters.forEach((letter) => {
        const letterSpeed = speed * letter.freq;

        letter.ghosts.forEach((ghost, index) => {
          const progress =
            (((proxy.animationProgress % letterSpeed) / letterSpeed + index / letter.total) % 1) /
              0.7 -
            0.15;

          ghost.el.style.setProperty("--progress", String(progress));
        });
      });
    };

    const drawPoints = () => {
      const rAnimation = Math.round(proxy.animationProgress * 100) / 100;
      const rPoints = Math.round(proxy.pointsProgress * 100) / 100;

      if (rPoints === last.pointsProgress && rAnimation === last.animationProgress) return;

      ctx.clearRect(0, 0, bounding.width, bounding.height);
      ctx.beginPath();

      const flowX = (proxy.animationProgress * -0.05) % 24;

      points.forEach((point) => {
        const x = point.x + point.dx * (1 - proxy.pointsProgress) * 0.2 + flowX;
        const y = point.y + point.dy * (1 - proxy.pointsProgress) * 0.2;

        ctx.rect(x, y, 0.5, 0.5);
      });

      ctx.stroke();

      last.pointsProgress = rPoints;
      last.animationProgress = rAnimation;
    };

    const tick = () => {
      const scrollProgress =
        Math.max(Math.min(1, ScrollTrigger.positionInViewport(root, "top")), 0) * -1 +
        (1 - Math.max(Math.min(1, ScrollTrigger.positionInViewport(root, "bottom")), 0));

      smoothScrollProgress += (scrollProgress - smoothScrollProgress) * 0.1;

      root.style.setProperty("--scroll-progress", String(scrollProgress));

      moveLetters();
      drawPoints();
    };

    const onResize = (widthChanged: boolean) => {
      if (!widthChanged) return;

      setCtxStyle();
      setSize();
      setMask();
      setPoints();
      setLetters();
      setCards();
      setTimeline();
    };

    const onIntersect = (event: Event) => {
      const detail = (event as CustomEvent<{ isIntersecting: boolean }>).detail;

      if (detail.isIntersecting) emitter.on("tick", tick);
      else emitter.off("tick", tick);
    };

    setCtxStyle();
    setSize();
    setMask();
    setPoints();
    setLetters();
    setCards();
    setTimeline();

    emitter.on("resize", onResize);
    root.addEventListener("intersect", onIntersect);

    if (root.getBoundingClientRect().top < viewport.height) emitter.on("tick", tick);

    return () => {
      emitter.off("resize", onResize);
      emitter.off("tick", tick);
      root.removeEventListener("intersect", onIntersect);
      tl?.scrollTrigger?.kill();
      tl?.kill();
      letters.forEach((letter) => letter.ghosts.forEach((ghost) => ghost.el.remove()));
    };
  }, [cards]);

  if (!cards.length) return null;

  return (
    <section id="work" className="wdk-work" ref={rootRef} data-intersect>
      <div className="wdk-work__outer">
        <div className="wdk-work__inner">
          <h2 className="wdk-work__title">
            <span className="wdk-work__title-inner">
              {TITLE.map((letter) => (
                <span className="wdk-work__letter" key={letter}>
                  {letter}
                </span>
              ))}
            </span>
          </h2>

          <div className="wdk-work__scene">
            {cards.map((card, index) => (
              <article className="wdk-work__card" key={card.key}>
                <div className="wdk-work__card-inner">
                  <div className="wdk-work__card-screen" aria-hidden>
                    <span className="wdk-work__card-mark">{initials(card.company)}</span>
                  </div>

                  <div className="wdk-work__card-caption">
                    <span className="wdk-work__card-text">
                      {card.title} — {card.company}
                    </span>
                    <span className="wdk-work__card-key">
                      #{yearRange(card.start_date, card.end_date)}/
                      {String(index).padStart(4, "0")}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <canvas className="wdk-work__canvas" aria-hidden />
        </div>

        <div className="wdk-work__mask-outer" aria-hidden>
          <div className="wdk-work__mask">
            <svg className="wdk-work__mask-svg">
              <path className="wdk-work__mask-inner-path" d="" />
              <path className="wdk-work__mask-outer-path" d="" />
              <path className="wdk-work__mask-lines" d="" />
            </svg>
          </div>
        </div>

        <div className="wdk-work__ruler" aria-hidden />
      </div>
    </section>
  );
}
