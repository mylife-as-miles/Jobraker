import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { createClient } from "@/lib/supabaseClient";
import { captureClientEvent, captureServerEvent } from "@/lib/analytics";
import {
  Coins,
  Crown,
  Zap,
  ArrowRight,
  Calendar,
  History,
  TrendingUp,
  Sparkles,
  Package,
  Check,
  Star,
  ArrowUpRight,
  ArrowDownLeft,
  Download,
  Shield,
  Infinity,
  Target,
  Loader2,
  Receipt,
  Percent,
  Rocket,
  Gauge,
  Layers3,
  Clock3,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/toast";
import {
  BILLING_CONCURRENCY_PACK_DEFINITIONS,
  BILLING_CREDIT_PACK_DEFINITIONS,
  BILLING_PLAN_DEFINITIONS,
} from "@/lib/billingCatalog";
import { BillingFAQSection } from "@/components/billing/BillingFAQSection";
import {
  LOW_CREDIT_RESCUE_CODE,
  LOW_CREDIT_RESCUE_DISCOUNT_PCT,
  LOW_CREDIT_RESCUE_MULTIPLIER,
  ensureLowCreditRescueExpiry,
  isLowCreditRescueCode,
} from "@/lib/lowCreditRescuePromo";

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  credits_per_month: number;
  auto_apply_monthly_limit?: number;
  auto_apply_concurrency?: number;
  description: string;
  features: Array<
    | string
    | {
        name: string;
        value?: string;
        included?: boolean;
      }
  >;
}

interface CreditTransaction {
  id: string;
  transaction_type?: string;
  type?: string;
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
  agent_run_id?: string | null;
}

interface CreditPack {
  sku: string;
  name: string;
  description: string;
  credits: number;
  price_usd: number;
  bonus_credits: number;
  is_popular?: boolean;
}

interface ConcurrencyPack {
  sku: string;
  name: string;
  description: string;
  parallel_slots: number;
  price_usd: number;
  is_popular?: boolean;
}

const defaultCreditPacks: CreditPack[] = BILLING_CREDIT_PACK_DEFINITIONS.map(
  (pack) => ({
    sku: pack.sku,
    name: pack.name,
    description: pack.description,
    credits: pack.credits,
    price_usd: pack.priceUsd,
    bonus_credits: pack.bonusCredits,
    is_popular: pack.isPopular,
  }),
);

const defaultPlans: SubscriptionPlan[] = BILLING_PLAN_DEFINITIONS.map(
  (plan) => ({
    id: plan.tier.toLowerCase(),
    name: plan.name,
    price: plan.monthlyPriceUsd,
    credits_per_month: plan.creditsPerMonth,
    auto_apply_monthly_limit: plan.autoApplyRunsPerMonth,
    auto_apply_concurrency: plan.autoApplyConcurrency,
    description: plan.description,
    features: plan.marketingFeatures,
  }),
);

const defaultConcurrencyPacks: ConcurrencyPack[] =
  BILLING_CONCURRENCY_PACK_DEFINITIONS.map((pack) => ({
    sku: pack.sku,
    name: pack.name,
    description: pack.description,
    parallel_slots: pack.parallelSlots,
    price_usd: pack.priceUsd,
    is_popular: pack.isPopular,
  }));

type BillingInterval = "monthly" | "quarterly" | "yearly";

function normalizeCreditTransaction(
  transaction: CreditTransaction,
): CreditTransaction {
  return {
    ...transaction,
    transaction_type:
      transaction.transaction_type ?? transaction.type ?? "refill",
    agent_run_id: transaction.agent_run_id ?? null,
  };
}

function planSupportsQuarterly(planName: string): boolean {
  return planName === "Pro" || planName === "Ultimate";
}

/** Basics/Free have no quarterly SKU — checkout and displayed price use monthly. */
function effectiveBillingCycleForPlan(
  planName: string,
  interval: BillingInterval,
): BillingInterval {
  if (interval === "quarterly" && !planSupportsQuarterly(planName)) {
    return "monthly";
  }
  return interval;
}

type PlanPricingDisplay = {
  headline: string;
  suffix: string;
  compareAt: string | null;
  subline: string | null;
  savingsBadge: string | null;
  effectiveMonthly: number | null;
};

/** Distinguish monthly vs annual subscriptions from billing period length (no DB column on user_subscriptions). */
/** Edge function `init-payment` expects `subscription_plans.id` (UUID), not catalog slugs like `basics`. */
const SUBSCRIPTION_PLAN_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveSubscriptionPlanUuidForCheckout(
  client: ReturnType<typeof createClient>,
  item: { id: string; name?: string },
): Promise<string | null> {
  if (SUBSCRIPTION_PLAN_UUID_RE.test(item.id)) return item.id;
  const name = item.name?.trim();
  if (!name) return null;
  const { data, error } = await client
    .from("subscription_plans")
    .select("id")
    .eq("is_active", true)
    .eq("name", name)
    .maybeSingle();
  if (error) {
    console.warn("resolveSubscriptionPlanUuidForCheckout", error);
    return null;
  }
  const row = data as { id?: string } | null;
  return row?.id ?? null;
}

function inferBillingCycleFromSubscriptionPeriod(
  start: string | null | undefined,
  end: string | null | undefined,
): "monthly" | "quarterly" | "yearly" | null {
  if (!start || !end) return null;
  const t0 = new Date(start).getTime();
  const t1 = new Date(end).getTime();
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) return null;
  const days = (t1 - t0) / (1000 * 60 * 60 * 24);
  if (days >= 200) return "yearly";
  if (days >= 75) return "quarterly";
  if (days >= 18) return "monthly";
  return null;
}

/**
 * If `current_period_end` is in the past, project it forward by the billing
 * interval (month / quarter / year) until it lands in the future.  This handles
 * the common case where the payment gateway renewed but the DB row was never
 * updated.
 */
function addCalendarMonths(d: Date, months: number): Date {
  const out = new Date(d.getTime());
  out.setMonth(out.getMonth() + months);
  return out;
}

function projectNextRenewalDate(
  periodEnd: string | null,
  cycle: "monthly" | "quarterly" | "yearly" | null,
): Date | null {
  if (!periodEnd) return null;
  const d = new Date(periodEnd);
  if (!Number.isFinite(d.getTime())) return null;
  const now = new Date();
  if (d > now) return d;
  const stepMonths = cycle === "yearly" ? 12 : cycle === "quarterly" ? 3 : 1;
  let projected = new Date(d);
  while (projected <= now) {
    projected = addCalendarMonths(projected, stepMonths);
  }
  return projected;
}

/** Explains the date shown in the billing card (next charge), not the monthly credit cron. */
function getPaymentRenewalCaption(
  cancelAtPeriodEnd: boolean,
  cycle: "monthly" | "quarterly" | "yearly" | null,
): { primary: string; secondary?: string } {
  if (cancelAtPeriodEnd) {
    return {
      primary:
        "Scheduled to end on this date. You will not be charged again after that.",
    };
  }
  if (cycle === "yearly") {
    return {
      primary:
        "Annual billing: your next charge is on this date. Cancel before then if you do not want another year.",
      secondary:
        "Per-month credits are your monthly allowance during the year, not separate monthly payments.",
    };
  }
  if (cycle === "quarterly") {
    return {
      primary:
        "Quarterly billing: your next charge is on this date. Cancel before then if you do not want another quarter.",
      secondary:
        "Per-month credits are your monthly allowance during the quarter, not separate monthly payments.",
    };
  }
  if (cycle === "monthly") {
    return {
      primary:
        "Monthly billing: your next charge is on this date. Cancel before then if you do not want another month.",
    };
  }
  return {
    primary: "Next charge is on this date unless you cancel beforehand.",
  };
}

function getPlanPricingDisplay(
  planName: string,
  interval: BillingInterval,
  fallbackMonthlyFromDb: number,
  promoApplied = false,
): PlanPricingDisplay {
  const def = BILLING_PLAN_DEFINITIONS.find((p) => p.name === planName);
  const originalMonthly = def?.monthlyPriceUsd ?? fallbackMonthlyFromDb;
  const monthly = promoApplied
    ? originalMonthly * LOW_CREDIT_RESCUE_MULTIPLIER
    : originalMonthly;

  if (!def || originalMonthly <= 0) {
    return {
      headline: "0",
      suffix: "",
      compareAt: null,
      subline: "No card required",
      savingsBadge: null,
      effectiveMonthly: null,
    };
  }

  const originalQuarterly = def.quarterlyPriceUsd ?? 0;
  const quarterlyUsd = promoApplied
    ? originalQuarterly * LOW_CREDIT_RESCUE_MULTIPLIER
    : originalQuarterly;
  const originalYearly = def.yearlyPriceUsd ?? 0;
  const yearly = promoApplied
    ? originalYearly * LOW_CREDIT_RESCUE_MULTIPLIER
    : originalYearly;

  if (interval === "quarterly" && originalQuarterly > 0) {
    const stacked = monthly * 3;
    const saved = stacked - quarterlyUsd;
    const pct = stacked > 0 ? Math.round((saved / stacked) * 100) : 40;
    const eqMo = quarterlyUsd / 3;
    const origStacked = originalMonthly * 3;
    return {
      headline: quarterlyUsd.toLocaleString("en-US", {
        maximumFractionDigits: 0,
      }),
      suffix: "/qtr",
      compareAt: promoApplied
        ? `Original: ${origStacked.toLocaleString("en-US")} (${originalQuarterly.toLocaleString("en-US")}/qtr)`
        : `3 x ${monthly}/mo -> ${stacked.toLocaleString("en-US")}`,
      subline: `Approx. ${Math.round(eqMo)}/mo equivalent, billed every 3 months`,
      savingsBadge: promoApplied
        ? `Rescue offer: ${LOW_CREDIT_RESCUE_DISCOUNT_PCT}% OFF applied`
        : `Save ${saved.toLocaleString("en-US")} (${pct}% vs monthly)`,
      effectiveMonthly: eqMo,
    };
  }

  if (interval === "yearly" && originalYearly > 0) {
    const stacked = monthly * 12;
    const saved = stacked - yearly;
    const pct = Math.round((saved / stacked) * 100);
    const eqMo = yearly / 12;
    const origStacked = originalMonthly * 12;
    return {
      headline: yearly.toLocaleString("en-US", { maximumFractionDigits: 0 }),
      suffix: "/yr",
      compareAt: promoApplied
        ? `Original: ${origStacked.toLocaleString("en-US")} (${originalYearly.toLocaleString("en-US")}/yr)`
        : `12 x ${monthly}/mo -> ${stacked.toLocaleString("en-US")}`,
      subline: `Approx. ${Math.round(eqMo)}/mo when paid annually`,
      savingsBadge: promoApplied
        ? `Rescue offer: ${LOW_CREDIT_RESCUE_DISCOUNT_PCT}% OFF applied`
        : `Save ${saved.toLocaleString("en-US")} (${pct}% vs monthly)`,
      effectiveMonthly: eqMo,
    };
  }

  return {
    headline: monthly.toLocaleString("en-US", { maximumFractionDigits: 0 }),
    suffix: "/mo",
    compareAt: promoApplied ? `Original: ${originalMonthly}/mo` : null,
    subline: promoApplied
      ? `Low-credit rescue: ${LOW_CREDIT_RESCUE_DISCOUNT_PCT}% OFF applied`
      : "Billed monthly, cancel anytime",
    savingsBadge: promoApplied ? "One-time rescue offer active" : null,
    effectiveMonthly: monthly,
  };
}
const ULTIMATE_CREDITS_SLIDER = { min: 3500, max: 10500, step: 500 } as const;

