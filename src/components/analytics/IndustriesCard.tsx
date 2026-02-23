"use client"

import { Card } from "../ui/card"
import { motion } from "framer-motion"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import { useMemo } from "react"

type Period = "7d" | "30d" | "90d" | "ytd" | "12m";

export function IndustriesCard({ period, data }: { period: Period; data: any }) {
  const chartData = data?.chartDataJobs || []
  const metrics = {
    applications: data?.metrics?.applications ?? 0,
    industries: data?.metrics?.sources ?? 0,
    interviews: data?.metrics?.interviews ?? 0,
  }
  const comparisons = {
    applicationsDeltaPct: data?.comparisons?.applicationsDeltaPct ?? 0,
    interviewsDeltaPct: data?.comparisons?.interviewsDeltaPct ?? 0,
  }

  const Delta = ({ value }: { value: number }) => {
    if (value === 0) return <span className="text-[11px] text-foreground/60">0%</span>
    const positive = value > 0
    return (
      <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
        {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {positive ? '+' : ''}{value}%
      </span>
    )
  }

  // Transform chart data for Recharts if needed, though it seems already in compatible format {name, value}
  const rechartData = useMemo(() => {
    return chartData.map((d: any) => ({
      name: d.name,
      value: d.value
    }))
  }, [chartData])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.1 }}
      className='h-full'
    >
      <Card className='relative overflow-hidden border border-[#1dff00]/20 bg-gradient-to-br from-foreground/10 via-foreground/5 to-foreground/0  p-4 sm:p-6 rounded-2xl shadow-2xl hover:shadow-[0_0_40px_rgba(29,255,0,0.3)] transition-all duration-500 group h-full flex flex-col'>
        {/* Animated background pattern */}
        <span className='pointer-events-none absolute -top-24 -right-12 h-56 w-56 rounded-full bg-[#1dff00]/20 blur-3xl opacity-60 animate-pulse' />
        <span
          className='pointer-events-none absolute -bottom-24 -left-12 h-56 w-56 rounded-full bg-[#1dff00]/10 blur-3xl opacity-40 animate-pulse'
          style={{ animationDelay: "1s" }}
        />

        <div className='relative z-10 flex flex-col h-full'>
          <div className='flex items-center justify-between mb-4 sm:mb-6'>
            <h3 className='text-lg sm:text-xl font-bold text-foreground drop-shadow-lg'>
              Sources & activity
            </h3>
            <span className='text-xs text-foreground/70'>
              Period: {String(period ?? "").toUpperCase()}
            </span>
          </div>

          {/* Enhanced metrics grid - responsive layout */}
          <div className='grid grid-cols-1 gap-3 sm:gap-4 mb-4 sm:mb-6 flex-grow'>
            <motion.div
              key={metrics.applications}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3 }}
              className='bg-foreground/5 border border-foreground/10 backdrop-blur-[15px] rounded-xl p-3 sm:p-4 text-center hover:scale-105 transition-all duration-300 group'
            >
              <div className='text-2xl sm:text-3xl lg:text-4xl font-black text-foreground mb-1 group-hover:text-[#1dff00] transition-colors duration-300 drop-shadow-lg'>
                {metrics.applications}
              </div>
              <div className='flex items-center justify-center gap-2'>
                <div className='text-xs sm:text-sm text-foreground/80 font-medium'>
                  Applications
                </div>
                <Delta value={comparisons.applicationsDeltaPct} />
              </div>
            </motion.div>

            <motion.div
              key={metrics.industries}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className='bg-foreground/5 border border-foreground/10 backdrop-blur-[15px] rounded-xl p-3 sm:p-4 text-center hover:scale-105 transition-all duration-300 group'
            >
              <div className='text-2xl sm:text-3xl lg:text-4xl font-black text-foreground mb-1 group-hover:text-[#1dff00] transition-colors duration-300 drop-shadow-lg'>
                {metrics.industries}
              </div>
              <div className='text-xs sm:text-sm text-foreground/80 font-medium'>
                Sources
              </div>
            </motion.div>

            <motion.div
              key={metrics.interviews}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className='bg-foreground/5 border border-foreground/10 backdrop-blur-[15px] rounded-xl p-3 sm:p-4 text-center hover:scale-105 transition-all duration-300 group'
            >
              <div className='text-2xl sm:text-3xl lg:text-4xl font-black text-foreground mb-1 group-hover:text-[#1dff00] transition-colors duration-300 drop-shadow-lg'>
                {metrics.interviews}
              </div>
              <div className='flex items-center justify-center gap-2'>
                <div className='text-xs sm:text-sm text-foreground/80 font-medium'>
                  Interviews
                </div>
                <Delta value={comparisons.interviewsDeltaPct} />
              </div>
            </motion.div>
          </div>

          {/* Enhanced trend chart with Recharts */}
          <div className='flex-shrink-0 h-24 sm:h-28 lg:h-32 xl:h-36 relative'>
            <ResponsiveContainer width='100%' height='100%'>
              <AreaChart data={rechartData}>
                <defs>
                  <linearGradient
                    id='industryGradient'
                    x1='0'
                    y1='0'
                    x2='0'
                    y2='1'
                  >
                    <stop offset='5%' stopColor='#1dff00' stopOpacity={0.3} />
                    <stop offset='95%' stopColor='#1dff00' stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(10, 10, 10, 0.95)",
                    border: "1px solid rgba(29, 255, 0, 0.3)",
                    borderRadius: "12px",
                    color: "#fff",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                  }}
                  itemStyle={{ color: "#1dff00" }}
                  labelStyle={{ color: "#fff", marginBottom: "0.25rem" }}
                />
                <Area
                  type='monotone'
                  dataKey='value'
                  stroke='#1dff00'
                  strokeWidth={3}
                  fill='url(#industryGradient)'
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}