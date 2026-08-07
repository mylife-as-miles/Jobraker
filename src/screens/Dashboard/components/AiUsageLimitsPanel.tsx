import React from "react";
import { useAiUsageLimits } from "../../../hooks/useAiUsageLimits";
import { UsageLimitRow, formatResetDate } from "./UsageLimitRow";
import { Skeleton } from "../../../components/ui/skeleton";
import { Button } from "../../../components/ui/button";
import { RefreshCw, AlertCircle } from "lucide-react";

export const AiUsageLimitsPanel: React.FC = () => {
  const { data, loading, error, refresh } = useAiUsageLimits();

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            General usage limits
          </h3>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between py-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-3 w-48" />
          </div>
          <div className="flex items-center justify-between py-2 border-t border-border/40">
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-3 w-48" />
          </div>
          <div className="flex items-center justify-between py-2 border-t border-border/40">
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            General usage limits
          </h3>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3 text-destructive mb-4">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh()}
            className="gap-2 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const rolling = data?.rolling24h || {
    percentUsed: 0,
    percentLeft: 100,
    resetsAt: null,
    resetsGradually: true,
  };
  const weekly = data?.weekly || {
    percentUsed: 0,
    percentLeft: 100,
    resetsAt: null,
    resetsGradually: false,
  };
  const monthly = data?.monthly || {
    percentUsed: 0,
    percentLeft: 100,
    resetsAt: null,
    resetsGradually: false,
  };

  const isAnyExhausted =
    rolling.percentLeft === 0 || weekly.percentLeft === 0 || monthly.percentLeft === 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h3 className="text-lg font-semibold text-foreground tracking-tight">
          General usage limits
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          AI usage includes AI responses and actions performed through connected tools.
        </p>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm divide-y divide-border/40">
        <UsageLimitRow
          label="24-hour usage limit"
          status={rolling}
        />
        <UsageLimitRow
          label="Weekly usage limit"
          status={weekly}
        />
        <UsageLimitRow
          label="Monthly usage limit"
          status={monthly}
        />
      </div>

      {isAnyExhausted && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-800 dark:text-amber-200 text-xs leading-relaxed space-y-1">
          <p className="font-semibold">Limit Reached</p>
          {rolling.percentLeft === 0 && (
            <p>
              Your 24-hour rolling usage limit is currently exhausted. Capacity becomes available gradually ({formatResetDate(rolling.resetsAt, true, rolling.nextAvailabilityAt).toLowerCase()}).
            </p>
          )}
          {weekly.percentLeft === 0 && (
            <p>
              Your weekly usage limit is exhausted. Usage will reset at the start of your next weekly billing window ({formatResetDate(weekly.resetsAt, false).toLowerCase()}).
            </p>
          )}
          {monthly.percentLeft === 0 && (
            <p>
              Your monthly usage limit is exhausted. Usage will reset at the start of your next monthly billing cycle ({formatResetDate(monthly.resetsAt, false).toLowerCase()}).
            </p>
          )}
        </div>
      )}
    </div>
  );
};
