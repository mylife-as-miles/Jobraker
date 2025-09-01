import { useEffect, useMemo, useState } from "react";
import { MatchScoreAnalytics } from "../../../components/analytics/MatchScoreAnalytics";
import { Switch } from "../../../components/ui/switch";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { motion } from "framer-motion";
import { Building2, AlertCircle, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { useNotifications } from "../../../hooks/useNotifications";
import { useApplications } from "../../../hooks/useApplications";
import { SplitLineAreaChart } from "./SplitLineAreaChart";
// SplitLineAreaChart removed; chart moved to Application section

// Using realtime notifications; no local interface needed here

export const OverviewPage = (): JSX.Element => {
  const [selectedPeriod, setSelectedPeriod] = useState("1 Month");
  const [stacked, setStacked] = useState(false);
  const [stackedTouched, setStackedTouched] = useState(false);
  const [visibleSeries, setVisibleSeries] = useState<string[]>([]);
  const { items: notifItems, loading: notifLoading } = useNotifications(6);
  const { applications } = useApplications();
  const mappedNotifs = useMemo(() => {
    return notifItems.map(n => ({
      id: n.id,
      type: n.type as any,
      title: n.title,
      message: n.message || '',
      time: new Date(n.created_at).toLocaleString(),
      icon: (
        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center"
             style={{ backgroundColor: n.type === 'company' ? '#000' : n.type === 'application' ? '#4285f4' : n.type === 'interview' ? '#0077b5' : '#ff6b6b' }}>
          {n.type === 'company' ? (
            <span className="text-[#1dff00] font-bold text-xs sm:text-sm">{(n.company || 'C').charAt(0).toUpperCase()}</span>
          ) : n.type === 'application' ? (
            <span className="text-[#1dff00] font-bold text-xs sm:text-sm">{(n.company || 'A').charAt(0).toUpperCase()}</span>
          ) : n.type === 'interview' ? (
            <Building2 className="w-3 h-3 sm:w-4 sm:h-4 text-[#1dff00]" />
          ) : (
            <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 text-[#1dff00]" />
          )}
        </div>
      )
    }));
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

  const monthLabel = useMemo(() =>
    viewDate.toLocaleString(undefined, { month: 'long', year: 'numeric' }),
  [viewDate]);

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
    const period = selectedPeriod

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
    for (const app of applications) {
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

    const series = statuses.map((s, i) => ({
      key: s,
      label: s,
      color: i === 0 ? "#1dff00" : i === 1 ? "#00ff7f" : i === 2 ? "#32cd32" : i === 3 ? "#00ff00" : "#90ee90",
    }))

  return { seriesData: data, seriesMeta: series, appliedCount: applied, interviewCount: interviews, totals: { totalInWindow } }
  }, [applications, now, selectedPeriod])

  // Build a 6x7 calendar grid (42 cells)
  const monthGrid = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startDay = firstOfMonth.getDay(); // 0=Sun..6=Sat
    const cells: { date: Date; inCurrentMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const dayNum = i - startDay + 1; // can be <=0 or > daysInMonth
      const cellDate = new Date(year, month, dayNum);
      cells.push({
        date: cellDate,
        inCurrentMonth: cellDate.getMonth() === month,
      });
    }
    return cells;
  }, [viewDate]);

  const isToday = (d: Date) =>
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  return (
    <div className="min-h-screen bg-black">
      <div className="w-full max-w-7xl mx-auto p-3 sm:p-4 lg:p-6 xl:p-8">
        {/* Responsive overview layout */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* Left Column - Applications and Match Score */}
          <div className="xl:col-span-2 space-y-4 sm:space-y-6">
            {/* Applications Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              whileHover={{ scale: 1.02 }}
              className="transition-transform duration-300"
            >
              <Card className="bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border border-[#1dff00]/20 backdrop-blur-[25px] p-6 sm:p-8 lg:p-10 rounded-2xl shadow-xl hover:shadow-2xl hover:border-[#1dff00]/50 hover:shadow-[#1dff00]/20 transition-all duration-500">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-2">
                  <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white">Applications</h2>
                  <div className="text-left sm:text-right">
                    <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#1dff00]">{appliedCount}/{interviewCount}</span>
                  </div>
                </div>

                {/* Period Selector + Stacked Toggle */}
                <div className="flex flex-wrap items-center gap-2 mb-4 sm:mb-6">
                  {["Today", "1 Week", "1 Month"].map((period) => (
                    <Button
                      key={period}
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedPeriod(period)}
                      className={`text-xs sm:text-sm transition-all duration-300 hover:scale-105 ${
                        selectedPeriod === period
                          ? "bg-[#1dff00] text-black hover:bg-[#1dff00]/90"
                          : "text-white hover:text-[#1dff00] hover:bg-[#1dff00]/10"
                      }`}
                    >
                      {period}
                    </Button>
                  ))}

          <div className="ml-auto flex items-center gap-2 text-xs sm:text-sm text-[#888]">
                    <span>Stacked</span>
                    <Switch
            checked={stacked && visibleSeries.length > 1}
            onCheckedChange={(v: boolean) => { setStackedTouched(true); setStacked(!!v); }}
            disabled={visibleSeries.length <= 1}
                    />
                  </div>
                </div>

                {/* Stats */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-8 space-y-4 sm:space-y-0 mb-4 sm:mb-6">
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
                </div>

                {/* Applications Chart (real data, status series) */}
                <div className="mt-2 sm:mt-4 min-h-[32rem] sm:min-h-[36rem] lg:min-h-[40rem]">
                  <SplitLineAreaChart
                    data={seriesData}
                    xKey="label"
          series={seriesMeta}
                    stacked={stacked}
          showLegend
                    onVisibleChange={setVisibleSeries}
                    defaultVisible={visibleSeries}
                    tickFormatter={(v) => String(v).slice(0, 3)}
                    className="h-96 sm:h-[28rem] lg:h-[32rem] xl:h-[36rem] w-full"
                  />
                </div>
              </Card>
            </motion.div>

            {/* Match Score Analytics Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              whileHover={{ scale: 1.02 }}
              className="transition-transform duration-300"
            >
              <Card className="bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border border-[#1dff00]/20 backdrop-blur-[25px] p-4 sm:p-6 rounded-2xl shadow-xl hover:shadow-2xl hover:border-[#1dff00]/50 hover:shadow-[#1dff00]/20 transition-all duration-500">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white">Recent Match Scores</h2>
                </div>
                <MatchScoreAnalytics />
              </Card>
            </motion.div>
          </div>

          {/* Right Column - Notifications and Calendar */}
          <div className="space-y-4 sm:space-y-6">
            {/* Notifications */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              whileHover={{ scale: 1.02 }}
              className="transition-transform duration-300"
            >
              <Card className="bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border border-[#1dff00]/20 backdrop-blur-[25px] p-4 sm:p-6 rounded-2xl shadow-xl hover:shadow-2xl hover:border-[#1dff00]/50 hover:shadow-[#1dff00]/20 transition-all duration-500">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white">Notification</h2>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-white hover:text-white/80 hover:bg-white/10 hover:scale-105 transition-all duration-300 text-xs sm:text-sm"
                  >
                    See more
                  </Button>
                </div>

                <div className="space-y-3 sm:space-y-4">
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
                  {mappedNotifs.map((notification, index) => (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: 0.1 * index }}
                      whileHover={{ scale: 1.02, x: 4 }}
                      className="flex items-start space-x-2 sm:space-x-3 p-2 sm:p-3 bg-gradient-to-r from-[#111111] to-[#0a0a0a] rounded-lg border border-[#1dff00]/10 hover:bg-gradient-to-r hover:from-[#1dff00]/10 hover:to-[#0a8246]/10 hover:border-[#1dff00]/30 transition-all duration-300 cursor-pointer"
                    >
                      {notification.icon}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm text-[#1dff00] font-medium leading-relaxed">{notification.title}</p>
                        <p className="text-xs text-[#666666] mt-1">{notification.time}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* Calendar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              whileHover={{ scale: 1.02 }}
              className="transition-transform duration-300"
            >
              <Card className="bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border border-[#1dff00]/20 backdrop-blur-[25px] p-4 sm:p-6 rounded-2xl shadow-xl hover:shadow-2xl hover:border-[#1dff00]/50 hover:shadow-[#1dff00]/20 transition-all duration-500">
                <div className="flex items-center justify-between mb-2 sm:mb-4">
                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                      className="text-[#1dff00] hover:bg-[#1dff00]/10 hover:scale-110 p-1 sm:p-2 transition-all duration-300"
                    >
                      <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                    </Button>
                  </div>
                  <h2 className="text-sm sm:text-lg lg:text-xl font-bold text-white">{monthLabel}</h2>
                  <div className="flex items-center gap-1 sm:gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewDate(new Date(now.getFullYear(), now.getMonth(), 1))}
                      className="text-white border border-white/10 hover:border-[#1dff00]/40 hover:bg-white/5 hover:text-[#1dff00] transition-all duration-300 px-2 py-1"
                    >
                      Today
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                      className="text-[#1dff00] hover:bg-[#1dff00]/10 hover:scale-110 p-1 sm:p-2 transition-all duration-300"
                    >
                      <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                    </Button>
                  </div>
                </div>

                {/* Live current time */}
                <div className="text-center text-[10px] sm:text-xs text-[#888888] mb-3">
                  Current time: <span className="text-[#1dff00] font-medium">{timeLabel}</span>
                </div>

                {/* Calendar Header */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day) => (
                    <div key={day} className="text-center text-xs text-[#666666] font-medium py-1 sm:py-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-1">
                  {monthGrid.map(({ date, inCurrentMonth }, idx) => (
                    <motion.div
                      key={`${date.toISOString()}-${idx}`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.97 }}
                      className={`relative text-center text-xs py-1 sm:py-2 rounded-lg transition-all duration-200 cursor-pointer ${
                        isToday(date) && inCurrentMonth
                          ? 'bg-[#1dff00] text-black font-bold shadow-lg'
                          : inCurrentMonth
                          ? 'text-[#888888] hover:bg-[#1dff00]/10 hover:text-[#1dff00]'
                          : 'text-[#333333] hover:bg-[#1dff00]/10'
                      }`}
                    >
                      {date.getDate()}
                    </motion.div>
                  ))}
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};