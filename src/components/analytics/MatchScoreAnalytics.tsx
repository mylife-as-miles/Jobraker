"use client"

import { useEffect, useRef } from "react"
import { Card } from "../ui/card"
import { useRealTimeData } from "../../hooks/useRealTimeData"
import { motion } from "framer-motion"

export function MatchScoreAnalytics() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { barData, metrics } = useRealTimeData()

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

    const maxValue = Math.max(...barData.map((d) => d.value))
    const barWidth = Math.min(60, rect.width / barData.length * 0.6)
    const spacing = (rect.width - (barData.length * barWidth)) / (barData.length + 1)
    const startX = spacing

    barData.forEach((item, index) => {
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
      const words = item.name.split(' ')
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
          <p className="text-sm text-white/70 leading-relaxed">An average of how well your profile matches available jobs.</p>
        </div>

        <div className="flex-1 min-h-0">
          <canvas ref={canvasRef} className="w-full h-full" />
        </div>
      </Card>
    </motion.div>
  )
}