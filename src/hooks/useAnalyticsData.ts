import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../lib/supabaseClient";

type Period = "7d" | "30d" | "90d" | "ytd" | "12m";
type Granularity = 'day' | 'week' | 'month';

export type DataPoint = { name: string; value: number; timestamp: number };

export function useAnalyticsData(period: Period, opts?: { granularity?: Granularity }) {
  const supabase = useMemo(() => createClient(), []);
  const granularity: Granularity = opts?.granularity ?? 'day';
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
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [comparisons, setComparisons] = useState({
    applicationsDeltaPct: 0,
    interviewsDeltaPct: 0,
    jobsFoundDeltaPct: 0,
    avgMatchDelta: 0,
  });

  // Abort and debounce helpers
  const abortRef = useRef<AbortController | null>(null);
  const refreshRequestedRef = useRef(false);

  const range = useMemo(() => computeRange(period), [period]);
  const prevRange = useMemo(() => computePreviousRange(range), [range.start, range.end]);

  const cacheKeyRef = useRef<string>("");
  useEffect(() => {
    cacheKeyRef.current = ""; // reset on period change to recompute after user known
  }, [period, granularity]);

  const readCache = (key: string) => {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const ttl = 5 * 60 * 1000; // 5 minutes
      if (!parsed || Date.now() - parsed.savedAt > ttl) return null;
      return parsed;
    } catch {
      return null;
    }
  };

  const writeCache = (key: string, payload: any) => {
    try {
      sessionStorage.setItem(key, JSON.stringify({ ...payload, savedAt: Date.now() }));
    } catch {}
  };

  const exportCSV = (filename = `analytics-${period}-g-${granularity}-${new Date().toISOString().slice(0,19).replace(/[:T]/g, "-")}.csv`) => {
    try {
      const rows: string[] = [];
      const push = (line: (string|number)[]) => rows.push(line.map(cell => typeof cell === 'string' && cell.includes(',') ? `"${cell.replace(/"/g,'""')}"` : String(cell)).join(','));
      // Metrics
      push(["Metric","Value"]);
      push(["Applications", metrics.applications]);
      push(["Interviews", metrics.interviews]);
      push(["Jobs Found", metrics.jobsFound]);
      push(["Sources", metrics.sources]);
      push(["Avg Match Score", metrics.avgMatchScore]);
      push(["Applications Δ%", comparisons.applicationsDeltaPct]);
      push(["Interviews Δ%", comparisons.interviewsDeltaPct]);
      push(["Jobs Found Δ%", comparisons.jobsFoundDeltaPct]);
      push(["Avg Match Δ", comparisons.avgMatchDelta]);
      rows.push("");
      // Time series
      push(["Date","Applications","Jobs Found"]);
      const byTs = new Map<number, {apps:number;jobs:number;label:string}>();
      for (const d of chartDataApps) byTs.set(d.timestamp, { apps: d.value, jobs: 0, label: d.name });
      for (const d of chartDataJobs) {
        const prev = byTs.get(d.timestamp) || { apps: 0, jobs: 0, label: d.name };
        prev.jobs = d.value;
        byTs.set(d.timestamp, prev);
      }
      for (const [, v] of Array.from(byTs.entries()).sort((a,b)=>a[0]-b[0])) {
        push([v.label, v.apps, v.jobs]);
      }
      rows.push("");
      // Bar data
      push(["Bar Name","Value","Color"]);
      for (const b of barData) push([b.name, b.value, b.color]);
      rows.push("");
      // Donut data
      push(["Status","Percent","Color"]);
      for (const d of donutData) push([d.name, d.value, d.color]);

      const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {}
  };

  const snapshot = () => ({
    meta: {
      period,
      range: { start: range.start.toISOString(), end: range.end.toISOString() },
      granularity,
      lastUpdated,
      generatedAt: new Date().toISOString(),
    },
    metrics,
    comparisons,
    series: { applications: chartDataApps, jobs: chartDataJobs },
    barData,
    donutData,
    error,
  });

  const exportJSON = (filename = `analytics-${period}-g-${granularity}-${new Date().toISOString().slice(0,19).replace(/[:T]/g, "-")}.json`) => {
    try {
      const data = snapshot();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {}
  };

  const refresh = (options?: { bypassCache?: boolean }) => {
    refreshRequestedRef.current = true;
    loadData(options);
  };

  async function loadData(options?: { bypassCache?: boolean }) {
    let mounted = true;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      setLoading(true);
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (controller.signal.aborted) return;
      if (!user) {
        setChartDataApps([]);
        setChartDataJobs([]);
        setBarData([]);
        setDonutData([]);
        setMetrics({ applications: 0, interviews: 0, sources: 0, jobsFound: 0, avgMatchScore: 0 });
        setComparisons({ applicationsDeltaPct: 0, interviewsDeltaPct: 0, jobsFoundDeltaPct: 0, avgMatchDelta: 0 });
        setLastUpdated(Date.now());
        return;
      }

      // Build cache key after we know user
  if (!cacheKeyRef.current) cacheKeyRef.current = `analytics:${user.id}:${period}:${granularity}:v1`;
      const cacheKey = cacheKeyRef.current;
      if (!options?.bypassCache) {
        const cached = readCache(cacheKey);
        if (cached) {
          setChartDataApps(cached.chartDataApps || []);
          setChartDataJobs(cached.chartDataJobs || []);
          setBarData(cached.barData || []);
          setDonutData(cached.donutData || []);
          setMetrics(cached.metrics || metrics);
          setComparisons(cached.comparisons || comparisons);
          setLastUpdated(cached.lastUpdated || Date.now());
          setLoading(false);
          return;
        }
      }

      // Fetch applications (filter client-side to handle null applied_date)
      const { data: appsRaw, error: appsErr } = await supabase
        .from("applications")
        .select("id, applied_date, created_at, status, updated_at, user_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (controller.signal.aborted) return;
      if (appsErr) throw appsErr;

      // Fetch jobs
      const { data: jobsRaw, error: jobsErr } = await supabase
        .from("user_jobs")
        .select("id, created_at, source_type, user_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (controller.signal.aborted) return;
      if (jobsErr) throw jobsErr;

      const startTs = range.start.getTime();
      const endTs = range.end.getTime();

      const appsAll = appsRaw ?? [];
      const jobsAll = jobsRaw ?? [];

      const apps = appsAll.filter((a: any) => {
        const t = new Date(a.applied_date || a.created_at).getTime();
        return t >= startTs && t <= endTs;
      });
      const jobs = jobsAll.filter((j: any) => {
        const t = new Date(j.created_at).getTime();
        return t >= startTs && t <= endTs;
      });

      // KPIs current
      const applications = apps.length;
      const interviews = apps.filter((a: any) => String(a.status).toLowerCase() === "interview").length;
      const jobsFound = jobs.length;
      const sourcesSet = new Set<string>();
      for (const j of jobs) { if (j.source_type) sourcesSet.add(j.source_type); }
      const sources = sourcesSet.size;
      const matchScores = apps
        .map((a: any) => (a.match_score !== undefined ? a.match_score : (a.notes && /match[:=]\s*(\d{1,3})/i.test(a.notes) ? Number(RegExp.$1) : undefined)))
        .filter((v: any) => typeof v === 'number');
      const avgMatchScore = matchScores.length ? Math.round(matchScores.reduce((s: number, v: number) => s + v, 0) / matchScores.length) : 0;

      // Previous period comparisons
      const prevStartTs = prevRange.start.getTime();
      const prevEndTs = prevRange.end.getTime();
      const prevApps = appsAll.filter((a: any) => {
        const t = new Date(a.applied_date || a.created_at).getTime();
        return t >= prevStartTs && t <= prevEndTs;
      });
      const prevJobs = jobsAll.filter((j: any) => {
        const t = new Date(j.created_at).getTime();
        return t >= prevStartTs && t <= prevEndTs;
      });
      const prevApplications = prevApps.length;
      const prevInterviews = prevApps.filter((a: any) => String(a.status).toLowerCase() === "interview").length;
      const prevJobsFound = prevJobs.length;
      const prevMatchScores = prevApps
        .map((a: any) => (a.match_score !== undefined ? a.match_score : (a.notes && /match[:=]\s*(\d{1,3})/i.test(a.notes) ? Number(RegExp.$1) : undefined)))
        .filter((v: any) => typeof v === 'number');
      const prevAvgMatch = prevMatchScores.length ? Math.round(prevMatchScores.reduce((s:number,v:number)=>s+v,0) / prevMatchScores.length) : 0;

      const applicationsDeltaPct = pctDelta(prevApplications, applications);
      const interviewsDeltaPct = pctDelta(prevInterviews, interviews);
      const jobsFoundDeltaPct = pctDelta(prevJobsFound, jobsFound);
      const avgMatchDelta = avgMatchScore - prevAvgMatch;

      // Time series by selected granularity
      const bins = enumerateBins(range.start, range.end, granularity);
      const labelFmt = (d: Date) => {
        if (granularity === 'month') return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        if (granularity === 'week') return `Wk ${getISOWeek(d)} ${d.getFullYear().toString().slice(-2)}`;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      };
      const byBin = (arr: any[], dateSelector: (x: any) => Date) => {
        const m = new Map<string, number>();
        const keys = bins.map(b => b.key);
        for (const key of keys) m.set(key, 0);
        for (const x of arr) {
          const d = dateSelector(x);
          const key = binKeyForDate(d, granularity);
          if (m.has(key)) m.set(key, (m.get(key) || 0) + 1);
        }
        return bins.map(b => ({ name: labelFmt(b.start), value: m.get(b.key) || 0, timestamp: b.start.getTime() }));
      };

      const appsSeries = byBin(apps, (a: any) => new Date(a.applied_date || a.created_at));
      const jobsSeries = byBin(jobs, (j: any) => new Date(j.created_at));

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

      if (!mounted || controller.signal.aborted) return;
      const nextMetrics = { applications, interviews, sources, jobsFound, avgMatchScore };
      const nextComparisons = { applicationsDeltaPct, interviewsDeltaPct, jobsFoundDeltaPct, avgMatchDelta };
      setMetrics(nextMetrics);
      setComparisons(nextComparisons);
      setChartDataApps(appsSeries);
      setChartDataJobs(jobsSeries);
      setBarData(bar);
      setDonutData(donut);
      setLastUpdated(Date.now());
      // Cache
      writeCache(cacheKey, {
        chartDataApps: appsSeries,
        chartDataJobs: jobsSeries,
        barData: bar,
        donutData: donut,
        metrics: nextMetrics,
        comparisons: nextComparisons,
        lastUpdated: Date.now(),
      });
    } catch (e: any) {
      if (!abortRef.current?.signal.aborted) setError(e?.message || 'Failed to load analytics');
    } finally {
      if (!abortRef.current?.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    loadData();

    // Realtime updates for changes to user's rows
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        channel = supabase
          .channel(`analytics:${user.id}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'applications', filter: `user_id=eq.${user.id}` }, () => refresh({ bypassCache: true }))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'user_jobs', filter: `user_id=eq.${user.id}` }, () => refresh({ bypassCache: true }))
          .subscribe();
      } catch {}
    })();

    return () => {
      try { channel && supabase.removeChannel(channel); } catch {}
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, range.start, range.end, granularity]);

  return { chartDataApps, chartDataJobs, barData, donutData, metrics, comparisons, loading, error, lastUpdated, refresh, exportCSV, exportJSON, snapshot } as const;
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

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Monday=0
  date.setDate(date.getDate() - day);
  date.setHours(0,0,0,0);
  return date;
}

function startOfMonth(d: Date) {
  const date = new Date(d.getFullYear(), d.getMonth(), 1);
  date.setHours(0,0,0,0);
  return date;
}

function enumerateBins(start: Date, end: Date, granularity: Granularity) {
  const bins: { start: Date; key: string }[] = [];
  if (granularity === 'day') {
    for (const d of enumerateDays(start, end)) {
      bins.push({ start: d, key: d.toISOString().slice(0,10) });
    }
    return bins;
  }
  if (granularity === 'week') {
    let cur = startOfWeek(start);
    const endWeek = startOfWeek(end);
    while (cur <= endWeek) {
      bins.push({ start: new Date(cur), key: binKeyForDate(cur, 'week') });
      cur.setDate(cur.getDate() + 7);
    }
    return bins;
  }
  // month
  let cur = startOfMonth(start);
  const endMonth = startOfMonth(end);
  while (cur <= endMonth) {
    bins.push({ start: new Date(cur), key: binKeyForDate(cur, 'month') });
    cur.setMonth(cur.getMonth() + 1);
  }
  return bins;
}

function binKeyForDate(d: Date, granularity: Granularity) {
  if (granularity === 'day') return d.toISOString().slice(0,10);
  if (granularity === 'week') {
    const w = getISOWeek(d);
    return `${d.getFullYear()}-W${String(w).padStart(2,'0')}`;
    }
  // month
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function getISOWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Thursday in current week decides the year.
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
}
function computePreviousRange(cur: { start: Date; end: Date }) {
  const rangeMs = cur.end.getTime() - cur.start.getTime();
  const prevEnd = new Date(cur.start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - rangeMs);
  prevStart.setHours(0,0,0,0);
  prevEnd.setHours(23,59,59,999);
  return { start: prevStart, end: prevEnd };
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

function pctDelta(prev: number, curr: number) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}
