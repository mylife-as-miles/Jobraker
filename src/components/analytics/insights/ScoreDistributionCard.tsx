"use client";

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
import { BarChart3 } from "lucide-react";
import { Card } from "../../ui/card";
import type { ScoreDistributionBucket } from "../../../hooks/insightsComputations";

interface ScoreDistributionCardProps {
  scoreDistribution: ScoreDistributionBucket[];
  period: string;
  loading: boolean;
}

export function ScoreDistributionCard({
  scoreDistribution,
  period,
  loading,
}: ScoreDistributionCardProps) {
  const hasData = scoreDistribution.some((b) => b.count > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.15 }}
      className='h-full'
    >
      <Card className='relative h-full overflow-hidden border border-border/40 bg-card/40 backdrop-blur-xl shadow-2xl transition-all duration-300'>
        {/* Decorative gradient background */}
        <div className='absolute -top-24 -right-24 w-64 h-64 rounded-full bg-brand/5 blur-3xl' />
        <div className='absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-brand/5 blur-3xl' />

        <div className='relative z-10 flex h-full flex-col p-5 sm:p-6'>
          {/* Header */}
          <div className='mb-6 space-y-3'>
            <div className='inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-brand'>
              <BarChart3 className='h-3.5 w-3.5' />
              Score distribution
            </div>
            <h2 className='text-2xl font-bold text-foreground tracking-tight'>
              Match score breakdown
            </h2>
            <p className='text-sm text-muted-foreground/80'>
              Distribution of scores in {String(period).toUpperCase()}
            </p>
          </div>

          {/* Chart / Empty / Loading */}
          <div className='relative min-h-[250px] flex-1'>
            {hasData ? (
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart
                  data={scoreDistribution}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray='3 3'
                    stroke='rgba(148, 163, 184, 0.16)'
                    vertical={false}
                  />
                  <XAxis
                    dataKey='range'
                    tickLine={false}
                    axisLine={false}
                    tick={{
                      fill: "rgba(100,116,139,0.9)",
                      fontSize: 12,
                    }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{
                      fill: "rgba(100,116,139,0.9)",
                      fontSize: 12,
                    }}
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
                    formatter={(
                      value: number,
                      _name: string,
                      props: { payload?: ScoreDistributionBucket },
                    ) => {
                      const pct = props.payload?.percentage ?? 0;
                      return [`${value} (${pct}%)`, "Applications"];
                    }}
                  />
                  <Bar
                    dataKey='count'
                    name='Applications'
                    radius={[6, 6, 0, 0]}
                  >
                    {scoreDistribution.map((bucket, index) => (
                      <Cell key={`cell-${index}`} fill={bucket.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className='flex h-full min-h-[250px] items-center justify-center rounded-2xl border border-dashed border-border/40 bg-background/20 text-sm text-muted-foreground/60 backdrop-blur-sm'>
                No score data available for this period.
              </div>
            )}

            {/* Loading overlay */}
            {loading && (
              <div className='absolute inset-0 flex items-center justify-center rounded-2xl bg-background/60 backdrop-blur-xl transition-all duration-500'>
                <div className='flex items-center gap-3 rounded-full border border-border/40 bg-card/80 px-5 py-2.5 text-xs font-medium text-foreground/80 shadow-2xl backdrop-blur-md'>
                  <div className='h-4 w-4 animate-spin rounded-full border-2 border-brand/20 border-t-brand' />
                  Analyzing score distribution...
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
