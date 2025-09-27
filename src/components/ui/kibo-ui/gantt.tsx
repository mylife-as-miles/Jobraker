import * as React from 'react';

export interface GanttItem {
  id: string;
  label: string;
  start: Date;
  end: Date;
  status?: string;
  extra?: React.ReactNode;
}

interface GanttProps {
  items: GanttItem[];
  className?: string;
  dayWidth?: number; // px per day (adaptive if range large)
  height?: number; // row height
  renderLabel?: (item: GanttItem) => React.ReactNode;
  renderBarContent?: (item: GanttItem) => React.ReactNode;
}

// Lightweight, dependency-free Gantt renderer (horizontal timeline bars)
export const Gantt: React.FC<GanttProps> = ({
  items,
  className = '',
  dayWidth,
  height = 46,
  renderLabel,
  renderBarContent,
}) => {
  const valid = items.filter(i => i.start instanceof Date && !isNaN(i.start.getTime()) && i.end instanceof Date && !isNaN(i.end.getTime()));
  if (valid.length === 0) return <div className="text-xs text-white/50">No timeline data.</div>;
  let min = valid.reduce((a,i)=> i.start < a ? i.start : a, valid[0].start);
  let max = valid.reduce((a,i)=> i.end > a ? i.end : a, valid[0].end);
  if (min.getTime() === max.getTime()) {
    // Expand artificially by one day for visual width
    max = new Date(min.getTime() + 24*3600*1000);
  }
  const totalDays = Math.max(1, Math.round((max.getTime() - min.getTime()) / (24*3600*1000)));
  const autoDayWidth = (() => {
    if (dayWidth) return dayWidth;
    if (totalDays <= 14) return 48;
    if (totalDays <= 30) return 32;
    if (totalDays <= 60) return 24;
    if (totalDays <= 120) return 18;
    return 12;
  })();
  const timelineWidth = totalDays * autoDayWidth;

  const gridDays: Date[] = [];
  for (let d = 0; d <= totalDays; d++) {
    gridDays.push(new Date(min.getTime() + d*24*3600*1000));
  }

  const percent = (date: Date) => (date.getTime() - min.getTime()) / (max.getTime() - min.getTime());

  return (
    <div className={"relative w-full overflow-auto rounded-lg border border-white/10 bg-white/[0.03] " + className} style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className="sticky top-0 z-10 border-b border-white/10 bg-black/40 backdrop-blur-sm">
        <div className="relative" style={{ width: timelineWidth }}>
          <div className="flex text-[10px] font-medium text-white/50 select-none">
            {gridDays.map((d,i) => (
              <div key={i} style={{ width: autoDayWidth }} className="py-1 text-center border-r border-white/5 last:border-r-0">
                {d.toLocaleDateString(undefined,{ month:'short', day:'numeric' })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="relative" style={{ width: timelineWidth }}>
        {/* vertical grid */}
        <div className="absolute inset-0 pointer-events-none select-none">
          <div className="flex h-full w-full">
            {gridDays.map((_,i) => (
              <div key={i} style={{ width: autoDayWidth }} className="h-full border-r border-white/[0.04] last:border-r-0" />
            ))}
          </div>
        </div>
        <div className="relative divide-y divide-white/5">
          {valid.map(item => {
            const startP = percent(item.start);
            const endP = percent(item.end);
            const left = startP * 100;
            const width = Math.max(2, (endP - startP) * 100); // percent
            const color = statusColor(item.status);
            return (
              <div key={item.id} className="relative" style={{ height }}>
                <div className="absolute inset-y-0 left-0 flex items-center pl-2 pr-2 w-48 overflow-hidden">
                  <div className="truncate text-xs text-white/70">
                    {renderLabel ? renderLabel(item) : item.label}
                  </div>
                </div>
                <div className="absolute inset-y-0 left-48" style={{ right: 0 }}>
                  <div className="relative h-full">
                    <div
                      className="absolute group rounded-md overflow-hidden ring-1 ring-white/10 shadow-sm hover:ring-white/30 hover:shadow-md transition-all"
                      style={{ left: `calc(${left}% + 0px)`, width: width + '%', top: height*0.2, height: height*0.6, background: color.bg }}
                      title={`${item.label}\n${item.start.toLocaleDateString()} → ${item.end.toLocaleDateString()}`}
                      aria-label={`Timeline for ${item.label}`}
                    >
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-white/5 transition" />
                      <div className="flex h-full w-full items-center px-2 text-[10px] font-medium tracking-wide" style={{ color: color.fg }}>
                        {renderBarContent ? renderBarContent(item) : (item.status || '')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="absolute top-0 left-0 w-48 h-full pointer-events-none bg-gradient-to-r from-black/60 to-transparent" />
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
