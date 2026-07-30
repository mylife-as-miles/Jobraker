import { useState, useEffect, useMemo } from "react";
import { useRegisterCoachMarks } from "../../../providers/TourProvider";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { RefreshCw, BarChart2, BrainCircuit } from "lucide-react";
import { AnalyticsContent } from "../../../components/analytics/AnalyticsContent";
import { useAnalyticsData } from "../../../hooks/useAnalyticsData";
import { useInsightsData } from "../../../hooks/useInsightsData";
import { UpgradePrompt } from "../../../components/UpgradePrompt";
import { useSubscriptionTier } from "@/hooks/useSubscriptionTier";
import { hasSubscriptionAccess } from "@/lib/subscriptionAccess";
import { RouteLoadingFallback } from "@/components/system/RouteLoadingFallback";
import { useProfileSettings } from "../../../hooks/useProfileSettings";
import { CandidateMemoryEditor } from "../components/CandidateMemoryEditor";
import { cn } from "@/lib/utils";

type Period = "7d" | "30d" | "90d" | "ytd" | "12m";
type Granularity = "day" | "week" | "month";
type ActiveTab = "analytics" | "candidate-memory";

export function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("analytics");
  const [period, setPeriod] = useState<Period>("30d");
  const [granularity, setGranularity] = useState<Granularity>(
    (localStorage.getItem("analytics:granularity") as Granularity) || "day",
  );
  const { subscriptionTier, loadingTier } = useSubscriptionTier();
  const hasAnalyticsAccess = hasSubscriptionAccess(subscriptionTier, "Pro");
  const analytics = useAnalyticsData(period, {
    granularity,
    enabled: hasAnalyticsAccess,
  });
  const insights = useInsightsData(period, granularity, analytics, {
    enabled: hasAnalyticsAccess,
  });

  const { profile, loadingProfile, updateProfile } = useProfileSettings();

  // Initialize from URL (deep links inside dashboard context)
  useEffect(() => {
    try {
      const usp = new URLSearchParams(window.location.search);
      const p = usp.get("period") as Period | null;
      const g = usp.get("g") as Granularity | null;
      const tab = usp.get("tab") as ActiveTab | null;
      if (p && ["7d", "30d", "90d", "ytd", "12m"].includes(p)) setPeriod(p);
      if (g && ["day", "week", "month"].includes(g)) setGranularity(g);
      if (tab && ["analytics", "candidate-memory"].includes(tab)) setActiveTab(tab);
    } catch {}
  }, []);

  const setTabAndPersist = (t: ActiveTab) => {
    setActiveTab(t);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", t);
      window.history.replaceState({}, "", url.toString());
    } catch {}
  };

  const setPeriodAndPersist = (p: Period) => {
    setPeriod(p);
    try {
      localStorage.setItem("analytics:period", p);
      const url = new URL(window.location.href);
      url.searchParams.set("period", p);
      url.searchParams.set("g", granularity);
      window.history.replaceState({}, "", url.toString());
    } catch {}
  };

  const setGranularityAndPersist = (g: Granularity) => {
    setGranularity(g);
    try {
      localStorage.setItem("analytics:granularity", g);
      const url = new URL(window.location.href);
      url.searchParams.set("g", g);
      url.searchParams.set("period", period);
      window.history.replaceState({}, "", url.toString());
    } catch {}
  };

  const periodLabel = useMemo(() => {
    switch (period) {
      case "7d":
        return "Last 7 days";
      case "30d":
        return "Last 30 days";
      case "90d":
        return "Last 90 days";
      case "ytd":
        return "Year to date";
      case "12m":
        return "Last 12 months";
      default:
        return "Custom";
    }
  }, [period]);

  useRegisterCoachMarks({
    page: "analytics",
    marks: [
      {
        id: "analytics-controls",
        selector: "#analytics-controls",
        title: "Adjust Time & Detail",
        body: "Switch period and granularity to zoom into recent patterns or long-term trends.",
      },
      {
        id: "analytics-main-card",
        selector: "#analytics-main-card",
        title: "Performance Insights",
        body: "Aggregated application outcomes, velocity and conversion metrics live here.",
      },
    ],
  });

  return (
    <div className='relative min-h-full '>
      {/* Ambient Background Glow */}
      <div className='fixed top-20 right-0 h-96 w-96 bg-brand/5 rounded-full blur-3xl opacity-30 pointer-events-none -z-10'></div>
      <div className='fixed bottom-0 left-0 h-96 w-96 bg-brand/5 rounded-full blur-3xl opacity-20 pointer-events-none -z-10'></div>

      <div className='relative space-y-6 p-4 sm:p-6 lg:p-8 mx-auto max-w-7xl'>
        {loadingTier ? <RouteLoadingFallback/> : !hasAnalyticsAccess ? (
          <UpgradePrompt
            title='Advanced Analytics'
            description='Unlock conversion trends, exports, match-score reporting, and candidate memory intelligence.'
            requiredTier='Pro'
            features={[
              {
                title: "Pipeline performance",
                description:
                  "Track applications, interviews, and source quality over time.",
              },
              {
                title: "Candidate Memory Intelligence",
                description:
                  "Ground evaluations in preferred narratives, proof points & story bank.",
              },
              {
                title: "Exports",
                description: "Download your analytics as CSV or JSON.",
              },
            ]}
          />
        ) : (
          <>
            {/* Header & Sub-navigation Tabs */}
            <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8 border-b border-border/40 pb-5'>
              <div className='space-y-1'>
                <h1 className='text-3xl sm:text-4xl font-bold text-foreground bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text'>
                  Analytics & Memory
                </h1>
                <p className='text-sm sm:text-base text-muted-foreground'>
                  Track pipeline outcomes, conversion velocity, and career ops memory
                </p>
              </div>

              {/* Navigation Pill Switcher */}
              <div className='flex items-center gap-1.5 p-1 bg-[#090909] border border-brand/30 rounded-2xl shrink-0 shadow-lg shadow-brand/5'>
                <button
                  onClick={() => setTabAndPersist("analytics")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all",
                    activeTab === "analytics"
                      ? "bg-brand text-black shadow-md shadow-brand/20 font-bold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  )}
                >
                  <BarChart2 className='w-4 h-4' />
                  Performance Funnel
                </button>
                <button
                  onClick={() => setTabAndPersist("candidate-memory")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all",
                    activeTab === "candidate-memory"
                      ? "bg-brand text-black shadow-md shadow-brand/20 font-bold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  )}
                >
                  <BrainCircuit className='w-4 h-4' />
                  Candidate Memory
                </button>
              </div>
            </div>

            {/* TAB 1: Analytics Performance */}
            {activeTab === "analytics" && (
              <div className="space-y-6">
                {/* Controls Card */}
                <Card
                  className='relative overflow-hidden border border-border/50 bg-[#080808] p-5 sm:p-6 rounded-2xl shadow-xl'
                  id='analytics-controls'
                  data-tour='analytics-controls'
                >
                  <div className='relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4'>
                    <div className='flex flex-wrap items-center gap-3'>
                      <span className='text-xs uppercase tracking-wider text-brand font-semibold font-mono'>
                        Granularity:
                      </span>
                      {(["day", "week", "month"] as const).map((g) => (
                        <button
                          key={g}
                          onClick={() => setGranularityAndPersist(g)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                            granularity === g
                              ? "bg-brand/20 text-brand border-brand/50 shadow-[0_0_12px_rgba(47,217,104,0.2)] font-semibold"
                              : "border-border/40 text-muted-foreground hover:bg-muted/20 hover:text-foreground"
                          }`}
                        >
                          {g.charAt(0).toUpperCase() + g.slice(1)}
                        </button>
                      ))}
                      <span className='ml-3 text-xs uppercase tracking-wider text-brand font-semibold font-mono'>
                        Period:
                      </span>
                      {["7d", "30d", "90d", "ytd", "12m"].map((p) => (
                        <button
                          key={p}
                          onClick={() => setPeriodAndPersist(p as Period)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                            period === p
                              ? "bg-brand/20 text-brand border-brand/50 shadow-[0_0_12px_rgba(47,217,104,0.2)] font-semibold"
                              : "border-border/40 text-muted-foreground hover:bg-muted/20 hover:text-foreground"
                          }`}
                        >
                          {p.toUpperCase()}
                        </button>
                      ))}
                      <span className='text-xs text-muted-foreground ml-2 hidden sm:inline font-medium'>
                        {periodLabel}
                      </span>
                    </div>
                    <div className='flex items-center gap-3'>
                      <Button
                        variant='outline'
                        className='border-brand/30 bg-brand/5 text-foreground hover:bg-brand/15 hover:border-brand/60 transition-all duration-200 shadow-sm'
                        onClick={() => analytics.refresh?.({ bypassCache: true })}
                      >
                        <RefreshCw
                          className={`w-4 h-4 mr-2 text-brand ${analytics.loading ? "animate-spin" : ""}`}
                        />
                        {analytics.loading ? "Refreshing" : "Refresh"}
                      </Button>
                      <Button
                        variant='outline'
                        className='border-brand/30 bg-brand/5 text-foreground hover:bg-brand/15 hover:border-brand/60 transition-all duration-200 shadow-sm'
                        disabled={analytics.loading}
                        onClick={() => analytics.exportCSV?.()}
                      >
                        <svg
                          className='w-4 h-4 mr-2 text-brand'
                          fill='none'
                          viewBox='0 0 24 24'
                          stroke='currentColor'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                          />
                        </svg>
                        CSV
                      </Button>
                      <Button
                        variant='outline'
                        className='border-brand/30 bg-brand/5 text-foreground hover:bg-brand/15 hover:border-brand/60 transition-all duration-200 shadow-sm'
                        disabled={analytics.loading}
                        onClick={() => analytics.exportJSON?.()}
                      >
                        <svg
                          className='w-4 h-4 mr-2 text-brand'
                          fill='none'
                          viewBox='0 0 24 24'
                          stroke='currentColor'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'
                          />
                        </svg>
                        JSON
                      </Button>
                    </div>
                  </div>
                </Card>

                {analytics.error && (
                  <Card className='bg-rose-500/10 border-rose-500/30 rounded-2xl p-4'>
                    <div className='text-sm text-rose-400'>{analytics.error}</div>
                  </Card>
                )}

                <div id='analytics-main-card' data-tour='analytics-main-card'>
                  <AnalyticsContent
                    period={period}
                    data={analytics}
                    insights={insights}
                  />
                </div>
              </div>
            )}

            {/* TAB 2: Candidate Memory */}
            {activeTab === "candidate-memory" && (
              <CandidateMemoryEditor
                profile={profile}
                loading={loadingProfile}
                onSave={async (patch) => {
                  await updateProfile(patch as any);
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default AnalyticsPage;
