// src/hooks/usePersonalizedPromotion.ts
// React hook for personalized promotion state, real-time server countdown, and deduplicated impression tracking.

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@/lib/supabaseClient";
import {
  formatCountdownTimer,
  getPromotionCtaUrl,
  type PromotionDecision,
  type PromotionPlacement,
  type CountdownState,
} from "@/lib/promotions";

interface UsePersonalizedPromotionOptions {
  placement?: PromotionPlacement;
  enabled?: boolean;
}

const SESSION_IMPRESSION_PREFIX = "jobraker_promo_impression_";

export function usePersonalizedPromotion({
  placement = "top_banner",
  enabled = true,
}: UsePersonalizedPromotionOptions = {}) {
  const navigate = useNavigate();
  const [decision, setDecision] = useState<PromotionDecision | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [countdown, setCountdown] = useState<CountdownState>({
    hours: "00",
    minutes: "00",
    seconds: "00",
    totalSeconds: 0,
    isExpired: false,
  });

  const hasTrackedImpressionRef = useRef(false);

  // 1. Fetch active or evaluate promotion assignment from backend
  const fetchPromotion = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("promotion-engine", {
        body: {
          action: "evaluate-or-get-active",
          placement,
        },
      });

      if (error) {
        console.warn("[usePersonalizedPromotion] Failed to fetch promotion:", error);
        setDecision(null);
        return;
      }

      const promoDecision = data as PromotionDecision | null;
      if (promoDecision && promoDecision.eligible && promoDecision.incentiveType !== "none") {
        setDecision(promoDecision);
        if (promoDecision.expiresAt) {
          setCountdown(formatCountdownTimer(promoDecision.expiresAt));
        }
      } else {
        setDecision(null);
      }
    } catch (err) {
      console.warn("[usePersonalizedPromotion] Unexpected error:", err);
      setDecision(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, placement]);

  useEffect(() => {
    void fetchPromotion();
  }, [fetchPromotion]);

  // 2. Real-time timer update loop (Never resets on reload, adheres strictly to server expiresAt)
  useEffect(() => {
    if (!decision?.expiresAt) return;

    const tick = () => {
      const current = formatCountdownTimer(decision.expiresAt);
      setCountdown(current);
      if (current.isExpired) {
        // Offer has genuinely expired
        setDecision((prev) => (prev ? { ...prev, eligible: false } : null));
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [decision?.expiresAt]);

  // 3. Deduplicated Impression Tracking (Logged once per assignment & placement per browser session)
  useEffect(() => {
    if (!decision || !decision.assignmentId || dismissed || countdown.isExpired) return;

    const sessionKey = `${SESSION_IMPRESSION_PREFIX}${decision.assignmentId}_${placement}`;
    const alreadyLogged = sessionStorage.getItem(sessionKey);

    if (!alreadyLogged && !hasTrackedImpressionRef.current) {
      hasTrackedImpressionRef.current = true;
      try {
        sessionStorage.setItem(sessionKey, "1");
      } catch {
        /* ignore storage failure */
      }

      const supabase = createClient();
      void supabase.functions.invoke("promotion-engine", {
        body: {
          action: "track-event",
          assignmentId: decision.assignmentId,
          campaignId: decision.campaignId,
          eventType: "impression",
          placement,
          metadata: {
            incentive_type: decision.incentiveType,
            discount_percent: decision.discountPercent,
            message_variant: decision.messageVariant,
          },
        },
      });
    }
  }, [decision, dismissed, countdown.isExpired, placement]);

  // 4. Action: Claim promotion and navigate to billing
  const claimPromotion = useCallback(
    (targetPlan?: string) => {
      if (!decision) return;

      const supabase = createClient();
      if (decision.assignmentId) {
        void supabase.functions.invoke("promotion-engine", {
          body: {
            action: "track-event",
            assignmentId: decision.assignmentId,
            campaignId: decision.campaignId,
            eventType: "clicked",
            placement,
            metadata: {
              target_plan: targetPlan || decision.targetPlan,
            },
          },
        });
      }

      const url = getPromotionCtaUrl(decision.assignmentId, targetPlan || decision.targetPlan);
      navigate(url);
    },
    [decision, placement, navigate]
  );

  // 5. Action: Dismiss promotion
  const dismissPromotion = useCallback(async () => {
    setDismissed(true);
    if (!decision?.assignmentId) return;

    try {
      const supabase = createClient();
      await supabase.functions.invoke("promotion-engine", {
        body: {
          action: "dismiss",
          assignmentId: decision.assignmentId,
          placement,
        },
      });
    } catch (err) {
      console.warn("[usePersonalizedPromotion] Failed to dismiss promotion:", err);
    }
  }, [decision?.assignmentId, placement]);

  const isVisible = Boolean(
    !loading &&
    !dismissed &&
    decision &&
    decision.eligible &&
    decision.incentiveType !== "none" &&
    !countdown.isExpired
  );

  return {
    decision,
    loading,
    dismissed,
    isVisible,
    countdown,
    claimPromotion,
    dismissPromotion,
    refetch: fetchPromotion,
  };
}
