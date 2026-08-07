import React from "react";
import { cn } from "../../lib/utils";

export interface AuroraDriftProps {
  variant?: "default" | "emerald" | "amber";
  className?: string;
  children?: React.ReactNode;
}

export const AuroraDrift: React.FC<AuroraDriftProps> = ({
  variant = "emerald",
  className = "",
  children,
}) => {
  return (
    <div
      className={cn(
        "aurora pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]",
        variant === "emerald" && "aurora-emerald",
        className
      )}
    >
      {children}
    </div>
  );
};
