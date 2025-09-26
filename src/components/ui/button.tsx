import React from "react";
import { cn } from "../../lib/utils";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  // Added "default" alias for primary to support ai-elements; added "link" already present
  variant?: "primary" | "default" | "secondary" | "outline" | "ghost" | "destructive" | "neo" | "link";
  // Added "icon" & "default" sizes for compatibility with ai-elements components
  size?: "sm" | "md" | "lg" | "icon" | "default";
};

export const Button: React.FC<ButtonProps> = ({ variant = "primary", size = "md", className = "", children, ...props }) => {
  const base = "inline-flex items-center justify-center rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none active:translate-y-px";
  const resolvedSize = size === "default" ? "md" : size;
  const sizeClasses = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-11 px-5 text-base",
    icon: "h-9 w-9 p-0 inline-flex items-center justify-center",
  }[resolvedSize as Exclude<typeof resolvedSize, "default">];

  const resolvedVariant = variant === "default" ? "primary" : variant;
  const variantClasses = {
    primary: "bg-brand text-primary-foreground hover:opacity-95 shadow-sm",
    secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
    outline: "border border-border bg-transparent text-foreground hover:bg-accent",
    ghost: "bg-transparent hover:bg-accent",
    destructive: "bg-destructive text-destructive-foreground hover:opacity-95",
    neo: "bg-brand text-black hover:opacity-95 shadow-[0_0_18px_hsla(var(--brand)/0.35)] border border-brand/40",
    link: "bg-transparent text-brand hover:underline underline-offset-4 px-0 h-auto",
  }[resolvedVariant];

  return (
    <button
      {...props}
  className={cn(base, sizeClasses, variantClasses, className)}
    >
      {children}
    </button>
  );
};

export default Button;
