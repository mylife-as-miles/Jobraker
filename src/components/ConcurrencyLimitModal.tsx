import { useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Rocket, Zap, Crown, X, Check, Flame, AlertCircle, ArrowRight } from "lucide-react";
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
        className='max-w-[min(100%,480px)] overflow-hidden gap-0 border border-purple-500/40 bg-zinc-950 p-0 text-foreground shadow-[0_0_50px_-12px_rgba(168,85,247,0.5),0_25px_80px_-20px_rgba(0,0,0,0.95)] sm:rounded-3xl'
      >
        <DialogTitle className='sr-only'>
          Your Auto-Apply Queue is Stalled
        </DialogTitle>
        <DialogDescription className='sr-only'>
          All your parallel apply slots are full. Other candidates are applying now. Upgrade to get ahead.
        </DialogDescription>

        {/* Top Urgency Bar */}
        <div className='flex items-center justify-between gap-3 border-b border-red-500/20 bg-red-950/20 px-4 py-2.5'>
          <div className='flex min-w-0 items-center gap-2'>
            <Flame className='h-4 w-4 shrink-0 text-red-500 animate-pulse' aria-hidden />
            <span className='truncate text-[11px] font-bold uppercase tracking-wider text-red-400 sm:text-xs'>
              Warning: Other candidates are applying to these roles right now
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
        <div className='space-y-6 px-6 pb-6 pt-8 relative'>
          {/* Ambient Glows */}
          <div className='absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-purple-500/10 rounded-full blur-[60px] pointer-events-none' />

          <div className='flex justify-center relative z-10'>
            <div
              className={cn(
                "relative flex h-20 w-20 items-center justify-center rounded-2xl",
                "bg-gradient-to-br from-red-600 via-purple-600 to-indigo-700",
                "shadow-[0_0_50px_-5px_rgba(168,85,247,0.85)]",
                "ring-2 ring-purple-400/30",
              )}
            >
              <Zap
                className='h-10 w-10 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] animate-pulse'
                strokeWidth={2.5}
              />
            </div>
          </div>

          <div className='space-y-2 text-center relative z-10'>
            <h3 className='text-2xl font-black uppercase tracking-tight text-white leading-none'>
              Queue Stalled at <span className='text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500'>{activeRuns}/{totalLimit} Slots</span>
            </h3>
            <p className='text-sm text-zinc-400 leading-relaxed px-1'>
              While your queue waits for an open slot, <span className='text-white font-semibold'>GitLab</span> and other top companies are actively scheduling interviews. Every minute you delay is a first-mover advantage handed to your competitors.
            </p>
          </div>

          {/* Social Proof Banner */}
          <div className='flex items-center gap-2.5 rounded-xl border border-purple-500/20 bg-purple-950/15 p-3 text-xs leading-normal text-purple-300 relative z-10'>
            <Check className='h-4 w-4 shrink-0 text-purple-400' strokeWidth={3} />
            <span>
              <strong>94% of candidates</strong> who landed interviews this week used Boost Packs to submit applications 3x faster than the competition.
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
                className='relative flex items-center justify-between p-4.5 rounded-2xl border-2 border-purple-500 bg-zinc-900/90 shadow-[0_0_20px_rgba(168,85,247,0.15)] hover:bg-zinc-900 transition-all duration-200 cursor-pointer group'
              >
                <div className='absolute -top-3 right-4 bg-gradient-to-r from-purple-600 to-pink-600 text-[9px] font-black uppercase tracking-widest text-white px-2.5 py-0.5 rounded-full border border-purple-400 shadow-md'>
                  Recommended Boost
                </div>
                <div className='flex items-center gap-3'>
                  <div className='w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform'>
                    <span className='text-sm font-black'>+{momentumBoost.parallelSlots}</span>
                  </div>
                  <div>
                    <p className='text-sm font-bold text-white group-hover:text-purple-300 transition-colors'>
                      {momentumBoost.name}
                    </p>
                    <p className='text-[10px] text-zinc-500'>
                      Triples your speed. Launch 2 extra applications in parallel now.
                    </p>
                  </div>
                </div>
                <div className='text-right shrink-0'>
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
                className='flex items-center justify-between p-4 rounded-xl border border-white/5 bg-zinc-900/40 hover:bg-zinc-900/80 hover:border-purple-500/20 transition-all duration-200 cursor-pointer group'
              >
                <div className='flex items-center gap-3'>
                  <div className='w-8 h-8 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400 group-hover:scale-105 transition-transform'>
                    <span className='text-sm font-black'>+{scaleBoost.parallelSlots}</span>
                  </div>
                  <div>
                    <p className='text-sm font-bold text-zinc-300 group-hover:text-purple-300 transition-colors'>
                      {scaleBoost.name}
                    </p>
                    <p className='text-[10px] text-zinc-500'>
                      Unleash 4 parallel slots. Clear your queue before roles close.
                    </p>
                  </div>
                </div>
                <div className='text-right shrink-0'>
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
                className='flex items-center justify-between p-4 rounded-xl border border-white/5 bg-zinc-900/40 hover:bg-zinc-900/80 hover:border-purple-500/20 transition-all duration-200 cursor-pointer group'
              >
                <div className='flex items-center gap-3'>
                  <div className='w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform'>
                    <Crown className='w-4 h-4' />
                  </div>
                  <div>
                    <p className='text-sm font-bold text-zinc-300 group-hover:text-purple-300 transition-colors'>
                      Upgrade to Ultimate
                    </p>
                    <p className='text-[10px] text-zinc-500'>
                      8 base slots + 3,500 credits/mo + Priority Autopilot.
                    </p>
                  </div>
                </div>
                <div className='text-right shrink-0'>
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
              className='h-12 w-full rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-sm font-extrabold text-white shadow-[0_0_24px_rgba(168,85,247,0.35)] transition-all hover:brightness-110 hover:shadow-[0_0_32px_rgba(168,85,247,0.45)] sm:text-base'
            >
              Get Ahead of Other Applicants
            </Button>
            <button
              type='button'
              onClick={handleClose}
              className='w-full py-2 text-center text-xs font-semibold text-zinc-500 hover:text-zinc-400 transition-colors'
            >
              No thanks, I will let my applications sit paused
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
