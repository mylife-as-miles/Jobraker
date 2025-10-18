import { useEffect, useMemo, useState } from "react";
import { MatchScoreAnalytics } from "../../../components/analytics/MatchScoreAnalytics";
import { Switch } from "../../../components/ui/switch";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { motion } from "framer-motion";
import { Building2, AlertCircle, Inbox } from "lucide-react";
import KiboCalendar, { CalendarEvent } from "../../../components/ui/kibo-ui/calendar";
import CalendarDayDetail from "../../../components/ui/kibo-ui/CalendarDayDetail";
import { useNotifications } from "../../../hooks/useNotifications";
import { useApplications, ApplicationStatus } from "../../../hooks/useApplications";
import { Skeleton } from "../../../components/ui/skeleton";
import { SplitLineAreaChart } from "./SplitLineAreaChart";
import { useRegisterCoachMarks } from "../../../providers/TourProvider";
import { useAnalyticsData } from "../../../hooks/useAnalyticsData";
// SplitLineAreaChart removed; chart moved to Application section

// Using realtime notifications; no local interface needed here

export const OverviewPage = (): JSX.Element => {
  const [selectedPeriod, setSelectedPeriod] = useState("1 Month");
  const [stacked, setStacked] = useState(false);
  const [stackedTouched, setStackedTouched] = useState(false);
  const [visibleSeries, setVisibleSeries] = useState<string[]>([]);
  const { items: notifItems, loading: notifLoading } = useNotifications(6);
  const { applications, loading: appsLoading, update, create, stats } = useApplications();
  const matchAnalytics = useAnalyticsData("30d", { granularity: 'day' });
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus[] | null>(null); // null => all
  const mappedNotifs = useMemo(() => {
    return notifItems.map(n => {
      // Per-type style mapping for visual differentiation & accessibility
      const baseSize = 'w-9 h-9 sm:w-10 sm:h-10';
      const shared = 'rounded-xl flex items-center justify-center font-bold text-xs sm:text-sm shadow-inner transition ring-1';
      let className = '';
      let inner: JSX.Element | string;
      if (n.type === 'application') {
        className = `${baseSize} ${shared} bg-[#1dff00]/15 ring-[#1dff00]/40 text-[#b6ffb6] group-hover:ring-[#1dff00]/60`;
        inner = (n.company || 'A').charAt(0).toUpperCase();
      } else if (n.type === 'interview') {
        className = `${baseSize} ${shared} bg-[#0d4d66]/40 ring-[#56c2ff]/30 text-[#56c2ff] group-hover:ring-[#56c2ff]/60`;
        inner = <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />;
      } else if (n.type === 'company') {
        className = `${baseSize} ${shared} bg-[#1e1e1e] ring-white/10 text-white group-hover:ring-[#1dff00]/50`;
        inner = (n.company || 'C').charAt(0).toUpperCase();
      } else { // system / fallback
        className = `${baseSize} ${shared} bg-[#3a1212] ring-[#ff6b6b]/40 text-[#ff9e9e] group-hover:ring-[#ff6b6b]/70`;
        inner = <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />;
      }
      return {
        id: n.id,
        type: n.type as any,
        title: n.title,
        message: n.message || '',
        time: new Date(n.created_at).toLocaleString(),
        icon: <div className={className}>{inner}</div>
      };
    });
  }, [notifItems]);

  // Realtime clock and dynamic calendar state
  const [now, setNow] = useState<Date>(new Date());
  // Month being viewed in the calendar (defaults to current month)
  const [viewDate, setViewDate] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // monthLabel removed (handled by KiboCalendar header internally now)

  const timeLabel = useMemo(() =>
    now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  [now]);

  // Smart default for stacked: Today/1 Week -> stacked; 1 Month -> overlap (unless user toggled)
  useEffect(() => {
    if (stackedTouched) return;
    setStacked(selectedPeriod !== "1 Month");
  }, [selectedPeriod, stackedTouched]);

  // Load persisted UI state
  useEffect(() => {
    try {
      const raw = localStorage.getItem("overview_apps_chart_ui")
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (typeof parsed.stacked === 'boolean') {
        setStacked(parsed.stacked)
        setStackedTouched(true)
      }
      if (Array.isArray(parsed.visible) && parsed.visible.every((v: any) => typeof v === 'string')) {
        setVisibleSeries(parsed.visible)
      }
    } catch {}
  }, [])

  // Persist on change
  useEffect(() => {
    try {
      localStorage.setItem("overview_apps_chart_ui", JSON.stringify({ stacked, visible: visibleSeries }))
    } catch {}
  }, [stacked, visibleSeries])

  // Build real series based on selected period with status-specific keys
  const { seriesData, seriesMeta, appliedCount, interviewCount, totals } = useMemo(() => {
    const period = selectedPeriod;

    // Apply status filtering (search removed per request)
    let filtered = applications;
    if (statusFilter && statusFilter.length) {
      const set = new Set(statusFilter);
      filtered = filtered.filter(a => set.has(a.status));
    }

    type Bucket = { key: string; label: string; start: Date; end: Date }
    const buckets: Bucket[] = []

    if (period === "Today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
      for (let h = 0; h < 24; h++) {
        const s = new Date(start.getTime())
        s.setHours(h)
        const e = new Date(s.getTime())
        e.setHours(h + 1)
        buckets.push({
          key: `${s.getFullYear()}-${s.getMonth()}-${s.getDate()}-${h}`,
          label: `${h.toString().padStart(2, '0')}:00`,
          start: s,
          end: e,
        })
      }
    } else if (period === "1 Week") {
      const start = new Date(now)
      start.setDate(start.getDate() - 6)
      start.setHours(0, 0, 0, 0)
      for (let i = 0; i < 7; i++) {
        const s = new Date(start.getTime())
        s.setDate(start.getDate() + i)
        const e = new Date(s.getTime())
        e.setDate(s.getDate() + 1)
        buckets.push({
          key: `${s.getFullYear()}-${s.getMonth()}-${s.getDate()}`,
          label: s.toLocaleDateString(undefined, { weekday: 'short' }),
          start: s,
          end: e,
        })
      }
    } else {
      // 1 Month: last 6 months for trend
      const end = new Date(now.getFullYear(), now.getMonth(), 1)
      const start = new Date(end.getFullYear(), end.getMonth() - 5, 1)
      for (let i = 0; i < 6; i++) {
        const s = new Date(start.getFullYear(), start.getMonth() + i, 1)
        const e = new Date(s.getFullYear(), s.getMonth() + 1, 1)
        buckets.push({
          key: `${s.getFullYear()}-${s.getMonth()}`,
          label: s.toLocaleString(undefined, { month: 'short' }),
          start: s,
          end: e,
        })
      }
    }

    // Initialize counts per status
    const statuses = ["Applied", "Interview", "Offer", "Rejected"] as const
    const data = buckets.map(b => {
      const point: Record<string, string | number> = { label: b.label }
      statuses.forEach(s => { point[s] = 0 })
      return point
    })

    let applied = 0
    let interviews = 0
    let totalInWindow = 0
  for (const app of filtered) {
      const d = new Date(app.applied_date)
      if (period === "Today") {
        const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
        if (d < dayStart || d >= dayEnd) continue
      } else if (period === "1 Week") {
        const weekStart = new Date(now)
        weekStart.setDate(weekStart.getDate() - 6)
        weekStart.setHours(0, 0, 0, 0)
        const weekEnd = new Date(now)
        weekEnd.setHours(23, 59, 59, 999)
        if (d < weekStart || d > weekEnd) continue
      } else {
        const sixMonthsStart = new Date(now.getFullYear(), now.getMonth() - 5, 1)
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        if (d < sixMonthsStart || d >= monthEnd) continue
      }

      // Aggregate bucket
      const idx = buckets.findIndex(b => d >= b.start && d < b.end)
      if (idx >= 0) {
        const s = (app.status as string) || "Applied"
        if (s in data[idx]) data[idx][s] = (data[idx][s] as number) + 1
        else data[idx]["Applied"] = (data[idx]["Applied"] as number) + 1
      }

      if (app.status === "Applied") applied++
      if (app.status === "Interview") interviews++
      totalInWindow++
    }

    // Improved distinctive palette for accessibility / color meaning
    const palette: Record<string, string> = {
      Applied: "#1dff00",
      Interview: "#00b2ff",
      Offer: "#ffd700",
      Rejected: "#ff4d4d",
    };
    const series = statuses.map((s) => ({
      key: s,
      label: s,
      color: palette[s] || "#999999",
    }))

  return { seriesData: data, seriesMeta: series, appliedCount: applied, interviewCount: interviews, totals: { totalInWindow } }
  }, [applications, now, selectedPeriod, statusFilter])

  // Calendar selection & view state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ start: Date; end: Date } | null>(null);
  const [calendarViewMode, setCalendarViewMode] = useState<'month' | 'week'>('month');
  const [showShortcuts, setShowShortcuts] = useState(false);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setShowShortcuts(s=>!s); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Derive calendar events from applications: use interview_date if present else applied_date as end indicator
  const calendarEvents: CalendarEvent[] = useMemo(() => {
    return applications.map(app => {
      const dateStr = app.interview_date || app.applied_date;
      let date: Date;
      try { date = new Date(dateStr); } catch { date = new Date(); }
      return {
        id: app.id,
        date,
        title: app.job_title.slice(0, 24),
        subtitle: app.company?.slice(0, 24) || '',
        status: app.status,
      };
    });
  }, [applications]);

  // Product tour coach marks for overview dashboard
  useRegisterCoachMarks({
    page: 'overview',
    marks: [
      {
        id: 'apps-chart',
        selector: '#overview-apps-chart',
        title: 'Application Velocity',
        body: 'Track how many applications you submit over time and spot trends early.'
      },
      {
        id: 'status-toggle',
        selector: '#overview-status-filter-buttons',
        title: 'Focus by Status',
        body: 'Filter the dataset to highlight specific pipeline stages like Interview or Offers.'
      },
      {
        id: 'calendar-pane',
        selector: '#overview-calendar',
        title: 'Calendar Insight',
        body: 'Interviews and applied dates appear here so you can plan your week effectively.'
      },
      {
        id: 'notifications-panel',
        selector: '#overview-notifications',
        title: 'Recent Notifications',
        body: 'Stay on top of interview scheduling, offers, and important system updates.'
      }
    ]
  });

  return (
    <div className="min-h-screen bg-black">
      <div className="w-full max-w-7xl mx-auto p-3 sm:p-4 lg:p-6 xl:p-8">
        {/* Responsive overview layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 items-start">
          {/* Left Column - Applications and Match Score */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6 w-full">
            {/* Applications Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              whileHover={{ scale: 1.02 }}
              className="transition-transform duration-300 w-full"
            >
              <Card className="bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border border-[#1dff00]/20 backdrop-blur-[25px] p-4 sm:p-6 lg:p-8 rounded-2xl shadow-xl hover:shadow-2xl hover:border-[#1dff00]/50 hover:shadow-[#1dff00]/20 transition-all duration-500">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-2">
                  <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white">Applications</h2>
                  <span className="text-left sm:text-right text-2xl sm:text-2xl lg:text-3xl font-bold text-[#1dff00]">
                    {appliedCount}/{interviewCount}
                  </span>
                </div>

                {/* Period Selector + Stacked Toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-2">
                    {["Today", "1 Week", "1 Month"].map((period) => (
                      <Button
                        key={period}
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedPeriod(period)}
                        title={`Show data for ${period}`}
                        aria-label={`Select period ${period}`}
                        className={`text-xs sm:text-sm transition-all duration-300 hover:scale-105 ${
                          selectedPeriod === period
                            ? "bg-[#1dff00] text-black hover:bg-[#1dff00]/90"
                            : "text-white hover:text-[#1dff00] hover:bg-[#1dff00]/10"
                        }`}
                      >
                        {period}
                      </Button>
                    ))}
                  </div>
                  {/* Stacked toggle */}
                  <div className="flex items-center self-end sm:self-center gap-2 text-xs sm:text-sm text-[#888]" title="Toggle stacked / overlapping series" aria-label="Stacked toggle">
                    <span>Stacked</span>
                    <Switch
                      checked={stacked && visibleSeries.length > 1}
                      onCheckedChange={(v: boolean) => { setStackedTouched(true); setStacked(!!v); }}
                      disabled={visibleSeries.length <= 1}
                      aria-label="Toggle stacked chart mode"
                    />
                  </div>
                </div>
                {/* Status Filter Pills */}
                <div id="overview-status-filter-buttons" data-tour="overview-status-filter-buttons" className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 mb-4 sm:mb-6">
                  {['All','Applied','Interview','Offer','Rejected'].map(s => {
                    const active = s === 'All' ? !statusFilter : statusFilter?.includes(s as ApplicationStatus);
                    const baseColors: Record<string,string> = {
                      Applied: 'bg-[#1dff00]/15 text-[#1dff00] border-[#1dff00]/40 hover:bg-[#1dff00]/25',
                      Interview: 'bg-[#00b2ff]/15 text-[#56c2ff] border-[#00b2ff]/40 hover:bg-[#00b2ff]/25',
                      Offer: 'bg-[#ffd700]/15 text-[#ffd700] border-[#ffd700]/40 hover:bg-[#ffd700]/25',
                      Rejected: 'bg-[#ff4d4d]/15 text-[#ff9e9e] border-[#ff4d4d]/40 hover:bg-[#ff4d4d]/25',
                      All: 'bg-white/5 text-white border-white/20 hover:bg-white/10'
                    };
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          if (s === 'All') { setStatusFilter(null); return; }
                          setStatusFilter(prev => {
                            if (!prev) return [s as ApplicationStatus];
                            if (prev.includes(s as ApplicationStatus)) {
                              const next = prev.filter(p => p !== s);
                              return next.length ? next : null;
                            }
                            return [...prev, s as ApplicationStatus];
                          });
                        }}
                        className={`w-full sm:w-auto text-[10px] sm:text-xs px-2 py-1 rounded-md border transition-all duration-300 font-medium tracking-wide ${baseColors[s]} ${active ? 'ring-1 ring-white/40 scale-105' : 'opacity-70'} focus:outline-none focus:ring-2 focus:ring-[#1dff00]/50`}
                        title={s === 'All' ? 'Show all statuses' : `${active ? 'Hide' : 'Show'} ${s} applications`}
                        aria-label={s === 'All' ? 'Filter: All statuses' : `Filter: ${s}`}
                        aria-pressed={active}
                      >{s}</button>
                    );
                  })}
                </div>

                {/* Stats & Conversion Metrics */}
        <div className="flex flex-wrap items-center justify-evenly mb-4 sm:mb-6">
                  <motion.div 
                    className="text-center sm:text-left"
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
          <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#1dff00] mb-1">{totals.totalInWindow}</div>
                    <div className="text-xs sm:text-sm text-[#888888]">Applications</div>
                  </motion.div>
                  <motion.div 
                    className="text-center sm:text-left"
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
          <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#1dff00] mb-1">{interviewCount}</div>
                    <div className="text-xs sm:text-sm text-[#888888]">Interviews</div>
                  </motion.div>
                  <motion.div 
                    className="text-center sm:text-left"
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#ffd700] mb-1">{Math.round(stats.offerRate * 100)}%</div>
                    <div className="text-[10px] sm:text-xs text-[#888888]">Offer Rate</div>
                  </motion.div>
                  <motion.div 
                    className="text-center sm:text-left"
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#ff4d4d] mb-1">{Math.round(stats.rejectionRate * 100)}%</div>
                    <div className="text-[10px] sm:text-xs text-[#888888]">Rejection Rate</div>
                  </motion.div>
                </div>

                {/* Applications Chart (real data, status series) */}
                  {/* Application trend chart */}
                <div id="overview-apps-chart" data-tour="overview-apps-chart" className="mt-4 sm:mt-6 w-full max-h-96 overflow-hidden min-h-[16rem] relative" aria-live="polite">
                  <div className={`transition-opacity duration-500 ${appsLoading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    {!appsLoading && (
                      <SplitLineAreaChart
                        data={seriesData}
                        xKey="label"
                        series={seriesMeta}
                        stacked={stacked}
                        showLegend
                        onVisibleChange={setVisibleSeries}
                        defaultVisible={visibleSeries}
                        tickFormatter={(v) => String(v).slice(0, 3)}
                        className="h-64 sm:h-72 lg:h-80 xl:h-96 w-full"
                      />
                    )}
                  </div>
                  {appsLoading && (
                    <div className="absolute inset-0 flex flex-col gap-4">
                      <Skeleton className="h-6 w-40" />
                      <Skeleton className="h-full w-full" />
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>

            {/* Calendar (Kibo UI) - moved up, swapping with Match Scores */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              whileHover={{ scale: 1.02 }}
              className="transition-transform duration-300"
            >
              <Card id="overview-calendar" data-tour="overview-calendar" className="bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border border-[#1dff00]/20 backdrop-blur-[25px] p-4 sm:p-6 rounded-2xl shadow-xl hover:shadow-2xl hover:border-[#1dff00]/50 hover:shadow-[#1dff00]/20 transition-all duration-500 max-h-96 overflow-y-auto">
                <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[10px] sm:text-xs text-[#888888]">
                  <div>
                    Current time: <span className="text-[#1dff00] font-medium">{timeLabel}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#666] hidden sm:inline">View:</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCalendarViewMode(m => m === 'month' ? 'week' : 'month')}
                      className="text-[10px] sm:text-xs px-2 py-1 border border-[#1dff00]/20 hover:border-[#1dff00]/50 hover:bg-[#1dff00]/10 text-[#1dff00]"
                    >
                      {calendarViewMode === 'month' ? 'Switch to Week' : 'Switch to Month'}
                    </Button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <KiboCalendar
                    month={viewDate}
                    selectedDate={selectedDate || undefined}
                    onMonthChange={(d) => setViewDate(d)}
                    onSelectDate={(d) => setSelectedDate(d)}
                    events={calendarEvents}
                    maxVisibleEventsPerDay={3}
                    rangeSelectable
                    onSelectRange={setSelectedRange}
                    locale={Intl.DateTimeFormat().resolvedOptions().locale}
                    viewMode={calendarViewMode}
                    onViewModeChange={setCalendarViewMode}
                    heatmap
                    showLegend
                  />
                </div>
                {selectedRange && (
                  <div className="mt-3 text-center text-[10px] sm:text-xs text-[#888] flex flex-col items-center gap-1">
                    <div>
                      Range: <span className="text-[#1dff00] font-medium">{selectedRange.start.toLocaleDateString()} → {selectedRange.end.toLocaleDateString()}</span>
                    </div>
                    <button
                      onClick={() => { setSelectedRange(null); localStorage.removeItem('calendar_last_range'); }}
                      className="px-2 py-0.5 rounded border border-white/10 hover:border-[#1dff00]/40 hover:text-[#1dff00] hover:bg-[#1dff00]/10 text-[10px]"
                    >Clear</button>
                  </div>
                )}
                <CalendarDayDetail
                  date={selectedDate}
                  range={selectedRange}
                  onClose={() => { setSelectedDate(null); setSelectedRange(null); }}
                  applications={applications}
                  onUpdateApplication={update}
                  onCreateApplication={async (input) => { await create({ job_title: input.job_title, company: input.company, status: input.status as any, applied_date: input.applied_date }); }}
                />
              </Card>
              {showShortcuts && (
                <div className="mt-4 text-[10px] sm:text-xs text-[#888] border border-white/10 rounded-lg p-3 bg-black/40">
                  <div className="flex justify-between mb-2"><span className="text-white/80 font-medium">Shortcuts</span><button onClick={()=>setShowShortcuts(false)} className="text-[#1dff00] hover:underline">Close</button></div>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                    <li><kbd className="px-1 py-0.5 bg-white/10 rounded">Ctrl/⌘ + ?</kbd> Toggle help</li>
                    <li><kbd className="px-1 py-0.5 bg-white/10 rounded">Shift + ←/→/↑/↓</kbd> Expand range</li>
                    <li><kbd className="px-1 py-0.5 bg-white/10 rounded">Click + drag</kbd> Select range</li>
                    <li><kbd className="px-1 py-0.5 bg-white/10 rounded">Esc</kbd> Close popup</li>
                  </ul>
                </div>
              )}
            </motion.div>
          </div>

          {/* Right Column - Notifications and Match Scores */}
          <div className="space-y-4 sm:space-y-6">
            {/* Notifications Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              whileHover={{ scale: 1.02 }}
              className="transition-transform duration-300"
            >
              <Card id="overview-notifications" className="relative overflow-hidden bg-[#0c0c0c] border border-[#1dff00]/25 backdrop-blur-xl p-4 sm:p-6 rounded-2xl shadow-xl hover:shadow-[#1dff00]/20 hover:border-[#1dff00]/50 transition-all duration-500 group">
                <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[#1dff00]/5 blur-3xl group-hover:bg-[#1dff00]/10 transition" />
                <div className="flex items-center justify-between mb-4 sm:mb-5 relative z-10">
                  <div>
                    <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                      <span className="relative inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-[#1dff00]/20 to-[#1dff00]/5 border border-[#1dff00]/30 text-[#1dff00] shadow-inner">
                        🔔
                      </span>
                      Notifications
                    </h2>
                    <p className="mt-1 text-[11px] sm:text-xs text-white/40">Recent activity & status changes</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-white/70 hover:text-[#1dff00] hover:bg-[#1dff00]/10 hover:scale-105 transition-all duration-300 text-xs sm:text-sm font-medium border border-transparent hover:border-[#1dff00]/40 px-3"
                  >
                    View all
                  </Button>
                </div>

                <div className="space-y-2.5 sm:space-y-3 min-h-[140px] relative z-10">
                  {notifLoading && (
                    <div className="grid grid-cols-1 gap-2.5 sm:gap-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-start gap-3 p-2.5 sm:p-3 rounded-xl border border-white/10 bg-white/[0.04]">
                          <Skeleton className="h-9 w-9 rounded-xl" />
                          <div className="flex-1 space-y-2 py-0.5">
                            <Skeleton className="h-3 w-2/3" />
                            <Skeleton className="h-3 w-1/3" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {mappedNotifs.length === 0 && !notifLoading && (
                    <div className="flex items-center justify-center p-8 border border-dashed border-[#1dff00]/30 rounded-xl bg-[#0b0b0b]">
                      <div className="text-center">
                        <div className="mx-auto w-12 h-12 rounded-full bg-[#1dff00]/10 flex items-center justify-center mb-3">
                          <Inbox className="w-6 h-6 text-[#1dff00]" />
                        </div>
                        <p className="text-white font-medium">You’re all caught up</p>
                        <p className="text-xs text-[#888]">No notifications yet. Activity will show up here.</p>
                      </div>
                    </div>
                  )}
                  {!notifLoading && mappedNotifs.map((notification, index) => (
                    <motion.button
                      type="button"
                      key={notification.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, delay: 0.05 * index, ease: 'easeOut' }}
                      whileHover={{ scale: 1.015 }}
                      whileTap={{ scale: 0.985 }}
                      className="w-full text-left flex items-start gap-3 p-2.5 sm:p-3 rounded-xl border border-white/10 bg-gradient-to-br from-[#121212] via-[#0d0d0d] to-[#060606] hover:from-[#1dff00]/10 hover:via-[#0a8246]/10 hover:to-[#060606] hover:border-[#1dff00]/40 transition-all duration-400 group relative overflow-hidden"
                    >
                      {notification.icon}
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] sm:text-sm text-white font-medium leading-relaxed tracking-tight truncate flex items-center gap-2">
                          {notification.title}
                          <span className="hidden md:inline-flex text-[9px] px-1.5 py-0.5 rounded bg-[#1dff00]/10 border border-[#1dff00]/30 text-[#1dff00] font-semibold tracking-wide">NEW</span>
                        </p>
                        <p className="text-[10px] sm:text-xs text-white/40 mt-1 font-mono tracking-wide">{notification.time}</p>
                      </div>
                      <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-gradient-to-r from-transparent via-[#1dff00]/5 to-transparent" />
                    </motion.button>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* Match Score Analytics Card (moved below notifications) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              whileHover={{ scale: 1.02 }}
              className="transition-transform duration-300"
            >
              <Card className="bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border border-[#1dff00]/20 backdrop-blur-[25px] p-4 sm:p-6 rounded-2xl shadow-xl hover:shadow-2xl hover:border-[#1dff00]/50 hover:shadow-[#1dff00]/20 transition-all duration-500">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white">Recent Match Scores</h2>
                </div>
                <MatchScoreAnalytics period="30d" data={matchAnalytics} />
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};