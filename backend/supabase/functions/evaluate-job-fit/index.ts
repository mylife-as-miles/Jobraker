import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  SubscriptionAccessError,
  requireSubscriptionTier,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";
import {
  evaluateAndPersistJobFit,
  type JobEvaluationResult,
} from "../_shared/job-evaluation.ts";
import {
  enforceFeatureRateLimit,
  recordFeatureUsage,
} from "../_shared/feature-limits.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { user, serviceClient, subscriptionTier } = await requireSubscriptionTier(
      req,
      "Basics",
      "Auto apply",
    );
    await enforceFeatureRateLimit({
      userId: user.id,
      featureKey: "evaluate_job_fit",
      serviceClient,
      subscriptionTier,
    });

    const raw = (await req.json()) as Record<string, unknown>;
    const jobDescription =
      (typeof raw.jobDescription === "string" && raw.jobDescription.trim()
        ? raw.jobDescription
        : typeof raw.job_description === "string" && raw.job_description.trim()
        ? raw.job_description
        : "") as string;
    const jobId = raw.jobId ?? raw.job_id;
    const jobTitle = raw.jobTitle ?? raw.job_title;
    const company = raw.company;
    const profileSnapshot = raw.profileSnapshot ?? raw.profile_snapshot;
    const resumeText = raw.resumeText ?? raw.resume_text;

    if (!jobDescription) {
      return new Response(
        JSON.stringify({ error: "Missing required field: jobDescription" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const evaluation: JobEvaluationResult = await evaluateAndPersistJobFit({
      serviceClient,
      userId: user.id,
      jobId: (typeof jobId === "string" ? jobId : null) || null,
      jobTitle: (typeof jobTitle === "string" ? jobTitle : null) || null,
      company: (typeof company === "string" ? company : null) || null,
      jobDescription,
      profileSnapshot: (typeof profileSnapshot === "string" ? profileSnapshot : null) || null,
      resumeText: (typeof resumeText === "string" ? resumeText : null) || null,
    });

    await recordFeatureUsage({
      userId: user.id,
      featureKey: "evaluate_job_fit",
      serviceClient,
      subscriptionTier,
      metadata: {
        job_id: (typeof jobId === "string" ? jobId : null) || null,
      },
    });

    return new Response(JSON.stringify(evaluation), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    if (error instanceof SubscriptionAccessError) {
      return subscriptionErrorResponse(error, corsHeaders);
    }
    console.error("Error in evaluate-job-fit function:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
