import { getCorsHeaders } from "../_shared/cors.ts";
import { discoverJobsFirecrawl, type PublicJobSource } from "../_shared/discovery-hybrid.ts";
import { persistDiscoveredJobs } from "../_shared/jobs.ts";
import { syncFirecrawlCreditUsage } from "../_shared/provider-credits.ts";
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
          error: "Insufficient credits for job search.",
          code: "insufficient_credits",
          requestedLimit,
          planCap,
          creditsBalance,
        }),
        {
          status: 402,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

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
        }),
        {
          status: 202,
          headers: { ...corsHeaders, "content-type": "application/json" },
        }
      );
    }

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

    let totalInserted = 0;
    const { jobs: discoveredJobs, warnings } = await discoverJobsFirecrawl(
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

    const jobsInserted = totalInserted;

    // Bill search credits server-side (1 per job persisted, minimum 1 per completed search).
    const jobsBilled = Math.min(
      effectiveLimit,
      Math.max(1, jobsInserted),
    );
    const { data: deductRaw, error: deductError } = await serviceClient.rpc(
      "deduct_job_search_credits",
      { p_user_id: user.id, p_jobs_count: jobsBilled },
    );
    if (deductError) {
      console.error("[jobs-search] deduct_job_search_credits RPC error:", deductError);
      return new Response(
        JSON.stringify({
          error: "Could not record search credits. Please try again.",
          code: "billing_error",
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }
    const deduct = deductRaw as Record<string, unknown> | null;
    if (!deduct || deduct.success !== true) {
      return new Response(
        JSON.stringify({
          error: (deduct?.message as string) || "Insufficient credits for this search.",
          code: "insufficient_credits",
          current_balance: deduct?.current_balance,
          required_credits: deduct?.required_credits,
        }),
        {
          status: 402,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    const remainingBalance =
      typeof deduct.remaining_balance === "number"
        ? deduct.remaining_balance
        : undefined;
    const creditsDeducted =
      typeof deduct.credits_deducted === "number"
        ? deduct.credits_deducted
        : jobsBilled;
    let providerCreditSync: Record<string, unknown> | null = null;

    try {
      const syncResult = await syncFirecrawlCreditUsage(serviceClient, {
        source: "jobs-search",
        userId: user.id,
        requestedLimit,
        effectiveLimit,
        jobsInserted,
        jobsBilled,
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
      jobsBilled,
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
        jobsBilled,
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
