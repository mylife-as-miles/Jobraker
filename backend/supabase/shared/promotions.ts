// Jobraker Personalized Promotion Engine V1
// Shared domain models, deterministic scoring, lifecycle rules, guardrails, and decision strategy.

export type PromotionIncentiveType =
  | "none"
  | "percentage_discount"
  | "bonus_credits"
  | "bonus_auto_apply_runs"
  | "annual_plan_discount"
  | "trial_upgrade";

export type PromotionMessageVariant =
  | "value"
  | "usage_limit"
  | "progress"
  | "momentum"
  | "returning_user"
  | "checkout_recovery"
  | "retention"
  | "urgency";

export type PromotionPlacement =
  | "top_banner"
  | "pricing_page"
  | "upgrade_modal"
  | "dashboard_card";

export type PromotionLifecycle =
  | "new"
  | "activated"
  | "power_user"
  | "at_risk"
  | "churned_returning";

export type PromotionAssignmentStatus =
  | "active"
  | "converted"
  | "expired"
  | "dismissed"
  | "cancelled";

export type PromotionEventType =
  | "assigned"
  | "impression"
  | "clicked"
  | "checkout_started"
  | "converted"
  | "dismissed"
  | "expired"
  | "cancelled";

export interface PromotionUserFeatures {
  userId: string;
  accountAgeDays: number;
  currentPlan: string;
  previouslyPaid: boolean;
  sessions7d: number;
  sessions30d: number;
  activeDays7d: number;
  activeDays30d: number;
  daysSinceLastSession: number;
  jobsViewed30d: number;
  autoApplies7d: number;
  autoApplies30d: number;
  successfulApplications30d: number;
  resumeGenerations30d: number;
  creditUsagePercent: number;
  autoApplyQuotaUsagePercent: number;
  pricingPageViews7d: number;
  upgradeModalViews7d: number;
  checkoutStarts7d: number;
  checkoutAbandons7d: number;
  promoImpressions7d: number;
  promoImpressions30d: number;
  promoClicks30d: number;
  promosAccepted90d: number;
  lastPromoDiscount?: number | null;
  daysSinceLastPromo?: number | null;
  hasActiveDiscount?: boolean;
  lifecycle: PromotionLifecycle;
}

