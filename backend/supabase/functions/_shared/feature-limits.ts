import {
  SubscriptionAccessError,
  type SubscriptionTier,
  normalizeSubscriptionTier,
  resolveSubscriptionTier,
} from "./subscription.ts";
import { findSharedPlanByName } from "../../shared/billing-catalog.ts";

type TieredLimit = {
  perMinute: number;
  perDay: number;
};

type FeatureLimitDefinition = {
  label: string;
  limits: Record<SubscriptionTier, TieredLimit>;
};

const FEATURE_LIMITS: Record<string, FeatureLimitDefinition> = {
  analyze_resume: {
    label: "Resume analysis",
    limits: {
      Free: { perMinute: 2, perDay: 5 },
      Basics: { perMinute: 5, perDay: 20 },
      Pro: { perMinute: 10, perDay: 60 },
      Ultimate: { perMinute: 20, perDay: 120 },
    },
  },
  parse_resume: {
    label: "Resume parsing",
    limits: {
      Free: { perMinute: 2, perDay: 5 },
      Basics: { perMinute: 5, perDay: 20 },
      Pro: { perMinute: 10, perDay: 75 },
      Ultimate: { perMinute: 20, perDay: 150 },
    },
  },
  generate_chat_starters: {
    label: "AI chat starters",
    limits: {
      Free: { perMinute: 4, perDay: 20 },
      Basics: { perMinute: 10, perDay: 80 },
      Pro: { perMinute: 20, perDay: 200 },
      Ultimate: { perMinute: 30, perDay: 400 },
    },
  },
  customer_support_chat: {
    label: "Customer support AI",
    limits: {
      Free: { perMinute: 6, perDay: 40 },
      Basics: { perMinute: 12, perDay: 120 },
      Pro: { perMinute: 24, perDay: 300 },
      Ultimate: { perMinute: 40, perDay: 600 },
    },
  },
  generate_cover_letter: {
    label: "Cover letter generation",
    limits: {
      Free: { perMinute: 0, perDay: 0 },
      Basics: { perMinute: 3, perDay: 15 },
      Pro: { perMinute: 8, perDay: 40 },
      Ultimate: { perMinute: 15, perDay: 100 },
    },
  },
  generate_outreach: {
    label: "Outreach generation",
    limits: {
      Free: { perMinute: 0, perDay: 0 },
      Basics: { perMinute: 3, perDay: 15 },
      Pro: { perMinute: 8, perDay: 40 },
      Ultimate: { perMinute: 15, perDay: 100 },
    },
  },
  scout_company: {
    label: "Company scouting",
    limits: {
      Free: { perMinute: 0, perDay: 0 },
      Basics: { perMinute: 3, perDay: 15 },
      Pro: { perMinute: 8, perDay: 40 },
      Ultimate: { perMinute: 15, perDay: 100 },
    },
  },
  tailor_resume: {
    label: "Resume tailoring",
    limits: {
      Free: { perMinute: 0, perDay: 0 },
      Basics: { perMinute: 3, perDay: 15 },
      Pro: { perMinute: 8, perDay: 40 },
      Ultimate: { perMinute: 15, perDay: 100 },
    },
  },
  polish_content: {
    label: "AI writing tools",
    limits: {
      Free: { perMinute: 0, perDay: 0 },
      Basics: { perMinute: 4, perDay: 20 },
      Pro: { perMinute: 10, perDay: 60 },
      Ultimate: { perMinute: 20, perDay: 150 },
    },
  },
  evaluate_job_fit: {
    label: "Job fit evaluation",
    limits: {
      Free: { perMinute: 0, perDay: 0 },
      Basics: { perMinute: 4, perDay: 20 },
      Pro: { perMinute: 10, perDay: 80 },
      Ultimate: { perMinute: 20, perDay: 200 },
    },
  },
  calculate_match_score: {
    label: "Match score analysis",
    limits: {
      Free: { perMinute: 0, perDay: 0 },
      Basics: { perMinute: 6, perDay: 30 },
      Pro: { perMinute: 12, perDay: 120 },
      Ultimate: { perMinute: 24, perDay: 300 },
    },
  },
  generate_title: {
    label: "Chat title generation",
    limits: {
      Free: { perMinute: 6, perDay: 60 },
      Basics: { perMinute: 12, perDay: 200 },
      Pro: { perMinute: 20, perDay: 500 },
      Ultimate: { perMinute: 30, perDay: 1000 },
    },
  },
  generate_embeddings: {
    label: "Embeddings",
    limits: {
      Free: { perMinute: 10, perDay: 100 },
      Basics: { perMinute: 30, perDay: 500 },
      Pro: { perMinute: 60, perDay: 1500 },
      Ultimate: { perMinute: 100, perDay: 4000 },
    },
  },
  interview_session: {
    label: "Interview studio",
    limits: {
      Free: { perMinute: 0, perDay: 0 },
      Basics: { perMinute: 0, perDay: 0 },
      Pro: { perMinute: 3, perDay: 20 },
      Ultimate: { perMinute: 8, perDay: 60 },
    },
  },
  intake_job_url: {
    label: "Job URL intake",
    limits: {
      Free: { perMinute: 0, perDay: 0 },
      Basics: { perMinute: 4, perDay: 25 },
      Pro: { perMinute: 10, perDay: 100 },
      Ultimate: { perMinute: 20, perDay: 250 },
    },
  },
  sync_gmail_application_events: {
    label: "Gmail application sync",
    limits: {
      Free: { perMinute: 0, perDay: 0 },
      Basics: { perMinute: 0, perDay: 0 },
      Pro: { perMinute: 2, perDay: 20 },
      Ultimate: { perMinute: 6, perDay: 80 },
    },
  },
  referrals_agent: {
    label: "Referral network AI",
    limits: {
      Free: { perMinute: 0, perDay: 0 },
      Basics: { perMinute: 3, perDay: 20 },
      Pro: { perMinute: 8, perDay: 60 },
      Ultimate: { perMinute: 16, perDay: 150 },
    },
  },
};

