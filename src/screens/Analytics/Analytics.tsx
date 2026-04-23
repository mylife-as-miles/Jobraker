import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { RefreshCw, Link2, Download, Printer } from "lucide-react";
import { AnalyticsContent } from "../../components/analytics/AnalyticsContent";
import { useAnalyticsData } from "../../hooks/useAnalyticsData";
import { useInsightsData } from "../../hooks/useInsightsData";

export const Analytics = (): JSX.Element => {
  const [period, setPeriod] = useState<string>("30d");
  const [granularity, setGranularity] = useState<"day" | "week" | "month">(
    (localStorage.getItem("analytics:granularity") as any) || "day",
  );
  const analytics = useAnalyticsData(period as any, { granularity });
  const insights = useInsightsData(period as any, granularity, analytics);
  const hasData =
    (analytics.chartDataApps?.length ?? 0) > 0 ||
    (analytics.chartDataJobs?.length ?? 0) > 0 ||
    (analytics.barData?.length ?? 0) > 0 ||
    (analytics.donutData?.length ?? 0) > 0;

  // Initialize from URL
  useEffect(() => {
    try {
      const usp = new URLSearchParams(window.location.search);
      const p =
        usp.get("period") ||
        localStorage.getItem("analytics:period") ||
        undefined;
      if (p && ["7d", "30d", "90d", "ytd", "12m"].includes(p)) setPeriod(p);
      const g =
        (usp.get("g") as any) ||
        (localStorage.getItem("analytics:granularity") as any) ||
        undefined;
      if (g && ["day", "week", "month"].includes(g)) setGranularity(g);
    } catch {}
  }, []);

  const setPeriodAndUrl = (p: string) => {
    setPeriod(p);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("period", p);
      url.searchParams.set("g", granularity);
      window.history.replaceState({}, "", url.toString());
      localStorage.setItem("analytics:period", p);
    } catch {}
  };

  const setGranularityAndUrl = (g: "day" | "week" | "month") => {
    setGranularity(g);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("g", g);
      url.searchParams.set("period", period);
      window.history.replaceState({}, "", url.toString());
      localStorage.setItem("analytics:granularity", g);
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

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {}
  };
  const exportPDF = () => {
    try {
      window.print();
    } catch {}
  };

  return (
    <div className='product-page-shell min-h-screen'>
      {/* Header Bar */}
      <div className='sticky top-0 z-10 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85'>
        <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex items-center gap-3'>
            <h1 className='product-page-title text-xl sm:text-2xl font-semibold tracking-tight'>
              Analytics
            </h1>
            <span className='product-helper-text hidden sm:inline text-xs'>
              {periodLabel}
            </span>
          </div>
          <div className='flex items-center gap-2'>
            <div className='product-control-surface mr-2'>
              {(["day", "week", "month"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGranularityAndUrl(g)}
                  className={
                    granularity === g
                      ? "product-control-button-active"
                      : "product-control-button"
                  }
                  aria-pressed={granularity === g}
                  title={`Group by ${g}`}
                >
                  {g === "day" ? "Day" : g === "week" ? "Week" : "Month"}
                </button>
              ))}
            </div>
            <div className='product-control-surface'>
              {["7d", "30d", "90d", "ytd", "12m"].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriodAndUrl(p)}
                  className={
                    period === p
                      ? "product-control-button-active"
                      : "product-control-button"
                  }
                  aria-pressed={period === p}
                >
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
            <Button
              variant='outline'
              className='product-outline-button'
              onClick={() => analytics.refresh?.({ bypassCache: true })}
              title='Refresh'
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${analytics.loading ? "animate-spin" : ""}`}
              />{" "}
              {analytics.loading ? "Refreshing" : "Refresh"}
            </Button>
            <Button
              variant='outline'
              className='product-outline-button'
              onClick={() => analytics.exportCSV?.()}
              title='Export CSV'
              disabled={!hasData}
            >
              <Download className='w-4 h-4 mr-2' /> Export
            </Button>
            <Button
              variant='outline'
              className='product-outline-button'
              onClick={() => analytics.exportJSON?.()}
              title='Export JSON'
              disabled={!hasData}
            >
              <Download className='w-4 h-4 mr-2' /> JSON
            </Button>
            <Button
              variant='outline'
              className='product-outline-button'
              onClick={exportPDF}
              title='Export PDF (Print)'
            >
              <Printer className='w-4 h-4 mr-2' /> PDF
            </Button>
            <Button
              variant='outline'
              className='product-outline-button'
              onClick={copyLink}
              title='Copy link'
            >
              <Link2 className='w-4 h-4 mr-2' /> Copy link
            </Button>
          </div>
        </div>
        {(analytics.error || analytics.lastUpdated) && (
          <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-2'>
            {analytics.error ? (
              <p className='text-[11px] sm:text-xs text-brand'>
                {analytics.error}
              </p>
            ) : (
              <p className='product-helper-text text-[11px] sm:text-xs'>
                Last updated {new Date(analytics.lastUpdated!).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <main className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6'>
        <Card className='product-section-card rounded-[28px]'>
          <CardContent className='p-4 sm:p-6'>
            <AnalyticsContent
              period={period as any}
              data={analytics}
              insights={insights}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
