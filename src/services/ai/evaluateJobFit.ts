import { invokeProtectedFunction } from "../supabase/invokeProtectedFunction";

export interface EvaluateJobFitResponse {
  evaluation_id?: string | null;
  archetype: string;
  canonical_decision: "strong_yes" | "draft_first" | "risky" | "no_go";
  confidence_score: number;
  exact_fit_evidence: string[];
  blockers: string[];
  compensation: {
    summary: string;
    notes: string[];
    signals: string[];
  };
  personalization_plan: {
    narrative: string;
    emphasis_points: string[];
    ats_keywords: string[];
    proof_points_to_highlight: string[];
    risk_mitigation: string[];
  };
  interview_stories: Array<{
    title: string;
    reason: string;
    talking_points: string[];
  }>;
  missing_requirements: string[];
  tailoring_suggestions: string[];
  matched_keywords: string[];
  score_breakdown?: Record<string, unknown>;
  ats_keyword_coverage?: {
    jd_terms?: string[];
    covered_terms?: string[];
    missing_terms?: string[];
    incorporated_terms?: string[];
    coverage_percent?: number;
  } & Record<string, unknown>;
}

export async function evaluateJobFit(
  jobId: string | null,
  jobTitle: string,
  company: string,
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
        body: {
          jobId,
          jobTitle,
          company,
          jobDescription,
          profileSnapshot,
          resumeText,
        },
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
