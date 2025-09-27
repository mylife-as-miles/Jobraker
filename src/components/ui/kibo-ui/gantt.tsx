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
                              className="absolute group rounded-md overflow-hidden ring-1 ring-white/10 shadow-sm hover:ring-white/30 hover:shadow-lg transition-all cursor-default"
                              style={{ left: `calc(${left}% + 0px)`, width: widthPct + '%', top: height*0.2, height: height*0.6, background: color.bg }}
                              title={`${item.label}\n${item.start.toLocaleDateString()} → ${item.end.toLocaleDateString()} (${days}d)`}
                              aria-label={`Timeline for ${item.label}`}
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
