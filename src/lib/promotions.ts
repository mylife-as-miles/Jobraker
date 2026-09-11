// Frontend client utilities and types for Jobraker Personalized Promotion Engine
export * from "../../backend/supabase/shared/promotions";

import type {
  PromotionAssignmentRow,
  PromotionDecision,
} from "../../backend/supabase/shared/promotions";

export interface CountdownState {
  hours: string;
  minutes: string;
  seconds: string;
  totalSeconds: number;
  isExpired: boolean;
}

/**
 * Calculates remaining time until server-authoritative expiresAt.
 * Never resets on page reload.
 */
export function formatCountdownTimer(expiresAt?: string | null): CountdownState {
  if (!expiresAt) {
    return {
      hours: "00",
      minutes: "00",
      seconds: "00",
      totalSeconds: 0,
      isExpired: true,
    };
  }

  const target = new Date(expiresAt).getTime();
  const now = Date.now();
  const diffMs = target - now;

  if (diffMs <= 0 || !Number.isFinite(diffMs)) {
    return {
      hours: "00",
      minutes: "00",
      seconds: "00",
      totalSeconds: 0,
      isExpired: true,
    };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
    totalSeconds,
    isExpired: false,
  };
}

/**
 * Checks if a promotion is currently valid and unexpired.
 */
export function isPromotionActive(
  assignment?: PromotionAssignmentRow | PromotionDecision | null
): boolean {
  if (!assignment) return false;
  if ("eligible" in assignment && !assignment.eligible) return false;
  if ("status" in assignment && assignment.status !== "active") return false;
  const expiresAt =
    "expires_at" in assignment
      ? assignment.expires_at
      : (assignment as PromotionDecision).expiresAt;
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > Date.now();
}

/**
 * Builds the billing redirect URL with attached assignment ID.
 */
export function getPromotionCtaUrl(
  assignmentId?: string,
  targetPlan?: string
): string {
  const params = new URLSearchParams();
  if (assignmentId) {
    params.set("promoAssignment", assignmentId);
  }
  if (targetPlan) {
    params.set("plan", targetPlan.toLowerCase());
  }
  const query = params.toString();
  return query ? `/dashboard/billing?${query}` : "/dashboard/billing";
}
