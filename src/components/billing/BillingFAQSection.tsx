"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, HelpCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const BILLING_FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: "What are credits and what spends them?",
    answer:
      "Credits power search, AI evaluation, resume and cover-letter drafting, chat, and other metered features. Each action deducts credits according to the live Credit Costs list on this page. Governed auto-apply uses separate monthly run allowances on paid plans, not credits, unless a flow explicitly charges credits.",
  },
  {
    question:
      "What is the difference between a subscription and a credit pack?",
    answer:
      "A subscription sets your tier (Basics, Pro, or Ultimate), your monthly credit allowance, governed auto-apply runs, and your billing cadence. Credit packs are one-time top-ups that add to your balance immediately and never change your tier or automation limits.",
  },
  {
    question: "How do monthly, quarterly, and annual billing work?",
    answer:
      "Monthly charges you each month. Quarterly (Pro and Ultimate only) bills every three months at a discount versus three separate monthly payments. Annual bills once per year at the lowest effective monthly rate. Basics supports monthly and annual only. Features are the same; only the payment schedule and price differ.",
  },
  {
    question:
      'Why does my plan say "credits per month" if I pay quarterly or yearly?',
    answer:
      "That number is your monthly usage allowance while the subscription is active—not how often you are charged. You still receive that many credits per calendar month (or per your plan’s refill rules), even when you pay for a quarter or year upfront.",
  },
  {
    question: 'What does the "Next payment" date mean?',
    answer:
      "It is when your current subscription term renews and the next charge is due, based on your billing cadence (monthly, quarterly, or annual). It is not necessarily the same moment as every credit refill, which may follow a separate schedule.",
  },
  {
    question: "How does Ultimate pricing scale with the credit slider?",
    answer:
      "Ultimate’s price and included credits scale together from the catalog base (3,500 credits / month). Higher credit targets increase checkout price and auto-apply runs in proportion so capacity stays aligned with what you pay.",
  },
  {
    question: "How does checkout and currency work?",
    answer:
      "Checkout is processed securely through our payment provider. Prices are based on USD plan amounts and converted for collection at checkout using the configured exchange rate. You complete payment on the provider’s page, then return to JobRaker when finished.",
  },
  {
    question: "Can I cancel my subscription?",
    answer:
      "Yes. You can cancel from your account or billing settings according to your plan’s terms. You typically keep access through the end of the period you already paid for. Exact behavior depends on how cancellation is configured for your account—check your dashboard or contact support if you need help.",
  },
  {
    question: "Can I upgrade or change plans later?",
    answer:
      "You can move to a higher tier or different billing cadence by starting checkout for the plan you want. If you already have an active subscription, the new purchase may replace or adjust the old one per our backend rules; refresh billing after paying or ask support if something looks off.",
  },
  {
    question: "What are governed auto-apply runs?",
    answer:
      "They are monthly allowances for automation that fills and submits applications under guardrails you set (e.g., review-first modes). Runs are separate from search/AI credits; each tier lists how many runs you get per month.",
  },
  {
    question: "What does a concurrency boost change?",
    answer:
      "A concurrency boost raises how many auto-apply workflows can be active at the same time. It does not replace your monthly auto-apply run allowance or search/AI credits; it only increases the parallel cap so you can launch more automation at once.",
  },
  {
    question: "How long do purchased concurrency boosts last?",
    answer:
      "Concurrency boosts are applied to the current billing period tied to your subscription window. If you buy one while on Free or without an active paid term, the boost is applied for a monthly window starting at purchase verification.",
  },
  {
    question: "Do credit packs expire?",
    answer:
      "Purchased credits are added to your balance and used as you consume features. We do not advertise a separate expiry for pack top-ups in-product; if you have compliance or accounting questions, contact support for your account’s policy.",
  },
  {
    question: "What if a payment fails?",
    answer:
      "Failed charges may leave your subscription past due or paused depending on provider status. Update your payment method and retry, or contact support with your transaction reference so we can trace the attempt.",
  },
  {
    question: "Where can I see my billing history?",
    answer:
      "Use the History tab on this page for credit movements. For provider receipts or invoices, use the confirmation from your payment method or email; we can help locate a charge if you share the reference.",
  },
  {
    question: "Is my payment information stored on JobRaker?",
    answer:
      "Card and bank details are handled by the payment processor, not stored in full on our servers. We store what is needed to link your user to an active plan and credit balance.",
  },
];

export function BillingFAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className='mt-16 border-t border-foreground/10 pt-14'
      aria-labelledby='billing-faq-heading'
    >
      <Card className='border-foreground/10 bg-foreground/[0.02] backdrop-blur-md overflow-hidden'>
        <CardHeader className='border-b border-foreground/10 bg-foreground/[0.02] pb-6'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
            <div className='flex gap-3'>
              <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand/25 bg-brand/10'>
                <HelpCircle className='h-5 w-5 text-brand' aria-hidden />
              </div>
              <div>
                <CardTitle
                  id='billing-faq-heading'
                  className='text-xl font-bold text-foreground sm:text-2xl'
                >
                  Billing & credits FAQ
                </CardTitle>
                <CardDescription className='mt-1.5 text-sm text-muted-foreground max-w-2xl leading-relaxed'>
                  Common questions about plans, credits, checkout, and
                  subscriptions. For account-specific issues, contact support
                  with your email and any payment reference.
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className='p-4 sm:p-6'>
          <div className='space-y-2 sm:space-y-3'>
            {BILLING_FAQ_ITEMS.map((item, i) => {
              const isOpen = openIndex === i;
              return (
                <div
                  key={i}
                  className='rounded-xl border border-foreground/10 bg-foreground/[0.02] overflow-hidden transition-colors hover:border-foreground/15'
                >
                  <button
                    type='button'
                    id={`billing-faq-q-${i}`}
                    aria-expanded={isOpen}
                    aria-controls={`billing-faq-a-${i}`}
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    className='flex w-full items-center justify-between gap-4 px-4 py-4 text-left sm:px-5'
                  >
                    <span className='text-sm font-semibold text-foreground sm:text-base leading-snug pr-2'>
                      {item.question}
                    </span>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-brand transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                      aria-hidden
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen ? (
                      <motion.div
                        id={`billing-faq-a-${i}`}
                        role='region'
                        aria-labelledby={`billing-faq-q-${i}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                        className='overflow-hidden border-t border-foreground/5'
                      >
                        <p className='px-4 pb-4 pt-3 text-sm leading-relaxed text-muted-foreground sm:px-5 sm:pb-5'>
                          {item.answer}
                        </p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.section>
  );
}
