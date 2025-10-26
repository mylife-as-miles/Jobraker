"use client"

import { useEffect, useRef } from "react"
import { Card } from "../ui/card"
import { motion } from "framer-motion"

type Period = "7d" | "30d" | "90d" | "ytd" | "12m";

export function ResumeVersionSuccess({ period: _period, data }: { period: Period; data: any }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const donutData = data?.donutData || []

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

    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const radius = Math.min(centerX, centerY) - 25

    let currentAngle = -Math.PI / 2
  if (!donutData.length) return
  const total = donutData.reduce((sum: number, item: any) => sum + item.value, 0)

    // Draw background glow rings
    donutData.forEach((item: any) => {
      const sliceAngle = (item.value / total) * 2 * Math.PI

      ctx.beginPath()
      ctx.arc(centerX, centerY, radius + 12, currentAngle, currentAngle + sliceAngle)
      ctx.lineWidth = 24
      ctx.strokeStyle = item.color + "40"
      ctx.lineCap = "round"
      ctx.stroke()

      currentAngle += sliceAngle
    })

    // Reset angle for main arcs
    currentAngle = -Math.PI / 2

    donutData.forEach((item: any) => {
      const sliceAngle = (item.value / total) * 2 * Math.PI

      // Draw main arc with enhanced styling
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle)
      ctx.lineWidth = 16
      ctx.strokeStyle = item.color
      ctx.lineCap = "round"
      
      // Add glow effect
      ctx.shadowColor = item.color
      ctx.shadowBlur = 25
      ctx.stroke()
      ctx.shadowBlur = 0

      // Add inner highlight
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius - 2, currentAngle, currentAngle + sliceAngle)
      ctx.lineWidth = 4
      ctx.strokeStyle = item.color + "CC"
      ctx.stroke()

      currentAngle += sliceAngle
    })

    // Draw enhanced center circle with gradient
    const centerGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius - 30)
    centerGradient.addColorStop(0, "rgba(0, 0, 0, 0.9)")
    centerGradient.addColorStop(0.7, "rgba(0, 0, 0, 0.8)")
    centerGradient.addColorStop(1, "rgba(0, 0, 0, 0.6)")
    
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius - 30, 0, 2 * Math.PI)
    ctx.fillStyle = centerGradient
    ctx.fill()

    // Add inner border with glow
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius - 30, 0, 2 * Math.PI)
    ctx.strokeStyle = "rgba(29, 255, 0, 0.3)"
    ctx.lineWidth = 2
    ctx.shadowColor = "#1dff00"
    ctx.shadowBlur = 10
    ctx.stroke()
    ctx.shadowBlur = 0
  }, [donutData])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="h-full"
    >
      <Card className="relative overflow-hidden border border-[#1dff00]/20 bg-gradient-to-br from-[#030303] via-[#050505] to-[#0a160a] backdrop-blur-[25px] p-6 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-500 h-full flex flex-col">
        <span className="pointer-events-none absolute -top-24 -right-12 h-56 w-56 rounded-full bg-[#1dff00]/20 blur-3xl opacity-60" />
        <h2 className="text-xl font-bold text-white mb-6 relative z-10">Resume version success</h2>

        <div className="flex flex-col lg:flex-row items-center lg:space-x-6 space-y-4 lg:space-y-0 flex-1 relative z-10">
          <div className="w-36 h-36 flex-shrink-0">
            <canvas ref={canvasRef} className="w-full h-full" />
          </div>

          <div className="space-y-4 flex-1 w-full">
            {donutData.map((item: any, index: number) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.1 * index }}
                className="flex items-center justify-between p-3 bg-gradient-to-r from-[#ffffff08] to-[#ffffff05] rounded-lg border border-[#ffffff15] hover:bg-gradient-to-r hover:from-[#ffffff12] hover:to-[#ffffff08] transition-all duration-300 group"
              >
                <div className="flex items-center space-x-3">
                  <motion.div 
                    key={item.value}
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className="w-4 h-4 rounded-full shadow-lg group-hover:scale-110 transition-transform duration-300"
                    style={{ backgroundColor: item.color }}
                  ></motion.div>
                  <span className="text-sm text-white/90 font-medium">{item.name}</span>
                </div>
                <motion.span 
                  key={item.value}
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="text-sm font-bold text-white"
                >
                  {item.value}%
                </motion.span>
              </motion.div>
            ))}
          </div>
        </div>
      </Card>
    </motion.div>
  )
}