type FeatureLimitContext = {
  userId: string;
  featureKey: keyof typeof FEATURE_LIMITS | string;
  serviceClient: any;
  subscriptionTier?: SubscriptionTier | string | null;
  metadata?: Record<string, unknown> | null;
  quantity?: number;
};

function requireFeatureDefinition(featureKey: string): FeatureLimitDefinition {
  const definition = FEATURE_LIMITS[featureKey];
  if (!definition) {
    throw new Error(`Unknown feature rate limit key: ${featureKey}`);
  }
  return definition;
}

async function countUsageSince(
  serviceClient: any,
  userId: string,
  featureKey: string,
  sinceIso: string,
): Promise<number> {
  const { count, error } = await serviceClient
    .from("feature_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature_key", featureKey)
    .gte("created_at", sinceIso);

  if (error) {
    console.error("feature_usage_events count failed", {
      userId,
      featureKey,
      sinceIso,
      error,
    });
    throw new Error("Could not verify feature rate limits.");
  }

  return typeof count === "number" ? count : 0;
}

export async function enforceFeatureRateLimit({
  userId,
  featureKey,
  serviceClient,
  subscriptionTier,
}: FeatureLimitContext): Promise<SubscriptionTier> {
  const definition = requireFeatureDefinition(featureKey);
  const tier = subscriptionTier
    ? normalizeSubscriptionTier(subscriptionTier)
    : await resolveSubscriptionTier(userId, serviceClient);
  const limit = definition.limits[tier];

  if (!limit || limit.perMinute <= 0 || limit.perDay <= 0) {
    throw new SubscriptionAccessError(
      403,
      `${definition.label} is not available on the ${tier} plan.`,
    );
  }

  const now = Date.now();
  const minuteAgoIso = new Date(now - 60_000).toISOString();
  const dayAgoIso = new Date(now - 86_400_000).toISOString();

  const [minuteCount, dailyCount] = await Promise.all([
    countUsageSince(serviceClient, userId, featureKey, minuteAgoIso),
    countUsageSince(serviceClient, userId, featureKey, dayAgoIso),
  ]);

  if (minuteCount >= limit.perMinute) {
    throw new SubscriptionAccessError(
      429,
      `Too many ${definition.label.toLowerCase()} requests. Please wait about a minute and try again.`,
    );
  }

  if (dailyCount >= limit.perDay) {
    throw new SubscriptionAccessError(
      429,
      `You have reached today's ${definition.label.toLowerCase()} limit for the ${tier} plan.`,
    );
  }

  return tier;
}

export async function recordFeatureUsage({
  userId,
  featureKey,
  serviceClient,
  subscriptionTier,
  metadata,
  quantity = 1,
}: FeatureLimitContext) {
  const tier = subscriptionTier
    ? normalizeSubscriptionTier(subscriptionTier)
    : await resolveSubscriptionTier(userId, serviceClient);

  const payload = {
    user_id: userId,
    feature_key: featureKey,
    quantity: Math.max(1, Math.floor(quantity)),
    reference_type: "rate_limit",
    metadata: {
      subscription_tier: tier,
      ...(metadata || {}),
    },
  };

  const { error } = await serviceClient.from("feature_usage_events").insert(payload);
  if (error) {
    console.error("feature_usage_events insert failed", {
      userId,
      featureKey,
      error,
    });
    throw new Error("Could not record feature usage.");
  }
}

