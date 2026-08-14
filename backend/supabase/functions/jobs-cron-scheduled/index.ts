import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { discoverJobsFirecrawl } from "../_shared/discovery-hybrid.ts";
import {
  persistDiscoveredJobs,
  settleJobSearchRunCredits,
} from "../_shared/jobs.ts";
import { syncFirecrawlCreditUsage } from "../_shared/provider-credits.ts";
import { resolveJobSearchExecutionLimits } from "../_shared/subscription.ts";

type ScheduledResult = {
  userId: string;
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  searchQuery?: string;
  location?: string;
  jobsInserted?: number;
  jobsDisplayable?: number;
  creditsCharged?: number;
};

function serviceRoleClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Scheduled job discovery is missing Supabase service-role configuration.");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

function isServiceRoleRequest(req: Request): boolean {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  const token = req.headers.get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  return Boolean(serviceRoleKey && token && token === serviceRoleKey);
}

async function loadSearchScope(serviceClient: any, userId: string) {
  const { data, error } = await serviceClient
    .from("profiles")
    .select("job_title, location")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;

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

async function settleFailedSearch(
  serviceClient: any,
  input: {
    agentRunId: string;
    userId: string;
    searchQuery: string;
    location: string;
    searchStartedAt: string;
    maxCredits: number;
    jobsInserted: number;
    jobsDiscovered: number;
    error: unknown;
  },
) {
  try {
    await settleJobSearchRunCredits(serviceClient, {
      agentRunId: input.agentRunId,
      userId: input.userId,
      searchQuery: input.searchQuery,
      location: input.location,
      searchStartedAt: input.searchStartedAt,
      maxCredits: input.maxCredits,
      searchFailed: true,
      failureReason:
        input.error instanceof Error ? input.error.message : String(input.error),
      jobsInserted: input.jobsInserted,
      jobsDiscovered: input.jobsDiscovered,
      settlementIdempotencyKey: `settle:${input.agentRunId}:scheduled-failed`,
    });
  } catch (settlementError) {
    console.error("jobs-cron-scheduled failed to refund search reservation", {
      agentRunId: input.agentRunId,
      settlementError,
    });
  }
}

async function runForUser(
  serviceClient: any,
  userId: string,
): Promise<ScheduledResult> {
  const { searchQuery, location } = await loadSearchScope(serviceClient, userId);
  if (!searchQuery) {
    return {
      userId,
      ok: true,
      skipped: true,
      reason: "missing_profile_job_title",
      location,
    };
  }

  const requestedLimit = 100;
  const {
    subscriptionTier,
    effectiveLimit,
    planCap,
    creditsBalance,
  } = await resolveJobSearchExecutionLimits(
    userId,
    requestedLimit,
    serviceClient,
  );

  if (effectiveLimit <= 0) {
    return {
      userId,
      ok: true,
      skipped: true,
      reason: "plan_limit_reached",
      searchQuery,
      location,
    };
  }

  const creditsToReserve = Math.max(1, effectiveLimit);
  const { data: reserveRaw, error: reserveError } = await serviceClient.rpc(
    "reserve_credits_for_run",
    {
      p_user_id: userId,
      p_run_type: "job_search",
      p_estimated_credits: creditsToReserve,
      p_idempotency_key: `scheduled-job-search:${userId}:${crypto.randomUUID()}`,
      p_metadata: {
        source: "jobs-cron-scheduled",
        trigger: "scheduled_cron",
        searchQuery,
        location,
        requestedLimit,
        effectiveLimit,
        planCap,
        creditsBalance,
        subscriptionTier,
      },
    },
  );

  const reserve = reserveRaw as Record<string, unknown> | null;
  if (reserveError || !reserve || reserve.success !== true) {
    return {
      userId,
      ok: true,
      skipped: true,
      reason: "insufficient_credits",
      searchQuery,
      location,
    };
  }

  const agentRunId =
    typeof reserve.agent_run_id === "string" ? reserve.agent_run_id : null;
  if (!agentRunId) {
    throw new Error("Scheduled job search reservation returned no agent run id.");
  }

  const searchStartedAt = new Date().toISOString();
  let jobsInserted = 0;
  let jobsDiscovered = 0;

  try {
    const result = await discoverJobsFirecrawl(
      {
        serviceClient,
        userId,
        searchQuery,
        location,
        limit: effectiveLimit,
      },
      async (batch) => {
        const persisted = await persistDiscoveredJobs(serviceClient, batch, {
          userId,
          searchQuery,
          location,
          trigger: "scheduled_cron",
          requestedLimit,
          effectiveLimit,
          subscriptionTier,
          agentRunId,
        });
        jobsInserted += persisted.jobsInserted;
      },
    );

    jobsDiscovered = result.jobs.length;

    const settlement = await settleJobSearchRunCredits(serviceClient, {
      agentRunId,
      userId,
      searchQuery,
      location,
      searchStartedAt,
      maxCredits: creditsToReserve,
      jobsInserted,
      jobsDiscovered,
      settlementIdempotencyKey: `settle:${agentRunId}:scheduled-completed`,
    });

    try {
      await syncFirecrawlCreditUsage(serviceClient, {
        source: "jobs-cron-scheduled",
        userId,
        trigger: "scheduled_cron",
        requestedLimit,
        effectiveLimit,
        jobsInserted,
        jobsFound: jobsDiscovered,
        jobsDisplayable: settlement.displayableJobCount,
      });
    } catch (providerCreditError) {
      console.warn("jobs-cron-scheduled Firecrawl provider sync failed", {
        userId,
        providerCreditError,
      });
    }

    return {
      userId,
      ok: true,
      searchQuery,
      location,
      jobsInserted,
      jobsDisplayable: settlement.displayableJobCount,
      creditsCharged: settlement.creditsCharged,
    };
  } catch (error) {
    await settleFailedSearch(serviceClient, {
      agentRunId,
      userId,
      searchQuery,
      location,
      searchStartedAt,
      maxCredits: creditsToReserve,
      jobsInserted,
      jobsDiscovered,
      error,
    });
    throw error;
  }
}

async function runScheduledUsers(serviceClient: any) {
  const { data: rows, error } = await serviceClient
    .from("job_source_settings")
    .select("id")
    .eq("cron_enabled", true)
    .order("updated_at", { ascending: true });

  if (error) throw error;

  const configuredMaxUsers = Number(Deno.env.get("JOBS_CRON_MAX_USERS") || 10);
  const maxUsers = Number.isFinite(configuredMaxUsers)
    ? Math.max(1, Math.floor(configuredMaxUsers))
    : 10;

  const userIds = (Array.isArray(rows) ? rows : [])
    .map((row: Record<string, unknown>) =>
      typeof row.id === "string" ? row.id : null
    )
    .filter((id): id is string => Boolean(id))
    .slice(0, maxUsers);

  const results: ScheduledResult[] = [];
  for (const userId of userIds) {
    try {
      results.push(await runForUser(serviceClient, userId));
    } catch (error) {
      console.error("jobs-cron-scheduled user run failed", { userId, error });
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
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  if (!isServiceRoleRequest(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  try {
    const results = await runScheduledUsers(serviceRoleClient());
    const failed = results.filter((result) => !result.ok).length;
    const skipped = results.filter((result) => result.skipped).length;

    return new Response(
      JSON.stringify({
        success: failed === 0,
        usersProcessed: results.length,
        failed,
        skipped,
        results,
      }),
      {
        status: failed === 0 ? 200 : 207,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  } catch (error) {
    console.error("jobs-cron-scheduled failed", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  }
});
