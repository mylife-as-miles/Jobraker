import React from "react";
import "@/styles/main.css";

export interface ShimmerTextProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "brand" | "silver" | "gold" | "emerald";
  duration?: string;
  as?: React.ElementType;
}

export const ShimmerText: React.FC<ShimmerTextProps> = ({
  children,
  className = "",
  variant = "default",
  duration = "3s",
  as: Component = "span",
}) => {
  const variantClass = variant !== "default" ? `shimmer-text-${variant}` : "";

  return (
    <Component
      className={`shimmer-text ${variantClass} ${className}`}
      style={{ animationDuration: duration }}
    >
      {children}
    </Component>
  );
};

export default ShimmerText;
