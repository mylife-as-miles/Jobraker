"use client"

import { useEffect, useRef } from "react"
import { Card } from "../ui/card"
import { motion } from "framer-motion"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"

type Period = "7d" | "30d" | "90d" | "ytd" | "12m";

export function MatchScoreAnalytics({ period, data }: { period: Period; data: any }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hasMatchBars = Array.isArray(data?.matchBarData) && data.matchBarData.length > 0
  const barData = hasMatchBars ? data.matchBarData : (data?.barData || [])
  const metrics = { matchScore: data?.metrics?.avgMatchScore ?? 0 }
  const delta = data?.comparisons?.avgMatchDelta ?? 0
  const highlight = hasMatchBars ? data.matchBarData[0] : null
  const loading = Boolean(data?.loading)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    ctx.clearRect(0, 0, rect.width, rect.height)

  if (!barData.length) return
    const maxValue = Math.max(...barData.map((d: any) => d.value))
    const barWidth = Math.min(60, (rect.width / barData.length) * 0.6)
    const spacing = (rect.width - (barData.length * barWidth)) / (barData.length + 1)
    const startX = spacing

    barData.forEach((item: any, index: number) => {
      const x = startX + index * (barWidth + spacing)
      const barHeight = (item.value / maxValue) * (rect.height - 80)
      const y = rect.height - 50 - barHeight

      // Draw background glow
      ctx.shadowColor = item.color + "80"
      ctx.shadowBlur = 25
      ctx.fillStyle = item.color + "40"
      ctx.fillRect(x - 8, y - 8, barWidth + 16, barHeight + 16)

      // Draw main bar with enhanced gradient
      ctx.shadowBlur = 0
      const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight)
      gradient.addColorStop(0, item.color)
      gradient.addColorStop(0.3, item.color + "E6")
      gradient.addColorStop(0.7, item.color + "CC")
      gradient.addColorStop(1, item.color + "99")
      
      ctx.fillStyle = gradient
      ctx.fillRect(x, y, barWidth, barHeight)

      // Add inner glow
      ctx.shadowColor = item.color
      ctx.shadowBlur = 20
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0
      ctx.fillRect(x + 2, y + 2, barWidth - 4, barHeight - 4)
      ctx.shadowBlur = 0

      // Add highlight on top
      const highlightGradient = ctx.createLinearGradient(0, y, 0, y + 20)
      highlightGradient.addColorStop(0, "rgba(255, 255, 255, 0.3)")
      highlightGradient.addColorStop(1, "rgba(255, 255, 255, 0)")
      ctx.fillStyle = highlightGradient
      ctx.fillRect(x, y, barWidth, Math.min(20, barHeight))

      // Draw value on top with enhanced styling
      ctx.fillStyle = "#ffffff"
      ctx.font = "bold 16px Inter, sans-serif"
      ctx.textAlign = "center"
      ctx.shadowColor = "rgba(0, 0, 0, 0.7)"
      ctx.shadowBlur = 4
      ctx.fillText(item.value.toString(), x + barWidth / 2, y - 15)
      ctx.shadowBlur = 0

      // Draw label at bottom with enhanced styling
      ctx.fillStyle = "#ffffff"
      ctx.font = "12px Inter, sans-serif"
      ctx.textAlign = "center"
      const words = String(item.name).split(' ')
      words.forEach((word, wordIndex) => {
        ctx.fillText(word, x + barWidth / 2, rect.height - 25 + (wordIndex * 14))
      })
    })
  }, [barData])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="h-full"
    >
      <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-6 rounded-2xl shadow-xl hover:shadow-2xl hover:bg-gradient-to-br hover:from-[#ffffff12] hover:to-[#ffffff08] transition-all duration-500 h-full flex flex-col">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white mb-3">Match Score Average</h2>
          <motion.div 
            key={metrics.matchScore}
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
            className="text-4xl sm:text-5xl font-black text-[#1dff00] mb-2 drop-shadow-lg"
          >
            {metrics.matchScore}%
          </motion.div>
          <div className="flex items-center gap-2 text-sm text-white/70 leading-relaxed">
            <span>Average match score in {String(period ?? '').toUpperCase()}.</span>
            {delta !== 0 && (
              <span className={`inline-flex items-center gap-1 text-xs font-medium ${delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {delta > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {delta > 0 ? '+' : ''}{delta}
              </span>
            )}
          </div>
        </div>

        <div className="relative flex-1 min-h-0">
          <canvas ref={canvasRef} className="w-full h-full" />
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
      </Card>
    </motion.div>
  )
}