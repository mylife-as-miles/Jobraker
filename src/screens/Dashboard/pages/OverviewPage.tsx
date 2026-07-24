import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  ArrowDownRight,
  Bot,
  CalendarDays,
  CheckCircle2,
  Inbox,
  Minus,
  Pause,
  Play,
  Square,
  Zap,
} from "lucide-react";
import {
  useApplications,
  ApplicationStatus,
} from "../../../hooks/useApplications";
import { Skeleton } from "../../../components/ui/skeleton";
import { useRegisterCoachMarks } from "../../../providers/TourProvider";
import { useAnalyticsData } from "../../../hooks/useAnalyticsData";
import { StreakCard } from "../../../components/StreakCard";
import { useGamification } from "../../../hooks/useGamification";
import { useProfileSettings } from "../../../hooks/useProfileSettings";
import type { Profile } from "../../../hooks/useProfileSettings";

interface OverviewPageProps {
  profile?: Profile | null;
  experienceCount?: number;
  skillCount?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUTO_APPLY_START_KEY = "jobraker:auto_apply_started_at";

const timeAgo = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

const formatInterviewDate = (iso: string): string => {
  const d = new Date(iso);
  const today = new Date();
  const startToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round(
    (startThat.getTime() - startToday.getTime()) / 86400000,
  );
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (dayDiff === 0) return `Today · ${time}`;
  if (dayDiff === 1) return `Tomorrow · ${time}`;
  return `${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${time}`;
};

const STATUS_CHIP_CLASSES: Partial<Record<ApplicationStatus, string>> = {
  Applied: "bg-brand/10 text-brand border-brand/30",
  Interview: "bg-[#00b2ff]/10 text-[#56c2ff] border-[#00b2ff]/30",
  Offer: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  Rejected: "bg-red-500/10 text-red-400 border-red-500/30",
  Failed: "bg-red-500/10 text-red-400 border-red-500/30",
  Pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  Draft: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
};

const statusChip = (status: ApplicationStatus) =>
  STATUS_CHIP_CLASSES[status] ||
  "bg-foreground/5 text-foreground/60 border-foreground/10";

// ---------------------------------------------------------------------------
// Stat card (top row)
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: number;
  deltaPct: number;
  highlight?: boolean;
  loading?: boolean;
  onOpen: () => void;
}

