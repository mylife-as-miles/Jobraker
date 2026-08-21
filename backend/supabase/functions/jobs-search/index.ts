import { getCorsHeaders } from "../_shared/cors.ts";
import { discoverJobsHybrid, type PublicJobSource } from "../_shared/discovery-hybrid.ts";
import { persistDiscoveredJobs, settleJobSearchRunCredits } from "../_shared/jobs.ts";
import { syncRtrvrCreditUsage } from "../_shared/provider-credits.ts";
import { normalizeSearchScope } from "../_shared/search-normalization.ts";
import {
  requireAuthenticatedUser,
  resolveJobSearchExecutionLimits,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";

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

function serializeError(err: any): string {
  if (err == null) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) {
    const anyErr = err as any;
    if (anyErr.response?.data) {
      return `${err.message}: ${JSON.stringify(anyErr.response.data)}`;
    }
    return err.message || err.stack || String(err);
  }
  if (typeof err === "object") {
    if (err.message) {
      let msg = err.message;
      if (err.details) msg += ` (${err.details})`;
      if (err.code) msg += ` [Code: ${err.code}]`;
      return msg;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

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
  const corsHeaders = getCorsHeaders(origin, req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const searchQuery = String(body?.searchQuery || body?.query || "").trim();
    const rawLocation = String(body?.location || "").trim();
    const locationScope = (["city", "country", "global", "remote"] as const).includes(body?.locationScope)
      ? (body.locationScope as "city" | "country" | "global" | "remote")
      : "city";
    const sourceFocus = parsePublicSources(
      body?.sources ?? body?.sourceFocus ?? body?.publicSources,
    );
    const targetDomains = extractTargetDomains([
      searchQuery,
      ...(Array.isArray(body?.targetDomains) ? body.targetDomains : []),
      ...(Array.isArray(body?.careerSourceUrls) ? body.careerSourceUrls : []),
    ]);

    // ── Canonical search scope normalization ──────────────────────────────────
    // Replace inline ad-hoc country resolution with the shared normalizer.
    // This produces a stable fingerprint and structured location metadata.
    const canonicalScope = await normalizeSearchScope(
      searchQuery,
      rawLocation,
      locationScope,
    );

    // The effective search location string sent to discovery tools
    const location = (canonicalScope.location.displayName ?? rawLocation) || "Remote";

    const requestedLimit = Number.isFinite(Number(body?.limit))
      ? Math.max(1, Math.floor(Number(body.limit)))
      : 10;
    const freshnessDays = Number.isFinite(Number(body?.freshnessDays))
      ? Math.max(1, Math.min(365, Math.floor(Number(body.freshnessDays))))
      : 30;

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

    let agentRunId: string | null = null;
    let searchSettled = false;

    const creditsToReserve = Math.max(1, effectiveLimit);
    const idempotencyKey = crypto.randomUUID();
    const { data: reserveRaw, error: reserveError } = await serviceClient.rpc(
      "reserve_credits_for_run",
      {
        p_user_id: user.id,
        p_run_type: "job_search",
        p_estimated_credits: creditsToReserve,
        p_idempotency_key: idempotencyKey,
        p_metadata: {
          searchQuery,
          normalizedQuery: canonicalScope.normalizedQuery,
          locationScope: canonicalScope.location.scope,
          locationKey: canonicalScope.location.locationKey,
          location,
          fingerprint: canonicalScope.fingerprint,
          requestedLimit,
          effectiveLimit,
        },
      }
    );

    const reserve = reserveRaw as Record<string, unknown> | null;
    if (reserveError || !reserve || reserve.success !== true) {
      return new Response(
        JSON.stringify({
          error: (reserve?.message as string) || "Insufficient credits for job search run.",
          code: "insufficient_credits",
          current_balance: reserve?.current_balance || creditsBalance,
          required_credits: creditsToReserve,
        }),
        {
          status: 402,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    agentRunId = reserve.agent_run_id as string;
    const holdId = (reserve.hold_id as string | undefined) ?? null;

    // ── Persist canonical search run record ───────────────────────────────────
    // Written immediately after successful reservation so the run is always
    // visible — even if the background task dispatch fails.
    try {
      await serviceClient.rpc("insert_job_search_run", {
        p_agent_run_id:       agentRunId,
        p_user_id:            user.id,
        p_original_query:     searchQuery,
        p_raw_location:       rawLocation,
        p_normalized_query:   canonicalScope.normalizedQuery,
        p_location_scope:     canonicalScope.location.scope,
        p_location_key:       canonicalScope.location.locationKey,
        p_country_code:       canonicalScope.location.countryCode,
        p_city:               canonicalScope.location.city,
        p_display_location:   canonicalScope.location.displayName,
        p_search_fingerprint: canonicalScope.fingerprint,
        p_hold_id:            holdId,
        p_estimated_credits:  creditsToReserve,
      });
    } catch (runInsertError) {
      // Non-fatal: log and continue — settlement will still work via legacy path.
      console.warn("[jobs-search] Failed to insert job_search_run record", {
        agentRunId,
        error: runInsertError,
      });
    }
    const searchStartedAt = new Date().toISOString();

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
            locationScope,
            limit: requestedLimit,
            sources: sourceFocus,
            targetDomains,
            freshnessDays,
            agent_run_id: agentRunId,
            search_started_at: searchStartedAt,
          },
        })
        .select("id")
        .single();

      if (enqueueError) {
        await settleJobSearchRunCredits(serviceClient, {
          agentRunId,
          userId: user.id,
          searchQuery,
          location,
          searchStartedAt,
          maxCredits: creditsToReserve,
          searchFailed: true,
          failureReason: "Failed to enqueue background search task",
        });
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
          searchStartedAt,
          // V2: canonical search scope for frontend to save — used to fetch
          // results by agentRunId instead of re-matching raw query strings.
          canonicalSearch: {
            normalizedQuery:  canonicalScope.normalizedQuery,
            locationScope:    canonicalScope.location.scope,
            locationKey:      canonicalScope.location.locationKey,
            locationName:     canonicalScope.location.displayName,
            fingerprint:      canonicalScope.fingerprint,
          },
          creditReservation: {
            holdId,
            reservedCredits: creditsToReserve,
          },
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
      console.log("[jobs-search] RTRVR-led discovery", {
        userId: user.id,
        searchQuery,
        location,
        sourceFocus,
        targetDomains,
        requestedLimit,
        effectiveLimit,
        subscriptionTier,
      });

      const result = await discoverJobsHybrid(
        {
          serviceClient,
          userId: user.id,
          searchQuery,
          location,
          limit: effectiveLimit,
          sourceFocus,
          targetDomains,
          freshnessDays,
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
              // V2: link discovered jobs to this agent run
              agentRunId,
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
      failureReason = serializeError(err);
    }

    const jobsInserted = totalInserted;

    // V2: unique key for idempotent settlement via settle_search_run_v2
    const settlementIdempotencyKey = `settle:${agentRunId}:${Date.now()}`;

    const { displayableJobCount, creditsCharged, currentBalance } = await settleJobSearchRunCredits(
      serviceClient,
      {
        agentRunId,
        userId: user.id,
        searchQuery,
        location,
        searchStartedAt,
        maxCredits: creditsToReserve,
        searchFailed,
        failureReason,
        jobsInserted,
        jobsDiscovered: discoveredJobs.length,
        settlementIdempotencyKey,
      },
    );

    searchSettled = true;

    if (searchFailed) {
      return new Response(
        JSON.stringify({
          error: "Search failed. Your credits have been refunded.",
          code: "search_failed",
          details: failureReason,
          creditsCharged: 0,
          current_balance: currentBalance,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "content-type": "application/json" },
        }
      );
    }
    
    const actualCredits = creditsCharged;
    const creditsDeducted = actualCredits;
    const remainingBalance = currentBalance;
    let providerCreditSync: Record<string, unknown> | null = null;

    try {
      const syncResult = await syncRtrvrCreditUsage(serviceClient, {
        source: "jobs-search",
        userId: user.id,
        requestedLimit,
        effectiveLimit,
        jobsInserted,
        jobsBilled: actualCredits,
      });
      providerCreditSync = {
        remainingCredits: syncResult.usage.remainingCredits,
        planCredits: syncResult.usage.planCredits,
        billingPeriodStart: syncResult.usage.billingPeriodStart,
        billingPeriodEnd: syncResult.usage.billingPeriodEnd,
        alert: syncResult.alert,
      };
    } catch (providerCreditError) {
      console.warn("[jobs-search] RTRVR credit ledger sync failed", providerCreditError);
    }

    console.info("[jobs-search] Completed", {
      userId: user.id,
      requestedLimit,
      effectiveLimit,
      discoveredCount: discoveredJobs.length,
      jobsInserted,
      displayableJobCount,
      jobsBilled: actualCredits,
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
        newCount: jobsInserted,
        duplicateCount: Math.max(0, discoveredJobs.length - jobsInserted),
        displayedCount: displayableJobCount,
        displayableJobCount,
        jobsBilled: actualCredits,
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
        freshnessDays,
        warnings,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  } catch (error: unknown) {
    console.error("jobs-search.error", error);
    if (agentRunId && !searchSettled) {
      try {
        const serviceClient = createServiceSupabaseClient();
        await settleJobSearchRunCredits(serviceClient, {
          agentRunId,
          userId: user?.id || "",
          searchQuery: searchQuery || "",
          location: location || "",
          maxCredits: creditsToReserve || 0,
          searchFailed: true,
          failureReason: error instanceof Error ? error.message : "Unhandled search failure",
        });
      } catch (fallbackSettleErr) {
        console.error("[jobs-search] Emergency fallback settlement failed:", fallbackSettleErr);
      }
    }
    return subscriptionErrorResponse(error, corsHeaders);
  }
});
