"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PricingPlan {
  name: string;
  price: string;
  yearlyPrice: string;
  period: string;
  features: Array<string | { name: string; value?: string; included?: boolean }>;
  description: string;
  buttonText: string;
  href: string;
  isPopular: boolean;
}

interface PricingProps {
  plans: PricingPlan[];
  title?: string;
  description?: string;
  annualSavingsLabel?: string;
  onBillingToggle?: (interval: "monthly" | "yearly") => void;
  onPlanClick?: (
    plan: PricingPlan,
    interval: "monthly" | "yearly",
  ) => void;
  getPlanHref?: (
    plan: PricingPlan,
    interval: "monthly" | "yearly",
  ) => string;
}

export function Pricing({
  plans,
  title = "Simple, Transparent Pricing",
  description = "Choose the plan that works for you\nAll plans include access to our platform, lead generation tools, and dedicated support.",
  annualSavingsLabel = "Save up to 30%",
  onBillingToggle,
  onPlanClick,
  getPlanHref,
}: PricingProps) {
  const [isMonthly, setIsMonthly] = useState(true);
  const selectedInterval = isMonthly ? "monthly" : "yearly";

  return (
    <div className='container py-20'>
      <div className='mb-12 space-y-4 text-center'>
        <h2 className='text-4xl font-bold tracking-tight text-foreground sm:text-5xl'>
          {title}
        </h2>
        <p className='whitespace-pre-line text-lg text-neutral-400'>
          {description}
        </p>
      </div>

      <div className='mb-10 flex justify-center'>
        <div
          className='inline-flex items-center rounded-full border border-brand/25 bg-[#090b0f] p-1 shadow-[inset_0_0_0_1px_rgba(29,255,0,0.06)]'
          aria-label='Billing period'
        >
          <button
            type='button'
            aria-pressed={isMonthly}
            onClick={() => {
              setIsMonthly(true);
              onBillingToggle?.("monthly");
            }}
            className={cn(
              "h-9 rounded-full px-4 text-sm font-semibold transition-all duration-200 active:scale-[0.98]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-black",
              isMonthly
                ? "bg-brand text-black shadow-[0_0_18px_rgba(29,255,0,0.26)]"
                : "text-neutral-400 hover:text-foreground",
            )}
          >
            Monthly
          </button>
          <button
            type='button'
            aria-pressed={!isMonthly}
            onClick={() => {
              setIsMonthly(false);
              onBillingToggle?.("yearly");
            }}
            className={cn(
              "h-9 rounded-full px-4 text-sm font-semibold transition-all duration-200 active:scale-[0.98]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-black",
              !isMonthly
                ? "bg-brand text-black shadow-[0_0_18px_rgba(29,255,0,0.26)]"
                : "text-neutral-400 hover:text-foreground",
            )}
          >
            Annual{" "}
            <span className='text-inherit opacity-75'>{annualSavingsLabel}</span>
          </button>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4'>
        {plans.map((plan, index) => (
          <motion.div
            key={plan.name}
            initial={{ y: 50, opacity: 1 }}
            whileInView={{
              y: plan.isPopular ? -20 : 0,
              opacity: 1,
              scale: plan.isPopular ? 1.01 : 1,
            }}
            viewport={{ once: true }}
            transition={{
              duration: 1.6,
              type: "spring",
              stiffness: 100,
              damping: 30,
              delay: index * 0.08,
              opacity: { duration: 0.5 },
            }}
            className={cn(
              "relative flex flex-col rounded-2xl border-[1px] bg-background p-6 text-center",
              plan.isPopular
                ? "z-10 border-2 border-brand shadow-[0_0_34px_rgba(29,255,0,0.16)]"
                : "z-0 border-brand/20 hover:border-brand/35",
              !plan.isPopular && "mt-5",
            )}
          >
            {plan.isPopular ? (
              <div className='absolute right-0 top-0 flex items-center rounded-bl-xl rounded-tr-xl bg-brand px-2 py-0.5'>
                <Star className='h-4 w-4 fill-current text-black' />
                <span className='ml-1 font-sans font-semibold text-black'>
                  Popular
                </span>
              </div>
            ) : null}

            <div className='flex flex-1 flex-col'>
              <p className='text-base font-semibold text-brand/70'>{plan.name}</p>
              <div className='mt-6 flex items-center justify-center gap-x-2'>
                <span className='text-5xl font-bold tracking-tight text-foreground'>
                  ${isMonthly ? plan.price : plan.yearlyPrice}
                </span>
                <span className='text-sm font-semibold leading-6 tracking-wide text-neutral-400'>
                  / {plan.period}
                </span>
              </div>

              <p className='text-xs leading-5 text-neutral-500'>
                {isMonthly ? "billed monthly" : "billed annually"}
              </p>

              <ul className='mt-5 flex flex-col gap-2'>
                {plan.features.map((feature, idx) => {
                  const featureName =
                    typeof feature === "string" ? feature : feature.name;
                  const featureValue =
                    typeof feature === "object" ? feature.value : null;
                  const isIncluded =
                    typeof feature === "object"
                      ? feature.included !== false
                      : true;

                  if (!isIncluded) return null;

                  return (
                    <li key={`${plan.name}-${idx}`} className='flex items-start gap-2'>
                      <Check className='mt-1 h-4 w-4 flex-shrink-0 text-brand' />
                      <span className='text-left'>
                        {featureName}
                        {featureValue ? (
                          <span className='ml-1 text-neutral-400'>
                            - {featureValue}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <hr className='my-4 w-full border-brand/10' />

              <Button
                onClick={() => {
                  onPlanClick?.(plan, selectedInterval);
                  window.location.href =
                    getPlanHref?.(plan, selectedInterval) ?? plan.href;
                }}
                variant='outline'
                className={cn(
                  "group relative w-full gap-2 overflow-hidden text-lg font-semibold tracking-tighter",
                  "transform-gpu ring-offset-current transition-all duration-300 ease-out hover:bg-brand hover:text-black hover:ring-2 hover:ring-brand hover:ring-offset-1 hover:ring-offset-black",
                  plan.isPopular
                    ? "!border-brand !bg-brand !text-black"
                    : "!border-brand/40 !bg-background !text-brand",
                )}
              >
                {plan.buttonText}
              </Button>

              <p className='mt-6 text-xs leading-5 text-neutral-500'>
                {plan.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
