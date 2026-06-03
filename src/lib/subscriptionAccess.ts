import { BILLING_PLAN_DEFINITIONS } from "@/lib/billingCatalog";

export type SubscriptionTier = "Free" | "Basics" | "Pro" | "Ultimate";

export type UpgradePromptTier = SubscriptionTier | "Pro/Ultimate";

export type ProductFeatureKey =
  | "application_tracking"
  | "basic_match_score"
  | "manual_job_feedback"
  | "bulk_pipeline_tools"
  | "csv_export"
  | "basic_job_quality_filter"
  | "resume_tailoring"
  | "cover_letter_generation"
  | "advanced_job_quality_gate"
  | "feedback_learning_ranking"
  | "explainable_score_breakdown"
  | "ats_keyword_coverage"
  | "generated_application_package"
  | "pipeline_cleanup"
  | "job_reevaluation"
  | "scout_mode"
  | "background_discovery_summaries"
  | "auto_reevaluation"
  | "ready_to_tailor_queue";

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

export const PRODUCT_FEATURE_MIN_TIER: Record<
  ProductFeatureKey,
  SubscriptionTier
> = {
  application_tracking: "Free",
  basic_match_score: "Free",
  manual_job_feedback: "Free",
  bulk_pipeline_tools: "Basics",
  csv_export: "Basics",
  basic_job_quality_filter: "Basics",
  resume_tailoring: "Basics",
  cover_letter_generation: "Basics",
  advanced_job_quality_gate: "Pro",
  feedback_learning_ranking: "Pro",
  explainable_score_breakdown: "Pro",
  ats_keyword_coverage: "Pro",
  generated_application_package: "Pro",
  pipeline_cleanup: "Pro",
  job_reevaluation: "Pro",
  scout_mode: "Ultimate",
  background_discovery_summaries: "Ultimate",
  auto_reevaluation: "Ultimate",
  ready_to_tailor_queue: "Ultimate",
};

export const PRODUCT_FEATURE_LABELS: Record<ProductFeatureKey, string> = {
  application_tracking: "Application tracking",
  basic_match_score: "Basic match score",
  manual_job_feedback: "Manual job feedback labels",
  bulk_pipeline_tools: "Bulk pipeline tools",
  csv_export: "CSV export",
  basic_job_quality_filter: "Basic job quality filtering",
  resume_tailoring: "Resume tailoring",
  cover_letter_generation: "Cover letter generation",
  advanced_job_quality_gate: "Advanced job quality gate",
  feedback_learning_ranking: "Feedback-learning ranking",
  explainable_score_breakdown: "Explainable score breakdown",
  ats_keyword_coverage: "ATS keyword coverage",
  generated_application_package: "Generated application package",
  pipeline_cleanup: "Pipeline cleanup",
  job_reevaluation: "Job re-evaluation",
  scout_mode: "Scout Mode",
  background_discovery_summaries: "Background discovery summaries",
  auto_reevaluation: "Auto re-evaluation",
  ready_to_tailor_queue: "Ready-to-tailor queue",
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

export function getFeatureRequiredTier(
  feature: ProductFeatureKey,
): SubscriptionTier {
  return PRODUCT_FEATURE_MIN_TIER[feature];
}

export function hasFeatureAccess(
  currentTier: SubscriptionTier | string | null | undefined,
  feature: ProductFeatureKey,
): boolean {
  return hasSubscriptionAccess(currentTier, getFeatureRequiredTier(feature));
}

export function getFeatureUpgradeLabel(feature: ProductFeatureKey): string {
  return getPromptBadgeLabel(getFeatureRequiredTier(feature));
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
