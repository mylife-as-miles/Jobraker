import { getCorsHeaders } from "../_shared/cors.ts";
import { discoverJobsFirecrawl, type PublicJobSource } from "../_shared/discovery-hybrid.ts";
import { persistDiscoveredJobs } from "../_shared/jobs.ts";
import { syncFirecrawlCreditUsage } from "../_shared/provider-credits.ts";
import {
  requireAuthenticatedUser,
  resolveJobSearchExecutionLimits,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";

const JOB_SEARCH_RUN_COST = 10;

const PUBLIC_JOB_SOURCE_ALIASES: Record<string, PublicJobSource> = {
  web: "web",
  general: "web",
  ats: "ats",
  greenhouse: "ats",
  lever: "ats",
  ashby: "ats",
  workable: "ats",
  yc: "yc",
  "yc/jobs": "yc",
  ycombinator: "yc",
  "ycombinator.com": "yc",
  workatastartup: "yc",
  x: "x",
  twitter: "x",
  "x.com": "x",
  "twitter.com": "x",
  reddit: "reddit",
  hn: "hackernews",
  hackernews: "hackernews",
  "hacker-news": "hackernews",
  "news.ycombinator.com": "hackernews",
  community: "community",
};

function parsePublicSources(value: unknown): PublicJobSource[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,;\s]+/)
      : [];
  const seen = new Set<PublicJobSource>();
  for (const item of raw) {
    const key = String(item || "").trim().toLowerCase();
    const source = PUBLIC_JOB_SOURCE_ALIASES[key];
    if (source) seen.add(source);
  }
  return Array.from(seen);
}

function normalizeDomain(value: string): string | null {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return trimmed
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "")
      .trim() || null;
  }
}

