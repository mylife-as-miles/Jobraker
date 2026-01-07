import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { StreakCard } from "../../../components/StreakCard";
// SplitLineAreaChart removed; chart moved to Application section

// Using realtime notifications; no local interface needed here

export const OverviewPage = (): JSX.Element => {
  const navigate = useNavigate();
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
    } catch { }
  }, [])

  // Persist on change
  useEffect(() => {
    try {
      localStorage.setItem("overview_apps_chart_ui", JSON.stringify({ stacked, visible: visibleSeries }))
    } catch { }
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
      if (e.key === '?' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setShowShortcuts(s => !s); }
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

  // Calculate streak data from applications
  const streakData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate start of current week (Monday)
    const currentDayOfWeek = today.getDay();
    const daysFromMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - daysFromMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    // Get activity for this week (Mon-Sun)
    const weekActivity = [false, false, false, false, false, false, false];
    let weekCount = 0;

    applications.forEach(app => {
      // Parse the date string and create a local date (not UTC)
      const appDate = new Date(app.applied_date);
      // Normalize to local midnight
      const localDate = new Date(appDate.getFullYear(), appDate.getMonth(), appDate.getDate());

      // Check if in current week
      const weekEnd = new Date(startOfWeek);
      weekEnd.setDate(startOfWeek.getDate() + 7);

      if (localDate >= startOfWeek && localDate < weekEnd) {
        const daysSinceMonday = Math.floor((localDate.getTime() - startOfWeek.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceMonday >= 0 && daysSinceMonday < 7) {
          if (!weekActivity[daysSinceMonday]) {
            weekActivity[daysSinceMonday] = true;
            weekCount++;
          }
        }
      }
    });

    // Calculate current streak (consecutive days with activity, counting back from today or yesterday)
    let currentStreak = 0;
    const sortedDates = applications
      .map(app => {
        const d = new Date(app.applied_date);
        // Normalize to local midnight
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
      })
      .sort((a, b) => b.getTime() - a.getTime());

    if (sortedDates.length > 0) {
      // Start from today
      let checkDate = new Date(today);

      // Check if there's activity today, if not start from yesterday
      const hasToday = sortedDates.some(d => d.getTime() === checkDate.getTime());
      if (!hasToday) {
        checkDate.setDate(checkDate.getDate() - 1);
      }

      // Count consecutive days backwards
      while (true) {
        const hasActivity = sortedDates.some(d => d.getTime() === checkDate.getTime());

        if (hasActivity) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Calculate longest streak
    let longestStreak = 0;
    let tempStreak = 0;
    const uniqueDays = new Set(
      applications.map(app => {
        const d = new Date(app.applied_date);
        // Normalize to local midnight
        const localDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        return localDate.getTime();
      })
    );
    const sortedUniqueDays = Array.from(uniqueDays)
      .map(timestamp => new Date(timestamp))
      .sort((a, b) => a.getTime() - b.getTime());

    for (let i = 0; i < sortedUniqueDays.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        const prevDay = sortedUniqueDays[i - 1];
        const currDay = sortedUniqueDays[i];
        const diffDays = Math.round((currDay.getTime() - prevDay.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          tempStreak++;
        } else {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
        }
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    // Calculate completion rate (active days / total days since first application)
    const completionRate = sortedUniqueDays.length > 0
      ? (uniqueDays.size / sortedUniqueDays.length) * 100
      : 0;

    return {
      currentStreak,
      longestStreak,
      weekProgress: weekCount,
      completionRate,
      activeDays: weekActivity,
    };
  }, [applications]);

  // Product tour coach marks for overview dashboard
  useRegisterCoachMarks({
    page: 'overview',
    marks: [
      {
        id: 'apps-chart',
        selector: '#overview-apps-chart',
        title: 'Application Velocity',
        body: 'Track how many applications you submit over time with interactive charts. Switch between Today, 1 Week, and 1 Month views. Toggle stacked mode to compare statuses side-by-side.'
      },
      {
        id: 'status-toggle',
        selector: '#overview-status-filter-buttons',
        title: 'Focus by Status',
        body: 'Filter the dataset to highlight specific pipeline stages like Applied, Interview, Offer, or Rejected. Select multiple statuses to see combined trends. Color-coded pills make it easy to identify each status.'
      },
      {
        id: 'calendar-pane',
        selector: '#overview-calendar',
        title: 'Calendar Insight',
        body: 'Interviews and applied dates appear here so you can plan your week effectively. Click any date to see detailed application information. Switch between month and week views for different perspectives.'
      },
      {
        id: 'notifications-panel',
        selector: '#overview-notifications',
        title: 'Recent Notifications',
        body: 'Stay on top of interview scheduling, offers, and important system updates. Notifications are color-coded by type and show real-time updates from your job search activities.'
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
                <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-6 gap-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white">Applications</h2>
                    <span className="px-2 py-0.5 rounded-full bg-[#1dff00]/10 border border-[#1dff00]/20 text-xs font-medium text-[#1dff00]">
                      {totals.totalInWindow} Total
                    </span>
                  </div>

                  {/* Period Selector + Stacked Toggle */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="bg-white/5 p-1 rounded-lg flex items-center gap-1 border border-white/10">
                      {["Today", "1 Week", "1 Month"].map((period) => (
                        <button
                          key={period}
                          onClick={() => setSelectedPeriod(period)}
                          title={`Show data for ${period}`}
                          className={`text-xs px-3 py-1.5 rounded-md transition-all duration-300 font-medium ${selectedPeriod === period
                              ? "bg-[#1dff00] text-black shadow-lg shadow-[#1dff00]/20"
                              : "text-[#888] hover:text-white hover:bg-white/5"
                            }`}
                        >
                          {period}
                        </button>
                      ))}
                    </div>

                    <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block" />

                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10" title="Toggle stacked / overlapping series">
                      <span className="text-xs font-medium text-[#888]">Stacked</span>
                      <Switch
                        checked={stacked}
                        onCheckedChange={(v: boolean) => { setStackedTouched(true); setStacked(!!v); }}
                        className="scale-75 origin-right"
                      />
                    </div>
                  </div>
                </div>

                {/* Status Filter Pills */}
                <div id="overview-status-filter-buttons" data-tour="overview-status-filter-buttons" className="flex flex-wrap items-center justify-start gap-2 mb-6">
                  {['All', 'Applied', 'Interview', 'Offer', 'Rejected'].map(s => {
                    const active = s === 'All' ? !statusFilter : statusFilter?.includes(s as ApplicationStatus);
                    const baseColors: Record<string, string> = {
                      Applied: 'bg-[#1dff00]/10 text-[#1dff00] border-[#1dff00]/30 hover:bg-[#1dff00]/20',
                      Interview: 'bg-[#00b2ff]/10 text-[#56c2ff] border-[#00b2ff]/30 hover:bg-[#00b2ff]/20',
                      Offer: 'bg-[#ffd700]/10 text-[#ffd700] border-[#ffd700]/30 hover:bg-[#ffd700]/20',
                      Rejected: 'bg-[#ff4d4d]/10 text-[#ff9e9e] border-[#ff4d4d]/30 hover:bg-[#ff4d4d]/20',
                      All: 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'
                    };
                    const activeClass = active
                      ? 'ring-1 ring-white/20 shadow-lg scale-105 contrast-125'
                      : 'opacity-60 hover:opacity-100 grayscale-[0.3] hover:grayscale-0';

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
                        className={`text-xs px-3 py-1.5 rounded-md border transition-all duration-300 font-medium tracking-wide flex items-center gap-2 ${baseColors[s]} ${activeClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${s === 'All' ? 'bg-white' : 'bg-current'}`} />
                        {s}
                      </button>
                    );
                  })}
                </div>

                {/* Stats & Conversion Metrics - Enhanced Visuals */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  <motion.div whileHover={{ y: -2 }} className="p-4 rounded-xl bg-gradient-to-br from-white/5 to-transparent border border-white/5">
                    <div className="text-2xl lg:text-3xl font-bold text-white mb-1">{totals.totalInWindow}</div>
                    <div className="text-xs text-[#888] font-medium uppercase tracking-wider">Applications</div>
                  </motion.div>
                  <motion.div whileHover={{ y: -2 }} className="p-4 rounded-xl bg-gradient-to-br from-[#00b2ff]/10 to-transparent border border-[#00b2ff]/10">
                    <div className="text-2xl lg:text-3xl font-bold text-[#56c2ff] mb-1">{interviewCount}</div>
                    <div className="text-xs text-[#56c2ff]/70 font-medium uppercase tracking-wider">Interviews</div>
                  </motion.div>
                  <motion.div whileHover={{ y: -2 }} className="p-4 rounded-xl bg-gradient-to-br from-[#ffd700]/10 to-transparent border border-[#ffd700]/10">
                    <div className="text-2xl lg:text-3xl font-bold text-[#ffd700] mb-1">{Math.round(stats.offerRate * 100)}%</div>
                    <div className="text-xs text-[#ffd700]/70 font-medium uppercase tracking-wider">Offer Rate</div>
                  </motion.div>
                  <motion.div whileHover={{ y: -2 }} className="p-4 rounded-xl bg-gradient-to-br from-[#ff4d4d]/10 to-transparent border border-[#ff4d4d]/10">
                    <div className="text-2xl lg:text-3xl font-bold text-[#ff4d4d] mb-1">{Math.round(stats.rejectionRate * 100)}%</div>
                    <div className="text-xs text-[#ff4d4d]/70 font-medium uppercase tracking-wider">Rejection Rate</div>
                  </motion.div>
                </div>

                {/* Applications Chart */}
                <div id="overview-apps-chart" data-tour="overview-apps-chart" className="w-full h-72 lg:h-80 relative" aria-live="polite">
                  <div className={`w-full h-full transition-opacity duration-500 ${appsLoading ? 'opacity-0' : 'opacity-100'}`}>
                    {!appsLoading && (
                      <SplitLineAreaChart
                        data={seriesData}
                        xKey="label"
                        series={seriesMeta}
                        stacked={stacked}
                        onVisibleChange={setVisibleSeries}
                        defaultVisible={visibleSeries}
                        tickFormatter={(v) => String(v).slice(0, 3)}
                        className="h-full w-full"
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
              <Card id="overview-calendar" data-tour="overview-calendar" className="bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border border-[#1dff00]/20 backdrop-blur-[25px] p-4 sm:p-6 rounded-2xl shadow-xl hover:shadow-2xl hover:border-[#1dff00]/50 hover:shadow-[#1dff00]/20 transition-all duration-500">
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
                  <div className="flex justify-between mb-2"><span className="text-white/80 font-medium">Shortcuts</span><button onClick={() => setShowShortcuts(false)} className="text-[#1dff00] hover:underline">Close</button></div>
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
            {/* Streak Card */}
            <StreakCard
              currentStreak={streakData.currentStreak}
              weekProgress={streakData.weekProgress}
              completionRate={streakData.completionRate}
              activeDays={streakData.activeDays}
            />

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
                    onClick={() => navigate('/dashboard/notifications')}
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