import { getCorsHeaders } from "../_shared/types.ts";
import {
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

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin || undefined);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const { user, serviceClient } = await requireSubscriptionTier(
      req,
      "Basics",
      "Job evaluation",
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
          headers: { ...cors, "Content-Type": "application/json" },
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
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in evaluate-job-fit:", error);
    return subscriptionErrorResponse(error, cors);
  }
});
