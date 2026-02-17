"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"
import { Tooltip, type LegendProps, type TooltipProps } from "recharts"

const THEMES = {
  light: {
    background: "hsl(0 0% 100%)",
    foreground: "hsl(222.2 84% 4.9%)",
    muted: "hsl(210 40% 96.1%)",
    mutedForeground: "hsl(215.4 16.3% 46.9%)",
    popover: "hsl(0 0% 100%)",
    popoverForeground: "hsl(222.2 84% 4.9%)",
    card: "hsl(0 0% 100%)",
    cardForeground: "hsl(222.2 84% 4.9%)",
    border: "hsl(214.3 31.8% 91.4%)",
    input: "hsl(214.3 31.8% 91.4%)",
    primary: "hsl(222.2 47.4% 11.2%)",
    primaryForeground: "hsl(210 40% 98%)",
    secondary: "hsl(210 40% 96.1%)",
    secondaryForeground: "hsl(222.2 47.4% 11.2%)",
    accent: "hsl(210 40% 96.1%)",
    accentForeground: "hsl(222.2 47.4% 11.2%)",
    destructive: "hsl(0 84.2% 60.2%)",
    destructiveForeground: "hsl(210 40% 98%)",
    ring: "hsl(222.2 84% 4.9%)",
  },
  dark: {
    background: "hsl(222.2 84% 4.9%)",
    foreground: "hsl(210 40% 98%)",
    muted: "hsl(217.2 32.6% 17.5%)",
    mutedForeground: "hsl(215 20.2% 65.1%)",
    popover: "hsl(222.2 84% 4.9%)",
    popoverForeground: "hsl(210 40% 98%)",
    card: "hsl(222.2 84% 4.9%)",
    cardForeground: "hsl(210 40% 98%)",
    border: "hsl(217.2 32.6% 17.5%)",
    input: "hsl(217.2 32.6% 17.5%)",
    primary: "hsl(210 40% 98%)",
    primaryForeground: "hsl(222.2 47.4% 11.2%)",
    secondary: "hsl(217.2 32.6% 17.5%)",
    secondaryForeground: "hsl(210 40% 98%)",
    accent: "hsl(217.2 32.6% 17.5%)",
    accentForeground: "hsl(210 40% 98%)",
    destructive: "hsl(0 62.8% 30.6%)",
    destructiveForeground: "hsl(210 40% 98%)",
    ring: "hsl(212.7 26.8% 83.9%)",
  },
}

type ChartContextValue = {
  config: ChartConfig
  data: any[]
}

const ChartContext = React.createContext<ChartContextValue | undefined>(
  undefined
)

function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }
  return context
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig
    data: any[]
    children: React.ReactNode
  }
