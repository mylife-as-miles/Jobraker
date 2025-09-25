import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabaseClient";

type Period = "7d" | "30d" | "90d" | "ytd" | "12m";

export type DataPoint = { name: string; value: number; timestamp: number };

export function useAnalyticsData(period: Period) {
  const supabase = useMemo(() => createClient(), []);
  const [chartDataApps, setChartDataApps] = useState<DataPoint[]>([]);
  const [chartDataJobs, setChartDataJobs] = useState<DataPoint[]>([]);
  const [barData, setBarData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [donutData, setDonutData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [metrics, setMetrics] = useState({
    applications: 0,
    interviews: 0,
    sources: 0,
    jobsFound: 0,
    avgMatchScore: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => computeRange(period), [period]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (mounted) {
            setChartDataApps([]);
            setChartDataJobs([]);
            setBarData([]);
            setDonutData([]);
            setMetrics({ applications: 0, interviews: 0, sources: 0, jobsFound: 0, avgMatchScore: 0 });
          }
          return;
        }

        // Fetch applications (filter client-side to handle null applied_date)
        const { data: appsRaw, error: appsErr } = await supabase
          .from("applications")
          .select("id, applied_date, created_at, status, match_score, updated_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });
        if (appsErr) throw appsErr;

        // Fetch jobs
        const { data: jobsRaw, error: jobsErr } = await supabase
          .from("user_jobs")
          .select("id, created_at, source_type")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });
        if (jobsErr) throw jobsErr;

        const startTs = range.start.getTime();
        const endTs = range.end.getTime();

        const apps = (appsRaw ?? []).filter((a: any) => {
          const t = new Date(a.applied_date || a.created_at).getTime();
          return t >= startTs && t <= endTs;
        });
        const jobs = (jobsRaw ?? []).filter((j: any) => {
          const t = new Date(j.created_at).getTime();
          return t >= startTs && t <= endTs;
        });

        // KPIs
        const applications = apps.length;
        const interviews = apps.filter((a: any) => String(a.status).toLowerCase() === "interview").length;
        const jobsFound = jobs.length;
        const sourcesSet = new Set<string>();
        for (const j of jobs) { if (j.source_type) sourcesSet.add(j.source_type); }
        const sources = sourcesSet.size;
        const matchScores = apps.map((a: any) => a.match_score).filter((v: any) => typeof v === 'number');
        const avgMatchScore = matchScores.length ? Math.round(matchScores.reduce((s: number, v: number) => s + v, 0) / matchScores.length) : 0;

        // Time series by day
        const days = enumerateDays(range.start, range.end);
        const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const byDay = (arr: any[], dateSelector: (x: any) => Date) => {
          const m = new Map<string, number>();
          for (const day of days) m.set(day.toISOString().slice(0,10), 0);
          for (const x of arr) {
            const d = dateSelector(x);
            const key = d.toISOString().slice(0,10);
            if (m.has(key)) m.set(key, (m.get(key) || 0) + 1);
          }
          return days.map(d => ({ name: fmt(d), value: m.get(d.toISOString().slice(0,10)) || 0, timestamp: d.getTime() }));
        };

        const appsSeries = byDay(apps, (a: any) => new Date(a.applied_date || a.created_at));
        const jobsSeries = byDay(jobs, (j: any) => new Date(j.created_at));

        // Bars and donut
        const bar = [
          { name: 'Jobs found', value: jobsFound, color: '#3B82F6' },
          { name: 'Applications', value: applications, color: '#1dff00' },
          { name: 'Interviews', value: interviews, color: '#F59E0B' },
        ];

        const statusCounts = groupCounts(apps.map((a: any) => a.status || 'Unknown'));
        const totalStatus = Array.from(statusCounts.values()).reduce((s, v) => s + v, 0) || 1;
        const donut = Array.from(statusCounts.entries()).map(([name, count]) => ({
          name,
          value: Math.round((count / totalStatus) * 100),
          color: pickColor(name),
        }));

        if (!mounted) return;
        setMetrics({ applications, interviews, sources, jobsFound, avgMatchScore });
        setChartDataApps(appsSeries);
        setChartDataJobs(jobsSeries);
        setBarData(bar);
        setDonutData(donut);
      } catch (e: any) {
        if (mounted) setError(e.message || 'Failed to load analytics');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [supabase, range.start, range.end]);

  return { chartDataApps, chartDataJobs, barData, donutData, metrics, loading, error } as const;
}

function computeRange(period: Period) {
  const end = new Date();
  const start = new Date();
  switch (period) {
    case '7d': start.setDate(end.getDate() - 6); break;
    case '30d': start.setDate(end.getDate() - 29); break;
    case '90d': start.setDate(end.getDate() - 89); break;
    case 'ytd': start.setMonth(0, 1); start.setHours(0,0,0,0); break;
    case '12m': start.setFullYear(end.getFullYear() - 1); break;
    default: start.setDate(end.getDate() - 29);
  }
  // Normalize times
  start.setHours(0,0,0,0);
  end.setHours(23,59,59,999);
  return { start, end };
}

function enumerateDays(start: Date, end: Date) {
  const days: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function groupCounts(items: string[]) {
  const m = new Map<string, number>();
  for (const it of items) m.set(it, (m.get(it) || 0) + 1);
  return m;
}

function pickColor(name: string) {
  const key = name.toLowerCase();
  if (/interview/.test(key)) return '#F59E0B';
  if (/offer/.test(key)) return '#10B981';
  if (/reject/.test(key)) return '#EF4444';
  if (/withdraw/.test(key)) return '#94A3B8';
  if (/pending|appl/.test(key)) return '#1dff00';
  return '#3B82F6';
}
