import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
        // complete
        if (page) completeWalkthrough(walkthroughFlagForPage(page) as any);
        setIsRunning(false);
        setPage(null);
        return -1;
      }
      return nextIdx;
    });
  }, [order, page, completeWalkthrough]);

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
    skip,
    register,
    page,
    isRunning,
  }), [active?.id, start, next, skip, register, page, isRunning]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {active && isRunning && <CoachMarkOverlay mark={active} onNext={next} onSkip={skip} index={activeIndex} total={order.length} />}
    </TourContext.Provider>
  );
};

// ---------------- Overlay Components -----------------

const CoachMarkOverlay: React.FC<{ mark: RegistryEntry; onNext: () => void; onSkip: () => void; index: number; total: number; }> = ({ mark, onNext, onSkip, index, total }) => {
  const [rect, setRect] = useState<DOMRect | null>(null);
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

  const box = rect;
  const style: React.CSSProperties = box ? {
    position: 'fixed',
    top: box.top + window.scrollY,
    left: box.left + window.scrollX,
    width: box.width,
    height: box.height,
    pointerEvents: 'none',
    zIndex: 9999,
  } : { display: 'none' };

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm" />
      {box && (
        <div style={style} className="rounded-lg ring-2 ring-[#1dff00] shadow-[0_0_0_4px_rgba(0,0,0,0.6)] transition-all animate-[tourPulse_2.4s_ease-in-out_infinite]" />
      )}
      <div className="fixed z-[10000] inset-x-0 bottom-6 flex justify-center px-4">
        <div className="max-w-xl w-full rounded-2xl border border-[#1dff00]/30 bg-gradient-to-br from-[#102210] via-[#060a06] to-black p-6 shadow-[0_0_0_1px_rgba(29,255,0,0.25),0_20px_40px_-10px_rgba(0,0,0,0.7)] text-white relative">
          <div className="absolute -top-2 -right-2">
            <button onClick={onSkip} className="h-8 w-8 rounded-full bg-[#1dff00]/10 hover:bg-[#1dff00]/20 text-[#1dff00] text-sm font-semibold shadow-inner">×</button>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-[#1dff00]/15 border border-[#1dff00]/30 flex items-center justify-center text-[#1dff00] text-xs font-bold">{index+1}</div>
              <h3 className="text-lg font-semibold bg-gradient-to-r from-white to-[#1dff00] bg-clip-text text-transparent">{mark.title}</h3>
            </div>
            <p className="text-sm text-white/70 leading-relaxed">{mark.body}</p>
            <div className="flex items-center justify-between pt-2">
              <div className="text-[11px] text-white/40 tracking-wide uppercase">Step {index+1} of {total}</div>
              <div className="flex gap-2">
                <button onClick={onNext} className="px-4 py-2 rounded-md bg-[#1dff00] text-black text-sm font-medium hover:brightness-110">{index+1 === total ? 'Finish' : 'Next'}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
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
