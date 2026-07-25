/**
 * Shared runtime for the kinetic portfolio, mirroring the structure of
 * AntoineW/AW-2025-Portfolio `src/utils/{Emitter,Ticker}.js` and the viewport /
 * intersection plumbing in its `src/pages/index.astro`.
 *
 * Every section subscribes to one gsap-driven tick and one shared event bus
 * rather than running its own rAF loop, which is what keeps the scroll
 * choreography of the reference in step across sections.
 */
import { gsap } from "gsap";

type Handler = { cb: (...args: any[]) => void; context: unknown; once: boolean };

class Emitter {
  private events: Record<string, Handler[]> = {};

  on(name: string, callback: (...args: any[]) => void, context?: unknown, once = false) {
    if (!this.events[name]) this.events[name] = [];

    const exists = this.events[name].some(
      (object) => object.cb === callback && object.context === context,
    );
    if (exists) return;

    this.events[name].push({ cb: callback, context, once });
  }

  once(name: string, callback: (...args: any[]) => void, context?: unknown) {
    this.on(name, callback, context, true);
  }

  emit(name: string, ...data: any[]) {
    const handlers = this.events[name];
    if (!handlers) return;

    // Snapshot: handlers may unsubscribe themselves mid-emit.
    [...handlers].forEach((object) => {
      object.cb.apply(object.context, data);
      if (object.once) this.off(name, object.cb, object.context);
    });
  }

  off(name: string, callback: (...args: any[]) => void, context?: unknown) {
    const handlers = this.events[name];
    if (!handlers) return;

    this.events[name] = handlers.filter(
      (object) => !(object.cb === callback && object.context === context),
    );
  }
}

export const emitter = new Emitter();

class Ticker {
  private callbacks: Array<{ callback: () => void; context: unknown }> = [];
  private started = false;
  private handler: ((time: number, delta: number) => void) | null = null;

  delta = 0;

  init() {
    if (this.started) return;
    this.started = true;

    this.handler = (time: number, delta: number) => {
      this.delta = delta;

      const pending = this.callbacks;
      this.callbacks = [];
      pending.forEach((object) => object.callback.apply(object.context));

      emitter.emit("tick", time * 1000);
    };

    gsap.ticker.add(this.handler);
  }

  destroy() {
    if (this.handler) gsap.ticker.remove(this.handler);
    this.handler = null;
    this.started = false;
    this.callbacks = [];
  }

  nextTick(callback: () => void, context?: unknown) {
    this.callbacks.push({ callback, context });
  }
}

export const ticker = new Ticker();

/** Mirrors the reference's `window.safeWidth/safeHeight/maxScrollTop/scrollProgress`. */
export type Viewport = {
  width: number;
  height: number;
  maxScrollTop: number;
  scrollProgress: number;
};

export const viewport: Viewport = {
  width: 0,
  height: 0,
  maxScrollTop: 0,
  scrollProgress: 0,
};

function setScrollProgress() {
  viewport.scrollProgress = viewport.maxScrollTop > 0 ? window.scrollY / viewport.maxScrollTop : 0;
}

/**
 * Boots the shared listeners. Returns a teardown; safe to call once per mount
 * of the template (StrictMode double-invokes effects in dev).
 */
export function startRuntime() {
  let resizeThrottle: number | undefined;
  let lastWidth: number | undefined;
  let lastHeight: number | undefined;

  const onResize = () => {
    const newWidth = window.innerWidth;
    const widthChanged = lastWidth !== undefined && lastWidth !== newWidth;
    lastWidth = newWidth;

    const newHeight = window.innerHeight;
    const heightChanged = lastHeight !== undefined && lastHeight !== newHeight;
    lastHeight = newHeight;

    viewport.width = newWidth;
    viewport.height = newHeight;
    viewport.maxScrollTop = document.body.scrollHeight - newHeight;

    setScrollProgress();

    emitter.emit("resize", widthChanged, heightChanged);
  };

  const onResizeThrottled = () => {
    window.clearTimeout(resizeThrottle);
    resizeThrottle = window.setTimeout(() => ticker.nextTick(onResize), 200);
  };

  const onScroll = () => {
    setScrollProgress();
    ticker.nextTick(() => emitter.emit("scroll", window.scrollY));
  };

  const onMouseMove = (event: MouseEvent) => {
    emitter.emit("mousemove", event.clientX, event.clientY);
  };

  window.addEventListener("resize", onResizeThrottled);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("mousemove", onMouseMove, { passive: true });
  emitter.on("updateViewport", onResize, undefined, true);

  ticker.init();
  onResize();
  onScroll();

  return () => {
    window.clearTimeout(resizeThrottle);
    window.removeEventListener("resize", onResizeThrottled);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("mousemove", onMouseMove);
    emitter.off("updateViewport", onResize);
    ticker.destroy();
  };
}

/**
 * The reference tags `[data-intersect]` elements with is-in-view /
 * is-out-of-view-top / is-out-of-view-bottom and fires an `intersect` event on
 * them; sections key their reveal and their paused state off those.
 */
export function observeIntersections(root: HTMLElement) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        entry.target.dispatchEvent(
          new CustomEvent("intersect", { detail: { isIntersecting: entry.isIntersecting } }),
        );

        if (entry.isIntersecting) {
          entry.target.classList.add("is-in-view");
          entry.target.classList.remove("is-out-of-view", "is-out-of-view-top", "is-out-of-view-bottom");
        } else {
          entry.target.classList.remove("is-in-view");
          entry.target.classList.add("is-out-of-view");
          entry.target.classList.toggle("is-out-of-view-top", entry.boundingClientRect.top < 0);
          entry.target.classList.toggle("is-out-of-view-bottom", entry.boundingClientRect.top > 0);
        }
      });
    },
    { threshold: 0 },
  );

  root.querySelectorAll("[data-intersect]").forEach((el) => observer.observe(el));

  return () => observer.disconnect();
}

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
