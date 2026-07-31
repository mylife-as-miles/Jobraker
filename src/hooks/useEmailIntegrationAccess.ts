import { hasSubscriptionAccess } from "@/lib/subscriptionAccess";

/**
 * Access gate shared by connected-account features.
 *
 * The hook keeps its existing public shape because Gmail drafting and other
 * integration-aware surfaces already consume it. Access is now based only on
 * the user's paid subscription tier: Basics, Pro, or Ultimate.
 */
export function useEmailIntegrationAccess(
  subscriptionTier?: string | null,
  loadingTier = false,
) {
  const hasPaidPlanAccess = hasSubscriptionAccess(subscriptionTier, "Basics");

  return {
    authEmail: null,
    isAllowlisted: hasPaidPlanAccess,
    hasEmailIntegrationAccess: hasPaidPlanAccess,
    loadingEmailIntegrationAccess: loadingTier,
  };
}
