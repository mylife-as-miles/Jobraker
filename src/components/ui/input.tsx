import * as React from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "transparent" | "outlined";
  inputSize?: "sm" | "md" | "lg" | "xl";
  error?: boolean;
  hasError?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, type, variant = "transparent", inputSize = "lg", error, hasError, ...props },
    ref,
  ) => {
    const isError = error || hasError || props["aria-invalid"] === true || props["aria-invalid"] === "true";

    const baseClasses =
      "flex w-full rounded-xl border border-input bg-background text-foreground placeholder:text-foreground/60 file:border-0 file:bg-transparent file:text-sm outline-none file:font-medium disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200";

    const variantClasses = {
      default: "bg-card/60 hover:border-border focus:border-brand",
      transparent: "bg-transparent hover:border-border focus:border-brand",
      outlined:
        "bg-transparent border-border hover:border-foreground/40 focus:border-brand",
    };

    const sizeClasses = {
      sm: "h-8 px-2 text-sm",
      md: "h-10 px-3 text-base",
      lg: "h-12 px-4 text-lg sm:h-14 sm:px-5 sm:text-xl",
      xl: "h-14 px-5 text-xl sm:h-16 sm:px-6 sm:text-2xl",
    };

    return (
      <input
        type={type}
        data-error={isError ? "true" : undefined}
        className={cn(
          baseClasses,
          variantClasses[variant],
          sizeClasses[inputSize],
          "font-medium tracking-wide leading-relaxed placeholder:opacity-80",
          isError && "border-[#FF5C5C] text-[#FF5C5C] animate-shake-x",
          "aria-[invalid=true]:border-[#FF5C5C] aria-[invalid=true]:animate-shake-x",
          inputSize === "lg" && "text-base sm:text-lg",
          inputSize === "xl" && "text-lg sm:text-xl",
          "py-3",
          "min-w-0 max-w-full",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
