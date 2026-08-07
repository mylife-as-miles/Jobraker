import React from "react";
import { WindowUsageStatus } from "../../../services/aiUsageService";

interface UsageLimitRowProps {
  label: string;
  subtitleFallback?: string;
  status: WindowUsageStatus;
}

export const formatResetDate = (
  isoString: string | null,
  isRolling: boolean,
  nextAvailabilityAt?: string | null,
): string => {
  const targetIso = nextAvailabilityAt || isoString;
  if (!targetIso) {
    return isRolling ? "Resets gradually" : "Resets next period";
  }

  try {
    const targetDate = new Date(targetIso);
    const now = new Date();
    const diffMs = targetDate.getTime() - now.getTime();

    if (isNaN(targetDate.getTime())) {
      return isRolling ? "Resets gradually" : "Resets next period";
    }

    if (diffMs > 0) {
      const diffMins = Math.ceil(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);
      const remainingMins = diffMins % 60;

      if (diffHours >= 24 * 7) {
        const day = targetDate.getDate();
        const month = targetDate.toLocaleDateString(undefined, { month: "short" });
        return `Resets ${day} ${month}`;
      } else if (diffHours >= 24) {
        const days = Math.ceil(diffHours / 24);
        return `Resets in ${days} day${days > 1 ? "s" : ""}`;
      } else if (diffHours > 0) {
        if (remainingMins > 0 && diffHours < 5) {
          return `Resets in ${diffHours}h ${remainingMins}m`;
        }
        return `Resets in ${diffHours} hour${diffHours > 1 ? "s" : ""}`;
      } else {
        return `Resets in ${diffMins} min${diffMins > 1 ? "s" : ""}`;
      }
    } else {
      if (!isRolling) {
        const day = targetDate.getDate();
        const month = targetDate.toLocaleDateString(undefined, { month: "short" });
        return `Resets ${day} ${month}`;
      }
      return "Resets gradually";
    }
  } catch {
    return isRolling ? "Resets gradually" : "Resets next period";
  }
};

export const UsageLimitRow: React.FC<UsageLimitRowProps> = ({
  label,
  subtitleFallback,
  status,
}) => {
  const percentLeft = Math.min(100, Math.max(0, status.percentLeft));
  const isRolling = Boolean(status.resetsGradually);
  const calculatedSubtitle = formatResetDate(
    status.resetsAt,
    isRolling,
    status.nextAvailabilityAt,
  );
  const subtitle = subtitleFallback || calculatedSubtitle;

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