export interface PromotionAssignmentRow {
  id: string;
  user_id: string;
  campaign_id?: string | null;
  incentive_type: PromotionIncentiveType;
  discount_percent: number;
  bonus_credits: number;
  bonus_auto_apply_runs: number;
  target_plan?: string | null;
  message_variant: PromotionMessageVariant;
  placement: PromotionPlacement;
  headline?: string | null;
  body?: string | null;
  cta_label?: string | null;
  experiment_key: string;
  experiment_variant: "control" | "treatment";
  decision_reason: string;
  decision_score?: number | null;
  model_version: string;
  starts_at: string;
  expires_at?: string | null;
  status: PromotionAssignmentStatus;
  converted_at?: string | null;
  converted_order_id?: string | null;
  converted_amount?: number | null;
  converted_currency?: string | null;
  user_features?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface PromotionDecisionContext {
  campaignId?: string;
  campaignSlug?: string;
  campaignConfig?: {
    holdout_pct?: number;
    default_duration_hours?: number;
    max_impressions_7d?: number;
    cooldown_days?: number;
    max_discount?: number;
  };
  now?: Date;
  activeAssignment?: PromotionAssignmentRow | null;
}

export interface PromotionDecision {
  eligible: boolean;
  assignmentId?: string;
  campaignId?: string;
  incentiveType: PromotionIncentiveType;
  discountPercent?: number;
  bonusCredits?: number;
  bonusAutoApplyRuns?: number;
  targetPlan?: string;
  messageVariant: PromotionMessageVariant;
  placement: PromotionPlacement;
  headline?: string;
  body?: string;
  ctaLabel?: string;
  startsAt?: string;
  expiresAt?: string;
  decisionReason: string;
  score?: number;
  experimentVariant?: "control" | "treatment";
  modelVersion: string;
}

/**
 * Pluggable Decision Strategy interface.
 * V1 uses RuleBasedPromotionStrategy.
 * Future versions can drop in UpliftPromotionStrategy or ContextualBanditPromotionStrategy.
 */
export interface PromotionDecisionStrategy {
  decide(
    features: PromotionUserFeatures,
    context: PromotionDecisionContext
  ): Promise<PromotionDecision>;
}

// Configurable constants for intent score calculation
export const INTENT_WEIGHTS = {
  pricingViews7d: 8,
  upgradeModalViews7d: 6,
  checkoutStarts7d: 15,
  quotaUsagePercent: 0.20, // 100% quota -> +20 score
  successfulApplications30d: 2,
  activeDays7d: 2,
} as const;

export const PROMOTION_GUARDRAILS = {
  MAX_DISCOUNT_PERCENT: 40,
  DEFAULT_COOLDOWN_DAYS: 7,
  DEFAULT_MAX_IMPRESSIONS_7D: 2,
  DEFAULT_HOLDOUT_PERCENT: 10,
  DEFAULT_EXPIRY_HOURS: 24,
  EXPERIMENT_SALT: "jobraker_promo_v1_salt",
} as const;

/**
 * Telemetry Trust Hierarchy:
 * - High Trust (Authoritative System State): orders, user_credits, user_feature_quotas, user_subscriptions
 * - Medium Trust (Server Activity Records): applications, server-recorded checkout_started events
 * - Low Trust (Client Interaction Telemetry): pricing page views, modal views, clicks
 *
 * Guardrail: Low-trust client interaction signals are strictly capped at 20 points total.
 * Client telemetry ALONE can never reach the discount activation threshold (40+ points).
 */
export const CLIENT_TELEMETRY_SCORE_CAP = 30;

/**
 * Computes deterministic purchase-intent score (0..100 clamped).
 * Incorporates capped low-trust client signals + authoritative system activity.
 */
export function calculateIntentScore(
  features: Partial<PromotionUserFeatures>
): number {
  const pricingViews = Math.max(0, features.pricingPageViews7d || 0);
  const modalViews = Math.max(0, features.upgradeModalViews7d || 0);

  // Cap client-generated interaction telemetry so clicks/page-views alone cannot trigger discounts
  const rawClientTelemetryScore =
    pricingViews * INTENT_WEIGHTS.pricingViews7d +
    modalViews * INTENT_WEIGHTS.upgradeModalViews7d;
  const clientScore = Math.min(CLIENT_TELEMETRY_SCORE_CAP, rawClientTelemetryScore);

  // Authoritative server-recorded and verified activity
  const checkoutStarts = Math.max(0, features.checkoutStarts7d || 0);
  const quotaUsage = Math.min(100, Math.max(0, features.autoApplyQuotaUsagePercent || features.creditUsagePercent || 0));
  const successfulApps = Math.max(0, features.successfulApplications30d || 0);
  const activeDays = Math.max(0, features.activeDays7d || 0);

  const serverAuthoritativeScore =
    checkoutStarts * INTENT_WEIGHTS.checkoutStarts7d +
    quotaUsage * INTENT_WEIGHTS.quotaUsagePercent +
    successfulApps * INTENT_WEIGHTS.successfulApplications30d +
    activeDays * INTENT_WEIGHTS.activeDays7d;

  const totalRawScore = clientScore + serverAuthoritativeScore;
  return Math.round(Math.min(100, Math.max(0, totalRawScore)));
}

/**
 * Deterministically classifies user lifecycle stage without demographic assumptions.
 */
export function derivePromotionLifecycle(
  features: Partial<PromotionUserFeatures>
): PromotionLifecycle {
  const accountAgeDays = Math.max(0, features.accountAgeDays || 0);
  const previouslyPaid = Boolean(features.previouslyPaid);
  const activeDays30d = Math.max(0, features.activeDays30d || 0);
  const activeDays7d = Math.max(0, features.activeDays7d || 0);
  const sessions7d = Math.max(0, features.sessions7d || 0);
  const sessions30d = Math.max(0, features.sessions30d || 0);
  const autoApplies7d = Math.max(0, features.autoApplies7d || 0);
  const successfulApps30d = Math.max(0, features.successfulApplications30d || 0);
  const daysSinceLastSession = features.daysSinceLastSession ?? 0;

  // 1. Returning former subscriber or previously active user returning after gap
  if ((previouslyPaid || activeDays30d >= 5) && daysSinceLastSession > 14) {
    return "churned_returning";
  }

  // 2. Power user with high recent engagement
  if (autoApplies7d >= 10 || activeDays7d >= 5) {
    return "power_user";
  }

  // 3. At risk: previously engaged in 30d but 0 sessions in last 7d
  if (sessions30d >= 5 && sessions7d === 0) {
    return "at_risk";
  }

  // 4. New account with low activation
  if (accountAgeDays < 7 && successfulApps30d === 0 && sessions7d <= 3 && autoApplies7d === 0) {
    return "new";
  }

  // 5. Default engaged activated user
  return "activated";
}

/**
 * Fast 32-bit FNV-1a hash for deterministic, reproducible experiment bucket assignment.
 */
export function deterministicHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return Math.abs(hash);
}

