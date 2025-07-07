import * as React from "react"
import { cn } from "../../lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: "default" | "minimal" | "bordered"
  textareaSize?: "default" | "sm" | "lg"
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant = "default", textareaSize = "default", ...props }, ref) => {
    const baseClasses = "flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-300 backdrop-blur-sm resize-none"
    
    const variantClasses = {
      default: "bg-transparent border-[#ffffff]/20 text-[#ffffff] placeholder:text-[#ffffff]/60 hover:border-[#ffffff]/40 focus:border-[#1dff00] focus:shadow-[0_0_15px_rgba(29,255,0,0.3)] focus:text-[#1dff00]",
      minimal: "bg-transparent border-[#888888]/20 text-[#ffffff] placeholder:text-[#888888]/60 hover:border-[#888888]/40 focus:border-[#1dff00] focus:shadow-[0_0_10px_rgba(29,255,0,0.2)]",
      bordered: "bg-transparent border-[#1dff00]/30 text-[#1dff00] placeholder:text-[#1dff00]/60 hover:border-[#1dff00]/50 focus:border-[#1dff00] focus:shadow-[0_0_20px_rgba(29,255,0,0.4)]"
    }
    
    const sizeClasses = {
      default: "min-h-[80px] px-3 py-2 text-sm",
      sm: "min-h-[60px] px-2 py-1 text-xs",
      lg: "min-h-[120px] px-4 py-3 text-base"
    }

    return (
      <div className="relative group">
        <textarea
          className={cn(
            baseClasses,
            variantClasses[variant],
            sizeClasses[textareaSize],
            className
          )}
          ref={ref}
          {...props}
        />
        {/* Focus glow effect */}
        <div className="absolute inset-0 rounded-md opacity-0 group-focus-within:opacity-100 bg-gradient-to-r from-transparent via-[#1dff00]/10 to-transparent transition-opacity duration-300 pointer-events-none" />
        
        {/* Character count indicator */}
        {props.maxLength && (
          <div className="absolute bottom-2 right-2 text-xs text-[#ffffff]/60 bg-black/50 px-2 py-1 rounded">
            {props.value?.toString().length || 0}/{props.maxLength}
          </div>
        )}
      </div>
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }