"use client";
import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';

export interface CalendarEvent {
  id: string;
  date: Date; // event (end) date
  title: string;
  subtitle?: string; // secondary label (e.g. company)
  status?: string; // used for color-coding
}

export interface CalendarProps {
  month?: Date; // first day of month to display
  selectedDate?: Date | null;
  onMonthChange?: (date: Date) => void;
  onSelectDate?: (date: Date) => void;
  showHeader?: boolean;
  className?: string;
  highlightToday?: boolean;
  weekStartsOn?: 0 | 1; // 0=Sunday 1=Monday
  locale?: string;
  events?: CalendarEvent[];
  maxVisibleEventsPerDay?: number;
  rangeSelectable?: boolean;
  onSelectRange?: (range: { start: Date; end: Date } | null) => void;
  viewMode?: 'month' | 'week';
  onViewModeChange?: (mode: 'month' | 'week') => void;
  showDayEventCount?: boolean;
  heatmap?: boolean; // color intensity based on event density
  showLegend?: boolean;
}

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }

export const KiboCalendar: React.FC<CalendarProps> = ({
  month,
  selectedDate,
  onMonthChange,
  onSelectDate,
  showHeader = true,
  className = '',
  highlightToday = true,
  weekStartsOn = 0,
  locale,
  events = [],
  maxVisibleEventsPerDay = 3,
  rangeSelectable = false,
  onSelectRange,
  viewMode = 'month',
  onViewModeChange,
  showDayEventCount = true,
  heatmap = false,
  showLegend = false,
}) => {
  const today = new Date();
  const viewMonth = startOfMonth(month || today);
  const usedLocale = locale || (typeof navigator !== 'undefined' ? navigator.language : undefined);

  // Range selection state
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [dragging, setDragging] = useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Load persisted range on mount (internal only; outer component may also persist)
  React.useEffect(() => {
    if (!rangeSelectable) return;
    try {
      const raw = localStorage.getItem('calendar_last_range');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.start && parsed.end) {
        const s = new Date(parsed.start);
        const e = new Date(parsed.end);
        setRangeStart(s);
        setRangeEnd(e);
        onSelectRange?.({ start: s < e ? s : e, end: e > s ? e : s });
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mouse up listener for drag selection
  React.useEffect(() => {
    if (!rangeSelectable) return;
    const up = () => setDragging(false);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, [rangeSelectable]);

  const grid = useMemo(() => {
    if (viewMode === 'week' && selectedDate) {
      const base = selectedDate;
      const weekday = (base.getDay() - weekStartsOn + 7) % 7;
      const start = new Date(base);
      start.setDate(base.getDate() - weekday);
      const cells: { date: Date; inCurrent: boolean }[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        cells.push({ date: d, inCurrent: d.getMonth() === viewMonth.getMonth() });
      }
      return cells;
    }
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const startDayRaw = first.getDay();
    const offset = (startDayRaw - weekStartsOn + 7) % 7;
    const cells: { date: Date; inCurrent: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const dayNum = i - offset + 1;
      const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), dayNum);
      cells.push({ date: d, inCurrent: d.getMonth() === viewMonth.getMonth() });
    }
    return cells;
  }, [viewMonth, weekStartsOn, viewMode, selectedDate]);

  const monthLabel = viewMonth.toLocaleString(usedLocale, { month: 'long', year: 'numeric' });
  const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  // Map events by day key
  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach(ev => {
      const key = ev.date.toISOString().slice(0,10); // YYYY-MM-DD
      (map[key] ||= []).push(ev);
    });
    // sort events per day by status then title
    Object.values(map).forEach(list => list.sort((a,b) => (a.status||'').localeCompare(b.status||'') || a.title.localeCompare(b.title)));
    return map;
  }, [events]);

  const heatmapMax = useMemo(() => {
    if (!heatmap) return 0;
    let m = 0;
    Object.values(eventsByDay).forEach(list => { if (list.length > m) m = list.length; });
    return m;
  }, [eventsByDay, heatmap]);

  const statusColor = (status?: string) => {
    if (!status) return '#565656';
    switch (status.toLowerCase()) {
      case 'pending': return '#9ca3af';
      case 'applied': return '#1dff00';
      case 'interview': return '#34d5ff';
      case 'offer': return '#ffe066';
      case 'rejected': return '#ff5f56';
      case 'withdrawn': return '#bbb';
      default: return '#7c7c7c';
    }
  };

  const inSelectedRange = (d: Date) => {
    if (!rangeStart || !rangeEnd) return false;
    const s = rangeStart < rangeEnd ? rangeStart : rangeEnd;
    const e = rangeEnd > rangeStart ? rangeEnd : rangeStart;
    return d >= new Date(s.getFullYear(), s.getMonth(), s.getDate()) && d <= new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23,59,59,999);
  };

  const handleDayClick = (date: Date) => {
    onSelectDate?.(date);
    if (!rangeSelectable) return;
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(date);
      setRangeEnd(null);
      onSelectRange?.(null);
    } else if (!rangeEnd) {
      setRangeEnd(date);
      const s = rangeStart < date ? rangeStart : date;
      const e = rangeStart < date ? date : rangeStart;
      onSelectRange?.({ start: s, end: e });
    }
  };

  const beginDrag = (date: Date) => {
    if (!rangeSelectable) return;
    setRangeStart(date);
    setRangeEnd(date);
    setDragging(true);
    onSelectRange?.(null);
  };
  const dragOver = (date: Date) => {
    if (!dragging || !rangeSelectable || !rangeStart) return;
    setRangeEnd(date);
    const s = rangeStart < date ? rangeStart : date;
    const e = rangeStart < date ? date : rangeStart;
    onSelectRange?.({ start: s, end: e });
    try { localStorage.setItem('calendar_last_range', JSON.stringify({ start: s, end: e })); } catch {}
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (!rangeSelectable) return;
    if (!e.shiftKey) return; // only act with Shift for safety
    const deltas: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(e.key in deltas)) return;
    e.preventDefault();
    const base = rangeEnd || rangeStart || selectedDate || today;
    if (!base) return;
    const next = new Date(base);
    next.setDate(next.getDate() + deltas[e.key]);
    if (!rangeStart) {
      setRangeStart(base);
    }
    setRangeEnd(next);
    const s = (rangeStart || base) < next ? (rangeStart || base) : next;
    const eDate = (rangeStart || base) < next ? next : (rangeStart || base);
    onSelectRange?.({ start: s, end: eDate });
    try { localStorage.setItem('calendar_last_range', JSON.stringify({ start: s, end: eDate })); } catch {}
  };

  return (
    <div
      ref={containerRef}
      tabIndex={rangeSelectable ? 0 : -1}
      onKeyDown={handleKey}
      className={"w-full outline-none focus-visible:ring-2 ring-[#1dff00]/40 rounded " + className}
      aria-label="Calendar"
      aria-describedby={rangeSelectable ? 'calendar-range-hint' : undefined}
    >
      {showHeader && (
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => onMonthChange?.(addMonths(viewMonth, -1))}
            className="text-[#1dff00] hover:bg-[#1dff00]/10 hover:scale-110 p-2 rounded transition"
          >
            ←
          </button>
          <h3 className="text-sm sm:text-base font-semibold text-white select-none">{monthLabel}</h3>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onMonthChange?.(startOfMonth(new Date()))}
              className="text-white/90 hover:text-[#1dff00] text-xs px-2 py-1 rounded border border-white/10 hover:border-[#1dff00]/40 transition"
            >
              Today
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => onMonthChange?.(addMonths(viewMonth, 1))}
              className="text-[#1dff00] hover:bg-[#1dff00]/10 hover:scale-110 p-2 rounded transition"
            >
              →
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange?.(viewMode === 'month' ? 'week' : 'month')}
              className="ml-1 text-xs px-2 py-1 rounded border border-white/10 hover:border-[#1dff00]/40 text-white/80 hover:text-[#1dff00] transition"
            >
              {viewMode === 'month' ? 'Week' : 'Month'}
            </button>
          </div>
        </div>
      )}
      {showLegend && (
        <div className="flex flex-wrap gap-2 mb-3 text-[10px] sm:text-xs">
          {['Pending','Applied','Interview','Offer','Rejected','Withdrawn'].map(s => (
            <span
              key={s}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] text-white/60 shadow-sm hover:border-[#1dff00]/30 hover:text-white/80 transition"
            >
              <span
                style={{ background: statusColor(s), boxShadow: `0 0 0 2px #000, 0 0 4px ${statusColor(s)}55`, width:8, height:8 }}
                className="inline-block rounded-full"
              /> {s}
            </span>
          ))}
          {heatmap && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-[#1dff00]/30 bg-[#1dff00]/5 text-[#1dff00]/80 shadow-sm">
              <span className="w-2 h-2 rounded-sm bg-[#1dff00] animate-pulse" /> Density
            </span>
          )}
        </div>
      )}

      {/* Week header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {(() => {
          // Localized weekday narrow labels (Mon .. Sun) respecting weekStartsOn
          const base = [] as string[];
          for (let i=0;i<7;i++) {
            const ref = new Date(2021, 7, i+1); // arbitrary week
            const lbl = new Intl.DateTimeFormat(usedLocale, { weekday: 'narrow' }).format(ref);
            base.push(lbl);
          }
          const ordered = base.slice(weekStartsOn).concat(base.slice(0, weekStartsOn));
          return ordered.map(d => <div key={d} className="text-center text-[10px] sm:text-xs text-[#666] font-medium py-1 select-none">{d}</div>);
        })()}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-1">
        {grid.map((cell, idx) => {
          const isToday = highlightToday && isSameDay(cell.date, today);
          const isSelected = selectedDate && isSameDay(cell.date, selectedDate);
          const dayKey = cell.date.toISOString().slice(0,10);
          const dayEvents = eventsByDay[dayKey] || [];
          const extra = dayEvents.length - maxVisibleEventsPerDay;
          const isWeekend = [0,6].includes(cell.date.getDay());
          let heatmapStyle: React.CSSProperties = {};
          if (heatmap && dayEvents.length > 0 && !isToday) {
            const ratio = heatmapMax ? Math.min(1, dayEvents.length / heatmapMax) : 0;
            const alpha = 0.05 + ratio * 0.35; // up to 40% tint
            heatmapStyle.background = (isSelected ? 'linear-gradient(135deg, rgba(29,255,0,'+alpha+'), rgba(29,255,0,'+ (alpha*0.6)+'))' : 'rgba(29,255,0,'+alpha+')');
          }
          return (
            <motion.button
              key={cell.date.toISOString()+idx}
              type="button"
              onClick={() => handleDayClick(cell.date)}
              onMouseDown={() => beginDrag(cell.date)}
              onMouseEnter={() => dragOver(cell.date)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.94 }}
              className={[
                'relative text-left px-1.5 pt-1.5 pb-1 rounded-xl transition-all duration-150 flex flex-col gap-0.5 min-h-[64px] sm:min-h-[76px] group shadow-inner',
                'focus:outline-none focus-visible:ring-2 ring-[#1dff00]/60',
                cell.inCurrent ? 'cursor-pointer' : 'cursor-pointer opacity-40',
                isWeekend && !isToday ? 'bg-[#1dff00]/[0.04]' : '',
                isToday ? 'bg-gradient-to-br from-[#1dff00] to-[#15c944] text-black font-bold shadow-lg ring-1 ring-[#1dff00]/60' : '',
                !isToday && cell.inCurrent ? 'text-[#e5e5e5] hover:bg-[#1dff00]/10 hover:text-[#1dff00]' : '',
                !cell.inCurrent && !isToday ? 'text-[#565656] hover:bg-[#1dff00]/10' : '',
                isSelected && !isToday ? 'border border-[#1dff00]/70 shadow-lg shadow-[#1dff00]/10' : 'border border-white/5',
                inSelectedRange(cell.date) && !isToday ? 'bg-gradient-to-br from-[#1dff00]/15 to-[#1dff00]/5 backdrop-blur-sm' : ''
              ].join(' ')}
              style={heatmapStyle}
            >
              <div className='flex items-center justify-between w-full'>
                <div className='text-[10px] sm:text-xs leading-none mb-0.5 font-medium tracking-wide'>{cell.date.getDate()}</div>
                {showDayEventCount && dayEvents.length > 0 && (
                  <span className='text-[9px] px-1 rounded-md bg-[#1dff00]/15 text-[#1dff00] font-semibold shadow-sm'>{dayEvents.length}</span>
                )}
              </div>
              <div className="flex-1 w-full overflow-hidden flex flex-col">
                {dayEvents.slice(0, maxVisibleEventsPerDay).map(ev => (
                  <div
                    key={ev.id}
                    title={ev.subtitle ? ev.title + ' — ' + ev.subtitle : ev.title}
                    className="relative group truncate rounded-md px-1.5 py-[2px] text-[9px] sm:text-[10px] font-medium mb-[3px] last:mb-0 flex items-center gap-1 border"
                    style={{
                      background: 'linear-gradient(135deg,'+statusColor(ev.status)+'22, '+statusColor(ev.status)+'10)',
                      color: statusColor(ev.status),
                      borderColor: statusColor(ev.status)+'55'
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor(ev.status) }} />
                    {ev.title}
                    <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute z-30 left-0 top-full mt-1 min-w-[160px] max-w-[220px] p-2 rounded-md border border-[#1dff00]/30 bg-[#050505]/95 backdrop-blur-sm text-[10px] leading-snug text-white shadow-2xl">
                      <div className="font-semibold text-[#1dff00] mb-0.5 truncate">{ev.title}</div>
                      {ev.subtitle && <div className="text-white/70 truncate">{ev.subtitle}</div>}
                      {ev.status && <div className="mt-0.5 text-[9px] uppercase tracking-wide" style={{ color: statusColor(ev.status) }}>{ev.status}</div>}
                      <div className="mt-0.5 text-[9px] text-white/50">{cell.date.toLocaleDateString(usedLocale)}</div>
                    </div>
                  </div>
                ))}
                {extra > 0 && (
                  <div className="mt-auto text-[9px] sm:text-[10px] text-[#1dff00] font-semibold italic opacity-80">+{extra} more</div>
                )}
              </div>
              {/* subtle focus / hover outline overlay */}
              <div className="pointer-events-none absolute inset-0 rounded-xl ring-0 group-hover:ring-1 group-hover:ring-[#1dff00]/40 transition" />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default KiboCalendar;
