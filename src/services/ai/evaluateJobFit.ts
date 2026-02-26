import { createClient } from "@/lib/supabaseClient";

export interface EvaluateJobFitResponse {
  confidence_score: number;
  missing_requirements: string[];
  tailoring_suggestions: string[];
}

const supabase = createClient();

export async function evaluateJobFit(
  jobDescription: string,
  profileSnapshot: string,
  resumeText: string
): Promise<EvaluateJobFitResponse> {
  if (!jobDescription) {
    throw new Error("Job description is required for evaluation");
  }

  try {
    const { data, error } = await supabase.functions.invoke('evaluate-job-fit', {
      body: { jobDescription, profileSnapshot, resumeText }
    });

    if (error) {
       console.error("Evaluate Job Fit function error:", error);
       throw new Error(error.message || "Failed to evaluate job fit");
    }

    if (!data) throw new Error("No evaluation data returned from AI");

    return data as EvaluateJobFitResponse;

  } catch (err: any) {
    console.error("Evaluate Job Fit service error:", err);
    throw new Error(`Failed to evaluate job fit: ${err.message || err}`);
  }
}
