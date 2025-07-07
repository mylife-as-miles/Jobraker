import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[#1dff00] text-black hover:bg-[#16d918] focus:ring-[#1dff00] focus:ring-offset-[#0a0a0a] shadow-lg hover:shadow-xl transition-all duration-300",
        destructive:
          "bg-red-500 text-white hover:bg-red-600 focus:ring-red-500 focus:ring-offset-[#0a0a0a] shadow-lg hover:shadow-xl transition-all duration-300",
        outline:
          "border border-[#ffffff33] bg-transparent text-white hover:bg-[#ffffff1a] hover:border-[#1dff00]/50 focus:ring-[#1dff00] focus:ring-offset-[#0a0a0a] transition-all duration-300",
        secondary:
          "bg-[#ffffff1a] text-white hover:bg-[#ffffff26] focus:ring-[#ffffff66] focus:ring-offset-[#0a0a0a] border border-[#ffffff15] transition-all duration-300",
        ghost: "text-white hover:bg-[#ffffff1a] hover:text-[#1dff00] focus:ring-[#1dff00] focus:ring-offset-[#0a0a0a] transition-all duration-300",
        link: "text-[#1dff00] underline-offset-4 hover:underline hover:text-[#16d918] focus:ring-[#1dff00] focus:ring-offset-[#0a0a0a] transition-all duration-300",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
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
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }