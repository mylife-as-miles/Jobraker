import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { RefreshCw, Link2, Download } from "lucide-react";
import { AnalyticsContent } from "../../components/analytics/AnalyticsContent";
import { useAnalyticsData } from "../../hooks/useAnalyticsData";

export const Analytics = (): JSX.Element => {
  const [period, setPeriod] = useState<string>("30d");
  const analytics = useAnalyticsData(period as any);
  const hasData = (analytics.chartDataApps?.length ?? 0) > 0 || (analytics.chartDataJobs?.length ?? 0) > 0 || (analytics.barData?.length ?? 0) > 0 || (analytics.donutData?.length ?? 0) > 0;

  // Initialize from URL
  useEffect(() => {
    try {
      const usp = new URLSearchParams(window.location.search);
      const p = usp.get("period");
      if (p && ["7d","30d","90d","ytd","12m"].includes(p)) setPeriod(p);
    } catch {}
  }, []);

  const setPeriodAndUrl = (p: string) => {
    setPeriod(p);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("period", p);
      window.history.replaceState({}, "", url.toString());
    } catch {}
  };

  const periodLabel = useMemo(() => {
    switch (period) {
      case "7d": return "Last 7 days";
      case "30d": return "Last 30 days";
      case "90d": return "Last 90 days";
      case "ytd": return "Year to date";
      case "12m": return "Last 12 months";
      default: return "Custom";
    }
  }, [period]);

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); } catch {}
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Header Bar */}
      <div className="sticky top-0 z-10 border-b border-white/10 bg-gradient-to-b from-[#0a0a0a] to-transparent">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              <span className="bg-gradient-to-r from-white to-[#1dff00] bg-clip-text text-transparent">Analytics</span>
            </h1>
            <span className="hidden sm:inline text-xs text-white/60">{periodLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-white/20 overflow-hidden">
              {["7d","30d","90d","ytd","12m"].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriodAndUrl(p)}
                  className={`px-3 py-1.5 text-xs sm:text-sm text-white/80 hover:text-white transition ${period===p ? 'bg-white/15' : ''} ${p!=="7d" ? 'border-l border-white/15' : ''}`}
                  aria-pressed={period===p}
                >
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10"
              onClick={() => analytics.refresh?.({ bypassCache: true })}
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${analytics.loading ? 'animate-spin' : ''}`} /> {analytics.loading ? 'Refreshing' : 'Refresh'}
            </Button>
            <Button
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10"
              onClick={() => analytics.exportCSV?.()}
              title="Export CSV"
              disabled={!hasData}
            >
              <Download className="w-4 h-4 mr-2" /> Export
            </Button>
            <Button
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10"
              onClick={copyLink}
              title="Copy link"
            >
              <Link2 className="w-4 h-4 mr-2" /> Copy link
            </Button>
          </div>
        </div>
        {(analytics.error || analytics.lastUpdated) && (
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-2">
            {analytics.error ? (
              <p className="text-[11px] sm:text-xs text-red-400">{analytics.error}</p>
            ) : (
              <p className="text-[11px] sm:text-xs text-white/50">Last updated {new Date(analytics.lastUpdated!).toLocaleString()}</p>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <Card className="rounded-xl border border-white/15 bg-gradient-to-br from-white/[0.04] via-white/[0.06] to-white/[0.03] backdrop-blur-xl shadow-[0_0_0_1px_rgba(29,255,0,0.05)]">
          <CardContent className="p-4 sm:p-6">
            <AnalyticsContent period={period as any} data={analytics} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
};