const StatCard = ({
  label,
  value,
  deltaPct,
  highlight = false,
  loading = false,
  onOpen,
}: StatCardProps) => {
  const rounded = Math.round(deltaPct);
  const DeltaIcon =
    rounded > 0 ? ArrowUpRight : rounded < 0 ? ArrowDownRight : Minus;
  return (
    <Card
      className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 transition-all duration-300 group hover:-translate-y-0.5 ${
        highlight
          ? "text-slate-950 border-emerald-300/60 bg-[linear-gradient(135deg,#5cf29a_0%,#2fd968_38%,#17b85f_72%,#0a7a42_100%)] shadow-[0_10px_30px_rgba(47,217,104,0.25)] hover:shadow-[0_15px_40px_rgba(47,217,104,0.4)]"
          : "bg-card/50 backdrop-blur-xl border-foreground/10 hover:border-brand/30"
      }`}
    >
      {/* Radial gloss overlay for depth */}
      {highlight && (
        <div className='absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.45)_0%,transparent_65%)] pointer-events-none' />
      )}
      <div className='relative z-10 flex items-start justify-between'>
        <span
          className={`text-xs sm:text-sm font-semibold tracking-tight ${
            highlight ? "text-slate-900/90" : "text-foreground"
          }`}
        >
          {label}
        </span>
        <button
          type='button'
          onClick={onOpen}
          aria-label={`Open ${label}`}
          className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all duration-200 ${
            highlight
              ? "bg-black/10 border-black/20 text-slate-950 hover:bg-black/20 hover:scale-105"
              : "bg-foreground/5 border-foreground/10 text-foreground/60 hover:text-brand hover:border-brand/40"
          }`}
        >
          <ArrowUpRight className='w-3.5 h-3.5' />
        </button>
      </div>
      <div
        className={`relative z-10 mt-2 text-3xl sm:text-4xl font-bold tracking-tight ${
          highlight ? "text-slate-950" : "text-foreground"
        }`}
      >
        {loading ? (
          <Skeleton
            className={`h-9 w-16 ${highlight ? "bg-black/10" : ""}`}
          />
        ) : (
          value
        )}
      </div>
      <div className='relative z-10 mt-3 flex items-center gap-2'>
        <span
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${
            highlight
              ? "bg-black/10 border-black/20 text-slate-950"
              : rounded < 0
                ? "bg-red-500/10 border-red-500/30 text-red-400"
                : "bg-brand/10 border-brand/30 text-brand"
          }`}
        >
          <DeltaIcon className='w-3 h-3' />
          {Math.abs(rounded)}%
        </span>
        <span
          className={`text-[10px] font-medium ${
            highlight ? "text-slate-900/75" : "text-muted-foreground"
          }`}
        >
          vs last 7 days
        </span>
      </div>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// Overview page
// ---------------------------------------------------------------------------

type ChartRange = "7d" | "4w" | "6m";

export const OverviewPage = (_props: OverviewPageProps): JSX.Element => {
  const navigate = useNavigate();
  const { applications, loading: appsLoading } = useApplications();
  const analytics = useAnalyticsData("7d", { granularity: "day" });
  const { profile: liveProfile, updateProfile } = useProfileSettings();
  const [chartRange, setChartRange] = useState<ChartRange>("7d");
  const [autoApplySaving, setAutoApplySaving] = useState(false);

  // Gamification: XP, streaks, achievements from DB
  const gamification = useGamification();
  const dailyLoginFired = useRef(false);

  // Emit daily_login XP event once per dashboard visit per day
  useEffect(() => {
    if (!gamification.loading && !dailyLoginFired.current) {
      dailyLoginFired.current = true;
      gamification.recordEvent("daily_login").catch(() => {});
    }
  }, [gamification.loading]);

  // Build streakData from the gamification hook (DB-backed)
  const streakData = useMemo(() => {
    const s = gamification.streak;
    const weekCount = s.week_activity.filter(Boolean).length;
    const completionRate =
      s.longest_streak > 0
        ? (s.current_streak / s.longest_streak) * 100
        : s.current_streak > 0
          ? 100
          : 0;
    return {
      currentStreak: s.current_streak,
      weekProgress: weekCount,
      completionRate,
      activeDays: s.week_activity,
    };
  }, [gamification.streak]);

  // --- Stat row -------------------------------------------------------------

  const pendingStats = useMemo(() => {
    const isPending = (s: ApplicationStatus) =>
      s === "Pending" || s === "Draft";
    const count = applications.filter((a) => isPending(a.status)).length;
    const now = Date.now();
    const last7 = applications.filter(
      (a) =>
        isPending(a.status) &&
        now - new Date(a.created_at).getTime() <= 7 * 86400000,
    ).length;
    const prev7 = applications.filter((a) => {
      if (!isPending(a.status)) return false;
      const age = now - new Date(a.created_at).getTime();
      return age > 7 * 86400000 && age <= 14 * 86400000;
    }).length;
    const deltaPct = prev7 > 0 ? ((last7 - prev7) / prev7) * 100 : last7 > 0 ? 100 : 0;
    return { count, deltaPct };
  }, [applications]);

  // --- Application Analytics bar chart --------------------------------------

  const chartBars = useMemo(() => {
    const now = new Date();
    type Bar = { label: string; value: number };
    const bars: Bar[] = [];
    const add = (label: string, start: Date, end: Date) => {
      const value = applications.filter((a) => {
        const d = new Date(a.applied_date);
        return d >= start && d < end;
      }).length;
      bars.push({ label, value });
    };

    if (chartRange === "7d") {
      for (let i = 6; i >= 0; i--) {
        const s = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 1);
        add(s.toLocaleDateString(undefined, { weekday: "narrow" }), s, e);
      }
    } else if (chartRange === "4w") {
      for (let i = 3; i >= 0; i--) {
        const e = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - i * 7 + 1,
        );
        const s = new Date(e.getFullYear(), e.getMonth(), e.getDate() - 7);
        add(
          s.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          s,
          e,
        );
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const s = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const e = new Date(s.getFullYear(), s.getMonth() + 1, 1);
        add(s.toLocaleString(undefined, { month: "narrow" }), s, e);
      }
    }
    const max = Math.max(...bars.map((b) => b.value));
    // Round the axis max up to a friendly step
    const step = max <= 5 ? 5 : max <= 10 ? 10 : Math.ceil(max / 10) * 10;
    return { bars, max, axisMax: step };
  }, [applications, chartRange]);

  const chartEmpty = !appsLoading && chartBars.max === 0;

  // --- AI Agent: next upcoming interview ------------------------------------

  const nextInterview = useMemo(() => {
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    return (
      applications
        .filter(
          (a) => a.interview_date && new Date(a.interview_date) >= startToday,
        )
        .sort(
          (a, b) =>
            new Date(a.interview_date as string).getTime() -
            new Date(b.interview_date as string).getTime(),
        )[0] || null
    );
  }, [applications]);

  // --- Recent applications --------------------------------------------------

  const recentApps = useMemo(
    () =>
      [...applications]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, 4),
    [applications],
  );

  // --- Application progress gauge -------------------------------------------

  const progress = useMemo(() => {
    const applied = applications.filter((a) => a.status === "Applied").length;
    const inReview = applications.filter(
      (a) => a.status === "Pending" || a.status === "Draft",
    ).length;
    const interview = applications.filter(
      (a) => a.status === "Interview" || a.status === "Offer",
    ).length;
    const total = applied + inReview + interview;
    const pct = total > 0 ? Math.round(((applied + interview) / total) * 100) : 0;
    const share = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
    const weekCount = applications.filter(
      (a) => Date.now() - new Date(a.applied_date).getTime() <= 7 * 86400000,
    ).length;
    return {
      pct,
      total,
      weekCount,
      legend: [
        { label: "Applied", count: applied, share: share(applied), dot: "bg-brand" },
        { label: "In Review", count: inReview, share: share(inReview), dot: "bg-yellow-400" },
        { label: "Interview", count: interview, share: share(interview), dot: "bg-[#56c2ff]" },
      ],
    };
  }, [applications]);

  // --- Live Run (auto apply) ------------------------------------------------

  // The setting toggle is the master switch; a run is only actually "live"
  // when Auto Apply is on AND there are jobs queued for it to work through.
  const autoApplyEnabled = Boolean(liveProfile?.auto_apply_auto_submit);

  const queuedCount = useMemo(
    () => applications.filter((a) => a.canonical_stage === "queued").length,
    [applications],
  );

  const runActive = autoApplyEnabled && queuedCount > 0;

  const autoSentToday = useMemo(() => {
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    return applications.filter((a) => {
      const automated =
        a.run_id || a.automation_provider || a.draft_status === "sent";
      return automated && new Date(a.applied_date) >= startToday;
    }).length;
  }, [applications]);

  const setAutoApply = async (enabled: boolean) => {
    if (autoApplySaving || !liveProfile) return;
    setAutoApplySaving(true);
    try {
      await updateProfile({ auto_apply_auto_submit: enabled } as Partial<Profile>);
    } catch {
      // updateProfile surfaces its own error handling
    } finally {
      setAutoApplySaving(false);
    }
  };

  // Live Run runtime: count up from when Auto Apply was turned on. The start
  // time is persisted so the timer survives reloads, and cleared when paused —
  // it reflects how long the current run has actually been active.
  const [runtimeLabel, setRuntimeLabel] = useState("00:00:00");

  useEffect(() => {
    const format = (ms: number) => {
      const total = Math.max(0, Math.floor(ms / 1000));
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
    };

    if (!runActive) {
      try {
        localStorage.removeItem(AUTO_APPLY_START_KEY);
      } catch {}
      setRuntimeLabel("00:00:00");
      return;
    }

    // Resume from the stored start, or anchor a new one if none/invalid.
    let start = Date.now();
    try {
      const stored = localStorage.getItem(AUTO_APPLY_START_KEY);
      const parsed = stored ? Number.parseInt(stored, 10) : NaN;
      if (Number.isFinite(parsed) && parsed > 0 && parsed <= Date.now()) {
        start = parsed;
      } else {
        localStorage.setItem(AUTO_APPLY_START_KEY, String(start));
      }
    } catch {
      /* localStorage unavailable — fall back to session-only start */
    }

    setRuntimeLabel(format(Date.now() - start));
    const id = window.setInterval(
      () => setRuntimeLabel(format(Date.now() - start)),
      1000,
    );
    return () => window.clearInterval(id);
  }, [runActive]);

  // --- Tour coach marks -----------------------------------------------------

  useRegisterCoachMarks({
    page: "overview",
    marks: [
      {
        id: "stats-row",
        selector: "#overview-stats",
        title: "Your key numbers",
        body: "Jobs matched, applications sent, interviews, and pending reviews — each compared against the previous 7 days.",
      },
      {
        id: "apps-chart",
        selector: "#overview-apps-chart",
        title: "Application Analytics",
        body: "How many applications you submitted per day. Switch the range to zoom out to weeks or months.",
      },
      {
        id: "streak-card",
        selector: "#overview-streak",
        title: "Daily streak",
        body: "Log in and take actions every day to grow your streak.",
      },
      {
        id: "recent-apps",
        selector: "#overview-recent-apps",
        title: "Recent applications",
        body: "Your latest applications with live status. Click through to manage the full pipeline.",
      },
      {
        id: "live-run",
        selector: "#overview-live-run",
        title: "Auto Apply",
        body: "See whether Auto Apply is running and how many applications it sent today. Pause or resume it from here.",
      },
    ],
  });

  // Semicircle gauge geometry
  const GAUGE_LEN = Math.PI * 80; // radius 80

  return (
    <div className='product-page-shell min-h-full'>
      <div className='w-full max-w-7xl mx-auto p-3 sm:p-4 lg:p-6 xl:p-8 space-y-4 sm:space-y-6'>
        {/* Row 1 — Stat cards */}
        <div
          id='overview-stats'
          data-tour='overview-stats'
          className='grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4'
        >
          <StatCard
            label='Jobs Matched'
            value={analytics.metrics.jobsFound}
            deltaPct={analytics.comparisons.jobsFoundDeltaPct}
            highlight
            loading={analytics.loading}
            onOpen={() => navigate("/dashboard/jobs")}
          />
          <StatCard
            label='Applications Sent'
            value={analytics.metrics.applications}
            deltaPct={analytics.comparisons.applicationsDeltaPct}
            loading={analytics.loading}
            onOpen={() => navigate("/dashboard/application")}
          />
          <StatCard
            label='Interviews'
            value={analytics.metrics.interviews}
            deltaPct={analytics.comparisons.interviewsDeltaPct}
            loading={analytics.loading}
            onOpen={() => navigate("/dashboard/application")}
          />
          <StatCard
            label='Pending Review'
            value={pendingStats.count}
            deltaPct={pendingStats.deltaPct}
            loading={appsLoading}
            onOpen={() => navigate("/dashboard/application")}
          />
        </div>

        {/* Row 2 — Analytics chart | AI Agent | Streak */}
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 items-stretch'>
          {/* Application Analytics */}
          <Card
            id='overview-apps-chart'
            data-tour='overview-apps-chart'
            className='rounded-2xl border border-foreground/10 bg-card/50 backdrop-blur-xl p-4 sm:p-5 flex flex-col'
          >
            <div className='flex items-center justify-between mb-4'>
              <h2 className='text-sm sm:text-base font-semibold text-foreground tracking-tight'>
                Application Analytics
              </h2>
              <select
                value={chartRange}
                onChange={(e) => setChartRange(e.target.value as ChartRange)}
                aria-label='Analytics range'
                className='text-[10px] sm:text-xs font-medium rounded-full border border-foreground/10 bg-foreground/5 text-foreground/80 px-2.5 py-1 outline-none hover:border-brand/40 focus:border-brand/40 transition-colors cursor-pointer'
              >
                <option value='7d'>Last 7 Days</option>
                <option value='4w'>Last 4 Weeks</option>
                <option value='6m'>Last 6 Months</option>
              </select>
            </div>

            <div className='flex-1 min-h-[180px] flex gap-2 relative'>
              {/* Y axis */}
              <div className='flex flex-col justify-between text-[9px] text-foreground/40 font-medium pb-5 shrink-0 text-right'>
                {[4, 3, 2, 1, 0].map((t) => (
                  <span key={t}>
                    {Math.round((chartBars.axisMax / 4) * t)}
                  </span>
                ))}
              </div>
              {/* Bars */}
              <div className='flex-1 flex items-end justify-between gap-2 sm:gap-3'>
                {chartBars.bars.map((bar, i) => {
                  const h =
                    chartBars.axisMax > 0
                      ? (bar.value / chartBars.axisMax) * 100
                      : 0;
                  const isPeak =
                    chartBars.max > 0 && bar.value === chartBars.max;
                  return (
                    <div
                      key={`${bar.label}-${i}`}
                      className='flex-1 flex flex-col items-center gap-1.5 h-full justify-end'
                    >
                      <div className='w-full flex-1 flex items-end justify-center'>
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(h, bar.value > 0 ? 6 : 2)}%` }}
                          transition={{ duration: 0.6, delay: i * 0.05, ease: "easeOut" }}
                          title={`${bar.value} application${bar.value === 1 ? "" : "s"}`}
                          className={`w-2/3 max-w-[26px] rounded-full ${
                            bar.value === 0
                              ? "bg-foreground/[0.06]"
                              : isPeak
                                ? "bg-brand shadow-[0_0_12px_rgba(47,217,104,0.35)]"
                                : "bg-brand/35"
                          }`}
                        />
                      </div>
                      <span className='text-[9px] text-foreground/40 font-medium'>
                        {bar.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              {chartEmpty && (
                <div className='absolute inset-0 flex items-center justify-center'>
                  <div className='text-center px-4 py-3 rounded-xl border border-dashed border-foreground/15 bg-background/60 backdrop-blur-sm'>
                    <p className='text-xs text-foreground/70 font-medium'>
                      No applications in this period
                    </p>
                    <button
                      type='button'
                      onClick={() => navigate("/dashboard/jobs")}
                      className='mt-1 text-[10px] text-brand hover:underline font-semibold'
                    >
                      Find jobs to apply →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* AI Agent */}
          <Card className='rounded-2xl border border-foreground/10 bg-card/50 backdrop-blur-xl p-4 sm:p-5 flex flex-col'>
            <div className='flex items-center gap-2.5 mb-4'>
              <div className='w-9 h-9 rounded-xl bg-gradient-to-br from-brand/20 to-brand/5 border border-brand/30 flex items-center justify-center shadow-inner'>
                <Bot className='w-4 h-4 text-brand' />
              </div>
              <h2 className='text-sm sm:text-base font-semibold text-foreground tracking-tight'>
                AI Agent
              </h2>
            </div>

            {nextInterview ? (
              <>
                <p className='text-sm text-muted-foreground'>Interview with</p>
                <p className='text-xl sm:text-2xl font-bold text-foreground tracking-tight mt-0.5 truncate'>
                  {nextInterview.company || nextInterview.job_title}
                </p>
                <div className='mt-2 flex items-center gap-1.5 text-xs text-muted-foreground'>
                  <CalendarDays className='w-3.5 h-3.5 text-brand' />
                  {formatInterviewDate(nextInterview.interview_date as string)}
                </div>
                <div className='mt-3 flex flex-wrap gap-1.5'>
                  <span className='px-2 py-0.5 rounded-full border border-foreground/10 bg-foreground/5 text-[10px] font-medium text-foreground/70 truncate max-w-[160px]'>
                    {nextInterview.job_title}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${statusChip(nextInterview.status)}`}
                  >
                    {nextInterview.status}
                  </span>
                </div>
                <Button
                  onClick={() => navigate("/dashboard/application")}
                  className='mt-auto w-full bg-brand text-black hover:bg-brand/90 rounded-xl font-semibold text-sm h-10 gap-2 !mt-4'
                >
                  <Play className='w-4 h-4 fill-current' />
                  Open Session
                </Button>
              </>
            ) : (
              <>
                <p className='text-sm text-muted-foreground'>
                  Upcoming interview
                </p>
                <p className='text-xl sm:text-2xl font-bold text-foreground/60 tracking-tight mt-0.5'>
                  Nothing scheduled
                </p>
                <div className='mt-2 flex items-center gap-1.5 text-xs text-muted-foreground'>
                  <CalendarDays className='w-3.5 h-3.5 text-foreground/40' />
                  Interviews you land will show up here
                </div>
                <Button
                  onClick={() => navigate("/dashboard/jobs")}
                  variant='outline'
                  className='mt-auto w-full rounded-xl font-semibold text-sm h-10 gap-2 border-brand/30 text-brand hover:bg-brand/10 hover:text-brand !mt-4'
                >
                  Find Jobs
                </Button>
              </>
            )}
          </Card>

          {/* Streak (replaces Opportunity Pipeline) */}
          <div id='overview-streak' data-tour='overview-streak'>
            <StreakCard
              currentStreak={streakData.currentStreak}
              weekProgress={streakData.weekProgress}
              completionRate={streakData.completionRate}
              activeDays={streakData.activeDays}
            />
          </div>
        </div>

        {/* Row 3 — Recent Applications | Application Progress | Live Run */}
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 items-stretch'>
          {/* Recent Applications */}
          <Card
            id='overview-recent-apps'
            data-tour='overview-recent-apps'
            className='rounded-2xl border border-foreground/10 bg-card/50 backdrop-blur-xl p-4 sm:p-5 flex flex-col'
          >
            <div className='flex items-center justify-between mb-4'>
              <h2 className='text-sm sm:text-base font-semibold text-foreground tracking-tight'>
                Recent Applications
              </h2>
              <button
                type='button'
                onClick={() => navigate("/dashboard/application")}
                className='text-[10px] sm:text-xs font-medium rounded-full border border-foreground/10 bg-foreground/5 text-foreground/80 px-2.5 py-1 hover:border-brand/40 hover:text-brand transition-colors'
              >
                View All
              </button>
            </div>

            {appsLoading ? (
              <div className='space-y-2.5'>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className='flex items-center gap-3 p-2 rounded-xl'>
                    <Skeleton className='w-9 h-9 rounded-xl' />
                    <div className='flex-1 space-y-1.5'>
                      <Skeleton className='h-3 w-2/3' />
                      <Skeleton className='h-2.5 w-1/2' />
                    </div>
                    <Skeleton className='h-5 w-14 rounded-full' />
                  </div>
                ))}
              </div>
            ) : recentApps.length === 0 ? (
              <div className='flex-1 flex items-center justify-center p-6 border border-dashed border-brand/30 rounded-xl bg-foreground/5'>
                <div className='text-center'>
                  <Inbox className='w-6 h-6 text-brand mx-auto mb-2' />
                  <p className='text-sm text-foreground/70 font-medium'>
                    No applications yet
                  </p>
                  <button
                    type='button'
                    onClick={() => navigate("/dashboard/jobs")}
                    className='mt-1 text-xs text-brand hover:underline font-semibold'
                  >
                    Browse jobs to get started →
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className='space-y-1.5 flex-1'>
                  {recentApps.map((app, i) => (
                    <motion.button
                      key={app.id}
                      type='button'
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: i * 0.05 }}
                      onClick={() => navigate("/dashboard/application")}
                      className='w-full flex items-center gap-3 p-2 rounded-xl hover:bg-foreground/5 border border-transparent hover:border-foreground/10 transition-all text-left group'
                    >
                      <div className='w-9 h-9 rounded-xl bg-foreground/5 border border-foreground/10 flex items-center justify-center overflow-hidden shrink-0'>
                        {app.logo ? (
                          <img
                            src={app.logo}
                            alt=''
                            className='w-5 h-5 object-contain'
                          />
                        ) : (
                          <span className='text-xs font-bold text-brand'>
                            {(app.company || "?").charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className='flex-1 min-w-0'>
                        <p className='text-xs sm:text-sm font-semibold text-foreground truncate'>
                          {app.company || app.job_title}
                        </p>
                        <p className='text-[10px] text-muted-foreground truncate'>
                          {app.job_title}
                          {app.location ? ` · ${app.location}` : ""}
                        </p>
                      </div>
                      <div className='flex flex-col items-end gap-1 shrink-0'>
                        <span
                          className={`px-2 py-0.5 rounded-full border text-[9px] font-semibold ${statusChip(app.status)}`}
                        >
                          {app.status}
                        </span>
                        <span className='text-[9px] text-foreground/40'>
                          {timeAgo(app.created_at)}
                        </span>
                      </div>
                    </motion.button>
                  ))}
                </div>
                <button
                  type='button'
                  onClick={() => navigate("/dashboard/application")}
                  className='mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline w-fit'
                >
                  View all applications
                  <ArrowUpRight className='w-3 h-3' />
                </button>
              </>
            )}
          </Card>

          {/* Application Progress */}
          <Card className='rounded-2xl border border-foreground/10 bg-card/50 backdrop-blur-xl p-4 sm:p-5 flex flex-col'>
            <h2 className='text-sm sm:text-base font-semibold text-foreground tracking-tight mb-2'>
              Application Progress
            </h2>

            <div className='flex-1 flex flex-col items-center justify-center'>
              <div className='relative w-full max-w-[220px]'>
                <svg viewBox='0 0 200 110' className='w-full'>
                  <path
                    d='M 20 100 A 80 80 0 0 1 180 100'
                    fill='none'
                    stroke='currentColor'
                    className='text-foreground/10'
                    strokeWidth='14'
                    strokeLinecap='round'
                  />
                  <motion.path
                    d='M 20 100 A 80 80 0 0 1 180 100'
                    fill='none'
                    stroke='#2fd968'
                    strokeWidth='14'
                    strokeLinecap='round'
                    strokeDasharray={GAUGE_LEN}
                    initial={{ strokeDashoffset: GAUGE_LEN }}
                    animate={{
                      strokeDashoffset:
                        GAUGE_LEN * (1 - progress.pct / 100),
                    }}
                    transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                    style={{
                      filter:
                        progress.pct > 0
                          ? "drop-shadow(0 0 6px rgba(47,217,104,0.4))"
                          : undefined,
                    }}
                  />
                </svg>
                <div className='absolute inset-x-0 bottom-0 text-center'>
                  <div className='text-2xl sm:text-3xl font-bold text-foreground'>
                    {progress.pct}%
                  </div>
                  <div className='text-[10px] text-muted-foreground font-medium uppercase tracking-wider'>
                    Progress
                  </div>
                </div>
              </div>

              <div className='mt-4 w-full grid grid-cols-3 gap-2'>
                {progress.legend.map((item) => (
                  <div key={item.label} className='text-center'>
                    <div className='flex items-center justify-center gap-1'>
                      <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
                      <span className='text-[9px] text-foreground/50 font-medium uppercase tracking-wide'>
                        {item.label}
                      </span>
                    </div>
                    <div className='text-[10px] font-bold text-foreground mt-0.5'>
                      {item.count} ({item.share}%)
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className='mt-4 pt-3 border-t border-foreground/10 flex items-center gap-1.5 text-[10px] text-muted-foreground'>
              <Zap className='w-3 h-3 text-brand shrink-0' />
              {progress.total > 0
                ? `Keep it up! ${progress.weekCount} application${progress.weekCount === 1 ? "" : "s"} in the last 7 days.`
                : "Start applying to see your pipeline progress here."}
            </div>
          </Card>

          {/* Live Run */}
          <Card
            id='overview-live-run'
            data-tour='overview-live-run'
            className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 flex flex-col ${
              runActive
                ? "border-brand/40 bg-[radial-gradient(circle_at_top,rgba(47,217,104,0.12),transparent_55%)] bg-card"
                : "border-foreground/10 bg-card/50 backdrop-blur-xl"
            }`}
          >
            <div className='absolute -top-20 -right-20 w-56 h-56 rounded-full bg-brand/5 blur-3xl' />
            <div className='relative z-10 flex items-center justify-between mb-4'>
              <div className='flex items-center gap-2'>
                <span
                  className={`w-2 h-2 rounded-full ${
                    runActive
                      ? "bg-brand animate-pulse shadow-[0_0_8px_rgba(47,217,104,0.6)]"
                      : autoApplyEnabled
                        ? "bg-brand/60"
                        : "bg-foreground/30"
                  }`}
                />
                <h2 className='text-sm sm:text-base font-semibold text-foreground tracking-tight'>
                  Live Run
                </h2>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wide border ${
                  runActive
                    ? "bg-brand text-black border-brand"
                    : autoApplyEnabled
                      ? "bg-brand/10 text-brand border-brand/30"
                      : "bg-foreground/5 text-foreground/50 border-foreground/10"
                }`}
              >
                {runActive
                  ? "Running"
                  : autoApplyEnabled
                    ? "Auto Apply Idle"
                    : "Auto Apply Off"}
              </span>
            </div>

            <div className='relative z-10 flex-1 flex flex-col items-center justify-center text-center'>
              <p className='text-xs text-muted-foreground font-medium'>
                {runActive ? "Session runtime" : "Applications sent"}
              </p>
              <div
                className={`mt-1 text-4xl sm:text-5xl font-bold font-mono tracking-tight tabular-nums ${
                  runActive ? "text-foreground" : "text-foreground/50"
                }`}
              >
                {runActive
                  ? runtimeLabel
                  : String(autoSentToday).padStart(2, "0")}
              </div>
              <p className='mt-2 text-[10px] text-muted-foreground'>
                {runActive ? (
                  <span className='inline-flex items-center gap-1.5'>
                    Finding matches
                    <span className='w-1 h-1 rounded-full bg-brand' />
                    Customizing
                    <span className='w-1 h-1 rounded-full bg-brand' />
                    Applying
                  </span>
                ) : autoApplyEnabled ? (
                  "Waiting for new matches to apply"
                ) : (
                  "Resume Auto Apply to keep applying for you"
                )}
              </p>

              <div className='mt-4 flex items-center gap-3'>
                <button
                  type='button'
                  disabled={autoApplySaving || !liveProfile}
                  onClick={() => setAutoApply(!autoApplyEnabled)}
                  aria-label={
                    autoApplyEnabled ? "Pause Auto Apply" : "Resume Auto Apply"
                  }
                  className='w-11 h-11 rounded-full bg-foreground/10 border border-foreground/15 flex items-center justify-center text-foreground hover:border-brand/40 hover:text-brand transition-all disabled:opacity-40 disabled:cursor-not-allowed'
                >
                  {autoApplyEnabled ? (
                    <Pause className='w-4 h-4 fill-current' />
                  ) : (
                    <Play className='w-4 h-4 fill-current' />
                  )}
                </button>
                <button
                  type='button'
                  disabled={autoApplySaving || !liveProfile || !autoApplyEnabled}
                  onClick={() => setAutoApply(false)}
                  aria-label='Stop Auto Apply'
                  className='w-11 h-11 rounded-full bg-red-500/90 border border-red-500 flex items-center justify-center text-white hover:bg-red-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed'
                >
                  <Square className='w-3.5 h-3.5 fill-current' />
                </button>
              </div>
            </div>

            <div className='relative z-10 mt-4 pt-3 border-t border-foreground/10 flex items-center justify-center gap-1.5 text-[10px] font-medium'>
              {runActive ? (
                <>
                  <CheckCircle2 className='w-3.5 h-3.5 text-brand' />
                  <span className='text-foreground/70'>
                    {queuedCount} in queue · AI Agent running smoothly
                  </span>
                </>
              ) : (
                <span className='text-foreground/40'>
                  {autoSentToday > 0 ? `${autoSentToday} sent today · ` : ""}
                  {autoApplyEnabled
                    ? "Idle — no jobs in the queue"
                    : "Auto Apply is paused"}
                </span>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
