import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type SubscriptionTier = "Free" | "Basics" | "Pro" | "Ultimate";

const TIER_RANK: Record<SubscriptionTier, number> = {
  Free: 0,
  Basics: 1,
  Pro: 2,
  Ultimate: 3,
};

export const JOB_SEARCH_RESULT_CAPS: Record<SubscriptionTier, number> = {
  Free: 10,
  Basics: 20,
  Pro: 50,
  Ultimate: 100,
};

export class SubscriptionAccessError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "SubscriptionAccessError";
    this.status = status;
  }
}

export function normalizeSubscriptionTier(tier?: string | null): SubscriptionTier {
  const normalized = (tier || "").trim();
  switch (normalized) {
    case "Basics":
    case "Basic":
    case "Starter":
      return "Basics";
    case "Pro":
    case "Professional":
      return "Pro";
    case "Ultimate":
    case "Ultimate Plan":
    case "Executive":
    case "Enterprise":
      return "Ultimate";
    case "Free":
    default:
      return "Free";
  }
}

function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

function createAuthClient(authHeader: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    },
  );
}

export async function requireAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new SubscriptionAccessError(401, "Missing authorization header");
  }

  const authClient = createAuthClient(authHeader);
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser();

  if (error || !user) {
    throw new SubscriptionAccessError(401, "Unauthorized");
  }

  return {
    authHeader,
    authClient,
    serviceClient: createServiceClient(),
    user,
  };
}

export async function resolveSubscriptionTier(
  userId: string,
  serviceClient = createServiceClient(),
): Promise<SubscriptionTier> {
  const { data: rpcTier, error: rpcError } = await serviceClient.rpc(
    "get_user_tier",
    {
      p_user_id: userId,
    },
  );

  if (!rpcError && typeof rpcTier === "string") {
    return normalizeSubscriptionTier(rpcTier);
  }

  const { data: subscription } = await serviceClient
    .from("user_subscriptions")
    .select("subscription_plans(name)")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const subscriptionTier = (subscription as any)?.subscription_plans?.name;
  if (subscriptionTier) {
    return normalizeSubscriptionTier(subscriptionTier);
  }

  const { data: profileData } = await serviceClient
    .from("profiles")
    .select("subscription_tier")
    .eq("id", userId)
    .maybeSingle();

  return normalizeSubscriptionTier(profileData?.subscription_tier);
}

export function getJobSearchResultCap(
  tier: SubscriptionTier,
): number {
  return JOB_SEARCH_RESULT_CAPS[tier];
}

export async function getUserCreditsBalance(
  userId: string,
  serviceClient = createServiceClient(),
): Promise<number> {
  const { data } = await serviceClient
    .from("user_credits")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();

  const balance = Number(data?.balance ?? 0);
  return Number.isFinite(balance) && balance > 0 ? Math.floor(balance) : 0;
}

export async function resolveJobSearchExecutionLimits(
  userId: string,
  requestedLimit: number,
  serviceClient = createServiceClient(),
) {
  const subscriptionTier = await resolveSubscriptionTier(userId, serviceClient);
  const planCap = getJobSearchResultCap(subscriptionTier);
  const creditsBalance = await getUserCreditsBalance(userId, serviceClient);
  const normalizedRequestedLimit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.floor(requestedLimit))
    : planCap;
  const effectiveLimit = Math.max(
    0,
    Math.min(normalizedRequestedLimit, planCap, creditsBalance),
  );

  return {
    subscriptionTier,
    planCap,
    creditsBalance,
    effectiveLimit,
  };
}

export async function requireSubscriptionTier(
  req: Request,
  requiredTier: SubscriptionTier,
  featureLabel?: string,
) {
  const context = await requireAuthenticatedUser(req);

  const { data: accessData, error: accessError } = await context.serviceClient.rpc(
    "check_tier_access",
    {
      p_user_id: context.user.id,
      p_required_tier: requiredTier,
    },
  );

  if (accessError) {
    console.error("check_tier_access RPC error:", accessError);
  }

  const subscriptionTier = await resolveSubscriptionTier(
    context.user.id,
    context.serviceClient,
  );

  const hasAccessByResolvedTier =
    TIER_RANK[subscriptionTier] >= TIER_RANK[requiredTier];

  if (accessError == null && accessData !== hasAccessByResolvedTier) {
    console.warn("check_tier_access mismatch; using resolved subscription tier", {
      userId: context.user.id,
      requiredTier,
      rpcAccess: accessData,
      resolvedTier: subscriptionTier,
    });
  }

  const hasAccess =
    accessError == null
      ? accessData === true || hasAccessByResolvedTier
      : hasAccessByResolvedTier;

  if (!hasAccess) {
    throw new SubscriptionAccessError(
      403,
      `${featureLabel || "This feature"} requires the ${requiredTier} plan or higher.`,
    );
  }

  return {
    ...context,
    subscriptionTier,
  };
}

export function subscriptionErrorResponse(
  error: unknown,
  corsHeaders: Record<string, string>,
) {
  const status =
    error instanceof SubscriptionAccessError ? error.status : 500;
  const message =
    error instanceof Error ? error.message : "Internal server error";

  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
