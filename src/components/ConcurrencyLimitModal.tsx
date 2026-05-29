import { useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Zap, Crown, X, Check, Flame, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { BILLING_PLAN_DEFINITIONS, BILLING_CONCURRENCY_PACK_DEFINITIONS } from "@/lib/billingCatalog";

type ConcurrencyLimitModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeRuns: number;
  totalLimit: number;
  currentTier: string;
  onUpgrade: (tab?: string) => void;
};

export function ConcurrencyLimitModal({
  open,
  onOpenChange,
  activeRuns,
  totalLimit,
  currentTier,
  onUpgrade,
}: ConcurrencyLimitModalProps) {
  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const isBasics = currentTier === "Basics";
  const isPro = currentTier === "Pro";
  const isFree = currentTier === "Free" || !currentTier;

  // Anchoring options
  const momentumBoost = BILLING_CONCURRENCY_PACK_DEFINITIONS.find((b) => b.sku === "parallel_2");
  const scaleBoost = BILLING_CONCURRENCY_PACK_DEFINITIONS.find((b) => b.sku === "parallel_4");
  const ultimatePlan = BILLING_PLAN_DEFINITIONS.find((p) => p.name === "Ultimate");

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : handleClose())}
    >
      <DialogContent
        hideCloseButton
        className='!flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[640px] flex-col overflow-hidden gap-0 border border-purple-500/40 bg-zinc-950 p-0 text-foreground shadow-[0_0_50px_-12px_rgba(168,85,247,0.5),0_25px_80px_-20px_rgba(0,0,0,0.95)] sm:max-h-[calc(100dvh-2rem)] sm:w-[min(92vw,640px)] sm:rounded-3xl'
      >
        <DialogTitle className='sr-only'>
          Your automation queue is at capacity
        </DialogTitle>
        <DialogDescription className='sr-only'>
          All your parallel apply slots are full. Add parallel capacity to keep your job-search pipeline moving.
        </DialogDescription>

        {/* Top Urgency Bar */}
        <div className='flex shrink-0 items-center justify-between gap-3 border-b border-red-500/20 bg-red-950/20 px-3 py-2.5 sm:px-4'>
          <div className='flex min-w-0 items-center gap-2'>
            <Flame className='h-4 w-4 shrink-0 text-red-500 animate-pulse' aria-hidden />
            <span className='line-clamp-2 text-[10px] font-bold uppercase leading-snug tracking-wider text-red-400 sm:truncate sm:text-xs'>
              Your active applications are waiting for an open automation slot
            </span>
          </div>
          <button
            type='button'
            onClick={handleClose}
            className='rounded-lg p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white'
            aria-label='Dismiss'
          >
            <X className='h-4 w-4' />
          </button>
        </div>

        {/* Main Body */}
        <div className='relative min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-4 pt-5 sm:space-y-6 sm:px-6 sm:pb-6 sm:pt-7'>
          {/* Ambient Glows */}
          <div className='absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-purple-500/10 rounded-full blur-[60px] pointer-events-none' />

          <div className='flex justify-center relative z-10'>
            <div
              className={cn(
                "relative flex h-16 w-16 items-center justify-center rounded-2xl sm:h-20 sm:w-20",
                "bg-gradient-to-br from-red-600 via-purple-600 to-indigo-700",
                "shadow-[0_0_50px_-5px_rgba(168,85,247,0.85)]",
                "ring-2 ring-purple-400/30",
              )}
            >
              <Zap
                className='h-8 w-8 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] animate-pulse sm:h-10 sm:w-10'
                strokeWidth={2.5}
              />
            </div>
          </div>

          <div className='space-y-2 text-center relative z-10'>
            <h3 className='text-xl font-black uppercase tracking-tight text-white leading-tight sm:text-2xl sm:leading-none'>
              Queue paused at <span className='text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500'>{activeRuns}/{totalLimit} Slots</span>
            </h3>
            <p className='mx-auto max-w-[54ch] px-1 text-xs leading-relaxed text-zinc-400 sm:text-sm'>
              Your ready applications are queued, but your current plan is already using every parallel run. Add capacity to finish this sprint faster.
            </p>
          </div>

          {/* Social Proof Banner */}
          <div className='relative z-10 flex items-start gap-2.5 rounded-xl border border-purple-500/20 bg-purple-950/15 p-3 text-xs leading-normal text-purple-300 sm:items-center'>
            <Check className='h-4 w-4 shrink-0 text-purple-400' strokeWidth={3} />
            <span>
              <strong>Boost Packs</strong> add temporary parallel slots for this billing period so active searches can keep moving when volume spikes.
            </span>
          </div>

          {/* Psychological Anchoring Offers */}
          <div className='space-y-3 relative z-10'>
            {/* Decoy 1: Momentum Boost (Best Selling Addon) */}
            {momentumBoost && (
              <div
                onClick={() => {
                  onUpgrade("boosts");
                  handleClose();
                }}
                className='group relative flex cursor-pointer flex-col gap-3 rounded-2xl border-2 border-purple-500 bg-zinc-900/90 p-3.5 shadow-[0_0_20px_rgba(168,85,247,0.15)] transition-all duration-200 hover:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between sm:p-4'
              >
                <div className='absolute -top-3 right-3 max-w-[calc(100%-1.5rem)] truncate rounded-full border border-purple-400 bg-gradient-to-r from-purple-600 to-pink-600 px-2.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-white shadow-md sm:right-4 sm:text-[9px]'>
                  Recommended Boost
                </div>
                <div className='flex min-w-0 items-center gap-3'>
                  <div className='w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform'>
                    <span className='text-sm font-black'>+{momentumBoost.parallelSlots}</span>
                  </div>
                  <div className='min-w-0'>
                    <p className='text-sm font-bold text-white group-hover:text-purple-300 transition-colors'>
                      {momentumBoost.name}
                    </p>
                    <p className='text-[10px] leading-snug text-zinc-500'>
                      Add 2 extra automation lanes for the rest of this billing period.
                    </p>
                  </div>
                </div>
                <div className='flex shrink-0 items-end justify-between gap-3 text-right sm:block'>
                  <p className='text-base font-black text-white'>
                    ${momentumBoost.priceUsd}
                  </p>
                  <p className='text-[9px] text-purple-400 font-bold uppercase tracking-wide flex items-center gap-0.5 justify-end mt-0.5'>
                    Unlock slots <ArrowRight className='w-2.5 h-2.5' />
                  </p>
                </div>
              </div>
            )}

            {/* Decoy 2: Scale Boost (Agency Speed) */}
            {scaleBoost && (
              <div
                onClick={() => {
                  onUpgrade("boosts");
                  handleClose();
                }}
                className='group flex cursor-pointer flex-col gap-3 rounded-xl border border-white/5 bg-zinc-900/40 p-3.5 transition-all duration-200 hover:border-purple-500/20 hover:bg-zinc-900/80 sm:flex-row sm:items-center sm:justify-between sm:p-4'
              >
                <div className='flex min-w-0 items-center gap-3'>
                  <div className='w-8 h-8 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400 group-hover:scale-105 transition-transform'>
                    <span className='text-sm font-black'>+{scaleBoost.parallelSlots}</span>
                  </div>
                  <div className='min-w-0'>
                    <p className='text-sm font-bold text-zinc-300 group-hover:text-purple-300 transition-colors'>
                      {scaleBoost.name}
                    </p>
                    <p className='text-[10px] leading-snug text-zinc-500'>
                      Add 4 parallel lanes for a heavier application sprint.
                    </p>
                  </div>
                </div>
                <div className='flex shrink-0 items-end justify-between gap-3 text-right sm:block'>
                  <p className='text-sm font-bold text-zinc-300'>
                    ${scaleBoost.priceUsd}
                  </p>
                  <p className='text-[9px] text-zinc-500 flex items-center gap-0.5 justify-end mt-0.5'>
                    Buy pack <ArrowRight className='w-2.5 h-2.5' />
                  </p>
                </div>
              </div>
            )}

            {/* Decoy 3: Ultimate Upgrade (The Premium Edge) */}
            {ultimatePlan && isFree && (
              <div
                onClick={() => {
                  onUpgrade("subscription");
                  handleClose();
                }}
                className='group flex cursor-pointer flex-col gap-3 rounded-xl border border-white/5 bg-zinc-900/40 p-3.5 transition-all duration-200 hover:border-purple-500/20 hover:bg-zinc-900/80 sm:flex-row sm:items-center sm:justify-between sm:p-4'
              >
                <div className='flex min-w-0 items-center gap-3'>
                  <div className='w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform'>
                    <Crown className='w-4 h-4' />
                  </div>
                  <div className='min-w-0'>
                    <p className='text-sm font-bold text-zinc-300 group-hover:text-purple-300 transition-colors'>
                      Upgrade to Ultimate
                    </p>
                    <p className='text-[10px] leading-snug text-zinc-500'>
                      8 base slots + 3,500 credits/mo + Priority Autopilot.
                    </p>
                  </div>
                </div>
                <div className='flex shrink-0 items-end justify-between gap-3 text-right sm:block'>
                  <p className='text-sm font-bold text-zinc-300'>
                    ${ultimatePlan.monthlyPriceUsd}/mo
                  </p>
                  <p className='text-[9px] text-zinc-500 flex items-center gap-0.5 justify-end mt-0.5'>
                    View plans <ArrowRight className='w-2.5 h-2.5' />
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className='space-y-2 relative z-10 pt-2'>
            <Button
              type='button'
              onClick={() => {
                onUpgrade("boosts");
                handleClose();
              }}
              className='min-h-11 h-auto w-full whitespace-normal rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-3 text-sm font-extrabold leading-tight text-white shadow-[0_0_24px_rgba(168,85,247,0.35)] transition-all hover:brightness-110 hover:shadow-[0_0_32px_rgba(168,85,247,0.45)] sm:min-h-12 sm:text-base'
            >
              Add parallel capacity
            </Button>
            <button
              type='button'
              onClick={handleClose}
              className='w-full px-3 py-2 text-center text-xs font-semibold leading-snug text-zinc-500 transition-colors hover:text-zinc-400'
            >
              Keep current speed
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
