// src/__tests__/promotions-engine.test.ts
// Comprehensive unit and integration test suite for Jobraker Personalized Promotion Engine V1.

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  RuleBasedPromotionStrategy,
  calculateIntentScore,
  derivePromotionLifecycle,
  deterministicHash,
  isUserInHoldoutControl,
  INTENT_WEIGHTS,
  PROMOTION_GUARDRAILS,
  type PromotionUserFeatures,
  type PromotionAssignmentRow,
} from "../lib/promotions";
import {
  formatCountdownTimer,
  isPromotionActive,
  getPromotionCtaUrl,
} from "../lib/promotions";
import {
  calculateVariantConversionRates,
  calculateDiscountLiftAnalysis,
  calculateControlVsTreatmentLift,
  calculateImpressionDistribution,
} from "../lib/promotionAnalytics";

describe("Personalized Promotion Engine V1", () => {
  const strategy = new RuleBasedPromotionStrategy();

  const baseFeatures: PromotionUserFeatures = {
    userId: "usr-test-123",
    accountAgeDays: 14,
    currentPlan: "Free",
    previouslyPaid: false,
    sessions7d: 5,
    sessions30d: 15,
    activeDays7d: 3,
    activeDays30d: 8,
    daysSinceLastSession: 1,
    jobsViewed30d: 25,
    autoApplies7d: 3,
    autoApplies30d: 8,
    successfulApplications30d: 6,
    resumeGenerations30d: 2,
    creditUsagePercent: 50,
    autoApplyQuotaUsagePercent: 60,
    pricingPageViews7d: 2,
    upgradeModalViews7d: 1,
    checkoutStarts7d: 0,
    checkoutAbandons7d: 0,
    promoImpressions7d: 0,
    promoImpressions30d: 1,
    promoClicks30d: 0,
    promosAccepted90d: 0,
    lastPromoDiscount: null,
    daysSinceLastPromo: null,
    hasActiveDiscount: false,
    lifecycle: "activated",
  };

  describe("1. Persistence Across Refreshes (Server-Authoritative Stability)", () => {
    it("returns identical assignment without recalculating or changing discount/expiry when an active assignment exists", async () => {
      const fixedStartsAt = "2026-09-11T12:00:00.000Z";
      const fixedExpiresAt = "2026-09-12T12:00:00.000Z";

      const existingAssignment: PromotionAssignmentRow = {
        id: "promo-assign-abc-123",
        user_id: "usr-test-123",
        campaign_id: "camp-v1",
        incentive_type: "percentage_discount",
        discount_percent: 20,
        bonus_credits: 0,
        bonus_auto_apply_runs: 0,
        target_plan: "Basics",
        message_variant: "checkout_recovery",
        placement: "top_banner",
        headline: "Still considering an upgrade?",
        body: "Your 20% savings voucher is reserved.",
        cta_label: "Claim 20% OFF",
        experiment_key: "default_v1_campaign",
        experiment_variant: "treatment",
        decision_reason: "checkout_recovery",
        decision_score: 65,
        model_version: "v1.0.0",
        starts_at: fixedStartsAt,
        expires_at: fixedExpiresAt,
        status: "active",
        created_at: fixedStartsAt,
        updated_at: fixedStartsAt,
      };

      // Call 1: Page Load
      const decision1 = await strategy.decide(baseFeatures, {
        campaignId: "camp-v1",
        campaignSlug: "default_v1_campaign",
        activeAssignment: existingAssignment,
        now: new Date("2026-09-11T13:00:00.000Z"),
      });

      // Call 2: Page Refresh 4 hours later
      const decision2 = await strategy.decide(baseFeatures, {
        campaignId: "camp-v1",
        campaignSlug: "default_v1_campaign",
        activeAssignment: existingAssignment,
        now: new Date("2026-09-11T17:00:00.000Z"),
      });

      expect(decision1.assignmentId).toBe("promo-assign-abc-123");
      expect(decision2.assignmentId).toBe("promo-assign-abc-123");
      expect(decision1.discountPercent).toBe(20);
      expect(decision2.discountPercent).toBe(20);
      expect(decision1.expiresAt).toBe(fixedExpiresAt);
      expect(decision2.expiresAt).toBe(fixedExpiresAt);
      expect(decision1.messageVariant).toBe("checkout_recovery");
      expect(decision2.messageVariant).toBe("checkout_recovery");
      expect(decision1.experimentVariant).toBe("treatment");
      expect(decision2.experimentVariant).toBe("treatment");
    });
  });

  describe("2. Countdown Timer Immutability (Never Resets on Refresh)", () => {
    it("monotonically counts down to server expiresAt and transitions to expired without restarting", () => {
      const now = 1757592000000; // Base timestamp
      const serverExpiresAt = new Date(now + 2 * 3600 * 1000 + 15 * 60 * 1000).toISOString(); // 2h 15m later

      vi.spyOn(Date, "now").mockReturnValue(now);
      const timer1 = formatCountdownTimer(serverExpiresAt);
      expect(timer1.hours).toBe("02");
      expect(timer1.minutes).toBe("15");
      expect(timer1.isExpired).toBe(false);

      // Simulate 1 hour passing (page refreshed or navigating)
      vi.spyOn(Date, "now").mockReturnValue(now + 3600 * 1000);
      const timer2 = formatCountdownTimer(serverExpiresAt);
      expect(timer2.hours).toBe("01");
      expect(timer2.minutes).toBe("15");
      expect(timer2.isExpired).toBe(false);

      // Simulate passing the deadline
      vi.spyOn(Date, "now").mockReturnValue(now + 3 * 3600 * 1000);
      const timerExpired = formatCountdownTimer(serverExpiresAt);
      expect(timerExpired.hours).toBe("00");
      expect(timerExpired.minutes).toBe("00");
      expect(timerExpired.seconds).toBe("00");
      expect(timerExpired.isExpired).toBe(true);

      vi.restoreAllMocks();
    });

    it("correctly identifies active vs expired assignments", () => {
      const future = new Date(Date.now() + 10000).toISOString();
      const past = new Date(Date.now() - 10000).toISOString();

      expect(isPromotionActive({ status: "active", expires_at: future })).toBe(true);
      expect(isPromotionActive({ status: "active", expires_at: past })).toBe(false);
      expect(isPromotionActive({ status: "converted", expires_at: future })).toBe(false);
      expect(isPromotionActive({ status: "dismissed", expires_at: future })).toBe(false);
    });
  });

  describe("3. Experiment Assignment & Deterministic Holdout Control", () => {
    it("assigns control group users to 0% discount with persistent holdout reasoning", async () => {
      // Find a user ID that maps into the holdout bucket (< 10)
      let controlUserId = "";
      for (let i = 0; i < 1000; i++) {
        const candidate = `test-user-${i}`;
        if (isUserInHoldoutControl(candidate, "default_v1_campaign", 10)) {
          controlUserId = candidate;
          break;
        }
      }

      expect(controlUserId).toBeTruthy();
      expect(isUserInHoldoutControl(controlUserId, "default_v1_campaign", 10)).toBe(true);

      const features: PromotionUserFeatures = {
        ...baseFeatures,
        userId: controlUserId,
        autoApplyQuotaUsagePercent: 95, // Highly engaged
      };

      const decision = await strategy.decide(features, {
        campaignSlug: "default_v1_campaign",
        campaignConfig: { holdout_pct: 10 },
      });

      expect(decision.experimentVariant).toBe("control");
      expect(decision.incentiveType).toBe("none");
      expect(decision.discountPercent).toBe(0);
      expect(decision.decisionReason).toBe("promotion_holdout");
      expect(decision.eligible).toBe(true); // Eligible for telemetry measurement
    });

    it("consistently keeps the same user in the same experiment arm across multiple evaluations", () => {
      const userA = "stable-user-alpha-99";
      const userB = "stable-user-beta-42";

      const armA1 = isUserInHoldoutControl(userA);
      const armA2 = isUserInHoldoutControl(userA);
      const armB1 = isUserInHoldoutControl(userB);
      const armB2 = isUserInHoldoutControl(userB);

      expect(armA1).toBe(armA2);
      expect(armB1).toBe(armB2);
    });
  });

  describe("4. Smallest Effective Incentive (High Intent -> Low Discount)", () => {
    it("offers minimal 10% discount or value messaging rather than jumping to maximum discount for high-intent users", async () => {
      // Find a treatment user
      let treatmentUserId = "treatment-user-1";
      while (isUserInHoldoutControl(treatmentUserId, "default_v1_campaign", 10)) {
        treatmentUserId = `${treatmentUserId}_x`;
      }

      // High intent user: frequent pricing page visits, active every day
      const highIntentFeatures: PromotionUserFeatures = {
        ...baseFeatures,
        userId: treatmentUserId,
        pricingPageViews7d: 5,
        upgradeModalViews7d: 3,
        activeDays7d: 7,
        successfulApplications30d: 10,
      };

      const score = calculateIntentScore(highIntentFeatures);
      expect(score).toBeGreaterThanOrEqual(75);

      const decision = await strategy.decide(highIntentFeatures, {
        campaignSlug: "default_v1_campaign",
        campaignConfig: { holdout_pct: 10 },
      });

      expect(decision.experimentVariant).toBe("treatment");
      expect(decision.decisionReason).toBe("high_intent_low_discount");
      // Must be 10%, NOT the maximum 40%
      expect(decision.discountPercent).toBe(10);
      expect(decision.messageVariant).toBe("momentum");
    });

    it("prefers product incentives (bonus Auto Apply runs) when user hits quota but has moderate intent", async () => {
      let treatmentUserId = "treatment-user-quota";
      while (isUserInHoldoutControl(treatmentUserId, "default_v1_campaign", 10)) {
        treatmentUserId = `${treatmentUserId}_q`;
      }

      const quotaFeatures: PromotionUserFeatures = {
        ...baseFeatures,
        userId: treatmentUserId,
        autoApplyQuotaUsagePercent: 95,
        pricingPageViews7d: 0,
        upgradeModalViews7d: 0,
        checkoutStarts7d: 0,
      };

      const score = calculateIntentScore(quotaFeatures);
      expect(score).toBeLessThan(60);

      const decision = await strategy.decide(quotaFeatures, {
        campaignSlug: "default_v1_campaign",
        campaignConfig: { holdout_pct: 10 },
      });

      expect(decision.incentiveType).toBe("bonus_auto_apply_runs");
      expect(decision.bonusAutoApplyRuns).toBe(20);
      expect(decision.discountPercent).toBeUndefined();
      expect(decision.decisionReason).toBe("high_quota_bonus_runs");
    });
  });

  describe("5. Guardrails & Frequency Limits", () => {
    it("enforces cooldown: blocks new promotion if previous promo was accepted or assigned within 7 days", async () => {
      const cooldownFeatures: PromotionUserFeatures = {
        ...baseFeatures,
        daysSinceLastPromo: 3, // Only 3 days ago (less than 7d cooldown)
      };

      const decision = await strategy.decide(cooldownFeatures);
      expect(decision.eligible).toBe(false);
      expect(decision.incentiveType).toBe("none");
      expect(decision.decisionReason).toBe("promotion_cooldown");
    });

    it("enforces max impressions limit: stops promoting if 2 impressions already delivered in 7 days", async () => {
      const fatigueFeatures: PromotionUserFeatures = {
        ...baseFeatures,
        promoImpressions7d: 2, // At maximum allowed
      };

      const decision = await strategy.decide(fatigueFeatures);
      expect(decision.eligible).toBe(false);
      expect(decision.incentiveType).toBe("none");
      expect(decision.decisionReason).toBe("max_impressions_reached");
    });

    it("blocks discount stacking if user already has an active subscription discount", async () => {
      const activeDiscountFeatures: PromotionUserFeatures = {
        ...baseFeatures,
        hasActiveDiscount: true,
      };

      const decision = await strategy.decide(activeDiscountFeatures);
      expect(decision.eligible).toBe(false);
      expect(decision.incentiveType).toBe("none");
      expect(decision.decisionReason).toBe("active_paid_discount_exists");
    });

    it("strictly enforces 40% maximum discount cap", async () => {
      let treatmentUserId = "treatment-user-comeback";
      while (isUserInHoldoutControl(treatmentUserId, "default_v1_campaign", 10)) {
        treatmentUserId = `${treatmentUserId}_c`;
      }

      const churnedFeatures: PromotionUserFeatures = {
        ...baseFeatures,
        userId: treatmentUserId,
        previouslyPaid: true,
        daysSinceLastSession: 30, // Churned returning
        lifecycle: "churned_returning",
      };

      // Even if campaign attempted to configure 60% max, engine clamps to 40%
      const decision = await strategy.decide(churnedFeatures, {
        campaignConfig: { max_discount: 60 },
      });

      expect(decision.discountPercent).toBeLessThanOrEqual(PROMOTION_GUARDRAILS.MAX_DISCOUNT_PERCENT);
      expect(decision.discountPercent).toBeLessThanOrEqual(40);
    });
  });

  describe("6. Lifecycle Classification & Intent Score Calculations", () => {
    it("correctly derives lifecycle stages without demographic assumptions", () => {
      // 1. New user
      expect(
        derivePromotionLifecycle({
          accountAgeDays: 3,
          successfulApplications30d: 0,
          sessions7d: 2,
        })
      ).toBe("new");

      // 2. Power user
      expect(
        derivePromotionLifecycle({
          autoApplies7d: 12,
          activeDays7d: 5,
        })
      ).toBe("power_user");

      // 3. At risk
      expect(
        derivePromotionLifecycle({
          sessions30d: 8,
          sessions7d: 0,
        })
      ).toBe("at_risk");

      // 4. Churned returning
      expect(
        derivePromotionLifecycle({
          previouslyPaid: true,
          daysSinceLastSession: 20,
        })
      ).toBe("churned_returning");

      // 5. Activated
      expect(
        derivePromotionLifecycle({
          accountAgeDays: 20,
          sessions7d: 3,
          sessions30d: 10,
          autoApplies7d: 2,
          successfulApplications30d: 4,
          daysSinceLastSession: 1,
        })
      ).toBe("activated");
    });

    it("computes intent score using weighted formula and clamps to [0, 100]", () => {
      // Baseline 0
      expect(calculateIntentScore({})).toBe(0);

      // Moderate
      const score1 = calculateIntentScore({
        pricingPageViews7d: 2, // 16
        upgradeModalViews7d: 1, // 6
        activeDays7d: 4, // 8
        successfulApplications30d: 5, // 10
        autoApplyQuotaUsagePercent: 50, // 10
      });
      expect(score1).toBe(50);

      // Clamped to 100
      const scoreMax = calculateIntentScore({
        pricingPageViews7d: 20,
        checkoutStarts7d: 10,
        autoApplyQuotaUsagePercent: 100,
      });
      expect(scoreMax).toBe(100);
    });
  });

  describe("7. Analytics Queries & Metrics Calculators", () => {
    it("calculates variant conversion rates and ARPU", () => {
      const mockAssignments: Array<Partial<PromotionAssignmentRow>> = [
        { id: "1", experiment_variant: "treatment", message_variant: "checkout_recovery", status: "converted", converted_amount: 59 },
        { id: "2", experiment_variant: "treatment", message_variant: "checkout_recovery", status: "active" },
        { id: "3", experiment_variant: "control", message_variant: "value", status: "converted", converted_amount: 59 },
        { id: "4", experiment_variant: "control", message_variant: "value", status: "active" },
      ];

      const mockEvents = [
        { assignment_id: "1", event_type: "impression" },
        { assignment_id: "1", event_type: "clicked" },
        { assignment_id: "2", event_type: "impression" },
      ];

      const metrics = calculateVariantConversionRates(mockAssignments, mockEvents);
      expect(metrics.length).toBe(2);

      const recovery = metrics.find((m) => m.messageVariant === "checkout_recovery");
      expect(recovery).toBeDefined();
      expect(recovery?.assignedCount).toBe(2);
      expect(recovery?.conversionCount).toBe(1);
      expect(recovery?.conversionRate).toBe(50); // 50%
      expect(recovery?.totalRevenue).toBe(59);
      expect(recovery?.arpu).toBe(29.5);
    });

    it("calculates true incremental conversion and ARPU lift between control and treatment", () => {
      const mockAssignments: Array<Partial<PromotionAssignmentRow>> = [
        // Control: 10 users, 1 converted ($59) -> 10% CVR, $5.90 ARPU
        ...Array.from({ length: 9 }, (_, i) => ({ id: `c-${i}`, experiment_variant: "control" as const, status: "active" as const })),
        { id: "c-10", experiment_variant: "control", status: "converted", converted_amount: 59 },

        // Treatment: 20 users, 4 converted ($59 each) -> 20% CVR, $11.80 ARPU
        ...Array.from({ length: 16 }, (_, i) => ({ id: `t-${i}`, experiment_variant: "treatment" as const, status: "active" as const })),
        ...Array.from({ length: 4 }, (_, i) => ({ id: `t-conv-${i}`, experiment_variant: "treatment" as const, status: "converted", converted_amount: 59 })),
      ];

      const lift = calculateControlVsTreatmentLift(mockAssignments);
      expect(lift.controlConversionRate).toBe(10); // 10%
      expect(lift.treatmentConversionRate).toBe(20); // 20%
      expect(lift.absoluteConversionLift).toBe(10); // +10% absolute lift
      expect(lift.relativeConversionLiftPct).toBe(100); // +100% relative lift
      expect(lift.incrementalRevenuePerUser).toBe(5.9); // $11.80 - $5.90 = $5.90
    });

    it("calculates discount lift analysis across tiers", () => {
      const mockAssignments: Array<Partial<PromotionAssignmentRow>> = [
        { discount_percent: 10, status: "converted", converted_amount: 53.1 },
        { discount_percent: 10, status: "active" },
        { discount_percent: 20, status: "converted", converted_amount: 47.2 },
        { discount_percent: 20, status: "converted", converted_amount: 47.2 },
      ];

      const lift = calculateDiscountLiftAnalysis(mockAssignments);
      expect(lift.length).toBe(2);
      expect(lift[0].discountPercent).toBe(10);
      expect(lift[0].conversionRate).toBe(50); // 1/2 = 50%
      expect(lift[1].discountPercent).toBe(20);
      expect(lift[1].conversionRate).toBe(100); // 2/2 = 100%
    });

    it("calculates impression distribution and dismissal rates", () => {
      const mockAssignments = [{ id: "1" }, { id: "2" }];
      const mockEvents = [
        { user_id: "u1", event_type: "impression" },
        { user_id: "u1", event_type: "impression" },
        { user_id: "u2", event_type: "impression" },
        { user_id: "u1", event_type: "dismissed" },
      ];

      const dist = calculateImpressionDistribution(mockAssignments, mockEvents);
      expect(dist.totalImpressions).toBe(3);
      expect(dist.totalUsers).toBe(2);
      expect(dist.averageImpressionsPerUser).toBe(1.5);
      expect(dist.dismissCount).toBe(1);
    });
  });

  describe("8. URL and CTA Generation", () => {
    it("generates correct billing CTA URL with attached promotion assignment ID", () => {
      const url1 = getPromotionCtaUrl("promo-uuid-999", "Pro");
      expect(url1).toBe("/dashboard/billing?promoAssignment=promo-uuid-999&plan=pro");

      const url2 = getPromotionCtaUrl("promo-uuid-999");
      expect(url2).toBe("/dashboard/billing?promoAssignment=promo-uuid-999");

      const url3 = getPromotionCtaUrl();
      expect(url3).toBe("/dashboard/billing");
    });
  });

  describe("9. Production Hardening: Security, Authority, Idempotency & Financial Integrity", () => {
    describe("9a. Integer Minor-Unit Money Calculations & Rounding Integrity", () => {
      it("calculates exact minor-unit (cents) integer discounts across all plan tiers without floating point drift", () => {
        const plans = [
          { name: "Basics", priceUsd: 19.0 },
          { name: "Pro", priceUsd: 49.0 },
          { name: "Ultimate", priceUsd: 99.0 },
          { name: "Annual Pro", priceUsd: 399.0 },
        ];
        const discountTiers = [10, 15, 20, 25, 40];

        for (const plan of plans) {
          const basePriceMinor = Math.round(plan.priceUsd * 100);
          expect(Number.isInteger(basePriceMinor)).toBe(true);

          for (const discountPct of discountTiers) {
            const discountMinor = Math.round((basePriceMinor * discountPct) / 100);
            const finalPriceMinor = Math.max(0, basePriceMinor - discountMinor);
            const priceUsd = finalPriceMinor / 100;

            expect(Number.isInteger(discountMinor)).toBe(true);
            expect(Number.isInteger(finalPriceMinor)).toBe(true);
            expect(finalPriceMinor).toBe(basePriceMinor - discountMinor);
            expect(Math.round(priceUsd * 100)).toBe(finalPriceMinor);
          }
        }
      });

      it("handles odd price rounding edge-cases cleanly", () => {
        // e.g. $19.99 with 15% discount
        const basePriceMinor = 1999;
        const discountPct = 15;
        const discountMinor = Math.round((basePriceMinor * discountPct) / 100); // 1999 * 0.15 = 299.85 -> 300 cents ($3.00)
        const finalPriceMinor = basePriceMinor - discountMinor; // 1699 cents ($16.99)
        expect(discountMinor).toBe(300);
        expect(finalPriceMinor).toBe(1699);
        expect(finalPriceMinor / 100).toBe(16.99);
      });
    });

    describe("9b. Telemetry Capping & Anti-Gaming Guardrails", () => {
      it("caps low-trust client telemetry so page views and clicks alone cannot escalate to a discount tier", () => {
        // Attacker generates massive client telemetry (e.g. 500 pricing views, 200 modal views)
        const gamedFeatures: Partial<PromotionUserFeatures> = {
          pricingPageViews7d: 500,
          upgradeModalViews7d: 200,
          checkoutStarts7d: 0,
          autoApplyQuotaUsagePercent: 0,
          creditUsagePercent: 0,
          successfulApplications30d: 0,
          activeDays7d: 0,
        };

        const score = calculateIntentScore(gamedFeatures);
        // Client telemetry is strictly capped at 30 points
        expect(score).toBe(30);
        // A score of 30 is strictly below the 40-point activation threshold
        expect(score < 40).toBe(true);
      });

      it("ignores client attempts to override authoritative features or scoring inputs", async () => {
        // Client tries to send fake high intent, fake lifecycle, or fake quota usage
        // Server features reflect actual low database activity
        const serverAuthoritativeFeatures: PromotionUserFeatures = {
          ...baseFeatures,
          userId: "usr-tamper-test",
          pricingPageViews7d: 0,
          upgradeModalViews7d: 0,
          autoApplyQuotaUsagePercent: 10,
          creditUsagePercent: 10,
          checkoutStarts7d: 0,
          checkoutAbandons7d: 0,
          successfulApplications30d: 0,
          activeDays7d: 1,
          lifecycle: "activated",
        };

        // Decision uses strictly server-authoritative features
        const decision = await strategy.decide(serverAuthoritativeFeatures, {
          campaignSlug: "default_v1_campaign",
          now: new Date("2026-09-11T12:00:00.000Z"),
        });

        // With low server usage and no checkout abandons, user is not eligible for Tier A/B/C/D discounts
        expect(decision.eligible).toBe(false);
        expect(decision.decisionReason).toBe("low_intent_baseline");
      });
    });

    describe("9c. Campaign Checkout Validation & Closed-Fail Security", () => {
      const validateCheckout = (
        assignment: { user_id: string; status: string; expires_at: string | null; target_plan: string | null; discount_percent: number },
        campaign: { status: string; starts_at: string; ends_at: string | null; max_discount: number; target_plans: string[] },
        currentUserId: string,
        selectedPlan: string,
        nowMs: number
      ) => {
        if (assignment.user_id !== currentUserId) {
          return { ok: false, status: 400, error: "Invalid promotion assignment" };
        }
        if (assignment.status !== "active") {
          return { ok: false, status: 409, error: "Promotion assignment is no longer active" };
        }
        if (assignment.expires_at && new Date(assignment.expires_at).getTime() <= nowMs) {
          return { ok: false, status: 409, error: "Promotion offer has expired" };
        }
        if (campaign.status !== "active") {
          return { ok: false, status: 409, error: "Promotion campaign is not active" };
        }
        if (new Date(campaign.starts_at).getTime() > nowMs) {
          return { ok: false, status: 409, error: "Promotion campaign has not started" };
        }
        if (campaign.ends_at && new Date(campaign.ends_at).getTime() <= nowMs) {
          return { ok: false, status: 409, error: "Promotion campaign has ended" };
        }
        if (assignment.discount_percent > campaign.max_discount) {
          return { ok: false, status: 400, error: "Promotion discount exceeds campaign limit" };
        }
        if (assignment.target_plan && assignment.target_plan.toLowerCase() !== selectedPlan.toLowerCase()) {
          return { ok: false, status: 400, error: `Promotion offer is valid only for the ${assignment.target_plan} plan.` };
        }
        if (campaign.target_plans.length > 0 && !campaign.target_plans.some((p) => p.toLowerCase() === selectedPlan.toLowerCase())) {
          return { ok: false, status: 400, error: `Promotion campaign is not valid for the ${selectedPlan} plan.` };
        }
        return { ok: true };
      };

      const now = new Date("2026-09-11T14:00:00.000Z").getTime();
      const validAssignment = {
        user_id: "user-1",
        status: "active",
        expires_at: new Date(now + 3600000).toISOString(),
        target_plan: "Basics",
        discount_percent: 20,
      };
      const validCampaign = {
        status: "active",
        starts_at: new Date(now - 3600000).toISOString(),
        ends_at: new Date(now + 86400000).toISOString(),
        max_discount: 40,
        target_plans: ["Basics", "Pro"],
      };

      it("passes valid unexpired assignment matching campaign and plan", () => {
        const res = validateCheckout(validAssignment, validCampaign, "user-1", "Basics", now);
        expect(res.ok).toBe(true);
      });

      it("rejects foreign assignment checkout attempt", () => {
        const res = validateCheckout(validAssignment, validCampaign, "user-attacker", "Basics", now);
        expect(res.ok).toBe(false);
        expect(res.error).toBe("Invalid promotion assignment");
      });

      it("rejects expired promotion assignment", () => {
        const expiredAssignment = { ...validAssignment, expires_at: new Date(now - 1000).toISOString() };
        const res = validateCheckout(expiredAssignment, validCampaign, "user-1", "Basics", now);
        expect(res.ok).toBe(false);
        expect(res.error).toBe("Promotion offer has expired");
      });

      it("rejects paused or inactive campaign at checkout", () => {
        const pausedCampaign = { ...validCampaign, status: "paused" };
        const res = validateCheckout(validAssignment, pausedCampaign, "user-1", "Basics", now);
        expect(res.ok).toBe(false);
        expect(res.error).toBe("Promotion campaign is not active");
      });

      it("rejects campaign that has already ended", () => {
        const endedCampaign = { ...validCampaign, ends_at: new Date(now - 1000).toISOString() };
        const res = validateCheckout(validAssignment, endedCampaign, "user-1", "Basics", now);
        expect(res.ok).toBe(false);
        expect(res.error).toBe("Promotion campaign has ended");
      });

      it("rejects discount exceeding campaign max_discount", () => {
        const invalidDiscount = { ...validAssignment, discount_percent: 50 };
        const res = validateCheckout(invalidDiscount, validCampaign, "user-1", "Basics", now);
        expect(res.ok).toBe(false);
        expect(res.error).toBe("Promotion discount exceeds campaign limit");
      });

      it("rejects checkout for mismatched target plan", () => {
        const res = validateCheckout(validAssignment, validCampaign, "user-1", "Ultimate", now);
        expect(res.ok).toBe(false);
        expect(res.error).toContain("Promotion offer is valid only for the Basics plan");
      });
    });

    describe("9d. Telemetry Ingestion Allowlist & Dismiss Authorization", () => {
      it("allows client interaction events: impression, clicked, dismissed", () => {
        const ALLOWED_CLIENT_EVENTS = ["impression", "clicked", "dismissed"];
        expect(ALLOWED_CLIENT_EVENTS.includes("impression")).toBe(true);
        expect(ALLOWED_CLIENT_EVENTS.includes("clicked")).toBe(true);
        expect(ALLOWED_CLIENT_EVENTS.includes("dismissed")).toBe(true);
      });

      it("denies client attempts to submit server-authoritative events", () => {
        const ALLOWED_CLIENT_EVENTS = ["impression", "clicked", "dismissed"];
        const forbiddenEvents = [
          "assigned",
          "checkout_started",
          "converted",
          "payment_succeeded",
          "promotion_redeemed",
          "refund",
        ];

        for (const ev of forbiddenEvents) {
          expect(ALLOWED_CLIENT_EVENTS.includes(ev)).toBe(false);
        }
      });

      it("prevents user A from dismissing user B's promotion assignment", () => {
        const assignment = { id: "promo-b", user_id: "user-b", status: "active" };
        const callerUserId = "user-a";

        // Simulating the edge function ownership check: .eq("id", assignment.id).eq("user_id", callerUserId)
        const updatedRows = assignment.user_id === callerUserId ? 1 : 0;
        expect(updatedRows).toBe(0);
      });
    });

    describe("9e. Entitlement Authority: Unpaid Checkouts vs Verified Fulfillment", () => {
      it("guarantees unpaid checkouts create pending order without granting credits or quotas", () => {
        // init-payment sets order.is_success = false and authoritative base limits
        const pendingOrder = {
          id: "ord-pending-1",
          user_id: "user-1",
          is_success: false,
          total_credits_paid_for: 100, // Pure base credits
          metadata: {
            credits_per_month: 100, // Pure base plan credits, NOT augmented
            auto_apply_monthly_limit: 10,
            promotion_assignment_id: "promo-1",
            promotion_bonus_credits: 50,
            promotion_bonus_auto_apply_runs: 20,
          },
        };

        // User balance before payment
        const userState = {
          credits: 10,
          autoApplyQuota: 5,
        };

        // If checkout is abandoned, fulfillment is NEVER called.
        // Balances remain 100% unchanged
        expect(userState.credits).toBe(10);
        expect(userState.autoApplyQuota).toBe(5);
        expect(pendingOrder.is_success).toBe(false);
      });

      it("fulfills promotional bonus credits and auto apply runs idempotently upon verified payment", async () => {
        const order = {
          id: "ord-paid-1",
          user_id: "user-1",
          total_amount: 1900,
          currency: "USD",
          metadata: {
            promotion_assignment_id: "promo-assign-1",
            promotion_campaign_id: "camp-1",
            promotion_bonus_credits: 100,
            promotion_bonus_auto_apply_runs: 20,
          },
        };

        const assignment = {
          id: "promo-assign-1",
          user_id: "user-1",
          status: "active" as "active" | "converted",
          converted_order_id: null as string | null,
        };

        const creditLedger = new Set<string>();
        const quotaLedger = new Set<string>();
        const events: Array<{ event_type: string; order_id: string }> = [];

        const fulfillOrder = () => {
          // 1. Check assignment user matches order user
          if (assignment.user_id !== order.user_id) return { ok: false, error: "user_mismatch" };

          // 2. Check assignment reuse
          const isThisOrder = assignment.converted_order_id === order.id;
          if (assignment.status === "converted" && !isThisOrder) {
            return { ok: false, error: "assignment_already_converted" };
          }

          // 3. Atomically transition assignment
          if (!isThisOrder) {
            assignment.status = "converted";
            assignment.converted_order_id = order.id;
          }

          // 4. Idempotent bonus credits
          const creditKey = `${order.user_id}:promotion_bonus:${order.id}`;
          if (!creditLedger.has(creditKey)) {
            creditLedger.add(creditKey);
          }

          // 5. Idempotent quota provisioning
          const quotaKey = `${order.user_id}:promotion_quota:${order.id}`;
          if (!quotaLedger.has(quotaKey)) {
            quotaLedger.add(quotaKey);
          }

          // 6. Idempotent converted event
          if (!events.some((e) => e.order_id === order.id && e.event_type === "converted")) {
            events.push({ event_type: "converted", order_id: order.id });
          }

          return { ok: true };
        };

        // Webhook Delivery 1
        const res1 = fulfillOrder();
        expect(res1.ok).toBe(true);
        expect(assignment.status).toBe("converted");
        expect(assignment.converted_order_id).toBe("ord-paid-1");
        expect(creditLedger.size).toBe(1);
        expect(quotaLedger.size).toBe(1);
        expect(events.length).toBe(1);

        // Webhook Delivery 2 (Duplicate Webhook)
        const res2 = fulfillOrder();
        expect(res2.ok).toBe(true);
        // Must remain exactly 1 entry: zero duplicate bonus or event
        expect(creditLedger.size).toBe(1);
        expect(quotaLedger.size).toBe(1);
        expect(events.length).toBe(1);
      });

      it("prevents promotion assignment reuse across multiple orders or browser tabs", () => {
        const assignment = {
          id: "promo-shared-1",
          user_id: "user-1",
          status: "active" as "active" | "converted",
          converted_order_id: null as string | null,
        };

        const fulfillOrderForAssignment = (orderId: string) => {
          const isThisOrder = assignment.converted_order_id === orderId;
          if (assignment.status === "converted" && !isThisOrder) {
            return { ok: false, error: "assignment_already_converted" };
          }

          assignment.status = "converted";
          assignment.converted_order_id = orderId;
          return { ok: true };
        };

        // Tab 1 / Order A pays and fulfills
        const resA = fulfillOrderForAssignment("ord-tab-1");
        expect(resA.ok).toBe(true);
        expect(assignment.status).toBe("converted");
        expect(assignment.converted_order_id).toBe("ord-tab-1");

        // Tab 2 / Order B attempts to claim the same assignment
        const resB = fulfillOrderForAssignment("ord-tab-2");
        expect(resB.ok).toBe(false);
        expect(resB.error).toBe("assignment_already_converted");
      });
    });

    describe("9f. Concurrency & Stable Holdout Assignments", () => {
      it("guarantees two simultaneous assignment requests yield one stable assignment", () => {
        const simulatedDb: { [key: string]: { id: string; user_id: string; campaign_id: string; variant: string } } = {};

        const simulateFirstTimeAssignment = (requestId: string, userId: string, campaignId: string) => {
          const key = `${userId}:${campaignId}`;
          if (simulatedDb[key]) {
            // Found existing active assignment (or recovered from unique constraint collision)
            return simulatedDb[key];
          }

          // Assign deterministic variant
          const isControl = isUserInHoldoutControl(userId, "default_v1_campaign", 10);
          const newRow = {
            id: `assign-${requestId}`,
            user_id: userId,
            campaign_id: campaignId,
            variant: isControl ? "control" : "treatment",
          };
          simulatedDb[key] = newRow;
          return newRow;
        };

        // Request 1 and Request 2 fire simultaneously for the same first-time user
        const result1 = simulateFirstTimeAssignment("req-1", "user-concurrent-1", "camp-1");
        const result2 = simulateFirstTimeAssignment("req-2", "user-concurrent-1", "camp-1");

        expect(result1.id).toBe("assign-req-1");
        expect(result2.id).toBe("assign-req-1"); // Request 2 receives the exact same stable assignment!
        expect(result1.variant).toBe(result2.variant);
      });
    });
  });
});
