"use client"

import { useEffect, useRef } from "react"
import { Card } from "../ui/card"
// removed unused Select imports
import { motion } from "framer-motion"

type Period = "7d" | "30d" | "90d" | "ytd" | "12m";

export function IndustriesCard({ period, data }: { period: Period; data: any }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartData = data?.chartDataJobs || []
  const metrics = {
    applications: data?.metrics?.applications ?? 0,
    industries: data?.metrics?.sources ?? 0,
    interviews: data?.metrics?.interviews ?? 0,
  }

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

    // Convert chart data to points for trend line
    if (!chartData.length) return
    const maxValue = Math.max(...chartData.map((d: any) => d.value))
    const minValue = Math.min(...chartData.map((d: any) => d.value))
    const valueRange = maxValue - minValue || 1

    const points = chartData.map((data: any, index: number) => ({
      x: (rect.width / (chartData.length - 1)) * index,
      y: rect.height * 0.8 - ((data.value - minValue) / valueRange) * (rect.height * 0.6)
    }))

    // Draw background glow
    ctx.strokeStyle = "rgba(29, 255, 0, 0.2)"
    ctx.lineWidth = 6
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.shadowColor = "#1dff00"
    ctx.shadowBlur = 20

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

    // Draw main trend line
    ctx.strokeStyle = "#1dff00"
    ctx.lineWidth = 3
    ctx.shadowBlur = 10

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

    // Draw area fill
    ctx.shadowBlur = 0
    const gradient = ctx.createLinearGradient(0, 0, 0, rect.height)
    gradient.addColorStop(0, "rgba(29, 255, 0, 0.3)")
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

    // Draw data points with animation
  points.forEach((point: { x: number; y: number }, index: number) => {
      ctx.beginPath()
      ctx.arc(point.x, point.y, index === points.length - 1 ? 5 : 3, 0, 2 * Math.PI)
      ctx.fillStyle = index === points.length - 1 ? "#ffffff" : "#1dff00"
      ctx.shadowColor = "#1dff00"
      ctx.shadowBlur = index === points.length - 1 ? 12 : 8
      ctx.fill()
      ctx.shadowBlur = 0
    })

    // Draw date labels
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)"
    ctx.font = "10px Inter, sans-serif"
    ctx.textAlign = "center"

  chartData.forEach((data: any, index: number) => {
      const x = (rect.width / (chartData.length - 1)) * index
      ctx.fillText(data.name, x, rect.height - 5)
    })
  }, [chartData])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.1 }}
      className="h-full"
    >
      <Card className="bg-gradient-to-br from-[#1dff00] via-[#16d918] via-[#0f8c2e] to-[#000000] border-none p-4 sm:p-6 rounded-2xl shadow-2xl hover:shadow-[0_0_40px_rgba(29,255,0,0.3)] transition-all duration-500 group relative overflow-hidden h-full flex flex-col">
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2)_0%,transparent_50%)]"></div>
          <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
        </div>

        <div className="relative z-10 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h3 className="text-lg sm:text-xl font-bold text-white drop-shadow-lg">Sources & activity</h3>
            <span className="text-xs text-white/70">Period: {String(period ?? '').toUpperCase()}</span>
          </div>

          {/* Enhanced metrics grid - responsive layout */}
          <div className="grid grid-cols-1 gap-3 sm:gap-4 mb-4 sm:mb-6 flex-grow">
            <motion.div 
              key={metrics.applications}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3 }}
              className="bg-white/15 border border-white/25 backdrop-blur-[15px] rounded-xl p-3 sm:p-4 text-center hover:scale-105 transition-all duration-300 group"
            >
              <div className="text-2xl sm:text-3xl lg:text-4xl font-black text-white mb-1 group-hover:text-[#1dff00] transition-colors duration-300 drop-shadow-lg">
                {metrics.applications}
              </div>
              <div className="text-xs sm:text-sm text-white/80 font-medium">Applications</div>
            </motion.div>
            
            <motion.div 
              key={metrics.industries}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="bg-white/15 border border-white/25 backdrop-blur-[15px] rounded-xl p-3 sm:p-4 text-center hover:scale-105 transition-all duration-300 group"
            >
              <div className="text-2xl sm:text-3xl lg:text-4xl font-black text-white mb-1 group-hover:text-[#1dff00] transition-colors duration-300 drop-shadow-lg">
                {metrics.industries}
              </div>
              <div className="text-xs sm:text-sm text-white/80 font-medium">Sources</div>
            </motion.div>
            
            <motion.div 
              key={metrics.interviews}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="bg-white/15 border border-white/25 backdrop-blur-[15px] rounded-xl p-3 sm:p-4 text-center hover:scale-105 transition-all duration-300 group"
            >
              <div className="text-2xl sm:text-3xl lg:text-4xl font-black text-white mb-1 group-hover:text-[#1dff00] transition-colors duration-300 drop-shadow-lg">
                {metrics.interviews}
              </div>
              <div className="text-xs sm:text-sm text-white/80 font-medium">Interviews</div>
            </motion.div>
          </div>

          {/* Enhanced trend chart */}
          <div className="flex-shrink-0 h-16 sm:h-20 lg:h-24 xl:h-28 relative">
            <canvas ref={canvasRef} className="w-full h-full" />
          </div>
        </div>
      </Card>
    </motion.div>
  )
}