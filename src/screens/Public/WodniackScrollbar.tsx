import { useEffect, useRef } from "react";
import { emitter, viewport } from "./WodniackRuntime";
import "./WodniackScrollbar.css";

/**
 * Custom scrollbar ported from AntoineW/AW-2025-Portfolio
 * `src/components/SiteScrollbar.astro`: a draggable thumb riding inside the
 * 1rem page frame, sized by viewport/document ratio and positioned by scroll
 * progress. The native bar is hidden so the frame reads as the scroll track.
 */
export function WodniackScrollbar() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const thumb = thumbRef.current;
    if (!root || !thumb) return;

    const drag = { startY: 0, startScroll: 0 };
    let isDragging = false;

    const setScrollbar = () => {
      const height = (viewport.height / document.body.scrollHeight) * viewport.height;
      const top = viewport.scrollProgress * (viewport.height - height);

      root.style.setProperty("--scrollbar-height", `${height}px`);
      root.style.setProperty("--scrollbar-top", `${top}px`);
    };

    const onDragStart = (event: MouseEvent | TouchEvent) => {
      isDragging = true;
      drag.startY = event instanceof MouseEvent ? event.clientY : event.touches[0].clientY;
      drag.startScroll = viewport.scrollProgress;

      root.classList.add("is-dragging");
      event.preventDefault();
    };

    const onDragMove = (event: MouseEvent | TouchEvent) => {
      if (!isDragging) return;

      const dragY = event instanceof MouseEvent ? event.clientY : event.touches?.[0]?.clientY;
      if (dragY === undefined) return;

      const dragProgress = (dragY - drag.startY) / viewport.height;
      window.scrollTo(0, (drag.startScroll + dragProgress) * viewport.maxScrollTop);

      event.preventDefault();
    };

    const onDragEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      root.classList.remove("is-dragging");
    };

    emitter.on("resize", setScrollbar);
    emitter.on("scroll", setScrollbar);
    emitter.on("updateViewport", setScrollbar);

    thumb.addEventListener("mousedown", onDragStart, { passive: false });
    thumb.addEventListener("touchstart", onDragStart, { passive: false });
    document.addEventListener("mousemove", onDragMove, { passive: false });
    document.addEventListener("touchmove", onDragMove, { passive: false });
    document.addEventListener("mouseup", onDragEnd);
    document.addEventListener("touchend", onDragEnd);

    setScrollbar();

    return () => {
      emitter.off("resize", setScrollbar);
      emitter.off("scroll", setScrollbar);
      emitter.off("updateViewport", setScrollbar);

      thumb.removeEventListener("mousedown", onDragStart);
      thumb.removeEventListener("touchstart", onDragStart);
      document.removeEventListener("mousemove", onDragMove);
      document.removeEventListener("touchmove", onDragMove);
      document.removeEventListener("mouseup", onDragEnd);
      document.removeEventListener("touchend", onDragEnd);
    };
  }, []);

  return (
    <div className="wdk-scrollbar" ref={rootRef}>
      <div className="wdk-scrollbar__track" />
      <div className="wdk-scrollbar__thumb" ref={thumbRef} />
    </div>
  );
}
