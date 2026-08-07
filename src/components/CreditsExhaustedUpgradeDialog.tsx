import { useCallback, useMemo } from "react";
import { Check, Sparkles, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BILLING_PLAN_DEFINITIONS } from "@/lib/billingCatalog";
import type { CreditBalance } from "@/types/credits";

const STORAGE_KEY = "jobraker_exhausted_credits_promo_snooze_until";
const DISMISS_MS = 1000 * 60 * 60 * 18;

type PlanName = "Free" | "Starter" | "Basics" | "Pro" | "Ultimate";

type CreditsExhaustedUpgradeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balance: CreditBalance | null;
  currentPlan: PlanName | null;
  onExplorePlans: () => void;
  onExplorePacks: () => void;
};

export function readExhaustedCreditsSnoozeUntil() {
  if (typeof window === "undefined") return 0;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    const until = Number.parseInt(value || "", 10);
    return Number.isFinite(until) ? until : 0;
  } catch {
    return 0;
  }
}

function snoozeExhaustedCreditsPrompt() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now() + DISMISS_MS));
  } catch {
    // Storage is optional; closing the dialog still works when it is unavailable.
  }
}

function getRecommendedPlanNames(currentPlan: PlanName | null) {
  if (currentPlan === "Basics") return ["Pro", "Ultimate"] as const;
  if (currentPlan === "Pro") return ["Ultimate"] as const;
  if (currentPlan === "Ultimate") return [] as const;
  return ["Basics", "Pro"] as const;
}

export function CreditsExhaustedUpgradeDialog({
  open,
  onOpenChange,
  balance,
  currentPlan,
  onExplorePlans,
  onExplorePacks,
}: CreditsExhaustedUpgradeDialogProps) {
  const recommendedPlans = useMemo(() => {
    const names = getRecommendedPlanNames(currentPlan);
    return names
      .map((name) => BILLING_PLAN_DEFINITIONS.find((plan) => plan.name === name))
      .filter((plan): plan is (typeof BILLING_PLAN_DEFINITIONS)[number] => Boolean(plan));
  }, [currentPlan]);

  const handleClose = useCallback(() => {
    snoozeExhaustedCreditsPrompt();
    onOpenChange(false);
  }, [onOpenChange]);

  const usedCredits = Math.max(0, Number(balance?.totalConsumed) || 0);
  const currentPlanLabel = currentPlan || "Free";
  const showsCreditPackPath = currentPlan === "Ultimate";

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : handleClose())}
    >
      <DialogContent
        hideCloseButton
        className='max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl gap-0 overflow-y-auto border border-brand/30 bg-background p-0 text-foreground shadow-[0_28px_90px_-26px_rgba(0,0,0,0.9)] sm:rounded-2xl'
      >
        <DialogTitle className='sr-only'>Your Jobraker credits are exhausted</DialogTitle>
        <DialogDescription className='sr-only'>
          Compare the Jobraker options that add more automation capacity, or continue without upgrading.
        </DialogDescription>

        <div className='relative flex items-start gap-3 border-b border-brand/20 bg-gradient-to-br from-brand/[0.13] via-background to-background px-5 pb-5 pt-6 sm:px-6'>
          <div className='pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-brand/15 blur-3xl' />
          <div className='relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-brand'>
            <Sparkles className='h-5 w-5' aria-hidden />
          </div>
          <div className='relative min-w-0 flex-1 pr-5'>
            <p className='text-[10px] font-semibold uppercase tracking-[0.22em] text-brand/85'>
              Credit limit reached · {usedCredits.toLocaleString()} used
            </p>
            <h2 className='mt-1 text-xl font-semibold tracking-tight text-white'>
              Keep your job search moving
            </h2>
            <p className='mt-1.5 text-sm leading-6 text-gray-400'>
              Your {currentPlanLabel} plan has no automation credits left. Choose more monthly capacity or add a credit pack when you need it.
            </p>
          </div>
          <button
            type='button'
            onClick={handleClose}
            className='relative -mr-1 -mt-1 rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50'
            aria-label='Dismiss credit upgrade options'
          >
            <X className='h-4 w-4' />
          </button>
        </div>

        <div className='px-5 py-5 sm:px-6'>
          {showsCreditPackPath ? (
            <div className='rounded-xl border border-brand/25 bg-brand/[0.06] p-5'>
              <p className='text-sm font-semibold text-white'>Your Ultimate plan is already active</p>
              <p className='mt-1.5 text-sm leading-6 text-gray-400'>
                Add a credit pack to continue your current workflow without changing your subscription.
              </p>
              <Button
                type='button'
                onClick={() => {
                  onExplorePacks();
                  handleClose();
                }}
                className='mt-5 w-full bg-brand font-semibold text-black hover:bg-brand/90 sm:w-auto'
              >
                Explore credit packs
              </Button>
            </div>
          ) : (
            <div className={`grid gap-3 ${recommendedPlans.length > 1 ? "sm:grid-cols-2" : "max-w-sm"}`}>
              {recommendedPlans.map((plan) => {
                const highlighted = plan.name === "Pro";
                return (
                  <section
                    key={plan.tier}
                    className={`relative rounded-xl border p-4 ${
                      highlighted
                        ? "border-brand/45 bg-brand/[0.075] shadow-[0_16px_42px_-32px_rgba(47,217,104,0.8)]"
                        : "border-white/[0.1] bg-white/[0.025]"
                    }`}
                  >
                    {highlighted ? (
                      <span className='absolute -top-2 right-3 rounded-full border border-brand/30 bg-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-black'>
                        Recommended
                      </span>
                    ) : null}
                    <p className='text-base font-semibold text-white'>{plan.name}</p>
                    <div className='mt-1 flex items-baseline gap-1'>
                      <span className='text-3xl font-semibold tracking-tight text-white'>${plan.monthlyPriceUsd}</span>
                      <span className='text-xs text-gray-500'>/ month</span>
                    </div>
                    <p className='mt-1.5 text-xs text-brand'>{plan.creditsPerMonth.toLocaleString()} automation credits / month</p>
                    <ul className='mt-4 space-y-2'>
                      {plan.marketingFeatures.slice(0, 3).map((feature) => (
                        <li key={feature} className='flex items-start gap-2 text-xs leading-5 text-gray-300'>
                          <Check className='mt-0.5 h-3.5 w-3.5 shrink-0 text-brand' strokeWidth={2.5} aria-hidden />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      type='button'
                      variant={highlighted ? "default" : "outline"}
                      onClick={() => {
                        onExplorePlans();
                        handleClose();
                      }}
                      className={`mt-5 w-full font-semibold ${
                        highlighted
                          ? "bg-brand text-black hover:bg-brand/90"
                          : "border-white/[0.14] text-gray-100 hover:border-brand/40 hover:bg-brand/10 hover:text-brand"
                      }`}
                    >
                      Explore {plan.name}
                    </Button>
                  </section>
                );
              })}
            </div>
          )}
        </div>

        <div className='flex flex-col gap-3 border-t border-white/[0.08] bg-white/[0.02] px-5 py-3.5 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-6'>
          <span>Paid plans can be changed or cancelled from Billing.</span>
          <button
            type='button'
            onClick={() => {
              onExplorePlans();
              handleClose();
            }}
            className='w-fit text-gray-300 underline-offset-4 transition-colors hover:text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50'
          >
            Compare all plans →
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
