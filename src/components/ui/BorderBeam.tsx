import React from "react";
import { cn } from "../../lib/utils";

export interface BorderBeamProps {
  children?: React.ReactNode;
  className?: string;
  innerClassName?: string;
  borderRadius?: string;
  innerRadius?: string;
  colorFrom?: string;
  colorTo?: string;
  durationSeconds?: number;
  active?: boolean;
}

export const BorderBeam: React.FC<BorderBeamProps> = ({
  children,
  className = "",
  innerClassName = "",
  borderRadius = "rounded-[32px]",
  innerRadius = "rounded-[30.5px]",
  colorFrom = "#2fd968",
  colorTo = "#ffffff",
  durationSeconds = 3,
  active = true,
}) => {
  if (!active) {
    return <div className={cn("relative", className)}>{children}</div>;
  }

  return (
    <div
      className={cn(
        "beam relative p-[1.5px] overflow-hidden",
        borderRadius,
        className
      )}
    >
      <div
        className="beam-gradient pointer-events-none absolute -inset-[200%] animate-spin-beam z-0"
        style={{
          background: `conic-gradient(from 0deg, transparent 0 72%, ${colorFrom} 84%, ${colorTo} 90%, transparent 96%)`,
          animationDuration: `${durationSeconds}s`,
        }}
      />
      <div
        className={cn(
          "beam-inner relative z-10 bg-black w-full h-full",
          innerRadius,
          innerClassName
        )}
      >
        {children}
      </div>
    </div>
  );
};