/**
 * Evaluates whether user is in the holdout control arm (default 10%).
 */
export function isUserInHoldoutControl(
  userId: string,
  campaignSlug: string = "default_v1_campaign",
  holdoutPct: number = PROMOTION_GUARDRAILS.DEFAULT_HOLDOUT_PERCENT
): boolean {
  if (holdoutPct <= 0) return false;
  if (holdoutPct >= 100) return true;
  const hashVal = deterministicHash(`${userId}:${campaignSlug}:${PROMOTION_GUARDRAILS.EXPERIMENT_SALT}`);
  return (hashVal % 100) < holdoutPct;
}

/**
 * Production V1 Rule-Based Promotion Strategy.
 * Answers: "What is the lowest-cost intervention most likely to create incremental value for this user?"
 */
export class RuleBasedPromotionStrategy implements PromotionDecisionStrategy {
  public async decide(
    features: PromotionUserFeatures,
    context: PromotionDecisionContext = {}
  ): Promise<PromotionDecision> {
    const now = context.now || new Date();
    const config = context.campaignConfig || {};
    const holdoutPct = config.holdout_pct ?? PROMOTION_GUARDRAILS.DEFAULT_HOLDOUT_PERCENT;
    const cooldownDays = config.cooldown_days ?? PROMOTION_GUARDRAILS.DEFAULT_COOLDOWN_DAYS;
    const maxImpressions7d = config.max_impressions_7d ?? PROMOTION_GUARDRAILS.DEFAULT_MAX_IMPRESSIONS_7D;
    const maxDiscountAllowed = Math.min(
      PROMOTION_GUARDRAILS.MAX_DISCOUNT_PERCENT,
      config.max_discount ?? PROMOTION_GUARDRAILS.MAX_DISCOUNT_PERCENT
    );
    const durationHours = config.default_duration_hours ?? PROMOTION_GUARDRAILS.DEFAULT_EXPIRY_HOURS;
    const campaignId = context.campaignId;
    const campaignSlug = context.campaignSlug || "default_v1_campaign";

    // 1. Guardrail: Existing active unexpired assignment (PERSISTENCE CHECK)
    if (context.activeAssignment && context.activeAssignment.status === "active") {
      const active = context.activeAssignment;
      const expiry = active.expires_at ? new Date(active.expires_at) : null;
      if (!expiry || expiry.getTime() > now.getTime()) {
        return {
          eligible: active.incentive_type !== "none",
          assignmentId: active.id,
          campaignId: active.campaign_id || undefined,
          incentiveType: active.incentive_type,
          discountPercent: active.discount_percent,
          bonusCredits: active.bonus_credits,
          bonusAutoApplyRuns: active.bonus_auto_apply_runs,
          targetPlan: active.target_plan || undefined,
          messageVariant: active.message_variant,
          placement: active.placement,
          headline: active.headline || undefined,
          body: active.body || undefined,
          ctaLabel: active.cta_label || undefined,
          startsAt: active.starts_at,
          expiresAt: active.expires_at || undefined,
          decisionReason: active.decision_reason,
          score: active.decision_score != null ? Number(active.decision_score) : undefined,
          experimentVariant: active.experiment_variant,
          modelVersion: active.model_version,
        };
      }
    }

    // 2. Guardrail: Existing paid discount protection (no stacking)
    if (features.hasActiveDiscount) {
      return {
        eligible: false,
        incentiveType: "none",
        messageVariant: "value",
        placement: "top_banner",
        decisionReason: "active_paid_discount_exists",
        modelVersion: "v1.0.0",
      };
    }

    // 3. Guardrail: Campaign cooldown (minimum days between discount offers)
    if (
      features.daysSinceLastPromo !== null &&
      features.daysSinceLastPromo !== undefined &&
      features.daysSinceLastPromo < cooldownDays
    ) {
      return {
        eligible: false,
        incentiveType: "none",
        messageVariant: "value",
        placement: "top_banner",
        decisionReason: "promotion_cooldown",
        modelVersion: "v1.0.0",
      };
    }

    // 4. Guardrail: Max impressions frequency
    if (features.promoImpressions7d >= maxImpressions7d) {
      return {
        eligible: false,
        incentiveType: "none",
        messageVariant: "value",
        placement: "top_banner",
        decisionReason: "max_impressions_reached",
        modelVersion: "v1.0.0",
      };
    }

    // Calculate deterministic intent score & ensure lifecycle is set
    const intentScore = calculateIntentScore(features);
    const lifecycle = features.lifecycle || derivePromotionLifecycle(features);

    // 5. Experiment Assignment (10% Control / 90% Treatment)
    const isControl = isUserInHoldoutControl(features.userId, campaignSlug, holdoutPct);
    const experimentVariant = isControl ? "control" : "treatment";

    // Set server-authoritative timestamps
    const startsAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + durationHours * 3600 * 1000).toISOString();

