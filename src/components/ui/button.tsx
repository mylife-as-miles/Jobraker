import React from "react";
import { cn } from "../../lib/utils";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
};

export const Button: React.FC<ButtonProps> = ({ variant = "primary", size = "md", className = "", children, ...props }) => {
  const base = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none active:translate-y-px";
  const sizeClasses = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-11 px-5 text-base",
  }[size];

  const variantClasses = {
    primary: "bg-brand text-primary-foreground hover:opacity-95 shadow-sm",
    secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
    outline: "border border-border bg-transparent text-foreground hover:bg-accent",
    ghost: "bg-transparent hover:bg-accent",
    destructive: "bg-destructive text-destructive-foreground hover:opacity-95",
  }[variant];

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