type AutoApplyQuotaResult =
  | {
      success: true;
      subscriptionTier: SubscriptionTier;
      included: number;
      remaining: number;
      used: number;
      periodStart: string;
      periodEnd: string;
    }
  | {
      success: false;
      subscriptionTier: SubscriptionTier;
      included: number;
      remaining: number;
      used: number;
      periodStart: string | null;
      periodEnd: string | null;
      message: string;
    };

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function startOfNextMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

export async function consumeAutoApplyRunQuota({
  userId,
  serviceClient,
  subscriptionTier,
  quantity = 1,
}: FeatureLimitContext): Promise<AutoApplyQuotaResult> {
  const tier = subscriptionTier
    ? normalizeSubscriptionTier(subscriptionTier)
    : await resolveSubscriptionTier(userId, serviceClient);
  const requestedQuantity = Math.max(1, Math.floor(quantity));
  const plan = findSharedPlanByName(tier);
  const includedQuantity = Math.max(0, Math.floor(plan?.autoApplyRunsPerMonth || 0));

  if (includedQuantity <= 0) {
    return {
      success: false,
      subscriptionTier: tier,
      included: 0,
      remaining: 0,
      used: 0,
      periodStart: null,
      periodEnd: null,
      message: `Auto apply is not available on the ${tier} plan.`,
    };
  }

  let periodStart = startOfCurrentMonth().toISOString();
  let periodEnd = startOfNextMonth().toISOString();

  if (tier !== "Free") {
    const { data: subscription } = await serviceClient
      .from("user_subscriptions")
      .select("current_period_start, current_period_end")
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("current_period_end", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const subscriptionStart = subscription?.current_period_start;
    const subscriptionEnd = subscription?.current_period_end;
    if (subscriptionStart && subscriptionEnd) {
      periodStart = subscriptionStart;
      periodEnd = subscriptionEnd;
    }
  }

  const upsertPayload = {
    user_id: userId,
    feature_key: "auto_apply",
    source: "subscription",
    period_start: periodStart,
    period_end: periodEnd,
    included_quantity: includedQuantity,
    metadata: {
      plan_name: tier,
      subscription_tier: tier,
    },
  };

  const { error: upsertError } = await serviceClient
    .from("user_feature_quotas")
    .upsert(upsertPayload, {
      onConflict: "user_id,feature_key,source,period_start,period_end",
    });

  if (upsertError) {
    console.error("auto apply quota upsert failed", { userId, tier, upsertError });
    throw new Error("Could not verify auto apply quota.");
  }

  const { data: quotaRow, error: quotaError } = await serviceClient
    .from("user_feature_quotas")
    .select("id, included_quantity, used_quantity, period_end")
    .eq("user_id", userId)
    .eq("feature_key", "auto_apply")
    .eq("source", "subscription")
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .maybeSingle();

  if (quotaError || !quotaRow) {
    console.error("auto apply quota fetch failed", { userId, tier, quotaError });
    throw new Error("Could not verify auto apply quota.");
  }

  const usedQuantity = Math.max(0, Math.floor(quotaRow.used_quantity || 0));
  const remaining = Math.max(0, includedQuantity - usedQuantity);

  if (remaining < requestedQuantity) {
    return {
      success: false,
      subscriptionTier: tier,
      included: includedQuantity,
      remaining,
      used: usedQuantity,
      periodStart,
      periodEnd,
      message: `Not enough auto apply runs remaining for this billing period on the ${tier} plan.`,
    };
  }

  const nextUsedQuantity = usedQuantity + requestedQuantity;
  const { error: updateError } = await serviceClient
    .from("user_feature_quotas")
    .update({
      used_quantity: nextUsedQuantity,
      updated_at: new Date().toISOString(),
      metadata: {
        plan_name: tier,
        subscription_tier: tier,
        last_consumed_at: new Date().toISOString(),
      },
    })
    .eq("id", quotaRow.id);

  if (updateError) {
    console.error("auto apply quota update failed", { userId, tier, updateError });
    throw new Error("Could not record auto apply quota usage.");
  }

  await recordFeatureUsage({
    userId,
    featureKey: "auto_apply",
    serviceClient,
    subscriptionTier: tier,
    quantity: requestedQuantity,
    metadata: {
      source: "subscription_quota",
      period_end: periodEnd,
    },
  });

  return {
    success: true,
    subscriptionTier: tier,
    included: includedQuantity,
    remaining: Math.max(0, includedQuantity - nextUsedQuantity),
    used: nextUsedQuantity,
    periodStart,
    periodEnd,
  };
}

export async function restoreAutoApplyRunQuota(
  serviceClient: any,
  userId: string,
  periodStart: string,
  periodEnd: string,
  quantity = 1,
) {
  const { data: quotaRow, error: quotaError } = await serviceClient
    .from("user_feature_quotas")
    .select("id, used_quantity")
    .eq("user_id", userId)
    .eq("feature_key", "auto_apply")
    .eq("source", "subscription")
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .maybeSingle();

  if (quotaError || !quotaRow) {
    console.error("auto apply quota restore lookup failed", {
      userId,
      periodStart,
      periodEnd,
      quotaError,
    });
    return;
  }

  const nextUsedQuantity = Math.max(
    0,
    Math.floor(Number(quotaRow.used_quantity || 0)) - Math.max(1, Math.floor(quantity)),
  );

  const { error: updateError } = await serviceClient
    .from("user_feature_quotas")
    .update({
      used_quantity: nextUsedQuantity,
      updated_at: new Date().toISOString(),
    })
    .eq("id", quotaRow.id);

  if (updateError) {
    console.error("auto apply quota restore update failed", {
      userId,
      periodStart,
      periodEnd,
      updateError,
    });
  }
}

type AutoApplyConcurrencyResult = {
  subscriptionTier: SubscriptionTier;
  baseLimit: number;
  addonLimit: number;
  totalLimit: number;
  activeRuns: number;
  availableRuns: number;
  periodStart: string;
  periodEnd: string;
};

async function resolveAutoApplyConcurrencyPeriod(
  userId: string,
  serviceClient: any,
  tier: SubscriptionTier,
) {
  let periodStart = startOfCurrentMonth().toISOString();
  let periodEnd = startOfNextMonth().toISOString();

  if (tier !== "Free") {
    const { data: subscription } = await serviceClient
      .from("user_subscriptions")
      .select("current_period_start, current_period_end")
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("current_period_end", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const subscriptionStart = subscription?.current_period_start;
    const subscriptionEnd = subscription?.current_period_end;
    if (subscriptionStart && subscriptionEnd) {
      periodStart = subscriptionStart;
      periodEnd = subscriptionEnd;
    }
  }

  return { periodStart, periodEnd };
}

export async function getAutoApplyConcurrencyLimit({
  userId,
  serviceClient,
  subscriptionTier,
}: FeatureLimitContext): Promise<AutoApplyConcurrencyResult> {
  const tier = subscriptionTier
    ? normalizeSubscriptionTier(subscriptionTier)
    : await resolveSubscriptionTier(userId, serviceClient);
  const plan = findSharedPlanByName(tier);
  const baseLimit = Math.max(1, Math.floor(plan?.autoApplyConcurrency || 1));
  const { periodStart, periodEnd } = await resolveAutoApplyConcurrencyPeriod(
    userId,
    serviceClient,
    tier,
  );
  const nowIso = new Date().toISOString();

  const threeHoursAgoIso = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const [{ data: addonRows, error: addonError }, { count: activeRuns, error: activeError }] =
    await Promise.all([
      serviceClient
        .from("user_feature_quotas")
        .select("included_quantity")
        .eq("user_id", userId)
        .eq("feature_key", "auto_apply_concurrency")
        .eq("source", "addon")
        .lte("period_start", nowIso)
        .gt("period_end", nowIso),
      serviceClient
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("canonical_stage", "queued")
        .neq("provider_status", "waiting")
        .gt("updated_at", threeHoursAgoIso),
    ]);

  if (addonError) {
    console.error("auto apply concurrency addon lookup failed", {
      userId,
      tier,
      addonError,
    });
    throw new Error("Could not verify auto apply concurrency.");
  }

  if (activeError) {
    console.error("auto apply concurrency active run lookup failed", {
      userId,
      tier,
      activeError,
    });
    throw new Error("Could not verify active auto apply runs.");
  }

  const addonLimit = Array.isArray(addonRows)
    ? addonRows.reduce(
        (sum, row) => sum + Math.max(0, Math.floor(Number(row.included_quantity || 0))),
        0,
      )
    : 0;
  const totalLimit = baseLimit + addonLimit;
  const active = typeof activeRuns === "number" ? activeRuns : 0;

  return {
    subscriptionTier: tier,
    baseLimit,
    addonLimit,
    totalLimit,
    activeRuns: active,
    availableRuns: Math.max(0, totalLimit - active),
    periodStart,
    periodEnd,
  };
}

export async function enforceAutoApplyConcurrency({
  userId,
  serviceClient,
  subscriptionTier,
  quantity = 1,
}: FeatureLimitContext) {
  const requestedRuns = Math.max(1, Math.floor(quantity));
  const result = await getAutoApplyConcurrencyLimit({
    userId,
    serviceClient,
    subscriptionTier,
  });

  if (result.availableRuns < requestedRuns) {
    throw new SubscriptionAccessError(
      429,
      `You already have ${result.activeRuns} auto-apply run${result.activeRuns === 1 ? "" : "s"} active. The ${result.subscriptionTier} plan allows ${result.totalLimit} parallel auto-apply run${result.totalLimit === 1 ? "" : "s"}. Upgrade your plan or buy a concurrency boost to launch more in parallel.`,
    );
  }

  return result;
}
