"use client"

import { Card } from "../ui/card"
import { motion } from "framer-motion"
import { ArrowDownRight, ArrowUpRight, Sparkles, TrendingUp } from "lucide-react"
import { LabelList, Pie, PieChart, ResponsiveContainer } from "recharts"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "../ui/chart"
import { Badge } from "../ui/badge"

type Period = "7d" | "30d" | "90d" | "ytd" | "12m";

const chartConfig = {
  value: {
    label: "Score",
  },
} satisfies ChartConfig;

export function MatchScoreAnalytics({ period, data }: { period: Period; data: any }) {
  const hasMatchBars = Array.isArray(data?.matchBarData) && data.matchBarData.length > 0
  const barData = hasMatchBars ? data.matchBarData : (data?.barData || [])
  const metrics = { matchScore: data?.metrics?.avgMatchScore ?? 0 }
  const delta = data?.comparisons?.avgMatchDelta ?? 0
  const highlight = hasMatchBars ? data.matchBarData[0] : null
  const loading = Boolean(data?.loading)

  // Transform bar data to pie chart data with application color palette
  const chartData = barData.slice(0, 5).map((item: any, index: number) => ({
    name: item.name,
    value: Math.round(item.value), // Round to whole number
    fill: [
      "#1dff00",  // Applied green
      "#56c2ff",  // Interview blue
      "#ffd700",  // Offer gold
      "#ff6b6b",  // Rejected red
    ][index % 4], // Loop through 4 application colors
  }))

  const hasData = chartData.length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="h-full"
    >
      <Card className="relative overflow-hidden border border-[#1dff00]/20 bg-gradient-to-br from-[#030303] via-[#050505] to-[#0a160a] backdrop-blur-[25px] rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-500 h-full flex flex-col">
        {/* Animated glow orbs */}
        <span className="pointer-events-none absolute -top-24 -right-12 h-56 w-56 rounded-full bg-[#1dff00]/20 blur-3xl opacity-60 animate-pulse" />
        <span className="pointer-events-none absolute -bottom-24 -left-12 h-56 w-56 rounded-full bg-[#1dff00]/10 blur-3xl opacity-40 animate-pulse" style={{ animationDelay: '1s' }} />
        
        {/* Header with large score display */}
        <div className="relative p-6 pb-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#1dff00]/10 border border-[#1dff00]/30">
                <Sparkles className="h-5 w-5 text-[#1dff00]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Match Score</h2>
                <p className="text-xs text-white/50">Average compatibility</p>
              </div>
            </div>
            {delta !== 0 && (
              <Badge
                variant="outline"
                className={`${
                  delta > 0
                    ? "text-[#1dff00] bg-[#1dff00]/10 border-[#1dff00]/30"
                    : "text-[#ff8b8b] bg-[#ff8b8b]/10 border-[#ff8b8b]/30"
                }`}
              >
                {delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                <span className="text-xs font-semibold">{delta > 0 ? '+' : ''}{delta}%</span>
              </Badge>
            )}
          </div>

          {/* Large centered score */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-center mb-2"
          >
            <div className="relative inline-block">
              <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-[#1dff00] via-[#00ff88] to-[#1dff00] drop-shadow-[0_0_20px_rgba(29,255,0,0.5)]">
                {Math.round(metrics.matchScore)}
              </div>
              <div className="absolute -top-2 -right-8">
                <span className="text-3xl font-bold text-[#1dff00]/80">%</span>
              </div>
            </div>
            <p className="text-sm text-white/60 mt-1">in {String(period ?? '').toUpperCase()}</p>
          </motion.div>
        </div>

        {/* Chart section */}
        <div className="relative flex-1 px-6 pb-6 flex items-center justify-center min-h-[240px]">
          {hasData ? (
            <div className="w-full h-[240px]">
              <ChartContainer
                config={chartConfig}
                data={chartData}
                className="w-full h-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <Pie
                      data={chartData}
                      innerRadius={50}
                      outerRadius={95}
                      dataKey="value"
                      nameKey="name"
                      cornerRadius={10}
                      paddingAngle={5}
                      animationDuration={800}
                    >
                      <LabelList
                        dataKey="value"
                        stroke="none"
                        fontSize={16}
                        fontWeight={700}
                        fill="#000000"
                        formatter={(value: number) => `${value}%`}
                      />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[240px] space-y-3">
              <div className="p-4 rounded-full bg-[#1dff00]/10 border border-[#1dff00]/20">
                <TrendingUp className="h-8 w-8 text-[#1dff00]" />
              </div>
              <p className="text-sm text-white/50">No match data available</p>
            </div>
          )}
          
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-4 border-[#1dff00]/30 border-t-[#1dff00] rounded-full animate-spin" />
                <span className="text-xs font-medium text-white/70">Loading match insights…</span>
              </div>
            </div>
          )}
        </div>

        {/* Top matches breakdown */}
        {hasData && (
          <div className="px-6 pb-6 space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <span className="text-xs uppercase tracking-wider text-white/40">Top Matches</span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>
            <div className="grid grid-cols-1 gap-2">
              {chartData.slice(0, 3).map((item: any, index: number) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.5 + index * 0.1 }}
                  className="group flex items-center justify-between rounded-xl border border-white/10 bg-gradient-to-r from-white/5 to-transparent px-4 py-3 hover:border-[#1dff00]/30 hover:bg-[#1dff00]/5 transition-all duration-300"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="relative">
                      <span
                        className="block h-4 w-4 rounded-full ring-2 ring-black/20"
                        style={{ backgroundColor: item.fill }}
                      />
                      <span className="absolute inset-0 h-4 w-4 rounded-full animate-ping opacity-20" style={{ backgroundColor: item.fill }} />
                    </div>
                    <span className="text-sm font-medium text-white/90 truncate group-hover:text-white transition-colors">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-[#1dff00]">{item.value}%</span>
                    <TrendingUp className="h-4 w-4 text-[#1dff00]/60 group-hover:text-[#1dff00] transition-colors" />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {highlight?.summary && (
          <div className="px-6 pb-6">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-white/60 leading-relaxed">
                {highlight.company && <span className="font-semibold text-[#1dff00]">{highlight.company}</span>}
                {highlight.company && " — "}
                {highlight.name}: {highlight.summary}
              </p>
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  )
}