>(({ config, data, children, className, ...props }, ref) => {
  return (
    <ChartContext.Provider
      value={{
        config,
        data,
      }}
    >
      <div
        ref={ref}
        className={cn(
          "grid aspect-video w-full items-start gap-4 text-xs sm:text-sm [&>svg]:h-full [&>svg]:w-full",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </ChartContext.Provider>
  )
})
ChartContainer.displayName = "ChartContainer"

const ChartTooltipClass = cva("recharts-tooltip-wrapper", {
  variants: {
    variant: {
      default:
        "rounded-lg border bg-background/95 p-2 shadow-lg backdrop-blur-lg",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> &
    Omit<TooltipProps<any, any>, "content"> &
  VariantProps<typeof ChartTooltipClass> & {
      indicator?: "line" | "dot" | "dashed"
      hideLabel?: boolean
      hideIndicator?: boolean
    }
>(
  ({
    active,
    payload,
    label,
    className,
    indicator = "dot",
    hideLabel = false,
    hideIndicator = false,
  }: {
    active?: boolean
    payload?: any[]
    label?: string
    className?: string
    indicator?: "line" | "dot" | "dashed"
    hideLabel?: boolean
    hideIndicator?: boolean
  },
  ref: React.Ref<HTMLDivElement>
  ) => {
    const { config } = useChart()

    if (!active || !payload || payload.length === 0) {
      return null
    }

    const nestLabel = payload.length === 1 && indicator !== "dot"

    return (
  <div ref={ref} className={cn(ChartTooltipClass({ variant: "default", className }))}>
        {!hideLabel ? (
          <div className="font-medium">{label}</div>
        ) : null}
        <div className="grid gap-1.5">
          {payload?.map((item: any, index: number) => {
            const key = `${item.dataKey}`
            const itemConfig = config[key]
            const indicatorColor = item.color
            const numeric =
              typeof item.value === "number"
                ? item.value
                : Number.isFinite(Number(item.value))
                ? Number(item.value)
                : null

            return (
              <div
                key={index}
                className={cn(
                  "flex w-full items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5",
                  indicator === "dot" && "items-center"
                )}
              >
                {!hideIndicator ? (
                  <div
                    className={cn(
                      "shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]",
                      {
                        "h-2.5 w-2.5": indicator === "dot",
                        "w-1": indicator === "line",
                        "w-0 border-[1.5px] border-dashed bg-transparent":
                          indicator === "dashed",
                        "my-0.5": nestLabel && indicator === "dashed",
                      }
                    )}
                    style={
                      {
                        "--color-bg": indicatorColor as any,
                        "--color-border": indicatorColor as any,
                      } as React.CSSProperties
                    }
                  />
                ) : null}
                <div
                  className={cn(
                    "flex flex-1 justify-between leading-none",
                    nestLabel ? "items-end" : "items-center"
                  )}
                >
                  <div className="grid gap-1.5">
                    {nestLabel ? (
                      <div className="font-medium">
                        {itemConfig?.label || item.name}
                      </div>
                    ) : null}
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {numeric !== null
                      ? numeric.toLocaleString()
                      : String(item.value ?? "")}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
)
ChartTooltipContent.displayName = "ChartTooltipContent"

// Wrapper around Recharts Tooltip so consumers can use <ChartTooltip />
const ChartTooltip = (props: TooltipProps<any, any>) => (
  <Tooltip {...props} wrapperStyle={{ pointerEvents: "none" }} />
)

const ChartLegend = cva("recharts-legend-wrapper", {
  variants: {
    variant: {
      default: "flex items-center justify-center gap-4",
    },
    align: {
      center: "justify-center",
      left: "justify-start",
      right: "justify-end",
    },
    direction: {
      horizontal: "flex-row",
      vertical: "flex-col",
    },
  },
  defaultVariants: {
    variant: "default",
    align: "center",
    direction: "horizontal",
  },
})

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> &
    Pick<LegendProps, "payload"> &
    VariantProps<typeof ChartLegend>
>(({ className, payload, align, direction }: {
  className?: string
  payload?: any[]
  align?: "center" | "left" | "right" | null
  direction?: "horizontal" | "vertical" | null
}, ref: React.Ref<HTMLDivElement>) => {
  const { config } = useChart()

  if (!payload || payload.length === 0) {
    return null
  }

  return (
    <div
      ref={ref}
      className={cn(
        ChartLegend({
          align,
          direction,
          className,
        })
      )}
    >
      {payload?.map((item: any, index: number) => {
        const key = `${item.value}`
        const itemConfig = config[key]
        const color = item.color

        return (
          <div
            key={index}
            className="flex items-center gap-2 has-[:disabled]:opacity-50"
          >
            <div
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{
                backgroundColor: color,
              }}
            />
            <div className="flex items-center gap-1">
              {itemConfig?.icon && React.createElement(itemConfig.icon as any, { className: "h-4 w-4" })}
              <div className="whitespace-nowrap">
                {itemConfig?.label || item.value}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
})
ChartLegendContent.displayName = "ChartLegendContent"

type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & (
    | {
        color?: string
        theme?: never
      }
    | {
        color?: never
        theme: {
          [k in keyof typeof THEMES]: string
        }
      }
  )
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
}
