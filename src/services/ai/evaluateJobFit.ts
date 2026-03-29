import { invokeProtectedFunction } from "../supabase/invokeProtectedFunction";

export interface EvaluateJobFitResponse {
  confidence_score: number;
  missing_requirements: string[];
  tailoring_suggestions: string[];
  matched_keywords: string[];
}

export async function evaluateJobFit(
  jobDescription: string,
  profileSnapshot: string,
  resumeText: string
): Promise<EvaluateJobFitResponse> {
  if (!jobDescription) {
    throw new Error("Job description is required for evaluation");
  }

  try {
    const data = await invokeProtectedFunction<EvaluateJobFitResponse>(
      "evaluate-job-fit",
      {
        body: { jobDescription, profileSnapshot, resumeText },
      },
    );

    if (!data) {
      throw new Error("No evaluation data returned from AI");
    }

    return data;
  } catch (err: any) {
    console.error("Evaluate Job Fit service error:", err);
    throw new Error(`Failed to evaluate job fit: ${err.message || err}`);
  }
}
