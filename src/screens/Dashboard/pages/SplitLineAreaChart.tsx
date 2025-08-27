"use client"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { motion } from "framer-motion"
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
}

export function SplitLineAreaChart({
  data,
  xKey = "label",
  series = [{ key: "value", label: "Series", color: "var(--chart-1)" }],
  className = "h-16 sm:h-20 lg:h-24 w-full",
  tickFormatter,
}: Props) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isInside, setIsInside] = useState(false)

  const n = Math.max(1, (data?.length || 0) - 1)
  const splitOffset = hoverIndex != null ? (hoverIndex / n) * 100 : 100

  const chartConfig: ChartConfig = useMemo(() => {
    const cfg: Record<string, { label: string; color: string }> = {}
    series.forEach((s, idx) => {
      cfg[s.key] = {
        label: s.label ?? s.key,
        color: s.color ?? `var(--chart-${(idx % 5) + 1})`,
      }
    })
    return cfg as ChartConfig
  }, [series])

  return (
    <div className={`relative ${className}`}>
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
            {series.map((s, idx) => {
              const color = s.color ?? `var(--chart-${(idx % 5) + 1})`
              const gradientId = `fill_${s.key}`
              return (
                <linearGradient key={gradientId} id={gradientId} x1="0" y1="0" x2="1" y2="0">
                  <motion.stop offset="0%" stopColor={color as string} stopOpacity={0.8} />
                  <motion.stop
                    stopColor={color as string}
                    stopOpacity={0.8}
                    animate={{ offset: `${splitOffset}%` }}
                    transition={{ duration: 0.4, ease: "easeInOut" }}
                  />
                  <motion.stop
                    stopColor={color as string}
                    stopOpacity={0.1}
                    animate={{ offset: `${splitOffset + 0.1}%` }}
                    transition={{ duration: 0.4, ease: "easeInOut" }}
                  />
                  <stop offset="95%" stopColor="#000000" stopOpacity={0.1} />
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
                fillOpacity={0.35}
                dot={false}
              />
            )
          })}
        </AreaChart>
      </ChartContainer>
    </div>
  )
}
