import * as React from "react"
import { cn } from "../../lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "search" | "password" | "email" | "number"
  inputSize?: "default" | "sm" | "lg" | "xl"
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant = "default", inputSize = "default", ...props }, ref) => {
    const baseClasses = "flex w-full rounded-md border text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-300 backdrop-blur-sm"
    
    const variantClasses = {
      default: "bg-transparent border-[#ffffff]/20 text-[#ffffff] placeholder:text-[#ffffff]/60 hover:border-[#ffffff]/40 focus:border-[#1dff00] focus:shadow-[0_0_15px_rgba(29,255,0,0.3)] focus:text-[#1dff00]",
      search: "bg-transparent border-[#1dff00]/30 text-[#1dff00] placeholder:text-[#1dff00]/60 hover:border-[#1dff00]/50 focus:border-[#1dff00] focus:shadow-[0_0_20px_rgba(29,255,0,0.4)]",
      password: "bg-transparent border-[#888888]/30 text-[#ffffff] placeholder:text-[#888888]/60 hover:border-[#888888]/50 focus:border-[#1dff00] focus:shadow-[0_0_15px_rgba(29,255,0,0.3)]",
      email: "bg-transparent border-blue-500/30 text-blue-400 placeholder:text-blue-400/60 hover:border-blue-500/50 focus:border-blue-500 focus:shadow-[0_0_15px_rgba(59,130,246,0.3)]",
      number: "bg-transparent border-green-500/30 text-green-400 placeholder:text-green-400/60 hover:border-green-500/50 focus:border-green-500 focus:shadow-[0_0_15px_rgba(34,197,94,0.3)]"
    }
    
    const sizeClasses = {
      default: "h-10 px-3 py-2",
      sm: "h-8 px-2 py-1 text-xs",
      lg: "h-12 px-4 py-3 text-base",
      xl: "h-14 px-5 py-4 text-lg"
    }

    return (
      <div className="relative group">
        <input
          type={type}
          className={cn(
            baseClasses,
            variantClasses[variant],
            sizeClasses[inputSize],
            className
          )}
          ref={ref}
          {...props}
        />
        {/* Focus glow effect */}
        <div className="absolute inset-0 rounded-md opacity-0 group-focus-within:opacity-100 bg-gradient-to-r from-transparent via-[#1dff00]/10 to-transparent transition-opacity duration-300 pointer-events-none" />
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }