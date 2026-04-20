import { BILLING_PLAN_DEFINITIONS } from "@/lib/billingCatalog";

export type SubscriptionTier = "Free" | "Basics" | "Pro" | "Ultimate";

export type UpgradePromptTier = SubscriptionTier | "Pro/Ultimate";

export type MarketingFeature =
  | string
  | {
      name: string;
      value?: string;
      included?: boolean;
    };

export interface SubscriptionMarketingPlan {
  tier: SubscriptionTier;
  name: string;
  price: string;
  yearlyPrice: string;
  period: string;
  creditsPerMonth: number;
  autoApplyRunsPerMonth: number;
  description: string;
  features: MarketingFeature[];
  buttonText: string;
  href: string;
  isPopular: boolean;
}

export const SUBSCRIPTION_TIER_ORDER: SubscriptionTier[] = [
  "Free",
  "Basics",
  "Pro",
  "Ultimate",
];

export const SUBSCRIPTION_TIER_RANK: Record<SubscriptionTier, number> = {
  Free: 0,
  Basics: 1,
  Pro: 2,
  Ultimate: 3,
};

export const SUBSCRIPTION_MARKETING_PLANS: SubscriptionMarketingPlan[] =
  BILLING_PLAN_DEFINITIONS.map((plan) => ({
    tier: plan.tier,
    name: plan.name,
    price: String(plan.monthlyPriceUsd),
    yearlyPrice: String(plan.yearlyPriceUsd),
    period: "month",
    creditsPerMonth: plan.creditsPerMonth,
    autoApplyRunsPerMonth: plan.autoApplyRunsPerMonth,
    description: plan.description,
    buttonText: plan.tier === "Free" ? "Start Free" : `Choose ${plan.name}`,
    href: "/signup",
    isPopular: plan.isPopular,
    features: plan.marketingFeatures,
  }));

const UPGRADEABLE_TIERS: SubscriptionTier[] = ["Basics", "Pro", "Ultimate"];

export function normalizeSubscriptionTier(
  tier?: string | null,
): SubscriptionTier {
  switch ((tier || "").trim()) {
    case "Basics":
    case "Starter":
      return "Basics";
    case "Pro":
    case "Professional":
      return "Pro";
    case "Ultimate":
    case "Executive":
      return "Ultimate";
    case "Free":
    default:
      return "Free";
  }
}

export function hasSubscriptionAccess(
  currentTier: SubscriptionTier | string | null | undefined,
  requiredTier: SubscriptionTier,
): boolean {
  const normalizedCurrent = normalizeSubscriptionTier(currentTier);
  return (
    SUBSCRIPTION_TIER_RANK[normalizedCurrent] >=
    SUBSCRIPTION_TIER_RANK[requiredTier]
  );
}

export function getPromptBadgeLabel(requiredTier: UpgradePromptTier): string {
  if (requiredTier === "Basics") return "Basics Feature";
  if (requiredTier === "Pro") return "Pro Feature";
  if (requiredTier === "Ultimate") return "Ultimate Feature";
  return "Premium Feature";
}

export function getUpgradePlanCards(
  requiredTier: UpgradePromptTier,
): SubscriptionMarketingPlan[] {
  const minimumTier = requiredTier === "Pro/Ultimate" ? "Pro" : requiredTier;

  return UPGRADEABLE_TIERS.filter(
    (tier) => SUBSCRIPTION_TIER_RANK[tier] >= SUBSCRIPTION_TIER_RANK[minimumTier],
  ).map(
    (tier) =>
      SUBSCRIPTION_MARKETING_PLANS.find((plan) => plan.tier === tier)!,
  );
}
