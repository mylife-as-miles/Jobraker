import {
  DEFAULT_PAYSTACK_USD_TO_NGN_RATE,
  SHARED_CREDIT_PACKS,
  SHARED_SUBSCRIPTION_PLANS,
  type SharedCreditPackDefinition,
  type SharedSubscriptionPlanDefinition,
  type SharedSubscriptionTier,
} from "../../backend/supabase/shared/billing-catalog.ts";

export type BillingSubscriptionTier = SharedSubscriptionTier;
export type BillingPlanDefinition = SharedSubscriptionPlanDefinition;
export type BillingCreditPackDefinition = SharedCreditPackDefinition;

export const BILLING_PLAN_DEFINITIONS = SHARED_SUBSCRIPTION_PLANS;
export const BILLING_CREDIT_PACK_DEFINITIONS = SHARED_CREDIT_PACKS;
export const DEFAULT_NGN_PER_USD = DEFAULT_PAYSTACK_USD_TO_NGN_RATE;
