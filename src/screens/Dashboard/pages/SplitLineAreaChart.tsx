"use client"
import React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, ResponsiveContainer } from "recharts"
import { motion, AnimatePresence } from "framer-motion"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "../../../components/ui/chart"
import { useMemo, useState } from "react"

export const description = "An area chart with gradient fill that animates reveal on hover"

type GenericPoint = Record<string, string | number>

type Series = {
  key: string
  label?: string
  color?: string
}

type Props = {
  data: GenericPoint[]
  xKey?: string
  series?: Series[]
  className?: string
  tickFormatter?: (value: string) => string
  stacked?: boolean
  showLegend?: boolean
  onVisibleChange?: (keys: string[]) => void
  defaultVisible?: string[]
}

export function SplitLineAreaChart({
  data,
  xKey = "label",
  series = [{ key: "value", label: "Series", color: "var(--chart-1)" }],
  className = "h-64 sm:h-72 lg:h-80 xl:h-96 w-full",
  tickFormatter,
  stacked = false,
  showLegend = false,
  onVisibleChange,
  defaultVisible,
}: Props) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isInside, setIsInside] = useState(false)
  const [visible, setVisible] = useState<Set<string>>(() => {
    const keys = series.map(s => s.key)
    if (defaultVisible && defaultVisible.length) {
      <AnimatePresence mode="wait">
        <motion.div
          key={effectiveStacked ? "stacked" : "unstacked"}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
          className="h-full w-full"
        >
          <ChartContainer
            onMouseMove={(e: React.MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY })}
            onMouseEnter={() => setIsInside(true)}
            onMouseLeave={() => {
              setIsInside(false)
              setHoverIndex(null)
            }}
            config={chartConfig}
            data={data}
            className="h-full w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                accessibilityLayer
                data={data}
                margin={{ left: 12, right: 12, top: 12 }}
                stackOffset={effectiveStacked ? 'expand' : undefined}
                onMouseMove={(state: any) => {
                  if (state && state.activeTooltipIndex != null) setHoverIndex(state.activeTooltipIndex)
                }}
                onMouseLeave={() => setHoverIndex(null)}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey={xKey}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value: string) => (tickFormatter ? tickFormatter(value) : String(value))}
                />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />

                <defs>
                  {series.map((s, idx) => {
                    const color = s.color ?? `var(--chart-${(idx % 5) + 1})`
                    const gradientId = `fill_${s.key}`
                    return (
                      <linearGradient key={gradientId} id={gradientId} x1="0" y1="0" x2="1" y2="0">
                        <motion.stop offset="0%" stopColor={color as string} stopOpacity={0.9} />
                        <motion.stop
                          stopColor={color as string}
                          stopOpacity={0.8}
                          animate={{ offset: `${splitOffset}%` }}
                          transition={{ duration: 0.4, ease: "easeInOut" }}
                        />
                        <motion.stop
                          stopColor={color as string}
                          stopOpacity={0.2}
                          animate={{ offset: `${splitOffset + 0.1}%` }}
                          transition={{ duration: 0.4, ease: "easeInOut" }}
                        />
                        <stop offset="95%" stopColor="#0a2f0a" stopOpacity={0.1} />
                      </linearGradient>
                    )
                  })}
                </defs>

                {series.map((s, idx) => {
                  const color = s.color ?? `var(--chart-${(idx % 5) + 1})`
                  const gradientId = `fill_${s.key}`
                  return (
                    <Area
                      key={s.key}
                      dataKey={s.key}
                      type="natural"
                      isAnimationActive
                      animationDuration={500}
                      animationEasing="ease-in-out"
                      fill={`url(#${gradientId})`}
                      stroke={color as string}
                      strokeWidth={effectiveStacked ? 1.5 : 2}
                      fillOpacity={effectiveStacked ? 0.9 : 0.6}
                      dot={false}
                      stackId={effectiveStacked ? "a" : undefined}
                      hide={!visible.has(s.key)}
                    />
                  )
                })}
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        </motion.div>
      </AnimatePresence>
      {isInside && (
        <div
          className="pointer-events-none fixed z-50 w-24 h-24 rounded-full opacity-60 blur-3xl"
          style={{
            left: mousePos.x - 48,
            top: mousePos.y - 48,
            backgroundColor: (series[0]?.color ?? "var(--chart-1)") as string,
          }}
        />
      )}

      <ChartContainer
        onMouseMove={(e: React.MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY })}
        onMouseEnter={() => setIsInside(true)}
        onMouseLeave={() => {
          setIsInside(false)
          setHoverIndex(null)
        }}
        config={chartConfig}
        data={data}
        className="h-full w-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            accessibilityLayer
            data={data}
            margin={{ left: 12, right: 12, top: 12 }}
            stackOffset={effectiveStacked ? 'expand' : undefined}
            onMouseMove={(state: any) => {
              if (state && state.activeTooltipIndex != null) setHoverIndex(state.activeTooltipIndex)
            }}
            onMouseLeave={() => setHoverIndex(null)}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey={xKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value: string) => (tickFormatter ? tickFormatter(value) : String(value))}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />

            <defs>
              {series.map((s, idx) => {
                const color = s.color ?? `var(--chart-${(idx % 5) + 1})`
                const gradientId = `fill_${s.key}`
                return (
                  <linearGradient key={gradientId} id={gradientId} x1="0" y1="0" x2="1" y2="0">
                    <motion.stop offset="0%" stopColor={color as string} stopOpacity={0.9} />
                    <motion.stop
                      stopColor={color as string}
                      stopOpacity={0.8}
                      animate={{ offset: `${splitOffset}%` }}
                      transition={{ duration: 0.4, ease: "easeInOut" }}
                    />
                    <motion.stop
                      stopColor={color as string}
                      stopOpacity={0.2}
                      animate={{ offset: `${splitOffset + 0.1}%` }}
                      transition={{ duration: 0.4, ease: "easeInOut" }}
                    />
                    <stop offset="95%" stopColor="#0a2f0a" stopOpacity={0.1} />
                  </linearGradient>
                )
              })}
            </defs>

            {series.map((s, idx) => {
              const color = s.color ?? `var(--chart-${(idx % 5) + 1})`
              const gradientId = `fill_${s.key}`
              return (
                <Area
                  key={s.key}
                  dataKey={s.key}
                  type="natural"
                  fill={`url(#${gradientId})`}
                  stroke={color as string}
                  strokeWidth={effectiveStacked ? 1.5 : 2}
                  fillOpacity={effectiveStacked ? 0.9 : 0.6}
                  dot={false}
                  stackId={effectiveStacked ? "a" : undefined}
                  hide={!visible.has(s.key)}
                />
              )
            })}
          </AreaChart>
        </ResponsiveContainer>
      </ChartContainer>
      {effectiveStacked && (
        <div className="absolute bottom-1 right-2 text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/60 tracking-wide uppercase">Stacked %</div>
      )}
    </div>
  )
}
