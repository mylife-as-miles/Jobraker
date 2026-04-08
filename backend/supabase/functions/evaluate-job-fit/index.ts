import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  SubscriptionAccessError,
  requireSubscriptionTier,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";
import {
  evaluateAndPersistJobFit,
  type JobEvaluationResult,
} from "../_shared/job-evaluation.ts";

interface EvaluateJobFitRequest {
  jobId?: string;
  jobTitle?: string;
  company?: string;
  jobDescription: string;
  profileSnapshot?: string;
  resumeText?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { user, serviceClient } = await requireSubscriptionTier(
      req,
      "Basics",
      "Auto apply",
    );

    const {
      jobId,
      jobTitle,
      company,
      jobDescription,
      profileSnapshot,
      resumeText,
    }: EvaluateJobFitRequest = await req.json();

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
      jobId: jobId || null,
      jobTitle: jobTitle || null,
      company: company || null,
      jobDescription,
      profileSnapshot: profileSnapshot || null,
      resumeText: resumeText || null,
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
