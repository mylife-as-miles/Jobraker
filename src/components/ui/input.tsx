import * as React from "react"
import { cn } from "../../lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "transparent" | "outlined"
  inputSize?: "sm" | "md" | "lg" | "xl"
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant = "transparent", inputSize = "lg", ...props }, ref) => {
    const baseClasses = "flex w-full rounded-lg border border-input bg-background text-foreground placeholder:text-foreground/60 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200"

    const variantClasses = {
      default: "bg-card/60 hover:border-border focus:border-brand",
      transparent: "bg-transparent hover:border-border focus:border-brand",
      outlined: "bg-transparent border-border hover:border-foreground/40 focus:border-brand",
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
          inputSize === "lg" && "text-base sm:text-lg",
          inputSize === "xl" && "text-lg sm:text-xl",
          // Responsive spacing
          "py-3",
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