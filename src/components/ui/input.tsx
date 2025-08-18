import * as React from "react"
import { cn } from "../../lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "transparent" | "outlined"
  inputSize?: "sm" | "md" | "lg" | "xl"
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant = "transparent", inputSize = "lg", ...props }, ref) => {
    const baseClasses = "flex w-full rounded-lg border file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1dff00] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-300"
    
    const variantClasses = {
      default: "bg-white/10 border-white/20 text-white placeholder:text-white/70 hover:border-white/40 focus:border-[#1dff00]",
      transparent: "bg-transparent border-white/20 text-white placeholder:text-white/70 backdrop-blur-sm hover:border-white/40 focus:border-[#1dff00] focus:shadow-[0_0_15px_rgba(29,255,0,0.25)]",
      outlined: "bg-transparent border-[#1dff00]/30 text-white placeholder:text-white/70 hover:border-[#1dff00]/50 focus:border-[#1dff00] focus:shadow-[0_0_20px_rgba(29,255,0,0.2)]"
    }
    
    const sizeClasses = {
      sm: "h-8 px-2 text-sm",
      md: "h-10 px-3 text-base",
      lg: "h-12 px-4 text-lg sm:h-14 sm:px-5 sm:text-xl",
      xl: "h-14 px-5 text-xl sm:h-16 sm:px-6 sm:text-2xl"
    }

    return (
      <input
        type={type}
        className={cn(
          baseClasses,
          variantClasses[variant],
          sizeClasses[inputSize],
          "font-medium tracking-wide leading-relaxed placeholder:opacity-80",
          // Invalid state (when aria-invalid is set by form libs or manually)
          "aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus-visible:ring-red-500",
          // Responsive text sizing
          inputSize === "lg" && "text-base sm:text-lg md:text-xl lg:text-2xl",
          inputSize === "xl" && "text-lg sm:text-xl md:text-2xl lg:text-3xl",
          // Responsive spacing
          "py-3 sm:py-4 md:py-5",
          // Ensure proper width on all screens
          "min-w-0 max-w-full",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }