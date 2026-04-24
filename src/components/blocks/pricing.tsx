"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Check, Star } from "lucide-react";
import { useState } from "react";

interface PricingPlan {
  name: string;
  price: string;
  yearlyPrice: string;
  period: string;
  features: any[];
  description: string;
  buttonText: string;
  href: string;
  isPopular: boolean;
}

interface PricingProps {
  plans: PricingPlan[];
  title?: string;
  description?: string;
}

export function Pricing({
  plans,
  title = "Simple, Transparent Pricing",
  description = "Choose the plan that works for you\nAll plans include access to our platform, lead generation tools, and dedicated support.",
}: PricingProps) {
  const [isMonthly, setIsMonthly] = useState(true);

  return (
    <div className='container py-20'>
      <div className='text-center space-y-4 mb-12'>
        <h2 className='text-4xl font-bold tracking-tight sm:text-5xl text-foreground'>
          {title}
        </h2>
        <p className='text-neutral-400 text-lg whitespace-pre-line'>
          {description}
        </p>
      </div>

      <div className='flex justify-center mb-10'>
        <div
          className='inline-flex items-center rounded-full border border-brand/25 bg-[#090b0f] p-1 shadow-[inset_0_0_0_1px_rgba(29,255,0,0.06)]'
          aria-label='Billing period'
        >
          <button
            type='button'
            aria-pressed={isMonthly}
            onClick={() => setIsMonthly(true)}
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
            onClick={() => setIsMonthly(false)}
            className={cn(
              "h-9 rounded-full px-4 text-sm font-semibold transition-all duration-200 active:scale-[0.98]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-black",
              !isMonthly
                ? "bg-brand text-black shadow-[0_0_18px_rgba(29,255,0,0.26)]"
                : "text-neutral-400 hover:text-foreground",
            )}
          >
            Annual <span className='text-inherit opacity-75'>Save 20%</span>
          </button>
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4'>
        {plans.map((plan, index) => (
          <motion.div
            key={index}
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
              delay: 0.4,
              opacity: { duration: 0.5 },
            }}
            className={cn(
              `rounded-2xl border-[1px] p-6 bg-background text-center lg:flex lg:flex-col lg:justify-center relative`,
              plan.isPopular
                ? "border-brand border-2 shadow-[0_0_34px_rgba(29,255,0,0.16)]"
                : "border-brand/20 hover:border-brand/35",
              "flex flex-col",
              !plan.isPopular && "mt-5",
              plan.isPopular ? "z-10" : "z-0",
            )}
          >
            {plan.isPopular && (
              <div className='absolute top-0 right-0 bg-brand py-0.5 px-2 rounded-bl-xl rounded-tr-xl flex items-center'>
                <Star className='text-black h-4 w-4 fill-current' />
                <span className='text-black ml-1 font-sans font-semibold'>
                  Popular
                </span>
              </div>
            )}
            <div className='flex-1 flex flex-col'>
              <p className='text-base font-semibold text-brand/70'>
                {plan.name}
              </p>
              <div className='mt-6 flex items-center justify-center gap-x-2'>
                <span className='text-5xl font-bold tracking-tight text-foreground'>
                  ${isMonthly ? plan.price : plan.yearlyPrice}
                </span>
                {plan.period !== "Next 3 months" && (
                  <span className='text-sm font-semibold leading-6 tracking-wide text-neutral-400'>
                    / {plan.period}
                  </span>
                )}
              </div>

              <p className='text-xs leading-5 text-neutral-500'>
                {isMonthly ? "billed monthly" : "billed annually"}
              </p>

              <ul className='mt-5 gap-2 flex flex-col'>
                {plan.features.map((feature: any, idx: number) => {
                  // Handle both old string format and new object format
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
                    <li key={idx} className='flex items-start gap-2'>
                      <Check className='h-4 w-4 text-brand mt-1 flex-shrink-0' />
                      <span className='text-left'>
                        {featureName}
                        {featureValue && (
                          <span className='text-neutral-400 ml-1'>
                            • {featureValue}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <hr className='w-full my-4 border-brand/10' />

              <Button
                onClick={() => (window.location.href = plan.href)}
                variant='outline'
                className={cn(
                  "group relative w-full gap-2 overflow-hidden text-lg font-semibold tracking-tighter",
                  "transform-gpu ring-offset-current transition-all duration-300 ease-out hover:ring-2 hover:ring-brand hover:ring-offset-1 hover:ring-offset-black hover:bg-brand hover:text-black",
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
