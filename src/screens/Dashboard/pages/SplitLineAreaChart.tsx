"use client"
import React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, ResponsiveContainer } from "recharts"
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
  stacked?: boolean
  showLegend?: boolean
  onVisibleChange?: (keys: string[]) => void
  defaultVisible?: string[]
}

export function SplitLineAreaChart({
  data,
  xKey = "label",
  series = [{ key: "value", label: "Series", color: "var(--chart-1)" }],
  className = "h-56 sm:h-64 lg:h-72 w-full",
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
      const allowed = new Set(keys)
      return new Set(defaultVisible.filter(k => allowed.has(k)))
    }
    return new Set(keys)
  })
  const effectiveStacked = stacked && visible.size > 1

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

  // Notify parent about visible series change
  React.useEffect(() => {
    // call if provided
    // avoid recreating array unnecessarily
    // sort for stable order
    const arr = Array.from(visible)
    arr.sort()
    ;(typeof onVisibleChange === 'function') && onVisibleChange(arr)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  // Sync visibility when defaultVisible or series change
  React.useEffect(() => {
    const keys = new Set(series.map(s => s.key))
    if (defaultVisible && defaultVisible.length) {
      const next = new Set(defaultVisible.filter(k => keys.has(k)))
      setVisible(next)
    } else {
      setVisible(keys)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultVisible, series.map(s => s.key).join("|")])

  return (
    <div className={`relative ${className}`}>
      {showLegend && (
        <div className="absolute top-0 left-0 right-0 z-10 flex flex-wrap items-center gap-2 px-2 pt-2">
          {series.map((s, idx) => {
            const color = s.color ?? `var(--chart-${(idx % 5) + 1})`
            const active = visible.has(s.key)
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => {
                  setVisible(prev => {
                    const next = new Set(prev)
                    if (next.has(s.key)) next.delete(s.key)
                    else next.add(s.key)
                    return next
                  })
                }}
                className={`inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs transition-colors ${
                  active ? "border-white/20 text-white" : "border-white/10 text-white/50"
                }`}
                aria-pressed={active}
              >
                <span
                  className="inline-block h-2 w-2 rounded"
                  style={{ backgroundColor: color as string }}
                />
                <span>{s.label ?? s.key}</span>
              </button>
            )
          })}
        </div>
      )}
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
                  strokeWidth={2}
                  fillOpacity={0.6}
                  dot={false}
                  stackId={effectiveStacked ? "a" : undefined}
                  hide={!visible.has(s.key)}
                />
              )
            })}
          </AreaChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  )
}
