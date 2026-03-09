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
      <Card className="relative h-full overflow-hidden border border-border bg-card/90 shadow-sm">
        <div className="flex h-full flex-col p-5 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#1dff00]/25 bg-[#1dff00]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#1dff00]">
                <Sparkles className="h-3.5 w-3.5" />
                Match quality
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-foreground">Top match performance</h2>
              <p className="mt-1 text-sm text-foreground/65">Average compatibility in {String(period).toUpperCase()}</p>
            </div>

            <div className="rounded-2xl border border-border bg-background/70 px-4 py-3 text-right">
              <div className="text-[11px] uppercase tracking-wide text-foreground/50">Average score</div>
              <div className="mt-1 flex items-center justify-end gap-2 text-3xl font-bold text-foreground">
                <span>{Math.round(average)}%</span>
                {delta !== 0 ? (
                  <span className={delta > 0 ? "inline-flex items-center gap-1 text-sm text-emerald-500" : "inline-flex items-center gap-1 text-sm text-rose-500"}>
                    {delta > 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    {delta > 0 ? "+" : ""}{delta}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="relative min-h-[250px] flex-1">
            {hasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 16, left: 12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(148, 163, 184, 0.12)" />
                  <XAxis type="number" domain={xDomain} tickLine={false} axisLine={false} tick={{ fill: "rgba(100,116,139,0.9)", fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "rgba(71,85,105,1)", fontSize: 12 }} width={110} />
                  <Tooltip
                    cursor={{ fill: "rgba(29,255,0,0.06)" }}
                    contentStyle={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.18)", background: "rgba(15, 23, 42, 0.92)", color: "#f8fafc" }}
                    formatter={(value) => [hasRoleDetails ? value + "%" : value, hasRoleDetails ? "Score" : "Matches"]}
                  />
                  <Bar dataKey="value" radius={[8, 8, 8, 8]}>
                    {chartData.map((entry: any, index: number) => (
                      <Cell key={entry.name + index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full min-h-[250px] items-center justify-center rounded-2xl border border-dashed border-border bg-background/45 text-sm text-foreground/55">
                No match score data is available yet.
              </div>
            )}

            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/70 backdrop-blur-sm">
                <div className="flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground/70 shadow-sm">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#1dff00]/25 border-t-[#1dff00]" />
                  Loading match insights...
                </div>
              </div>
            ) : null}
          </div>

          {highlight?.summary ? (
            <div className="mt-4 rounded-2xl border border-border bg-background/65 p-4 text-sm text-foreground/70">
              <span className="font-semibold text-foreground">{highlight.name}</span>
              {highlight.company ? <span className="text-foreground/45"> at {highlight.company}</span> : null}
              <p className="mt-2 leading-relaxed">{highlight.summary}</p>
            </div>
          ) : null}
        </div>
      </Card>
    </motion.div>
  );
}
