import { useState, useEffect, useMemo } from 'react';
import { useRegisterCoachMarks } from '../../../providers/TourProvider';
import { Card } from '../../../components/ui/card';
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
    <div className="relative min-h-screen bg-black">
      {/* Ambient Background Glow */}
      <div className="fixed top-20 right-0 h-96 w-96 bg-[#1dff00]/5 rounded-full blur-3xl opacity-30 pointer-events-none -z-10"></div>
      <div className="fixed bottom-0 left-0 h-96 w-96 bg-[#1dff00]/5 rounded-full blur-3xl opacity-20 pointer-events-none -z-10"></div>
      
      <div className="relative space-y-6 p-4 sm:p-6 lg:p-8 mx-auto max-w-7xl">
        {/* Page Header */}
        <div className="space-y-1 mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-white bg-gradient-to-r from-white to-white/70 bg-clip-text">Analytics</h1>
          <p className="text-sm sm:text-base text-white/50">Track your job search performance and insights</p>
        </div>

        {/* Controls Card */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-[#0a0a0a]/95 to-[#0f0f0f]/95 border border-[#1dff00]/20 p-5 sm:p-6 rounded-2xl shadow-[0_0_30px_rgba(29,255,0,0.1)] backdrop-blur-xl" id="analytics-controls" data-tour="analytics-controls">
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#1dff00]/5 via-transparent to-transparent pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs uppercase tracking-wider text-[#1dff00]/80 font-semibold">Granularity:</span>
              {(['day','week','month'] as const).map(g => (
                <button
                  key={g}
                  onClick={() => setGranularityAndPersist(g)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border-2 ${
                    granularity===g 
                      ? 'bg-gradient-to-br from-[#1dff00]/20 to-[#1dff00]/10 text-[#1dff00] border-[#1dff00]/50 shadow-[0_0_15px_rgba(29,255,0,0.2)]' 
                      : 'border-white/20 text-white/70 hover:bg-white/10 hover:border-white/30'
                  }`}
                >{g.charAt(0).toUpperCase() + g.slice(1)}</button>
              ))}
              <span className="ml-3 text-xs uppercase tracking-wider text-[#1dff00]/80 font-semibold">Period:</span>
              {["7d","30d","90d","ytd","12m"].map(p => (
                <button
                  key={p}
                  onClick={() => setPeriodAndPersist(p as Period)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    period===p 
                      ? 'bg-gradient-to-br from-white/20 to-white/10 text-white border-white/40 shadow-[0_0_10px_rgba(255,255,255,0.15)]' 
                      : 'border-white/15 text-white/60 hover:bg-white/10'
                  }`}
                >{p.toUpperCase()}</button>
              ))}
              <span className="text-xs text-white/50 ml-2 hidden sm:inline font-medium">{periodLabel}</span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="border-[#1dff00]/30 bg-gradient-to-br from-[#1dff00]/5 to-transparent text-white hover:bg-[#1dff00]/10 hover:border-[#1dff00]/50 transition-all duration-200 hover:shadow-[0_0_20px_rgba(29,255,0,0.15)]"
                onClick={() => analytics.refresh?.({ bypassCache: true })}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${analytics.loading ? 'animate-spin' : ''}`} />
                {analytics.loading ? 'Refreshing' : 'Refresh'}
              </Button>
              <Button
                variant="outline"
                className="border-[#1dff00]/30 bg-gradient-to-br from-[#1dff00]/5 to-transparent text-white hover:bg-[#1dff00]/10 hover:border-[#1dff00]/50 transition-all duration-200 hover:shadow-[0_0_20px_rgba(29,255,0,0.15)]"
                disabled={analytics.loading}
                onClick={() => analytics.exportCSV?.()}
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                CSV
              </Button>
              <Button
                variant="outline"
                className="border-[#1dff00]/30 bg-gradient-to-br from-[#1dff00]/5 to-transparent text-white hover:bg-[#1dff00]/10 hover:border-[#1dff00]/50 transition-all duration-200 hover:shadow-[0_0_20px_rgba(29,255,0,0.15)]"
                disabled={analytics.loading}
                onClick={() => analytics.exportJSON?.()}
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                JSON
              </Button>
            </div>
          </div>
        </Card>

        {analytics.error && (
          <Card className="bg-gradient-to-br from-red-900/20 to-red-950/20 border-red-500/50 rounded-2xl p-4">
            <div className="text-sm text-red-400">{analytics.error}</div>
          </Card>
        )}

        <div id="analytics-main-card" data-tour="analytics-main-card">
          <AnalyticsContent period={period} data={analytics} />
        </div>
      </div>
    </div>
  );
}

export default AnalyticsPage;