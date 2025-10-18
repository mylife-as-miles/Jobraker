"use client";
import React, { useMemo, useState, useCallback, useEffect } from 'react';
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
  // New enhancement props
  densityMode?: 'full' | 'compact';
  onDensityModeChange?: (mode: 'full' | 'compact') => void;
  enableQuickCreate?: boolean;
  onQuickCreate?: (partial: { date: Date; title: string }) => void;
  allowDrag?: boolean;
  onReschedule?: (eventId: string, newDate: Date) => void;
  statusFilters?: string[]; // if provided, only these statuses (case-insensitive) shown
  onStatusFiltersChange?: (statuses: string[]) => void;
  enableAnalyticsRibbon?: boolean;
  enableICSExport?: boolean;
  focusContrast?: boolean; // dims low-activity days
  onFocusContrastChange?: (v: boolean) => void;
  reducedMotion?: boolean;
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
  densityMode = 'full',
  onDensityModeChange,
  enableQuickCreate = false,
  onQuickCreate,
  allowDrag = false,
  onReschedule,
  statusFilters,
  onStatusFiltersChange,
  enableAnalyticsRibbon = true,
  enableICSExport = true,
  focusContrast = false,
  onFocusContrastChange,
  reducedMotion,
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

  const prefersReduced = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);
  const motionDisabled = reducedMotion ?? prefersReduced;

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
  const visibleEvents = useMemo(() => {
    if (!statusFilters || statusFilters.length === 0) return events;
    const set = new Set(statusFilters.map(s => s.toLowerCase()));
    return events.filter(ev => !ev.status || set.has(ev.status.toLowerCase()));
  }, [events, statusFilters]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    visibleEvents.forEach(ev => {
      const key = ev.date.toISOString().slice(0,10); // YYYY-MM-DD
      (map[key] ||= []).push(ev);
    });
    // sort events per day by status then title
    Object.values(map).forEach(list => list.sort((a,b) => (a.status||'').localeCompare(b.status||'') || a.title.localeCompare(b.title)));
    return map;
  }, [visibleEvents]);

  const heatmapMax = useMemo(() => {
    if (!heatmap) return 0;
    let m = 0;
    Object.values(eventsByDay).forEach(list => { if (list.length > m) m = list.length; });
    return m;
  }, [eventsByDay, heatmap]);

  const statusColor = (status?: string) => {
    if (!status) return '#5a5a5a';
    const pal: Record<string,string> = {
      pending: '#8b8b8b',
      applied: '#1dff00',
      interview: '#56c2ff',
      offer: '#f8d74a',
      rejected: '#ff5f56',
      withdrawn: '#b3b3b3'
    };
    return pal[status.toLowerCase()] || '#7c7c7c';
  };

  // Overflow expansion per day
  const [expandedDays, setExpandedDays] = useState<Set<string>>(()=>new Set());
  const toggleExpanded = (k: string) => setExpandedDays(prev => { const n = new Set(prev); n.has(k)?n.delete(k):n.add(k); return n; });

  // Quick create inline mini-form
  const [quickCreate, setQuickCreate] = useState<{ key: string; date: Date; title: string } | null>(null);
  const handleQuickCreateSubmit = () => {
    if (quickCreate && quickCreate.title.trim()) {
      onQuickCreate?.({ date: quickCreate.date, title: quickCreate.title.trim() });
      setQuickCreate(null);
    }
  };

  // Drag/drop reschedule
  const [draggingEvent, setDraggingEvent] = useState<CalendarEvent | null>(null);
  const handleDragStart = (e: React.DragEvent, ev: CalendarEvent) => {
    if (!allowDrag) return;
    setDraggingEvent(ev);
    try { e.dataTransfer.setData('text/plain', ev.id); } catch {}
  };
  const handleDrop = (e: React.DragEvent, date: Date) => {
    if (!allowDrag || !draggingEvent) return;
    e.preventDefault();
    onReschedule?.(draggingEvent.id, date);
    setDraggingEvent(null);
  };
  const handleDragOver = (e: React.DragEvent) => { if (allowDrag) e.preventDefault(); };

  // Range analytics
  const analytics = useMemo(() => {
    if (!rangeStart || !rangeEnd) return null;
    const s = rangeStart < rangeEnd ? rangeStart : rangeEnd;
    const e = rangeEnd > rangeStart ? rangeEnd : rangeStart;
    const counts: Record<string, number> = {};
    let total = 0;
    visibleEvents.forEach(ev => {
      if (ev.date >= s && ev.date <= e) {
        const st = (ev.status || 'unknown').toLowerCase();
        counts[st] = (counts[st] || 0) + 1;
        total++;
      }
    });
    const applied = (counts['applied'] || 0) + (counts['pending'] || 0);
    const interview = counts['interview'] || 0;
    const offer = counts['offer'] || 0;
    const rejection = counts['rejected'] || 0;
    return {
      total,
      counts,
      funnel: {
        applied,
        interview,
        offer,
        rejection,
        appliedToInterview: applied ? interview / applied : 0,
        interviewToOffer: interview ? offer / interview : 0,
        appliedToOffer: applied ? offer / applied : 0,
      }
    };
  }, [rangeStart, rangeEnd, visibleEvents]);

  // ICS export
  const exportICS = useCallback(() => {
    if (!enableICSExport) return;
    const escape = (s: string) => s.replace(/,/g,'\\,').replace(/;/g,'\\;');
    const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Jobraker//Calendar//EN'];
    const target = (() => {
      if (rangeStart && rangeEnd) {
        const s = rangeStart < rangeEnd ? rangeStart : rangeEnd;
        const e = rangeEnd > rangeStart ? rangeEnd : rangeStart;
        return visibleEvents.filter(ev => ev.date >= s && ev.date <= e);
      }
      return visibleEvents.filter(ev => ev.date.getMonth()===viewMonth.getMonth() && ev.date.getFullYear()===viewMonth.getFullYear());
    })();
    target.forEach(ev => {
      const dt = ev.date.toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z';
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${ev.id}@jobraker`);
      lines.push(`DTSTAMP:${dt}`);
      lines.push(`DTSTART:${dt}`);
      lines.push(`DTEND:${dt}`);
      lines.push(`SUMMARY:${escape(ev.title)}`);
      if (ev.subtitle) lines.push(`DESCRIPTION:${escape(ev.subtitle)}`);
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calendar${rangeStart && rangeEnd ? '-range':'-month'}.ics`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }, [enableICSExport, rangeStart, rangeEnd, visibleEvents, viewMonth]);

  // UI prefs persistence
  useEffect(() => {
    try { localStorage.setItem('calendar_ui_prefs', JSON.stringify({ densityMode, focusContrast })); } catch {}
  }, [densityMode, focusContrast]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('calendar_ui_prefs');
      if (!raw) return; const p = JSON.parse(raw);
      if (p.densityMode && ['full','compact'].includes(p.densityMode)) onDensityModeChange?.(p.densityMode);
      if (typeof p.focusContrast === 'boolean') onFocusContrastChange?.(p.focusContrast);
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => onMonthChange?.(addMonths(viewMonth, -1))}
              className="text-[#1dff00] hover:bg-[#1dff00]/10 hover:scale-110 p-2 rounded transition"
            >
              ←
            </button>
            <div className="flex flex-col items-center min-w-[140px]">
              <h3 className="text-sm sm:text-base font-semibold text-white select-none leading-tight">{monthLabel}</h3>
              <div className="mt-1 flex items-center gap-1 opacity-70 text-[9px]">
                <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">{addMonths(viewMonth,-1).toLocaleString(undefined,{month:'short'})}</span>
                <span className="px-1.5 py-0.5 rounded bg-[#1dff00]/10 border border-[#1dff00]/30 text-[#1dff00]">{viewMonth.toLocaleString(undefined,{month:'short'})}</span>
                <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">{addMonths(viewMonth,1).toLocaleString(undefined,{month:'short'})}</span>
              </div>
            </div>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => onMonthChange?.(addMonths(viewMonth, 1))}
              className="text-[#1dff00] hover:bg-[#1dff00]/10 hover:scale-110 p-2 rounded transition"
            >
              →
            </button>
          </div>
          <div className="flex items-center justify-end flex-wrap gap-1">
            <button
              type="button"
              onClick={() => onMonthChange?.(startOfMonth(new Date()))}
              className="text-white/90 hover:text-[#1dff00] text-xs px-2 py-1 rounded border border-white/10 hover:border-[#1dff00]/40 transition"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange?.(viewMode === 'month' ? 'week' : 'month')}
              className="text-xs px-2 py-1 rounded border border-white/10 hover:border-[#1dff00]/40 text-white/80 hover:text-[#1dff00] transition"
            >
              {viewMode === 'month' ? 'Week' : 'Month'}
            </button>
            <button
              type="button"
              onClick={() => onDensityModeChange?.(densityMode==='full'?'compact':'full')}
              className="text-xs px-2 py-1 rounded border border-white/10 hover:border-[#1dff00]/40 text-white/70 hover:text-[#1dff00] transition"
            >{densityMode==='full'?'Compact':'Full'}</button>
            <button
              type="button"
              onClick={() => onFocusContrastChange?.(!focusContrast)}
              className={"text-xs px-2 py-1 rounded border transition "+(focusContrast?"bg-[#1dff00]/15 border-[#1dff00]/40 text-[#1dff00]":"border-white/10 text-white/60 hover:text-[#1dff00] hover:border-[#1dff00]/40")}
            >Contrast</button>
            {enableICSExport && (
              <button
                type="button"
                onClick={exportICS}
                className="text-xs px-2 py-1 rounded border border-white/10 hover:border-[#1dff00]/40 text-white/60 hover:text-[#1dff00] transition"
              >Export</button>
            )}
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

      {/* Status Filters */}
      {onStatusFiltersChange && (
        <div className="flex flex-wrap gap-1 mb-2 text-[10px] sm:text-[11px]">
          {['Pending','Applied','Interview','Offer','Rejected','Withdrawn'].map(s => {
            const active = !statusFilters || statusFilters.length===0 || statusFilters.includes(s);
            return (
              <button key={s} type="button"
                onClick={() => {
                  let next: string[] = [];
                  if (!statusFilters || statusFilters.length===0) {
                    next = ['Pending','Applied','Interview','Offer','Rejected','Withdrawn'].filter(x=>x!==s);
                  } else {
                    next = active ? statusFilters.filter(x=>x!==s) : [...statusFilters, s];
                  }
                  onStatusFiltersChange(next);
                }}
                className={"px-2 py-0.5 rounded border text-xs transition "+(active?"bg-[#1dff00]/15 border-[#1dff00]/40 text-[#1dff00]":"border-white/10 text-white/40 hover:text-white/70 hover:border-white/30")}
              >{s}</button>
            );
          })}
          <button type="button" onClick={()=>onStatusFiltersChange([])} className="px-2 py-0.5 rounded border text-xs border-white/10 text-white/50 hover:text-[#1dff00] hover:border-[#1dff00]/40 transition">Reset</button>
        </div>
      )}

      {enableAnalyticsRibbon && analytics && (
        <div className="mb-2 rounded-lg border border-[#1dff00]/20 bg-gradient-to-r from-[#1dff00]/10 via-transparent to-[#1dff00]/10 px-3 py-2 flex flex-wrap items-center gap-3 text-[10px] sm:text-[11px]">
          <span className="text-white/70">Range:</span>
          <span className="text-[#1dff00] font-semibold">{analytics.total}</span>
          <span className="text-white/60">Applied+Pending {analytics.funnel.applied}</span>
          <span className="text-[#56c2ff]">Interview {analytics.funnel.interview}</span>
            <span className="text-[#f8d74a]">Offer {analytics.funnel.offer}</span>
            <span className="text-[#ff5f56]">Rejected {analytics.funnel.rejection}</span>
          <span className="text-white/50 ml-auto flex items-center gap-2">
            <span>A→I {(analytics.funnel.appliedToInterview*100).toFixed(0)}%</span>
            <span>I→O {(analytics.funnel.interviewToOffer*100).toFixed(0)}%</span>
            <span>A→O {(analytics.funnel.appliedToOffer*100).toFixed(0)}%</span>
          </span>
        </div>
      )}

      {/* Days */}
      <div className="grid grid-cols-7 gap-1">
        {grid.map((cell, idx) => {
          const isToday = highlightToday && isSameDay(cell.date, today);
          const isSelected = selectedDate && isSameDay(cell.date, selectedDate);
          const dayKey = cell.date.toISOString().slice(0,10);
          const dayEvents = eventsByDay[dayKey] || [];
          const expanded = expandedDays.has(dayKey);
          const limit = expanded ? dayEvents.length : maxVisibleEventsPerDay;
          const extra = dayEvents.length - limit;
          const isWeekend = [0,6].includes(cell.date.getDay());
          let heatmapStyle: React.CSSProperties = {};
          if (heatmap && dayEvents.length > 0 && !isToday) {
            const ratio = heatmapMax ? Math.min(1, dayEvents.length / heatmapMax) : 0;
            const alpha = 0.05 + ratio * 0.45;
            const base = focusContrast && ratio < 0.2 ? '0,0,0' : '29,255,0';
            heatmapStyle.background = (isSelected ? 'linear-gradient(135deg, rgba('+base+','+alpha+'), rgba('+base+','+(alpha*0.5)+'))' : 'rgba('+base+','+alpha+')');
          }
          return (
            <motion.button
              key={cell.date.toISOString()+idx}
              type="button"
              onClick={() => handleDayClick(cell.date)}
              onMouseDown={() => beginDrag(cell.date)}
              onMouseEnter={() => dragOver(cell.date)}
              onDrop={(e)=>handleDrop(e, cell.date)}
              onDragOver={handleDragOver}
              onDoubleClick={() => { if (enableQuickCreate) setQuickCreate({ key: dayKey, date: cell.date, title: '' }); }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.94 }}
              className={[
                'relative text-left p-2 rounded-xl transition-all duration-150 flex flex-col gap-1 min-h-[72px] sm:min-h-[84px] group shadow-inner',
                'focus:outline-none focus-visible:ring-2 ring-[#1dff00]/60',
                cell.inCurrent ? 'cursor-pointer' : 'cursor-pointer opacity-40',
                isWeekend && !isToday ? 'bg-[#1dff00]/[0.04]' : '',
                isToday ? 'bg-gradient-to-br from-[#1dff00] to-[#15c944] text-black font-bold shadow-lg ring-1 ring-[#1dff00]/60' : '',
                !isToday && cell.inCurrent ? 'text-[#e5e5e5] hover:bg-[#1dff00]/10 hover:text-[#1dff00]' : '',
                !cell.inCurrent && !isToday ? 'text-[#565656] hover:bg-[#1dff00]/10' : '',
                isSelected && !isToday ? 'border border-[#1dff00]/70 shadow-lg shadow-[#1dff00]/10' : 'border border-white/5',
                inSelectedRange(cell.date) && !isToday ? 'bg-gradient-to-br from-[#1dff00]/15 to-[#1dff00]/5 backdrop-blur-sm' : '',
                focusContrast && dayEvents.length===0 && !isToday ? 'opacity-30 hover:opacity-60' : ''
              ].join(' ')}
              style={heatmapStyle}
            >
              <div className='flex items-center justify-between w-full'>
                <div className='text-xs sm:text-sm leading-none mb-0.5 font-medium tracking-wide'>{cell.date.getDate()}</div>
                {showDayEventCount && dayEvents.length > 0 && (
                  <span className='text-[10px] px-1.5 rounded-md bg-[#1dff00]/15 text-[#1dff00] font-semibold shadow-sm'>{dayEvents.length}</span>
                )}
              </div>
              <div className="flex-1 w-full overflow-hidden flex flex-col">
                {densityMode==='compact' && dayEvents.length>0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {dayEvents.slice(0, limit).map(ev => (
                      <span key={ev.id} title={ev.title} draggable={allowDrag} onDragStart={(e)=>handleDragStart(e,ev)} className="w-2.5 h-2.5 rounded-full border border-black/40 shadow" style={{ background: statusColor(ev.status) }} />
                    ))}
                    {extra>0 && !expanded && (
                      <button type="button" onClick={()=>toggleExpanded(dayKey)} className="text-[10px] px-1.5 rounded bg-white/5 text-white/60 hover:text-[#1dff00]">+{extra}</button>
                    )}
                  </div>
                )}
                {densityMode==='full' && dayEvents.slice(0, limit).map(ev => (
                  <div key={ev.id} draggable={allowDrag} onDragStart={(e)=>handleDragStart(e,ev)}
                       title={ev.subtitle ? ev.title + ' — ' + ev.subtitle : ev.title}
                       className={"relative group truncate rounded-md px-2 py-1 text-xs sm:text-sm font-medium mb-1 last:mb-0 flex items-center gap-1.5 border "+(motionDisabled?'':'transition-all hover:scale-[1.02]')}
                       style={{
                         background: 'linear-gradient(135deg,'+statusColor(ev.status)+'30, '+statusColor(ev.status)+'10)',
                         color: statusColor(ev.status),
                         borderColor: statusColor(ev.status)+'55',
                         boxShadow: (ev.status||'').toLowerCase()==='offer' ? '0 0 0 1px #f8d74a55,0 0 6px #f8d74a55' : (ev.status||'').toLowerCase()==='rejected' ? '0 0 0 1px #ff5f5655,0 0 6px #ff5f5644' : 'none'
                       }}>
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
                {extra>0 && densityMode==='full' && !expanded && (
                  <button type="button" onClick={()=>toggleExpanded(dayKey)} className="mt-auto text-[9px] sm:text-[10px] text-[#1dff00] font-semibold italic opacity-80 hover:underline">+{extra} more</button>
                )}
                {expanded && extra>0 && (
                  <button type="button" onClick={()=>toggleExpanded(dayKey)} className="mt-auto text-[9px] sm:text-[10px] text-white/50 hover:text-[#ff5f56]">Collapse</button>
                )}
                {quickCreate && quickCreate.key===dayKey && (
                  <div className="mt-1 p-1.5 rounded-md border border-[#1dff00]/30 bg-black/60 flex items-center gap-1">
                    <input autoFocus value={quickCreate.title} onChange={e=>setQuickCreate({...quickCreate,title:e.target.value})}
                      onKeyDown={e=>{ if (e.key==='Enter'){ handleQuickCreateSubmit(); } else if (e.key==='Escape'){ setQuickCreate(null);} }}
                      placeholder="New event title" className="bg-transparent text-[10px] flex-1 outline-none placeholder-white/30" />
                    <button type="button" onClick={handleQuickCreateSubmit} className="text-[10px] px-1 py-0.5 rounded bg-[#1dff00]/20 text-[#1dff00] hover:bg-[#1dff00]/30">Add</button>
                  </div>
                )}
              </div>
              {/* subtle focus / hover outline overlay */}
              <div className="pointer-events-none absolute inset-0 rounded-xl ring-0 group-hover:ring-1 group-hover:ring-[#1dff00]/40 transition" />
            </motion.button>
          );
        })}
      </div>
      {enableQuickCreate && !quickCreate && (
        <div className="mt-1 text-[10px] text-white/30">Double-click a day to quick add.</div>
      )}
    </div>
  );
};

export default KiboCalendar;
