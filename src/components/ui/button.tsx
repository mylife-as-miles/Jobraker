import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background relative overflow-hidden group disabled:pointer-events-none disabled:opacity-50 \
   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 \
   transition-shadow duration-200 ease-out transform-gpu motion-reduce:transition-none \
   hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-transparent border border-[#1dff00]/30 text-[#1dff00] hover:bg-[#1dff00]/10 hover:border-[#1dff00]/60 hover:shadow-[0_0_20px_rgba(29,255,0,0.3)] active:bg-[#1dff00]/20 focus:bg-[#1dff00]/10 focus:border-[#1dff00] backdrop-blur-sm",
        destructive:
          "bg-transparent border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/60 hover:shadow-[0_0_20px_rgba(239,68,68,0.3)] active:bg-red-500/20 focus:bg-red-500/10 focus:border-red-500 backdrop-blur-sm",
        outline:
          "bg-transparent border border-[#ffffff]/20 text-[#ffffff] hover:bg-[#ffffff]/10 hover:border-[#ffffff]/40 hover:shadow-[0_0_15px_rgba(255,255,255,0.2)] active:bg-[#ffffff]/20 focus:bg-[#ffffff]/10 focus:border-[#ffffff]/60 backdrop-blur-sm",
        secondary:
          "bg-transparent border border-[#888888]/30 text-[#888888] hover:bg-[#888888]/10 hover:border-[#888888]/60 hover:text-[#ffffff] hover:shadow-[0_0_15px_rgba(136,136,136,0.3)] active:bg-[#888888]/20 focus:bg-[#888888]/10 focus:border-[#888888] backdrop-blur-sm",
        ghost: 
          "bg-transparent text-[#ffffff]/80 hover:bg-[#ffffff]/10 hover:text-[#ffffff] active:bg-[#ffffff]/20 focus:bg-[#ffffff]/10 backdrop-blur-sm",
        link: 
          "bg-transparent text-[#1dff00] underline-offset-4 hover:underline hover:text-[#1dff00]/80 active:text-[#1dff00]/60 focus:text-[#1dff00] focus:underline",
        premium:
          "bg-transparent border border-[#1dff00]/50 text-black hover:bg-[#1dff00]/90 hover:border-[#1dff00] hover:shadow-[0_0_25px_rgba(29,255,0,0.4)] active:bg-[#1dff00]/80 focus:bg-[#1dff00]/90 focus:border-[#1dff00] backdrop-blur-sm relative overflow-hidden",
        success:
          "bg-transparent border border-green-500/30 text-green-400 hover:bg-green-500/10 hover:border-green-500/60 hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] active:bg-green-500/20 focus:bg-green-500/10 focus:border-green-500 backdrop-blur-sm",
        warning:
          "bg-transparent border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 hover:border-yellow-500/60 hover:shadow-[0_0_20px_rgba(234,179,8,0.3)] active:bg-yellow-500/20 focus:bg-yellow-500/10 focus:border-yellow-500 backdrop-blur-sm",
        info:
          "bg-transparent border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/60 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] active:bg-blue-500/20 focus:bg-blue-500/10 focus:border-blue-500 backdrop-blur-sm"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        xl: "h-12 rounded-lg px-10 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {/* Radial hover highlight */}
        <span className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" aria-hidden>
          <span className="absolute -inset-10 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08),rgba(255,255,255,0)_60%)] group-active:opacity-0" />
        </span>
        {/* Ripple line flash on active */}
        <span className="absolute inset-0 opacity-0 group-active:opacity-100 bg-gradient-to-r from-transparent via-[#ffffff]/15 to-transparent transition-opacity duration-150 pointer-events-none" aria-hidden />
        {/* Shimmer effect for premium variant */}
        {variant === "premium" && (
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-[#1dff00]/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none" aria-hidden />
        )}
        {children}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }