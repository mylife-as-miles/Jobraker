"use client"

import * as React from "react"
import { tv, type VariantProps } from "tailwind-variants"
import { cva } from "class-variance-authority"

import { cn } from "../../lib/utils"
import {
  Area,
  Bar,
  Line,
  Pie,
  Radar,
  RadialBar,
  type AreaProps,
  type BarProps,
  type LegendProps,
  type LineProps,
  type PieProps,
  type RadarProps,
  type RadialBarProps,
  type TooltipProps,
} from "recharts"

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

const ChartContext = React.createContext<
  | {
      config: {
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
      data: any[]
    }
  | undefined
>(undefined)

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
    config: {
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
    data: any[]
    children: React.ComponentProps<"div">["children"]
  }
>(({ config, data, children, className, ...props }, ref) => {
  const [activeTheme, setActiveTheme] = React.useState<keyof typeof THEMES>(
    "light"
  )
  const [activeChart, setActiveChart] = React.useState(
    Object.keys(config)[0]
  )

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const listener = (event: MediaQueryListEvent) => {
      setActiveTheme(event.matches ? "dark" : "light")
    }

    media.addEventListener("change", listener)

    return () => {
      media.removeEventListener("change", listener)
    }
  }, [])

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
ChartContainer.displayName = "Chart"

const ChartTooltip = cva("recharts-tooltip-wrapper", {
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
    VariantProps<typeof ChartTooltip> & {
      indicator?: "line" | "dot" | "dashed"
      hideLabel?: boolean
      hideIndicator?: boolean
    }
>(
  (
    {
      active,
      payload,
      label,
      className,
      indicator = "dot",
      hideLabel = false,
      hideIndicator = false,
    },
    ref
  ) => {
    const { config } = useChart()

    if (!active || !payload || payload.length === 0) {
      return null
    }

    const nestLabel = payload.length === 1 && indicator !== "dot"

    return (
      <div
        ref={ref}
        className={cn(ChartTooltip({ variant: "default", className }))}
      >
        {!hideLabel ? (
          <div className="font-medium">{label}</div>
        ) : null}
        <div className="grid gap-1.5">
          {payload.map((item, index) => {
            const key = `${item.dataKey}`
            const itemConfig = config[key]
            const indicatorColor = item.color

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
                        "--color-bg": indicatorColor,
                        "--color-border": indicatorColor,
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
                    {item.value.toLocaleString()}
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
>(({ className, payload, align, direction }, ref) => {
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
      {payload.map((item, index) => {
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
              {itemConfig?.icon ? (
                <itemConfig.icon className="h-4 w-4" />
              ) : null}
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
