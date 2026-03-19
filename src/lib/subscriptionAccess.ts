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

export const SUBSCRIPTION_MARKETING_PLANS: SubscriptionMarketingPlan[] = [
  {
    tier: "Free",
    name: "Free",
    price: "0",
    yearlyPrice: "0",
    period: "month",
    creditsPerMonth: 10,
    description: "Core job-search tools for getting started.",
    buttonText: "Get Started",
    href: "/signup",
    isPopular: false,
    features: [
      "Job search",
      "Resume builder and storage",
      "Resume import and parsing",
      "Cover letter builder",
      "Application tracking",
      "Email notifications",
    ],
  },
  {
    tier: "Basics",
    name: "Basics",
    price: "14",
    yearlyPrice: "134",
    period: "month",
    creditsPerMonth: 200,
    description: "AI-assisted application prep for active job seekers.",
    buttonText: "Choose Basics",
    href: "/signup",
    isPopular: false,
    features: [
      "Everything in Free",
      "AI match score",
      "AI resume optimization",
      "AI cover letter generation and polish",
      "Auto apply suite",
      "200 monthly credits",
    ],
  },
  {
    tier: "Pro",
    name: "Pro",
    price: "49",
    yearlyPrice: "470",
    period: "month",
    creditsPerMonth: 1000,
    description: "Advanced coaching and analytics for serious search velocity.",
    buttonText: "Choose Pro",
    href: "/signup",
    isPopular: true,
    features: [
      "Everything in Basics",
      "AI chat assistant",
      "Advanced analytics",
      "Interview scheduling assistant",
      "1,000 monthly credits",
    ],
  },
  {
    tier: "Ultimate",
    name: "Ultimate",
    price: "199",
    yearlyPrice: "1910",
    period: "month",
    creditsPerMonth: 5000,
    description: "Full automation and integration access for power users.",
    buttonText: "Choose Ultimate",
    href: "/signup",
    isPopular: false,
    features: [
      "Everything in Pro",
      "Gmail integration",
      "Custom integrations",
      "Priority support",
      "5,000 monthly credits",
    ],
  },
];

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
