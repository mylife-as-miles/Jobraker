"use client"

import { Card } from "../ui/card"
import { motion } from "framer-motion"
import { Pie, PieChart, ResponsiveContainer, Cell, Tooltip } from 'recharts'

type Period = "7d" | "30d" | "90d" | "ytd" | "12m";

export function ResumeVersionSuccess({ period: _period, data }: { period: Period; data: any }) {
  const donutData = data?.donutData || []

  // Ensure data has the correct format for Recharts
  const chartData = donutData.map((item: any) => ({
    name: item.name,
    value: item.value,
    color: item.color
  }))

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className='h-full'
    >
      <Card className='relative overflow-hidden border border-[#1dff00]/20 bg-gradient-to-br from-foreground/10 via-foreground/5 to-foreground/0  backdrop-blur-[25px] p-6 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-500 h-full flex flex-col'>
        <span className='pointer-events-none absolute -top-24 -right-12 h-56 w-56 rounded-full bg-[#1dff00]/20 blur-3xl opacity-60' />
        <h2 className='text-xl font-bold text-foregroun mb-6 relative z-10'>
          Resume version success
        </h2>

        <div className='flex flex-col lg:flex-row items-center lg:space-x-6 space-y-4 lg:space-y-0 flex-1 relative z-10'>
          <div className='w-56 h-56 flex-shrink-0 relative'>
            <ResponsiveContainer width='100%' height='100%'>
              <PieChart>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(10, 10, 10, 0.8)",
                    border: "1px solid rgba(29, 255, 0, 0.2)",
                    borderRadius: "12px",
                    backdropFilter: "blur(12px)",
                    color: "#fff",
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
                  }}
                  itemStyle={{ color: "#fff" }}
                  labelStyle={{ display: "none" }}
                  formatter={(value: any, name: any) => [
                    `${value}%`,
                    name,
                  ]}
                />
                <Pie
                  data={chartData}
                  cx='50%'
                  cy='50%'
                  innerRadius={65}
                  outerRadius={85}
                  paddingAngle={8}
                  dataKey='value'
                  stroke='none'
                  cornerRadius={10}
                >
                  {chartData.map((entry: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      stroke={entry.color}
                      strokeWidth={2}
                      style={{
                        filter: `drop-shadow(0 0 8px ${entry.color}80)`,
                      }}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Center Glow */}
            <div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
              <div className='w-24 h-24 rounded-full bg-gradient-to-br from-black/80 to-black/40 backdrop-blur-sm border border-[#1dff00]/30 shadow-[0_0_20px_rgba(29,255,0,0.15)]'></div>
            </div>
          </div>

          <div className='space-y-3 flex-1 w-full'>
            {chartData.map((item: any, index: number) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.1 * index }}
                className='flex items-center justify-between p-3 bg-gradient-to-r from-[#ffffff08] to-[#ffffff05] rounded-lg border border-[#ffffff15] hover:bg-gradient-to-r hover:from-[#ffffff12] hover:to-[#ffffff08] transition-all duration-300 group'
              >
                <div className='flex items-center space-x-3'>
                  <motion.div
                    key={item.value}
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className='w-4 h-4 rounded-full shadow-lg group-hover:scale-110 transition-transform duration-300'
                    style={{
                      backgroundColor: item.color,
                      boxShadow: `0 0 10px ${item.color}66`,
                    }}
                  ></motion.div>
                  <span className='text-sm text-foregroun/90 font-medium'>
                    {item.name}
                  </span>
                </div>
                <motion.span
                  key={item.value}
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className='text-sm font-bold text-foregroun'
                >
                  {item.value}%
                </motion.span>
              </motion.div>
            ))}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}