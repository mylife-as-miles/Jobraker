"use client"

import { useMemo, useState } from "react"
import { Card } from "../ui/card"
import { Lightbulb, ChevronLeft, ChevronRight } from "lucide-react"
import { motion } from "framer-motion"
import { Area, AreaChart, ResponsiveContainer, XAxis, CartesianGrid } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../ui/chart"

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

  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className='h-full'
    >
      <Card className='relative overflow-hidden border border-[#1dff00]/20 bg-gradient-to-br from-foreground/10 via-foreground/5 to-foreground/0  p-4 sm:p-6 rounded-2xl shadow-2xl hover:shadow-[0_0_20px_rgba(29,255,0,0.2)] transition-all duration-500 group h-full flex flex-col'>
        {/* Animated background pattern */}
        <span className='pointer-events-none absolute -top-24 -right-12 h-56 w-56 rounded-full bg-[#1dff00]/20 blur-3xl opacity-60 animate-pulse' />
        <span
          className='pointer-events-none absolute -bottom-24 -left-12 h-56 w-56 rounded-full bg-[#1dff00]/10 blur-3xl opacity-40 animate-pulse'
          style={{ animationDelay: "1s" }}
        />

        <div className='relative z-10 flex flex-col h-full'>
          <div className='flex items-center justify-between mb-4 sm:mb-6'>
            <div className='flex items-center space-x-2 sm:space-x-3'>
              <div className='w-10 h-10 sm:w-12 sm:h-12 bg-[#1dff00]/10 border border-[#1dff00]/30 rounded-full flex items-center justify-center backdrop-blur-sm shadow-lg'>
                <Lightbulb className='w-5 h-5 sm:w-6 sm:h-6 text-[#1dff00] drop-shadow-lg' />
              </div>
              <h2 className='text-lg sm:text-xl font-bold text-foreground drop-shadow-lg'>
                Insight
              </h2>
            </div>
            <div className='flex space-x-1 sm:space-x-2'>
              <button className='w-8 h-8 sm:w-10 sm:h-10 bg-foreground/5 border border-foreground/10 rounded-full flex items-center justify-center hover:bg-foreground/10 transition-all duration-300 backdrop-blur-sm hover:scale-110 group'>
                <ChevronLeft className='w-4 h-4 sm:w-5 sm:h-5 text-foreground/70 group-hover:text-foreground' />
              </button>
              <button className='w-8 h-8 sm:w-10 sm:h-10 bg-foreground/5 border border-foreground/10 rounded-full flex items-center justify-center hover:bg-foreground/10 transition-all duration-300 backdrop-blur-sm hover:scale-110 group'>
                <ChevronRight className='w-4 h-4 sm:w-5 sm:h-5 text-foreground/70 group-hover:text-foreground' />
              </button>
            </div>
          </div>

          <div className='mb-4 sm:mb-6'>
            <motion.div
              key={chartData[chartData.length - 1]?.value ?? "empty"}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3 }}
              className='text-3xl sm:text-5xl lg:text-6xl xl:text-7xl font-black text-foreground mb-2 sm:mb-3 drop-shadow-2xl tracking-tight'
            >
              {data?.metrics?.avgMatchScore
                ? `${data.metrics.avgMatchScore}%`
                : (data?.metrics?.jobsFound ?? 0)}
            </motion.div>
            <p className='text-foreground/95 text-sm sm:text-base lg:text-lg mb-1 sm:mb-2 font-medium leading-relaxed'>
              {headline}
            </p>
            <p className='text-foreground/80 text-xs sm:text-sm lg:text-base leading-relaxed'>
              Period: {String(period ?? "").toUpperCase()}
            </p>
          </div>

          <div className='flex-1 min-h-[200px]'>
            {rechartData.length > 0 ? (
              <ChartContainer
                config={{
                  value: {
                    label: "Value",
                    color: "#1dff00",
                  },
                }}
                data={rechartData}
                className="h-full w-full"
              >
                <ResponsiveContainer width='100%' height='100%'>
                  <AreaChart
                    data={rechartData}
                    onMouseMove={(state: any) => {
                      if (state && state.activeTooltipIndex != null) {
                        setHoverIndex(state.activeTooltipIndex)
                      }
                    }}
                    onMouseLeave={() => setHoverIndex(null)}
                  >
                    <defs>
                      <linearGradient
                        id='insightGradient'
                        x1='0'
                        y1='0'
                        x2='1'
                        y2='0'
                      >
                        <stop offset='0%' stopColor='#1dff00' stopOpacity={0.4} />
                        <stop
                          offset={hoverIndex !== null ? `${(hoverIndex / (rechartData.length - 1)) * 100}%` : "100%"}
                          stopColor='#1dff00'
                          stopOpacity={0.3}
                        />
                        <stop
                          offset={hoverIndex !== null ? `${(hoverIndex / (rechartData.length - 1)) * 100 + 0.1}%` : "100.1%"}
                          stopColor='#1dff00'
                          stopOpacity={0.1}
                        />
                        <stop offset='100%' stopColor='#1dff00' stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      vertical={false}
                      stroke='rgba(255,255,255,0.05)'
                    />
                    <XAxis
                      dataKey='name'
                      hide
                    />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                    <Area
                      type='natural'
                      dataKey='value'
                      stroke='#1dff00'
                      strokeWidth={3}
                      fill='url(#insightGradient)'
                      fillOpacity={1}
                      dot={false}
                      activeDot={{
                        r: 5,
                        fill: "#fff",
                        stroke: "#1dff00",
                        strokeWidth: 2,
                      }}
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className='w-full h-full flex items-center justify-center text-foreground/40 text-sm'>
                No data available for this period
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}