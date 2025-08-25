import React from "react";
import cn from "classnames";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "solid" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
};

export const Button: React.FC<ButtonProps> = ({ variant = "solid", size = "md", className = "", children, ...props }) => {
  const base = "inline-flex items-center justify-center rounded-md font-medium transition-all duration-200";
  const sizeClasses = {
    sm: "px-2 py-1 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  }[size];

  // Safe defaults for dark mode: ghost/outline should be transparent (not plain white)
  const variantClasses = {
    solid: "bg-[#1dff00] text-black hover:bg-[#1dff00]/90",
    outline: "bg-transparent border border-[#ffffff33] text-white hover:bg-[#ffffff1a] hover:border-[#1dff00]/50",
    ghost: "bg-transparent text-[#ffffff80] hover:text-white hover:bg-[#ffffff1a]",
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
