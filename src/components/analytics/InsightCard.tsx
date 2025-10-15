"use client"

import { useEffect, useMemo, useRef } from "react"
import { Card } from "../ui/card"
import { Lightbulb, ChevronLeft, ChevronRight } from "lucide-react"
import { motion } from "framer-motion"

type Period = "7d" | "30d" | "90d" | "ytd" | "12m";

export function InsightCard({ period, data }: { period: Period; data: any }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartData = (data?.chartDataApps?.length ? data.chartDataApps : data?.chartDataJobs) || []

  const headline = useMemo(() => {
    const ms = data?.metrics?.avgMatchScore ?? 0
    const apps = data?.metrics?.applications ?? 0
    const jobs = data?.metrics?.jobsFound ?? 0
    if (apps > 0 && ms > 0) return `${ms}% avg match across ${apps} applications`
    if (jobs > 0) return `${jobs} new jobs in your feed`
    return `No activity in period`
  }, [data])

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

    // Convert chart data to points
    if (!chartData.length) return

    const maxValue = Math.max(...chartData.map((d: any) => d.value))
    const minValue = Math.min(...chartData.map((d: any) => d.value))
    const valueRange = maxValue - minValue || 1

    const points = chartData.map((data: any, index: number) => ({
      x: (rect.width / (chartData.length - 1)) * index,
      y: rect.height * 0.8 - ((data.value - minValue) / valueRange) * (rect.height * 0.6)
    }))

    // Draw background glow
    ctx.strokeStyle = "rgba(29, 255, 0, 0.3)"
    ctx.lineWidth = 8
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.shadowColor = "#1dff00"
    ctx.shadowBlur = 10
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0

    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) {
      const prevPoint = points[i - 1]
      const currentPoint = points[i]
      const cpx = prevPoint.x + (currentPoint.x - prevPoint.x) * 0.5
      const cpy1 = prevPoint.y
      const cpy2 = currentPoint.y
      ctx.bezierCurveTo(cpx, cpy1, cpx, cpy2, currentPoint.x, currentPoint.y)
    }
    ctx.stroke()

    // Draw main line with enhanced glow
    ctx.strokeStyle = "#1dff00"
    ctx.lineWidth = 3
    ctx.shadowBlur = 8

    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) {
      const prevPoint = points[i - 1]
      const currentPoint = points[i]
      const cpx = prevPoint.x + (currentPoint.x - prevPoint.x) * 0.5
      const cpy1 = prevPoint.y
      const cpy2 = currentPoint.y
      ctx.bezierCurveTo(cpx, cpy1, cpx, cpy2, currentPoint.x, currentPoint.y)
    }
    ctx.stroke()

    // Draw enhanced area fill with multiple gradients
    ctx.shadowBlur = 0
    const gradient = ctx.createLinearGradient(0, 0, 0, rect.height)
    gradient.addColorStop(0, "rgba(29, 255, 0, 0.4)")
    gradient.addColorStop(0.5, "rgba(29, 255, 0, 0.2)")
    gradient.addColorStop(1, "rgba(29, 255, 0, 0.05)")
    
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) {
      const prevPoint = points[i - 1]
      const currentPoint = points[i]
      const cpx = prevPoint.x + (currentPoint.x - prevPoint.x) * 0.5
      const cpy1 = prevPoint.y
      const cpy2 = currentPoint.y
      ctx.bezierCurveTo(cpx, cpy1, cpx, cpy2, currentPoint.x, currentPoint.y)
    }
    ctx.lineTo(rect.width, rect.height)
    ctx.lineTo(0, rect.height)
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()

    // Draw animated dots on the line
  points.forEach((point: { x: number; y: number }, index: number) => {
      ctx.beginPath()
      ctx.arc(point.x, point.y, index === points.length - 1 ? 6 : 4, 0, 2 * Math.PI)
      ctx.fillStyle = index === points.length - 1 ? "#ffffff" : "#1dff00"
      ctx.shadowColor = "#1dff00"
      ctx.shadowBlur = index === points.length - 1 ? 8 : 5
      ctx.fill()
      ctx.shadowBlur = 0
    })

    // Draw enhanced date labels
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)"
    ctx.font = "11px Inter, sans-serif"
    ctx.textAlign = "center"

  chartData.forEach((data: any, index: number) => {
      const x = (rect.width / (chartData.length - 1)) * index
      ctx.fillText(data.name, x, rect.height - 8)
    })
  }, [chartData])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="h-full"
    >
      <Card className="relative overflow-hidden bg-gradient-to-br from-[#1dff00] via-[#16d918] via-[#0f8c2e] to-[#000000] border-none p-4 sm:p-6 rounded-2xl shadow-2xl hover:shadow-[0_0_20px_rgba(29,255,0,0.2)] transition-all duration-500 group h-full flex flex-col">
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2)_0%,transparent_50%)]"></div>
          <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
        </div>

        <div className="relative z-10 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/30 shadow-lg">
                <Lightbulb className="w-5 h-5 sm:w-6 sm:h-6 text-white drop-shadow-lg" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white drop-shadow-lg">Insight</h2>
            </div>
            <div className="flex space-x-1 sm:space-x-2">
              <button className="w-8 h-8 sm:w-10 sm:h-10 bg-white/15 rounded-full flex items-center justify-center hover:bg-white/25 transition-all duration-300 backdrop-blur-sm border border-white/20 hover:scale-110 group">
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-white group-hover:text-white/90" />
              </button>
              <button className="w-8 h-8 sm:w-10 sm:h-10 bg-white/15 rounded-full flex items-center justify-center hover:bg-white/25 transition-all duration-300 backdrop-blur-sm border border-white/20 hover:scale-110 group">
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-white group-hover:text-white/90" />
              </button>
            </div>
          </div>

          <div className="mb-4 sm:mb-6 flex-grow">
            <motion.div 
              key={(chartData[chartData.length - 1]?.value) ?? 'empty'}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3 }}
              className="text-3xl sm:text-5xl lg:text-6xl xl:text-7xl font-black text-white mb-2 sm:mb-3 drop-shadow-2xl tracking-tight"
            >
              {data?.metrics?.avgMatchScore ? `${data.metrics.avgMatchScore}%` : (data?.metrics?.jobsFound ?? 0)}
            </motion.div>
            <p className="text-white/95 text-sm sm:text-base lg:text-lg mb-1 sm:mb-2 font-medium leading-relaxed">{headline}</p>
            <p className="text-white/80 text-xs sm:text-sm lg:text-base leading-relaxed">Period: {String(period ?? '').toUpperCase()}</p>
          </div>

          <div className="flex-shrink-0 h-16 sm:h-20 lg:h-24 xl:h-28 relative">
            <canvas ref={canvasRef} className="w-full h-full" />
          </div>
        </div>
      </Card>
    </motion.div>
  )
}