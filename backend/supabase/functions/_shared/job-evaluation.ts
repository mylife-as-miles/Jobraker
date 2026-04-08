import {
  createGeminiClient,
  createGeminiConfig,
  extractGeminiText,
  GEMINI_MODEL,
} from "./gemini.ts";
import {
  fetchCandidateMemory,
  formatCandidateMemoryForPrompt,
} from "./candidate-memory.ts";

export type CanonicalJobDecision =
  | "strong_yes"
  | "draft_first"
  | "risky"
  | "no_go";

export interface JobEvaluationResult {
  evaluation_id?: string | null;
  archetype: string;
  canonical_decision: CanonicalJobDecision;
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
}

interface EvaluateJobFitArgs {
  serviceClient: any;
  userId: string;
  jobId?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  jobDescription: string;
  profileSnapshot?: string | null;
  resumeText?: string | null;
}

const DEFAULT_EVALUATION: JobEvaluationResult = {
  archetype: "Generalist operator",
  canonical_decision: "draft_first",
  confidence_score: 50,
  exact_fit_evidence: [],
  blockers: [],
  compensation: {
    summary: "Compensation not evaluated",
    notes: [],
    signals: [],
  },
  personalization_plan: {
    narrative: "Lead with the strongest relevant outcomes from the candidate's background.",
    emphasis_points: [],
    ats_keywords: [],
    proof_points_to_highlight: [],
    risk_mitigation: [],
  },
  interview_stories: [],
  missing_requirements: [],
  tailoring_suggestions: [],
  matched_keywords: [],
};

const clampScore = (value: unknown): number => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return DEFAULT_EVALUATION.confidence_score;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item));
};

const parseJsonObject = (raw: string): Record<string, unknown> => {
  const trimmed = raw.trim();
  const cleaned = trimmed
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned) as Record<string, unknown>;
};

const normalizeDecision = (value: unknown): CanonicalJobDecision => {
  switch (value) {
    case "strong_yes":
    case "draft_first":
    case "risky":
    case "no_go":
      return value;
    default:
      return DEFAULT_EVALUATION.canonical_decision;
  }
};

const normalizeEvaluation = (
  payload: Record<string, unknown>,
): JobEvaluationResult => {
  const compensation =
    payload.compensation && typeof payload.compensation === "object"
      ? (payload.compensation as Record<string, unknown>)
      : {};
  const personalizationPlan =
    payload.personalization_plan &&
    typeof payload.personalization_plan === "object"
      ? (payload.personalization_plan as Record<string, unknown>)
      : {};
  const interviewStories = Array.isArray(payload.interview_stories)
    ? payload.interview_stories
    : [];

  return {
    archetype: asString(payload.archetype) || DEFAULT_EVALUATION.archetype,
    canonical_decision: normalizeDecision(payload.canonical_decision),
    confidence_score: clampScore(payload.confidence_score),
    exact_fit_evidence: asStringArray(payload.exact_fit_evidence),
    blockers: asStringArray(payload.blockers),
    compensation: {
      summary:
        asString(compensation.summary) || DEFAULT_EVALUATION.compensation.summary,
      notes: asStringArray(compensation.notes),
      signals: asStringArray(compensation.signals),
    },
    personalization_plan: {
      narrative:
        asString(personalizationPlan.narrative) ||
        DEFAULT_EVALUATION.personalization_plan.narrative,
      emphasis_points: asStringArray(personalizationPlan.emphasis_points),
      ats_keywords: asStringArray(personalizationPlan.ats_keywords),
      proof_points_to_highlight: asStringArray(
        personalizationPlan.proof_points_to_highlight,
      ),
      risk_mitigation: asStringArray(personalizationPlan.risk_mitigation),
    },
    interview_stories: interviewStories
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const raw = item as Record<string, unknown>;
        const title = asString(raw.title);
        const reason = asString(raw.reason);
        if (!title || !reason) return null;
        return {
          title,
          reason,
          talking_points: asStringArray(raw.talking_points),
        };
      })
      .filter(
        (
          item,
        ): item is JobEvaluationResult["interview_stories"][number] =>
          Boolean(item),
      ),
    missing_requirements: asStringArray(payload.missing_requirements),
    tailoring_suggestions: asStringArray(payload.tailoring_suggestions),
    matched_keywords: asStringArray(payload.matched_keywords),
  };
};

