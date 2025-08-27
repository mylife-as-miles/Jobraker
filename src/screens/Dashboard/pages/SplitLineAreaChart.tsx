"use client"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { motion } from "framer-motion"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "../../../components/ui/chart"
import { useMemo, useState } from "react"

export const description = "An area chart with gradient fill that animates reveal on hover"

type GenericPoint = Record<string, string | number>

type Props = {
  data: GenericPoint[]
  xKey?: string
  yKey?: string
  color?: string
  className?: string
  tickFormatter?: (value: string) => string
}

export function SplitLineAreaChart({
  data,
  xKey = "label",
  yKey = "value",
  color = "#22c55e",
  className = "h-16 sm:h-20 lg:h-24 w-full",
  tickFormatter,
}: Props) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isInside, setIsInside] = useState(false)

  const n = Math.max(1, (data?.length || 0) - 1)
  const splitOffset = hoverIndex != null ? (hoverIndex / n) * 100 : 100
  const gradientId = useMemo(() => `fill_${yKey}` as const, [yKey])

  const chartConfig: ChartConfig = useMemo(() => ({
    [yKey]: { label: "Applications", color: "var(--chart-1)" },
  }) as ChartConfig, [yKey])

  return (
    <div className={`relative ${className}`}>
      {isInside && (
        <div
          className="pointer-events-none fixed z-50 w-24 h-24 rounded-full opacity-60 blur-3xl"
          style={{ left: mousePos.x - 48, top: mousePos.y - 48, backgroundColor: color }}
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
        <AreaChart
          accessibilityLayer
          data={data}
          margin={{ left: 12, right: 12, top: 12 }}
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
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              <motion.stop offset="0%" stopColor={color} stopOpacity={0.8} />
              <motion.stop
                stopColor={color}
                stopOpacity={0.8}
                animate={{ offset: `${splitOffset}%` }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
              />
              <motion.stop
                stopColor={color}
                stopOpacity={0.1}
                animate={{ offset: `${splitOffset + 0.1}%` }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
              />
              <stop offset="95%" stopColor="#000000" stopOpacity={0.1} />
            </linearGradient>
          </defs>

          <Area dataKey={yKey} type="natural" fill={`url(#${gradientId})`} stroke={color} fillOpacity={0.4} />
        </AreaChart>
      </ChartContainer>
    </div>
  )
}
