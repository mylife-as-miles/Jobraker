import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/types.ts";
import { discoverJobsFirecrawl } from "../_shared/discovery-hybrid.ts";
import { persistDiscoveredJobs } from "../_shared/jobs.ts";
import { syncFirecrawlCreditUsage } from "../_shared/provider-credits.ts";
import {
  requireAuthenticatedUser,
  resolveJobSearchExecutionLimits,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";

interface ProfileSearchScope {
  searchQuery: string | null;
  location: string;
}

interface CronRunResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  searchQuery?: string;
  location?: string;
  count?: number;
  jobsInserted?: number;
  requestedLimit?: number;
  effectiveLimit?: number;
  planCap?: number;
  creditsBalance?: number;
  subscriptionTier?: string;
  creditDeduction?: unknown;
  providerCreditSync?: unknown;
}

async function loadProfileSearchScope(
  serviceClient: any,
  userId: string,
): Promise<ProfileSearchScope> {
  const { data } = await serviceClient
    .from("profiles")
    .select("job_title, location")
    .eq("id", userId)
    .maybeSingle();

  return {
    searchQuery:
      typeof data?.job_title === "string" && data.job_title.trim()
        ? data.job_title.trim()
        : null,
    location:
      typeof data?.location === "string" && data.location.trim()
        ? data.location.trim()
        : "Remote",
  };
}

async function runDiscoveryForUser(
  serviceClient: any,
  userId: string,
  trigger: "manual_cron" | "scheduled_cron",
  requestedLimit: number,
): Promise<CronRunResult> {
  const { searchQuery, location } = await loadProfileSearchScope(serviceClient, userId);

  if (!searchQuery) {
    return {
      ok: true,
      skipped: true,
      reason: "missing_profile_job_title",
      location,
    };
  }

  const {
    subscriptionTier,
    planCap,
    creditsBalance,
    effectiveLimit,
  } = await resolveJobSearchExecutionLimits(userId, requestedLimit, serviceClient);

  if (effectiveLimit <= 0) {
    return {
      ok: true,
      skipped: true,
      reason: "insufficient_credits",
      searchQuery,
      location,
      requestedLimit,
      planCap,
      creditsBalance,
      subscriptionTier,
    };
  }

  let totalInserted = 0;
  const { jobs: discoveredJobs } = await discoverJobsFirecrawl(
    {
      serviceClient,
      userId,
      searchQuery,
      location,
      limit: effectiveLimit,
    },
    async (batch) => {
      const { jobsInserted: batchInserted } = await persistDiscoveredJobs(
        serviceClient,
        batch,
        {
          userId,
          searchQuery,
          location,
          trigger,
          requestedLimit,
          effectiveLimit,
          subscriptionTier,
        },
      );
      totalInserted += batchInserted;
    },
  );

  let creditDeduction: unknown = null;
  if (discoveredJobs.length > 0) {
    const { data } = await serviceClient.rpc("deduct_job_search_credits", {
      p_user_id: userId,
      p_jobs_count: discoveredJobs.length,
    });
    creditDeduction = data ?? null;
  }

  let providerCreditSync: unknown = null;
  try {
    const syncResult = await syncFirecrawlCreditUsage(serviceClient, {
      source: "jobs-cron",
      userId,
      trigger,
      requestedLimit,
      effectiveLimit,
      jobsInserted: totalInserted,
      jobsFound: discoveredJobs.length,
    });
    providerCreditSync = {
      remainingCredits: syncResult.usage.remainingCredits,
      planCredits: syncResult.usage.planCredits,
      billingPeriodStart: syncResult.usage.billingPeriodStart,
      billingPeriodEnd: syncResult.usage.billingPeriodEnd,
      alert: syncResult.alert,
    };
  } catch (providerCreditError) {
    console.warn("jobs-cron Firecrawl credit sync failed", providerCreditError);
  }

  return {
    ok: true,
    searchQuery,
    location,
    count: discoveredJobs.length,
    jobsInserted: totalInserted,
    requestedLimit,
    effectiveLimit,
    planCap,
    creditsBalance,
    subscriptionTier,
    creditDeduction,
    providerCreditSync,
  };
}

async function handleManualRun(req: Request) {
  const body = await req.json().catch(() => ({}));
  const requestedUserId =
    typeof body?.user_id === "string" && body.user_id.trim()
      ? body.user_id.trim()
      : null;
  const requestedLimit = Number.isFinite(Number(body?.limit))
    ? Math.max(1, Math.floor(Number(body.limit)))
    : 100;

  const { serviceClient, user } = await requireAuthenticatedUser(req);
  if (requestedUserId && requestedUserId !== user.id) {
    return new Response(
      JSON.stringify({ error: "Cannot trigger cron for another user." }),
      { status: 403 },
    );
  }

  const result = await runDiscoveryForUser(
    serviceClient,
    user.id,
    "manual_cron",
    requestedLimit,
  );

  if (result.skipped && result.reason === "missing_profile_job_title") {
    return new Response(
      JSON.stringify({
        ...result,
        error: "Add a profile job title or use live search first.",
      }),
      { status: 400 },
    );
  }

  if (result.skipped && result.reason === "insufficient_credits") {
    return new Response(
      JSON.stringify({
        ...result,
        error: "Insufficient credits for scheduled job search.",
      }),
      { status: 402 },
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      ...result,
      jobs_found: result.count ?? 0,
      jobs_added: result.jobsInserted ?? 0,
      new_jobs: result.jobsInserted ?? 0,
    }),
    { status: 200 },
  );
}

async function runScheduledUsers(serviceClient: any) {
  const { data: rows, error } = await serviceClient
    .from("job_source_settings")
    .select("id")
    .eq("cron_enabled", true);

  if (error) {
    throw error;
  }

  const maxUsers = Number(Deno.env.get("JOBS_CRON_MAX_USERS") || 10);
  const userIds = Array.isArray(rows)
    ? rows
        .map((row: Record<string, unknown>) =>
          typeof row.id === "string" ? row.id : null
        )
        .filter((id): id is string => Boolean(id))
        .slice(0, maxUsers)
    : [];

  const results: Array<Record<string, unknown>> = [];
  for (const userId of userIds) {
    try {
      const result = await runDiscoveryForUser(
        serviceClient,
        userId,
        "scheduled_cron",
        100,
      );
      if (result.skipped) {
        console.log("jobs-cron.skip", { userId, reason: result.reason });
      } else {
        console.log("jobs-cron.completed", {
          userId,
          count: result.count,
          jobsInserted: result.jobsInserted,
        });
      }
      results.push({ userId, ...result });
    } catch (error) {
      console.error("jobs-cron user run failed", { userId, error });
      results.push({
        userId,
        ok: false,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const response = await handleManualRun(req);
    return new Response(await response.text(), {
      status: response.status,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("jobs-cron.error", error);
    return subscriptionErrorResponse(error, corsHeaders);
  }
});

try {
  const cronExpr = Deno.env.get("JOBS_CRON_EXPR");
  if (cronExpr) {
    Deno.cron("jobs-cron", cronExpr, async () => {
      try {
        const serviceRoleClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
          { auth: { persistSession: false } },
        );
        const results = await runScheduledUsers(serviceRoleClient);
        console.log("jobs-cron scheduled run completed", {
          users: results.length,
        });
      } catch (error) {
        console.error("jobs-cron scheduled run failed", error);
      }
    });
  }
} catch {
  // Ignore local tooling environments that do not support Deno.cron.
}
