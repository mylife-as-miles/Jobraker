import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Rocket, Unlock, X, Check } from "lucide-react";
import type { CreditBalance } from "@/types/credits";
import { cn } from "@/lib/utils";
import {
  LOW_CREDIT_RESCUE_CODE,
  LOW_CREDIT_RESCUE_DISCOUNT_PCT,
  LOW_CREDIT_RESCUE_DURATION_MS,
  ensureLowCreditRescueExpiry,
  readLowCreditRescueExpiry,
} from "@/lib/lowCreditRescuePromo";

const STORAGE_KEY = "jobraker_low_credits_promo_snooze_until";
const DISMISS_MS = 1000 * 60 * 60 * 18;
export const PROMO_CODE_DISPLAY = LOW_CREDIT_RESCUE_CODE;
export const PROMO_DISCOUNT_PCT = LOW_CREDIT_RESCUE_DISCOUNT_PCT;

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
  const [secondsLeft, setSecondsLeft] = useState(() => {
    try {
      const expiry = readLowCreditRescueExpiry();
      if (expiry > 0) {
        return Math.max(0, Math.ceil((expiry - Date.now()) / 1000));
      }
    } catch {
      // ignore
    }
    return 60 * 60;
  });

  const stats = getCreditPressureStats(balance);

  useEffect(() => {
    if (!open) return;

    const getExpiryTime = () => {
      try {
        const existing = readLowCreditRescueExpiry();
        if (existing > Date.now()) return existing;
      } catch (error) {
        console.error(error);
      }

      try {
        return ensureLowCreditRescueExpiry();
      } catch (error) {
        console.error(error);
      }

      return Date.now() + LOW_CREDIT_RESCUE_DURATION_MS;
    };

    const expiryTime = getExpiryTime();

    const updateTimer = () => {
      const remaining = Math.max(
        0,
        Math.ceil((expiryTime - Date.now()) / 1000),
      );
      setSecondsLeft(remaining);
    };

    updateTimer();
    const id = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(id);
  }, [open]);

  const handleClose = useCallback(() => {
    snoozePromo();
    onOpenChange(false);
  }, [onOpenChange]);

  const mm = Math.floor(secondsLeft / 60);
  const ss = secondsLeft % 60;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : handleClose())}
    >
      <DialogContent
        hideCloseButton
        className='max-w-[min(100%,420px)] overflow-hidden gap-0 border border-fuchsia-500/25 bg-zinc-950 p-0 text-foreground shadow-[0_0_0_1px_rgba(217,70,239,0.15),0_25px_80px_-20px_rgba(0,0,0,0.85)] sm:rounded-2xl'
      >
        <DialogTitle className='sr-only'>
          Career momentum is running low
        </DialogTitle>
        <DialogDescription className='sr-only'>
          You have used most of your monthly search capacity. This screen unlocks
          a one-time rescue offer at your next checkout.
        </DialogDescription>

        <div className='flex items-center justify-between gap-3 border-b border-white/10 bg-black/40 px-4 py-2.5'>
          <div className='flex min-w-0 items-center gap-2'>
            <Rocket className='h-4 w-4 shrink-0 text-white' aria-hidden />
            <span className='truncate text-xs font-medium text-white/95 sm:text-sm'>
              You&apos;ve used {stats.percentSpent}% of your search capacity
            </span>
          </div>
          <button
            type='button'
            onClick={handleClose}
            className='rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white'
            aria-label='Dismiss'
          >
            <X className='h-4 w-4' />
          </button>
        </div>

        <div className='space-y-5 px-6 pb-6 pt-8'>
          <div className='flex justify-center'>
            <div
              className={cn(
                "relative flex h-20 w-20 items-center justify-center rounded-2xl",
                "bg-gradient-to-br from-fuchsia-600 to-pink-700",
                "shadow-[0_0_40px_-8px_rgba(217,70,239,0.75)]",
                "ring-2 ring-fuchsia-400/40",
              )}
            >
              <Unlock
                className='h-10 w-10 text-white drop-shadow-md'
                strokeWidth={2}
              />
            </div>
          </div>

          <div className='space-y-1 text-center'>
            <p className='text-xl font-extrabold uppercase leading-tight tracking-tight text-fuchsia-400 sm:text-2xl'>
              Keep your pipeline moving
            </p>
            <p className='text-xl font-extrabold uppercase leading-tight tracking-tight text-white sm:text-2xl'>
              before momentum stalls
            </p>
          </div>

          <p className='px-1 text-center text-sm leading-relaxed text-zinc-400'>
            You have only{" "}
            <span className='font-semibold text-white'>
              {stats.percentRemaining}%
            </span>{" "}
            of your monthly search capacity left. You unlocked a one-time rescue
            offer for your next paid checkout before this hour closes.
          </p>

          <div className='overflow-hidden rounded-xl border border-white/10 bg-zinc-900/80'>
            <div className='flex items-center gap-2 border-b border-white/10 bg-brand/10 px-3 py-2'>
              <Check className='h-4 w-4 shrink-0 text-brand' strokeWidth={3} />
              <span className='text-xs font-semibold text-brand'>
                {PROMO_CODE_DISPLAY} is reserved for this account
              </span>
            </div>
            <div className='grid min-h-[88px] grid-cols-[1fr_auto_1fr] items-stretch gap-0'>
              <div className='flex flex-col justify-center border-r border-dashed border-white/20 px-4 py-3'>
                <span className='text-2xl font-black leading-none tabular-nums text-fuchsia-400 sm:text-3xl'>
                  {PROMO_DISCOUNT_PCT}% OFF
                </span>
                <span className='mt-1.5 text-[10px] uppercase tracking-wide text-zinc-500'>
                  One-time momentum offer
                </span>
              </div>
              <div className='w-px bg-transparent' aria-hidden />
              <div className='flex flex-col items-center justify-center px-3 py-3'>
                <div className='flex items-baseline gap-0.5 font-mono tabular-nums'>
                  <span className='text-3xl font-bold leading-none text-white sm:text-4xl'>
                    {String(mm).padStart(2, "0")}
                  </span>
                  <span className='pb-1 text-2xl text-white/60'>:</span>
                  <span className='text-3xl font-bold leading-none text-white sm:text-4xl'>
                    {String(ss).padStart(2, "0")}
                  </span>
                </div>
                <div className='mt-1 flex gap-6 text-[10px] uppercase tracking-wider text-zinc-500'>
                  <span>minutes</span>
                  <span>seconds</span>
                </div>
              </div>
            </div>
          </div>

          <Button
            type='button'
            disabled={loading}
            onClick={() => {
              onUpgrade();
              handleClose();
            }}
            className='h-12 w-full rounded-xl bg-brand text-sm font-bold text-black shadow-[0_0_24px_rgba(29,255,0,0.35)] transition-all hover:bg-brand hover:brightness-110 hover:shadow-[0_0_32px_rgba(29,255,0,0.45)] sm:text-base'
          >
            Keep my search moving
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { readSnoozeUntil, snoozePromo };
