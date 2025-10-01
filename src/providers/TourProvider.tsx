import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { JoyrideAdapter } from './JoyrideAdapter';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useProfileSettings } from '../hooks/useProfileSettings';

type CoachMark = {
  id: string;               // unique id within page
  selector?: string;        // CSS selector (lazy queried)
  element?: HTMLElement | null; // direct element reference (optional)
  title: string;
  body: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  next?: string;            // id of next mark (for branching later)
  page?: string;            // logical page id (overview, application, etc.)
};

interface TourContextValue {
  activeId: string | null;
  start: (page: string) => void;
  next: () => void;
  back: () => void;
  skip: () => void;
  register: (mark: Omit<CoachMark, 'element'>) => void;
  page: string | null;
  isRunning: boolean;
}

const TourContext = createContext<TourContextValue | null>(null);

export const useProductTour = () => {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useProductTour must be used within <TourProvider />');
  return ctx;
};

// Internal registry keyed by page -> ordered marks
interface RegistryEntry extends CoachMark { }

export const TourProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();
  const logicalPage = useMemo(() => {
    const seg = pathname.split('/')[2] || 'overview';
    return seg.toLowerCase();
  }, [pathname]);
  const registry = useRef<Map<string, RegistryEntry[]>>(new Map());
  const [page, setPage] = useState<string | null>(null);
  const [order, setOrder] = useState<RegistryEntry[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [isRunning, setIsRunning] = useState(false);
  const { profile, completeWalkthrough } = useProfileSettings();

  const walkthroughFlagForPage = (p: string) => `walkthrough_${p}` as const;
  const isPageCompleted = (p: string) => (profile as any)?.[walkthroughFlagForPage(p)] === true;

  // Re-evaluate when page changes: auto-start if user is new & not completed & onboarding complete
  useEffect(() => {
    if (!profile) return;
    if ((profile as any).onboarding_complete && !isPageCompleted(logicalPage)) {
      // Delay a bit to allow page content to mount elements
      setTimeout(() => {
        start(logicalPage);
      }, 400);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logicalPage, (profile as any)?.onboarding_complete]);

  const register = useCallback((mark: Omit<CoachMark, 'element'>) => {
    const list = registry.current.get(mark.page || '*') || [];
    // de-dupe by id
    if (!list.find(m => m.id === mark.id)) {
      list.push({ ...mark, element: null });
      registry.current.set(mark.page || '*', list);
    }
  }, []);

  const resolveElements = useCallback((marks: RegistryEntry[]) => {
    return marks.map(m => {
      let el: HTMLElement | null = m.element || null;
      if (!el && m.selector) {
        try {
          // Prefer data-tour selector exact match if user passed shorthand like application-search
          const direct = document.querySelector<HTMLElement>(m.selector.startsWith('[data-tour=') || m.selector.startsWith('.') || m.selector.startsWith('#') || m.selector.includes(' ')
            ? m.selector
            : `[data-tour="${m.selector}"]`);
          el = direct;
        } catch { el = null; }
      }
      return { ...m, element: el };
    });
  }, []);

  const start = useCallback((pageId: string) => {
    const list = registry.current.get(pageId) || registry.current.get('*') || [];
    const resolved = resolveElements(list).filter(m => !!m.title);
    if (!resolved.length) return;
    setPage(pageId);
    setOrder(resolved);
    setActiveIndex(0);
    setIsRunning(true);
  }, [resolveElements]);

  const next = useCallback(() => {
    setActiveIndex(idx => {
      const nextIdx = idx + 1;
      if (nextIdx >= order.length) {
        if (page) completeWalkthrough(walkthroughFlagForPage(page) as any);
        setIsRunning(false);
        setPage(null);
        return -1;
      }
      return nextIdx;
    });
  }, [order, page, completeWalkthrough]);

  const back = useCallback(() => {
    setActiveIndex(idx => {
      const prev = idx - 1;
      return prev < 0 ? 0 : prev;
    });
  }, []);

  const skip = useCallback(() => {
    if (page) completeWalkthrough(walkthroughFlagForPage(page) as any);
    setIsRunning(false);
    setPage(null);
    setActiveIndex(-1);
  }, [page, completeWalkthrough]);

  const active = activeIndex >= 0 ? order[activeIndex] : null;

  // Auto-scroll into view & re-measure when active changes
  useEffect(() => {
    if (!active || !isRunning) return;
    const el = active.element;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const fullyVisible = rect.top >= 64 && rect.bottom <= window.innerHeight - 32; // small padding
    if (!fullyVisible) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setTimeout(() => {
        // force reflow for overlay reposition
        setOrder(prev => prev.map(m => m.id === active.id ? { ...m, element: el } : m));
      }, 380);
    }
  }, [active?.id, isRunning]);

  const value = useMemo<TourContextValue>(() => ({
    activeId: active?.id || null,
    start,
    next,
    back,
    skip,
    register,
    page,
    isRunning,
  }), [active?.id, start, next, back, skip, register, page, isRunning]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {/* Legacy custom overlay (kept for highlight); JoyrideAdapter adds richer tooltip flow */}
      {active && isRunning && (
        <CoachMarkOverlay 
          mark={active} 
          onNext={next} 
          onBack={back}
          onSkip={skip} 
          index={activeIndex} 
          total={order.length} 
        />
      )}
      {/* Joyride overlay (auto-built from data-tour attributes) */}
      <JoyrideAdapter />
    </TourContext.Provider>
  );
};