const buildPrompt = (
  args: EvaluateJobFitArgs,
  candidateMemoryText: string,
): string => `
You are Jobraker's evaluation layer. Decide whether a role should move forward to draft review, not whether to blindly auto-submit.

Return only valid JSON using this schema:
{
  "archetype": "string",
  "canonical_decision": "strong_yes | draft_first | risky | no_go",
  "confidence_score": 0,
  "exact_fit_evidence": ["string"],
  "blockers": ["string"],
  "compensation": {
    "summary": "string",
    "notes": ["string"],
    "signals": ["string"]
  },
  "personalization_plan": {
    "narrative": "string",
    "emphasis_points": ["string"],
    "ats_keywords": ["string"],
    "proof_points_to_highlight": ["string"],
    "risk_mitigation": ["string"]
  },
  "interview_stories": [
    {
      "title": "string",
      "reason": "string",
      "talking_points": ["string"]
    }
  ],
  "missing_requirements": ["string"],
  "tailoring_suggestions": ["string"],
  "matched_keywords": ["string"]
}

Decision guidance:
- "strong_yes" means strong fit and safe to proceed to automation after draft review.
- "draft_first" means worth pursuing, but needs human review and tailored materials first.
- "risky" means serious mismatch or operational risk. Draft only if the user explicitly wants to push.
- "no_go" means clear blocker or likely wasted effort.

Be strict about blockers. Distinguish missing hard requirements from improvable gaps.

Candidate memory:
${candidateMemoryText}

Profile snapshot:
${args.profileSnapshot || "No lightweight profile snapshot supplied."}

Resume text:
${(args.resumeText || "No resume text supplied.").slice(0, 16000)}

Job context:
Role: ${args.jobTitle || "Unknown role"}
Company: ${args.company || "Unknown company"}

Job description:
${args.jobDescription.slice(0, 18000)}
`;

const chooseNextJobStatus = (currentStatus?: string | null): string => {
  if (
    currentStatus &&
    [
      "draft_ready",
      "queued",
      "submitted",
      "failed",
      "interview",
      "offer",
      "rejected",
      "withdrawn",
    ].includes(currentStatus)
  ) {
    return currentStatus;
  }
  return "evaluated";
};

export async function evaluateAndPersistJobFit(
  args: EvaluateJobFitArgs,
): Promise<JobEvaluationResult> {
  const candidateMemory = await fetchCandidateMemory(args.serviceClient, args.userId);
  const prompt = buildPrompt(args, formatCandidateMemoryForPrompt(candidateMemory));
  const ai = createGeminiClient();

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    config: createGeminiConfig({
      systemInstruction:
        "You are Jobraker's structured evaluation engine. Reply with JSON only.",
      includeTools: false,
      thinkingLevel: "HIGH",
    }),
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  const rawText = extractGeminiText(response);
  const parsed = normalizeEvaluation(parseJsonObject(rawText));

  if (!args.jobId) {
    return parsed;
  }

  const [{ data: existingJob }, evaluationUpsert] = await Promise.all([
    args.serviceClient
      .from("jobs")
      .select("canonical_status")
      .eq("id", args.jobId)
      .eq("user_id", args.userId)
      .maybeSingle(),
    args.serviceClient
      .from("job_evaluations")
      .upsert(
        {
          user_id: args.userId,
          job_id: args.jobId,
          archetype: parsed.archetype,
          canonical_decision: parsed.canonical_decision,
          confidence_score: parsed.confidence_score,
          exact_fit_evidence: parsed.exact_fit_evidence,
          blockers: parsed.blockers,
          compensation: parsed.compensation,
          personalization_plan: parsed.personalization_plan,
          interview_stories: parsed.interview_stories,
          matched_keywords: parsed.matched_keywords,
          missing_requirements: parsed.missing_requirements,
          tailoring_suggestions: parsed.tailoring_suggestions,
          report: {
            ...parsed,
            candidate_memory: candidateMemory.summaryText,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,job_id" },
      )
      .select("id")
      .single(),
  ]);

  if (evaluationUpsert.error) {
    console.error("Failed to persist job evaluation", evaluationUpsert.error);
  }

  const evaluationId = evaluationUpsert.data?.id ?? null;
  const nextJobStatus = chooseNextJobStatus(existingJob?.canonical_status);

  const { error: jobUpdateError } = await args.serviceClient
    .from("jobs")
    .update({
      canonical_status: nextJobStatus,
      evaluation_summary: {
        evaluation_id: evaluationId,
        archetype: parsed.archetype,
        canonical_decision: parsed.canonical_decision,
        confidence_score: parsed.confidence_score,
        blockers: parsed.blockers,
        exact_fit_evidence: parsed.exact_fit_evidence,
        matched_keywords: parsed.matched_keywords,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.jobId)
    .eq("user_id", args.userId);

  if (jobUpdateError) {
    console.error("Failed to update job evaluation summary", jobUpdateError);
  }

  return {
    ...parsed,
    evaluation_id: evaluationId,
  };
}
