"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Briefcase, Sparkles, Target } from "lucide-react";
import { Card } from "../ui/card";

type Period = "7d" | "30d" | "90d" | "ytd" | "12m";

type SeriesPoint = {
  name: string;
  value: number;
  timestamp: number;
};

export function InsightCard({ period, data }: { period: Period; data: any }) {
  const appSeries = (
    Array.isArray(data?.chartDataApps) ? data.chartDataApps : []
  ) as SeriesPoint[];
  const jobSeries = (
    Array.isArray(data?.chartDataJobs) ? data.chartDataJobs : []
  ) as SeriesPoint[];

  const combinedSeries = useMemo(() => {
    const byTimestamp = new Map<
      number,
      { name: string; applications: number; jobs: number }
    >();

    for (const point of appSeries) {
      byTimestamp.set(point.timestamp, {
        name: point.name,
        applications: point.value || 0,
        jobs: byTimestamp.get(point.timestamp)?.jobs || 0,
      });
    }

    for (const point of jobSeries) {
      const existing = byTimestamp.get(point.timestamp);
      byTimestamp.set(point.timestamp, {
        name: point.name,
        applications: existing?.applications || 0,
        jobs: point.value || 0,
      });
    }

    return Array.from(byTimestamp.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, value]) => value);
  }, [appSeries, jobSeries]);

  const hasData = combinedSeries.some(
    (point) => point.applications > 0 || point.jobs > 0,
  );
  const metrics = data?.metrics || {
    applications: 0,
    jobsFound: 0,
    interviews: 0,
    avgMatchScore: 0,
  };

  const peak = useMemo(() => {
    return combinedSeries.reduce(
      (best, point) => {
        const total = point.applications + point.jobs;
        return total > best.total ? { name: point.name, total } : best;
      },
      { name: "", total: 0 },
    );
  }, [combinedSeries]);

  const headline =
    metrics.applications > 0 || metrics.jobsFound > 0
      ? metrics.applications +
        " applications from " +
        metrics.jobsFound +
        " discovered roles"
      : "No application or discovery activity in this period";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className='h-full'
    >
      <Card className='h-full overflow-hidden border border-foreground/10 bg-card/90 shadow-sm'>
        <div className='flex h-full flex-col p-5 sm:p-6'>
          <div className='mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
            <div className='space-y-3'>
              <div className='inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand'>
                <Sparkles className='h-3.5 w-3.5' />
                Activity trend
              </div>
              <div>
                <h2 className='text-2xl font-semibold text-foreground'>
                  Search momentum
                </h2>
                <p className='mt-1 text-sm text-foreground/65'>{headline}</p>
              </div>
            </div>

            <div className='grid grid-cols-2 gap-3 sm:min-w-[320px]'>
              <div className='rounded-2xl border border-foreground/10 bg-background/70 p-4'>
                <div className='flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-foreground/55'>
                  <Briefcase className='h-4 w-4 text-[#56c2ff]' />
                  Jobs found
                </div>
                <div className='mt-3 text-3xl font-bold text-foreground'>
                  {metrics.jobsFound}
                </div>
              </div>
              <div className='rounded-2xl border border-foreground/10 bg-background/70 p-4'>
                <div className='flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-foreground/55'>
                  <Target className='h-4 w-4 text-brand' />
                  Applications
                </div>
                <div className='mt-3 text-3xl font-bold text-foreground'>
                  {metrics.applications}
                </div>
              </div>
            </div>
          </div>

          <div className='mb-4 grid grid-cols-1 gap-3 md:grid-cols-3'>
            <div className='rounded-2xl border border-foreground/10 bg-background/60 p-3'>
              <div className='text-xs uppercase tracking-wide text-foreground/50'>
                Interviews
              </div>
              <div className='mt-2 text-xl font-semibold text-foreground'>
                {metrics.interviews}
              </div>
            </div>
            <div className='rounded-2xl border border-foreground/10 bg-background/60 p-3'>
              <div className='text-xs uppercase tracking-wide text-foreground/50'>
                Avg. match
              </div>
              <div className='mt-2 text-xl font-semibold text-foreground'>
                {metrics.avgMatchScore}%
              </div>
            </div>
            <div className='rounded-2xl border border-foreground/10 bg-background/60 p-3'>
              <div className='text-xs uppercase tracking-wide text-foreground/50'>
                Peak activity
              </div>
              <div className='mt-2 text-xl font-semibold text-foreground'>
                {peak.total > 0 ? peak.name : String(period).toUpperCase()}
              </div>
            </div>
          </div>

          <div className='min-h-[250px] flex-1'>
            {hasData ? (
              <ResponsiveContainer width='100%' height='100%'>
                <AreaChart
                  data={combinedSeries}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id='insightJobs'
                      x1='0'
                      y1='0'
                      x2='0'
                      y2='1'
                    >
                      <stop
                        offset='5%'
                        stopColor='#56c2ff'
                        stopOpacity={0.28}
                      />
                      <stop
                        offset='95%'
                        stopColor='#56c2ff'
                        stopOpacity={0.03}
                      />
                    </linearGradient>
                    <linearGradient
                      id='insightApps'
                      x1='0'
                      y1='0'
                      x2='0'
                      y2='1'
                    >
                      <stop
                        offset='5%'
                        stopColor='#1dff00'
                        stopOpacity={0.24}
                      />
                      <stop
                        offset='95%'
                        stopColor='#1dff00'
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray='3 3'
                    stroke='rgba(148, 163, 184, 0.16)'
                    vertical={false}
                  />
                  <XAxis
                    dataKey='name'
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "rgba(100,116,139,0.9)", fontSize: 12 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "rgba(100,116,139,0.9)", fontSize: 12 }}
                    width={32}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 16,
                      border: "1px solid rgba(148,163,184,0.18)",
                      background: "rgba(15, 23, 42, 0.92)",
                      color: "#f8fafc",
                      boxShadow: "0 18px 40px rgba(15, 23, 42, 0.35)",
                    }}
                  />
                  <Legend />
                  <Area
                    type='monotone'
                    dataKey='jobs'
                    name='Jobs found'
                    stroke='#56c2ff'
                    fill='url(#insightJobs)'
                    strokeWidth={2.5}
                  />
                  <Line
                    type='monotone'
                    dataKey='applications'
                    name='Applications'
                    stroke='#1dff00'
                    strokeWidth={3}
                    dot={{ r: 3, fill: "#1dff00" }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className='flex h-full min-h-[250px] items-center justify-center rounded-2xl border border-dashed border-foreground/10 bg-background/45 text-sm text-foreground/55'>
                No activity data is available for this period yet.
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
