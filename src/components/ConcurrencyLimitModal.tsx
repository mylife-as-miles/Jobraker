import { useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Rocket, Zap, Crown, X, Check, ShieldAlert } from "lucide-react";
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

  // Find relevant plan upgrades (higher than current plan)
  const isBasics = currentTier === "Basics";
  const isPro = currentTier === "Pro";
  const isFree = currentTier === "Free" || !currentTier;

  const planUpgrades = BILLING_PLAN_DEFINITIONS.filter((p) => {
    if (isFree) return p.name === "Basics" || p.name === "Pro" || p.name === "Ultimate";
    if (isBasics) return p.name === "Pro" || p.name === "Ultimate";
    if (isPro) return p.name === "Ultimate";
    return false;
  });

  // Take top boosts
  const popularBoosts = BILLING_CONCURRENCY_PACK_DEFINITIONS.slice(0, 3);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : handleClose())}
    >
      <DialogContent
        hideCloseButton
        className='max-w-[min(100%,480px)] overflow-hidden gap-0 border border-purple-500/25 bg-zinc-950 p-0 text-foreground shadow-[0_0_0_1px_rgba(168,85,247,0.15),0_25px_80px_-20px_rgba(0,0,0,0.85)] sm:rounded-2xl'
      >
        <DialogTitle className='sr-only'>
          Parallel slots limit reached
        </DialogTitle>
        <DialogDescription className='sr-only'>
          You are currently using all available parallel slots for auto-apply. Upgrade your plan or buy a concurrency boost.
        </DialogDescription>

        {/* Top Header Bar */}
        <div className='flex items-center justify-between gap-3 border-b border-white/10 bg-black/40 px-4 py-3'>
          <div className='flex min-w-0 items-center gap-2'>
            <ShieldAlert className='h-4 w-4 shrink-0 text-purple-400' aria-hidden />
            <span className='truncate text-xs font-semibold text-white/95 sm:text-sm'>
              Active Parallel Runs: {activeRuns} / {totalLimit} Slots
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

        {/* Modal body */}
        <div className='space-y-6 px-6 pb-6 pt-6'>
          <div className='flex justify-center'>
            <div
              className={cn(
                "relative flex h-16 w-16 items-center justify-center rounded-2xl",
                "bg-gradient-to-br from-purple-600 to-indigo-700",
                "shadow-[0_0_40px_-8px_rgba(168,85,247,0.75)]",
                "ring-2 ring-purple-400/40",
              )}
            >
              <Zap
                className='h-8 w-8 text-white drop-shadow-md'
                strokeWidth={2}
              />
            </div>
          </div>

          <div className='space-y-1.5 text-center'>
            <p className='text-lg font-extrabold uppercase leading-tight tracking-tight text-purple-400 sm:text-xl'>
              Parallel Limits Reached
            </p>
            <p className='text-sm text-zinc-400'>
              All parallel auto-apply slots allowed under your plan are currently running. Increase your throughput to apply faster!
            </p>
          </div>

          {/* Pricing Options Grid */}
          <div className='space-y-4'>
            {/* Option A: Plan Upgrades (if there are upgrades available) */}
            {planUpgrades.length > 0 && (
              <div className='space-y-2'>
                <span className='text-xs font-bold uppercase tracking-wider text-zinc-500'>
                  Upgrade Plan (More Base Slots)
                </span>
                <div className='grid gap-2'>
                  {planUpgrades.map((plan) => {
                    const planIcon = plan.name === "Ultimate" ? <Crown className="w-3.5 h-3.5 text-yellow-400" /> : <Rocket className="w-3.5 h-3.5 text-blue-400" />;
                    return (
                      <div
                        key={plan.tier}
                        onClick={() => {
                          onUpgrade("subscription");
                          handleClose();
                        }}
                        className='flex items-center justify-between p-3 rounded-xl border border-white/5 bg-zinc-900/60 hover:bg-zinc-900 hover:border-purple-500/30 transition-all duration-200 cursor-pointer group'
                      >
                        <div className='flex items-center gap-2'>
                          {planIcon}
                          <div>
                            <p className='text-sm font-bold text-white group-hover:text-purple-300 transition-colors'>
                              {plan.name} Plan
                            </p>
                            <p className='text-[11px] text-zinc-500'>
                              {plan.autoApplyConcurrency} parallel runs • {plan.autoApplyRunsPerMonth} runs/mo
                            </p>
                          </div>
                        </div>
                        <div className='text-right'>
                          <p className='text-sm font-bold text-white'>
                            ${plan.monthlyPriceUsd}/mo
                          </p>
                          <p className='text-[10px] text-purple-400 flex items-center gap-0.5 justify-end'>
                            Select <Check className='w-2.5 h-2.5' />
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Option B: Concurrency Boosts (Instant Addon Slots) */}
            <div className='space-y-2'>
              <span className='text-xs font-bold uppercase tracking-wider text-zinc-500'>
                Buy Concurrency Boost (No Subscription Needed)
              </span>
              <div className='grid gap-2'>
                {popularBoosts.map((boost) => (
                  <div
                    key={boost.sku}
                    onClick={() => {
                      onUpgrade("boosts");
                      handleClose();
                    }}
                    className='flex items-center justify-between p-3 rounded-xl border border-white/5 bg-zinc-900/60 hover:bg-zinc-900 hover:border-purple-500/30 transition-all duration-200 cursor-pointer group'
                  >
                    <div className='flex items-center gap-2'>
                      <div className='w-6 h-6 rounded bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:bg-purple-500/20 transition-colors'>
                        <span className='text-xs font-black'>+{boost.parallelSlots}</span>
                      </div>
                      <div>
                        <p className='text-sm font-bold text-white group-hover:text-purple-300 transition-colors'>
                          {boost.name}
                        </p>
                        <p className='text-[11px] text-zinc-500'>
                          Add {boost.parallelSlots} extra parallel slot{boost.parallelSlots > 1 ? 's' : ''} instantly
                        </p>
                      </div>
                    </div>
                    <div className='text-right'>
                      <p className='text-sm font-bold text-white'>
                        ${boost.priceUsd}
                      </p>
                      <p className='text-[10px] text-purple-400 flex items-center gap-0.5 justify-end'>
                        Buy Pack <Check className='w-2.5 h-2.5' />
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Action Button */}
          <Button
            type='button'
            onClick={() => {
              onUpgrade("boosts");
              handleClose();
            }}
            className='h-11 w-full rounded-xl bg-purple-600 text-sm font-bold text-white shadow-[0_0_24px_rgba(168,85,247,0.35)] transition-all hover:bg-purple-500 hover:shadow-[0_0_32px_rgba(168,85,247,0.45)] sm:text-base'
          >
            Upgrade Concurrency Slots
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
