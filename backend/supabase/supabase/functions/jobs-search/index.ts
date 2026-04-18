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
    const location = String(body?.location || "Remote").trim() || "Remote";
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

    const discoveredJobs = await discoverJobsFirecrawl({
      serviceClient,
      userId: user.id,
      searchQuery,
      location,
      limit: effectiveLimit,
    });

    const { jobsInserted } = await persistDiscoveredJobs(serviceClient, discoveredJobs, {
      userId: user.id,
      searchQuery,
      location,
      trigger: "live_search",
      requestedLimit,
      effectiveLimit,
      subscriptionTier,
    });

    console.info("[jobs-search] Completed", {
      userId: user.id,
      requestedLimit,
      effectiveLimit,
      discoveredCount: discoveredJobs.length,
      jobsInserted,
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
