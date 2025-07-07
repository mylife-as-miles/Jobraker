import * as React from "react"
import { cn } from "../../lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-[#ffffff33] bg-[#0a0a0a] px-3 py-2 text-sm text-white ring-offset-[#0a0a0a] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[#ffffff66] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1dff00] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 hover:border-[#ffffff4d] transition-all duration-300",
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