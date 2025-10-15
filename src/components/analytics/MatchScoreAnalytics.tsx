"use client"

import { Card } from "../ui/card"
import { motion } from "framer-motion"
import { ArrowDownRight, ArrowUpRight, Sparkles } from "lucide-react"
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

  // Transform bar data to pie chart data with vibrant green colors
  const chartData = barData.slice(0, 5).map((item: any, index: number) => ({
    name: item.name,
    value: item.value,
    fill: [
      "#1dff00",  // Bright green
      "#00ff88",  // Teal green
      "#88ff00",  // Yellow-green
      "#00ffcc",  // Cyan
      "#ccff00",  // Lime
    ][index % 5],
  }))

  const hasData = chartData.length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="h-full"
    >
      <Card className="relative overflow-hidden border border-[#1dff00]/20 bg-gradient-to-br from-[#030303] via-[#050505] to-[#0a160a] backdrop-blur-[25px] p-6 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-500 h-full flex flex-col">
        <span className="pointer-events-none absolute -top-24 -right-12 h-56 w-56 rounded-full bg-[#1dff00]/20 blur-3xl opacity-60" />
        
        <div className="relative mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#1dff00]" />
              <h2 className="text-xl font-bold text-white">Match Score Average</h2>
            </div>
            <Badge
              variant="outline"
              className={
                metrics.matchScore >= 70
                  ? "text-[#1dff00] bg-[#1dff00]/10 border-none"
                  : metrics.matchScore >= 50
                  ? "text-[#ffd78b] bg-[#ffd78b]/10 border-none"
                  : "text-[#ff8b8b] bg-[#ff8b8b]/10 border-none"
              }
            >
              <ArrowUpRight className="h-4 w-4" />
              <span>{metrics.matchScore}%</span>
            </Badge>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-white/60 leading-relaxed">
            <span>Average match score in {String(period ?? '').toUpperCase()}.</span>
            {delta !== 0 && (
              <span className={`inline-flex items-center gap-1 text-xs font-medium ${delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {delta > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {delta > 0 ? '+' : ''}{delta}%
              </span>
            )}
          </div>
        </div>

        <div className="relative flex-1 min-h-0 flex items-center justify-center">
          {hasData ? (
            <div className="w-full h-[280px]">
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
                      innerRadius={40}
                      outerRadius={85}
                      dataKey="value"
                      nameKey="name"
                      cornerRadius={8}
                      paddingAngle={4}
                    >
                      <LabelList
                        dataKey="value"
                        stroke="none"
                        fontSize={14}
                        fontWeight={600}
                        fill="#ffffff"
                        formatter={(value: number) => `${value}%`}
                      />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          ) : (
            <div className="flex h-[250px] items-center justify-center">
              <div className="text-center space-y-2">
                <div className="text-6xl font-bold text-[#1dff00]">{metrics.matchScore}%</div>
                <p className="text-sm text-white/50">Overall Match Score</p>
              </div>
            </div>
          )}
          
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/30 text-xs font-medium text-white/70">
              Loading match insights…
            </div>
          )}
        </div>

        {highlight?.summary && (
          <p className="mt-4 text-xs text-white/60 leading-snug line-clamp-3">
            {highlight.company ? `${highlight.company} — ` : ""}{highlight.name}: {highlight.summary}
          </p>
        )}

        {hasData && (
          <div className="mt-4 space-y-2">
            {chartData.map((item: any, index: number) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: item.fill }}
                  />
                  <span className="text-sm font-medium text-white/90 truncate">{item.name}</span>
                </div>
                <span className="text-sm font-semibold text-[#1dff00]">{item.value}%</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </motion.div>
  )
}