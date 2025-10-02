import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { JoyrideAdapter } from './JoyrideAdapter';
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
  steps: RegistryEntry[]; // ordered steps with resolved elements
  activeIndex: number;
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
    // Resume persisted progress if available and valid
    const persistedRaw = localStorage.getItem(`tour_state:${pageId}`);
    let resumeIndex = 0;
    if (persistedRaw) {
      try {
        const parsed = JSON.parse(persistedRaw);
        if (typeof parsed.index === 'number' && parsed.index >= 0 && parsed.index < resolved.length) {
          resumeIndex = parsed.index;
        }
      } catch { /* ignore */ }
    }
    setActiveIndex(resumeIndex);
    setIsRunning(true);
  }, [resolveElements]);

  const next = useCallback(() => {
    setActiveIndex(idx => {
      const nextIdx = idx + 1;
      const current = order[idx];
      // Branching: if current has explicit next id, jump there
      if (current?.next) {
        const branchIndex = order.findIndex(m => m.id === current.next);
        if (branchIndex !== -1) return branchIndex;
      }
      if (nextIdx >= order.length) {
        if (page) completeWalkthrough(walkthroughFlagForPage(page) as any);
        // Analytics: completed
        try { window.dispatchEvent(new CustomEvent('tour:event', { detail: { type: 'completed', page } })); } catch {}
        localStorage.removeItem(`tour_state:${page}`);
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
    try { window.dispatchEvent(new CustomEvent('tour:event', { detail: { type: 'skipped', page } })); } catch {}
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

  // Persist active step progress
  useEffect(() => {
    if (!isRunning || !page || activeIndex < 0) return;
    try {
      localStorage.setItem(`tour_state:${page}`, JSON.stringify({ index: activeIndex, at: Date.now() }));
    } catch {}
  }, [isRunning, page, activeIndex]);

  // Analytics: step advance
  useEffect(() => {
    if (!isRunning || activeIndex < 0 || !page) return;
    const step = order[activeIndex];
    if (!step) return;
    try {
      window.dispatchEvent(new CustomEvent('tour:event', { detail: { type: 'step', page, id: step.id, index: activeIndex } }));
    } catch {}
  }, [isRunning, activeIndex, page, order]);

  const value = useMemo<TourContextValue>(() => ({
    activeId: active?.id || null,
    start,
    next,
    back,
    skip,
    register,
    page,
    isRunning,
    steps: order,
    activeIndex,
  }), [active?.id, start, next, back, skip, register, page, isRunning, order, activeIndex]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {/* Legacy overlay removed to avoid double blur & duplicate messaging; Joyride handles spotlight & tooltips */}
      {/* Joyride overlay (auto-built from data-tour attributes) */}
      <JoyrideAdapter />
      <FloatingTourMenu registry={registry} start={start} page={page} isRunning={isRunning} profile={profile} />
    </TourContext.Provider>
  );
};

// ---------------- Overlay Components -----------------


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

// Floating restart / tour selector menu
const pageLabels: Record<string, string> = {
  overview: 'Overview',
  application: 'Applications',
  analytics: 'Analytics',
  jobs: 'Jobs',
  resume: 'Resume',
  'cover-letter': 'Cover Letter',
  settings: 'Settings',
  notifications: 'Notifications',
  profile: 'Profile',
  chat: 'Chat'
};

const FloatingTourMenu: React.FC<{ registry: React.MutableRefObject<Map<string, any[]>>; start: (p: string) => void; page: string | null; isRunning: boolean; profile: any; }> = ({ registry, start, page, isRunning, profile }) => {
  const [open, setOpen] = useState(false);
  const pages = Array.from(registry.current.keys()).filter(k => k !== '*');
  // Determine completion via profile walkthrough flags
  const completion = (p: string) => (profile as any)?.[`walkthrough_${p}`] === true;
  return (
    <div className="fixed z-[12000] bottom-4 right-4 flex flex-col items-end gap-2">
      {open && (
        <div className="w-60 rounded-2xl border border-[#1dff00]/30 bg-[#0b150b]/95 backdrop-blur-md shadow-[0_0_0_1px_rgba(29,255,0,0.25),0_14px_32px_-8px_rgba(0,0,0,0.65)] p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold tracking-wide text-[#1dff00] uppercase">Guided Tours</span>
            <button onClick={() => setOpen(false)} className="text-[#1dff00]/70 hover:text-[#1dff00] text-xs">×</button>
          </div>
          <div className="max-h-64 overflow-auto pr-1 custom-scrollbar">
            {pages.map(p => (
              <button
                key={p}
                onClick={() => { start(p); setOpen(false); }}
                className={`w-full text-left px-2 py-1.5 rounded-md text-xs flex items-center justify-between group transition ${page === p && isRunning ? 'bg-[#1dff00]/15' : 'hover:bg-[#1dff00]/10'}`}
              >
                <span className="truncate text-white/80 group-hover:text-white">{pageLabels[p] || p}</span>
                {completion(p) ? (
                  <span className="text-[10px] text-[#1dff00] font-medium">Done</span>
                ) : (
                  <span className="text-[10px] text-[#1dff00]/60">Start</span>
                )}
              </button>
            ))}
            {pages.length === 0 && (
              <div className="text-[11px] text-white/40 italic py-4 text-center">No tours registered</div>
            )}
          </div>
          <div className="flex justify-end">
            <button onClick={() => setOpen(false)} className="text-[10px] px-2 py-1 rounded-md border border-[#1dff00]/30 text-[#1dff00]/70 hover:text-black hover:bg-[#1dff00] transition">Close</button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(o => !o)}
        className={`h-11 px-4 rounded-full font-semibold text-sm flex items-center gap-2 shadow-[0_0_0_1px_rgba(29,255,0,0.3),0_8px_18px_-6px_rgba(0,0,0,0.6)] transition-colors ${open ? 'bg-[#1dff00] text-black' : 'bg-[#0c170c] text-[#1dff00] hover:bg-[#132413]'}`}
        aria-expanded={open}
        aria-label="Open guided tour menu"
      >
        <span className="h-2 w-2 rounded-full bg-[#1dff00] animate-pulse" />
        {open ? 'Close Tours' : 'Guided Tours'}
      </button>
    </div>
  );
};
