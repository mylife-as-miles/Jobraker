import { getCorsHeaders } from "../_shared/types.ts";
import { discoverJobsFirecrawl } from "../_shared/discovery-hybrid.ts";
import { persistDiscoveredJobs } from "../_shared/jobs.ts";
import {
  requireAuthenticatedUser,
  resolveJobSearchExecutionLimits,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";

Deno.serve(async (req) => {
  const startedAt = Date.now();
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const searchQuery = String(body?.searchQuery || body?.query || "").trim();
    const rawLocation = String(body?.location || "Remote").trim() || "Remote";
    const locationScope = (["city", "country", "global"] as const).includes(body?.locationScope)
      ? (body.locationScope as "city" | "country" | "global")
      : "city";

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

    console.log("[jobs-search] Firecrawl-led discovery", {
      userId: user.id,
      searchQuery,
      location,
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
        jobs: discoveredJobs.map((job) => ({
          title: job.title,
          company: job.company,
          location: job.location,
          url: job.url,
          description: job.description,
          posted_at: job.posted_at,
          source_kind: job.source_kind,
          source_confidence: job.source_confidence,
          verification_status: job.verification_status,
          is_tracked_company: job.is_tracked_company,
        })),
        count: discoveredJobs.length,
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
