"use client";
import React, { useMemo, useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Layers3,
  ScanSearch,
} from "lucide-react";
import { APPLICATION_STATUS_OPTIONS } from "@/lib/applicationState";

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
  viewMode?: "month" | "week";
  onViewModeChange?: (mode: "month" | "week") => void;
  showDayEventCount?: boolean;
  heatmap?: boolean; // color intensity based on event density
  showLegend?: boolean;
  // New enhancement props
  densityMode?: "full" | "compact";
  onDensityModeChange?: (mode: "full" | "compact") => void;
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

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function toLocalDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const KiboCalendar: React.FC<CalendarProps> = ({
  month,
  selectedDate,
  onMonthChange,
  onSelectDate,
  showHeader = true,
  className = "",
  highlightToday = true,
  weekStartsOn = 0,
  locale,
  events = [],
  maxVisibleEventsPerDay = 3,
  rangeSelectable = false,
  onSelectRange,
  viewMode = "month",
  onViewModeChange,
  showDayEventCount = true,
  heatmap = false,
  showLegend = false,
  densityMode = "full",
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
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const effectiveDensityMode = isMobile ? "compact" : densityMode;
  const today = new Date();
  const viewMonth = startOfMonth(month || today);
  const usedLocale =
    locale ||
    (typeof navigator !== "undefined" ? navigator.language : undefined);

  // Range selection state
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [dragging, setDragging] = useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Load persisted range on mount (internal only; outer component may also persist)
  React.useEffect(() => {
    if (!rangeSelectable) return;
    try {
      const raw = localStorage.getItem("calendar_last_range");
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
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, [rangeSelectable]);

  const prefersReduced = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
  const motionDisabled = reducedMotion ?? prefersReduced;

  const grid = useMemo(() => {
    if (viewMode === "week" && selectedDate) {
      const base = selectedDate;
      const weekday = (base.getDay() - weekStartsOn + 7) % 7;
      const start = new Date(base);
      start.setDate(base.getDate() - weekday);
      const cells: { date: Date; inCurrent: boolean }[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        cells.push({
          date: d,
          inCurrent: d.getMonth() === viewMonth.getMonth(),
        });
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

  const monthLabel = viewMonth.toLocaleString(usedLocale, {
    month: "long",
    year: "numeric",
  });
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  // Map events by day key
  const visibleEvents = useMemo(() => {
    if (!statusFilters || statusFilters.length === 0) return events;
    const set = new Set(statusFilters.map((s) => s.toLowerCase()));
    return events.filter(
      (ev) => !ev.status || set.has(ev.status.toLowerCase()),
    );
  }, [events, statusFilters]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    visibleEvents.forEach((ev) => {
      const key = toLocalDayKey(ev.date); // YYYY-MM-DD
      (map[key] ||= []).push(ev);
    });
    // sort events per day by status then title
    Object.values(map).forEach((list) =>
      list.sort(
        (a, b) =>
          (a.status || "").localeCompare(b.status || "") ||
          a.title.localeCompare(b.title),
      ),
    );
    return map;
  }, [visibleEvents]);

  const heatmapMax = useMemo(() => {
    if (!heatmap) return 0;
    let m = 0;
    Object.values(eventsByDay).forEach((list) => {
      if (list.length > m) m = list.length;
    });
    return m;
  }, [eventsByDay, heatmap]);

  const statusColor = (status?: string) => {
    if (!status) return "#5a5a5a";
    const pal: Record<string, string> = {
      draft: "#2dd4bf",
      pending: "#8b8b8b",
      applied: "#1dff00",
      failed: "#f97316",
      terminated: "#e11d48",
      interview: "#56c2ff",
      offer: "#f8d74a",
      rejected: "#ef4444",
      withdrawn: "#b3b3b3",
    };
    return pal[status.toLowerCase()] || "#7c7c7c";
  };

  // Overflow expansion per day
  const [expandedDays, setExpandedDays] = useState<Set<string>>(
    () => new Set(),
  );
  const toggleExpanded = (k: string) =>
    setExpandedDays((prev) => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  // Quick create inline mini-form
  const [quickCreate, setQuickCreate] = useState<{
    key: string;
    date: Date;
    title: string;
  } | null>(null);
  const handleQuickCreateSubmit = () => {
    if (quickCreate && quickCreate.title.trim()) {
      onQuickCreate?.({
        date: quickCreate.date,
        title: quickCreate.title.trim(),
      });
      setQuickCreate(null);
    }
  };

  // Drag/drop reschedule
  const [draggingEvent, setDraggingEvent] = useState<CalendarEvent | null>(
    null,
  );
  const handleDragStart = (e: React.DragEvent, ev: CalendarEvent) => {
    if (!allowDrag) return;
    setDraggingEvent(ev);
    try {
      e.dataTransfer.setData("text/plain", ev.id);
    } catch {}
  };
  const handleDrop = (e: React.DragEvent, date: Date) => {
    if (!allowDrag || !draggingEvent) return;
    e.preventDefault();
    onReschedule?.(draggingEvent.id, date);
    setDraggingEvent(null);
  };
  const handleDragOver = (e: React.DragEvent) => {
    if (allowDrag) e.preventDefault();
  };

  // Range analytics
  const analytics = useMemo(() => {
    if (!rangeStart || !rangeEnd) return null;
    const s = rangeStart < rangeEnd ? rangeStart : rangeEnd;
    const e = rangeEnd > rangeStart ? rangeEnd : rangeStart;
    const counts: Record<string, number> = {};
    let total = 0;
    visibleEvents.forEach((ev) => {
      if (ev.date >= s && ev.date <= e) {
        const st = (ev.status || "unknown").toLowerCase();
        counts[st] = (counts[st] || 0) + 1;
        total++;
      }
    });
    const applied = (counts["applied"] || 0) + (counts["pending"] || 0);
    const interview = counts["interview"] || 0;
    const offer = counts["offer"] || 0;
    const rejection = counts["rejected"] || 0;
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
      },
    };
  }, [rangeStart, rangeEnd, visibleEvents]);

  // ICS export
  const exportICS = useCallback(() => {
    if (!enableICSExport) return;
    const escape = (s: string) => s.replace(/,/g, "\\,").replace(/;/g, "\\;");
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Jobraker//Calendar//EN",
    ];
    const target = (() => {
      if (rangeStart && rangeEnd) {
        const s = rangeStart < rangeEnd ? rangeStart : rangeEnd;
        const e = rangeEnd > rangeStart ? rangeEnd : rangeStart;
        return visibleEvents.filter((ev) => ev.date >= s && ev.date <= e);
      }
      return visibleEvents.filter(
        (ev) =>
          ev.date.getMonth() === viewMonth.getMonth() &&
          ev.date.getFullYear() === viewMonth.getFullYear(),
      );
    })();
    target.forEach((ev) => {
      const dt = ev.date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${ev.id}@jobraker`);
      lines.push(`DTSTAMP:${dt}`);
      lines.push(`DTSTART:${dt}`);
      lines.push(`DTEND:${dt}`);
      lines.push(`SUMMARY:${escape(ev.title)}`);
      if (ev.subtitle) lines.push(`DESCRIPTION:${escape(ev.subtitle)}`);
      lines.push("END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    const blob = new Blob([lines.join("\r\n")], {
      type: "text/calendar;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `calendar${rangeStart && rangeEnd ? "-range" : "-month"}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [enableICSExport, rangeStart, rangeEnd, visibleEvents, viewMonth]);

  // UI prefs persistence
  useEffect(() => {
    try {
      localStorage.setItem(
        "calendar_ui_prefs",
        JSON.stringify({ densityMode, focusContrast }),
      );
    } catch {}
  }, [densityMode, focusContrast]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("calendar_ui_prefs");
      if (!raw) return;
      const p = JSON.parse(raw);
      if (p.densityMode && ["full", "compact"].includes(p.densityMode))
        onDensityModeChange?.(p.densityMode);
      if (typeof p.focusContrast === "boolean")
        onFocusContrastChange?.(p.focusContrast);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inSelectedRange = (d: Date) => {
    if (!rangeStart || !rangeEnd) return false;
    const s = rangeStart < rangeEnd ? rangeStart : rangeEnd;
    const e = rangeEnd > rangeStart ? rangeEnd : rangeStart;
    return (
      d >= new Date(s.getFullYear(), s.getMonth(), s.getDate()) &&
      d <= new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59, 59, 999)
    );
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
    try {
      localStorage.setItem(
        "calendar_last_range",
        JSON.stringify({ start: s, end: e }),
      );
    } catch {}
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (!rangeSelectable) return;
    if (!e.shiftKey) return; // only act with Shift for safety
    const deltas: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
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
    const s = (rangeStart || base) < next ? rangeStart || base : next;
    const eDate = (rangeStart || base) < next ? next : rangeStart || base;
    onSelectRange?.({ start: s, end: eDate });
    try {
      localStorage.setItem(
        "calendar_last_range",
        JSON.stringify({ start: s, end: eDate }),
      );
    } catch {}
  };

  return (
    <div
      ref={containerRef}
      tabIndex={rangeSelectable ? 0 : -1}
      onKeyDown={handleKey}
      className={
        "w-full outline-none focus-visible:ring-2 ring-brand/40 rounded " +
        className
      }
      aria-label='Calendar'
      aria-describedby={rangeSelectable ? "calendar-range-hint" : undefined}
    >
      {showHeader && (
        <div className='mb-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex items-center gap-2 rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'>
            <button
              type='button'
              aria-label='Previous month'
              onClick={() => onMonthChange?.(addMonths(viewMonth, -1))}
              className='inline-flex h-9 w-9 items-center justify-center rounded-xl border border-transparent bg-white/[0.02] text-foreground/70 transition hover:border-brand/25 hover:bg-brand/10 hover:text-brand'
            >
              <ChevronLeft className='h-4 w-4' />
            </button>
            <div className='flex flex-col items-center min-w-[140px]'>
              <h3 className='select-none text-base font-semibold leading-tight tracking-tight text-white sm:text-lg'>
                {monthLabel}
              </h3>
              <div className='mt-1 flex items-center gap-1 text-[9px] uppercase tracking-[0.18em] text-foreground/45'>
                <span className='rounded-full border border-white/8 bg-white/[0.03] px-2 py-1'>
                  {addMonths(viewMonth, -1).toLocaleString(undefined, {
                    month: "short",
                  })}
                </span>
                <span className='rounded-full border border-brand/25 bg-brand/10 px-2 py-1 text-brand'>
                  {viewMonth.toLocaleString(undefined, { month: "short" })}
                </span>
                <span className='rounded-full border border-white/8 bg-white/[0.03] px-2 py-1'>
                  {addMonths(viewMonth, 1).toLocaleString(undefined, {
                    month: "short",
                  })}
                </span>
              </div>
            </div>
            <button
              type='button'
              aria-label='Next month'
              onClick={() => onMonthChange?.(addMonths(viewMonth, 1))}
              className='inline-flex h-9 w-9 items-center justify-center rounded-xl border border-transparent bg-white/[0.02] text-foreground/70 transition hover:border-brand/25 hover:bg-brand/10 hover:text-brand'
            >
              <ChevronRight className='h-4 w-4' />
            </button>
          </div>
          <div className='flex flex-wrap items-center justify-center sm:justify-end gap-1 sm:gap-1.5 rounded-2xl border border-white/8 bg-white/[0.02] p-1.5 w-full sm:w-auto shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'>
            <button
              type='button'
              onClick={() => onMonthChange?.(startOfMonth(new Date()))}
              className='rounded-xl border border-white/8 bg-transparent px-2.5 py-1 text-[10px] sm:text-xs sm:px-3 sm:py-1.5 text-foreground/80 transition hover:border-brand/25 hover:bg-brand/10 hover:text-brand'
            >
              Today
            </button>
            <button
              type='button'
              onClick={() =>
                onViewModeChange?.(viewMode === "month" ? "week" : "month")
              }
              className='rounded-xl border border-white/8 bg-transparent px-2.5 py-1 text-[10px] sm:text-xs sm:px-3 sm:py-1.5 text-foreground/75 transition hover:border-brand/25 hover:bg-brand/10 hover:text-brand'
            >
              {viewMode === "month" ? "Week" : "Month"}
            </button>
            {!isMobile && (
              <button
                type='button'
                onClick={() =>
                  onDensityModeChange?.(
                    densityMode === "full" ? "compact" : "full",
                  )
                }
                className='inline-flex items-center gap-1 rounded-xl border border-white/8 bg-transparent px-3 py-1.5 text-xs text-foreground/65 transition hover:border-brand/25 hover:bg-brand/10 hover:text-brand'
              >
                <Layers3 className='h-3.5 w-3.5' />
                {densityMode === "full" ? "Compact" : "Full"}
              </button>
            )}
            <button
              type='button'
              onClick={() => onFocusContrastChange?.(!focusContrast)}
              className={
                "inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[10px] sm:text-xs sm:px-3 sm:py-1.5 transition " +
                (focusContrast
                  ? "bg-brand/15 border-brand/30 text-brand"
                  : "bg-transparent border-white/8 text-foreground/60 hover:border-brand/25 hover:bg-brand/10 hover:text-brand")
              }
            >
              <ScanSearch className='h-3.5 w-3.5' />
              Contrast
            </button>
            {enableICSExport && (
              <button
                type='button'
                onClick={exportICS}
                className='inline-flex items-center gap-1 rounded-xl border border-white/8 bg-transparent px-2.5 py-1 text-[10px] sm:text-xs sm:px-3 sm:py-1.5 text-foreground/60 transition hover:border-brand/25 hover:bg-brand/10 hover:text-brand'
              >
                <Download className='h-3.5 w-3.5' />
                Export
              </button>
            )}
          </div>
        </div>
      )}
      {showLegend && (
        <div className='mb-3 flex flex-wrap gap-2 text-[10px] sm:text-xs'>
          {APPLICATION_STATUS_OPTIONS.map((s) => (
            <span
              key={s}
              className='inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-foreground/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition hover:border-brand/20 hover:text-foreground/90'
            >
              <span
                style={{
                  background: statusColor(s),
                  width: 8,
                  height: 8,
                }}
                className='inline-block rounded-full'
              />{" "}
              {s}
            </span>
          ))}
          {heatmap && (
            <span className='inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-brand shadow-[0_0_24px_rgba(29,255,0,0.08)]'>
              <span className='h-2.5 w-2.5 rounded-full bg-brand/90' />{" "}
              Density
            </span>
          )}
        </div>
      )}

      {/* Week header */}
      <div className='mb-2 grid grid-cols-7 gap-1 sm:gap-1.5'>
        {(() => {
          // Localized weekday narrow labels (Mon .. Sun) respecting weekStartsOn
          const base = [] as string[];
          for (let i = 0; i < 7; i++) {
            const ref = new Date(2021, 7, i + 1); // arbitrary week
            const lbl = new Intl.DateTimeFormat(usedLocale, {
              weekday: "narrow",
            }).format(ref);
            base.push(lbl);
          }
          const ordered = base
            .slice(weekStartsOn)
            .concat(base.slice(0, weekStartsOn));
          return ordered.map((d, index) => (
            <div
              key={`${d}-${index}`}
              className='select-none py-1 text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-foreground/40 sm:text-xs'
            >
              {d}
            </div>
          ));
        })()}
      </div>

      {/* Status Filters */}
      {onStatusFiltersChange && (
        <div className='flex flex-wrap gap-1 mb-2 text-[10px] sm:text-[11px]'>
          {APPLICATION_STATUS_OPTIONS.map((s) => {
            const active =
              !statusFilters ||
              statusFilters.length === 0 ||
              statusFilters.includes(s);
            return (
              <button
                key={s}
                type='button'
                onClick={() => {
                  let next: string[] = [];
                  if (!statusFilters || statusFilters.length === 0) {
                    next = [...APPLICATION_STATUS_OPTIONS].filter(
                      (x) => x !== s,
                    );
                  } else {
                    next = active
                      ? statusFilters.filter((x) => x !== s)
                      : [...statusFilters, s];
                  }
                  onStatusFiltersChange(next);
                }}
                className={
                  "px-2 py-0.5 rounded border text-xs transition " +
                  (active
                    ? "bg-brand/15 border-brand/40 text-brand"
                    : "bg-transparent border-foreground/10 text-foreground/40 hover:text-foreground/70 hover:border-foreground/30")
                }
              >
                {s}
              </button>
            );
          })}
          <button
            type='button'
            onClick={() => onStatusFiltersChange([])}
            className='bg-transparent px-2 py-0.5 rounded border text-xs border-foreground/10 text-foreground/50 hover:text-brand hover:border-brand/40 transition'
          >
            Reset
          </button>
        </div>
      )}

      {enableAnalyticsRibbon && analytics && (
        <div className='mb-2 rounded-lg border border-brand/20 bg-gradient-to-r from-brand/10 via-transparent to-brand/10 px-3 py-2 flex flex-wrap items-center gap-3 text-[10px] sm:text-[11px]'>
          <span className='text-foreground/70'>Range:</span>
          <span className='text-brand font-semibold'>{analytics.total}</span>
          <span className='text-foreground/60'>
            Applied+Pending {analytics.funnel.applied}
          </span>
          <span className='text-[#56c2ff]'>
            Interview {analytics.funnel.interview}
          </span>
          <span className='text-[#f8d74a]'>Offer {analytics.funnel.offer}</span>
          <span className='text-red-500'>
            Rejected {analytics.funnel.rejection}
          </span>
          <span className='text-foreground/50 ml-auto flex items-center gap-2'>
            <span>A-&gt;I {(analytics.funnel.appliedToInterview * 100).toFixed(0)}%</span>
            <span>I-&gt;O {(analytics.funnel.interviewToOffer * 100).toFixed(0)}%</span>
            <span>A-&gt;O {(analytics.funnel.appliedToOffer * 100).toFixed(0)}%</span>
          </span>
        </div>
      )}

      {/* Days */}
      <div className='grid grid-cols-7 gap-1 sm:gap-1.5'>
        {grid.map((cell, idx) => {
          const isToday = highlightToday && isSameDay(cell.date, today);
          const isSelected = selectedDate && isSameDay(cell.date, selectedDate);
          const dayKey = toLocalDayKey(cell.date);
          const dayEvents = eventsByDay[dayKey] || [];
          const expanded = expandedDays.has(dayKey);
          const limit = expanded ? dayEvents.length : maxVisibleEventsPerDay;
          const extra = dayEvents.length - limit;
          const isWeekend = [0, 6].includes(cell.date.getDay());
          let heatmapStyle: React.CSSProperties = {};
          if (heatmap && dayEvents.length > 0 && !isToday) {
            const ratio = heatmapMax
              ? Math.min(1, dayEvents.length / heatmapMax)
              : 0;
            const alpha = 0.08 + ratio * 0.2;
            const base = focusContrast && ratio < 0.2 ? "77,90,111" : "44,214,123";
            heatmapStyle.background = isSelected
              ? "linear-gradient(135deg, rgba(" +
                base +
                "," +
                alpha +
                "), rgba(" +
                base +
                "," +
                alpha * 0.5 +
                "))"
              : "rgba(" + base + "," + alpha + ")";
          }
          return (
            <button
              key={dayKey + idx}
              type='button'
              onClick={() => handleDayClick(cell.date)}
              onMouseDown={() => beginDrag(cell.date)}
              onMouseEnter={() => dragOver(cell.date)}
              onDrop={(e) => handleDrop(e, cell.date)}
              onDragOver={handleDragOver}
              onDoubleClick={() => {
                if (enableQuickCreate)
                  setQuickCreate({ key: dayKey, date: cell.date, title: "" });
              }}
              className={[
                "group relative flex min-h-[60px] sm:min-h-[104px] flex-col gap-1 rounded-lg sm:rounded-2xl p-1.5 sm:p-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition-all duration-150",
                "focus:outline-none focus-visible:ring-2 ring-brand/60",
                "border border-white/6 bg-[#0c1017] text-foreground",
                cell.inCurrent ? "cursor-pointer" : "cursor-pointer opacity-40",
                isWeekend && !isToday ? "bg-[#111827]" : "",
                isToday
                  ? "!border-brand/25 !bg-[linear-gradient(180deg,rgba(29,255,0,0.14),rgba(13,18,23,0.96))] text-white shadow-[0_20px_50px_rgba(29,255,0,0.08)] ring-1 ring-brand/20"
                  : "",
                !isToday && cell.inCurrent
                  ? "text-foreground/80 hover:-translate-y-[1px] hover:border-brand/20 hover:bg-[#111722]"
                  : "",
                !cell.inCurrent && !isToday
                  ? "bg-[#090d13] text-foreground/30 hover:bg-[#0d1219]"
                  : "",
                isSelected && !isToday
                  ? "!border-brand/35 !bg-[linear-gradient(180deg,rgba(29,255,0,0.08),rgba(17,23,34,0.96))] shadow-[0_18px_40px_rgba(29,255,0,0.06)]"
                  : "",
                inSelectedRange(cell.date) && !isToday
                  ? "!border-brand/15 !bg-[linear-gradient(180deg,rgba(29,255,0,0.07),rgba(12,16,23,0.94))]"
                  : "",
                focusContrast && dayEvents.length === 0 && !isToday
                  ? "opacity-45 hover:opacity-80"
                  : "",
              ].join(" ")}
              style={heatmapStyle}
            >
              <div className='flex items-center justify-between w-full'>
                <div className='mb-0.5 text-sm font-semibold leading-none tracking-tight sm:text-[15px]'>
                  {cell.date.getDate()}
                </div>
                {showDayEventCount && dayEvents.length > 0 && (
                  <span className='hidden sm:inline-flex rounded-full border border-white/8 bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-brand shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'>
                    {dayEvents.length}
                  </span>
                )}
              </div>
              <div className='flex-1 w-full overflow-hidden flex flex-col'>
                {effectiveDensityMode === "compact" && dayEvents.length > 0 && (
                  <div className='flex flex-wrap gap-1 mt-1'>
                    {dayEvents.slice(0, limit).map((ev) => (
                      <span
                        key={ev.id}
                        title={ev.title}
                        draggable={allowDrag}
                        onDragStart={(e) => handleDragStart(e, ev)}
                        className='h-1.5 w-1.5 sm:h-2.5 sm:w-2.5 rounded-full border border-white/15 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]'
                        style={{ background: statusColor(ev.status) }}
                      />
                    ))}
                    {extra > 0 && !expanded && (
                      <button
                        type='button'
                        onClick={() => toggleExpanded(dayKey)}
                        className='rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 text-[10px] text-foreground/60 transition hover:border-brand/20 hover:text-brand'
                      >
                        +{extra}
                      </button>
                    )}
                  </div>
                )}
                {effectiveDensityMode === "full" &&
                  dayEvents.slice(0, limit).map((ev) => (
                    <div
                      key={ev.id}
                      draggable={allowDrag}
                      onDragStart={(e) => handleDragStart(e, ev)}
                      title={
                        ev.subtitle ? ev.title + " - " + ev.subtitle : ev.title
                      }
                      className={
                        "relative mb-1 flex items-center gap-1.5 truncate rounded-xl border px-2.5 py-1.5 text-xs font-medium last:mb-0 sm:text-sm " +
                        (motionDisabled
                          ? ""
                          : "transition-all duration-150 hover:translate-x-[1px] hover:border-white/15")
                      }
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(255,255,255,0.03), " +
                          statusColor(ev.status) +
                          "18)",
                        color: "rgba(245,247,250,0.96)",
                        borderColor: statusColor(ev.status) + "40",
                        boxShadow:
                          (ev.status || "").toLowerCase() === "offer"
                            ? "0 0 0 1px #f8d74a40, inset 0 1px 0 rgba(255,255,255,0.03)"
                            : (ev.status || "").toLowerCase() === "rejected"
                              ? "0 0 0 1px #ef444440, inset 0 1px 0 rgba(255,255,255,0.03)"
                              : "inset 0 1px 0 rgba(255,255,255,0.03)",
                      }}
                    >
                      <span
                        className='w-1.5 h-1.5 rounded-full'
                        style={{ background: statusColor(ev.status) }}
                      />
                      {ev.title}
                      <div className='pointer-events-none absolute left-0 top-full z-30 mt-1 min-w-[180px] max-w-[240px] rounded-xl border border-white/8 bg-[#0d131c]/95 p-2.5 text-[10px] leading-snug text-foreground opacity-0 shadow-2xl backdrop-blur-xl transition-opacity group-hover:opacity-100'>
                        <div className='font-semibold text-brand mb-0.5 truncate'>
                          {ev.title}
                        </div>
                        {ev.subtitle && (
                          <div className='text-foreground/70 truncate'>
                            {ev.subtitle}
                          </div>
                        )}
                        {ev.status && (
                          <div
                            className='mt-0.5 text-[9px] uppercase tracking-wide'
                            style={{ color: statusColor(ev.status) }}
                          >
                            {ev.status}
                          </div>
                        )}
                        <div className='mt-0.5 text-[9px] text-foreground/50'>
                          {cell.date.toLocaleDateString(usedLocale)}
                        </div>
                      </div>
                    </div>
                  ))}
                {extra > 0 && effectiveDensityMode === "full" && !expanded && (
                  <button
                    type='button'
                    onClick={() => toggleExpanded(dayKey)}
                    className='mt-auto text-[9px] font-semibold text-brand/85 transition hover:text-brand sm:text-[10px]'
                  >
                    +{extra} more
                  </button>
                )}
                {expanded && extra > 0 && (
                  <button
                    type='button'
                    onClick={() => toggleExpanded(dayKey)}
                    className='mt-auto text-[9px] text-foreground/50 transition hover:text-brand sm:text-[10px]'
                  >
                    Collapse
                  </button>
                )}
                {quickCreate && quickCreate.key === dayKey && (
                  <div className='mt-1 flex items-center gap-1 rounded-xl border border-brand/20 bg-black/30 p-1.5 backdrop-blur-sm'>
                    <input
                      autoFocus
                      value={quickCreate.title}
                      onChange={(e) =>
                        setQuickCreate({
                          ...quickCreate,
                          title: e.target.value,
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleQuickCreateSubmit();
                        } else if (e.key === "Escape") {
                          setQuickCreate(null);
                        }
                      }}
                      placeholder='New event title'
                      className='flex-1 bg-transparent text-[10px] outline-none placeholder:text-foreground/30'
                    />
                    <button
                      type='button'
                      onClick={handleQuickCreateSubmit}
                      className='rounded-lg bg-brand/15 px-2 py-1 text-[10px] text-brand transition hover:bg-brand/25'
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>
              {/* subtle focus / hover outline overlay */}
              <div className='pointer-events-none absolute inset-0 rounded-2xl ring-0 transition group-hover:ring-1 group-hover:ring-white/8' />
            </button>
          );
        })}
      </div>
      {enableQuickCreate && !quickCreate && (
        <div className='mt-1 text-[10px] text-foreground/30'>
          Double-click a day to quick add.
        </div>
      )}
    </div>
  );
};

export default KiboCalendar;


