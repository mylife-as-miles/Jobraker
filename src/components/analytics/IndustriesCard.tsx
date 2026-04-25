"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Globe2, Layers, SearchCheck } from "lucide-react";
import { Card } from "../ui/card";

type Period = "7d" | "30d" | "90d" | "ytd" | "12m";

export function IndustriesCard({
  period,
  data,
}: {
  period: Period;
  data: any;
}) {
  const sourceData = useMemo(() => {
    return Array.isArray(data?.sourceBreakdown) ? data.sourceBreakdown : [];
  }, [data?.sourceBreakdown]);

  const metrics = {
    sources: data?.metrics?.sources ?? 0,
    jobsFound: data?.metrics?.jobsFound ?? 0,
    interviews: data?.metrics?.interviews ?? 0,
  };

  const hasData = sourceData.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.05 }}
      className='h-full'
    >
      <Card className='h-full overflow-hidden border border-foreground/10 bg-card/90 shadow-sm'>
        <div className='flex h-full flex-col p-5 sm:p-6'>
          <div className='mb-5 flex items-start justify-between gap-3'>
            <div>
              <div className='inline-flex items-center gap-2 rounded-full border border-[#56c2ff]/25 bg-[#56c2ff]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#56c2ff]'>
                <Globe2 className='h-3.5 w-3.5' />
                Source mix
              </div>
              <h3 className='mt-3 text-2xl font-semibold text-foreground'>
                Where jobs are coming from
              </h3>
              <p className='mt-1 text-sm text-foreground/65'>
                Top discovery channels in {String(period).toUpperCase()}
              </p>
            </div>
            <div className='rounded-2xl border border-foreground/10 bg-background/70 px-3 py-2 text-right'>
              <div className='text-[11px] uppercase tracking-wide text-foreground/50'>
                Distinct sources
              </div>
              <div className='mt-1 text-2xl font-bold text-foreground'>
                {metrics.sources}
              </div>
            </div>
          </div>

          <div className='mb-4 grid grid-cols-2 gap-3'>
            <div className='rounded-2xl border border-foreground/10 bg-background/60 p-3'>
              <div className='flex items-center gap-2 text-xs uppercase tracking-wide text-foreground/50'>
                <SearchCheck className='h-4 w-4 text-brand' />
                Jobs found
              </div>
              <div className='mt-2 text-xl font-semibold text-foreground'>
                {metrics.jobsFound}
              </div>
            </div>
            <div className='rounded-2xl border border-foreground/10 bg-background/60 p-3'>
              <div className='flex items-center gap-2 text-xs uppercase tracking-wide text-foreground/50'>
                <Layers className='h-4 w-4 text-brand' />
                Interviews
              </div>
              <div className='mt-2 text-xl font-semibold text-foreground'>
                {metrics.interviews}
              </div>
            </div>
          </div>

          <div className='min-h-[260px] flex-1'>
            {hasData ? (
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart
                  data={sourceData}
                  layout='vertical'
                  margin={{ top: 8, right: 8, left: 12, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray='3 3'
                    horizontal={false}
                    stroke='rgba(148, 163, 184, 0.12)'
                  />
                  <XAxis
                    type='number'
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "rgba(100,116,139,0.9)", fontSize: 12 }}
                  />
                  <YAxis
                    type='category'
                    dataKey='name'
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "rgba(71,85,105,1)", fontSize: 12 }}
                    width={96}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(29,255,0,0.06)" }}
                    contentStyle={{
                      borderRadius: 16,
                      border: "1px solid rgba(148,163,184,0.18)",
                      background: "rgba(15, 23, 42, 0.92)",
                      color: "#f8fafc",
                    }}
                    formatter={(value) => [value, "Jobs"]}
                  />
                  <Bar dataKey='value' radius={[8, 8, 8, 8]}>
                    {sourceData.map((entry: any, index: number) => (
                      <Cell key={entry.name + index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className='flex h-full min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-border bg-background/45 text-sm text-foreground/55'>
                No source data is available yet.
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
