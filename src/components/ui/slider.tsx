"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: number[]
  onValueChange?: (value: number[]) => void
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ min = 0, max = 100, step = 1, value, onValueChange, className, ...rest }, ref) => {
    const autoId = React.useId()
    const current = Array.isArray(value) && value.length ? value[0] : min
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value)
      onValueChange?.([v])
    }
    const inputId = rest.id ?? autoId
    const inputName = rest.name ?? inputId
  const ariaLabel: string | undefined = (rest as any)["aria-label"] ?? undefined
    return (
      <div className={cn("relative w-full flex items-center", className)}>
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={current}
          onChange={handleChange}
          className={cn(
            "w-full h-2 appearance-none rounded-full bg-[#ffffff1a] outline-none",
            "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#1dff00] [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-[#1dff00]",
            "[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#1dff00] [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-[#1dff00]"
          )}
          id={inputId}
          name={inputName}
      aria-label={ariaLabel}
      aria-valuemin={Number(min) as number}
      aria-valuemax={Number(max) as number}
      aria-valuenow={Number(current) as number}
          {...rest}
        />
      </div>
    )
  }
)

Slider.displayName = "Slider"

export { Slider }
