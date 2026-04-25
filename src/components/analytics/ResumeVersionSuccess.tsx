"use client";

import { motion } from "framer-motion";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CheckCircle2 } from "lucide-react";
import { Card } from "../ui/card";

type Period = "7d" | "30d" | "90d" | "ytd" | "12m";

function StatusTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: any[];
}) {
  if (!active || !payload?.length) return null;

  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className='min-w-[150px] rounded-2xl border border-white/10 bg-slate-950/95 px-3 py-2 text-left shadow-2xl backdrop-blur-md'>
      <div className='text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400'>
        {item.name}
      </div>
      <div className='mt-1 flex items-center gap-2 text-sm font-semibold text-slate-50'>
        <span>{item.share ?? 0}%</span>
        <span className='text-slate-500'>:</span>
        <span>{item.value} applications</span>
      </div>
    </div>
  );
}

export function ResumeVersionSuccess({
  period,
  data,
}: {
  period: Period;
  data: any;
}) {
  const chartData = Array.isArray(data?.donutData) ? data.donutData : [];
  const totalApplications =
    data?.metrics?.applications ??
    chartData.reduce((sum: number, item: any) => sum + (item.value || 0), 0);
  const hasData = chartData.length > 0 && totalApplications > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.15 }}
      className='h-full'
    >
      <Card className='h-full overflow-hidden border border-foreground/10 bg-card/90 shadow-sm'>
        <div className='flex h-full flex-col p-5 sm:p-6'>
          <div className='mb-5 flex items-start justify-between gap-3'>
            <div>
              <div className='inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand'>
                <CheckCircle2 className='h-3.5 w-3.5' />
                Status mix
              </div>
              <h2 className='mt-3 text-2xl font-semibold text-foreground'>
                Application status mix
              </h2>
              <p className='mt-1 text-sm text-foreground/65'>
                Pipeline breakdown for {String(period).toUpperCase()}
              </p>
            </div>
            <div className='rounded-2xl border border-foreground/10 bg-background/70 px-4 py-3 text-right'>
              <div className='text-[11px] uppercase tracking-wide text-foreground/50'>
                Total applications
              </div>
              <div className='mt-1 text-3xl font-bold text-foreground'>
                {totalApplications}
              </div>
            </div>
          </div>

          <div className='grid flex-1 grid-cols-1 gap-5 lg:grid-cols-[260px,1fr] lg:items-center'>
            <div className='mx-auto h-[240px] w-[240px]'>
              {hasData ? (
                <ResponsiveContainer width='100%' height='100%'>
                  <PieChart>
                    <Tooltip cursor={false} content={<StatusTooltip />} />
                    <Pie
                      data={chartData}
                      dataKey='value'
                      nameKey='name'
                      innerRadius={64}
                      outerRadius={96}
                      paddingAngle={4}
                      cornerRadius={8}
                      stroke='none'
                    >
                      {chartData.map((entry: any, index: number) => (
                        <Cell key={entry.name + index} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className='flex h-full items-center justify-center rounded-2xl border border-dashed border-foreground/10 bg-background/45 text-sm text-foreground/55'>
                  No status data yet.
                </div>
              )}
            </div>

            <div className='space-y-3'>
              {hasData ? (
                chartData.map((item: any) => (
                  <div
                    key={item.name}
                    className='flex items-center justify-between rounded-2xl border border-foreground/10 bg-background/60 px-4 py-3'
                  >
                    <div className='flex items-center gap-3'>
                      <span
                        className='h-3.5 w-3.5 rounded-full'
                        style={{ backgroundColor: item.color }}
                      />
                      <div>
                        <div className='font-medium text-foreground'>
                          {item.name}
                        </div>
                        <div className='text-xs text-foreground/55'>
                          {item.share ?? 0}% of applications
                        </div>
                      </div>
                    </div>
                    <div className='text-right'>
                      <div className='text-lg font-semibold text-foreground'>
                        {item.value}
                      </div>
                      <div className='text-xs text-foreground/55'>count</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className='flex min-h-[160px] items-center justify-center rounded-2xl border border-dashed border-foreground/10 bg-background/45 text-sm text-foreground/55'>
                  Submit applications to populate your pipeline distribution.
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