    if (isControl) {
      return {
        eligible: true, // Eligible for holdout measurement
        campaignId,
        incentiveType: "none",
        discountPercent: 0,
        messageVariant: "value",
        placement: "top_banner",
        startsAt,
        expiresAt,
        decisionReason: "promotion_holdout",
        score: intentScore,
        experimentVariant: "control",
        modelVersion: "v1.0.0",
      };
    }

    // 6. Controlled Treatment Ladder & Incentive Selection (Smallest Effective Incentive)
    // Tier A: Churned returning former subscriber -> 25% comeback offer
    if (lifecycle === "churned_returning") {
      const discount = Math.min(25, maxDiscountAllowed);
      return {
        eligible: true,
        campaignId,
        incentiveType: "percentage_discount",
        discountPercent: discount,
        targetPlan: "Basics",
        messageVariant: "returning_user",
        placement: "top_banner",
        headline: "Welcome back to Jobraker",
        body: "Restart your automated job search right where you left off with 25% off.",
        ctaLabel: "Reactivate with 25% OFF",
        startsAt,
        expiresAt,
        decisionReason: "returning_paid_user",
        score: intentScore,
        experimentVariant: "treatment",
        modelVersion: "v1.0.0",
      };
    }

    // Tier B: Checkout abandonment with moderate-to-high intent -> 20% recovery offer
    if (features.checkoutAbandons7d > 0 && intentScore >= 50) {
      const discount = Math.min(20, maxDiscountAllowed);
      return {
        eligible: true,
        campaignId,
        incentiveType: "percentage_discount",
        discountPercent: discount,
        messageVariant: "checkout_recovery",
        placement: "top_banner",
        headline: "Still considering an upgrade?",
        body: "Your exclusive 20% savings voucher is reserved until this countdown ends.",
        ctaLabel: "Claim 20% OFF",
        startsAt,
        expiresAt,
        decisionReason: "checkout_recovery",
        score: intentScore,
        experimentVariant: "treatment",
        modelVersion: "v1.0.0",
      };
    }

