"use client";

import { motion } from "framer-motion";
import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, TrendingUp } from "lucide-react";
import { Card } from "../../ui/card";
import type { ScoreTrendPoint } from "../../../hooks/insightsComputations";

interface ScoreTrendCardProps {
  scoreTrend: ScoreTrendPoint[];
  overallAvgScore: number;
  scoreDelta: number;
  period: string;
  loading: boolean;
}

export function ScoreTrendCard({
  scoreTrend,
  overallAvgScore,
  scoreDelta,
  period,
  loading,
}: ScoreTrendCardProps) {
  const hasData = scoreTrend.length >= 2;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.1 }}
      className='h-full'
    >
      <Card className='relative h-full overflow-hidden border border-border/40 bg-card/40 backdrop-blur-xl shadow-2xl transition-all duration-300'>
        {/* Decorative gradient background */}
        <div className='absolute -top-24 -right-24 w-64 h-64 rounded-full bg-[#56c2ff]/5 blur-3xl' />
        <div className='absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-[#56c2ff]/5 blur-3xl' />

        <div className='relative z-10 flex h-full flex-col p-5 sm:p-6'>
          {/* Header */}
          <div className='mb-6 flex items-start justify-between gap-3'>
            <div className='space-y-3'>
              <div className='inline-flex items-center gap-2 rounded-full border border-[#56c2ff]/25 bg-[#56c2ff]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#56c2ff]'>
                <TrendingUp className='h-3.5 w-3.5' />
                Score trend
              </div>
              <h2 className='text-2xl font-bold text-foreground tracking-tight'>
                Match score over time
              </h2>
              <p className='text-sm text-muted-foreground/80'>
                Average score per bucket in {String(period).toUpperCase()}
              </p>
            </div>

            {/* Numeric badge — matches MatchScoreAnalytics style */}
            <div className='rounded-2xl border border-border/40 bg-background/40 backdrop-blur-md px-5 py-4 text-right shadow-inner ring-1 ring-white/5'>
              <div className='text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60'>
                Average
              </div>
              <div className='mt-1 flex items-center justify-end gap-2 text-4xl font-extrabold text-foreground tracking-tighter'>
                <span className='bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent'>
                  {Math.round(overallAvgScore)}%
                </span>
                {scoreDelta !== 0 && (
                  <div
                    className={
                      scoreDelta > 0
                        ? "flex items-center gap-0.5 text-xs text-brand font-bold bg-brand/10 px-1.5 py-0.5 rounded-full"
                        : "flex items-center gap-0.5 text-xs text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded-full"
                    }
                  >
                    {scoreDelta > 0 ? (
                      <ArrowUpRight className='h-3 w-3' />
                    ) : (
                      <ArrowDownRight className='h-3 w-3' />
                    )}
                    {scoreDelta > 0 ? "+" : ""}
                    {scoreDelta}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chart / Empty / Loading */}
          <div className='relative min-h-[250px] flex-1'>
            {hasData ? (
              <ResponsiveContainer width='100%' height='100%'>
                <LineChart
                  data={scoreTrend}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id='scoreTrendGradient'
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
                  </defs>
                  <CartesianGrid
                    strokeDasharray='3 3'
                    stroke='rgba(148, 163, 184, 0.16)'
                    vertical={false}
                  />
                  <XAxis
                    dataKey='label'
                    tickLine={false}
                    axisLine={false}
                    tick={{
                      fill: "rgba(100,116,139,0.9)",
                      fontSize: 12,
                    }}
                  />
                  <YAxis
                    domain={[0, 100]}
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
                    formatter={(value: number) => [`${value}%`, "Avg Score"]}
                  />
                  <Line
                    type='monotone'
                    dataKey='avgScore'
                    name='Avg Score'
                    stroke='#56c2ff'
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#56c2ff", strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: "#56c2ff" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className='flex h-full min-h-[250px] items-center justify-center rounded-2xl border border-dashed border-border/40 bg-background/20 text-sm text-muted-foreground/60 backdrop-blur-sm'>
                Not enough data points to display a trend chart.
              </div>
            )}

            {/* Loading overlay */}
            {loading && (
              <div className='absolute inset-0 flex items-center justify-center rounded-2xl bg-background/60 backdrop-blur-xl transition-all duration-500'>
                <div className='flex items-center gap-3 rounded-full border border-border/40 bg-card/80 px-5 py-2.5 text-xs font-medium text-foreground/80 shadow-2xl backdrop-blur-md'>
                  <div className='h-4 w-4 animate-spin rounded-full border-2 border-[#56c2ff]/20 border-t-[#56c2ff]' />
                  Analyzing score trends...
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
