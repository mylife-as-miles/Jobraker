import React from "react";
import { cn } from "../../lib/utils";

export interface ErrorShakeProps {
  /** Error message or node to render */
  children?: React.ReactNode;
  /** Trigger key to re-fire shake animation whenever error changes */
  errorKey?: string | number | boolean;
  /** Custom wrapper class */
  className?: string;
  /** Render wrapper element type (default: 'div') */
  as?: "div" | "span" | "p";
}

export const ErrorShake: React.FC<ErrorShakeProps> = ({
  children,
  errorKey,
  className = "",
  as: Component = "div",
}) => {
  if (!children) return null;

  return (
    <Component
      key={errorKey ? String(errorKey) : undefined}
      className={cn(
        "text-[#FF5C5C] text-xs font-medium animate-shake-x error-shake",
        className
      )}
    >
      {children}
    </Component>
  );
};
