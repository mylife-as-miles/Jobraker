import { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Rocket, Unlock, X, Check } from "lucide-react";
import type { CreditBalance } from "@/types/credits";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "jobraker_low_credits_promo_snooze_until";
const DISMISS_MS = 1000 * 60 * 60 * 18;
/** Shown in UI; billing still uses your real catalog — this is promotional framing. */
export const PROMO_CODE_DISPLAY = "JOBRAKER_PERSONAL";
export const PROMO_DISCOUNT_PCT = 55;

function readSnoozeUntil(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function snoozePromo() {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now() + DISMISS_MS));
  } catch {
    /* ignore */
  }
}

/**
 * When to surface the urgency modal: nearly exhausted wallet or low vs lifetime earned.
 */
export function getCreditPressureStats(b: CreditBalance | null): {
  shouldAlert: boolean;
  percentSpent: number;
  percentRemaining: number;
} {
  if (!b) {
    return { shouldAlert: false, percentSpent: 0, percentRemaining: 100 };
  }
  const earned = Math.max(0, Number(b.totalEarned) || 0);
  const bal = Math.max(0, Number(b.balance) || 0);
  const consumed = Math.max(0, Number(b.totalConsumed) || 0);

  if (bal <= 0) {
    const anyActivity = earned > 0 || consumed > 0;
    return {
      shouldAlert: anyActivity,
      percentSpent: 100,
      percentRemaining: 0,
    };
  }

  if (earned >= 40) {
    const pctRemaining = (bal / earned) * 100;
    const pctSpent = 100 - pctRemaining;
    return {
      shouldAlert: pctRemaining <= 22,
      percentSpent: Math.min(100, Math.round(pctSpent)),
      percentRemaining: Math.max(0, Math.round(pctRemaining)),
    };
  }

  const pool = consumed + bal;
  if (pool > 0) {
    const pctRemaining = (bal / pool) * 100;
    const pctSpent = 100 - pctRemaining;
    return {
      shouldAlert: bal <= 25 && pool >= 15,
      percentSpent: Math.min(100, Math.round(pctSpent)),
      percentRemaining: Math.max(0, Math.round(pctRemaining)),
    };
  }

  return { shouldAlert: false, percentSpent: 0, percentRemaining: 100 };
}

type LowCreditsPromoModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balance: CreditBalance | null;
  loading: boolean;
  onUpgrade: () => void;
};

export function LowCreditsPromoModal({
  open,
  onOpenChange,
  balance,
  loading,
  onUpgrade,
}: LowCreditsPromoModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(60 * 60);

  const stats = getCreditPressureStats(balance);

  useEffect(() => {
    if (!open) return;
    setSecondsLeft(60 * 60);
    const id = window.setInterval(() => {
      setSecondsLeft((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [open]);

  const handleClose = useCallback(() => {
    snoozePromo();
    onOpenChange(false);
  }, [onOpenChange]);

  const mm = Math.floor(secondsLeft / 60);
  const ss = secondsLeft % 60;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : handleClose())}>
      <DialogContent
        hideCloseButton
        className="max-w-[min(100%,420px)] border border-fuchsia-500/25 bg-zinc-950 p-0 text-foreground shadow-[0_0_0_1px_rgba(217,70,239,0.15),0_25px_80px_-20px_rgba(0,0,0,0.85)] sm:rounded-2xl overflow-hidden gap-0"
      >
        {/* Top alert bar */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/40 px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <Rocket className="h-4 w-4 shrink-0 text-white" aria-hidden />
            <span className="text-xs sm:text-sm font-medium text-white/95 truncate">
              You&apos;ve spent {stats.percentSpent}% of your credits
            </span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 pt-8 pb-6 space-y-5">
          <div className="flex justify-center">
            <div
              className={cn(
                "relative flex h-20 w-20 items-center justify-center rounded-2xl",
                "bg-gradient-to-br from-fuchsia-600 to-pink-700",
                "shadow-[0_0_40px_-8px_rgba(217,70,239,0.75)]",
                "ring-2 ring-fuchsia-400/40",
              )}
            >
              <Unlock className="h-10 w-10 text-white drop-shadow-md" strokeWidth={2} />
            </div>
          </div>

          <div className="text-center space-y-1">
            <p className="text-xl sm:text-2xl font-extrabold tracking-tight text-fuchsia-400 uppercase leading-tight">
              Your last chance
            </p>
            <p className="text-xl sm:text-2xl font-extrabold tracking-tight text-white uppercase leading-tight">
              to upgrade with discount
            </p>
          </div>

          <p className="text-center text-sm text-zinc-400 leading-relaxed px-1">
            You have only{" "}
            <span className="text-white font-semibold">{stats.percentRemaining}%</span> of your
            credits left. Top up or move to a higher plan — limited-time promo pricing below.
          </p>

          {/* Coupon strip */}
          <div className="rounded-xl border border-white/10 bg-zinc-900/80 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-[#1dff00]/10">
              <Check className="h-4 w-4 text-[#1dff00] shrink-0" strokeWidth={3} />
              <span className="text-xs font-semibold text-[#1dff00]">
                {PROMO_CODE_DISPLAY} promocode is applied
              </span>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-0 items-stretch min-h-[88px]">
              <div className="flex flex-col justify-center px-4 py-3 border-r border-dashed border-white/20">
                <span className="text-2xl sm:text-3xl font-black text-fuchsia-400 tabular-nums leading-none">
                  {PROMO_DISCOUNT_PCT}% OFF
                </span>
                <span className="text-[10px] text-zinc-500 mt-1.5 uppercase tracking-wide">
                  With limited-offer promo
                </span>
              </div>
              <div className="w-px bg-transparent" aria-hidden />
              <div className="flex flex-col items-center justify-center px-3 py-3">
                <div className="flex items-baseline gap-0.5 font-mono tabular-nums">
                  <span className="text-3xl sm:text-4xl font-bold text-white leading-none">
                    {String(mm).padStart(2, "0")}
                  </span>
                  <span className="text-2xl text-white/60 pb-1">:</span>
                  <span className="text-3xl sm:text-4xl font-bold text-white leading-none">
                    {String(ss).padStart(2, "0")}
                  </span>
                </div>
                <div className="flex gap-6 mt-1 text-[10px] text-zinc-500 uppercase tracking-wider">
                  <span>minutes</span>
                  <span>seconds</span>
                </div>
              </div>
            </div>
          </div>

          <Button
            type="button"
            disabled={loading}
            onClick={() => {
              onUpgrade();
              handleClose();
            }}
            className="w-full h-12 rounded-xl bg-[#1dff00] text-black font-bold text-sm sm:text-base hover:bg-[#1dff00] hover:brightness-110 shadow-[0_0_24px_rgba(29,255,0,0.35)] hover:shadow-[0_0_32px_rgba(29,255,0,0.45)] transition-all"
          >
            Get your upgrade discount
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { readSnoozeUntil, snoozePromo };
