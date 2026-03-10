"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Sparkles } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "../ui/card";

type Period = "7d" | "30d" | "90d" | "ytd" | "12m";

export function MatchScoreAnalytics({ period, data }: { period: Period; data: any }) {
  const chartData = useMemo(() => {
    return Array.isArray(data?.matchBarData) ? data.matchBarData.slice(0, 6) : [];
  }, [data?.matchBarData]);

  const delta = data?.comparisons?.avgMatchDelta ?? 0;
  const average = data?.metrics?.avgMatchScore ?? 0;
  const loading = Boolean(data?.loading);
  const hasData = chartData.length > 0;
  const hasRoleDetails = chartData.some((item: any) => Boolean(item?.summary || item?.company));
  const maxValue = Math.max(...chartData.map((item: any) => Number(item.value) || 0), 0);
  const xDomain = hasRoleDetails ? [0, 100] : [0, Math.max(4, maxValue + 1)];
  const highlight = hasRoleDetails ? chartData[0] : null;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 }} className="h-full">
      <Card className="relative h-full overflow-hidden border border-border/40 bg-card/40 backdrop-blur-xl shadow-2xl transition-all duration-300">
        {/* Decorative Gradient Background */}
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-emerald-500/5 blur-3xl" />

        <div className="relative z-10 flex h-full flex-col p-5 sm:p-6">
          <div className="mb-6 flex items-start justify-between gap-3">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-400">
                <Sparkles className="h-3.5 w-3.5" />
                Match quality
              </div>
              <h2 className="text-2xl font-bold text-foreground tracking-tight">Top match performance</h2>
              <p className="text-sm text-muted-foreground/80">Average compatibility in {String(period).toUpperCase()}</p>
            </div>

            <div className="rounded-2xl border border-border/40 bg-background/40 backdrop-blur-md px-5 py-4 text-right shadow-inner ring-1 ring-white/5">
              <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">Average</div>
              <div className="mt-1 flex items-center justify-end gap-2 text-4xl font-extrabold text-foreground tracking-tighter">
                <span className="bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {Math.round(average)}%
                </span>
                {delta !== 0 ? (
                  <div className={delta > 0 ? "flex items-center gap-0.5 text-xs text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded-full" : "flex items-center gap-0.5 text-xs text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded-full"}>
                    {delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {delta > 0 ? "+" : ""}{delta}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="relative min-h-[250px] flex-1">
            {hasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 24, left: 12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="rgba(52, 211, 153, 0.8)" />
                      <stop offset="100%" stopColor="rgba(16, 185, 129, 1)" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(148, 163, 184, 0.08)" />
                  <XAxis type="number" domain={xDomain} axisLine={false} tickLine={false} tick={false} height={0} />
                  <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "rgba(148, 163, 184, 0.8)", fontSize: 11, fontWeight: 500 }} width={100} />
                  <Tooltip
                    cursor={{ fill: "rgba(16, 185, 129, 0.04)" }}
                    contentStyle={{ borderRadius: 16, border: "1px solid rgba(255, 255, 255, 0.08)", background: "rgba(15, 23, 42, 0.95)", color: "#f8fafc", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)" }}
                    formatter={(value) => [hasRoleDetails ? value + "%" : value, hasRoleDetails ? "Score" : "Matches"]}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24}>
                    {chartData.map((entry: any, index: number) => (
                      <Cell key={entry.name + index} fill={entry.color ? entry.color : "url(#barGradient)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full min-h-[250px] items-center justify-center rounded-2xl border border-dashed border-border/40 bg-background/20 text-sm text-muted-foreground/60 backdrop-blur-sm">
                No match score data is available yet.
              </div>
            )}

            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/60 backdrop-blur-xl transition-all duration-500">
                <div className="flex items-center gap-3 rounded-full border border-border/40 bg-card/80 px-5 py-2.5 text-xs font-medium text-foreground/80 shadow-2xl backdrop-blur-md">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500/20 border-t-emerald-500" />
                  Analyzing matches...
                </div>
              </div>
            ) : null}
          </div>

          {highlight?.summary ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 rounded-2xl border border-border/30 bg-emerald-500/5 p-4 text-sm text-foreground/80 ring-1 ring-emerald-500/10"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="font-bold text-foreground">{highlight.name}</span>
                {highlight.company ? (
                  <>
                    <div className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                    <span className="text-muted-foreground/70 font-medium">{highlight.company}</span>
                  </>
                ) : null}
              </div>
              <p className="leading-relaxed text-muted-foreground/90 italic">"{highlight.summary}"</p>
            </motion.div>
          ) : null}
        </div>
      </Card>
    </motion.div>
  );
}
