import { getCorsHeaders } from "../_shared/types.ts";
import {
  requireSubscriptionTier,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";
import {
  evaluateAndPersistJobFit,
  type JobEvaluationResult,
} from "../_shared/job-evaluation.ts";

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
          headers: { ...cors, "Content-Type": "application/json" },
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

    return new Response(JSON.stringify(evaluation), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in evaluate-job-fit:", error);
    return subscriptionErrorResponse(error, cors);
  }
});