function extractTargetDomains(value: unknown): string[] {
  const inputs = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? [value]
      : [];
  const seen = new Set<string>();
  for (const item of inputs) {
    const text = String(item || "");
    for (const match of text.matchAll(/\bsite:([a-z0-9.-]+\.[a-z]{2,})(?:\/[^\s)"']*)?/gi)) {
      const domain = normalizeDomain(match[1]);
      if (domain) seen.add(domain);
    }
    for (const match of text.matchAll(/https?:\/\/[^\s<>"')]+/gi)) {
      const domain = normalizeDomain(match[0]);
      if (domain) seen.add(domain);
    }
    const direct = normalizeDomain(text);
    if (direct && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(direct)) seen.add(direct);
  }
  return Array.from(seen).slice(0, 12);
}

Deno.serve(async (req) => {
  const startedAt = Date.now();
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const searchQuery = String(body?.searchQuery || body?.query || "").trim();
    const rawLocation = String(body?.location || "Remote").trim() || "Remote";
    const locationScope = (["city", "country", "global"] as const).includes(body?.locationScope)
      ? (body.locationScope as "city" | "country" | "global")
      : "city";
    const sourceFocus = parsePublicSources(
      body?.sources ?? body?.sourceFocus ?? body?.publicSources,
    );
    const targetDomains = extractTargetDomains([
      searchQuery,
      ...(Array.isArray(body?.targetDomains) ? body.targetDomains : []),
      ...(Array.isArray(body?.careerSourceUrls) ? body.careerSourceUrls : []),
    ]);

    // Resolve effective location based on scope
    let location = rawLocation;
    if (locationScope === "global") {
      location = "Remote";
    } else if (locationScope === "country") {
      // Extract country from the location string
      const lower = rawLocation.toLowerCase();
      const countryMap: Record<string, string> = {
        nigeria: "Nigeria", "united states": "United States", usa: "United States",
        "united kingdom": "United Kingdom", uk: "United Kingdom", canada: "Canada",
        germany: "Germany", india: "India", australia: "Australia",
      };
      let resolved: string | null = null;
      for (const [key, name] of Object.entries(countryMap)) {
        if (lower.includes(key)) { resolved = name; break; }
      }
      if (resolved) location = resolved;
      // If no country detected, keep the original location (best effort)
    }

    const requestedLimit = Number.isFinite(Number(body?.limit))
      ? Math.max(1, Math.floor(Number(body.limit)))
      : 10;

    if (!searchQuery) {
      return new Response(JSON.stringify({ error: "searchQuery is required" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const { serviceClient, user } = await requireAuthenticatedUser(req);
    const {
      subscriptionTier,
      planCap,
      creditsBalance,
      effectiveLimit,
    } = await resolveJobSearchExecutionLimits(
      user.id,
      requestedLimit,
      serviceClient,
    );

    if (effectiveLimit <= 0) {
      return new Response(
        JSON.stringify({
          error: "Your subscription limit for job search has been reached.",
          code: "limit_reached",
          requestedLimit,
          planCap,
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    const idempotencyKey = crypto.randomUUID();
    const { data: reserveRaw, error: reserveError } = await serviceClient.rpc(
      "reserve_credits_for_run",
      {
        p_user_id: user.id,
        p_run_type: "job_search",
        p_estimated_credits: JOB_SEARCH_RUN_COST,
        p_idempotency_key: idempotencyKey,
        p_metadata: {
          searchQuery,
          location,
          requestedLimit,
          effectiveLimit
        }
      }
    );

    const reserve = reserveRaw as Record<string, unknown> | null;
    if (reserveError || !reserve || reserve.success !== true) {
      return new Response(
        JSON.stringify({
          error: (reserve?.message as string) || "Insufficient credits for job search run.",
          code: "insufficient_credits",
          current_balance: reserve?.current_balance || creditsBalance,
          required_credits: JOB_SEARCH_RUN_COST,
        }),
        {
          status: 402,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    const agentRunId = reserve.agent_run_id as string;

    const isAsync = body?.async === true;

    if (isAsync) {
      const { data: task, error: enqueueError } = await serviceClient
        .from("job_intelligence_tasks")
        .insert({
          user_id: user.id,
          type: "scout_search",
          title: `Scout search: ${searchQuery}`,
          message: "Queued for background search.",
          progress_total: 3,
          params: {
            search_query: searchQuery,
            location,
            limit: requestedLimit,
            sources: sourceFocus,
            targetDomains,
            agent_run_id: agentRunId,
          },
        })
        .select("id")
        .single();

      if (enqueueError) {
        throw enqueueError;
      }

      const processTaskUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-task`;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (serviceRoleKey) {
        try {
          const dispatchResponse = await fetch(processTaskUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({ taskId: task.id }),
          });
          if (!dispatchResponse.ok) {
            console.error("[jobs-search] Failed to dispatch async scout task", {
              taskId: task.id,
              status: dispatchResponse.status,
              body: await dispatchResponse.text().catch(() => ""),
            });
          }
        } catch (dispatchError) {
          console.error("[jobs-search] Async scout task dispatch failed", {
            taskId: task.id,
            error: dispatchError,
          });
        }
      } else {
        console.warn("[jobs-search] SUPABASE_SERVICE_ROLE_KEY missing; relying on DB trigger for async scout task", {
          taskId: task.id,
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: "queued",
          taskId: task.id,
          agent_run_id: agentRunId,
        }),
        {
          status: 202,
          headers: { ...corsHeaders, "content-type": "application/json" },
        }
      );
    }

    let searchFailed = false;
    let failureReason: string | undefined;
    let discoveredJobs: any[] = [];
    let warnings: any[] = [];
    let totalInserted = 0;

    try {
      console.log("[jobs-search] Firecrawl-led discovery", {
        userId: user.id,
        searchQuery,
        location,
        sourceFocus,
        targetDomains,
        requestedLimit,
        effectiveLimit,
        subscriptionTier,
      });

      const result = await discoverJobsFirecrawl(
        {
          serviceClient,
          userId: user.id,
          searchQuery,
          location,
          limit: effectiveLimit,
          sourceFocus,
          targetDomains,
        },
        async (batch) => {
          const { jobsInserted: batchInserted } = await persistDiscoveredJobs(
            serviceClient,
            batch,
            {
              userId: user.id,
              searchQuery,
              location,
              trigger: "live_search",
              requestedLimit,
              effectiveLimit,
              subscriptionTier,
            },
          );
          totalInserted += batchInserted;
        },
      );
      
      discoveredJobs = result.jobs;
      warnings = result.warnings;

    } catch (err: any) {
      console.error("[jobs-search] Search failed", err);
      searchFailed = true;
      failureReason = err.message || "Unknown error during search";
    }

    const jobsInserted = totalInserted;

    // Settle the run
    const actualCredits = searchFailed ? 0 : JOB_SEARCH_RUN_COST;
    const { data: settleRaw, error: settleError } = await serviceClient.rpc("settle_run_credits", {
      p_agent_run_id: agentRunId,
      p_actual_credits: actualCredits,
      p_status: searchFailed ? "failed" : "completed",
      p_failure_reason: failureReason,
      p_receipt: { jobs_inserted: jobsInserted, jobs_discovered: discoveredJobs.length }
    });
    
    if (settleError) {
      console.error("[jobs-search] Failed to settle run credits", settleError);
    }

    if (searchFailed) {
      return new Response(
        JSON.stringify({
          error: "Search failed. Your credits have been refunded.",
          code: "search_failed",
          details: failureReason
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "content-type": "application/json" },
        }
      );
    }
    
    const settleData = settleRaw as Record<string, unknown> | null;
    const creditsDeducted = typeof settleData?.credits_used === 'number' ? settleData.credits_used : actualCredits;
    const remainingBalance = typeof settleData?.current_balance === 'number' ? settleData.current_balance : undefined;
    let providerCreditSync: Record<string, unknown> | null = null;

    try {
      const syncResult = await syncFirecrawlCreditUsage(serviceClient, {
        source: "jobs-search",
        userId: user.id,
        requestedLimit,
        effectiveLimit,
        jobsInserted,
        jobsBilled: JOB_SEARCH_RUN_COST,
      });
      providerCreditSync = {
        remainingCredits: syncResult.usage.remainingCredits,
        planCredits: syncResult.usage.planCredits,
        billingPeriodStart: syncResult.usage.billingPeriodStart,
        billingPeriodEnd: syncResult.usage.billingPeriodEnd,
        alert: syncResult.alert,
      };
    } catch (providerCreditError) {
      console.warn("[jobs-search] Firecrawl credit sync failed", providerCreditError);
    }

    console.info("[jobs-search] Completed", {
      userId: user.id,
      requestedLimit,
      effectiveLimit,
      discoveredCount: discoveredJobs.length,
      jobsInserted,
      jobsBilled: JOB_SEARCH_RUN_COST,
      creditsDeducted,
      remainingBalance,
      warningCount: warnings.length,
      elapsed_ms: Date.now() - startedAt,
    });

    return new Response(
      JSON.stringify({
        success: true,
        status: "completed",
        requestedLimit,
        effectiveLimit,
        planCap,
        creditsBalance,
        subscriptionTier,
        jobsInserted,
        jobsBilled: JOB_SEARCH_RUN_COST,
        creditsDeducted,
        remainingBalance,
        providerCreditSync,
        jobs: discoveredJobs.map((job) => ({
          title: job.title,
          company: job.company,
          location: job.location,
          url: job.url,
          description: job.description,
          salary_min: job.salary_min ?? null,
          salary_max: job.salary_max ?? null,
          salary_currency: job.salary_currency ?? null,
          posted_at: job.posted_at,
          source_kind: job.source_kind,
          source_confidence: job.source_confidence,
          verification_status: job.verification_status,
          is_tracked_company: job.is_tracked_company,
        })),
        count: discoveredJobs.length,
        sourceFocus,
        targetDomains,
        warnings,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  } catch (error: unknown) {
    console.error("jobs-search.error", error);
    return subscriptionErrorResponse(error, corsHeaders);
  }
});
