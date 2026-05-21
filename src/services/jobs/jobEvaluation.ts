import type { EvaluateJobFitResponse } from "../ai/evaluateJobFit";
import { createClient } from "@/lib/supabaseClient";

export type JobEvaluationReport = EvaluateJobFitResponse & {
  candidate_memory?: string | null;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeEvaluationReport = (row: any): JobEvaluationReport => {
  const report =
    row?.report && typeof row.report === "object"
      ? (row.report as Record<string, unknown>)
      : {};
  const compensation =
    row?.compensation && typeof row.compensation === "object"
      ? row.compensation
      : report.compensation && typeof report.compensation === "object"
        ? report.compensation
        : {};
  const personalizationPlan =
    row?.personalization_plan && typeof row.personalization_plan === "object"
      ? row.personalization_plan
      : report.personalization_plan &&
          typeof report.personalization_plan === "object"
        ? report.personalization_plan
        : {};
  const interviewStories = Array.isArray(row?.interview_stories)
    ? row.interview_stories
    : Array.isArray(report.interview_stories)
      ? report.interview_stories
      : [];

  return {
    evaluation_id:
      row?.id || asString(report.evaluation_id) || null,
    archetype:
      asString(row?.archetype) || asString(report.archetype) || "Generalist operator",
    canonical_decision:
      (row?.canonical_decision ||
        report.canonical_decision ||
        "draft_first") as JobEvaluationReport["canonical_decision"],
    confidence_score:
      typeof row?.confidence_score === "number"
        ? row.confidence_score
        : typeof report.confidence_score === "number"
          ? report.confidence_score
          : 0,
    exact_fit_evidence: asStringArray(
      row?.exact_fit_evidence ?? report.exact_fit_evidence,
    ),
    blockers: asStringArray(row?.blockers ?? report.blockers),
    compensation: {
      summary:
        asString(compensation.summary) ||
        "Compensation not evaluated",
      notes: asStringArray(compensation.notes),
      signals: asStringArray(compensation.signals),
    },
    personalization_plan: {
      narrative:
        asString(personalizationPlan.narrative) ||
        "Lead with the strongest relevant outcomes from your background.",
      emphasis_points: asStringArray(personalizationPlan.emphasis_points),
      ats_keywords: asStringArray(personalizationPlan.ats_keywords),
      proof_points_to_highlight: asStringArray(
        personalizationPlan.proof_points_to_highlight,
      ),
      risk_mitigation: asStringArray(personalizationPlan.risk_mitigation),
    },
    interview_stories: interviewStories
      .map((item: any) => {
        if (!item || typeof item !== "object") return null;
        const title = asString(item.title);
        const reason = asString(item.reason);
        if (!title || !reason) return null;
        return {
          title,
          reason,
          talking_points: asStringArray(item.talking_points),
        };
      })
      .filter(Boolean) as JobEvaluationReport["interview_stories"],
    missing_requirements: asStringArray(
      row?.missing_requirements ?? report.missing_requirements,
    ),
    tailoring_suggestions: asStringArray(
      row?.tailoring_suggestions ?? report.tailoring_suggestions,
    ),
    matched_keywords: asStringArray(
      row?.matched_keywords ?? report.matched_keywords,
    ),
    score_breakdown:
      row?.score_breakdown && typeof row.score_breakdown === "object"
        ? row.score_breakdown
        : report.score_breakdown && typeof report.score_breakdown === "object"
          ? (report.score_breakdown as Record<string, unknown>)
          : {},
    ats_keyword_coverage:
      row?.ats_keyword_coverage && typeof row.ats_keyword_coverage === "object"
        ? row.ats_keyword_coverage
        : report.ats_keyword_coverage &&
            typeof report.ats_keyword_coverage === "object"
          ? (report.ats_keyword_coverage as Record<string, unknown>)
          : {},
    candidate_memory: asString((report as any)?.candidate_memory) || null,
  };
};

export async function fetchJobEvaluationReport(
  jobId: string,
): Promise<JobEvaluationReport | null> {
  const supabase = createClient();
  const { data, error } = await (supabase as any)
    .from("job_evaluations")
    .select(
      "id, report, archetype, canonical_decision, confidence_score, exact_fit_evidence, blockers, compensation, personalization_plan, interview_stories, matched_keywords, missing_requirements, tailoring_suggestions, score_breakdown, ats_keyword_coverage",
    )
    .eq("job_id", jobId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load job evaluation.");
  }

  if (!data) {
    return null;
  }

  return normalizeEvaluationReport(data);
}