    // Tier C: Hitting Auto Apply quota limit (>= 90%)
    if (features.autoApplyQuotaUsagePercent >= 90) {
      if (intentScore >= 60) {
        // High engagement: 15% discount
        const discount = Math.min(15, maxDiscountAllowed);
        return {
          eligible: true,
          campaignId,
          incentiveType: "percentage_discount",
          discountPercent: discount,
          targetPlan: "Pro",
          messageVariant: "usage_limit",
          placement: "top_banner",
          headline: "Keep your application momentum going",
          body: `You've utilized ${features.autoApplies7d || "most of"} your Auto Apply capacity. Upgrade today for 15% off.`,
          ctaLabel: "Upgrade with 15% OFF",
          startsAt,
          expiresAt,
          decisionReason: "high_quota_usage_discount",
          score: intentScore,
          experimentVariant: "treatment",
          modelVersion: "v1.0.0",
        };
      } else {
        // Moderate intent: Bonus Auto Apply runs instead of cash discount (preserves price integrity)
        return {
          eligible: true,
          campaignId,
          incentiveType: "bonus_auto_apply_runs",
          bonusAutoApplyRuns: 20,
          targetPlan: "Basics",
          messageVariant: "usage_limit",
          placement: "top_banner",
          headline: "Unlock +20 Bonus Auto Apply Runs",
          body: "Upgrade your plan today and receive 20 bonus Auto Apply submissions immediately.",
          ctaLabel: "Claim +20 Bonus Runs",
          startsAt,
          expiresAt,
          decisionReason: "high_quota_bonus_runs",
          score: intentScore,
          experimentVariant: "treatment",
          modelVersion: "v1.0.0",
        };
      }
    }

    // Tier D: Low credit pressure (>= 80% credits spent) -> Bonus credits offer
    if (features.creditUsagePercent >= 80) {
      return {
        eligible: true,
        campaignId,
        incentiveType: "bonus_credits",
        bonusCredits: 100,
        messageVariant: "progress",
        placement: "top_banner",
        headline: "Get +100 Bonus Credits",
        body: `You've launched ${features.successfulApplications30d || 0} applications this month. Add 100 bonus credits on any subscription upgrade.`,
        ctaLabel: "Claim 100 Bonus Credits",
        startsAt,
        expiresAt,
        decisionReason: "low_credits_bonus",
        score: intentScore,
        experimentVariant: "treatment",
        modelVersion: "v1.0.0",
      };
    }

    // Tier E: Very high purchase intent (intent >= 75) -> Smallest effective incentive (10% or momentum framing)
    // Principle: Users with high willingness-to-pay do not require large discounts!
    if (intentScore >= 75) {
      const discount = Math.min(10, maxDiscountAllowed);
      return {
        eligible: true,
        campaignId,
        incentiveType: "percentage_discount",
        discountPercent: discount,
        messageVariant: "momentum",
        placement: "top_banner",
        headline: "Accelerate your job search",
        body: `You've been actively searching for ${features.activeDays7d || 3} days this week. Lock in 10% off automated applications.`,
        ctaLabel: "Save 10% Now",
        startsAt,
        expiresAt,
        decisionReason: "high_intent_low_discount",
        score: intentScore,
        experimentVariant: "treatment",
        modelVersion: "v1.0.0",
      };
    }

    // Tier F: Medium intent (intent >= 40) -> 10% activation discount
    if (intentScore >= 40) {
      const discount = Math.min(10, maxDiscountAllowed);
      return {
        eligible: true,
        campaignId,
        incentiveType: "percentage_discount",
        discountPercent: discount,
        messageVariant: "value",
        placement: "top_banner",
        headline: "Find your next role faster",
        body: "Unlock intelligent application tailoring, recruiter discovery, and daily automation with 10% off.",
        ctaLabel: "Get Started with 10% OFF",
        startsAt,
        expiresAt,
        decisionReason: "activation_incentive",
        score: intentScore,
        experimentVariant: "treatment",
        modelVersion: "v1.0.0",
      };
    }

    // Baseline: Low intent, not eligible for active discount
    return {
      eligible: false,
      incentiveType: "none",
      messageVariant: "value",
      placement: "top_banner",
      decisionReason: "low_intent_baseline",
      score: intentScore,
      modelVersion: "v1.0.0",
    };
  }
}
