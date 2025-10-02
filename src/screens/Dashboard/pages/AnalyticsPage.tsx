import { useState, useEffect, useMemo } from 'react';
import { useRegisterCoachMarks } from '../../../providers/TourProvider';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { RefreshCw } from 'lucide-react';
import { AnalyticsContent } from '../../../components/analytics/AnalyticsContent';
import { useAnalyticsData } from '../../../hooks/useAnalyticsData';

type Period = "7d" | "30d" | "90d" | "ytd" | "12m";
type Granularity = 'day' | 'week' | 'month';

export function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [granularity, setGranularity] = useState<Granularity>((localStorage.getItem('analytics:granularity') as Granularity) || 'day');
  const analytics = useAnalyticsData(period, { granularity });

  // Initialize from URL (deep links inside dashboard context)
  useEffect(() => {
    try {
      const usp = new URLSearchParams(window.location.search);
      const p = usp.get('period') as Period | null;
      const g = usp.get('g') as Granularity | null;
      if (p && ["7d","30d","90d","ytd","12m"].includes(p)) setPeriod(p);
      if (g && ['day','week','month'].includes(g)) setGranularity(g);
    } catch {}
  }, []);

  const setPeriodAndPersist = (p: Period) => {
    setPeriod(p);
    try {
      localStorage.setItem('analytics:period', p);
      const url = new URL(window.location.href);
      url.searchParams.set('period', p);
      url.searchParams.set('g', granularity);
      window.history.replaceState({}, '', url.toString());
    } catch {}
  };

  const setGranularityAndPersist = (g: Granularity) => {
    setGranularity(g);
    try {
      localStorage.setItem('analytics:granularity', g);
      const url = new URL(window.location.href);
      url.searchParams.set('g', g);
      url.searchParams.set('period', period);
      window.history.replaceState({}, '', url.toString());
    } catch {}
  };

  const periodLabel = useMemo(() => {
    switch (period) {
      case '7d': return 'Last 7 days';
      case '30d': return 'Last 30 days';
      case '90d': return 'Last 90 days';
      case 'ytd': return 'Year to date';
      case '12m': return 'Last 12 months';
      default: return 'Custom';
    }
  }, [period]);

  useRegisterCoachMarks({
    page: 'analytics',
    marks: [
      { id: 'analytics-controls', selector: '#analytics-controls', title: 'Adjust Time & Detail', body: 'Switch period and granularity to zoom into recent patterns or long-term trends.' },
      { id: 'analytics-main-card', selector: '#analytics-main-card', title: 'Performance Insights', body: 'Aggregated application outcomes, velocity and conversion metrics live here.' }
    ]
  });

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4">
      {/* Local controls (compact to fit inside dashboard shell) */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3" id="analytics-controls" data-tour="analytics-controls">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-white/50">Granularity:</span>
          {(['day','week','month'] as const).map(g => (
            <button
              key={g}
              onClick={() => setGranularityAndPersist(g)}
              className={`px-2.5 py-1 rounded-md text-xs transition border ${granularity===g ? 'bg-[#1dff00] text-black border-[#1dff00]' : 'border-white/20 text-white/70 hover:bg-white/10'}`}
            >{g}</button>
          ))}
          <span className="ml-3 text-xs uppercase tracking-wide text-white/50">Period:</span>
          {["7d","30d","90d","ytd","12m"].map(p => (
            <button
              key={p}
              onClick={() => setPeriodAndPersist(p as Period)}
              className={`px-2.5 py-1 rounded-md text-xs transition border ${period===p ? 'bg-white/15 text-white border-white/30' : 'border-white/15 text-white/60 hover:bg-white/10'}`}
            >{p.toUpperCase()}</button>
          ))}
          <span className="text-xs text-white/40 ml-2 hidden sm:inline">{periodLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-white/30 text-white hover:bg-white/10"
            onClick={() => analytics.refresh?.({ bypassCache: true })}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${analytics.loading ? 'animate-spin' : ''}`} />
            {analytics.loading ? 'Refreshing' : 'Refresh'}
          </Button>
          <Button
            variant="outline"
            className="border-white/30 text-white hover:bg-white/10"
            disabled={analytics.loading}
            onClick={() => analytics.exportCSV?.()}
          >CSV</Button>
          <Button
            variant="outline"
            className="border-white/30 text-white hover:bg-white/10"
            disabled={analytics.loading}
            onClick={() => analytics.exportJSON?.()}
          >JSON</Button>
        </div>
      </div>
      {analytics.error && (
        <div className="text-xs text-red-400">{analytics.error}</div>
      )}
  <Card id="analytics-main-card" data-tour="analytics-main-card" className="rounded-xl border border-white/15 bg-gradient-to-br from-white/[0.04] via-white/[0.06] to-white/[0.03] backdrop-blur-xl shadow-[0_0_0_1px_rgba(29,255,0,0.05)]">
        <CardContent className="p-3 sm:p-4 lg:p-6">
          <AnalyticsContent period={period} data={analytics} />
        </CardContent>
      </Card>
    </div>
  );
}

export default AnalyticsPage;