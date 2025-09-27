import * as React from 'react';

export interface GanttItem {
  id: string;
  label: string;
  start: Date; // inclusive
  end: Date;   // exclusive-ish (visual end)
  status?: string;
  extra?: React.ReactNode;
  groupKey?: string; // optional grouping bucket
  raw?: any; // original record for advanced tooltips
}

interface GanttProps {
  items: GanttItem[];
  className?: string;
  dayWidth?: number; // fixed px per day (overrides zoom tiers)
  height?: number; // row height
  renderLabel?: (item: GanttItem) => React.ReactNode;
  renderBarContent?: (item: GanttItem) => React.ReactNode;
  showToday?: boolean;
  zoom?: number; // 0..4 discrete tiers
  onZoomChange?: (z: number) => void;
  groupBy?: (item: GanttItem) => string | undefined | null;
  dateRange?: { start: Date; end: Date }; // explicit range override
  onBarClick?: (item: GanttItem, evt: React.MouseEvent) => void;
}

// Lightweight, dependency-free Gantt renderer (horizontal timeline bars)
export const Gantt: React.FC<GanttProps> = ({
  items,
  className = '',
  dayWidth,
  height = 46,
  renderLabel,
  renderBarContent,
  showToday = true,
  zoom: controlledZoom,
  onZoomChange,
  groupBy,
  dateRange,
  onBarClick,
}) => {
  const [uncontrolledZoom, setUncontrolledZoom] = React.useState(1); // default mid tier
  const zoom = controlledZoom ?? uncontrolledZoom;
  const setZoom = (z: number) => {
    const clamped = Math.min(4, Math.max(0, z));
    if (onZoomChange) onZoomChange(clamped); else setUncontrolledZoom(clamped);
  };

  const valid = items.filter(i => i.start instanceof Date && !isNaN(i.start.getTime()) && i.end instanceof Date && !isNaN(i.end.getTime()) && i.end >= i.start);

  // Derive timeline boundaries only if we have data
  let min: Date | null = null;
  let max: Date | null = null;
  if (valid.length) {
    min = dateRange?.start ?? valid.reduce((a,i)=> i.start < a ? i.start : a, valid[0].start);
    max = dateRange?.end ?? valid.reduce((a,i)=> i.end > a ? i.end : a, valid[0].end);
    if (min.getTime() === max.getTime()) {
      max = new Date(min.getTime() + 24*3600*1000);
    }
  }

  const totalDays = min && max ? Math.max(1, Math.ceil((max.getTime() - min.getTime()) / (24*3600*1000))) : 1;
  const tierWidths = [10, 18, 28, 42, 64]; // increasingly wider per day
  const autoDayWidth = dayWidth ?? tierWidths[zoom] ?? 28;
  const timelineWidth = totalDays * autoDayWidth;

  const gridDays: Date[] = [];
  if (min) {
    for (let d = 0; d <= totalDays; d++) gridDays.push(new Date(min.getTime() + d*24*3600*1000));
  }

  const percent = (date: Date) => {
    if (!min || !max) return 0;
    return (date.getTime() - min.getTime()) / (max.getTime() - min.getTime());
  };

  // Grouping
  const groups = React.useMemo(() => {
    if (!groupBy) return [{ key: '_all', label: 'All', rows: valid }];
    const map = new Map<string, GanttItem[]>();
    for (const it of valid) {
      const k = groupBy(it) || 'Other';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    }
    return Array.from(map.entries()).map(([key, rows]) => ({ key, label: key, rows }));
  }, [valid, groupBy]);

  const todayPercent = showToday && min && max ? percent(new Date()) : null;
  const showTodayMarker = showToday && todayPercent != null && todayPercent >= 0 && todayPercent <= 1;

  return (
    <div className={"relative w-full overflow-auto rounded-lg border border-white/10 bg-white/[0.03] " + className} style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Header timeline scale + zoom controls */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-black/60 backdrop-blur-md">
        <div className="flex items-stretch">
          <div className="w-48 flex items-center gap-2 px-2 border-r border-white/10 text-[10px] text-white/50">
            <span>Timeline</span>
            <div className="ml-auto inline-flex items-center gap-1">
              <button aria-label="Zoom out" className="h-5 w-5 rounded bg-white/10 text-white/60 hover:text-white hover:bg-white/20 text-[10px]" onClick={() => setZoom(zoom-1)}>-</button>
              <span className="px-1 tabular-nums">{zoom}</span>
              <button aria-label="Zoom in" className="h-5 w-5 rounded bg-white/10 text-white/60 hover:text-white hover:bg-white/20 text-[10px]" onClick={() => setZoom(zoom+1)}>+</button>
            </div>
          </div>
          {min && max ? (
            <div className="relative" style={{ width: timelineWidth }}>
              <div className="flex text-[10px] font-medium text-white/50 select-none">
                {gridDays.map((d,i) => (
                  <div key={i} style={{ width: autoDayWidth }} className="py-1 text-center border-r border-white/5 last:border-r-0">
                    {d.toLocaleDateString(undefined,{ month:'short', day:'numeric' })}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center px-3 text-[11px] text-white/40">No data</div>
          )}
        </div>
      </div>
      <div className="relative" style={{ width: (min && max ? timelineWidth : 0) + 48 }}>
        <div className="absolute inset-y-0 left-48 w-px bg-white/10" />
        {/* vertical grid beyond label gutter */}
        {min && max && (
        <div className="absolute inset-y-0 left-48 right-0 pointer-events-none select-none">
          <div className="flex h-full w-full">
            {gridDays.map((_,i) => (
              <div key={i} style={{ width: autoDayWidth }} className="h-full border-r border-white/[0.05] last:border-r-0" />
            ))}
          </div>
          {showTodayMarker && (
            <div className="absolute top-0 bottom-0" style={{ left: `calc(${todayPercent!*100}% + 48px)` }}>
              <div className="h-full w-px bg-[#1dff00] shadow-[0_0_0_1px_rgba(29,255,0,0.4)]" />
              <div className="absolute -top-2 -translate-x-1/2 px-1 py-0.5 rounded bg-[#1dff00] text-black text-[9px] font-semibold">Today</div>
            </div>
          )}
        </div>
        )}
        <div className="relative">
          {valid.length === 0 && (
            <div className="p-4 text-xs text-white/50">No timeline data.</div>
          )}
          {valid.length > 0 && groups.map(g => (
            <div key={g.key} className="relative">
              {groups.length > 1 && (
                <div className="sticky left-0 z-10 w-48 bg-black/30 backdrop-blur-sm border-r border-white/10 py-1 px-2 text-[11px] font-medium text-white/70">
                  {g.label}
                </div>
              )}
              <div className={groups.length>1 ? 'pl-48' : ''}>
                <div className="relative divide-y divide-white/5">
                  {g.rows.map(item => {
                    const startP = percent(item.start);
                    const endP = percent(item.end);
                    const left = startP * 100;
                    const widthPct = Math.max(0.5, (endP - startP) * 100);
                    const color = statusColor(item.status);
                    const days = Math.max(1, Math.round((item.end.getTime() - item.start.getTime())/86400000));
                    return (
                      <div key={item.id} className="relative group/item" style={{ height }}>
                        <div className="absolute inset-y-0 left-0 flex items-center pl-2 pr-2 w-48 overflow-hidden">
                          <div className="truncate text-xs text-white/70">
                            {renderLabel ? renderLabel(item) : item.label}
                          </div>
                        </div>
                        <div className="absolute inset-y-0 left-48" style={{ right: 0 }}>
                          <div className="relative h-full">
                            <div
                              className="absolute group rounded-md overflow-hidden ring-1 ring-white/10 shadow-sm hover:ring-white/30 hover:shadow-lg transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1dff00]/50"
                              style={{ left: `calc(${left}% + 0px)`, width: widthPct + '%', top: height*0.2, height: height*0.6, background: color.bg }}
                              title={`${item.label}\n${item.start.toLocaleDateString()} → ${item.end.toLocaleDateString()} (${days}d)`}
                              aria-label={`Timeline for ${item.label}`}
                              tabIndex={0}
                              onClick={(e) => onBarClick?.(item, e)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onBarClick?.(item, e as any); } }}
                            >
                              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-white/5 transition" />
                              <div className="flex h-full w-full items-center px-2 text-[10px] font-medium tracking-wide" style={{ color: color.fg }}>
                                {renderBarContent ? renderBarContent(item) : (item.status || '')}
                              </div>
                              {/* Tooltip */}
                              <div className="absolute z-30 hidden group-hover:flex -top-2 left-1/2 -translate-y-full -translate-x-1/2 min-w-[180px] max-w-[260px] flex-col rounded-md border border-white/15 bg-black/80 backdrop-blur p-2 shadow-lg text-xs text-white/70">
                                <div className="font-medium text-white truncate mb-1">{item.label}</div>
                                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                                  <span className="text-white/40">Status</span><span>{item.status}</span>
                                  <span className="text-white/40">Start</span><span>{item.start.toLocaleDateString()}</span>
                                  <span className="text-white/40">End</span><span>{item.end.toLocaleDateString()}</span>
                                  <span className="text-white/40">Length</span><span>{days}d</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute top-0 left-0 w-48 h-full pointer-events-none bg-gradient-to-r from-black/50 to-transparent" />
    </div>
  );
};

function statusColor(status?: string): { bg: string; fg: string } {
  switch (status) {
    case 'Applied': return { bg: 'linear-gradient(90deg,#1dff00,#0a8246)', fg: '#041f11' };
    case 'Interview': return { bg: 'linear-gradient(90deg,#fbbf24,#a16207)', fg: '#2d1e04' };
    case 'Offer': return { bg: 'linear-gradient(90deg,#84cc16,#166534)', fg: '#0b1f0f' };
    case 'Rejected': return { bg: 'linear-gradient(90deg,#fb7185,#881337)', fg: '#2f070f' };
  case 'Withdrawn': return { bg: 'linear-gradient(90deg,#94a3b8,#334155)', fg: '#0f1822' };
    case 'Pending':
    default: return { bg: 'linear-gradient(90deg,#71717a,#27272a)', fg: '#111114' };
  }
}

export default Gantt;

/* -------------------------------------------------------------------------------------------------
 * Advanced (non-breaking) Gantt Design Primitives
 * -----------------------------------------------------------------------------------------------
 * These components implement an API similar to the example snippet the user provided
 * (GanttProvider, GanttSidebar, GanttFeatureItem, markers, etc.) while preserving the
 * existing lightweight <Gantt /> export used elsewhere. They are intentionally self‑contained
 * and do not alter the original Gantt logic above. The intent is to offer a richer, more
 * product‑roadmap style UI without forcing a migration.
 *
 * Notes:
 * - Minimal styling; tailwind utility classes only (consistent with existing design).
 * - Drag/move interaction is simplified to horizontal dragging of the bar; movement snaps
 *   to whole days. Resizing handles can be added later.
 * - Feature registration feeds the provider so the header scale auto-expands to encompass
 *   all registered items unless an explicit customRange is provided.
 * - Marker creation/removal callbacks are surfaced but state is left to the consumer (stateless markers).
 * - Types intentionally broad to accommodate evolving data model.
 */

// Region: Context & Provider
interface AdvancedGanttFeatureBase {
  id: string;
  name: string;
  startAt: Date;
  endAt: Date;
  status?: any;
  owner?: any;
  [k: string]: any; // flexible extension
}

interface GanttProviderProps {
  children: React.ReactNode;
  className?: string;
  /** A coarse range hint; monthly ~90d window, quarterly ~180d window. */
  range?: 'monthly' | 'quarterly' | 'custom';
  /** Explicit custom range override */
  customRange?: { start: Date; end: Date };
  zoom?: number; // percentage scaling base (initial)
  onZoomChange?: (z: number) => void;
  onAddItem?: (date: Date) => void;
  /** Fixed pixel width per day (overrides internal calc) */
  dayWidth?: number;
}

interface InternalFeatureRegistration {
  id: string;
  startAt: Date;
  endAt: Date;
}

interface AdvancedGanttContextValue {
  range: 'monthly' | 'quarterly' | 'custom';
  start: Date;
  end: Date;
  dayWidth: number;
  zoomPct: number; // raw zoom percent (e.g., 100)
  setZoomPct: (v: number) => void;
  percent: (d: Date) => number;
  registerFeature: (f: InternalFeatureRegistration) => void;
  unregisterFeature: (id: string) => void;
  onAddItem?: (date: Date) => void;
}

const AdvancedGanttContext = React.createContext<AdvancedGanttContextValue | null>(null);

export const GanttProvider: React.FC<GanttProviderProps> = ({
  children,
  className = '',
  range = 'monthly',
  customRange,
  zoom = 100,
  onZoomChange,
  onAddItem,
  dayWidth,
}) => {
  const [zoomPct, setZoomPctState] = React.useState(zoom);
  const setZoomPct = React.useCallback((v: number) => {
    const clamped = Math.min(400, Math.max(25, Math.round(v)));
    setZoomPctState(clamped);
    onZoomChange?.(clamped);
  }, [onZoomChange]);

  const featuresRef = React.useRef<Map<string, InternalFeatureRegistration>>(new Map());
  const [, force] = React.useReducer(x => x + 1, 0);

  const registerFeature = React.useCallback((f: InternalFeatureRegistration) => {
    const prev = featuresRef.current.get(f.id);
    if (!prev || prev.startAt.getTime() !== f.startAt.getTime() || prev.endAt.getTime() !== f.endAt.getTime()) {
      featuresRef.current.set(f.id, f);
      force();
    }
  }, []);
  const unregisterFeature = React.useCallback((id: string) => {
    if (featuresRef.current.delete(id)) force();
  }, []);

  // Derive dynamic range if not customRange
  const computedRange = React.useMemo(() => {
    if (customRange) return customRange;
    // If we have features, expand to min/max plus padding
    const feats = Array.from(featuresRef.current.values());
    if (feats.length) {
      let min = feats[0].startAt.getTime();
      let max = feats[0].endAt.getTime();
      for (const f of feats) {
        if (f.startAt.getTime() < min) min = f.startAt.getTime();
        if (f.endAt.getTime() > max) max = f.endAt.getTime();
      }
      const pad = 5 * 86400000; // 5 day padding each side
      return { start: new Date(min - pad), end: new Date(max + pad) };
    }
    // fallback windows
    const now = new Date();
    const startBase = new Date(now.getFullYear(), now.getMonth(), 1);
    const days = range === 'quarterly' ? 180 : 90;
    return { start: startBase, end: new Date(startBase.getTime() + days * 86400000) };
  }, [customRange, range, featuresRef.current.size]);

  // totalDays retained conceptually via container width calc; local variable removed to avoid unused warning.
  const effectiveDayWidth = dayWidth ?? Math.max(4, Math.round((zoomPct / 100) * 24));

  const percent = React.useCallback((d: Date) => {
    const { start, end } = computedRange;
    return (d.getTime() - start.getTime()) / (end.getTime() - start.getTime());
  }, [computedRange.start, computedRange.end]);

  const ctx: AdvancedGanttContextValue = React.useMemo(() => ({
    range,
    start: computedRange.start,
    end: computedRange.end,
    dayWidth: effectiveDayWidth,
    zoomPct,
    setZoomPct,
    percent,
    registerFeature,
    unregisterFeature,
    onAddItem,
  }), [range, computedRange.start, computedRange.end, effectiveDayWidth, zoomPct, percent, registerFeature, unregisterFeature, onAddItem]);

  return (
    <div className={"relative w-full bg-black/40 rounded-lg border border-white/10 overflow-hidden " + className}>
      <AdvancedGanttContext.Provider value={ctx}>{children}</AdvancedGanttContext.Provider>
    </div>
  );
};

function useAdvancedGantt() {
  const v = React.useContext(AdvancedGanttContext);
  if (!v) throw new Error('Gantt advanced primitives must be used inside <GanttProvider>');
  return v;
}

// Region: Layout primitives
export const GanttSidebar: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
  return (
    <div className={"absolute top-0 left-0 bottom-0 w-48 overflow-y-auto thin-scrollbar bg-black/30 backdrop-blur-sm border-r border-white/10 " + className}>
      {children}
    </div>
  );
};

export const GanttSidebarGroup: React.FC<{ name: string; children: React.ReactNode }> = ({ name, children }) => (
  <div className="border-b border-white/5 last:border-b-0">
    <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-white/40 font-medium">{name}</div>
    <div className="flex flex-col gap-0.5 px-1 pb-1">{children}</div>
  </div>
);

export const GanttSidebarItem: React.FC<{ feature: AdvancedGanttFeatureBase; onSelectItem?: (id: string) => void; className?: string }> = ({ feature, onSelectItem, className = '' }) => (
  <button
    type="button"
    onClick={() => onSelectItem?.(feature.id)}
    className={"text-left px-2 py-1 rounded-md text-xs bg-white/5 hover:bg-white/10 text-white/70 focus:outline-none focus:ring-1 focus:ring-white/30 transition " + className}
  >
    <span className="block truncate">{feature.name}</span>
  </button>
);

export const GanttTimeline: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
  const { start, end, dayWidth } = useAdvancedGantt();
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
  return (
    <div className={"relative ml-48 overflow-auto " + className} style={{ width: 'calc(100% - 12rem)' }}>
      <div className="relative" style={{ width: totalDays * dayWidth }}>
        {children}
      </div>
    </div>
  );
};

export const GanttHeader: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { start, end, dayWidth, zoomPct, setZoomPct } = useAdvancedGantt();
  const days: Date[] = [];
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
  for (let i = 0; i <= totalDays; i++) days.push(new Date(start.getTime() + i * 86400000));
  return (
    <div className={"sticky top-0 z-20 bg-black/60 backdrop-blur border-b border-white/10 " + className}>
      <div className="flex items-stretch select-none">
        <div className="w-full">
          <div className="flex h-7 text-[10px] font-medium text-white/50">
            {days.map((d, i) => (
              <div key={i} style={{ width: dayWidth }} className="flex items-center justify-center border-r border-white/5 last:border-r-0">
                {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="absolute top-1 right-2 flex items-center gap-1">
        <button aria-label="Zoom out" onClick={() => setZoomPct(zoomPct - 10)} className="h-5 w-5 text-[10px] rounded bg-white/10 hover:bg-white/20 text-white/70">-</button>
        <span className="px-1 tabular-nums text-[10px] text-white/60">{zoomPct}%</span>
        <button aria-label="Zoom in" onClick={() => setZoomPct(zoomPct + 10)} className="h-5 w-5 text-[10px] rounded bg-white/10 hover:bg-white/20 text-white/70">+</button>
      </div>
    </div>
  );
};

export const GanttFeatureList: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={"relative " + className}>{children}</div>
);

export const GanttFeatureListGroup: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={"relative border-b border-white/5 last:border-b-0 " + className}>{children}</div>
);

interface GanttFeatureItemProps extends AdvancedGanttFeatureBase {
  onMove?: (id: string, startAt: Date, endAt: Date | null) => void;
  className?: string;
  children?: React.ReactNode;
}

export const GanttFeatureItem: React.FC<GanttFeatureItemProps> = ({
  id,
  name,
  startAt,
  endAt,
  status,
  onMove,
  children,
  className = '',
  ...rest
}) => {
  const { percent, dayWidth, registerFeature, unregisterFeature } = useAdvancedGantt();
  const barRef = React.useRef<HTMLDivElement | null>(null);
  // Register feature for dynamic range calculation
  React.useEffect(() => {
    registerFeature({ id, startAt, endAt });
    return () => unregisterFeature(id);
  }, [id, startAt, endAt, registerFeature, unregisterFeature]);

  const startP = percent(startAt);
  const endP = percent(endAt);
  const left = startP * 100;
  const widthPct = Math.max(0.25, (endP - startP) * 100);
  const color = statusColor(typeof status === 'string' ? status : undefined);
  const days = Math.max(1, Math.round((endAt.getTime() - startAt.getTime()) / 86400000));

  // Drag logic (horizontal move only)
  React.useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    let dragging = false;
    let originX = 0;
    let origStart = startAt.getTime();
    let origEnd = endAt.getTime();
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      originX = e.clientX;
      origStart = startAt.getTime();
      origEnd = endAt.getTime();
      el.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - originX;
      const dayDelta = Math.round(dx / dayWidth);
      if (dayDelta !== 0) {
        const newStart = new Date(origStart + dayDelta * 86400000);
        const newEnd = new Date(origEnd + dayDelta * 86400000);
        onMove?.(id, newStart, newEnd);
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      if (dragging) {
        dragging = false;
        try { el.releasePointerCapture(e.pointerId); } catch {}
      }
    };
    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [id, startAt, endAt, dayWidth, onMove]);

  return (
    <div className={"relative h-8 " + className} {...rest}>
      <div
        ref={barRef}
        className="group absolute top-1/2 -translate-y-1/2 rounded-md ring-1 ring-white/10 hover:ring-white/30 hover:shadow-lg shadow-sm cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-[#1dff00]/60"
        style={{ left: `calc(${left}% + 0px)`, width: widthPct + '%', height: '60%', background: color.bg }}
        title={`${name}\n${startAt.toLocaleDateString()} → ${endAt.toLocaleDateString()} (${days}d)`}
        tabIndex={0}
      >
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-white/5 transition" />
        <div className="flex h-full w-full items-center px-2 text-[10px] font-medium tracking-wide" style={{ color: color.fg }}>
          {children ? children : (typeof status === 'string' ? status : '')}
        </div>
        <div className="absolute z-30 hidden group-hover:flex -top-2 left-1/2 -translate-y-full -translate-x-1/2 min-w-[180px] max-w-[240px] flex-col rounded-md border border-white/15 bg-black/80 backdrop-blur p-2 shadow-lg text-[10px] text-white/70">
          <div className="font-medium text-white truncate mb-1">{name}</div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            <span className="text-white/40">Start</span><span>{startAt.toLocaleDateString()}</span>
            <span className="text-white/40">End</span><span>{endAt.toLocaleDateString()}</span>
            <span className="text-white/40">Length</span><span>{days}d</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Region: Markers & utilities
export interface GanttMarkerProps {
  id: string;
  date: Date;
  label: string;
  className?: string;
  onRemove?: (id: string) => void;
}

export const GanttMarker: React.FC<GanttMarkerProps> = ({ id, date, label, onRemove, className = '' }) => {
  const { start, end, percent } = useAdvancedGantt();
  if (date < start || date > end) return null;
  const p = percent(date) * 100;
  return (
    <div className="absolute inset-y-0 pointer-events-none" style={{ left: p + '%' }}>
      <div className="relative h-full">
        <div className="absolute top-0 bottom-0 w-px bg-cyan-400/70" />
        <div className={"absolute -top-2 -translate-y-full -translate-x-1/2 flex items-center gap-1 rounded bg-cyan-400 text-black px-1.5 py-0.5 text-[9px] font-semibold pointer-events-auto " + className}>
          <span className="truncate max-w-[140px]">{label}</span>
          {onRemove && (
            <button onClick={() => onRemove(id)} className="text-black/70 hover:text-black" aria-label="Remove marker">×</button>
          )}
        </div>
      </div>
    </div>
  );
};

export const GanttToday: React.FC = () => {
  const { start, end, percent } = useAdvancedGantt();
  const today = new Date();
  if (today < start || today > end) return null;
  const p = percent(today) * 100;
  return (
    <div className="absolute inset-y-0 pointer-events-none" style={{ left: p + '%' }}>
      <div className="h-full w-px bg-[#1dff00] shadow-[0_0_0_1px_rgba(29,255,0,0.4)]" />
      <div className="absolute -top-2 -translate-y-full -translate-x-1/2 px-1 py-0.5 rounded bg-[#1dff00] text-black text-[9px] font-semibold">Today</div>
    </div>
  );
};

export const GanttCreateMarkerTrigger: React.FC<{ onCreateMarker?: (date: Date) => void }> = ({ onCreateMarker }) => {
  const { start, end } = useAdvancedGantt();
  const ref = React.useRef<HTMLDivElement | null>(null);
  const handleDbl = React.useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    const bounds = ref.current.getBoundingClientRect();
    const x = e.clientX - bounds.left; // relative
    const totalMs = end.getTime() - start.getTime();
    const totalW = bounds.width;
    const ratio = x / totalW;
    const date = new Date(start.getTime() + totalMs * ratio);
    // snap to day start
    date.setHours(0,0,0,0);
    onCreateMarker?.(date);
  }, [start, end, onCreateMarker]);
  return (
    <div ref={ref} className="absolute inset-0" onDoubleClick={handleDbl} aria-label="Double click to create marker" />
  );
};

// Convenience re-exports for naming parity in user example
export { GanttProvider as GanttContextProvider };

