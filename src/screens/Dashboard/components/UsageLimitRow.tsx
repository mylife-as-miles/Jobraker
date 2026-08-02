import React from "react";
import { WindowUsageStatus } from "../../../services/aiUsageService";

interface UsageLimitRowProps {
  label: string;
  subtitleFallback?: string;
  status: WindowUsageStatus;
}

export const formatResetDate = (isoString: string | null, isRolling: boolean): string => {
  if (isRolling) return "Resets gradually";
  if (!isoString) return "Resets next period";

  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "Resets next period";

    // Format like "9 Aug" or "1 Sep"
    const day = d.getDate();
    const month = d.toLocaleDateString(undefined, { month: "short" });
    return `Resets ${day} ${month}`;
  } catch {
    return "Resets next period";
  }
};

export const UsageLimitRow: React.FC<UsageLimitRowProps> = ({
  label,
  subtitleFallback,
  status,
}) => {
  const percentLeft = Math.min(100, Math.max(0, status.percentLeft));
  const subtitle = subtitleFallback || formatResetDate(status.resetsAt, status.resetsGradually);

  return (
    <div className="py-4 border-b border-border/40 last:border-b-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      {/* Left info side */}
      <div className="flex flex-col gap-0.5">
        <h4 className="text-sm font-semibold text-foreground tracking-tight">
          {label}
        </h4>
        <p className="text-xs text-muted-foreground font-normal">
          {subtitle}
        </p>
      </div>

      {/* Right progress side */}
      <div className="flex items-center gap-3 self-end sm:self-auto w-full sm:w-auto">
        <div
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentLeft}
          className="relative h-2.5 w-full sm:w-48 bg-muted/60 dark:bg-zinc-800 rounded-full overflow-hidden"
        >
          <div
            className="h-full bg-foreground dark:bg-zinc-100 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${percentLeft}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-foreground min-w-[56px] text-right font-mono">
          {percentLeft}% left
        </span>
      </div>
    </div>
  );
};
