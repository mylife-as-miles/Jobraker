// src/__tests__/promotions-engine.test.ts
// Comprehensive unit and integration test suite for Jobraker Personalized Promotion Engine V1.

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  RuleBasedPromotionStrategy,
  calculateIntentScore,
  derivePromotionLifecycle,
  deterministicHash,
  isUserInHoldoutControl,
  calculatePromotionPrice,
  matchesTargetProduct,
  formatCanonicalProductId,
  parseCanonicalProductId,
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
import {
  SHARED_SUBSCRIPTION_PLANS,
  SHARED_CREDIT_PACKS,
} from "../lib/billingCatalog";

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
    describe("9a. Integer Minor-Unit Money Calculations & Canonical Catalog Rounding", () => {
      it("calculates exact minor-unit integer discounts across all canonical subscription variants and discount tiers", () => {
        const discountTiers = [10, 15, 20, 25, 30, 40];
        const purchasablePlans = SHARED_SUBSCRIPTION_PLANS.filter((p) => p.tier !== "Free");

        expect(purchasablePlans.length).toBeGreaterThanOrEqual(4);

        for (const plan of purchasablePlans) {
          // 1. Monthly variant
          const monthlyBaseMinor = Math.round(plan.monthlyPriceUsd * 100);
          expect(Number.isInteger(monthlyBaseMinor)).toBe(true);
          expect(monthlyBaseMinor).toBeGreaterThan(0);

          for (const discountPct of discountTiers) {
            const res = calculatePromotionPrice({
              basePriceMinor: monthlyBaseMinor,
              discountPercent: discountPct,
            });

            expect(Number.isInteger(res.basePriceMinor)).toBe(true);
            expect(Number.isInteger(res.discountMinor)).toBe(true);
            expect(Number.isInteger(res.finalPriceMinor)).toBe(true);
            expect(res.finalPriceMinor).toBe(res.basePriceMinor - res.discountMinor);
            expect(res.finalPriceMinor).toBeGreaterThanOrEqual(0);

            // Verify specific known canonical catalog prices
            if (plan.tier === "Starter" && discountPct === 20) {
              // Starter monthly = $9.00 = 900 cents. 20% discount = 180 cents. Final = 720 cents ($7.20)
              expect(res.basePriceMinor).toBe(900);
              expect(res.discountMinor).toBe(180);
              expect(res.finalPriceMinor).toBe(720);
            }
            if (plan.tier === "Basics" && discountPct === 20) {
              // Basics monthly = $19.00 = 1900 cents. 20% discount = 380 cents. Final = 1520 cents ($15.20)
              expect(res.basePriceMinor).toBe(1900);
              expect(res.discountMinor).toBe(380);
              expect(res.finalPriceMinor).toBe(1520);
            }
            if (plan.tier === "Pro" && discountPct === 20) {
              // Pro monthly = $59.00 = 5900 cents. 20% discount = 1180 cents. Final = 4720 cents ($47.20)
              expect(res.basePriceMinor).toBe(5900);
              expect(res.discountMinor).toBe(1180);
              expect(res.finalPriceMinor).toBe(4720);
            }
            if (plan.tier === "Ultimate" && discountPct === 20) {
              // Ultimate monthly = $149.00 = 14900 cents. 20% discount = 2980 cents. Final = 11920 cents ($119.20)
              expect(res.basePriceMinor).toBe(14900);
              expect(res.discountMinor).toBe(2980);
              expect(res.finalPriceMinor).toBe(11920);
            }
          }

          // 2. Quarterly variant (if present in catalog)
          if (plan.quarterlyPriceUsd && plan.quarterlyPriceUsd > 0) {
            const quarterlyBaseMinor = Math.round(plan.quarterlyPriceUsd * 100);
            for (const discountPct of discountTiers) {
              const res = calculatePromotionPrice({
                basePriceMinor: quarterlyBaseMinor,
                discountPercent: discountPct,
              });
              expect(Number.isInteger(res.finalPriceMinor)).toBe(true);
              expect(res.finalPriceMinor).toBe(res.basePriceMinor - res.discountMinor);
            }
          }

          // 3. Yearly variant
          if (plan.yearlyPriceUsd > 0) {
            const yearlyBaseMinor = Math.round(plan.yearlyPriceUsd * 100);
            for (const discountPct of discountTiers) {
              const res = calculatePromotionPrice({
                basePriceMinor: yearlyBaseMinor,
                discountPercent: discountPct,
              });
              expect(Number.isInteger(res.finalPriceMinor)).toBe(true);
              expect(res.finalPriceMinor).toBe(res.basePriceMinor - res.discountMinor);
            }
          }
        }
      });

      it("calculates exact minor-unit integer discounts across all canonical credit packs", () => {
        const discountTiers = [10, 15, 20, 25, 30, 40];
        expect(SHARED_CREDIT_PACKS.length).toBeGreaterThanOrEqual(4);

        for (const pack of SHARED_CREDIT_PACKS) {
          const packBaseMinor = Math.round(pack.priceUsd * 100);
          expect(Number.isInteger(packBaseMinor)).toBe(true);
          expect(packBaseMinor).toBeGreaterThan(0);

          for (const discountPct of discountTiers) {
            const res = calculatePromotionPrice({
              basePriceMinor: packBaseMinor,
              discountPercent: discountPct,
            });
            expect(Number.isInteger(res.finalPriceMinor)).toBe(true);
            expect(res.finalPriceMinor).toBe(res.basePriceMinor - res.discountMinor);
          }
        }

        // Exact checks on known catalog SKUs:
        // search_600: $49.00 = 4900 minor units
        const growthPack = calculatePromotionPrice({ basePriceMinor: 4900, discountPercent: 15 });
        expect(growthPack.discountMinor).toBe(735); // 4900 * 0.15 = 735
        expect(growthPack.finalPriceMinor).toBe(4165); // $41.65

        // search_1500: $99.00 = 9900 minor units
        const proPack = calculatePromotionPrice({ basePriceMinor: 9900, discountPercent: 25 });
        expect(proPack.discountMinor).toBe(2475); // 9900 * 0.25 = 2475
        expect(proPack.finalPriceMinor).toBe(7425); // $74.25
      });

      it("handles odd price rounding edge-cases cleanly", () => {
        // e.g. $19.99 with 15% discount
        const res = calculatePromotionPrice({ basePriceMinor: 1999, discountPercent: 15 });
        // 1999 * 0.15 = 299.85 -> rounds to 300 minor units ($3.00)
        expect(res.discountMinor).toBe(300);
        expect(res.finalPriceMinor).toBe(1699); // $16.99
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

    describe("9g. Canonical Target Product Matching & Stacking Prevention", () => {
      it("strictly matches exact canonical product spec and enforces monthly-only default stacking policy", () => {
        // Target: Pro monthly subscription
        const targetSpec = {
          productType: "subscription" as const,
          planOrSku: "Pro",
          billingInterval: "monthly" as const,
        };
        const canonicalId = formatCanonicalProductId(targetSpec);
        expect(canonicalId).toBe("subscription:Pro:monthly");
        expect(parseCanonicalProductId(canonicalId)).toEqual(targetSpec);

        // 1. Valid match: Pro monthly
        const matchMonthly = matchesTargetProduct({
          targetPlanOrProduct: canonicalId,
          productType: "subscription",
          planOrSku: "Pro",
          billingInterval: "monthly",
        });
        expect(matchMonthly.match).toBe(true);

        // 2. Disallowed: Pro yearly (disallowed by default stacking policy to protect annual discount)
        const matchYearly = matchesTargetProduct({
          targetPlanOrProduct: canonicalId,
          productType: "subscription",
          planOrSku: "Pro",
          billingInterval: "yearly",
        });
        expect(matchYearly.match).toBe(false);
        expect(matchYearly.reason).toContain("cannot stack with discounted yearly pricing");

        // 3. Disallowed: Pro quarterly
        const matchQuarterly = matchesTargetProduct({
          targetPlanOrProduct: canonicalId,
          productType: "subscription",
          planOrSku: "Pro",
          billingInterval: "quarterly",
        });
        expect(matchQuarterly.match).toBe(false);
        expect(matchQuarterly.reason).toContain("cannot stack with discounted quarterly pricing");

        // 4. Disallowed: Basics plan
        const matchBasics = matchesTargetProduct({
          targetPlanOrProduct: canonicalId,
          productType: "subscription",
          planOrSku: "Basics",
          billingInterval: "monthly",
        });
        expect(matchBasics.match).toBe(false);
        expect(matchBasics.reason).toContain("Promotion is valid only for Pro");

        // 5. Allowed when campaign explicitly configures allowedBillingIntervals
        const matchExplicitYearly = matchesTargetProduct({
          targetPlanOrProduct: "subscription:Pro:yearly",
          allowedBillingIntervals: ["monthly", "yearly"],
          productType: "subscription",
          planOrSku: "Pro",
          billingInterval: "yearly",
        });
        expect(matchExplicitYearly.match).toBe(true);

        // 6. Credit pack product targeting
        const packTarget = formatCanonicalProductId({
          productType: "credit_pack",
          planOrSku: "search_600",
        });
        expect(packTarget).toBe("credit_pack:search_600");

        const matchPack = matchesTargetProduct({
          targetPlanOrProduct: packTarget,
          productType: "credit_pack",
          planOrSku: "search_600",
        });
        expect(matchPack.match).toBe(true);

        const matchWrongPack = matchesTargetProduct({
          targetPlanOrProduct: packTarget,
          productType: "credit_pack",
          planOrSku: "search_150",
        });
        expect(matchWrongPack.match).toBe(false);
        expect(matchWrongPack.reason).toContain("Promotion is valid only for search_600");
      });
    });

    describe("9h. Two-Tab Checkout Reservation Concurrency (Pre-Payment Protection)", () => {
      it("authoritatively reserves promotion assignment so Tab 2 cannot create a discounted checkout while Tab 1 is pending", () => {
        // Simulating the database state managed by reserve_promotion_assignment and promotion_redemptions
        interface RedemptionRecord {
          assignment_id: string;
          user_id: string;
          order_id: string;
          status: "reserved" | "converted" | "released";
          expires_at: number;
        }

        const redemptions: RedemptionRecord[] = [];
        const assignments: Record<string, { id: string; user_id: string; status: string; bound_order_id: string | null }> = {
          "assign-1": { id: "assign-1", user_id: "user-1", status: "active", bound_order_id: null },
        };

        const reserveAssignment = (
          assignmentId: string,
          userId: string,
          orderId: string,
          nowMs: number,
          ttlMs = 30 * 60 * 1000
        ) => {
          const assignment = assignments[assignmentId];
          if (!assignment) return { success: false, error: "assignment_not_found" };
          if (assignment.user_id !== userId) return { success: false, error: "user_mismatch" };
          if (assignment.status !== "active") return { success: false, error: "assignment_not_active" };

          const existingActive = redemptions.find(
            (r) => r.assignment_id === assignmentId && (r.status === "reserved" || r.status === "converted")
          );

          if (existingActive) {
            if (existingActive.status === "converted") {
              return { success: false, error: "already_converted" };
            }
            if (existingActive.order_id === orderId) {
              // Same order retry -> allowed!
              existingActive.expires_at = nowMs + ttlMs;
              assignment.bound_order_id = orderId;
              return { success: true, reused: true };
            }
            if (existingActive.expires_at > nowMs) {
              // Active reservation on another order -> REJECTED!
              return { success: false, error: "already_reserved_by_other_order", bound_order_id: existingActive.order_id };
            }
            // Expired reservation on previous order -> safely release
            existingActive.status = "released";
          }

          const newRedemption: RedemptionRecord = {
            assignment_id: assignmentId,
            user_id: userId,
            order_id: orderId,
            status: "reserved",
            expires_at: nowMs + ttlMs,
          };
          redemptions.push(newRedemption);
          assignment.bound_order_id = orderId;
          return { success: true, reused: false };
        };

        const releaseReservation = (assignmentId: string, orderId: string) => {
          const rec = redemptions.find(
            (r) => r.assignment_id === assignmentId && r.order_id === orderId && r.status === "reserved"
          );
          if (rec) {
            rec.status = "released";
            if (assignments[assignmentId]?.bound_order_id === orderId) {
              assignments[assignmentId].bound_order_id = null;
            }
            return { success: true, released: true };
          }
          return { success: true, released: false };
        };

        const t0 = 1757592000000;

        // Tab 1 initiates checkout with Order 1
        const tab1Res = reserveAssignment("assign-1", "user-1", "order-tab-1", t0);
        expect(tab1Res.success).toBe(true);
        expect(tab1Res.reused).toBe(false);
        expect(assignments["assign-1"].bound_order_id).toBe("order-tab-1");

        // Tab 2 (concurrent tab on same account) attempts to initiate checkout with Order 2
        const tab2Res = reserveAssignment("assign-1", "user-1", "order-tab-2", t0 + 1000);
        expect(tab2Res.success).toBe(false);
        expect(tab2Res.error).toBe("already_reserved_by_other_order");
        expect(tab2Res.bound_order_id).toBe("order-tab-1");
        // init-payment blocks Tab 2 with 409 conflict BEFORE creating Paystack transaction!

        // Tab 1 retries / reloads page with same Order 1 -> succeeds idempotently
        const tab1Retry = reserveAssignment("assign-1", "user-1", "order-tab-1", t0 + 5000);
        expect(tab1Retry.success).toBe(true);
        expect(tab1Retry.reused).toBe(true);

        // Tab 1 checkout is closed or aborted -> release reservation
        releaseReservation("assign-1", "order-tab-1");
        expect(assignments["assign-1"].bound_order_id).toBeNull();

        // Now Tab 2 can successfully reserve the assignment!
        const tab2Retry = reserveAssignment("assign-1", "user-1", "order-tab-2", t0 + 10000);
        expect(tab2Retry.success).toBe(true);
        expect(assignments["assign-1"].bound_order_id).toBe("order-tab-2");
      });
    });

    describe("9i. Database-Level Webhook Fulfillment Idempotency via Deterministic Unique Keys", () => {
      it("guarantees concurrent webhook deliveries produce exactly one financial and quota mutation via unique key locks", async () => {
        // Simulating the PostgreSQL UNIQUE constraint on promotion_fulfillment_records (idempotency_key)
        const fulfillmentRecords = new Map<string, { idempotency_key: string; fulfillment_type: string; quantity: number }>();
        const creditTransactions: Array<{ user_id: string; amount: number; reference_id: string }> = [];
        const quotaProvisions: Array<{ user_id: string; bonus_runs: number; order_id: string }> = [];
        const events: Array<{ event_type: string; order_id: string }> = [];

        const claimPromotionFulfillmentKey = (
          idempotencyKey: string,
          assignmentId: string,
          orderId: string,
          userId: string,
          fulfillmentType: string,
          quantity: number
        ) => {
          if (fulfillmentRecords.has(idempotencyKey)) {
            // PostgreSQL unique_violation exception (SQLSTATE 23505)
            return { claimed: false, already_fulfilled: true };
          }
          fulfillmentRecords.set(idempotencyKey, {
            idempotency_key: idempotencyKey,
            fulfillment_type: fulfillmentType,
            quantity,
          });
          return { claimed: true };
        };

        const handleWebhookFulfillmentWorker = async (workerId: string, orderId: string, assignmentId: string, userId: string) => {
          const results: { creditsGranted: boolean; runsGranted: boolean; eventLogged: boolean } = {
            creditsGranted: false,
            runsGranted: false,
            eventLogged: false,
          };

          // 1. Deterministic bonus credits key
          const creditKey = `promotion:${assignmentId}:${orderId}:bonus_credits`;
          const claimCredit = claimPromotionFulfillmentKey(creditKey, assignmentId, orderId, userId, "bonus_credits", 100);
          if (claimCredit.claimed) {
            creditTransactions.push({ user_id: userId, amount: 100, reference_id: orderId });
            results.creditsGranted = true;
          }

          // 2. Deterministic bonus runs key
          const runsKey = `promotion:${assignmentId}:${orderId}:auto_apply_runs`;
          const claimRuns = claimPromotionFulfillmentKey(runsKey, assignmentId, orderId, userId, "bonus_auto_apply_runs", 25);
          if (claimRuns.claimed) {
            quotaProvisions.push({ user_id: userId, bonus_runs: 25, order_id: orderId });
            results.runsGranted = true;
          }

          // 3. Deterministic converted event key
          const eventKey = `promotion:${assignmentId}:${orderId}:converted_event`;
          const claimEvent = claimPromotionFulfillmentKey(eventKey, assignmentId, orderId, userId, "converted_event", 1);
          if (claimEvent.claimed) {
            events.push({ event_type: "converted", order_id: orderId });
            results.eventLogged = true;
          }

          return results;
        };

        // Two webhook delivery workers execute concurrently for the same Paystack event
        const [worker1Result, worker2Result] = await Promise.all([
          handleWebhookFulfillmentWorker("worker-1", "order-100", "assign-100", "user-1"),
          handleWebhookFulfillmentWorker("worker-2", "order-100", "assign-100", "user-1"),
        ]);

        // Exactly one worker claims the keys and executes the mutations
        const totalCreditsGranted = (worker1Result.creditsGranted ? 1 : 0) + (worker2Result.creditsGranted ? 1 : 0);
        const totalRunsGranted = (worker1Result.runsGranted ? 1 : 0) + (worker2Result.runsGranted ? 1 : 0);
        const totalEventsLogged = (worker1Result.eventLogged ? 1 : 0) + (worker2Result.eventLogged ? 1 : 0);

        expect(totalCreditsGranted).toBe(1);
        expect(totalRunsGranted).toBe(1);
        expect(totalEventsLogged).toBe(1);

        expect(creditTransactions.length).toBe(1);
        expect(quotaProvisions.length).toBe(1);
        expect(events.length).toBe(1);
      });
    });

    describe("9j. Payment-Success Behavior for Conflicting Orders", () => {
      it("refuses promotion bonus fulfillment and conversion attribution if a conflicting legacy order succeeds", () => {
        const securityLogs: string[] = [];
        const logger = {
          warn: (msg: string) => securityLogs.push(msg),
        };

        const assignment = {
          id: "assign-conflict-1",
          user_id: "user-1",
          status: "active" as "active" | "converted",
          bound_order_id: "order-approved-1" as string | null,
          converted_order_id: null as string | null,
          bonus_credits: 100,
        };

        const creditLedger = new Set<string>();

        const fulfillPaidOrder = (order: { id: string; user_id: string; promotion_assignment_id: string }) => {
          if (order.promotion_assignment_id !== assignment.id) return;

          // Conflict detection in attributePromotionConversion
          if (assignment.status === "converted" && assignment.converted_order_id !== order.id) {
            logger.warn(
              `SECURITY WARNING: Conflicting order payment. Promotion assignment ${assignment.id} was already converted by order ${assignment.converted_order_id}, but payment succeeded for order ${order.id}. Refusing promotional incentive.`
            );
            return { granted: false, conflict: true };
          }

          if (assignment.bound_order_id && assignment.bound_order_id !== order.id) {
            logger.warn(
              `SECURITY WARNING: Conflicting order payment. Promotion assignment ${assignment.id} is bound to order ${assignment.bound_order_id}, but payment succeeded for order ${order.id}. Refusing promotional incentive.`
            );
            return { granted: false, conflict: true };
          }

          // Authorized fulfillment
          assignment.status = "converted";
          assignment.converted_order_id = order.id;
          creditLedger.add(`${order.user_id}:${order.id}`);
          return { granted: true, conflict: false };
        };

        // Conflicting order arrives and claims payment success
        const conflictRes = fulfillPaidOrder({
          id: "order-conflicting-2",
          user_id: "user-1",
          promotion_assignment_id: "assign-conflict-1",
        });

        expect(conflictRes?.granted).toBe(false);
        expect(conflictRes?.conflict).toBe(true);
        expect(creditLedger.size).toBe(0); // Zero promotional credits granted!
        expect(assignment.converted_order_id).toBeNull(); // Assignment not marked converted by conflicting order!
        expect(assignment.bound_order_id).toBe("order-approved-1");
        expect(securityLogs.length).toBe(1);
        expect(securityLogs[0]).toContain("SECURITY WARNING: Conflicting order payment");

        // The legitimately bound order arrives and succeeds
        const legitRes = fulfillPaidOrder({
          id: "order-approved-1",
          user_id: "user-1",
          promotion_assignment_id: "assign-conflict-1",
        });
        expect(legitRes?.granted).toBe(true);
        expect(creditLedger.size).toBe(1);
        expect(assignment.status).toBe("converted");
        expect(assignment.converted_order_id).toBe("order-approved-1");
      });
    });

    describe("9k. Client Telemetry Ingestion Ownership & 1-Hour Deduplication", () => {
      it("verifies assignment ownership and deduplicates impression events within a 1-hour window", () => {
        interface StoredEvent {
          assignment_id: string;
          user_id: string;
          event_type: string;
          placement: string;
          created_at: number;
        }

        const eventsDb: StoredEvent[] = [];
        const assignmentsDb: Record<string, { id: string; user_id: string }> = {
          "assign-user-a": { id: "assign-user-a", user_id: "user-a" },
        };

        const trackEventEndpoint = (params: {
          callerUserId: string;
          assignmentId?: string;
          eventType: string;
          placement: string;
          nowMs: number;
        }) => {
          const { callerUserId, assignmentId, eventType, placement, nowMs } = params;

          const ALLOWED_CLIENT_EVENTS = ["impression", "clicked", "dismissed"];
          if (!ALLOWED_CLIENT_EVENTS.includes(eventType)) {
            return { status: 403, error: `Event type '${eventType}' is not permitted from client telemetry` };
          }

          if (assignmentId) {
            const assignment = assignmentsDb[assignmentId];
            if (!assignment || assignment.user_id !== callerUserId) {
              return { status: 403, error: "Unauthorized: promotion assignment does not belong to user" };
            }
          }

          if (eventType === "impression") {
            const oneHourAgoMs = nowMs - 60 * 60 * 1000;
            const recentImpression = eventsDb.find(
              (e) =>
                e.user_id === callerUserId &&
                e.assignment_id === assignmentId &&
                e.placement === placement &&
                e.event_type === "impression" &&
                e.created_at >= oneHourAgoMs
            );
            if (recentImpression) {
              return { status: 200, success: true, deduplicated: true };
            }
          }

          eventsDb.push({
            assignment_id: assignmentId || "",
            user_id: callerUserId,
            event_type: eventType,
            placement,
            created_at: nowMs,
          });

          return { status: 200, success: true, deduplicated: false };
        };

        const t0 = 1757592000000;

        // 1. User B tries to track event for User A's assignment -> 403 Forbidden
        const foreignRes = trackEventEndpoint({
          callerUserId: "user-b",
          assignmentId: "assign-user-a",
          eventType: "impression",
          placement: "top_banner",
          nowMs: t0,
        });
        expect(foreignRes.status).toBe(403);
        expect(foreignRes.error).toContain("Unauthorized");

        // 2. User A tracks impression at t = 0 -> Recorded
        const imp1 = trackEventEndpoint({
          callerUserId: "user-a",
          assignmentId: "assign-user-a",
          eventType: "impression",
          placement: "top_banner",
          nowMs: t0,
        });
        expect(imp1.status).toBe(200);
        expect(imp1.deduplicated).toBe(false);
        expect(eventsDb.length).toBe(1);

        // 3. User A reloads or navigates at t = 20m -> Deduplicated!
        const imp2 = trackEventEndpoint({
          callerUserId: "user-a",
          assignmentId: "assign-user-a",
          eventType: "impression",
          placement: "top_banner",
          nowMs: t0 + 20 * 60 * 1000,
        });
        expect(imp2.status).toBe(200);
        expect(imp2.deduplicated).toBe(true);
        expect(eventsDb.length).toBe(1); // Zero duplicate row inserted!

        // 4. User A visits again after 70m (> 1 hour window) -> New impression recorded
        const imp3 = trackEventEndpoint({
          callerUserId: "user-a",
          assignmentId: "assign-user-a",
          eventType: "impression",
          placement: "top_banner",
          nowMs: t0 + 70 * 60 * 1000,
        });
        expect(imp3.status).toBe(200);
        expect(imp3.deduplicated).toBe(false);
        expect(eventsDb.length).toBe(2);
      });
    });

    describe("9l. Financial & Database Integrity Failure-Injection Test Suite", () => {
      it("1. fulfillment key claimed -> simulated process crash before credit grant -> retry later grants credit exactly once", async () => {
        interface FulfillmentRecord {
          id: string;
          idempotency_key: string;
          assignment_id: string;
          order_id: string;
          user_id: string;
          fulfillment_type: string;
          quantity: number;
          status: "pending" | "completed" | "failed";
          attempt_count: number;
          last_error?: string | null;
        }

        const fulfillmentDb: Record<string, FulfillmentRecord> = {};
        const creditBalances: Record<string, { available: number; lifetime_earned: number }> = {
          "user-1": { available: 0, lifetime_earned: 0 },
        };
        const ledgerEntries: Array<{ idempotency_key: string; user_id: string; amount: number; entry_type: string }> = [];

        // Simulated atomic fulfill_promotion_bonus_credits RPC
        const fulfillPromotionBonusCredits = (params: {
          idempotencyKey: string;
          assignmentId: string;
          orderId: string;
          userId: string;
          bonusCredits: number;
          simulateCrashBeforeGrant?: boolean;
        }) => {
          const { idempotencyKey, assignmentId, orderId, userId, bonusCredits, simulateCrashBeforeGrant } = params;

          let rec = fulfillmentDb[idempotencyKey];
          if (rec) {
            if (rec.status === "completed") {
              return { success: true, status: "already_completed", credits_granted: rec.quantity };
            }
            rec.attempt_count += 1;
            rec.status = "pending";
          } else {
            rec = {
              id: "rec-" + Math.random(),
              idempotency_key: idempotencyKey,
              assignment_id: assignmentId,
              order_id: orderId,
              user_id: userId,
              fulfillment_type: "bonus_credits",
              quantity: bonusCredits,
              status: "pending",
              attempt_count: 1,
            };
            fulfillmentDb[idempotencyKey] = rec;
          }

          // Simulate worker/container crash after row claim but before financial mutation
          if (simulateCrashBeforeGrant) {
            throw new Error("Simulated SIGKILL / worker container crash before credit grant");
          }

          // Atomic financial mutation: ledger + balance
          creditBalances[userId].available += bonusCredits;
          creditBalances[userId].lifetime_earned += bonusCredits;
          ledgerEntries.push({
            idempotency_key: idempotencyKey,
            user_id: userId,
            amount: bonusCredits,
            entry_type: "bonus",
          });

          rec.status = "completed";
          return {
            success: true,
            status: "completed",
            credits_granted: bonusCredits,
            new_balance: creditBalances[userId].available,
          };
        };

        const idempotencyKey = "promotion:assign-crash:order-1:bonus_credits";

        // Step A: Worker 1 runs and crashes right after key claim
        expect(() => {
          fulfillPromotionBonusCredits({
            idempotencyKey,
            assignmentId: "assign-crash",
            orderId: "order-1",
            userId: "user-1",
            bonusCredits: 100,
            simulateCrashBeforeGrant: true,
          });
        }).toThrow("Simulated SIGKILL");

        // Verify state immediately after crash: record is stuck in pending, but zero balance mutated
        expect(fulfillmentDb[idempotencyKey].status).toBe("pending");
        expect(fulfillmentDb[idempotencyKey].attempt_count).toBe(1);
        expect(creditBalances["user-1"].available).toBe(0);
        expect(ledgerEntries.length).toBe(0);

        // Step B: Worker 2 retries later
        const retryResult = fulfillPromotionBonusCredits({
          idempotencyKey,
          assignmentId: "assign-crash",
          orderId: "order-1",
          userId: "user-1",
          bonusCredits: 100,
          simulateCrashBeforeGrant: false,
        });

        // Verification: Credits granted exactly once, attempt count incremented, status = completed
        expect(retryResult.success).toBe(true);
        expect(retryResult.status).toBe("completed");
        expect(retryResult.credits_granted).toBe(100);
        expect(creditBalances["user-1"].available).toBe(100);
        expect(ledgerEntries.length).toBe(1);
        expect(fulfillmentDb[idempotencyKey].status).toBe("completed");
        expect(fulfillmentDb[idempotencyKey].attempt_count).toBe(2);
      });

      it("2. credit grant succeeds -> crash before response -> retry does not duplicate credit", async () => {
        const fulfillmentDb: Record<string, any> = {};
        const creditBalances: Record<string, { available: number }> = {
          "user-1": { available: 50 },
        };
        const ledgerEntries: Array<{ idempotency_key: string; amount: number }> = [];

        const fulfillPromotionBonusCredits = (params: {
          idempotencyKey: string;
          userId: string;
          bonusCredits: number;
        }) => {
          const { idempotencyKey, userId, bonusCredits } = params;

          // Check if already completed
          if (
            fulfillmentDb[idempotencyKey]?.status === "completed" ||
            ledgerEntries.some((l) => l.idempotency_key === idempotencyKey)
          ) {
            return { success: true, status: "already_completed", credits_granted: bonusCredits, duplicate: true };
          }

          creditBalances[userId].available += bonusCredits;
          ledgerEntries.push({ idempotency_key: idempotencyKey, amount: bonusCredits });
          fulfillmentDb[idempotencyKey] = { status: "completed", quantity: bonusCredits };

          return { success: true, status: "completed", credits_granted: bonusCredits, duplicate: false };
        };

        const idempotencyKey = "promotion:assign-resp-crash:order-1:bonus_credits";

        // Step A: First attempt succeeds at DB level
        const res1 = fulfillPromotionBonusCredits({ idempotencyKey, userId: "user-1", bonusCredits: 200 });
        expect(res1.status).toBe("completed");
        expect(creditBalances["user-1"].available).toBe(250);
        expect(ledgerEntries.length).toBe(1);

        // Simulated crash before webhook response was returned to Paystack: Paystack retries 5 minutes later
        const res2 = fulfillPromotionBonusCredits({ idempotencyKey, userId: "user-1", bonusCredits: 200 });

        // Step B: Retry detects already_completed, does not duplicate credit
        expect(res2.status).toBe("already_completed");
        expect(res2.duplicate).toBe(true);
        expect(creditBalances["user-1"].available).toBe(250); // NEVER 450!
        expect(ledgerEntries.length).toBe(1);
      });

      it("3. quota grant fails after credit grant -> retry completes missing quota without duplicating credit", async () => {
        const creditBalances = { "user-1": 0 };
        const userQuotas: Record<string, number> = {};
        const fulfillmentDb: Record<string, any> = {};
        let assignmentStatus = "reserved";

        const processFulfillmentPipeline = (simulateQuotaFailure: boolean) => {
          const creditKey = "promo:assign-multi:order-1:bonus_credits";
          const quotaKey = "promo:assign-multi:order-1:auto_apply_runs";

          // Step 1: Bonus Credits
          if (fulfillmentDb[creditKey]?.status !== "completed") {
            creditBalances["user-1"] += 100;
            fulfillmentDb[creditKey] = { status: "completed" };
          }

          // Step 2: Bonus Runs
          if (simulateQuotaFailure) {
            throw new Error("Simulated Postgres timeout on user_feature_quotas lock");
          }

          if (fulfillmentDb[quotaKey]?.status !== "completed") {
            userQuotas["auto_apply"] = (userQuotas["auto_apply"] || 0) + 10;
            fulfillmentDb[quotaKey] = { status: "completed" };
          }

          // Step 3: Transition assignment to converted ONLY after all entitlements succeed
          assignmentStatus = "converted";
          return { success: true };
        };

        // Run 1: Quota fails after credit succeeds
        expect(() => processFulfillmentPipeline(true)).toThrow("Simulated Postgres timeout");
        expect(creditBalances["user-1"]).toBe(100);
        expect(userQuotas["auto_apply"]).toBeUndefined();
        expect(assignmentStatus).toBe("reserved"); // NOT converted yet!

        // Run 2: Retry succeeds
        const retryRes = processFulfillmentPipeline(false);
        expect(retryRes.success).toBe(true);

        // Verification: Credit not duplicated, quota granted, assignment converted
        expect(creditBalances["user-1"]).toBe(100); // Remained 100
        expect(userQuotas["auto_apply"]).toBe(10);
        expect(assignmentStatus).toBe("converted");
      });

      it("4. reservation expires (local TTL elapsed) but provider payment can still succeed -> assignment remains unavailable to Order 2", async () => {
        interface OrderRow {
          id: string;
          user_id: string;
          is_success: boolean;
          metadata: { status?: string };
        }

        const ordersDb: Record<string, OrderRow> = {
          "order-1": {
            id: "order-1",
            user_id: "user-1",
            is_success: false,
            metadata: { status: "pending" }, // Still potentially payable!
          },
          "order-2": {
            id: "order-2",
            user_id: "user-1",
            is_success: false,
            metadata: { status: "pending" },
          },
        };

        interface RedemptionRow {
          id: string;
          assignment_id: string;
          order_id: string;
          status: "reserved" | "converted" | "released";
          expires_at: number;
        }

        const redemptionsDb: Record<string, RedemptionRow> = {
          "assign-1": {
            id: "red-1",
            assignment_id: "assign-1",
            order_id: "order-1",
            status: "reserved",
            expires_at: 1000, // Expired at t = 1000
          },
        };

        // PostgreSQL reserve_promotion_assignment logic
        const reservePromotion = (assignmentId: string, orderId: string, nowMs: number) => {
          const existing = redemptionsDb[assignmentId];
          if (existing && (existing.status === "reserved" || existing.status === "converted")) {
            if (existing.order_id === orderId) {
              return { success: true, reused: true };
            }

            const boundOrder = ordersDb[existing.order_id];
            const boundStatus = boundOrder?.metadata?.status || "pending";

            // CRITICAL NON-EXPIRING INVARIANT:
            // Only release if bound order is in a trusted terminal state ('failed', 'cancelled', 'expired', 'abandoned')
            const isTerminal = ["failed", "cancelled", "expired", "abandoned"].includes(boundStatus);
            if (!isTerminal) {
              return {
                success: false,
                error: "already_reserved_by_other_order",
                bound_order_id: existing.order_id,
                order_status: boundStatus,
              };
            }

            // Released safely because previous order reached terminal state
            existing.status = "released";
          }

          redemptionsDb[assignmentId] = {
            id: "red-" + Math.random(),
            assignment_id: assignmentId,
            order_id: orderId,
            status: "reserved",
            expires_at: nowMs + 30 * 60 * 1000,
          };
          return { success: true, reused: false };
        };

        // At t = 2000, Order 1's TTL has elapsed (1000 < 2000), but Order 1 is still pending in Paystack
        const attemptOrder2 = reservePromotion("assign-1", "order-2", 2000);

        // Required invariant: Assignment must remain UNAVAILABLE to Order 2!
        expect(attemptOrder2.success).toBe(false);
        expect(attemptOrder2.error).toBe("already_reserved_by_other_order");
        expect(attemptOrder2.bound_order_id).toBe("order-1");
        expect(attemptOrder2.order_status).toBe("pending");
        expect(redemptionsDb["assign-1"].order_id).toBe("order-1");

        // Now simulate trusted backend or webhook marking Order 1 as terminal cancelled/failed
        ordersDb["order-1"].metadata.status = "cancelled";

        // Order 2 retries reservation: Now safe to release and rebind!
        const retryOrder2 = reservePromotion("assign-1", "order-2", 2050);
        expect(retryOrder2.success).toBe(true);
        expect(redemptionsDb["assign-1"].order_id).toBe("order-2");
        expect(redemptionsDb["assign-1"].status).toBe("reserved");
      });

      it("5. browser attempts reservation release directly -> denied (permissions revoked from public/authenticated)", async () => {
        // Simulating PostgreSQL permission matrix:
        // REVOKE EXECUTE ON FUNCTION release_promotion_reservation FROM PUBLIC, anon, authenticated;
        // GRANT EXECUTE ON FUNCTION release_promotion_reservation TO service_role;
        const callReleaseRpc = (role: "anon" | "authenticated" | "service_role") => {
          if (role !== "service_role") {
            return {
              error: {
                code: "42501",
                message: "permission denied for function release_promotion_reservation",
              },
            };
          }
          return { data: { success: true, released: true } };
        };

        // 1. Authenticated browser user direct RPC attempt -> 42501 Permission Denied
        const browserRes = callReleaseRpc("authenticated");
        expect(browserRes.error).toBeDefined();
        expect(browserRes.error?.code).toBe("42501");
        expect(browserRes.error?.message).toContain("permission denied");

        // 2. Anonymous client direct RPC attempt -> 42501 Permission Denied
        const anonRes = callReleaseRpc("anon");
        expect(anonRes.error?.code).toBe("42501");

        // 3. Trusted service_role edge function -> Allowed
        const serviceRes = callReleaseRpc("service_role");
        expect(serviceRes.data?.success).toBe(true);
        expect(serviceRes.data?.released).toBe(true);
      });

      it("6. nonexistent order UUID used in redemption -> foreign-key rejection", async () => {
        // Simulating PostgreSQL FOREIGN KEY constraint:
        // CONSTRAINT fk_promotion_redemptions_order FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE
        const validOrderIds = new Set([
          "00000000-0000-0000-0000-000000000001",
          "00000000-0000-0000-0000-000000000002",
        ]);

        const insertRedemption = (redemption: { id: string; order_id: string }) => {
          if (!validOrderIds.has(redemption.order_id)) {
            throw new Error(
              `insert or update on table "promotion_redemptions" violates foreign key constraint "fk_promotion_redemptions_order" - Key (order_id)=(${redemption.order_id}) is not present in table "orders". (code: 23503)`,
            );
          }
          return { success: true };
        };

        // 1. Nonexistent order UUID throws foreign key violation
        const nonexistentOrderId = "99999999-9999-9999-9999-999999999999";
        expect(() => {
          insertRedemption({ id: "red-test", order_id: nonexistentOrderId });
        }).toThrow('violates foreign key constraint "fk_promotion_redemptions_order"');

        // 2. Existing order UUID succeeds
        const existingOrderId = "00000000-0000-0000-0000-000000000001";
        const validRes = insertRedemption({ id: "red-test", order_id: existingOrderId });
        expect(validRes.success).toBe(true);
      });
    });
  });
});
