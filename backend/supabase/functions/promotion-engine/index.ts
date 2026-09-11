// backend/supabase/functions/promotion-engine/index.ts
// Authoritative edge function for Jobraker Personalized Promotion Engine V1.
// Handles feature assembly, server-side rule evaluation, persistent assignment creation, and event logging.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  requireAuthenticatedUser,
  subscriptionErrorResponse,
  resolveSubscriptionTier,
} from "../_shared/subscription.ts";
import {
  RuleBasedPromotionStrategy,
  derivePromotionLifecycle,
  calculateIntentScore,
  type PromotionDecision,
  type PromotionUserFeatures,
  type PromotionPlacement,
  type PromotionEventType,
  type PromotionAssignmentRow,
} from "../../shared/promotions.ts";

function jsonResponse(data: unknown, headers: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { user, serviceClient } = await requireAuthenticatedUser(req);
    const body = (await req.json()) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "evaluate-or-get-active";
    const placement = (body.placement as PromotionPlacement) || "top_banner";
    const now = new Date();

    // ACTION: track-event (impression, clicked, dismissed) - Strictly allowlisted low-trust telemetry
    if (action === "track-event") {
      const eventType = body.eventType as PromotionEventType;
      const ALLOWED_CLIENT_EVENTS: PromotionEventType[] = [
        "impression",
        "clicked",
        "dismissed",
      ];
      if (!eventType || !ALLOWED_CLIENT_EVENTS.includes(eventType)) {
        return jsonResponse(
          { error: `Event type '${eventType}' is not permitted from client telemetry` },
          corsHeaders,
          403,
        );
      }

      const assignmentId = typeof body.assignmentId === "string" ? body.assignmentId : null;
      const campaignId = typeof body.campaignId === "string" ? body.campaignId : null;
      const metadata = (body.metadata as Record<string, unknown>) || {};

      // Insert event into promotion_events
      const { error: insertError } = await serviceClient
        .from("promotion_events")
        .insert({
          assignment_id: assignmentId,
          user_id: user.id,
          campaign_id: campaignId,
          event_type: eventType,
          placement,
          metadata,
        });

      if (insertError) {
        console.error("[promotion-engine] Failed to track event:", insertError);
        return jsonResponse({ error: "Failed to record event" }, corsHeaders, 500);
      }

      return jsonResponse({ success: true, eventType }, corsHeaders);
    }

    // ACTION: dismiss promotion (Ownership check + service-role update)
    if (action === "dismiss") {
      const assignmentId = typeof body.assignmentId === "string" ? body.assignmentId : null;
      if (!assignmentId) {
        return jsonResponse({ error: "Missing assignmentId" }, corsHeaders, 400);
      }

      const { data: updated, error: updateError } = await serviceClient
        .from("promotion_assignments")
        .update({ status: "dismissed", updated_at: now.toISOString() })
        .eq("id", assignmentId)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();

      if (updateError) {
        console.error("[promotion-engine] Failed to dismiss promotion:", updateError);
        return jsonResponse({ error: "Failed to dismiss promotion" }, corsHeaders, 500);
      }

      if (!updated) {
        return jsonResponse(
          { error: "Promotion assignment not found or unauthorized" },
          corsHeaders,
          403,
        );
      }

      await serviceClient.from("promotion_events").insert({
        assignment_id: assignmentId,
        user_id: user.id,
        event_type: "dismissed",
        placement,
        metadata: {},
      });

      return jsonResponse({ success: true, dismissed: true }, corsHeaders);
    }

    // ACTION: evaluate-or-get-active (DEFAULT)
    // 1. Check for existing active unexpired assignment for user (PERSISTENCE GUARANTEE)
    const { data: existingAssignments, error: existingError } = await serviceClient
      .from("promotion_assignments")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .gt("expires_at", now.toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    if (existingError) {
      console.error("[promotion-engine] Error querying existing assignments:", existingError);
    }

    const active = existingAssignments?.[0] as PromotionAssignmentRow | undefined;
    if (active) {
      // Active unexpired assignment exists: return it unchanged!
      const decision: PromotionDecision = {
        eligible: active.incentive_type !== "none",
        assignmentId: active.id,
        campaignId: active.campaign_id || undefined,
        incentiveType: active.incentive_type,
        discountPercent: active.discount_percent,
        bonusCredits: active.bonus_credits,
        bonusAutoApplyRuns: active.bonus_auto_apply_runs,
        targetPlan: active.target_plan || undefined,
        messageVariant: active.message_variant,
        placement: placement || active.placement,
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
      return jsonResponse(decision, corsHeaders);
    }

    // 2. No active assignment: fetch active campaign config
    const { data: campaignData } = await serviceClient
      .from("promotion_campaigns")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const campaign = campaignData || {
      id: null,
      slug: "default_v1_campaign",
      config: { holdout_pct: 10, default_duration_hours: 24, max_impressions_7d: 2, cooldown_days: 7 },
    };

    // 3. Assemble User Features from authoritative product records
    const userCreatedAt = user.created_at ? new Date(user.created_at) : now;
    const accountAgeDays = Math.max(0, Math.floor((now.getTime() - userCreatedAt.getTime()) / (1000 * 3600 * 24)));

    // Subscription tier
    const currentPlan = await resolveSubscriptionTier(user.id, serviceClient);

    // Paid orders count
    const { count: paidOrdersCount } = await serviceClient
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_success", true);

    const previouslyPaid = Boolean(paidOrdersCount && paidOrdersCount > 0);

    // Applications activity
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();

    const { count: autoApplies30d } = await serviceClient
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", thirtyDaysAgo);

    const { count: autoApplies7d } = await serviceClient
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", sevenDaysAgo);

    const { count: successfulApps30d } = await serviceClient
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("status", ["submitted", "applied"])
      .gte("created_at", thirtyDaysAgo);

    // Quota usage
    const { data: quotaRow } = await serviceClient
      .from("user_feature_quotas")
      .select("included_quantity, used_quantity")
      .eq("user_id", user.id)
      .eq("feature_key", "auto_apply")
      .maybeSingle();

    const quotaIncluded = Math.max(1, Number(quotaRow?.included_quantity || 10));
    const quotaUsed = Math.max(0, Number(quotaRow?.used_quantity || 0));
    const autoApplyQuotaUsagePercent = Math.min(100, Math.round((quotaUsed / quotaIncluded) * 100));

    // Credit balance
    const { data: creditRow } = await serviceClient
      .from("user_credits")
      .select("balance, total_consumed, total_earned")
      .eq("user_id", user.id)
      .maybeSingle();

    const totalEarned = Math.max(1, Number(creditRow?.total_earned || 100));
    const totalConsumed = Math.max(0, Number(creditRow?.total_consumed || 0));
    const creditUsagePercent = Math.min(100, Math.round((totalConsumed / totalEarned) * 100));

    // Recent promotion events & history
    const { count: promoImpressions7d } = await serviceClient
      .from("promotion_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("event_type", "impression")
      .gte("created_at", sevenDaysAgo);

    const { count: promoImpressions30d } = await serviceClient
      .from("promotion_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("event_type", "impression")
      .gte("created_at", thirtyDaysAgo);

    const { count: promoClicks30d } = await serviceClient
      .from("promotion_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("event_type", "clicked")
      .gte("created_at", thirtyDaysAgo);

    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 3600 * 1000).toISOString();
    const { count: promosAccepted90d } = await serviceClient
      .from("promotion_assignments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "converted")
      .gte("converted_at", ninetyDaysAgo);

    const { data: latestAssignment } = await serviceClient
      .from("promotion_assignments")
      .select("created_at, discount_percent")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let daysSinceLastPromo: number | null = null;
    let lastPromoDiscount: number | null = null;
    if (latestAssignment?.created_at) {
      daysSinceLastPromo = Math.floor(
        (now.getTime() - new Date(latestAssignment.created_at).getTime()) / (1000 * 3600 * 24)
      );
      lastPromoDiscount = latestAssignment.discount_percent ?? null;
    }

    // Build features object (NO SENSITIVE DEMOGRAPHICS)
    const features: PromotionUserFeatures = {
      userId: user.id,
      accountAgeDays,
      currentPlan,
      previouslyPaid,
      sessions7d: autoApplies7d ? Math.max(1, autoApplies7d) : 1, // Telemetry proxy
      sessions30d: autoApplies30d ? Math.max(1, autoApplies30d) : 1,
      activeDays7d: autoApplies7d ? Math.min(7, Math.max(1, Math.ceil(autoApplies7d / 2))) : 1,
      activeDays30d: autoApplies30d ? Math.min(30, Math.max(1, Math.ceil(autoApplies30d / 2))) : 1,
      daysSinceLastSession: 0,
      jobsViewed30d: (autoApplies30d || 0) * 3, // Telemetry proxy
      autoApplies7d: autoApplies7d || 0,
      autoApplies30d: autoApplies30d || 0,
      successfulApplications30d: successfulApps30d || 0,
      resumeGenerations30d: Math.max(1, successfulApps30d || 0),
      creditUsagePercent,
      autoApplyQuotaUsagePercent,
      pricingPageViews7d: 0,
      upgradeModalViews7d: 0,
      checkoutStarts7d: 0,
      checkoutAbandons7d: 0,
      promoImpressions7d: promoImpressions7d || 0,
      promoImpressions30d: promoImpressions30d || 0,
      promoClicks30d: promoClicks30d || 0,
      promosAccepted90d: promosAccepted90d || 0,
      lastPromoDiscount,
      daysSinceLastPromo,
      hasActiveDiscount: false,
      lifecycle: "activated",
    };

    features.lifecycle = derivePromotionLifecycle(features);

    // 4. Run Rule-Based Strategy
    const strategy = new RuleBasedPromotionStrategy();
    const decision = await strategy.decide(features, {
      campaignId: campaign.id || undefined,
      campaignSlug: campaign.slug,
      campaignConfig: campaign.config,
      now,
    });

    decision.placement = placement;

    // 5. If eligible or holdout, persist to promotion_assignments
    if (decision.eligible || decision.experimentVariant === "control") {
      const { data: newAssignment, error: insertError } = await serviceClient
        .from("promotion_assignments")
        .insert({
          user_id: user.id,
          campaign_id: campaign.id || null,
          incentive_type: decision.incentiveType,
          discount_percent: decision.discountPercent || 0,
          bonus_credits: decision.bonusCredits || 0,
          bonus_auto_apply_runs: decision.bonusAutoApplyRuns || 0,
          target_plan: decision.targetPlan || null,
          message_variant: decision.messageVariant,
          placement: decision.placement,
          headline: decision.headline || null,
          body: decision.body || null,
          cta_label: decision.ctaLabel || null,
          experiment_key: campaign.slug || "default_v1_campaign",
          experiment_variant: decision.experimentVariant || "treatment",
          decision_reason: decision.decisionReason,
          decision_score: decision.score || null,
          model_version: decision.modelVersion,
          starts_at: decision.startsAt || now.toISOString(),
          expires_at: decision.expiresAt || null,
          status: "active",
          user_features: features,
        })
        .select()
        .single();

      if (insertError) {
        console.error("[promotion-engine] Error inserting assignment:", insertError);
        // Handle concurrent assignment creation race gracefully:
        const isConflict =
          insertError.code === "23505" ||
          insertError.message?.includes("unique") ||
          insertError.message?.includes("duplicate key");
        if (isConflict) {
          const { data: winningAssignment } = await serviceClient
            .from("promotion_assignments")
            .select("*")
            .eq("user_id", user.id)
            .eq("status", "active")
            .gt("expires_at", now.toISOString())
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (winningAssignment) {
            const winningDecision: PromotionDecision = {
              eligible: winningAssignment.incentive_type !== "none",
              assignmentId: winningAssignment.id,
              campaignId: winningAssignment.campaign_id || undefined,
              incentiveType: winningAssignment.incentive_type,
              discountPercent: winningAssignment.discount_percent,
              bonusCredits: winningAssignment.bonus_credits,
              bonusAutoApplyRuns: winningAssignment.bonus_auto_apply_runs,
              targetPlan: winningAssignment.target_plan || undefined,
              messageVariant: winningAssignment.message_variant,
              placement: placement || winningAssignment.placement,
              headline: winningAssignment.headline || undefined,
              body: winningAssignment.body || undefined,
              ctaLabel: winningAssignment.cta_label || undefined,
              startsAt: winningAssignment.starts_at,
              expiresAt: winningAssignment.expires_at || undefined,
              decisionReason: winningAssignment.decision_reason,
              score: winningAssignment.decision_score != null ? Number(winningAssignment.decision_score) : undefined,
              experimentVariant: winningAssignment.experiment_variant,
              modelVersion: winningAssignment.model_version,
            };
            return jsonResponse(winningDecision, corsHeaders);
          }
        }
      } else if (newAssignment) {
        decision.assignmentId = newAssignment.id;

        // Record 'assigned' event
        await serviceClient.from("promotion_events").insert({
          assignment_id: newAssignment.id,
          user_id: user.id,
          campaign_id: campaign.id || null,
          event_type: "assigned",
          placement: decision.placement,
          metadata: {
            incentive_type: decision.incentiveType,
            discount_percent: decision.discountPercent || 0,
            decision_reason: decision.decisionReason,
            experiment_variant: decision.experimentVariant,
          },
        });
      }
    }

    return jsonResponse(decision, corsHeaders);
  } catch (err) {
    console.error("[promotion-engine] Unexpected error:", err);
    return subscriptionErrorResponse(err, corsHeaders);
  }
});