function getUltimatePricingDisplay(
  interval: BillingInterval,
  selectedCredits: number,
  fallbackMonthlyFromDb: number,
  promoApplied = false,
): PlanPricingDisplay {
  const def = BILLING_PLAN_DEFINITIONS.find((p) => p.name === "Ultimate");
  if (!def) {
    return getPlanPricingDisplay(
      "Ultimate",
      interval,
      fallbackMonthlyFromDb,
      promoApplied,
    );
  }
  const ratio = selectedCredits / def.creditsPerMonth;
  const originalMonthly = (def.monthlyPriceUsd ?? fallbackMonthlyFromDb) * ratio;
  const monthlyUsd = promoApplied
    ? originalMonthly * LOW_CREDIT_RESCUE_MULTIPLIER
    : originalMonthly;
  const originalQuarterlyBase = def.quarterlyPriceUsd ?? 0;
  const quarterlyBase = promoApplied
    ? originalQuarterlyBase * LOW_CREDIT_RESCUE_MULTIPLIER
    : originalQuarterlyBase;
  const originalYearlyBase = def.yearlyPriceUsd ?? 0;
  const yearlyBase = promoApplied
    ? originalYearlyBase * LOW_CREDIT_RESCUE_MULTIPLIER
    : originalYearlyBase;

  if (interval === "quarterly" && originalQuarterlyBase > 0) {
    const quarterly = Math.round(quarterlyBase * ratio * 100) / 100;
    const stacked = monthlyUsd * 3;
    const saved = stacked - quarterly;
    const pct = stacked > 0 ? Math.round((saved / stacked) * 100) : 40;
    const eqMo = quarterly / 3;

    const origQuarterly = Math.round(originalQuarterlyBase * ratio * 100) / 100;
    const origStacked = originalMonthly * 3;
    return {
      headline: quarterly.toLocaleString("en-US", { maximumFractionDigits: 0 }),
      suffix: "/qtr",
      compareAt: promoApplied
        ? `Original: ${Math.round(origStacked).toLocaleString("en-US")} (${Math.round(origQuarterly).toLocaleString("en-US")}/qtr)`
        : `3 x ${Math.round(monthlyUsd)}/mo -> ${Math.round(stacked).toLocaleString("en-US")}`,
      subline: `Approx. ${Math.round(eqMo)}/mo equivalent, billed every 3 months`,
      savingsBadge: promoApplied
        ? `Rescue offer: ${LOW_CREDIT_RESCUE_DISCOUNT_PCT}% OFF applied`
        : `Save ${Math.round(saved).toLocaleString("en-US")} (${pct}% vs monthly)`,
      effectiveMonthly: eqMo,
    };
  }

  if (interval === "yearly" && originalYearlyBase > 0) {
    const yearly = Math.round(yearlyBase * ratio);
    const stacked = monthlyUsd * 12;
    const saved = stacked - yearly;
    const pct = stacked > 0 ? Math.round((saved / stacked) * 100) : 0;
    const eqMo = yearly / 12;

    const origYearly = Math.round(originalYearlyBase * ratio);
    const origStacked = originalMonthly * 12;
    return {
      headline: yearly.toLocaleString("en-US", { maximumFractionDigits: 0 }),
      suffix: "/yr",
      compareAt: promoApplied
        ? `Original: ${Math.round(origStacked).toLocaleString("en-US")} (${Math.round(origYearly).toLocaleString("en-US")}/yr)`
        : `12 x ${Math.round(monthlyUsd)}/mo -> ${Math.round(stacked).toLocaleString("en-US")}`,
      subline: `Approx. ${Math.round(eqMo)}/mo when paid annually`,
      savingsBadge: promoApplied
        ? `Rescue offer: ${LOW_CREDIT_RESCUE_DISCOUNT_PCT}% OFF applied`
        : `Save ${Math.round(saved).toLocaleString("en-US")} (${pct}% vs monthly)`,
      effectiveMonthly: eqMo,
    };
  }

  return {
    headline: Math.round(monthlyUsd).toLocaleString("en-US", {
      maximumFractionDigits: 0,
    }),
    suffix: "/mo",
    compareAt: promoApplied ? `Original: ${Math.round(originalMonthly)}/mo` : null,
    subline: promoApplied
      ? `Low-credit rescue: ${LOW_CREDIT_RESCUE_DISCOUNT_PCT}% OFF applied`
      : "Billed monthly, cancel anytime",
    savingsBadge: promoApplied ? "One-time rescue offer active" : null,
    effectiveMonthly: monthlyUsd,
  };
}
export const BillingPage = () => {
  const [currentCredits, setCurrentCredits] = useState(0);
  const [subscriptionTier, setSubscriptionTier] = useState<
    "Free" | "Basics" | "Pro" | "Ultimate"
  >("Free");
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [creditPacks, setCreditPacks] =
    useState<CreditPack[]>(defaultCreditPacks);
  const [concurrencyPacks, setConcurrencyPacks] = useState<ConcurrencyPack[]>(
    defaultConcurrencyPacks,
  );
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [creditCosts, setCreditCosts] = useState<
    Array<{
      feature_type: string;
      feature_name: string;
      cost: number;
      description: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "subscription" | "packs" | "boosts" | "costs" | "history"
  >("subscription");
  const [processingPayment, setProcessingPayment] = useState(false);
  const [activeAutoApplyRuns, setActiveAutoApplyRuns] = useState(0);
  const [boostedConcurrencySlots, setBoostedConcurrencySlots] = useState(0);
  const [selectedConcurrencyPackSku, setSelectedConcurrencyPackSku] = useState<
    string | null
  >(defaultConcurrencyPacks.find((pack) => pack.is_popular)?.sku ?? defaultConcurrencyPacks[0]?.sku ?? null);
  /** Billing cadence toggle (quarterly applies to Pro & Ultimate only at checkout). */
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("monthly");
  /** Ultimate: extra credits above catalog base (3500); scales price at checkout. */
  const [ultimateCreditsMonthly, setUltimateCreditsMonthly] = useState(
    ULTIMATE_CREDITS_SLIDER.min,
  );
  /** Inferred from subscription period (or last successful order) — used so "CURRENT" matches monthly vs annual. */
  const [activeSubscriptionBillingCycle, setActiveSubscriptionBillingCycle] =
    useState<"monthly" | "quarterly" | "yearly" | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const { notify, error: toastError } = useToast();
  const [promoApplied, setPromoApplied] = useState(false);
  const [expandedRuns, setExpandedRuns] = useState<Record<string, boolean>>({});

  const toggleRunExpansion = (runId: string) => {
    setExpandedRuns((prev) => ({
      ...prev,
      [runId]: !prev[runId],
    }));
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const searchParams = new URLSearchParams(window.location.search);
    const promo = searchParams.get("promo");
    if (promo && isLowCreditRescueCode(promo)) {
      try {
        const expiryTime = ensureLowCreditRescueExpiry();
        if (Date.now() < expiryTime) {
          setPromoApplied(true);
        }
      } catch (error) {
        console.error("Failed to initialize low-credit rescue promo", error);
      }
    }
    const tabParam = searchParams.get("tab");
    if (
      tabParam === "subscription" ||
      tabParam === "packs" ||
      tabParam === "boosts" ||
      tabParam === "costs" ||
      tabParam === "history"
    ) {
      setActiveTab(tabParam);
    }
  }, []);

  /** Single headline discount % (Basics tier) so the toggle badge stays honest if catalog prices change. */
  const annualSavingsPctApprox = useMemo(() => {
    const b = BILLING_PLAN_DEFINITIONS.find((p) => p.name === "Basics");
    if (!b?.yearlyPriceUsd || b.monthlyPriceUsd <= 0) return 17;
    const stacked = b.monthlyPriceUsd * 12;
    return Math.round(((stacked - b.yearlyPriceUsd) / stacked) * 100);
  }, []);

  const baseConcurrencySlots = useMemo(() => {
    return (
      BILLING_PLAN_DEFINITIONS.find((plan) => plan.name === subscriptionTier)
        ?.autoApplyConcurrency ?? 1
    );
  }, [subscriptionTier]);

  const totalConcurrencySlots = baseConcurrencySlots + boostedConcurrencySlots;

  const selectedConcurrencyPack = useMemo(
    () =>
      concurrencyPacks.find((pack) => pack.sku === selectedConcurrencyPackSku) ??
      concurrencyPacks[0] ??
      null,
    [concurrencyPacks, selectedConcurrencyPackSku],
  );

  useEffect(() => {
    fetchBillingData();
    if (typeof window === "undefined") return;

    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("payment") !== "verify") return;
    const reference =
      searchParams.get("reference") || searchParams.get("trxref");
    let cancelled = false;

    const verifyReturnedPayment = async () => {
      if (!reference) return;

      try {
        const { data, error } = await supabase.functions.invoke(
          "verify-payment",
          {
            body: { reference },
          },
        );

        if (cancelled) return;

        const result = data as
          | { success?: boolean; status?: string; error?: string }
          | null;

        if (error || result?.error || !result?.success) {
          console.error("Payment verification failed:", error || result?.error);
          toastError(
            "Payment verification pending",
            "We could not apply the payment immediately. Please refresh in a moment or contact support with the payment reference.",
          );
          return;
        }

        if (
          result.status === "fulfilled" ||
          result.status === "already_fulfilled"
        ) {
          notify({
            title: "Payment applied",
            description:
              "Your billing update has been applied to your account.",
            variant: "success",
          });
        }

        window.dispatchEvent(new CustomEvent("jobraker:credits-updated"));
        await fetchBillingData();

        const cleanedUrl = new URL(window.location.href);
        cleanedUrl.searchParams.delete("payment");
        cleanedUrl.searchParams.delete("reference");
        cleanedUrl.searchParams.delete("trxref");
        window.history.replaceState({}, "", cleanedUrl.toString());
      } catch (error) {
        if (cancelled) return;
        console.error("Payment return verification error:", error);
        toastError(
          "Payment verification pending",
          "We could not apply the payment immediately. Please refresh in a moment or contact support with the payment reference.",
        );
      }
    };

    void verifyReturnedPayment();

    const refreshTimers = [1500, 4000, 8000].map((delay) =>
      window.setTimeout(() => {
        void fetchBillingData();
        window.dispatchEvent(new CustomEvent("jobraker:credits-updated"));
      }, delay),
    );

    return () => {
      cancelled = true;
      refreshTimers.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, []);

  const fetchBillingData = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      // If no user (e.g. preview mode), populate with defaults
      if (!userId) {
        setPlans(defaultPlans);
        setCreditPacks(defaultCreditPacks);
        setConcurrencyPacks(defaultConcurrencyPacks);
        setBoostedConcurrencySlots(0);
        setActiveAutoApplyRuns(0);
        setBillingInterval("monthly");
        setCancelAtPeriodEnd(false);
        setActiveSubscriptionBillingCycle(null);
        setTransactions([
          {
            id: "1",
            transaction_type: "bonus",
            amount: 50,
            balance_after: 50,
            description: "Welcome Bonus",
            created_at: new Date().toISOString(),
          },
        ]);
        return;
      }

      // Fetch current credits
      const { data: creditsData } = await supabase
        .from("user_credits")
        .select("balance")
        .eq("user_id", userId)
        .single();

      if (creditsData) {
        setCurrentCredits(creditsData.balance);
      }

      // Fetch subscription (period length reveals monthly vs yearly billing)
      const { data: subscription } = await supabase
        .from("user_subscriptions")
        .select(
          "current_period_start, current_period_end, cancel_at_period_end, subscription_plans(name, credits_per_month)",
        )
        .eq("user_id", userId)
        .eq("status", "active")
        .gt("current_period_end", new Date().toISOString())
        .maybeSingle();

      let resolvedCycle: "monthly" | "quarterly" | "yearly" | null = null;

      if (subscription) {
        const planName = (subscription as any)?.subscription_plans?.name;
        setSubscriptionTier(planName || "Free");
        setCurrentPeriodEnd((subscription as any).current_period_end);
        setCancelAtPeriodEnd(
          Boolean((subscription as any).cancel_at_period_end),
        );
        const start = (subscription as any).current_period_start as
          | string
          | undefined;
        const end = (subscription as any).current_period_end as
          | string
          | undefined;
        resolvedCycle = inferBillingCycleFromSubscriptionPeriod(start, end);
      } else {
        setSubscriptionTier("Free");
        setCurrentPeriodEnd(null);
        setCancelAtPeriodEnd(false);
      }

      const { data: recentSubscriptionOrders } = await supabase
        .from("orders")
        .select("payment_cycle, metadata")
        .eq("user_id", userId)
        .eq("plan_type", "subscription")
        .eq("is_success", true)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!resolvedCycle) {
        const lastSubOrder = (
          recentSubscriptionOrders as
            | Array<{
                payment_cycle?: string;
                metadata?: { billing_cycle?: string };
              }>
            | null
        )?.[0];
        const pc = lastSubOrder?.payment_cycle;
        const meta = lastSubOrder?.metadata;
        if (pc === "yearly" || meta?.billing_cycle === "yearly")
          resolvedCycle = "yearly";
        else if (pc === "quarterly" || meta?.billing_cycle === "quarterly") {
          resolvedCycle = "quarterly";
        } else if (pc === "monthly" || meta?.billing_cycle === "monthly") {
          resolvedCycle = "monthly";
        }
      }

      if (typeof window !== "undefined") {
        const requestedPromo = new URLSearchParams(window.location.search).get(
          "promo",
        );
        const redeemedLowCreditRescue = (
          recentSubscriptionOrders as Array<{
            metadata?: { promo_code?: string };
          }> | null
        )?.some((order) =>
          isLowCreditRescueCode(order?.metadata?.promo_code ?? null),
        );

        if (isLowCreditRescueCode(requestedPromo) && redeemedLowCreditRescue) {
          setPromoApplied(false);
        }
      }

      setActiveSubscriptionBillingCycle(resolvedCycle);

      // Default the Monthly/Annual toggle to monthly so checkout matches "billed each month"
      // unless we know this member is on (or last bought) an annual term.
      if (subscription) {
        const planName = (subscription as any)?.subscription_plans?.name as
          | string
          | undefined;
        if (planName && planName !== "Free") {
          setBillingInterval(resolvedCycle ?? "monthly");
        } else {
          setBillingInterval(resolvedCycle ?? "monthly");
        }
      } else {
        setBillingInterval(resolvedCycle ?? "monthly");
      }

      // Fetch all subscription plans
      const { data: plansData } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("price", { ascending: true });

      if (plansData && plansData.length > 0) {
        setPlans(plansData);
      } else {
        setPlans(defaultPlans);
      }

      const { data: packsData } = await supabase
        .from("credit_pack_catalog")
        .select(
          "sku, name, description, credits, bonus_credits, price_usd, is_popular",
        )
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (packsData && packsData.length > 0) {
        setCreditPacks(packsData as CreditPack[]);
      } else {
        setCreditPacks(defaultCreditPacks);
      }

      const { data: concurrencyPackData } = await supabase
        .from("concurrency_pack_catalog")
        .select("sku, name, description, parallel_slots, price_usd, is_popular")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (concurrencyPackData && concurrencyPackData.length > 0) {
        setConcurrencyPacks(concurrencyPackData as ConcurrencyPack[]);
        setSelectedConcurrencyPackSku((current) => {
          if (
            current &&
            concurrencyPackData.some((pack) => pack.sku === current)
          ) {
            return current;
          }
          const popular = concurrencyPackData.find((pack) => pack.is_popular);
          return popular?.sku ?? concurrencyPackData[0]?.sku ?? null;
        });
      } else {
        setConcurrencyPacks(defaultConcurrencyPacks);
      }

      const nowIso = new Date().toISOString();
      const threeHoursAgoIso = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      const [{ data: concurrencyQuotaRows }, { count: queuedRunsCount }] =
        await Promise.all([
          supabase
            .from("user_feature_quotas")
            .select("included_quantity")
            .eq("user_id", userId)
            .eq("feature_key", "auto_apply_concurrency")
            .eq("source", "addon")
            .lte("period_start", nowIso)
            .gt("period_end", nowIso),
          supabase
            .from("applications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("canonical_stage", "queued")
            .neq("provider_status", "waiting")
            .gt("updated_at", threeHoursAgoIso),
        ]);

      const boostSlots = Array.isArray(concurrencyQuotaRows)
        ? concurrencyQuotaRows.reduce(
            (sum, row) => sum + Math.max(0, Number(row.included_quantity || 0)),
            0,
          )
        : 0;
      setBoostedConcurrencySlots(boostSlots);
      setActiveAutoApplyRuns(typeof queuedRunsCount === "number" ? queuedRunsCount : 0);

      // Fetch credit costs
      const { data: costsData } = await supabase
        .from("credit_costs")
        .select("feature_type, feature_name, cost, description")
        .eq("is_active", true)
        .order("feature_type", { ascending: true });

      if (costsData) {
        setCreditCosts(costsData);
      }

      // Fetch recent transactions
      const { data: transactionsData } = await supabase
        .from("credit_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (transactionsData) {
        setTransactions(
          (transactionsData as CreditTransaction[]).map(
            normalizeCreditTransaction,
          ),
        );
      }
    } catch (error) {
      console.error("Error fetching billing data:", error);
      // Fallback to defaults on error
      setPlans(defaultPlans);
      setCreditPacks(defaultCreditPacks);
      setConcurrencyPacks(defaultConcurrencyPacks);
    } finally {
      setLoading(false);
    }
  };

  const exportTransactionsCSV = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) {
        notify({
          title: "Authentication Required",
          description: "Please sign in to export your transaction history.",
          variant: "error",
        });
        return;
      }

      notify({
        title: "Preparing export",
        description: "Fetching your full transaction history...",
      });

      const { data: allTransactions, error: fetchErr } = await supabase
        .from("credit_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (fetchErr) throw fetchErr;

      const txList = (allTransactions || []).map(normalizeCreditTransaction);

      if (txList.length === 0) {
        notify({
          title: "No transactions",
          description: "There are no transactions to export.",
          variant: "error",
        });
        return;
      }

      const headers = [
        "date",
        "description",
        "amount",
        "balance_after",
        "transaction_type",
        "agent_run_id"
      ];
      const rows = txList.map((t) => [
        t.created_at ? new Date(t.created_at).toLocaleString() : "",
        t.description || "",
        t.amount || 0,
        t.balance_after || 0,
        t.transaction_type || t.type || "",
        t.agent_run_id || ""
      ]);

      const csv = [
        headers.join(","),
        ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")),
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transactions-all-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      notify({
        title: "Export complete",
        description: `Successfully exported ${txList.length} transactions.`,
        variant: "success",
      });
    } catch (err: any) {
      console.error("Failed to export transactions:", err);
      notify({
        title: "Export failed",
        description: err.message || "Could not retrieve transaction history.",
        variant: "error",
      });
    }
  }, [supabase, notify]);

  const handlePayment = async (
    type: "subscription" | "credit_pack" | "concurrency_pack",
    item: any,
  ) => {
    try {
      setProcessingPayment(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        notify({
          title: "Authentication Required",
          description: "Please sign in to make a purchase.",
          variant: "error",
        });
        return;
      }

      let payload: Record<string, unknown>;
      let analyticsProperties: Record<string, unknown>;
      if (type === "credit_pack" || type === "concurrency_pack") {
        payload = { purchaseType: type, packSku: item.sku };
        analyticsProperties = {
          purchase_type: type,
          pack_sku: item.sku,
          pack_name: item.name,
          ...(type === "concurrency_pack"
            ? { parallel_slots: item.parallel_slots }
            : {}),
        };
      } else {
        const planId = await resolveSubscriptionPlanUuidForCheckout(supabase, {
          id: String(item.id ?? ""),
          name: typeof item.name === "string" ? item.name : undefined,
        });
        if (!planId) {
          notify({
            title: "Could not start checkout",
            description:
              "We could not resolve this plan in the database. Refresh the page or contact support if this persists.",
            variant: "error",
          });
          return;
        }
        payload = {
          purchaseType: type,
          planId,
          billingCycle: item.billingCycle as BillingInterval,
          ...(item.name === "Ultimate" &&
          typeof item.ultimateCreditsPerMonth === "number"
            ? { ultimateCreditsPerMonth: item.ultimateCreditsPerMonth }
            : {}),
          ...(promoApplied ? { promoCode: LOW_CREDIT_RESCUE_CODE } : {}),
        };
        analyticsProperties = {
          purchase_type: type,
          plan_id: planId,
          plan_name: item.name,
          billing_cycle: item.billingCycle as BillingInterval,
          ...(item.name === "Ultimate" &&
          typeof item.ultimateCreditsPerMonth === "number"
            ? { ultimate_credits_per_month: item.ultimateCreditsPerMonth }
            : {}),
          ...(promoApplied ? { promo_code: LOW_CREDIT_RESCUE_CODE } : {}),
        };
      }

      const { data, error } = await supabase.functions.invoke("init-payment", {
        body: payload,
      });

      const body = data as { url?: string; error?: string } | null;
      if (error) {
        throw new Error(
          body?.error ??
            (error as Error).message ??
            "Failed to initialize payment",
        );
      }
      if (body?.error && !body.url) {
        throw new Error(body.error);
      }
      if (body?.url) {
        if (type === "subscription") {
          captureClientEvent("subscription_started", analyticsProperties);
          void captureServerEvent("subscription_started", analyticsProperties);
        } else if (type === "concurrency_pack") {
          captureClientEvent(
            "auto_apply_concurrency_checkout_started",
            analyticsProperties,
          );
        } else {
          captureClientEvent("credit_pack_checkout_started", analyticsProperties);
        }
        window.location.href = body.url;
        return;
      }
      throw new Error("No payment URL returned");
    } catch (error: unknown) {
      console.error("Payment initialization failed:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to initialize payment. Please try again.";
      toastError("Payment Error", message);
    } finally {
      setProcessingPayment(false);
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case "Pro":
        return <Zap className='w-5 h-5 text-blue-400' />;
      case "Ultimate":
        return <Crown className='w-5 h-5 text-purple-400' />;
      default:
        return <Coins className='w-5 h-5 text-brand' />;
    }
  };

  const getTierGradient = (tier: string) => {
    switch (tier) {
      case "Pro":
        return "from-blue-500 via-blue-600 to-blue-700";
      case "Ultimate":
        return "from-purple-500 via-purple-600 to-purple-700";
      default:
        return "from-brand via-brand to-brand";
    }
  };

  const getTierTextColor = (_tier: string) => {
    return {
      primary: "text-foreground",
      secondary: "text-foreground/70",
      tertiary: "text-foreground/80",
      muted: "text-foreground/50",
    };
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "bonus":
        return {
          icon: <Sparkles className='w-4 h-4' />,
          color: "text-brand bg-brand/10 border-brand/20",
        };
      case "refill":
        return {
          icon: <TrendingUp className='w-4 h-4' />,
          color: "text-brand bg-brand/10 border-brand/20",
        };
      case "spend":
      case "deduction":
        return {
          icon: <ArrowUpRight className='w-4 h-4' />,
          color: "text-brand bg-brand/10 border-brand/20",
        };
      case "refund":
      case "refunded":
        return {
          icon: <ArrowDownLeft className='w-4 h-4' />,
          color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
        };
      case "auto_apply":
      case "job_search":
        return {
          icon: <Rocket className='w-4 h-4' />,
          color: "text-brand bg-brand/10 border-brand/20",
        };
      default:
        return {
          icon: <Coins className='w-4 h-4' />,
          color: "text-gray-400 bg-gray-400/10 border-gray-400/20",
        };
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const groupedTransactions = useMemo(() => {
    const runsMap = new Map<string, CreditTransaction[]>();
    const ungrouped: CreditTransaction[] = [];

    transactions.forEach((tx) => {
      if (tx.agent_run_id) {
        if (!runsMap.has(tx.agent_run_id)) {
          runsMap.set(tx.agent_run_id, []);
        }
        runsMap.get(tx.agent_run_id)!.push(tx);
      } else {
        ungrouped.push(tx);
      }
    });

    interface GroupedRunItem {
      isGroupedRun: true;
      agent_run_id: string;
      transactions: CreditTransaction[];
      amount: number;
      description: string;
      created_at: string;
      balance_after: number;
    }

    const groupedRuns: GroupedRunItem[] = [];

    runsMap.forEach((txs, runId) => {
      const sortedTxs = [...txs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const netAmount = sortedTxs.reduce((sum, t) => sum + t.amount, 0);
      const reservationTx = sortedTxs.find(t => t.amount < 0) || sortedTxs[0];
      const refundTx = sortedTxs.find(t => t.amount > 0 && t !== reservationTx);
      const latestTx = sortedTxs[sortedTxs.length - 1];
      const balanceAfter = latestTx.balance_after;

      let desc = reservationTx.description || `Agent Run (${runId.slice(0, 8)})`;
      if (refundTx) {
        desc = desc.replace("Reservation for ", "") + " (Completed & Settled)";
      } else if (sortedTxs.some(t => t.description?.includes("Refund"))) {
        desc = "Agent Run - Refunded";
      }

      groupedRuns.push({
        isGroupedRun: true,
        agent_run_id: runId,
        transactions: sortedTxs,
        amount: netAmount,
        description: desc,
        created_at: reservationTx.created_at,
        balance_after: balanceAfter,
      });
    });

    type DisplayItem = 
      | (CreditTransaction & { isGroupedRun?: false }) 
      | (GroupedRunItem & { id: string });

    const combined: DisplayItem[] = [
      ...ungrouped.map((tx) => ({ ...tx, isGroupedRun: false as const })),
      ...groupedRuns.map((run) => ({ ...run, id: run.agent_run_id })),
    ];

    return combined.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [transactions]);

  if (loading) {
    return (
      <div className='min-h-full bg-background p-6 space-y-6'>
        <div className='h-8 w-48 bg-foreground/10 rounded-lg animate-pulse' />
        <div className='grid gap-6 md:grid-cols-3'>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className='h-48 bg-foreground/5 rounded-2xl animate-pulse'
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-full bg-background selection:bg-brand/30'>
      {/* Hero Section */}
      <div className='relative overflow-hidden border-b border-foreground/10 bg-gradient-to-br from-background to-background'>
        {/* Animated background elements */}
        <div className='absolute inset-0 overflow-hidden pointer-events-none'>
          <div className='absolute top-0 left-1/4 w-[500px] h-[500px] bg-brand/5 rounded-full blur-[120px] mix-blend-screen animate-pulse' />
          <div
            className='absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[120px] mix-blend-screen animate-pulse'
            style={{ animationDelay: "2s" }}
          />
          {/* Grid overlay */}
          <div className='absolute inset-0 bg-[linear-gradient(to_right,#1dff0005_1px,transparent_1px),linear-gradient(to_bottom,#1dff0005_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]' />
        </div>

        <div className='relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16'>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className='text-center mb-12'
          >
            <h1 className='text-4xl sm:text-5xl lg:text-7xl font-bold mb-6 tracking-tight'>
              <span className='bg-gradient-to-r from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent'>
                Billing &
              </span>{" "}
              <span className='text-brand drop-shadow-[0_0_15px_rgba(29,255,0,0.3)]'>
                Credits
              </span>
            </h1>
            <p className='text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed'>
              Price search and drafting separately from automation. Plans
              include governed auto-apply runs, while packs top up search and AI
              usage.
            </p>
          </motion.div>

          {/* Stats Cards */}
          <div className='grid gap-4 sm:gap-6 md:grid-cols-3'>
            {/* Current Balance */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className='relative overflow-hidden border-foreground/10 bg-foreground/[0.03] backdrop-blur-xl group hover:border-brand/30 transition-colors duration-300'>
                <div className='absolute inset-0 bg-gradient-to-br from-brand/5 to-transparent opacity-50' />
                <CardContent className='relative p-6'>
                  <div className='flex items-start justify-between mb-4'>
                    <div className='p-3 rounded-xl bg-brand/10 border border-brand/20 group-hover:bg-brand/20 transition-colors'>
                      <Coins className='w-6 h-6 text-brand' />
                    </div>
                    <span className='text-[10px] tracking-wider font-bold text-brand bg-brand/10 px-2.5 py-1 rounded-full border border-brand/20'>
                      BALANCE
                    </span>
                  </div>
                  <div className='space-y-1'>
                    <p className='text-sm text-gray-400 font-medium'>
                      Available workflow fuel
                    </p>
                    <p className='text-4xl font-bold text-foreground tracking-tight'>
                      {currentCredits.toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Current Plan */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className='relative overflow-hidden border-foreground/10 bg-foreground/[0.03] backdrop-blur-xl group hover:border-foreground/20 transition-colors duration-300'>
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${getTierGradient(subscriptionTier)} opacity-5`}
                />
                <CardContent className='relative p-6'>
                  <div className='flex items-start justify-between mb-4'>
                    <div
                      className={`p-3 rounded-xl bg-gradient-to-br ${getTierGradient(subscriptionTier)}/10 border border-foreground/10 group-hover:border-foreground/20 transition-colors`}
                    >
                      {getTierIcon(subscriptionTier)}
                    </div>
                    <span
                      className={`text-[10px] tracking-wider font-bold px-2.5 py-1 rounded-full border ${
                        subscriptionTier === "Pro"
                          ? "bg-blue-500/10 text-blue-300 border-blue-500/20"
                          : subscriptionTier === "Ultimate"
                            ? "bg-purple-500/10 text-purple-300 border-purple-500/20"
                            : "bg-brand/10 text-brand border-brand/20"
                      }`}
                    >
                      ACTIVE PLAN
                    </span>
                  </div>
                  <div className='space-y-1'>
                    <p className='text-sm text-gray-400 font-medium'>
                      Current Tier
                    </p>
                    <p className='text-4xl font-bold text-foreground tracking-tight'>
                      {subscriptionTier}
                    </p>
                    <p className='text-sm text-gray-500'>
                      {plans
                        .find((p) => p.name === subscriptionTier)
                        ?.credits_per_month?.toLocaleString() || 0}{" "}
                      credits
                      {plans.find((p) => p.name === subscriptionTier)
                        ?.auto_apply_monthly_limit
                        ? ` + ${plans.find((p) => p.name === subscriptionTier)?.auto_apply_monthly_limit} auto-apply runs/mo`
                        : " / manual only"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Next payment (subscription period end — not the same as monthly credit cron) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className='relative overflow-hidden border-foreground/10 bg-foreground/[0.03] backdrop-blur-xl group hover:border-blue-400/30 transition-colors duration-300'>
                <div className='absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-50' />
                <CardContent className='relative p-6'>
                  <div className='flex items-start justify-between mb-4'>
                    <div className='p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors'>
                      <Calendar className='w-6 h-6 text-blue-400' />
                    </div>
                    <span className='text-[10px] tracking-wider font-bold text-blue-400 bg-blue-400/10 px-2.5 py-1 rounded-full border border-blue-400/20'>
                      BILLING
                    </span>
                  </div>
                  {(() => {
                    const next = currentPeriodEnd
                      ? new Date(currentPeriodEnd)
                      : null;
                    const { primary, secondary } = getPaymentRenewalCaption(
                      cancelAtPeriodEnd,
                      activeSubscriptionBillingCycle,
                    );
                    return (
                      <div className='space-y-1'>
                        <p className='text-sm text-gray-400 font-medium'>
                          Next payment
                        </p>
                        <p className='text-lg font-bold text-foreground tracking-tight pt-2'>
                          {next
                            ? next.toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "Not scheduled"}
                        </p>
                        <p className='text-xs text-gray-500 pt-1'>{primary}</p>
                        {secondary ? (
                          <p className='text-[11px] text-gray-600 leading-snug pt-0.5'>
                            {secondary}
                          </p>
                        ) : null}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12'>
        {promoApplied && (
          <div className='mb-8'>
            <div className='relative overflow-hidden rounded-2xl border border-brand/20 bg-brand/5 px-6 py-4 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_0_30px_rgba(29,255,0,0.05)]'>
              <div className='flex items-center gap-3 min-w-0'>
                <div className='p-2 rounded-xl bg-brand/10 border border-brand/20 text-brand shrink-0 animate-pulse'>
                  <Percent className='w-5 h-5' />
                </div>
                <div className='text-left'>
                  <h3 className='font-bold text-foreground text-sm sm:text-base'>
                    Low-credit rescue offer active
                  </h3>
                  <p className='text-xs text-muted-foreground mt-0.5'>
                    Your one-time 15% rescue offer is active for the next hour on Basics, Pro, and Ultimate.
                  </p>
                </div>
              </div>
              <div className='flex items-center gap-2 font-mono text-xs text-brand font-semibold border border-brand/30 bg-brand/10 px-3 py-1 rounded-lg shrink-0'>
                <Check className='w-4 h-4 shrink-0' strokeWidth={3} />
                OFFER ACTIVE
              </div>
            </div>
          </div>
        )}

        {/* Custom Tab Navigation */}
        <div className='flex justify-center mb-12 max-w-full px-4'>
          <div className='flex items-center p-1 bg-foreground/5 rounded-full border border-foreground/10 backdrop-blur-md overflow-x-auto max-w-full no-scrollbar flex-nowrap sm:flex-wrap'>
            {[
              {
                id: "subscription",
                label: "Plans",
                icon: <Star className='w-4 h-4' />,
              },
              {
                id: "packs",
                label: "Credit Packs",
                icon: <Package className='w-4 h-4' />,
              },
              {
                id: "boosts",
                label: "Parallel Boosts",
                icon: <Rocket className='w-4 h-4' />,
              },
              {
                id: "costs",
                label: "Credit Costs",
                icon: <Receipt className='w-4 h-4' />,
              },
              {
                id: "history",
                label: "History",
                icon: <History className='w-4 h-4' />,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() =>
                  setActiveTab(
                    tab.id as
                      | "subscription"
                      | "packs"
                      | "boosts"
                      | "costs"
                      | "history",
                  )
                }
                className={`relative flex items-center gap-1.5 px-3 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold rounded-full transition-all duration-300 shrink-0 ${
                  activeTab === tab.id
                    ? "text-background shadow-lg"
                    : "text-gray-400 hover:text-foreground hover:bg-foreground/5"
                }`}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId='activeTab'
                    className='absolute inset-0 bg-brand rounded-full'
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className='relative z-10 flex items-center gap-2'>
                  {tab.icon}
                  {tab.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode='wait'>
          {/* Subscription Plans Tab */}
          {activeTab === "subscription" && (
            <motion.div
              key='subscription'
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className='space-y-8'
            >
              <div className='max-w-3xl mx-auto text-center space-y-4'>
                <p className='text-sm text-muted-foreground'>
                  Monthly, quarterly (Pro: 10% off, Ultimate: 15% off vs three
                  monthly payments), or annual—same features, different billing
                  cadence.
                </p>
                <div className='inline-flex flex-wrap justify-center gap-1 p-1 rounded-2xl bg-foreground/5 border border-foreground/10 backdrop-blur-sm max-w-full'>
                  <button
                    type='button'
                    onClick={() => setBillingInterval("monthly")}
                    className={`relative px-4 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      billingInterval === "monthly"
                        ? "bg-foreground text-background shadow-md"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type='button'
                    onClick={() => setBillingInterval("quarterly")}
                    className={`relative px-4 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors inline-flex items-center gap-2 ${
                      billingInterval === "quarterly"
                        ? "bg-foreground text-background shadow-md"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Quarterly
                    <span className='text-[10px] font-bold uppercase tracking-wide opacity-90 border border-current/30 rounded-full px-2 py-0.5'>
                      10–15% off
                    </span>
                  </button>
                  <button
                    type='button'
                    onClick={() => setBillingInterval("yearly")}
                    className={`relative px-4 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors inline-flex items-center gap-2 ${
                      billingInterval === "yearly"
                        ? "bg-brand text-background shadow-md"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Annual
                    <span className='text-[10px] font-bold uppercase tracking-wide opacity-90 border border-current/30 rounded-full px-2 py-0.5'>
                      ~{annualSavingsPctApprox}% off
                    </span>
                  </button>
                </div>
              </div>

              <div className='grid w-full grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 2xl:grid-cols-4 2xl:gap-6'>
                {plans.map((plan, index) => {
                  const cycleForCurrent =
                    activeSubscriptionBillingCycle ?? "monthly";
                  const isCurrentPlan =
                    plan.name === subscriptionTier &&
                    (subscriptionTier === "Free" ||
                      billingInterval === cycleForCurrent);
                  const isPro = plan.name === "Pro";
                  const isUltimate = plan.name === "Ultimate";
                  const pricingInterval = effectiveBillingCycleForPlan(
                    plan.name,
                    billingInterval,
                  );
                  const ultimateBaseCredits =
                    BILLING_PLAN_DEFINITIONS.find((p) => p.name === "Ultimate")
                      ?.creditsPerMonth ?? 3500;
                  const ultimateScaledRuns = isUltimate
                    ? Math.max(
                        1,
                        Math.round(
                          ((plan.auto_apply_monthly_limit || 0) *
                            ultimateCreditsMonthly) /
                            ultimateBaseCredits,
                        ),
                      )
                    : (plan.auto_apply_monthly_limit ?? 0);
                  const pricing = isUltimate
                    ? getUltimatePricingDisplay(
                        pricingInterval,
                        ultimateCreditsMonthly,
                        plan.price,
                        promoApplied,
                      )
                    : getPlanPricingDisplay(
                        plan.name,
                        pricingInterval,
                        plan.price,
                        promoApplied,
                      );

                  return (
                    <motion.div
                      key={plan.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className='relative h-full min-w-0'
                    >
                      {(isPro || isUltimate) && (
                        <div className='absolute -top-3 left-0 right-0 flex justify-center z-20'>
                          <span
                            className={`text-[10px] font-bold px-3 py-1 rounded-full shadow-lg border ${
                              isUltimate
                                ? "bg-purple-500 text-foreground border-purple-400"
                                : "bg-brand text-background border-brand"
                            }`}
                          >
                            {isUltimate
                              ? billingInterval === "quarterly"
                                ? "SCALE · QUARTERLY"
                                : billingInterval === "yearly"
                                  ? "MAX VALUE · ANNUAL"
                                  : "MAXIMUM POWER"
                              : billingInterval === "yearly"
                                ? "SWEET SPOT · ANNUAL"
                                : billingInterval === "quarterly"
                                  ? "SMART COMMIT · QUARTERLY"
                                  : "MOST POPULAR"}
                          </span>
                        </div>
                      )}

                      <Card
                        className={`group relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden transition-all duration-300 ${
                          isCurrentPlan
                            ? "border-brand/50 bg-gradient-to-b from-brand/10 to-transparent shadow-[0_0_40px_-10px_rgba(29,255,0,0.2)]"
                            : isPro &&
                                (billingInterval === "yearly" ||
                                  billingInterval === "quarterly")
                              ? "ring-2 ring-blue-400/45 border-blue-400/25 bg-foreground/[0.02] hover:bg-foreground/[0.04] shadow-[0_0_36px_-10px_rgba(59,130,246,0.25)] hover:-translate-y-1"
                              : "border-foreground/10 bg-foreground/[0.02] hover:bg-foreground/[0.04] hover:border-foreground/20 hover:shadow-xl hover:shadow-brand/5 hover:-translate-y-1"
                        }`}
                      >
                        {/* Gradient accent top border */}
                        <div
                          className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${getTierGradient(plan.name)} opacity-70`}
                        />

                        {isCurrentPlan && (
                          <div className='absolute top-4 right-4 z-10'>
                            <span className='px-2.5 py-1 text-[10px] font-bold bg-brand text-background border border-brand rounded-full flex items-center gap-1 shadow-md'>
                              <Check className='w-3 h-3' />
                              CURRENT
                            </span>
                          </div>
                        )}

                        <CardContent className='flex h-full min-h-0 w-full min-w-0 flex-col p-5 sm:p-6'>
                          {(() => {
                            const textColors = getTierTextColor(plan.name);
                            return (
                              <>
                                {/* Header */}
                                <div className='mb-5 shrink-0'>
                                  <div
                                    className={`mb-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br sm:h-14 sm:w-14 ${
                                      plan.name === "Pro"
                                        ? "from-blue-500/20 to-transparent border-blue-500/20"
                                        : plan.name === "Ultimate"
                                          ? "from-purple-500/20 to-transparent border-purple-500/20"
                                          : "from-brand/20 to-transparent border-brand/20"
                                    } border border-foreground/5`}
                                  >
                                    {getTierIcon(plan.name)}
                                  </div>
                                  <h3
                                    className={`text-xl font-bold tracking-tight sm:text-2xl ${textColors.primary}`}
                                  >
                                    {plan.name}
                                  </h3>
                                  <p
                                    className={`mt-1 line-clamp-3 text-sm leading-snug ${textColors.secondary}`}
                                  >
                                    {plan.description}
                                  </p>
                                </div>

                                {isUltimate ? (
                                  <div className='mb-5 shrink-0 rounded-xl border border-purple-500/20 bg-purple-500/5 p-4'>
                                    <div className='mb-3 flex items-center gap-2'>
                                      <Sparkles className='h-4 w-4 shrink-0 text-purple-300' />
                                      <span
                                        className={`text-sm font-bold tabular-nums ${textColors.primary}`}
                                      >
                                        {ultimateCreditsMonthly.toLocaleString()}{" "}
                                        credits/mo
                                      </span>
                                    </div>
                                    <p className='mb-4 text-[11px] leading-snug text-muted-foreground'>
                                      Slide to add capacity—search, AI chat, and
                                      drafting scale with your monthly credits.
                                      Governed auto-apply runs increase in step
                                      with your tier.
                                    </p>
                                    <Slider
                                      min={ULTIMATE_CREDITS_SLIDER.min}
                                      max={ULTIMATE_CREDITS_SLIDER.max}
                                      step={ULTIMATE_CREDITS_SLIDER.step}
                                      value={[ultimateCreditsMonthly]}
                                      onValueChange={(v) =>
                                        setUltimateCreditsMonthly(
                                          v[0] ?? ULTIMATE_CREDITS_SLIDER.min,
                                        )
                                      }
                                      aria-label='Ultimate monthly credits'
                                      className='mb-2'
                                    />
                                    <div className='flex justify-between text-[10px] tabular-nums text-muted-foreground'>
                                      <span>
                                        {ULTIMATE_CREDITS_SLIDER.min.toLocaleString()}
                                      </span>
                                      <span className='font-medium text-foreground/80'>
                                        {Math.round(
                                          (ULTIMATE_CREDITS_SLIDER.min +
                                            ULTIMATE_CREDITS_SLIDER.max) /
                                            2,
                                        ).toLocaleString()}
                                      </span>
                                      <span>
                                        {ULTIMATE_CREDITS_SLIDER.max.toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                ) : null}

                                {/* Price */}
                                <div className='mb-5 shrink-0 space-y-2 border-b border-foreground/10 pb-5'>
                                  <div className='flex items-baseline gap-1.5 flex-wrap'>
                                    <span
                                      className={`text-4xl font-bold tabular-nums ${textColors.primary}`}
                                    >
                                      ${pricing.headline}
                                    </span>
                                    {pricing.suffix ? (
                                      <span className={textColors.tertiary}>
                                        {pricing.suffix}
                                      </span>
                                    ) : null}
                                  </div>
                                  {pricing.compareAt ? (
                                    <p className='text-xs text-muted-foreground line-through decoration-foreground/35'>
                                      {pricing.compareAt}
                                    </p>
                                  ) : null}
                                  {pricing.subline ? (
                                    <p
                                      className={`text-sm ${textColors.secondary}`}
                                    >
                                      {pricing.subline}
                                    </p>
                                  ) : null}
                                  {pricing.savingsBadge &&
                                  (billingInterval === "yearly" ||
                                    billingInterval === "quarterly" ||
                                    promoApplied) ? (
                                    <div className='inline-flex items-center gap-1.5 text-xs font-semibold text-brand bg-brand/10 border border-brand/25 rounded-full px-2.5 py-1 mt-1'>
                                      <Percent className='w-3.5 h-3.5 shrink-0' />
                                      {pricing.savingsBadge}
                                    </div>
                                  ) : null}
                                </div>

                                {/* Included usage — single column so narrow plan cards don’t crush side‑by‑side stats */}
                                <div className='mb-6 grid grid-cols-1 gap-3'>
                                  <div className='flex min-h-[5rem] items-start gap-3 rounded-xl border border-foreground/5 bg-foreground/5 p-3.5 transition-colors group-hover:bg-foreground/10 sm:min-h-[5.5rem]'>
                                    <div className='p-1.5 rounded-lg bg-background/40 shrink-0 mt-0.5'>
                                      <Zap
                                        className={`w-4 h-4 ${
                                          plan.name === "Pro"
                                            ? "text-blue-400"
                                            : plan.name === "Ultimate"
                                              ? "text-purple-400"
                                              : "text-brand"
                                        }`}
                                      />
                                    </div>
                                    <div className='min-w-0 flex-1 flex flex-col gap-1.5'>
                                      <div className='flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5'>
                                        <span
                                          className={`text-2xl font-bold tabular-nums leading-none tracking-tight ${textColors.primary}`}
                                        >
                                          {(isUltimate
                                            ? ultimateCreditsMonthly
                                            : plan.credits_per_month
                                          ).toLocaleString()}
                                        </span>
                                        <span className='text-xs font-medium text-muted-foreground'>
                                          credits
                                        </span>
                                      </div>
                                      <div className='space-y-0.5'>
                                        <p
                                          className={`text-[10px] font-semibold uppercase tracking-wider ${textColors.muted} leading-tight`}
                                        >
                                          Search + AI
                                        </p>
                                        <p className='text-[9px] uppercase tracking-widest text-muted-foreground/75 leading-tight'>
                                          per month
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className='flex min-h-[5rem] items-start gap-3 rounded-xl border border-foreground/5 bg-foreground/5 p-3.5 transition-colors group-hover:bg-foreground/10 sm:min-h-[5.5rem]'>
                                    <div className='p-1.5 rounded-lg bg-background/40 shrink-0 mt-0.5'>
                                      <Target
                                        className={`w-4 h-4 ${
                                          plan.name === "Pro"
                                            ? "text-blue-400"
                                            : plan.name === "Ultimate"
                                              ? "text-purple-400"
                                              : "text-brand"
                                        }`}
                                      />
                                    </div>
                                    <div className='min-w-0 flex-1 flex flex-col gap-1.5'>
                                      {plan.auto_apply_monthly_limit &&
                                      plan.auto_apply_monthly_limit > 0 ? (
                                        <>
                                          <div className='flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5'>
                                            <span
                                              className={`text-2xl font-bold tabular-nums leading-none tracking-tight ${textColors.primary}`}
                                            >
                                              {(isUltimate
                                                ? ultimateScaledRuns
                                                : plan.auto_apply_monthly_limit
                                              ).toLocaleString()}
                                            </span>
                                            <span className='text-xs font-medium text-muted-foreground'>
                                              runs
                                            </span>
                                          </div>
                                          <div className='space-y-0.5'>
                                            <p
                                              className={`text-[10px] font-semibold uppercase tracking-wider ${textColors.muted} leading-tight`}
                                            >
                                              Governed
                                            </p>
                                            <p className='text-[9px] uppercase tracking-widest text-muted-foreground/75 leading-tight'>
                                              auto apply / mo
                                            </p>
                                          </div>
                                        </>
                                      ) : (
                                        <>
                                          <p
                                            className={`text-base font-bold leading-tight ${textColors.primary}`}
                                          >
                                            Manual only
                                          </p>
                                          <div className='space-y-0.5'>
                                            <p
                                              className={`text-[10px] font-semibold uppercase tracking-wider ${textColors.muted} leading-tight`}
                                            >
                                              No automation
                                            </p>
                                            <p className='text-[9px] text-muted-foreground/75 leading-snug'>
                                              You apply yourself
                                            </p>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Features */}
                                <div className='space-y-3 mb-8 flex-grow'>
                                  {plan.features &&
                                    Array.isArray(plan.features) &&
                                    plan.features.map(
                                      (feature: any, idx: number) => {
                                        let featureName =
                                          typeof feature === "string"
                                            ? feature
                                            : [feature.name, feature.value]
                                                .filter(Boolean)
                                                .join(" • ");
                                        if (isUltimate) {
                                          if (
                                            typeof feature === "string" &&
                                            /search and AI credits|career workflow credits|3,?500/i.test(
                                              feature,
                                            )
                                          ) {
                                            featureName = `${ultimateCreditsMonthly.toLocaleString()} career workflow credits per month`;
                                          } else if (
                                            typeof feature === "string" &&
                                            /governed auto-apply|150.*runs/i.test(
                                              feature,
                                            )
                                          ) {
                                            featureName = `${ultimateScaledRuns.toLocaleString()} governed auto-apply runs per month`;
                                          }
                                        }
                                        const isIncluded =
                                          typeof feature === "object"
                                            ? feature.included !== false
                                            : true;

                                        if (!isIncluded) return null;

                                        return (
                                          <div
                                            key={idx}
                                            className='flex items-start gap-3 group/item'
                                          >
                                            <div
                                              className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                                                plan.name === "Pro"
                                                  ? "bg-blue-500/20 text-blue-400"
                                                  : plan.name === "Ultimate"
                                                    ? "bg-purple-500/20 text-purple-400"
                                                    : "bg-brand/20 text-brand"
                                              }`}
                                            >
                                              <Check className='w-2.5 h-2.5' />
                                            </div>
                                            <span
                                              className={`text-sm ${textColors.tertiary} group-hover/item:text-foreground transition-colors`}
                                            >
                                              {featureName}
                                            </span>
                                          </div>
                                        );
                                      },
                                    )}
                                </div>
                              </>
                            );
                          })()}

                          {/* CTA */}
                          <div className='mt-auto'>
                            {(() => {
                              const checkoutCadence =
                                billingInterval === "yearly"
                                  ? "Yearly"
                                  : billingInterval === "quarterly" &&
                                      planSupportsQuarterly(plan.name)
                                    ? "Quarterly"
                                    : null;
                              const ctaLabel = isCurrentPlan
                                ? "Current plan"
                                : plan.name === "Free"
                                  ? "Included"
                                  : checkoutCadence
                                    ? `Checkout ${plan.name} · ${checkoutCadence}`
                                    : `Upgrade to ${plan.name}`;
                              return (
                                <Button
                                  className={`w-full min-h-12 h-auto py-3 px-3 sm:px-4 font-bold text-xs sm:text-sm tracking-wide transition-all duration-300 ${
                                    isCurrentPlan
                                      ? "bg-foreground/5 text-foreground/50 cursor-default border border-foreground/5"
                                      : plan.name === "Basics"
                                        ? "bg-brand text-background hover:bg-brand hover:brightness-110 hover:shadow-[0_0_20px_rgba(29,255,0,0.4)] hover:scale-[1.02]"
                                        : plan.name === "Pro"
                                          ? "bg-blue-500 text-foreground hover:bg-blue-600 hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:scale-[1.02]"
                                          : plan.name === "Ultimate"
                                            ? "bg-purple-600 text-foreground hover:bg-purple-700 hover:shadow-[0_0_20px_rgba(147,51,234,0.4)] hover:scale-[1.02]"
                                            : "bg-foreground text-background hover:bg-gray-200"
                                  }`}
                                  disabled={
                                    isCurrentPlan ||
                                    processingPayment ||
                                    plan.name === "Free"
                                  }
                                  onClick={() =>
                                    !isCurrentPlan &&
                                    plan.name !== "Free" &&
                                    handlePayment("subscription", {
                                      ...plan,
                                      billingCycle:
                                        effectiveBillingCycleForPlan(
                                          plan.name,
                                          billingInterval,
                                        ),
                                      ...(plan.name === "Ultimate"
                                        ? {
                                            ultimateCreditsPerMonth:
                                              ultimateCreditsMonthly,
                                          }
                                        : {}),
                                    })
                                  }
                                >
                                  <span className='flex w-full items-center justify-center gap-2'>
                                    {processingPayment && !isCurrentPlan ? (
                                      <Loader2
                                        className='h-4 w-4 shrink-0 animate-spin'
                                        aria-hidden
                                      />
                                    ) : null}
                                    <span className='min-w-0 text-center uppercase leading-snug [overflow-wrap:anywhere]'>
                                      {ctaLabel}
                                    </span>
                                    {!isCurrentPlan && !processingPayment ? (
                                      <ArrowRight
                                        className='h-4 w-4 shrink-0'
                                        strokeWidth={2.5}
                                        aria-hidden
                                      />
                                    ) : null}
                                  </span>
                                </Button>
                              );
                            })()}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Parallel Boosts Tab */}
          {activeTab === "boosts" && (
            <motion.div
              key='boosts'
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className='space-y-12'
            >
              <section className='relative overflow-hidden rounded-[2rem] border border-brand/20 bg-[radial-gradient(circle_at_top,rgba(29,255,0,0.14),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-6 sm:p-8 lg:p-10'>
                <div className='absolute inset-0 bg-[linear-gradient(135deg,rgba(29,255,0,0.05),transparent_36%,rgba(255,255,255,0.04))]' />
                <div className='relative space-y-8'>
                  <div className='max-w-3xl'>
                    <div className='mb-4 inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-brand'>
                      <Rocket className='h-3.5 w-3.5' />
                      Parallel Auto-Apply Boost
                    </div>
                    <h2 className='text-3xl font-black uppercase leading-[0.95] text-foreground sm:text-4xl lg:text-5xl'>
                      Clear your ready queue faster without changing your main plan
                    </h2>
                    <p className='mt-4 max-w-2xl text-sm leading-7 text-gray-300 sm:text-base'>
                      Your subscription sets the baseline automation speed.
                      Boost packs stack on top for the current billing period so
                      queued opportunities can keep moving when search volume spikes.
                    </p>
                  </div>

                  <div className='grid gap-4 lg:grid-cols-[1.2fr_0.8fr]'>
                    <div className='rounded-[1.75rem] border border-white/8 bg-black/35 p-5 sm:p-6'>
                      <p className='text-sm font-semibold text-gray-300'>
                        Current parallel capacity
                      </p>
                      <div className='mt-5 grid gap-3 sm:grid-cols-3'>
                        <div className='rounded-2xl border border-white/6 bg-white/[0.04] p-4'>
                          <p className='text-xs uppercase tracking-[0.22em] text-gray-500'>
                            Active now
                          </p>
                          <p className='mt-3 text-3xl font-bold text-foreground'>
                            {activeAutoApplyRuns}/{totalConcurrencySlots}
                          </p>
                          <p className='mt-1 text-sm text-gray-400'>
                            queued auto-apply workflows
                          </p>
                        </div>
                        <div className='rounded-2xl border border-white/6 bg-white/[0.04] p-4'>
                          <p className='text-xs uppercase tracking-[0.22em] text-gray-500'>
                            From {subscriptionTier}
                          </p>
                          <p className='mt-3 text-3xl font-bold text-foreground'>
                            {baseConcurrencySlots}
                          </p>
                          <p className='mt-1 text-sm text-gray-400'>
                            included parallel slots
                          </p>
                        </div>
                        <div className='rounded-2xl border border-brand/20 bg-brand/10 p-4'>
                          <p className='text-xs uppercase tracking-[0.22em] text-brand/80'>
                            Purchased boost
                          </p>
                          <p className='mt-3 text-3xl font-bold text-brand'>
                            +{boostedConcurrencySlots}
                          </p>
                          <p className='mt-1 text-sm text-brand/80'>
                            active this billing period
                          </p>
                        </div>
                      </div>

                      <div className='mt-5 flex flex-wrap gap-3 text-sm text-gray-300'>
                        <span className='inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-2'>
                          <Gauge className='h-4 w-4 text-brand' />
                          Faster automation bursts
                        </span>
                        <span className='inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-2'>
                          <Layers3 className='h-4 w-4 text-brand' />
                          Stacks with paid plans
                        </span>
                        <span className='inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-2'>
                          <Clock3 className='h-4 w-4 text-brand' />
                          Valid through your current billing window
                        </span>
                      </div>
                    </div>

                    <div className='rounded-[1.75rem] border border-white/8 bg-black/35 p-5 sm:p-6'>
                      <p className='text-sm font-semibold text-gray-300'>
                        How it works
                      </p>
                      <div className='mt-4 space-y-3'>
                        {[
                          "Your plan includes a base number of parallel auto-apply runs.",
                          "Buying a boost increases that cap immediately after payment is verified.",
                          "Boosted slots are applied only to the current billing period, keeping limits tied to subscription value.",
                        ].map((item) => (
                          <div
                            key={item}
                            className='flex gap-3 rounded-2xl border border-white/6 bg-white/[0.04] p-3.5'
                          >
                            <div className='mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand'>
                              <Check className='h-3.5 w-3.5' />
                            </div>
                            <p className='text-sm leading-6 text-gray-300'>{item}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
                    {concurrencyPacks.map((pack) => {
                      const isSelected = selectedConcurrencyPack?.sku === pack.sku;
                      return (
                        <button
                          key={pack.sku}
                          type='button'
                          onClick={() => setSelectedConcurrencyPackSku(pack.sku)}
                          className={`group rounded-[1.6rem] border p-5 text-left transition-all duration-300 ${
                            isSelected
                              ? "border-brand bg-brand/10 shadow-[0_0_28px_rgba(29,255,0,0.18)]"
                              : "border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]"
                          }`}
                        >
                          <div className='flex items-start justify-between gap-3'>
                            <div>
                              <p className='text-lg font-bold text-foreground'>
                                +{pack.parallel_slots} parallel
                              </p>
                              <p className='mt-1 text-sm text-gray-400'>{pack.name}</p>
                            </div>
                            {pack.is_popular ? (
                              <span className='rounded-full border border-brand/25 bg-brand/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-brand'>
                                Popular
                              </span>
                            ) : null}
                          </div>
                          <p className='mt-4 min-h-[48px] text-sm leading-6 text-gray-400'>
                            {pack.description}
                          </p>
                          <div className='mt-5 flex items-end justify-between gap-3'>
                            <div>
                              <p className='text-3xl font-bold text-foreground'>
                                ${pack.price_usd}
                              </p>
                              <p className='text-xs uppercase tracking-[0.18em] text-gray-500'>
                                current billing period
                              </p>
                            </div>
                            <div
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                isSelected
                                  ? "bg-brand text-background"
                                  : "bg-white/[0.08] text-gray-300"
                              }`}
                            >
                              {isSelected ? "Selected" : "Select"}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedConcurrencyPack ? (
                    <div className='flex flex-col gap-4 rounded-[1.75rem] border border-brand/20 bg-black/35 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6'>
                      <div>
                        <p className='text-sm uppercase tracking-[0.22em] text-brand/80'>
                          Selected boost
                        </p>
                        <p className='mt-2 text-2xl font-bold text-foreground'>
                          {selectedConcurrencyPack.name} adds +
                          {selectedConcurrencyPack.parallel_slots} parallel auto-apply
                          slot
                          {selectedConcurrencyPack.parallel_slots === 1 ? "" : "s"}
                        </p>
                        <p className='mt-2 text-sm leading-6 text-gray-400'>
                          Your live capacity would move from {baseConcurrencySlots}
                          {" "}to{" "}
                          {baseConcurrencySlots +
                            boostedConcurrencySlots +
                            selectedConcurrencyPack.parallel_slots}{" "}
                          total parallel runs after payment is applied.
                        </p>
                      </div>
                      <Button
                        className='h-14 min-w-[220px] rounded-full bg-brand px-8 text-base font-bold text-background shadow-[0_0_32px_rgba(29,255,0,0.28)] hover:bg-brand hover:brightness-110'
                        disabled={processingPayment}
                        onClick={() =>
                          handlePayment("concurrency_pack", selectedConcurrencyPack)
                        }
                      >
                        {processingPayment ? (
                          <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                        ) : null}
                        Buy for ${selectedConcurrencyPack.price_usd}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </section>
            </motion.div>
          )}

          {/* Credit Packs Tab */}
          {activeTab === "packs" && (
            <motion.div
              key='packs'
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className='space-y-12'
            >
              <div className='text-center'>
                <h2 className='text-3xl font-bold text-foreground mb-3'>
                  One-Time Momentum Packs
                </h2>
                <p className='text-gray-400'>
                  Credit packs are emergency fuel for active opportunities. Plans
                  are still the better deal when you want JobRaker running every week.
                </p>
              </div>

              <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-4'>
                {creditPacks.map((pack, index) => (
                  <motion.div
                    key={pack.sku}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className='relative'
                  >
                    {pack.is_popular && (
                      <div className='absolute -top-3 left-0 right-0 flex justify-center z-10'>
                        <span className='bg-brand text-background text-[10px] font-bold px-3 py-1 rounded-full shadow-lg shadow-brand/20'>
                          BEST VALUE
                        </span>
                      </div>
                    )}

                    <Card
                      className={`relative overflow-hidden transition-all duration-300 group hover:scale-105 ${
                        pack.is_popular
                          ? "border-brand/30 bg-gradient-to-b from-brand/5 to-transparent"
                          : "border-foreground/10 bg-foreground/[0.02] hover:bg-foreground/[0.04]"
                      }`}
                    >
                      <CardContent className='p-6 flex flex-col items-center text-center'>
                        <div
                          className={`p-3 rounded-2xl mb-4 ${
                            pack.is_popular
                              ? "bg-brand/10 text-brand"
                              : "bg-foreground/5 text-gray-400 group-hover:text-foreground group-hover:bg-foreground/10"
                          } transition-colors`}
                        >
                          <Package className='w-8 h-8' />
                        </div>

                        {pack.bonus_credits > 0 && (
                          <span className='mb-2 text-[10px] font-bold text-brand bg-brand/10 px-2 py-0.5 rounded-full flex items-center gap-1 border border-brand/20'>
                            <Sparkles className='w-3 h-3' />+
                            {pack.bonus_credits} BONUS
                          </span>
                        )}

                        <div className='mb-6'>
                          <p className='text-4xl font-bold text-foreground mb-1'>
                            {(
                              pack.credits + pack.bonus_credits
                            ).toLocaleString()}
                          </p>
                          <p className='text-xs text-gray-400 uppercase tracking-widest font-medium'>
                            Search + AI Credits
                          </p>
                          <p className='text-xs text-gray-500 mt-2'>
                            {pack.description}
                          </p>
                        </div>

                        <div className='w-full pt-4 border-t border-foreground/5'>
                          <p className='text-3xl font-bold text-foreground mb-1'>
                            ${pack.price_usd}
                          </p>
                          <p className='text-xs text-gray-500 mb-4'>
                            $
                            {(
                              pack.price_usd /
                              (pack.credits + pack.bonus_credits)
                            ).toFixed(3)}{" "}
                            per credit
                          </p>

                          <Button
                            className={`w-full font-bold transition-all duration-300 ${
                              pack.is_popular
                                ? "bg-brand text-background hover:bg-brand hover:brightness-110 shadow-[0_0_20px_rgba(29,255,0,0.3)]"
                                : "bg-foreground/10 text-foreground hover:bg-foreground/20"
                            }`}
                            disabled={processingPayment}
                            onClick={() => handlePayment("credit_pack", pack)}
                          >
                            {processingPayment ? (
                              <Loader2 className='w-4 h-4 animate-spin mr-2' />
                            ) : null}
                            PURCHASE
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {/* Benefits Section */}
              <div className='grid gap-6 sm:grid-cols-3 max-w-4xl mx-auto pt-8 border-t border-foreground/10'>
                {[
                  {
                    icon: <Shield className='w-6 h-6' />,
                    title: "Secure Payment",
                    desc: "Encrypted & safe checkout",
                  },
                  {
                    icon: <Infinity className='w-6 h-6' />,
                    title: "Never Expire",
                    desc: "Credits last until you use them",
                  },
                  {
                    icon: <Target className='w-6 h-6' />,
                    title: "Instant Delivery",
                    desc: "Start applying in seconds",
                  },
                ].map((benefit, idx) => (
                  <div
                    key={idx}
                    className='flex flex-col items-center text-center p-6 rounded-2xl bg-foreground/[0.02] border border-foreground/5 hover:bg-foreground/[0.04] transition-colors'
                  >
                    <div className='p-3 rounded-full bg-brand/10 text-brand mb-3'>
                      {benefit.icon}
                    </div>
                    <p className='font-bold text-foreground mb-1'>
                      {benefit.title}
                    </p>
                    <p className='text-sm text-gray-400'>{benefit.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Credit Costs Tab */}
          {activeTab === "costs" && (
            <motion.div
              key='costs'
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className='space-y-8'
            >
              <div className='text-center'>
                <h2 className='text-3xl font-bold text-foreground mb-3'>
                  Credit Costs
                </h2>
                <p className='text-gray-400 max-w-2xl mx-auto'>
                  See how many credits each feature uses. Some AI features
                  include a free monthly allowance on paid plans before credits
                  are deducted.
                </p>
              </div>

              <div className='grid gap-6 lg:grid-cols-2'>
                {/* AI & Chat */}
                <Card className='border-foreground/10 bg-foreground/[0.02] backdrop-blur-md overflow-hidden'>
                  <CardHeader className='border-b border-foreground/10 bg-foreground/[0.02] pb-4'>
                    <CardTitle className='text-lg font-bold text-foreground flex items-center gap-2'>
                      <div className='p-2 rounded-lg bg-purple-500/10 border border-purple-500/20'>
                        <Sparkles className='w-4 h-4 text-purple-400' />
                      </div>
                      AI Features
                    </CardTitle>
                    <CardDescription className='text-gray-400'>
                      Chat, cover letters, resume analysis, and more
                    </CardDescription>
                  </CardHeader>
                  <CardContent className='p-0'>
                    <div className='divide-y divide-foreground/5'>
                      {[
                        ...((): Array<{
                          label: string;
                          cost: number;
                          note: string;
                        }> => {
                          const chatBase = creditCosts.find(
                            (c) =>
                              c.feature_type === "ai_chat" &&
                              c.feature_name === "chat_message",
                          );
                          const chatAgent = creditCosts.find(
                            (c) =>
                              c.feature_type === "ai_chat" &&
                              c.feature_name === "agent_tool_round",
                          );
                          const rows: Array<{
                            label: string;
                            cost: number;
                            note: string;
                          }> = [
                            {
                              label: "AI chat — base message (Ask or Agent)",
                              cost: chatBase?.cost ?? 1,
                              note: "Pro: 50 free/mo, Ultimate: 200 free/mo, then 1 credit each (Ask uses this only)",
                            },
                            {
                              label: "Agent mode - tool use",
                              cost: chatAgent?.cost ?? 1,
                              note: "+1 credit per tool the agent runs after the base message credit",
                            },
                          ];
                          return rows;
                        })(),
                        ...creditCosts
                          .filter(
                            (c) =>
                              (c.feature_type === "cover_letter" ||
                                c.feature_type === "analysis" ||
                                c.feature_type === "job_search") &&
                              c.feature_name !== "search" &&
                              c.feature_name !== "auto_apply",
                          )
                          .map((c) => ({
                            label:
                              c.description.split("(")[0].trim() ||
                              `${c.feature_type} / ${c.feature_name}`,
                            cost: c.cost,
                            note:
                              c.cost === 0
                                ? "Included with Basics+ plan"
                                : `${c.cost} credit${c.cost !== 1 ? "s" : ""} per use`,
                          })),
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          className='flex items-start justify-between p-4 hover:bg-foreground/[0.02] transition-colors gap-3'
                        >
                          <div className='flex-1 min-w-0'>
                            <p className='text-sm font-medium text-foreground'>
                              {item.label}
                            </p>
                            <p className='text-xs text-gray-500 mt-0.5'>
                              {item.note}
                            </p>
                          </div>
                          <div className='flex items-center gap-1.5 pl-4 flex-shrink-0 pt-0.5'>
                            <span
                              className={`text-lg font-bold font-mono ${item.cost === 0 ? "text-brand" : "text-foreground"}`}
                            >
                              {item.cost === 0 ? "FREE" : item.cost}
                            </span>
                            {item.cost > 0 && (
                              <Coins className='w-3.5 h-3.5 text-brand' />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Search & Applications */}
                <Card className='border-foreground/10 bg-foreground/[0.02] backdrop-blur-md overflow-hidden'>
                  <CardHeader className='border-b border-foreground/10 bg-foreground/[0.02] pb-4'>
                    <CardTitle className='text-lg font-bold text-foreground flex items-center gap-2'>
                      <div className='p-2 rounded-lg bg-blue-500/10 border border-blue-500/20'>
                        <Target className='w-4 h-4 text-blue-400' />
                      </div>
                      Search & Applications
                    </CardTitle>
                    <CardDescription className='text-gray-400'>
                      Job search, auto-apply, and application tracking
                    </CardDescription>
                  </CardHeader>
                  <CardContent className='p-0'>
                    <div className='divide-y divide-foreground/5'>
                      {[
                        ...creditCosts
                          .filter(
                            (c) =>
                              c.feature_name === "search" ||
                              c.feature_name === "auto_apply" ||
                              c.feature_type === "job",
                          )
                          .map((c) => ({
                            label:
                              c.description.split("(")[0].trim() ||
                              `${c.feature_type} / ${c.feature_name}`,
                            cost: c.cost,
                            note:
                              c.feature_name === "auto_apply"
                                ? `${c.cost} credits per job (governed runs from your plan)`
                                : c.cost === 0
                                  ? "Included with plan"
                                  : `${c.cost} credit${c.cost !== 1 ? "s" : ""} per use`,
                          })),
                        ...(creditCosts.filter(
                          (c) =>
                            c.feature_name === "search" ||
                            c.feature_name === "auto_apply" ||
                            c.feature_type === "job",
                        ).length === 0
                          ? [
                              {
                                label: "Job Search",
                                cost: 1,
                                note: "1 credit per job found",
                              },
                              {
                                label: "Auto Apply",
                                cost: 5,
                                note: "5 credits per application (governed runs from your plan)",
                              },
                            ]
                          : []),
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          className='flex items-start justify-between p-4 hover:bg-foreground/[0.02] transition-colors gap-3'
                        >
                          <div className='flex-1 min-w-0'>
                            <p className='text-sm font-medium text-foreground'>
                              {item.label}
                            </p>
                            <p className='text-xs text-gray-500 mt-0.5'>
                              {item.note}
                            </p>
                          </div>
                          <div className='flex items-center gap-1.5 pl-4 flex-shrink-0 pt-0.5'>
                            <span
                              className={`text-lg font-bold font-mono ${item.cost === 0 ? "text-brand" : "text-foreground"}`}
                            >
                              {item.cost === 0 ? "FREE" : item.cost}
                            </span>
                            {item.cost > 0 && (
                              <Coins className='w-3.5 h-3.5 text-brand' />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Full Plan Comparison Grid */}
              {(() => {
                const tierOrder = [
                  "Free",
                  "Basics",
                  "Pro",
                  "Ultimate",
                ] as const;
                const tierColors: Record<
                  string,
                  { text: string; accent: string; bg: string }
                > = {
                  Free: {
                    text: "text-gray-400",
                    accent: "text-foreground",
                    bg: "bg-foreground/5",
                  },
                  Basics: {
                    text: "text-brand",
                    accent: "text-brand",
                    bg: "bg-brand/5",
                  },
                  Pro: {
                    text: "text-blue-400",
                    accent: "text-blue-300",
                    bg: "bg-blue-500/5",
                  },
                  Ultimate: {
                    text: "text-purple-400",
                    accent: "text-purple-300",
                    bg: "bg-purple-500/5",
                  },
                };

                type CellVal = string | number | boolean;
                interface CompRow {
                  feature: string;
                  sub?: string;
                  values: Record<string, CellVal>;
                }
                interface CompSection {
                  title: string;
                  rows: CompRow[];
                }

                const sections: CompSection[] = [
                  {
                    title: "Quotas & Limits",
                    rows: [
                      {
                        feature: "Search & AI Credits",
                        sub: "Monthly allowance",
                        values: {
                          Free: 10,
                          Basics: 250,
                          Pro: "1,200",
                          Ultimate: "3,500",
                        },
                      },
                      {
                        feature: "Auto-Apply Runs",
                        sub: "Governed automations per month",
                        values: { Free: 2, Basics: 15, Pro: 50, Ultimate: 150 },
                      },
                      {
                        feature: "Free AI Chat Messages",
                        sub: "Before credits are consumed",
                        values: {
                          Free: false,
                          Basics: false,
                          Pro: "50/mo",
                          Ultimate: "200/mo",
                        },
                      },
                    ],
                  },
                  {
                    title: "AI Features",
                    rows: [
                      {
                        feature: "AI Job Fit Evaluation",
                        sub: "Blockers, match score, interview angles",
                        values: {
                          Free: false,
                          Basics: true,
                          Pro: true,
                          Ultimate: true,
                        },
                      },
                      {
                        feature: "Cover Letter Generation",
                        sub: "Tailored per job description",
                        values: {
                          Free: false,
                          Basics: true,
                          Pro: true,
                          Ultimate: true,
                        },
                      },
                      {
                        feature: "Resume Tailoring",
                        sub: "AI rewrites to match each posting",
                        values: {
                          Free: false,
                          Basics: true,
                          Pro: true,
                          Ultimate: true,
                        },
                      },
                      {
                        feature: "AI Chat Assistant",
                        sub: "Agent mode with profile/resume actions",
                        values: {
                          Free: false,
                          Basics: false,
                          Pro: true,
                          Ultimate: true,
                        },
                      },
                      {
                        feature: "Interview Stories",
                        sub: "AI-generated STAR stories from your experience",
                        values: {
                          Free: false,
                          Basics: false,
                          Pro: true,
                          Ultimate: true,
                        },
                      },
                    ],
                  },
                  {
                    title: "Automation & Applications",
                    rows: [
                      {
                        feature: "Single-Job Auto Apply",
                        sub: "Review + submit one application at a time",
                        values: {
                          Free: true,
                          Basics: true,
                          Pro: true,
                          Ultimate: true,
                        },
                      },
                      {
                        feature: "Batch Auto Apply",
                        sub: "True Autonomy — apply to many jobs at once",
                        values: {
                          Free: true,
                          Basics: true,
                          Pro: true,
                          Ultimate: true,
                        },
                      },
                      {
                        feature: "Per-Job Cover Letters in Batch",
                        sub: "Tailored letter generated per job in batch mode",
                        values: {
                          Free: false,
                          Basics: true,
                          Pro: true,
                          Ultimate: true,
                        },
                      },
                      {
                        feature: "Draft-First Autopilot",
                        sub: "AI generates a custom resume + cover letter draft",
                        values: {
                          Free: false,
                          Basics: true,
                          Pro: true,
                          Ultimate: true,
                        },
                      },
                    ],
                  },
                  {
                    title: "Search & Discovery",
                    rows: [
                      {
                        feature: "Job Search",
                        sub: "Hybrid discovery across multiple sources",
                        values: {
                          Free: true,
                          Basics: true,
                          Pro: true,
                          Ultimate: true,
                        },
                      },
                      {
                        feature: "Results per Search",
                        sub: "Maximum jobs returned per query",
                        values: {
                          Free: 10,
                          Basics: 20,
                          Pro: 50,
                          Ultimate: 100,
                        },
                      },
                      {
                        feature: "Job Match Insights",
                        sub: "AI match score + breakdown per job",
                        values: {
                          Free: false,
                          Basics: true,
                          Pro: true,
                          Ultimate: true,
                        },
                      },
                    ],
                  },
                  {
                    title: "Platform",
                    rows: [
                      {
                        feature: "Resume Builder & Storage",
                        values: {
                          Free: true,
                          Basics: true,
                          Pro: true,
                          Ultimate: true,
                        },
                      },
                      {
                        feature: "Application Tracking",
                        values: {
                          Free: true,
                          Basics: true,
                          Pro: true,
                          Ultimate: true,
                        },
                      },
                      {
                        feature: "Candidate Memory",
                        sub: "AI remembers your preferences across sessions",
                        values: {
                          Free: false,
                          Basics: true,
                          Pro: true,
                          Ultimate: true,
                        },
                      },
                      {
                        feature: "Priority Automation Queue",
                        sub: "Your jobs are processed first",
                        values: {
                          Free: false,
                          Basics: false,
                          Pro: true,
                          Ultimate: true,
                        },
                      },
                      {
                        feature: "Priority Support",
                        values: {
                          Free: false,
                          Basics: false,
                          Pro: false,
                          Ultimate: true,
                        },
                      },
                    ],
                  },
                ];

                const renderCell = (val: CellVal, tier: string) => {
                  const colors = tierColors[tier] || tierColors.Free;
                  if (val === true)
                    return (
                      <Check className={`w-4 h-4 mx-auto ${colors.accent}`} />
                    );
                  if (val === false)
                    return (
                      <span className='text-gray-600 select-none'>&times;</span>
                    );
                  return (
                    <span className={`font-semibold ${colors.accent}`}>
                      {String(val)}
                    </span>
                  );
                };

                return (
                  <Card className='border-foreground/10 bg-foreground/[0.02] backdrop-blur-md overflow-hidden'>
                    <CardHeader className='border-b border-foreground/10 bg-foreground/[0.02] pb-3'>
                      <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                        <div>
                          <CardTitle className='text-xl font-bold text-foreground tracking-tight'>
                            Compare Plans
                          </CardTitle>
                          <CardDescription className='text-gray-400 mt-1'>
                            Every feature across all tiers — see exactly what
                            you get
                          </CardDescription>
                        </div>
                        <div className='flex flex-wrap items-center gap-2 rounded-full border border-foreground/10 bg-foreground/5 p-1 text-xs'>
                          <button
                            onClick={() => setBillingInterval("monthly")}
                            className={`rounded-full px-3 py-1 font-semibold transition-all ${
                              billingInterval === "monthly"
                                ? "bg-brand text-background shadow-sm"
                                : "text-gray-400 hover:text-foreground"
                            }`}
                          >
                            Monthly
                          </button>
                          <button
                            onClick={() => setBillingInterval("quarterly")}
                            className={`rounded-full px-3 py-1 font-semibold transition-all inline-flex items-center gap-1 ${
                              billingInterval === "quarterly"
                                ? "bg-brand text-background shadow-sm"
                                : "text-gray-400 hover:text-foreground"
                            }`}
                          >
                            Quarterly
                            <span className='text-[10px] font-bold opacity-80'>
                              10–15% OFF
                            </span>
                          </button>
                          <button
                            onClick={() => setBillingInterval("yearly")}
                            className={`rounded-full px-3 py-1 font-semibold transition-all ${
                              billingInterval === "yearly"
                                ? "bg-brand text-background shadow-sm"
                                : "text-gray-400 hover:text-foreground"
                            }`}
                          >
                            Annual{" "}
                            <span className='text-[10px] font-bold ml-0.5 opacity-80'>
                              {annualSavingsPctApprox}% OFF
                            </span>
                          </button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className='p-0'>
                      <div className='overflow-x-auto'>
                        <table className='w-full min-w-[680px] table-fixed border-separate border-spacing-0 text-sm'>
                          <colgroup>
                            <col className='w-[26%] min-w-[160px]' />
                            <col className='w-[18.5%]' />
                            <col className='w-[18.5%]' />
                            <col className='w-[18.5%]' />
                            <col className='w-[18.5%]' />
                          </colgroup>
                          <thead className='sticky top-0 z-10 bg-background/95 backdrop-blur-md'>
                            <tr className='border-b border-foreground/10'>
                              <th className='text-left px-5 py-4' />
                              {tierOrder.map((tier) => {
                                const def = BILLING_PLAN_DEFINITIONS.find(
                                  (p) => p.name === tier,
                                );
                                const tablePricingInterval =
                                  effectiveBillingCycleForPlan(
                                    tier,
                                    billingInterval,
                                  );
                                const pricing = getPlanPricingDisplay(
                                  tier,
                                  tablePricingInterval,
                                  def?.monthlyPriceUsd ?? 0,
                                  promoApplied,
                                );
                                const isCurrent = subscriptionTier === tier;
                                const colors = tierColors[tier];
                                return (
                                  <th
                                    key={tier}
                                    className='text-center px-3 py-4 align-top'
                                  >
                                    <div className='flex flex-col items-center gap-1.5'>
                                      <span
                                        className={`text-sm font-bold ${colors.text}`}
                                      >
                                        {tier}
                                      </span>
                                      {def && def.monthlyPriceUsd > 0 ? (
                                        <div className='flex items-baseline gap-0.5'>
                                          <span className='text-lg font-extrabold text-foreground'>
                                            ${pricing.headline}
                                          </span>
                                          <span className='text-[11px] text-gray-500'>
                                            {pricing.suffix}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className='text-[11px] text-gray-500'>
                                          Free
                                        </span>
                                      )}
                                      {pricing.savingsBadge && (
                                        <span className='rounded-full bg-brand/10 border border-brand/30 px-2 py-0.5 text-[10px] font-bold text-brand'>
                                          {pricing.savingsBadge}
                                        </span>
                                      )}
                                      {isCurrent ? (
                                        <span className='mt-1 rounded-full border border-foreground/20 bg-foreground/5 px-3 py-1 text-[10px] font-bold text-foreground/60 tracking-wider'>
                                          CURRENT
                                        </span>
                                      ) : tier !== "Free" ? (
                                        <Button
                                          size='sm'
                                          disabled={processingPayment}
                                          onClick={() =>
                                            handlePayment("subscription", {
                                              ...(plans.find(
                                                (p) => p.name === tier,
                                              ) || {
                                                id: tier.toLowerCase(),
                                                name: tier,
                                              }),
                                              billingCycle:
                                                effectiveBillingCycleForPlan(
                                                  tier,
                                                  billingInterval,
                                                ),
                                            })
                                          }
                                          className={`mt-1 h-7 rounded-full px-4 text-[10px] font-bold tracking-wide transition-all ${
                                            tier === "Basics"
                                              ? "bg-brand text-background hover:brightness-110"
                                              : tier === "Pro"
                                                ? "bg-blue-500 text-white hover:bg-blue-600"
                                                : "bg-purple-600 text-white hover:bg-purple-700"
                                          }`}
                                        >
                                          {isCurrent ? "Current" : "Upgrade"}
                                        </Button>
                                      ) : null}
                                    </div>
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {sections.map((section) => (
                              <>
                                <tr key={`h-${section.title}`}>
                                  <td
                                    colSpan={tierOrder.length + 1}
                                    className='px-5 pt-5 pb-2 text-xs font-bold uppercase tracking-widest text-brand'
                                  >
                                    {section.title}
                                  </td>
                                </tr>
                                {section.rows.map((row) => (
                                  <tr
                                    key={row.feature}
                                    className='group border-t border-foreground/5 hover:bg-foreground/[0.02] transition-colors'
                                  >
                                    <td className='px-5 py-3'>
                                      <span className='text-sm font-medium text-foreground'>
                                        {row.feature}
                                      </span>
                                      {row.sub && (
                                        <span className='block text-[11px] text-gray-500 mt-0.5'>
                                          {row.sub}
                                        </span>
                                      )}
                                    </td>
                                    {tierOrder.map((tier) => (
                                      <td
                                        key={tier}
                                        className={`text-center px-3 py-3 ${
                                          subscriptionTier === tier
                                            ? (tierColors[tier]?.bg ?? "")
                                            : ""
                                        }`}
                                      >
                                        {renderCell(
                                          row.values[tier] ?? false,
                                          tier,
                                        )}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
            </motion.div>
          )}

          {/* Transaction History Tab */}
          {activeTab === "history" && (
            <motion.div
              key='history'
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className='border-foreground/10 bg-foreground/[0.02] backdrop-blur-md overflow-hidden'>
                <CardHeader className='border-b border-foreground/10 bg-foreground/[0.02]'>
                  <div className='flex flex-col gap-4 sm:flex-row sm:items-center justify-between'>
                    <div>
                      <CardTitle className='text-xl font-bold text-foreground flex items-center gap-2'>
                        Transaction History
                      </CardTitle>
                      <CardDescription className='text-gray-400 mt-1'>
                        View all your credit transactions and usage history
                      </CardDescription>
                    </div>
                    <Button
                      variant='outline'
                      size='sm'
                      className='gap-2 border-foreground/10 bg-foreground/5 hover:bg-foreground/10 text-gray-300 hover:text-foreground shrink-0'
                      onClick={exportTransactionsCSV}
                    >
                      <Download className='w-4 h-4' />
                      Export CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className='p-0'>
                  {groupedTransactions.length === 0 ? (
                    <div className='flex flex-col items-center justify-center py-24 text-center'>
                      <div className='p-4 rounded-full bg-foreground/5 mb-4 border border-foreground/10'>
                        <History className='w-8 h-8 text-gray-400' />
                      </div>
                      <p className='text-foreground font-medium text-lg mb-1'>
                        No transactions yet
                      </p>
                      <p className='text-gray-500 text-sm max-w-xs'>
                        Your credit purchases and usage will appear here once
                        you start using JobRaker.
                      </p>
                    </div>
                  ) : (
                    <div className='divide-y divide-foreground/5'>
                      {groupedTransactions.map((item, index) => {
                        if (item.isGroupedRun) {
                          const isExpanded = !!expandedRuns[item.agent_run_id];
                          const netAmount = item.amount;
                          const balanceAfter = item.balance_after;
                          const createdAt = item.created_at;
                          const description = item.description;
                          const runId = item.agent_run_id;

                          // Use Receipt icon for grouped agent run
                          const iconData = {
                            icon: <Receipt className="w-4 h-4" />,
                            color: "text-brand bg-brand/10 border-brand/20",
                          };

                          return (
                            <div key={runId} className="border-b border-foreground/5 last:border-0">
                              <div
                                onClick={() => toggleRunExpansion(runId)}
                                className="p-4 sm:p-6 hover:bg-foreground/[0.02] transition-colors duration-200 flex items-center justify-between gap-4 cursor-pointer group"
                              >
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                  <div
                                    className={`p-2.5 rounded-xl border ${iconData.color} group-hover:scale-110 transition-transform`}
                                  >
                                    {iconData.icon}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-foreground font-medium truncate">
                                        {description}
                                      </p>
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-foreground/5 text-gray-400 font-medium">
                                        Run Receipt
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-500 font-mono mt-0.5">
                                      {formatDate(createdAt)}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-4">
                                  <div className="text-right flex-shrink-0">
                                    <p
                                      className={`text-lg font-bold font-mono ${
                                        netAmount > 0
                                          ? "text-brand"
                                          : netAmount < 0
                                            ? "text-foreground"
                                            : "text-gray-400"
                                      }`}
                                    >
                                      {netAmount > 0 ? "+" : ""}
                                      {netAmount}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      Balance: {balanceAfter}
                                    </p>
                                  </div>
                                  <div className="text-gray-500 group-hover:text-foreground transition-colors">
                                    {isExpanded ? (
                                      <ChevronDown className="w-5 h-5" />
                                    ) : (
                                      <ChevronRight className="w-5 h-5" />
                                    )}
                                  </div>
                                </div>
                              </div>

                              <AnimatePresence initial={false}>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden bg-foreground/[0.01] border-t border-foreground/5"
                                  >
                                    <div className="p-4 sm:p-6 pl-12 sm:pl-16 space-y-4">
                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border border-foreground/5 rounded-xl p-4 bg-background/50">
                                        <div>
                                          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Reserved Amount</p>
                                          <p className="text-base font-bold font-mono text-foreground mt-1">
                                            {(() => {
                                              const resTx = item.transactions.find(t => t.amount < 0);
                                              return resTx ? `${resTx.amount} credits` : "0 credits";
                                            })()}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Refunded Amount</p>
                                          <p className="text-base font-bold font-mono text-brand mt-1">
                                            {(() => {
                                              const refTx = item.transactions.find(t => t.amount > 0);
                                              return refTx ? `+${refTx.amount} credits` : "0 credits";
                                            })()}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Net Charged</p>
                                          <p className="text-base font-bold font-mono text-foreground mt-1">
                                            {netAmount} credits
                                          </p>
                                        </div>
                                      </div>

                                      <div className="space-y-2">
                                        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Ledger Breakdown</h4>
                                        <div className="border border-foreground/5 rounded-xl overflow-hidden divide-y divide-foreground/5 bg-background/20">
                                          {item.transactions.map((tx) => {
                                            const subIconData = getTransactionIcon(tx.transaction_type ?? tx.type ?? "refill");
                                            return (
                                              <div key={tx.id} className="p-3 flex items-center justify-between text-sm">
                                                <div className="flex items-center gap-3">
                                                  <div className={`p-1.5 rounded-lg border ${subIconData.color}`}>
                                                    {subIconData.icon}
                                                  </div>
                                                  <div>
                                                    <p className="text-foreground font-medium text-xs sm:text-sm">
                                                      {tx.description}
                                                    </p>
                                                    <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                                                      {formatDate(tx.created_at)}
                                                    </p>
                                                  </div>
                                                </div>
                                                <div className="text-right">
                                                  <p className={`font-semibold font-mono text-xs sm:text-sm ${
                                                    tx.amount > 0 ? "text-brand" : "text-foreground"
                                                  }`}>
                                                    {tx.amount > 0 ? "+" : ""}{tx.amount}
                                                  </p>
                                                  <p className="text-[10px] text-gray-500">
                                                    After: {tx.balance_after}
                                                  </p>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        } else {
                          const iconData = getTransactionIcon(
                            item.transaction_type ??
                              item.type ??
                              "refill",
                          );
                          return (
                            <motion.div
                              key={item.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className='p-4 sm:p-6 hover:bg-foreground/[0.02] transition-colors duration-200 flex items-center justify-between gap-4 group'
                            >
                              <div className='flex items-center gap-4 flex-1 min-w-0'>
                                <div
                                  className={`p-2.5 rounded-xl border ${iconData.color} group-hover:scale-110 transition-transform`}
                                >
                                  {iconData.icon}
                                </div>
                                <div className='flex-1 min-w-0'>
                                  <p className='text-foreground font-medium truncate mb-0.5'>
                                    {item.description}
                                  </p>
                                  <p className='text-xs text-gray-500 font-mono'>
                                    {formatDate(item.created_at)}
                                  </p>
                                </div>
                              </div>
                              <div className='text-right flex-shrink-0'>
                                <p
                                  className={`text-lg font-bold font-mono ${
                                    item.amount > 0
                                      ? "text-brand"
                                      : "text-foreground"
                                  }`}
                                >
                                  {item.amount > 0 ? "+" : ""}
                                  {item.amount}
                                </p>
                                <p className='text-xs text-gray-500'>
                                  Balance: {item.balance_after}
                                </p>
                              </div>
                            </motion.div>
                          );
                        }
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <BillingFAQSection />
      </div>
    </div>
  );
};


