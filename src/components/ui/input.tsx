import * as React from "react"
import { cn } from "../../lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "transparent" | "outlined"
  inputSize?: "sm" | "md" | "lg" | "xl"
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant = "transparent", inputSize = "lg", ...props }, ref) => {
    const baseClasses = "flex w-full rounded-md border ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-300"
    
    const variantClasses = {
      default: "bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00] hover:border-[#ffffff4d]",
      transparent: "bg-transparent border-[#ffffff]/20 text-white placeholder:text-[#ffffff99] backdrop-blur-sm hover:border-[#ffffff]/40 focus:border-[#1dff00] focus:shadow-[0_0_15px_rgba(29,255,0,0.3)] focus:text-[#1dff00]",
      outlined: "bg-transparent border-[#1dff00]/30 text-white placeholder:text-[#ffffff80] hover:border-[#1dff00]/50 focus:border-[#1dff00] focus:shadow-[0_0_20px_rgba(29,255,0,0.2)]"
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
          "font-medium tracking-wide leading-relaxed",
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