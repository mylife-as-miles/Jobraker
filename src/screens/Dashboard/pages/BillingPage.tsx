import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { createClient } from '@/lib/supabaseClient';
import { 
  Coins, Crown, Zap, ArrowRight, Calendar, History, TrendingUp, 
  Sparkles, Package, Check, Star, ArrowUpRight, Download,
  Shield, Infinity, Target, Loader2, Receipt, Percent
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ui/toast';
import {
  BILLING_CREDIT_PACK_DEFINITIONS,
  BILLING_PLAN_DEFINITIONS,
} from '@/lib/billingCatalog';
import { BillingFAQSection } from '@/components/billing/BillingFAQSection';

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  credits_per_month: number;
  auto_apply_monthly_limit?: number;
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
  transaction_type: string;
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
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

const defaultCreditPacks: CreditPack[] = BILLING_CREDIT_PACK_DEFINITIONS.map((pack) => ({
  sku: pack.sku,
  name: pack.name,
  description: pack.description,
  credits: pack.credits,
  price_usd: pack.priceUsd,
  bonus_credits: pack.bonusCredits,
  is_popular: pack.isPopular,
}));

const defaultPlans: SubscriptionPlan[] = BILLING_PLAN_DEFINITIONS.map((plan) => ({
  id: plan.tier.toLowerCase(),
  name: plan.name,
  price: plan.monthlyPriceUsd,
  credits_per_month: plan.creditsPerMonth,
  auto_apply_monthly_limit: plan.autoApplyRunsPerMonth,
  description: plan.description,
  features: plan.marketingFeatures,
}));

type BillingInterval = 'monthly' | 'quarterly' | 'yearly';

function planSupportsQuarterly(planName: string): boolean {
  return planName === 'Pro' || planName === 'Ultimate';
}

/** Basics/Free have no quarterly SKU — checkout and displayed price use monthly. */
function effectiveBillingCycleForPlan(
  planName: string,
  interval: BillingInterval,
): BillingInterval {
  if (interval === 'quarterly' && !planSupportsQuarterly(planName)) {
    return 'monthly';
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
    .from('subscription_plans')
    .select('id')
    .eq('is_active', true)
    .eq('name', name)
    .maybeSingle();
  if (error) {
    console.warn('resolveSubscriptionPlanUuidForCheckout', error);
    return null;
  }
  const row = data as { id?: string } | null;
  return row?.id ?? null;
}

function inferBillingCycleFromSubscriptionPeriod(
  start: string | null | undefined,
  end: string | null | undefined,
): 'monthly' | 'quarterly' | 'yearly' | null {
  if (!start || !end) return null;
  const t0 = new Date(start).getTime();
  const t1 = new Date(end).getTime();
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) return null;
  const days = (t1 - t0) / (1000 * 60 * 60 * 24);
  if (days >= 200) return 'yearly';
  if (days >= 75) return 'quarterly';
  if (days >= 18) return 'monthly';
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
  cycle: 'monthly' | 'quarterly' | 'yearly' | null,
): Date | null {
  if (!periodEnd) return null;
  const d = new Date(periodEnd);
  if (!Number.isFinite(d.getTime())) return null;
  const now = new Date();
  if (d > now) return d;
  const stepMonths = cycle === 'yearly' ? 12 : cycle === 'quarterly' ? 3 : 1;
  let projected = new Date(d);
  while (projected <= now) {
    projected = addCalendarMonths(projected, stepMonths);
  }
  return projected;
}

/** Explains the date shown in the billing card (next charge), not the monthly credit cron. */
function getPaymentRenewalCaption(
  cancelAtPeriodEnd: boolean,
  cycle: 'monthly' | 'quarterly' | 'yearly' | null,
): { primary: string; secondary?: string } {
  if (cancelAtPeriodEnd) {
    return {
      primary: 'Scheduled to end on this date. You will not be charged again after that.',
    };
  }
  if (cycle === 'yearly') {
    return {
      primary:
        'Annual billing: your next charge is on this date. Cancel before then if you do not want another year.',
      secondary:
        'Per-month credits are your monthly allowance during the year, not separate monthly payments.',
    };
  }
  if (cycle === 'quarterly') {
    return {
      primary:
        'Quarterly billing: your next charge is on this date. Cancel before then if you do not want another quarter.',
      secondary:
        'Per-month credits are your monthly allowance during the quarter, not separate monthly payments.',
    };
  }
  if (cycle === 'monthly') {
    return {
      primary:
        'Monthly billing: your next charge is on this date. Cancel before then if you do not want another month.',
    };
  }
  return {
    primary: 'Next charge is on this date unless you cancel beforehand.',
  };
}

function getPlanPricingDisplay(
  planName: string,
  interval: BillingInterval,
  fallbackMonthlyFromDb: number,
): PlanPricingDisplay {
  const def = BILLING_PLAN_DEFINITIONS.find((p) => p.name === planName);
  const monthly = def?.monthlyPriceUsd ?? fallbackMonthlyFromDb;

  if (!def || monthly <= 0) {
    return {
      headline: '0',
      suffix: '',
      compareAt: null,
      subline: 'No card required',
      savingsBadge: null,
      effectiveMonthly: null,
    };
  }

  const quarterlyUsd = def.quarterlyPriceUsd ?? 0;
  if (interval === 'quarterly' && quarterlyUsd > 0) {
    const stacked = monthly * 3;
    const saved = stacked - quarterlyUsd;
    const pct = stacked > 0 ? Math.round((saved / stacked) * 100) : 40;
    const eqMo = quarterlyUsd / 3;
    return {
      headline: quarterlyUsd.toLocaleString('en-US', { maximumFractionDigits: 0 }),
      suffix: '/qtr',
      compareAt: `3 × $${monthly}/mo → $${stacked.toLocaleString('en-US')}`,
      subline: `≈ $${Math.round(eqMo)}/mo equivalent · billed every 3 months`,
      savingsBadge: `Save $${saved.toLocaleString('en-US')} (${pct}% vs monthly)`,
      effectiveMonthly: eqMo,
    };
  }

  if (interval === 'yearly' && def.yearlyPriceUsd > 0) {
    const yearly = def.yearlyPriceUsd;
    const stacked = monthly * 12;
    const saved = stacked - yearly;
    const pct = Math.round((saved / stacked) * 100);
    const eqMo = yearly / 12;
    return {
      headline: yearly.toLocaleString('en-US', { maximumFractionDigits: 0 }),
      suffix: '/yr',
      compareAt: `12 × $${monthly}/mo → $${stacked.toLocaleString('en-US')}`,
      subline: `≈ $${Math.round(eqMo)}/mo when paid annually`,
      savingsBadge: `Save $${saved.toLocaleString('en-US')} (${pct}% vs monthly)`,
      effectiveMonthly: eqMo,
    };
  }

  return {
    headline: monthly.toLocaleString('en-US', { maximumFractionDigits: 0 }),
    suffix: '/mo',
    compareAt: null,
    subline: 'Billed monthly · cancel anytime',
    savingsBadge: null,
    effectiveMonthly: monthly,
  };
}

const ULTIMATE_CREDITS_SLIDER = { min: 3500, max: 10500, step: 500 } as const;

function getUltimatePricingDisplay(
  interval: BillingInterval,
  selectedCredits: number,
  fallbackMonthlyFromDb: number,
): PlanPricingDisplay {
  const def = BILLING_PLAN_DEFINITIONS.find((p) => p.name === 'Ultimate');
  if (!def) {
    return getPlanPricingDisplay('Ultimate', interval, fallbackMonthlyFromDb);
  }
  const ratio = selectedCredits / def.creditsPerMonth;
  const monthlyUsd = (def.monthlyPriceUsd ?? fallbackMonthlyFromDb) * ratio;
  const quarterlyBase = def.quarterlyPriceUsd ?? 0;

  if (interval === 'quarterly' && quarterlyBase > 0) {
    const quarterly = Math.round(quarterlyBase * ratio * 100) / 100;
    const stacked = monthlyUsd * 3;
    const saved = stacked - quarterly;
    const pct = stacked > 0 ? Math.round((saved / stacked) * 100) : 40;
    const eqMo = quarterly / 3;
    return {
      headline: quarterly.toLocaleString('en-US', { maximumFractionDigits: 0 }),
      suffix: '/qtr',
      compareAt: `3 × $${Math.round(monthlyUsd)}/mo → $${Math.round(stacked).toLocaleString('en-US')}`,
      subline: `≈ $${Math.round(eqMo)}/mo equivalent · billed every 3 months`,
      savingsBadge: `Save $${Math.round(saved).toLocaleString('en-US')} (${pct}% vs monthly)`,
      effectiveMonthly: eqMo,
    };
  }

  if (interval === 'yearly' && def.yearlyPriceUsd > 0) {
    const yearly = Math.round(def.yearlyPriceUsd * ratio);
    const stacked = monthlyUsd * 12;
    const saved = stacked - yearly;
    const pct = stacked > 0 ? Math.round((saved / stacked) * 100) : 0;
    const eqMo = yearly / 12;
    return {
      headline: yearly.toLocaleString('en-US', { maximumFractionDigits: 0 }),
      suffix: '/yr',
      compareAt: `12 × $${Math.round(monthlyUsd)}/mo → $${Math.round(stacked).toLocaleString('en-US')}`,
      subline: `≈ $${Math.round(eqMo)}/mo when paid annually`,
      savingsBadge: `Save $${Math.round(saved).toLocaleString('en-US')} (${pct}% vs monthly)`,
      effectiveMonthly: eqMo,
    };
  }

  return {
    headline: Math.round(monthlyUsd).toLocaleString('en-US', { maximumFractionDigits: 0 }),
    suffix: '/mo',
    compareAt: null,
    subline: 'Billed monthly · cancel anytime',
    savingsBadge: null,
    effectiveMonthly: monthlyUsd,
  };
}

export const BillingPage = () => {
  const [currentCredits, setCurrentCredits] = useState(0);
  const [subscriptionTier, setSubscriptionTier] = useState<'Free' | 'Basics' | 'Pro' | 'Ultimate'>('Free');
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [creditPacks, setCreditPacks] = useState<CreditPack[]>(defaultCreditPacks);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [creditCosts, setCreditCosts] = useState<Array<{
    feature_type: string;
    feature_name: string;
    cost: number;
    description: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'subscription' | 'packs' | 'costs' | 'history'>('subscription');
  const [processingPayment, setProcessingPayment] = useState(false);
  /** Billing cadence toggle (quarterly applies to Pro & Ultimate only at checkout). */
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly');
  /** Ultimate: extra credits above catalog base (3500); scales price at checkout. */
  const [ultimateCreditsMonthly, setUltimateCreditsMonthly] = useState(
    ULTIMATE_CREDITS_SLIDER.min,
  );
  /** Inferred from subscription period (or last successful order) — used so "CURRENT" matches monthly vs annual. */
  const [activeSubscriptionBillingCycle, setActiveSubscriptionBillingCycle] = useState<
    'monthly' | 'quarterly' | 'yearly' | null
  >(null);
  const supabase = useMemo(() => createClient(), []);
  const { notify, error: toastError } = useToast();

  /** Single headline discount % (Basics tier) so the toggle badge stays honest if catalog prices change. */
  const annualSavingsPctApprox = useMemo(() => {
    const b = BILLING_PLAN_DEFINITIONS.find((p) => p.name === 'Basics');
    if (!b?.yearlyPriceUsd || b.monthlyPriceUsd <= 0) return 17;
    const stacked = b.monthlyPriceUsd * 12;
    return Math.round(((stacked - b.yearlyPriceUsd) / stacked) * 100);
  }, []);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      // If no user (e.g. preview mode), populate with defaults
      if (!userId) {
        setPlans(defaultPlans);
        setCreditPacks(defaultCreditPacks);
        setBillingInterval('monthly');
        setCancelAtPeriodEnd(false);
        setActiveSubscriptionBillingCycle(null);
        setTransactions([
          { id: '1', transaction_type: 'bonus', amount: 50, balance_after: 50, description: 'Welcome Bonus', created_at: new Date().toISOString() }
        ]);
        return;
      }

      // Fetch current credits
      const { data: creditsData } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (creditsData) {
        setCurrentCredits(creditsData.balance);
      }

      // Fetch subscription (period length reveals monthly vs yearly billing)
      const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select(
          'current_period_start, current_period_end, cancel_at_period_end, subscription_plans(name, credits_per_month)',
        )
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      let resolvedCycle: 'monthly' | 'quarterly' | 'yearly' | null = null;

      if (subscription) {
        const planName = (subscription as any)?.subscription_plans?.name;
        setSubscriptionTier(planName || 'Free');
        setCurrentPeriodEnd((subscription as any).current_period_end);
        setCancelAtPeriodEnd(Boolean((subscription as any).cancel_at_period_end));
        const start = (subscription as any).current_period_start as string | undefined;
        const end = (subscription as any).current_period_end as string | undefined;
        resolvedCycle = inferBillingCycleFromSubscriptionPeriod(start, end);
      } else {
        setCancelAtPeriodEnd(false);
      }

      if (!resolvedCycle) {
        const { data: lastSubOrder } = await supabase
          .from('orders')
          .select('payment_cycle, metadata')
          .eq('user_id', userId)
          .eq('plan_type', 'subscription')
          .eq('is_success', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const pc = (lastSubOrder as { payment_cycle?: string } | null)?.payment_cycle;
        const meta = (lastSubOrder as { metadata?: { billing_cycle?: string } } | null)?.metadata;
        if (pc === 'yearly' || meta?.billing_cycle === 'yearly') resolvedCycle = 'yearly';
        else if (pc === 'quarterly' || meta?.billing_cycle === 'quarterly') {
          resolvedCycle = 'quarterly';
        } else if (pc === 'monthly' || meta?.billing_cycle === 'monthly') {
          resolvedCycle = 'monthly';
        }
      }

      setActiveSubscriptionBillingCycle(resolvedCycle);

      // Default the Monthly/Annual toggle to monthly so checkout matches "billed each month"
      // unless we know this member is on (or last bought) an annual term.
      if (subscription) {
        const planName = (subscription as any)?.subscription_plans?.name as string | undefined;
        if (planName && planName !== 'Free') {
          setBillingInterval(resolvedCycle ?? 'monthly');
        } else {
          setBillingInterval(resolvedCycle ?? 'monthly');
        }
      } else {
        setBillingInterval(resolvedCycle ?? 'monthly');
      }

      // Fetch all subscription plans
      const { data: plansData } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (plansData && plansData.length > 0) {
        setPlans(plansData);
      } else {
        setPlans(defaultPlans);
      }

      const { data: packsData } = await supabase
        .from('credit_pack_catalog')
        .select('sku, name, description, credits, bonus_credits, price_usd, is_popular')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (packsData && packsData.length > 0) {
        setCreditPacks(packsData as CreditPack[]);
      } else {
        setCreditPacks(defaultCreditPacks);
      }

      // Fetch credit costs
      const { data: costsData } = await supabase
        .from('credit_costs')
        .select('feature_type, feature_name, cost, description')
        .eq('is_active', true)
        .order('feature_type', { ascending: true });

      if (costsData) {
        setCreditCosts(costsData);
      }

      // Fetch recent transactions
      const { data: transactionsData } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (transactionsData) {
        setTransactions(transactionsData);
      }
    } catch (error) {
      console.error('Error fetching billing data:', error);
      // Fallback to defaults on error
      setPlans(defaultPlans);
      setCreditPacks(defaultCreditPacks);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (type: 'subscription' | 'credit_pack', item: any) => {
    try {
      setProcessingPayment(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        notify({
          title: "Authentication Required",
          description: "Please sign in to make a purchase.",
          variant: "error",
        });
        return;
      }

      let payload: Record<string, unknown>;
      if (type === 'credit_pack') {
        payload = { purchaseType: type, packSku: item.sku };
      } else {
        const planId = await resolveSubscriptionPlanUuidForCheckout(supabase, {
          id: String(item.id ?? ''),
          name: typeof item.name === 'string' ? item.name : undefined,
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
          ...(item.name === "Ultimate" && typeof item.ultimateCreditsPerMonth === "number"
            ? { ultimateCreditsPerMonth: item.ultimateCreditsPerMonth }
            : {}),
        };
      }

      const { data, error } = await supabase.functions.invoke("init-payment", {
        body: payload,
      });

      const body = data as { url?: string; error?: string } | null;
      if (error) {
        throw new Error(
          body?.error ?? (error as Error).message ?? "Failed to initialize payment",
        );
      }
      if (body?.error && !body.url) {
        throw new Error(body.error);
      }
      if (body?.url) {
        window.location.href = body.url;
        return;
      }
      throw new Error("No payment URL returned");
    } catch (error: unknown) {
      console.error("Payment initialization failed:", error);
      const message =
        error instanceof Error ? error.message : "Failed to initialize payment. Please try again.";
      toastError("Payment Error", message);
    } finally {
      setProcessingPayment(false);
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'Pro':
        return <Zap className="w-5 h-5 text-blue-400" />;
      case 'Ultimate':
        return <Crown className="w-5 h-5 text-purple-400" />;
      default:
        return <Coins className="w-5 h-5 text-[#1dff00]" />;
    }
  };

  const getTierGradient = (tier: string) => {
    switch (tier) {
      case 'Pro':
        return 'from-blue-500 via-blue-600 to-blue-700';
      case 'Ultimate':
        return 'from-purple-500 via-purple-600 to-purple-700';
      default:
        return 'from-[#1dff00] via-[#1dff00] to-[#1dff00]';
    }
  };

  const getTierTextColor = (_tier: string) => {
    return {
      primary: 'text-foreground',
      secondary: 'text-foreground/70',
      tertiary: 'text-foreground/80',
      muted: 'text-foreground/50'
    };
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'bonus':
        return { icon: <Sparkles className="w-4 h-4" />, color: 'text-[#1dff00] bg-[#1dff00]/10 border-[#1dff00]/20' };
      case 'refill':
        return { icon: <TrendingUp className="w-4 h-4" />, color: 'text-[#1dff00] bg-[#1dff00]/10 border-[#1dff00]/20' };
      case 'spend':
        return { icon: <ArrowUpRight className="w-4 h-4" />, color: 'text-[#1dff00] bg-[#1dff00]/10 border-[#1dff00]/20' };
      default:
        return { icon: <Coins className="w-4 h-4" />, color: 'text-gray-400 bg-gray-400/10 border-gray-400/20' };
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-6">
        <div className="h-8 w-48 bg-foreground/10 rounded-lg animate-pulse" />
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-foreground/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background selection:bg-[#1dff00]/30">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-foreground/10 bg-gradient-to-br from-background to-background">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#1dff00]/5 rounded-full blur-[120px] mix-blend-screen animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[120px] mix-blend-screen animate-pulse" style={{ animationDelay: '2s' }} />
          {/* Grid overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1dff0005_1px,transparent_1px),linear-gradient(to_bottom,#1dff0005_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold mb-6 tracking-tight">
              <span className="bg-gradient-to-r from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent">
                Billing &
              </span>{' '}
              <span className="text-[#1dff00] drop-shadow-[0_0_15px_rgba(29,255,0,0.3)]">
                Credits
              </span>
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Price search and drafting separately from automation. Plans include governed auto-apply runs, while packs top up search and AI usage.
            </p>
          </motion.div>

          {/* Stats Cards */}
          <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
            {/* Current Balance */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="relative overflow-hidden border-foreground/10 bg-foreground/[0.03] backdrop-blur-xl group hover:border-[#1dff00]/30 transition-colors duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-[#1dff00]/5 to-transparent opacity-50" />
                <CardContent className="relative p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-xl bg-[#1dff00]/10 border border-[#1dff00]/20 group-hover:bg-[#1dff00]/20 transition-colors">
                      <Coins className="w-6 h-6 text-[#1dff00]" />
                    </div>
                    <span className="text-[10px] tracking-wider font-bold text-[#1dff00] bg-[#1dff00]/10 px-2.5 py-1 rounded-full border border-[#1dff00]/20">
                      BALANCE
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-400 font-medium">Available Credits</p>
                    <p className="text-4xl font-bold text-foreground tracking-tight">
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
              <Card className="relative overflow-hidden border-foreground/10 bg-foreground/[0.03] backdrop-blur-xl group hover:border-foreground/20 transition-colors duration-300">
                <div className={`absolute inset-0 bg-gradient-to-br ${getTierGradient(subscriptionTier)} opacity-5`} />
                <CardContent className="relative p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${getTierGradient(subscriptionTier)}/10 border border-foreground/10 group-hover:border-foreground/20 transition-colors`}>
                      {getTierIcon(subscriptionTier)}
                    </div>
                    <span className={`text-[10px] tracking-wider font-bold px-2.5 py-1 rounded-full border ${
                      subscriptionTier === 'Pro' ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' :
                      subscriptionTier === 'Ultimate' ? 'bg-purple-500/10 text-purple-300 border-purple-500/20' :
                      'bg-[#1dff00]/10 text-[#1dff00] border-[#1dff00]/20'
                    }`}>
                      ACTIVE PLAN
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-400 font-medium">Current Tier</p>
                    <p className="text-4xl font-bold text-foreground tracking-tight">
                      {subscriptionTier}
                    </p>
                    <p className="text-sm text-gray-500">
                      {plans.find((p) => p.name === subscriptionTier)?.credits_per_month?.toLocaleString() || 0} credits
                      {plans.find((p) => p.name === subscriptionTier)?.auto_apply_monthly_limit
                        ? ` + ${plans.find((p) => p.name === subscriptionTier)?.auto_apply_monthly_limit} auto-apply runs/mo`
                        : ' / manual only'}
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
              <Card className="relative overflow-hidden border-foreground/10 bg-foreground/[0.03] backdrop-blur-xl group hover:border-blue-400/30 transition-colors duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-50" />
                <CardContent className="relative p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors">
                      <Calendar className="w-6 h-6 text-blue-400" />
                    </div>
                    <span className="text-[10px] tracking-wider font-bold text-blue-400 bg-blue-400/10 px-2.5 py-1 rounded-full border border-blue-400/20">
                      BILLING
                    </span>
                  </div>
                  {(() => {
                    const next = projectNextRenewalDate(currentPeriodEnd, activeSubscriptionBillingCycle);
                    const { primary, secondary } = getPaymentRenewalCaption(
                      cancelAtPeriodEnd,
                      activeSubscriptionBillingCycle,
                    );
                    return (
                      <div className="space-y-1">
                        <p className="text-sm text-gray-400 font-medium">Next payment</p>
                        <p className="text-lg font-bold text-foreground tracking-tight pt-2">
                          {next
                            ? next.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : 'Not scheduled'}
                        </p>
                        <p className="text-xs text-gray-500 pt-1">{primary}</p>
                        {secondary ? (
                          <p className="text-[11px] text-gray-600 leading-snug pt-0.5">{secondary}</p>
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Custom Tab Navigation */}
        <div className="flex justify-center mb-12">
          <div className="flex items-center p-1 bg-foreground/5 rounded-full border border-foreground/10 backdrop-blur-md">
            {[
              { id: 'subscription', label: 'Plans', icon: <Star className="w-4 h-4" /> },
              { id: 'packs', label: 'Credit Packs', icon: <Package className="w-4 h-4" /> },
              { id: 'costs', label: 'Credit Costs', icon: <Receipt className="w-4 h-4" /> },
              { id: 'history', label: 'History', icon: <History className="w-4 h-4" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-full transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'text-background shadow-lg'
                    : 'text-gray-400 hover:text-foreground hover:bg-foreground/5'
                }`}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-[#1dff00] rounded-full"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  {tab.icon}
                  {tab.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* Subscription Plans Tab */}
          {activeTab === 'subscription' && (
            <motion.div
              key="subscription"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              <div className="max-w-3xl mx-auto text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  Monthly, quarterly (Pro: 10% off, Ultimate: 15% off vs three monthly payments), or annual—same features, different billing cadence.
                </p>
                <div className="inline-flex flex-wrap justify-center gap-1 p-1 rounded-2xl bg-foreground/5 border border-foreground/10 backdrop-blur-sm max-w-full">
                  <button
                    type="button"
                    onClick={() => setBillingInterval('monthly')}
                    className={`relative px-4 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      billingInterval === 'monthly'
                        ? 'bg-foreground text-background shadow-md'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingInterval('quarterly')}
                    className={`relative px-4 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors inline-flex items-center gap-2 ${
                      billingInterval === 'quarterly'
                        ? 'bg-foreground text-background shadow-md'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Quarterly
                    <span className="text-[10px] font-bold uppercase tracking-wide opacity-90 border border-current/30 rounded-full px-2 py-0.5">
                      10–15% off
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingInterval('yearly')}
                    className={`relative px-4 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors inline-flex items-center gap-2 ${
                      billingInterval === 'yearly'
                        ? 'bg-[#1dff00] text-background shadow-md'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Annual
                    <span className="text-[10px] font-bold uppercase tracking-wide opacity-90 border border-current/30 rounded-full px-2 py-0.5">
                      ~{annualSavingsPctApprox}% off
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 2xl:grid-cols-4 2xl:gap-6">
                {plans.map((plan, index) => {
                  const cycleForCurrent =
                    activeSubscriptionBillingCycle ?? 'monthly';
                  const isCurrentPlan =
                    plan.name === subscriptionTier &&
                    (subscriptionTier === 'Free' ||
                      billingInterval === cycleForCurrent);
                  const isPro = plan.name === 'Pro';
                  const isUltimate = plan.name === 'Ultimate';
                  const pricingInterval = effectiveBillingCycleForPlan(plan.name, billingInterval);
                  const ultimateBaseCredits =
                    BILLING_PLAN_DEFINITIONS.find((p) => p.name === 'Ultimate')?.creditsPerMonth ??
                    3500;
                  const ultimateScaledRuns = isUltimate
                    ? Math.max(
                        1,
                        Math.round(
                          ((plan.auto_apply_monthly_limit || 0) * ultimateCreditsMonthly) /
                            ultimateBaseCredits,
                        ),
                      )
                    : plan.auto_apply_monthly_limit ?? 0;
                  const pricing = isUltimate
                    ? getUltimatePricingDisplay(pricingInterval, ultimateCreditsMonthly, plan.price)
                    : getPlanPricingDisplay(plan.name, pricingInterval, plan.price);
                  
                  return (
                    <motion.div
                      key={plan.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="relative h-full min-w-0"
                    >
                      {(isPro || isUltimate) && (
                        <div className="absolute -top-3 left-0 right-0 flex justify-center z-20">
                          <span className={`text-[10px] font-bold px-3 py-1 rounded-full shadow-lg border ${
                            isUltimate
                              ? 'bg-purple-500 text-foreground border-purple-400'
                              : 'bg-[#1dff00] text-background border-[#1dff00]'
                          }`}>
                            {isUltimate
                              ? billingInterval === 'quarterly'
                                ? 'SCALE · QUARTERLY'
                                : billingInterval === 'yearly'
                                  ? 'MAX VALUE · ANNUAL'
                                  : 'MAXIMUM POWER'
                              : billingInterval === 'yearly'
                                ? 'SWEET SPOT · ANNUAL'
                                : billingInterval === 'quarterly'
                                  ? 'SMART COMMIT · QUARTERLY'
                                  : 'MOST POPULAR'}
                          </span>
                        </div>
                      )}
                      
                      <Card className={`group relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden transition-all duration-300 ${
                        isCurrentPlan 
                          ? 'border-[#1dff00]/50 bg-gradient-to-b from-[#1dff00]/10 to-transparent shadow-[0_0_40px_-10px_rgba(29,255,0,0.2)]'
                          : isPro && (billingInterval === 'yearly' || billingInterval === 'quarterly')
                          ? 'ring-2 ring-blue-400/45 border-blue-400/25 bg-foreground/[0.02] hover:bg-foreground/[0.04] shadow-[0_0_36px_-10px_rgba(59,130,246,0.25)] hover:-translate-y-1'
                          : 'border-foreground/10 bg-foreground/[0.02] hover:bg-foreground/[0.04] hover:border-foreground/20 hover:shadow-xl hover:shadow-[#1dff00]/5 hover:-translate-y-1'
                      }`}>
                        {/* Gradient accent top border */}
                        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${getTierGradient(plan.name)} opacity-70`} />

                        {isCurrentPlan && (
                          <div className="absolute top-4 right-4 z-10">
                            <span className="px-2.5 py-1 text-[10px] font-bold bg-[#1dff00] text-background border border-[#1dff00] rounded-full flex items-center gap-1 shadow-md">
                              <Check className="w-3 h-3" />
                              CURRENT
                            </span>
                          </div>
                        )}

                        <CardContent className="flex h-full min-h-0 w-full min-w-0 flex-col p-5 sm:p-6">
                          {(() => {
                            const textColors = getTierTextColor(plan.name);
                            return (
                              <>
                                {/* Header */}
                                <div className="mb-5 shrink-0">
                                  <div className={`mb-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br sm:h-14 sm:w-14 ${
                                    plan.name === 'Pro' ? 'from-blue-500/20 to-transparent border-blue-500/20' :
                                    plan.name === 'Ultimate' ? 'from-purple-500/20 to-transparent border-purple-500/20' :
                                    'from-[#1dff00]/20 to-transparent border-[#1dff00]/20'
                                  } border border-foreground/5`}>
                                    {getTierIcon(plan.name)}
                                  </div>
                                  <h3 className={`text-xl font-bold tracking-tight sm:text-2xl ${textColors.primary}`}>
                                    {plan.name}
                                  </h3>
                                  <p className={`mt-1 line-clamp-3 text-sm leading-snug ${textColors.secondary}`}>
                                    {plan.description}
                                  </p>
                                </div>

                                {isUltimate ? (
                                  <div className="mb-5 shrink-0 rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                                    <div className="mb-3 flex items-center gap-2">
                                      <Sparkles className="h-4 w-4 shrink-0 text-purple-300" />
                                      <span className={`text-sm font-bold tabular-nums ${textColors.primary}`}>
                                        {ultimateCreditsMonthly.toLocaleString()} credits/mo
                                      </span>
                                    </div>
                                    <p className="mb-4 text-[11px] leading-snug text-muted-foreground">
                                      Slide to add capacity—search, AI chat, and drafting scale with your monthly
                                      credits. Governed auto-apply runs increase in step with your tier.
                                    </p>
                                    <Slider
                                      min={ULTIMATE_CREDITS_SLIDER.min}
                                      max={ULTIMATE_CREDITS_SLIDER.max}
                                      step={ULTIMATE_CREDITS_SLIDER.step}
                                      value={[ultimateCreditsMonthly]}
                                      onValueChange={(v) =>
                                        setUltimateCreditsMonthly(v[0] ?? ULTIMATE_CREDITS_SLIDER.min)
                                      }
                                      aria-label="Ultimate monthly credits"
                                      className="mb-2"
                                    />
                                    <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
                                      <span>{ULTIMATE_CREDITS_SLIDER.min.toLocaleString()}</span>
                                      <span className="font-medium text-foreground/80">
                                        {Math.round(
                                          (ULTIMATE_CREDITS_SLIDER.min + ULTIMATE_CREDITS_SLIDER.max) / 2,
                                        ).toLocaleString()}
                                      </span>
                                      <span>{ULTIMATE_CREDITS_SLIDER.max.toLocaleString()}</span>
                                    </div>
                                  </div>
                                ) : null}

                                {/* Price */}
                                <div className="mb-5 shrink-0 space-y-2 border-b border-foreground/10 pb-5">
                                  <div className="flex items-baseline gap-1.5 flex-wrap">
                                    <span className={`text-4xl font-bold tabular-nums ${textColors.primary}`}>
                                      ${pricing.headline}
                                    </span>
                                    {pricing.suffix ? (
                                      <span className={textColors.tertiary}>{pricing.suffix}</span>
                                    ) : null}
                                  </div>
                                  {pricing.compareAt ? (
                                    <p className="text-xs text-muted-foreground line-through decoration-foreground/35">
                                      {pricing.compareAt}
                                    </p>
                                  ) : null}
                                  {pricing.subline ? (
                                    <p className={`text-sm ${textColors.secondary}`}>{pricing.subline}</p>
                                  ) : null}
                                  {pricing.savingsBadge &&
                                  (billingInterval === 'yearly' || billingInterval === 'quarterly') ? (
                                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1dff00] bg-[#1dff00]/10 border border-[#1dff00]/25 rounded-full px-2.5 py-1 mt-1">
                                      <Percent className="w-3.5 h-3.5 shrink-0" />
                                      {pricing.savingsBadge}
                                    </div>
                                  ) : null}
                                </div>

                                {/* Included usage — single column so narrow plan cards don’t crush side‑by‑side stats */}
                                <div className="mb-6 grid grid-cols-1 gap-3">
                                  <div className="flex min-h-[5rem] items-start gap-3 rounded-xl border border-foreground/5 bg-foreground/5 p-3.5 transition-colors group-hover:bg-foreground/10 sm:min-h-[5.5rem]">
                                    <div className="p-1.5 rounded-lg bg-background/40 shrink-0 mt-0.5">
                                      <Zap className={`w-4 h-4 ${
                                        plan.name === 'Pro' ? 'text-blue-400' :
                                        plan.name === 'Ultimate' ? 'text-purple-400' : 'text-[#1dff00]'
                                      }`} />
                                    </div>
                                    <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                                      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                        <span className={`text-2xl font-bold tabular-nums leading-none tracking-tight ${textColors.primary}`}>
                                          {(isUltimate
                                            ? ultimateCreditsMonthly
                                            : plan.credits_per_month
                                          ).toLocaleString()}
                                        </span>
                                        <span className="text-xs font-medium text-muted-foreground">credits</span>
                                      </div>
                                      <div className="space-y-0.5">
                                        <p className={`text-[10px] font-semibold uppercase tracking-wider ${textColors.muted} leading-tight`}>
                                          Search + AI
                                        </p>
                                        <p className="text-[9px] uppercase tracking-widest text-muted-foreground/75 leading-tight">
                                          per month
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex min-h-[5rem] items-start gap-3 rounded-xl border border-foreground/5 bg-foreground/5 p-3.5 transition-colors group-hover:bg-foreground/10 sm:min-h-[5.5rem]">
                                    <div className="p-1.5 rounded-lg bg-background/40 shrink-0 mt-0.5">
                                      <Target className={`w-4 h-4 ${
                                        plan.name === 'Pro' ? 'text-blue-400' :
                                        plan.name === 'Ultimate' ? 'text-purple-400' : 'text-[#1dff00]'
                                      }`} />
                                    </div>
                                    <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                                      {plan.auto_apply_monthly_limit && plan.auto_apply_monthly_limit > 0 ? (
                                        <>
                                          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                            <span className={`text-2xl font-bold tabular-nums leading-none tracking-tight ${textColors.primary}`}>
                                              {(isUltimate
                                                ? ultimateScaledRuns
                                                : plan.auto_apply_monthly_limit
                                              ).toLocaleString()}
                                            </span>
                                            <span className="text-xs font-medium text-muted-foreground">runs</span>
                                          </div>
                                          <div className="space-y-0.5">
                                            <p className={`text-[10px] font-semibold uppercase tracking-wider ${textColors.muted} leading-tight`}>
                                              Governed
                                            </p>
                                            <p className="text-[9px] uppercase tracking-widest text-muted-foreground/75 leading-tight">
                                              auto apply / mo
                                            </p>
                                          </div>
                                        </>
                                      ) : (
                                        <>
                                          <p className={`text-base font-bold leading-tight ${textColors.primary}`}>
                                            Manual only
                                          </p>
                                          <div className="space-y-0.5">
                                            <p className={`text-[10px] font-semibold uppercase tracking-wider ${textColors.muted} leading-tight`}>
                                              No automation
                                            </p>
                                            <p className="text-[9px] text-muted-foreground/75 leading-snug">
                                              You apply yourself
                                            </p>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Features */}
                                <div className="space-y-3 mb-8 flex-grow">
                                  {plan.features && Array.isArray(plan.features) && plan.features.map((feature: any, idx: number) => {
                                    let featureName =
                                      typeof feature === 'string'
                                        ? feature
                                        : [feature.name, feature.value].filter(Boolean).join(' • ');
                                    if (isUltimate) {
                                      if (
                                        typeof feature === 'string' &&
                                        /search and AI credits|3,?500/i.test(feature)
                                      ) {
                                        featureName = `${ultimateCreditsMonthly.toLocaleString()} search and AI credits per month`;
                                      } else if (
                                        typeof feature === 'string' &&
                                        /governed auto-apply|150.*runs/i.test(feature)
                                      ) {
                                        featureName = `${ultimateScaledRuns.toLocaleString()} governed auto-apply runs per month`;
                                      }
                                    }
                                    const isIncluded = typeof feature === 'object' ? feature.included !== false : true;
                                    
                                    if (!isIncluded) return null;
                                    
                                    return (
                                      <div key={idx} className="flex items-start gap-3 group/item">
                                        <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                                          plan.name === 'Pro' ? 'bg-blue-500/20 text-blue-400' :
                                          plan.name === 'Ultimate' ? 'bg-purple-500/20 text-purple-400' :
                                          'bg-[#1dff00]/20 text-[#1dff00]'
                                        }`}>
                                          <Check className="w-2.5 h-2.5" />
                                        </div>
                                        <span className={`text-sm ${textColors.tertiary} group-hover/item:text-foreground transition-colors`}>{featureName}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            );
                          })()}

                          {/* CTA */}
                          <div className="mt-auto">
                            {(() => {
                              const checkoutCadence =
                                billingInterval === 'yearly'
                                  ? 'Yearly'
                                  : billingInterval === 'quarterly' &&
                                      planSupportsQuarterly(plan.name)
                                    ? 'Quarterly'
                                    : null;
                              const ctaLabel = isCurrentPlan
                                ? 'Current plan'
                                : plan.name === 'Free'
                                  ? 'Included'
                                  : checkoutCadence
                                    ? `Checkout ${plan.name} · ${checkoutCadence}`
                                    : `Upgrade to ${plan.name}`;
                              return (
                            <Button
                              className={`w-full min-h-12 h-auto py-3 px-3 sm:px-4 font-bold text-xs sm:text-sm tracking-wide transition-all duration-300 ${
                                isCurrentPlan
                                  ? 'bg-foreground/5 text-foreground/50 cursor-default border border-foreground/5'
                                  : plan.name === 'Basics'
                                  ? 'bg-[#1dff00] text-background hover:bg-[#1dff00] hover:brightness-110 hover:shadow-[0_0_20px_rgba(29,255,0,0.4)] hover:scale-[1.02]'
                                  : plan.name === 'Pro'
                                  ? 'bg-blue-500 text-foreground hover:bg-blue-600 hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:scale-[1.02]'
                                  : plan.name === 'Ultimate'
                                  ? 'bg-purple-600 text-foreground hover:bg-purple-700 hover:shadow-[0_0_20px_rgba(147,51,234,0.4)] hover:scale-[1.02]'
                                  : 'bg-foreground text-background hover:bg-gray-200'
                              }`}
                              disabled={isCurrentPlan || processingPayment || plan.name === 'Free'}
                              onClick={() =>
                                !isCurrentPlan &&
                                plan.name !== 'Free' &&
                                handlePayment('subscription', {
                                  ...plan,
                                  billingCycle: effectiveBillingCycleForPlan(plan.name, billingInterval),
                                  ...(plan.name === 'Ultimate'
                                    ? { ultimateCreditsPerMonth: ultimateCreditsMonthly }
                                    : {}),
                                })
                              }
                            >
                              <span className="flex w-full items-center justify-center gap-2">
                                {processingPayment && !isCurrentPlan ? (
                                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                                ) : null}
                                <span className="min-w-0 text-center uppercase leading-snug [overflow-wrap:anywhere]">
                                  {ctaLabel}
                                </span>
                                {!isCurrentPlan && !processingPayment ? (
                                  <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
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

          {/* Credit Packs Tab */}
          {activeTab === 'packs' && (
            <motion.div
              key="packs"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="space-y-12"
            >
              <div className="text-center">
                <h2 className="text-3xl font-bold text-foreground mb-3">One-Time Credit Packs</h2>
                <p className="text-gray-400">These packs top up search, evaluation, and drafting. Auto-apply capacity comes from your subscription plan.</p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {creditPacks.map((pack, index) => (
                  <motion.div
                    key={pack.sku}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="relative"
                  >
                    {pack.is_popular && (
                      <div className="absolute -top-3 left-0 right-0 flex justify-center z-10">
                        <span className="bg-[#1dff00] text-background text-[10px] font-bold px-3 py-1 rounded-full shadow-lg shadow-[#1dff00]/20">
                          BEST VALUE
                        </span>
                      </div>
                    )}

                    <Card className={`relative overflow-hidden transition-all duration-300 group hover:scale-105 ${
                      pack.is_popular
                        ? 'border-[#1dff00]/30 bg-gradient-to-b from-[#1dff00]/5 to-transparent'
                        : 'border-foreground/10 bg-foreground/[0.02] hover:bg-foreground/[0.04]'
                    }`}>
                      <CardContent className="p-6 flex flex-col items-center text-center">
                        <div className={`p-3 rounded-2xl mb-4 ${
                          pack.is_popular ? 'bg-[#1dff00]/10 text-[#1dff00]' : 'bg-foreground/5 text-gray-400 group-hover:text-foreground group-hover:bg-foreground/10'
                        } transition-colors`}>
                          <Package className="w-8 h-8" />
                        </div>

                        {pack.bonus_credits > 0 && (
                          <span className="mb-2 text-[10px] font-bold text-[#1dff00] bg-[#1dff00]/10 px-2 py-0.5 rounded-full flex items-center gap-1 border border-[#1dff00]/20">
                            <Sparkles className="w-3 h-3" />
                            +{pack.bonus_credits} BONUS
                          </span>
                        )}

                        <div className="mb-6">
                          <p className="text-4xl font-bold text-foreground mb-1">
                            {(pack.credits + pack.bonus_credits).toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">Search + AI Credits</p>
                          <p className="text-xs text-gray-500 mt-2">{pack.description}</p>
                        </div>

                        <div className="w-full pt-4 border-t border-foreground/5">
                          <p className="text-3xl font-bold text-foreground mb-1">${pack.price_usd}</p>
                          <p className="text-xs text-gray-500 mb-4">
                            ${(pack.price_usd / (pack.credits + pack.bonus_credits)).toFixed(3)} per credit
                          </p>

                          <Button
                            className={`w-full font-bold transition-all duration-300 ${
                              pack.is_popular
                                ? 'bg-[#1dff00] text-background hover:bg-[#1dff00] hover:brightness-110 shadow-[0_0_20px_rgba(29,255,0,0.3)]'
                                : 'bg-foreground/10 text-foreground hover:bg-foreground/20'
                            }`}
                            disabled={processingPayment}
                            onClick={() => handlePayment('credit_pack', pack)}
                          >
                            {processingPayment ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
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
              <div className="grid gap-6 sm:grid-cols-3 max-w-4xl mx-auto pt-8 border-t border-foreground/10">
                {[
                  { icon: <Shield className="w-6 h-6" />, title: 'Secure Payment', desc: 'Encrypted & safe checkout' },
                  { icon: <Infinity className="w-6 h-6" />, title: 'Never Expire', desc: 'Credits last until you use them' },
                  { icon: <Target className="w-6 h-6" />, title: 'Instant Delivery', desc: 'Start applying in seconds' },
                ].map((benefit, idx) => (
                  <div key={idx} className="flex flex-col items-center text-center p-6 rounded-2xl bg-foreground/[0.02] border border-foreground/5 hover:bg-foreground/[0.04] transition-colors">
                    <div className="p-3 rounded-full bg-[#1dff00]/10 text-[#1dff00] mb-3">
                      {benefit.icon}
                    </div>
                    <p className="font-bold text-foreground mb-1">{benefit.title}</p>
                    <p className="text-sm text-gray-400">{benefit.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Credit Costs Tab */}
          {activeTab === 'costs' && (
            <motion.div
              key="costs"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              <div className="text-center">
                <h2 className="text-3xl font-bold text-foreground mb-3">Credit Costs</h2>
                <p className="text-gray-400 max-w-2xl mx-auto">
                  See how many credits each feature uses. Some AI features include a free monthly allowance on paid plans before credits are deducted.
                </p>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                {/* AI & Chat */}
                <Card className="border-foreground/10 bg-foreground/[0.02] backdrop-blur-md overflow-hidden">
                  <CardHeader className="border-b border-foreground/10 bg-foreground/[0.02] pb-4">
                    <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                      </div>
                      AI Features
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      Chat, cover letters, resume analysis, and more
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-foreground/5">
                      {[
                        ...((): Array<{ label: string; cost: number; note: string }> => {
                          const chatBase = creditCosts.find(
                            (c) => c.feature_type === 'ai_chat' && c.feature_name === 'chat_message',
                          );
                          const chatAgent = creditCosts.find(
                            (c) => c.feature_type === 'ai_chat' && c.feature_name === 'agent_tool_round',
                          );
                          const rows: Array<{ label: string; cost: number; note: string }> = [
                            {
                              label: 'AI chat — base message (Ask or Agent)',
                              cost: chatBase?.cost ?? 1,
                              note:
                                'Pro: 50 free/mo, Ultimate: 200 free/mo, then 1 credit each (Ask uses this only)',
                            },
                            {
                              label: 'Agent mode — tool round',
                              cost: chatAgent?.cost ?? 1,
                              note:
                                '+1 credit each time the agent runs a batch of tools (after the base message credit)',
                            },
                          ];
                          return rows;
                        })(),
                        ...creditCosts
                          .filter(
                            (c) =>
                              (c.feature_type === 'cover_letter' ||
                                c.feature_type === 'analysis' ||
                                c.feature_type === 'job_search') &&
                              c.feature_name !== 'search' &&
                              c.feature_name !== 'auto_apply',
                          )
                          .map((c) => ({
                            label: c.description.split('(')[0].trim() || `${c.feature_type} / ${c.feature_name}`,
                            cost: c.cost,
                            note:
                              c.cost === 0
                                ? 'Included with Basics+ plan'
                                : `${c.cost} credit${c.cost !== 1 ? 's' : ''} per use`,
                          })),
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 hover:bg-foreground/[0.02] transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{item.label}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{item.note}</p>
                          </div>
                          <div className="flex items-center gap-1.5 pl-4 flex-shrink-0">
                            <span className={`text-lg font-bold font-mono ${item.cost === 0 ? 'text-[#1dff00]' : 'text-foreground'}`}>
                              {item.cost === 0 ? 'FREE' : item.cost}
                            </span>
                            {item.cost > 0 && <Coins className="w-3.5 h-3.5 text-[#1dff00]" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Search & Applications */}
                <Card className="border-foreground/10 bg-foreground/[0.02] backdrop-blur-md overflow-hidden">
                  <CardHeader className="border-b border-foreground/10 bg-foreground/[0.02] pb-4">
                    <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <Target className="w-4 h-4 text-blue-400" />
                      </div>
                      Search & Applications
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      Job search, auto-apply, and application tracking
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-foreground/5">
                      {[
                        ...creditCosts
                          .filter(c => c.feature_name === 'search' || c.feature_name === 'auto_apply' || c.feature_type === 'job')
                          .map(c => ({
                            label: c.description.split('(')[0].trim() || `${c.feature_type} / ${c.feature_name}`,
                            cost: c.cost,
                            note: c.feature_name === 'auto_apply'
                              ? `${c.cost} credits per job (governed runs from your plan)`
                              : c.cost === 0
                              ? 'Included with plan'
                              : `${c.cost} credit${c.cost !== 1 ? 's' : ''} per use`,
                          })),
                        ...(creditCosts.filter(c => c.feature_name === 'search' || c.feature_name === 'auto_apply' || c.feature_type === 'job').length === 0
                          ? [
                              { label: 'Job Search', cost: 1, note: '1 credit per job found' },
                              { label: 'Auto Apply', cost: 5, note: '5 credits per application (governed runs from your plan)' },
                            ]
                          : []),
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 hover:bg-foreground/[0.02] transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{item.label}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{item.note}</p>
                          </div>
                          <div className="flex items-center gap-1.5 pl-4 flex-shrink-0">
                            <span className={`text-lg font-bold font-mono ${item.cost === 0 ? 'text-[#1dff00]' : 'text-foreground'}`}>
                              {item.cost === 0 ? 'FREE' : item.cost}
                            </span>
                            {item.cost > 0 && <Coins className="w-3.5 h-3.5 text-[#1dff00]" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Full Plan Comparison Grid */}
              {(() => {
                const tierOrder = ['Free', 'Basics', 'Pro', 'Ultimate'] as const;
                const tierColors: Record<string, { text: string; accent: string; bg: string }> = {
                  Free: { text: 'text-gray-400', accent: 'text-foreground', bg: 'bg-foreground/5' },
                  Basics: { text: 'text-[#1dff00]', accent: 'text-[#1dff00]', bg: 'bg-[#1dff00]/5' },
                  Pro: { text: 'text-blue-400', accent: 'text-blue-300', bg: 'bg-blue-500/5' },
                  Ultimate: { text: 'text-purple-400', accent: 'text-purple-300', bg: 'bg-purple-500/5' },
                };

                type CellVal = string | number | boolean;
                interface CompRow { feature: string; sub?: string; values: Record<string, CellVal> }
                interface CompSection { title: string; rows: CompRow[] }

                const sections: CompSection[] = [
                  {
                    title: 'Quotas & Limits',
                    rows: [
                      {
                        feature: 'Search & AI Credits',
                        sub: 'Monthly allowance',
                        values: { Free: 10, Basics: 250, Pro: '1,200', Ultimate: '3,500' },
                      },
                      {
                        feature: 'Auto-Apply Runs',
                        sub: 'Governed automations per month',
                        values: { Free: 2, Basics: 15, Pro: 50, Ultimate: 150 },
                      },
                      {
                        feature: 'Free AI Chat Messages',
                        sub: 'Before credits are consumed',
                        values: { Free: false, Basics: false, Pro: '50/mo', Ultimate: '200/mo' },
                      },
                    ],
                  },
                  {
                    title: 'AI Features',
                    rows: [
                      {
                        feature: 'AI Job Fit Evaluation',
                        sub: 'Blockers, match score, interview angles',
                        values: { Free: false, Basics: true, Pro: true, Ultimate: true },
                      },
                      {
                        feature: 'Cover Letter Generation',
                        sub: 'Tailored per job description',
                        values: { Free: false, Basics: true, Pro: true, Ultimate: true },
                      },
                      {
                        feature: 'Resume Tailoring',
                        sub: 'AI rewrites to match each posting',
                        values: { Free: false, Basics: true, Pro: true, Ultimate: true },
                      },
                      {
                        feature: 'AI Chat Assistant',
                        sub: 'Agent mode with profile/resume actions',
                        values: { Free: false, Basics: false, Pro: true, Ultimate: true },
                      },
                      {
                        feature: 'Interview Stories',
                        sub: 'AI-generated STAR stories from your experience',
                        values: { Free: false, Basics: false, Pro: true, Ultimate: true },
                      },
                    ],
                  },
                  {
                    title: 'Automation & Applications',
                    rows: [
                      {
                        feature: 'Single-Job Auto Apply',
                        sub: 'Review + submit one application at a time',
                        values: { Free: true, Basics: true, Pro: true, Ultimate: true },
                      },
                      {
                        feature: 'Batch Auto Apply',
                        sub: 'True Autonomy — apply to many jobs at once',
                        values: { Free: true, Basics: true, Pro: true, Ultimate: true },
                      },
                      {
                        feature: 'Per-Job Cover Letters in Batch',
                        sub: 'Tailored letter generated per job in batch mode',
                        values: { Free: false, Basics: true, Pro: true, Ultimate: true },
                      },
                      {
                        feature: 'Draft-First Autopilot',
                        sub: 'AI generates a custom resume + cover letter draft',
                        values: { Free: false, Basics: true, Pro: true, Ultimate: true },
                      },
                    ],
                  },
                  {
                    title: 'Search & Discovery',
                    rows: [
                      {
                        feature: 'Job Search',
                        sub: 'Hybrid discovery across multiple sources',
                        values: { Free: true, Basics: true, Pro: true, Ultimate: true },
                      },
                      {
                        feature: 'Results per Search',
                        sub: 'Maximum jobs returned per query',
                        values: { Free: 10, Basics: 20, Pro: 50, Ultimate: 100 },
                      },
                      {
                        feature: 'Job Match Insights',
                        sub: 'AI match score + breakdown per job',
                        values: { Free: false, Basics: true, Pro: true, Ultimate: true },
                      },
                    ],
                  },
                  {
                    title: 'Platform',
                    rows: [
                      {
                        feature: 'Resume Builder & Storage',
                        values: { Free: true, Basics: true, Pro: true, Ultimate: true },
                      },
                      {
                        feature: 'Application Tracking',
                        values: { Free: true, Basics: true, Pro: true, Ultimate: true },
                      },
                      {
                        feature: 'Candidate Memory',
                        sub: 'AI remembers your preferences across sessions',
                        values: { Free: false, Basics: true, Pro: true, Ultimate: true },
                      },
                      {
                        feature: 'Priority Automation Queue',
                        sub: 'Your jobs are processed first',
                        values: { Free: false, Basics: false, Pro: true, Ultimate: true },
                      },
                      {
                        feature: 'Priority Support',
                        values: { Free: false, Basics: false, Pro: false, Ultimate: true },
                      },
                    ],
                  },
                ];

                const renderCell = (val: CellVal, tier: string) => {
                  const colors = tierColors[tier] || tierColors.Free;
                  if (val === true) return <Check className={`w-4 h-4 mx-auto ${colors.accent}`} />;
                  if (val === false) return <span className="text-gray-600 select-none">&times;</span>;
                  return (
                    <span className={`font-semibold ${colors.accent}`}>
                      {String(val)}
                    </span>
                  );
                };

                return (
                  <Card className="border-foreground/10 bg-foreground/[0.02] backdrop-blur-md overflow-hidden">
                    <CardHeader className="border-b border-foreground/10 bg-foreground/[0.02] pb-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <CardTitle className="text-xl font-bold text-foreground tracking-tight">
                            Compare Plans
                          </CardTitle>
                          <CardDescription className="text-gray-400 mt-1">
                            Every feature across all tiers — see exactly what you get
                          </CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 rounded-full border border-foreground/10 bg-foreground/5 p-1 text-xs">
                          <button
                            onClick={() => setBillingInterval('monthly')}
                            className={`rounded-full px-3 py-1 font-semibold transition-all ${
                              billingInterval === 'monthly'
                                ? 'bg-[#1dff00] text-background shadow-sm'
                                : 'text-gray-400 hover:text-foreground'
                            }`}
                          >
                            Monthly
                          </button>
                          <button
                            onClick={() => setBillingInterval('quarterly')}
                            className={`rounded-full px-3 py-1 font-semibold transition-all inline-flex items-center gap-1 ${
                              billingInterval === 'quarterly'
                                ? 'bg-[#1dff00] text-background shadow-sm'
                                : 'text-gray-400 hover:text-foreground'
                            }`}
                          >
                            Quarterly
                            <span className="text-[10px] font-bold opacity-80">10–15% OFF</span>
                          </button>
                          <button
                            onClick={() => setBillingInterval('yearly')}
                            className={`rounded-full px-3 py-1 font-semibold transition-all ${
                              billingInterval === 'yearly'
                                ? 'bg-[#1dff00] text-background shadow-sm'
                                : 'text-gray-400 hover:text-foreground'
                            }`}
                          >
                            Annual{' '}
                            <span className="text-[10px] font-bold ml-0.5 opacity-80">
                              {annualSavingsPctApprox}% OFF
                            </span>
                          </button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[680px] table-fixed border-separate border-spacing-0 text-sm">
                          <colgroup>
                            <col className="w-[26%] min-w-[160px]" />
                            <col className="w-[18.5%]" />
                            <col className="w-[18.5%]" />
                            <col className="w-[18.5%]" />
                            <col className="w-[18.5%]" />
                          </colgroup>
                          <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur-md">
                            <tr className="border-b border-foreground/10">
                              <th className="text-left px-5 py-4" />
                              {tierOrder.map((tier) => {
                                const def = BILLING_PLAN_DEFINITIONS.find((p) => p.name === tier);
                                const tablePricingInterval = effectiveBillingCycleForPlan(
                                  tier,
                                  billingInterval,
                                );
                                const pricing = getPlanPricingDisplay(
                                  tier,
                                  tablePricingInterval,
                                  def?.monthlyPriceUsd ?? 0,
                                );
                                const isCurrent = subscriptionTier === tier;
                                const colors = tierColors[tier];
                                return (
                                  <th key={tier} className="text-center px-3 py-4 align-top">
                                    <div className="flex flex-col items-center gap-1.5">
                                      <span className={`text-sm font-bold ${colors.text}`}>
                                        {tier}
                                      </span>
                                      {def && def.monthlyPriceUsd > 0 ? (
                                        <div className="flex items-baseline gap-0.5">
                                          <span className="text-lg font-extrabold text-foreground">
                                            ${pricing.headline}
                                          </span>
                                          <span className="text-[11px] text-gray-500">
                                            {pricing.suffix}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-[11px] text-gray-500">
                                          Free
                                        </span>
                                      )}
                                      {pricing.savingsBadge && (
                                        <span className="rounded-full bg-[#1dff00]/10 border border-[#1dff00]/30 px-2 py-0.5 text-[10px] font-bold text-[#1dff00]">
                                          {pricing.savingsBadge}
                                        </span>
                                      )}
                                      {isCurrent ? (
                                        <span className="mt-1 rounded-full border border-foreground/20 bg-foreground/5 px-3 py-1 text-[10px] font-bold text-foreground/60 tracking-wider">
                                          CURRENT
                                        </span>
                                      ) : tier !== 'Free' ? (
                                        <Button
                                          size="sm"
                                          disabled={processingPayment}
                                          onClick={() =>
                                            handlePayment('subscription', {
                                              ...plans.find((p) => p.name === tier) || { id: tier.toLowerCase(), name: tier },
                                              billingCycle: effectiveBillingCycleForPlan(tier, billingInterval),
                                            })
                                          }
                                          className={`mt-1 h-7 rounded-full px-4 text-[10px] font-bold tracking-wide transition-all ${
                                            tier === 'Basics'
                                              ? 'bg-[#1dff00] text-background hover:brightness-110'
                                              : tier === 'Pro'
                                                ? 'bg-blue-500 text-white hover:bg-blue-600'
                                                : 'bg-purple-600 text-white hover:bg-purple-700'
                                          }`}
                                        >
                                          {isCurrent ? 'Current' : 'Upgrade'}
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
                                    className="px-5 pt-5 pb-2 text-xs font-bold uppercase tracking-widest text-[#1dff00]"
                                  >
                                    {section.title}
                                  </td>
                                </tr>
                                {section.rows.map((row) => (
                                  <tr
                                    key={row.feature}
                                    className="group border-t border-foreground/5 hover:bg-foreground/[0.02] transition-colors"
                                  >
                                    <td className="px-5 py-3">
                                      <span className="text-sm font-medium text-foreground">
                                        {row.feature}
                                      </span>
                                      {row.sub && (
                                        <span className="block text-[11px] text-gray-500 mt-0.5">
                                          {row.sub}
                                        </span>
                                      )}
                                    </td>
                                    {tierOrder.map((tier) => (
                                      <td
                                        key={tier}
                                        className={`text-center px-3 py-3 ${
                                          subscriptionTier === tier
                                            ? (tierColors[tier]?.bg ?? '')
                                            : ''
                                        }`}
                                      >
                                        {renderCell(row.values[tier] ?? false, tier)}
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
          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border-foreground/10 bg-foreground/[0.02] backdrop-blur-md overflow-hidden">
                <CardHeader className="border-b border-foreground/10 bg-foreground/[0.02]">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                        Transaction History
                      </CardTitle>
                      <CardDescription className="text-gray-400 mt-1">
                        View all your credit transactions and usage history
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" className="gap-2 border-foreground/10 bg-foreground/5 hover:bg-foreground/10 text-gray-300 hover:text-foreground">
                      <Download className="w-4 h-4" />
                      Export CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {transactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                      <div className="p-4 rounded-full bg-foreground/5 mb-4 border border-foreground/10">
                        <History className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-foreground font-medium text-lg mb-1">No transactions yet</p>
                      <p className="text-gray-500 text-sm max-w-xs">Your credit purchases and usage will appear here once you start using JobRaker.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-foreground/5">
                      {transactions.map((transaction, index) => {
                        const iconData = getTransactionIcon(transaction.transaction_type);
                        return (
                          <motion.div
                            key={transaction.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="p-4 sm:p-6 hover:bg-foreground/[0.02] transition-colors duration-200 flex items-center justify-between gap-4 group"
                          >
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className={`p-2.5 rounded-xl border ${iconData.color} group-hover:scale-110 transition-transform`}>
                                {iconData.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-foreground font-medium truncate mb-0.5">{transaction.description}</p>
                                <p className="text-xs text-gray-500 font-mono">{formatDate(transaction.created_at)}</p>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className={`text-lg font-bold font-mono ${
                                transaction.amount > 0 ? 'text-[#1dff00]' : 'text-foreground'
                              }`}>
                                {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                              </p>
                              <p className="text-xs text-gray-500">
                                Balance: {transaction.balance_after}
                              </p>
                            </div>
                          </motion.div>
                        );
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
