"use client";
import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';

export interface CalendarEvent {
  id: string;
  date: Date; // event (end) date
  title: string;
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
}) => {
  const today = new Date();
  const viewMonth = startOfMonth(month || today);
  const usedLocale = locale || (typeof navigator !== 'undefined' ? navigator.language : undefined);

  // Range selection state
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);

  const grid = useMemo(() => {
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
  }, [viewMonth, weekStartsOn]);

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

  const statusColor = (status?: string) => {
    if (!status) return '#444';
    switch (status.toLowerCase()) {
      case 'pending': return '#888888';
      case 'applied': return '#1dff00';
      case 'interview': return '#00bcd4';
      case 'offer': return '#ffd700';
      case 'rejected': return '#ff4d4d';
      case 'withdrawn': return '#aaaaaa';
      default: return '#6c6c6c';
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

  return (
    <div className={"w-full " + className}>
      {showHeader && (
        <div className="flex items-center justify-between mb-3">
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
          </div>
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
          return (
            <motion.button
              key={cell.date.toISOString()+idx}
              type="button"
              onClick={() => handleDayClick(cell.date)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.94 }}
              className={[
                'relative text-left px-1 pt-1 pb-1 rounded-lg transition-all duration-150 flex flex-col gap-0.5 min-h-[60px] sm:min-h-[72px]',
                'focus:outline-none focus-visible:ring-2 ring-[#1dff00]/60',
                cell.inCurrent ? 'cursor-pointer' : 'cursor-pointer opacity-40',
                isToday ? 'bg-[#1dff00] text-black font-bold shadow-lg' : '',
                !isToday && cell.inCurrent ? 'text-[#ccc] hover:bg-[#1dff00]/10 hover:text-[#1dff00]' : '',
                !cell.inCurrent && !isToday ? 'text-[#444] hover:bg-[#1dff00]/10' : '',
                isSelected && !isToday ? 'border border-[#1dff00]/60' : 'border border-transparent',
                inSelectedRange(cell.date) ? 'bg-[#1dff00]/15' : ''
              ].join(' ')}
            >
              <div className={['text-[10px] sm:text-xs leading-none mb-0.5', isToday ? 'text-black' : ''].join(' ')}>
                {cell.date.getDate()}
              </div>
              <div className="flex-1 w-full overflow-hidden flex flex-col">
                {dayEvents.slice(0, maxVisibleEventsPerDay).map(ev => (
                  <div
                    key={ev.id}
                    title={ev.title}
                    className="truncate rounded px-1 py-[1px] text-[9px] sm:text-[10px] font-medium mb-[2px] last:mb-0"
                    style={{
                      background: statusColor(ev.status) + '20',
                      color: statusColor(ev.status),
                      border: '1px solid ' + statusColor(ev.status) + '55'
                    }}
                  >
                    {ev.title}
                  </div>
                ))}
                {extra > 0 && (
                  <div className="mt-auto text-[9px] sm:text-[10px] text-[#1dff00] font-semibold">+{extra} more</div>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default KiboCalendar;
