"use client"

import { useMemo } from "react"
import { Card } from "../ui/card"
import { Lightbulb, ChevronLeft, ChevronRight } from "lucide-react"
import { motion } from "framer-motion"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'

type Period = "7d" | "30d" | "90d" | "ytd" | "12m";

export function InsightCard({ period, data }: { period: Period; data: any }) {
  const chartData = (data?.chartDataApps?.length ? data.chartDataApps : data?.chartDataJobs) || []

  const headline = useMemo(() => {
    const ms = data?.metrics?.avgMatchScore ?? 0
    const apps = data?.metrics?.applications ?? 0
    const jobs = data?.metrics?.jobsFound ?? 0
    if (apps > 0 && ms > 0) return `${ms}% avg match across ${apps} applications`
    if (jobs > 0) return `${jobs} new jobs in your feed`
    return `No activity in period`
  }, [data])

  // Transform data for Recharts
  const rechartData = useMemo(() => {
    return chartData.map((item: any) => ({
      name: item.name,
      value: item.value || 0,
    }))
  }, [chartData])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="h-full"
    >
      <Card className="relative overflow-hidden border border-[#1dff00]/20 bg-gradient-to-br from-[#030303] via-[#050505] to-[#0a160a] p-4 sm:p-6 rounded-2xl shadow-2xl hover:shadow-[0_0_20px_rgba(29,255,0,0.2)] transition-all duration-500 group h-full flex flex-col">
        {/* Animated background pattern */}
        <span className="pointer-events-none absolute -top-24 -right-12 h-56 w-56 rounded-full bg-[#1dff00]/20 blur-3xl opacity-60 animate-pulse" />
        <span className="pointer-events-none absolute -bottom-24 -left-12 h-56 w-56 rounded-full bg-[#1dff00]/10 blur-3xl opacity-40 animate-pulse" style={{ animationDelay: '1s' }} />

        <div className="relative z-10 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#1dff00]/10 border border-[#1dff00]/30 rounded-full flex items-center justify-center backdrop-blur-sm shadow-lg">
                <Lightbulb className="w-5 h-5 sm:w-6 sm:h-6 text-[#1dff00] drop-shadow-lg" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white drop-shadow-lg">Insight</h2>
            </div>
            <div className="flex space-x-1 sm:space-x-2">
              <button className="w-8 h-8 sm:w-10 sm:h-10 bg-white/5 border border-white/10 rounded-full flex items-center justify-center hover:bg-white/10 transition-all duration-300 backdrop-blur-sm hover:scale-110 group">
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-white/70 group-hover:text-white" />
              </button>
              <button className="w-8 h-8 sm:w-10 sm:h-10 bg-white/5 border border-white/10 rounded-full flex items-center justify-center hover:bg-white/10 transition-all duration-300 backdrop-blur-sm hover:scale-110 group">
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-white/70 group-hover:text-white" />
              </button>
            </div>
          </div>

          <div className="mb-4 sm:mb-6">
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

          <div className="flex-1 min-h-[200px]">
            {rechartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rechartData}>
                  <defs>
                    <linearGradient id="insightGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1dff00" stopOpacity={0.4}/>
                      <stop offset="50%" stopColor="#1dff00" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#1dff00" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis 
                    dataKey="name" 
                    stroke="rgba(255,255,255,0.5)"
                    style={{ fontSize: '11px' }}
                    tick={{ fill: 'rgba(255,255,255,0.7)' }}
                  />
                  <YAxis 
                    stroke="rgba(255,255,255,0.5)"
                    style={{ fontSize: '11px' }}
                    tick={{ fill: 'rgba(255,255,255,0.7)' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(10, 10, 10, 0.95)', 
                      border: '1px solid rgba(29, 255, 0, 0.3)',
                      borderRadius: '12px',
                      color: '#fff',
                      backdropFilter: 'blur(10px)'
                    }}
                    labelStyle={{ color: '#1dff00', fontWeight: 'bold' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#1dff00" 
                    strokeWidth={3}
                    fill="url(#insightGradient)"
                    dot={{ fill: '#1dff00', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: '#fff', stroke: '#1dff00', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/40 text-sm">
                No data available for this period
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  )
}