// ---------------- Overlay Components -----------------

const CoachMarkOverlay: React.FC<{ mark: RegistryEntry; onNext: () => void; onBack: () => void; onSkip: () => void; index: number; total: number; }> = ({ mark, onNext, onBack, onSkip, index, total }) => {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{top: number; left: number; placement: string} | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = mark.element || (mark.selector ? document.querySelector(mark.selector) : null);
    if (el) setRect(el.getBoundingClientRect());
    const ro = new ResizeObserver(() => {
      if (!el) return;
      setRect(el.getBoundingClientRect());
    });
    if (el) ro.observe(el);
    return () => { try { ro.disconnect(); } catch {} };
  }, [mark]);

  // Inject pulse animation stylesheet once
  useEffect(() => {
    const id = '__tour_pulse_style';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = `@keyframes tourPulse { 0% { box-shadow: 0 0 0 0 rgba(29,255,0,0.55); } 70% { box-shadow: 0 0 0 12px rgba(29,255,0,0); } 100% { box-shadow: 0 0 0 0 rgba(29,255,0,0); } }`;
      document.head.appendChild(style);
    }
  }, []);

  // Compute tooltip position after render to know bubble size for collision handling
  useEffect(() => {
    if (!rect || !bubbleRef.current) return;
    const desired = mark.placement || 'bottom';
    const pad = 12;
    const bubble = bubbleRef.current.getBoundingClientRect();
  let placement: 'top' | 'bottom' | 'left' | 'right' | 'center' = (['top','bottom','left','right','center'].includes(desired) ? desired : 'bottom') as any;
    const vw = window.innerWidth; const vh = window.innerHeight;
    const r = rect;
    const scrollY = window.scrollY; const scrollX = window.scrollX;
    const compute = (pl: string) => {
      let t = r.bottom + pad; let l = r.left + r.width/2 - bubble.width/2; // bottom default
      if (pl === 'top') { t = r.top - bubble.height - pad; l = r.left + r.width/2 - bubble.width/2; }
      if (pl === 'left') { t = r.top + r.height/2 - bubble.height/2; l = r.left - bubble.width - pad; }
      if (pl === 'right') { t = r.top + r.height/2 - bubble.height/2; l = r.right + pad; }
      if (pl === 'center') { t = r.top + r.height + pad; l = r.left + r.width/2 - bubble.width/2; }
      return { t, l };
    };
    let { t, l } = compute(placement);
    // Flip logic if off-screen
    const fitsVertically = (t >= scrollY) && (t + bubble.height <= scrollY + vh);
    const fitsHorizontally = (l >= scrollX + 4) && (l + bubble.width <= scrollX + vw - 4);
    if (!fitsVertically || !fitsHorizontally) {
      const order: string[] = ['bottom','right','left','top'];
      for (const alt of order) {
        const { t: tt, l: ll } = compute(alt);
        if (tt >= scrollY && tt + bubble.height <= scrollY + vh && ll >= scrollX + 4 && ll + bubble.width <= scrollX + vw - 4) {
          placement = alt as any; t = tt; l = ll; break;
        }
      }
    }
    // clamp
    l = Math.max(scrollX + 4, Math.min(l, scrollX + vw - bubble.width - 4));
    setTooltipPos({ top: t + scrollY, left: l + scrollX, placement });
  }, [rect, mark.id, mark.placement]);

  const box = rect;
  const style: React.CSSProperties = box ? {
    position: 'fixed',
    top: box.top + window.scrollY,
    left: box.left + window.scrollX,
    width: box.width,
    height: box.height,
    pointerEvents: 'auto',
    zIndex: 9999,
  } : { display: 'none' };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); onNext(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); onBack(); }
      if (e.key === 'Escape') { e.preventDefault(); onSkip(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onNext, onBack, onSkip]);

  // focus first actionable on step change
  useEffect(() => {
    setTimeout(() => {
      const btn = bubbleRef.current?.querySelector('[data-tour-action]') as HTMLElement | null;
      btn?.focus();
    }, 10);
  }, [mark.id]);

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998] bg-black/55 backdrop-blur-sm" onClick={onSkip} aria-hidden="true" />
      {box && (
        <div 
          role="presentation"
          onClick={onNext}
          title="Click to continue"
          style={style} 
          className="rounded-lg ring-2 ring-[#1dff00] shadow-[0_0_0_4px_rgba(0,0,0,0.55)] transition-all animate-[tourPulse_2.4s_ease-in-out_infinite] cursor-pointer"
        />
      )}
      {/* Inline tooltip bubble */}
      {tooltipPos && (
        <div 
          ref={bubbleRef}
          role="dialog"
          aria-live="polite"
          className="fixed z-[10000] max-w-sm w-[min(360px,90vw)] rounded-2xl border border-[#1dff00]/30 bg-gradient-to-br from-[#132313] via-[#060a06] to-black p-5 shadow-[0_4px_28px_-4px_rgba(0,0,0,0.65),0_0_0_1px_rgba(29,255,0,0.25)] text-white focus:outline-none"
          style={{ top: tooltipPos.top, left: tooltipPos.left }}
        >
          {/* Arrow */}
          <span 
            aria-hidden="true"
            className="absolute block w-3 h-3 rotate-45 bg-[#132313] border border-[#1dff00]/30"
            style={{
              top: tooltipPos.placement === 'bottom' ? -6 : tooltipPos.placement === 'top' ? 'auto' : '50%',
              bottom: tooltipPos.placement === 'top' ? -6 : 'auto',
              left: tooltipPos.placement === 'left' ? 'auto' : tooltipPos.placement === 'right' ? -6 : '50%',
              right: tooltipPos.placement === 'left' ? -6 : 'auto',
              transform: tooltipPos.placement === 'left' || tooltipPos.placement === 'right' ? 'translateY(-50%) rotate(45deg)' : 'translateX(-50%) rotate(45deg)'
            }}
          />
          <div className="flex items-center gap-3 mb-2">
            <div className="h-7 w-7 rounded-lg bg-[#1dff00]/15 border border-[#1dff00]/30 flex items-center justify-center text-[#1dff00] text-[11px] font-bold">{index+1}</div>
            <h3 className="text-base font-semibold bg-gradient-to-r from-white to-[#1dff00] bg-clip-text text-transparent leading-snug">{mark.title}</h3>
            <button 
              onClick={onSkip} 
              className="ml-auto h-7 w-7 rounded-md bg-[#1dff00]/10 hover:bg-[#1dff00]/25 text-[#1dff00] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#1dff00]/60"
              aria-label="Skip tour"
            >×</button>
          </div>
          <p className="text-xs text-white/70 leading-relaxed mb-4">{mark.body}</p>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1" aria-hidden="true">
              {Array.from({ length: total }).map((_, i) => (
                <span key={i} className={`h-1.5 w-3 rounded-sm ${i <= index ? 'bg-[#1dff00]' : 'bg-[#1dff00]/25'}`} />
              ))}
            </div>
            <div className="flex gap-2">
              <button 
                data-tour-action
                onClick={onBack} 
                disabled={index === 0}
                className="px-3 py-1.5 rounded-md text-xs font-medium border border-[#1dff00]/30 text-[#1dff00]/80 disabled:opacity-30 hover:text-black hover:bg-[#1dff00] transition-all"
              >Back</button>
              <button 
                data-tour-action
                onClick={onNext} 
                className="px-3 py-1.5 rounded-md text-xs font-semibold bg-[#1dff00] text-black hover:brightness-110 transition-all"
              >{index+1 === total ? 'Finish' : 'Next'}</button>
            </div>
          </div>
          <div className="sr-only" aria-live="assertive">Step {index+1} of {total}. {mark.title}</div>
        </div>
      )}
    </>,
    document.body
  );
};

// ---------------- Helper Hook Component -----------------

interface UseRegisterCoachMarksArgs {
  page: string;
  marks: Omit<CoachMark, 'page'>[];
  auto?: boolean; // (future) auto start
}

export const useRegisterCoachMarks = ({ page, marks }: UseRegisterCoachMarksArgs) => {
  const { register } = useProductTour();
  useEffect(() => {
    marks.forEach(m => register({ ...m, page }));
  }, [marks, page, register]);
};
