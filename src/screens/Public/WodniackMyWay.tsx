import { useEffect, useRef } from "react";
import { emitter, viewport } from "./WodniackRuntime";
import "./WodniackMyWay.css";

/**
 * `SMyWay` from AntoineW/AW-2025-Portfolio `src/components/SMyWay.astro`.
 *
 * Straight lines run from every edge of the section to a single point behind a
 * slowly rotating mark, so the whole panel reads as a vanishing point. The
 * headline is rendered twice: once inside a `matrix3d`-skewed wrapper so it
 * lies down into that perspective, and once flat below the horizon. Both are
 * driven by the section's scroll progress, so the type appears to rise up out
 * of the floor as you scroll.
 *
 * The reference floats personal photo frames through the scene; this profile
 * has no such media, so that layer is omitted.
 */

type WodniackMyWayProps = {
  /** Four short lines, e.g. ["Building", "my way", "since", "2015"]. */
  lines: string[];
};

export function WodniackMyWay({ lines }: WodniackMyWayProps) {
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const svg = root.querySelector<SVGSVGElement>(".wdk-way__svg");
    const path = root.querySelector<SVGPathElement>(".wdk-way__rays");
    const mark = root.querySelector<HTMLElement>(".wdk-way__mark");
    if (!svg || !path || !mark) return;

    let bounding = { width: 0, height: 0 };
    const vanishing = { x: 0, y: 0 };

    const setSize = () => {
      bounding = { width: root.clientWidth, height: root.clientHeight };

      svg.style.width = `${bounding.width}px`;
      svg.style.height = `${bounding.height}px`;

      const rootBox = root.getBoundingClientRect();
      const markBox = mark.getBoundingClientRect();

      vanishing.x = markBox.left + markBox.width * 0.5 - rootBox.left;
      vanishing.y = markBox.top + markBox.height * 0.5 - rootBox.top;
    };

    const setLines = () => {
      const segments: string[] = [`M 0 ${bounding.height} L ${bounding.width} ${bounding.height}`];

      const vLines = viewport.width > 767 ? 12 : 8;
      const gapX = bounding.width / vLines;

      for (let i = 0; i <= vLines; i++) {
        segments.push(`M ${gapX * i} 0 L ${vanishing.x} ${vanishing.y} `);
        segments.push(`M ${gapX * i} ${bounding.height} L ${vanishing.x} ${vanishing.y} `);
      }

      // Perspective strength for the skewed headline.
      const dx = bounding.width;
      const dy = (bounding.height - vanishing.y) / 2;
      root.style.setProperty("--distortion", String(Math.hypot(dx, dy) * 0.14));

      const hLines = vLines;
      const gapY = bounding.height / hLines;
      const offsetY = (bounding.height - gapY * hLines) / 2;

      for (let i = 1; i < hLines; i++) {
        segments.push(`M 0 ${offsetY + gapY * i} L ${vanishing.x} ${vanishing.y} `);
        segments.push(`M ${bounding.width} ${offsetY + gapY * i} L ${vanishing.x} ${vanishing.y} `);
      }

      path.setAttribute("d", segments.join(""));
    };

    const onScroll = () => {
      const box = root.getBoundingClientRect();
      const progress = 1 - (box.bottom - viewport.height) / Math.max(box.height, 1);

      root.style.setProperty("--scroll-progress", String(Math.min(Math.max(progress, 0), 1)));
    };

    const onResize = () => {
      setSize();
      setLines();
      onScroll();
    };

    setSize();
    setLines();
    onScroll();

    emitter.on("resize", onResize);
    emitter.on("scroll", onScroll);

    return () => {
      emitter.off("resize", onResize);
      emitter.off("scroll", onScroll);
    };
  }, [lines]);

  const headline = lines.map((line, index) => (
    <span key={index}>
      {line}
      {index < lines.length - 1 ? <br /> : null}
    </span>
  ));

  return (
    <section className="wdk-way" ref={rootRef} data-intersect>
      <svg className="wdk-way__svg" aria-hidden>
        <path className="wdk-way__rays" d="" />
      </svg>

      <span className="wdk-way__mark" aria-hidden>
        <svg viewBox="0 0 78 78">
          <circle cx="39" cy="39" r="39" />
          <path d="M39 4a35 35 0 1 0 0 70 35 35 0 0 0 0-70Zm0 2a33 33 0 1 1 0 66 33 33 0 0 1 0-66Z" />
          <path d="M27 26c-2 0-3.6 2.6-3.6 5.8S25 37.6 27 37.6s3.6-2.6 3.6-5.8S29 26 27 26Zm24 0c-2 0-3.6 2.6-3.6 5.8s1.6 5.8 3.6 5.8 3.6-2.6 3.6-5.8S53 26 51 26ZM61 41a.5.5 0 0 0-1 0 21 21 0 0 1-42 0 .5.5 0 0 0-1 0 22 22 0 0 0 44 0Z" />
        </svg>
      </span>

      <div className="wdk-way__catcher">
        <div className="wdk-way__distorted-wrapper">
          <div className="wdk-way__distorted">
            <div className="wdk-way__text wdk-way__text--distorted">{headline}</div>
          </div>
        </div>

        <div className="wdk-way__normal-wrapper">
          <div className="wdk-way__normal">
            <div className="wdk-way__text wdk-way__text--normal">{headline}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
