import {
  createGeminiClient,
  createGeminiConfig,
  extractGeminiText,
  getGeminiAccessDeniedMessage,
  isGeminiAccessDeniedError,
  withModelFallback,
} from "./gemini.ts";
import {
  type CandidateMemory,
  createEmptyCandidateMemory,
  fetchCandidateMemory,
  formatCandidateMemoryForPrompt,
} from "./candidate-memory.ts";
import { parseStructuredJson } from "./structured-json.ts";

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
  score_breakdown?: Record<string, unknown>;
  ats_keyword_coverage?: Record<string, unknown>;
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
  score_breakdown: {},
  ats_keyword_coverage: {},
};

const STOPWORDS = new Set([
  "about",
  "above",
  "across",
  "after",
  "again",
  "against",
  "also",
  "and",
  "any",
  "are",
  "because",
  "been",
  "being",
  "between",
  "both",
  "building",
  "candidate",
  "company",
  "could",
  "customer",
  "deliver",
  "each",
  "experience",
  "from",
  "have",
  "into",
  "join",
  "just",
  "like",
  "looking",
  "must",
  "need",
  "needs",
  "our",
  "role",
  "should",
  "skills",
  "team",
  "that",
  "their",
  "them",
  "they",
  "this",
  "using",
  "with",
  "work",
  "your",
]);

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

const parseJsonObject = (raw: string): Record<string, unknown> =>
  parseStructuredJson<Record<string, unknown>>(raw);

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
    score_breakdown:
      payload.score_breakdown && typeof payload.score_breakdown === "object"
        ? (payload.score_breakdown as Record<string, unknown>)
        : {},
    ats_keyword_coverage:
      payload.ats_keyword_coverage &&
      typeof payload.ats_keyword_coverage === "object"
        ? (payload.ats_keyword_coverage as Record<string, unknown>)
        : {},
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
  "matched_keywords": ["string"],
  "score_breakdown": {
    "role_alignment": 0,
    "skills_stack": 0,
    "seniority": 0,
    "location": 0,
    "compensation": 0,
    "evidence": 0,
    "red_flags": 0
  },
  "ats_keyword_coverage": {
    "jd_terms": ["string"],
    "covered_terms": ["string"],
    "missing_terms": ["string"],
    "incorporated_terms": ["string"],
    "coverage_percent": 0
  }
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

const tokenize = (value: string): string[] =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9+#.\-/\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 3 &&
        !STOPWORDS.has(token) &&
        !/^\d+$/.test(token),
    );

const unique = (values: string[]): string[] => Array.from(new Set(values));

const topKeywords = (text: string, limit: number): string[] => {
  const counts = new Map<string, number>();
  for (const token of tokenize(text)) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([token]) => token);
};

const calculateKeywordCoverage = (
  jobDescription: string,
  candidateText: string,
  incorporatedTerms: string[] = [],
) => {
  const jdTerms = topKeywords(jobDescription, 32).map(formatKeyword);
  const candidateTokens = new Set(tokenize(candidateText));
  const coveredTerms = jdTerms.filter((term) =>
    candidateTokens.has(term.toLowerCase()),
  );
  const missingTerms = jdTerms.filter((term) => !coveredTerms.includes(term));
  const incorporated = incorporatedTerms.filter((term) =>
    coveredTerms.some((covered) => covered.toLowerCase() === term.toLowerCase()),
  );

  return {
    jd_terms: jdTerms,
    covered_terms: coveredTerms,
    missing_terms: missingTerms.slice(0, 16),
    incorporated_terms: incorporated,
    coverage_percent:
      jdTerms.length > 0
        ? clampScore((coveredTerms.length / jdTerms.length) * 100)
        : 0,
  };
};

const calculateScoreBreakdown = (
  evaluation: JobEvaluationResult,
  args: EvaluateJobFitArgs,
) => {
  const combinedJobText = `${args.jobTitle || ""}\n${args.jobDescription}`;
  const compensationScore =
    evaluation.compensation.signals.length > 0 ||
    /salary|compensation|equity|bonus|benefits/i.test(combinedJobText)
      ? 75
      : 45;
  const hasRemoteOrLocation =
    /remote|hybrid|onsite|location|relocation/i.test(combinedJobText);
  const seniorityPenalty =
    /senior|staff|principal|lead|manager|director/i.test(combinedJobText) &&
    evaluation.missing_requirements.length > 1
      ? 20
      : 0;

  return {
    role_alignment: clampScore(evaluation.confidence_score),
    skills_stack: clampScore(
      35 + Math.min(evaluation.matched_keywords.length, 10) * 6,
    ),
    seniority: clampScore(75 - seniorityPenalty - evaluation.blockers.length * 8),
    location: hasRemoteOrLocation ? 70 : 55,
    compensation: compensationScore,
    evidence: clampScore(
      40 + Math.min(evaluation.exact_fit_evidence.length, 6) * 10,
    ),
    red_flags: clampScore(100 - evaluation.blockers.length * 18),
  };
};

const sentenceFragments = (text: string): string[] =>
  text
    .split(/\r?\n|[.!?]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 24);

const formatKeyword = (token: string): string =>
  token
    .split(/[-/]/)
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join("/");

const inferArchetype = (jobTitle: string, jobDescription: string): string => {
  const combined = `${jobTitle} ${jobDescription}`.toLowerCase();
  if (/(product|pm\b|roadmap|go-to-market)/.test(combined)) {
    return "Product and growth operator";
  }
  if (/(sales|account executive|business development|customer success)/.test(combined)) {
    return "Revenue and customer operator";
  }
  if (/(data|analytics|bi\b|machine learning|ai\b)/.test(combined)) {
    return "Data and AI builder";
  }
  if (/(backend|frontend|full stack|software|engineer|developer|platform|devops)/.test(combined)) {
    return "Technical builder";
  }
  if (/(operations|program|project|implementation|support|risk|compliance)/.test(combined)) {
    return "Operations and execution lead";
  }
  return DEFAULT_EVALUATION.archetype;
};

const extractCompensationSignals = (jobDescription: string) => {
  const salaryMatches = jobDescription.match(
    /([$£€₦]\s?\d[\d,]*(?:\s?-\s?[$£€₦]?\s?\d[\d,]*)?)|(\d[\d,]*\s?(?:usd|ngn|eur|gbp))/gi,
  );

  if (!salaryMatches || salaryMatches.length === 0) {
    return {
      summary: "Compensation not listed in the job description.",
      notes: [],
      signals: [],
    };
  }

  return {
    summary: `Compensation signals found: ${salaryMatches.slice(0, 2).join(", ")}.`,
    notes: salaryMatches.slice(0, 3).map((value) => `Quoted comp signal: ${value}`),
    signals: salaryMatches.slice(0, 3),
  };
};

const deriveMissingRequirements = (
  jobDescription: string,
  candidateText: string,
): string[] => {
  const candidateTokens = new Set(tokenize(candidateText));
  return sentenceFragments(jobDescription)
    .filter((line) => /(must|required|requirement|qualification|experience with|experience in|certification|license|\d+\+?\s+years?)/i.test(line))
    .filter((line) => {
      const keywords = topKeywords(line, 5);
      if (keywords.length === 0) return false;
      const overlap = keywords.filter((keyword) => candidateTokens.has(keyword)).length;
      return overlap === 0;
    })
    .slice(0, 4);
};

const buildFallbackEvaluation = (
  args: EvaluateJobFitArgs,
  candidateMemory: CandidateMemory,
  reason?: string,
): JobEvaluationResult => {
  const candidateText = [
    args.profileSnapshot || "",
    args.resumeText || "",
    candidateMemory.summaryText,
    candidateMemory.skillKeywords.join(" "),
  ]
    .join("\n")
    .toLowerCase();

  const jobKeywords = topKeywords(
    `${args.jobTitle || ""}\n${args.jobDescription}`,
    14,
  );
  const matchedKeywords = jobKeywords.filter((keyword) =>
    candidateText.includes(keyword),
  );
  const missingRequirements = deriveMissingRequirements(
    args.jobDescription,
    candidateText,
  );
  const blockers = missingRequirements.slice(0, 2);
  const overlapRatio =
    jobKeywords.length > 0 ? matchedKeywords.length / jobKeywords.length : 0;
  const confidenceScore = clampScore(
    35 +
      overlapRatio * 55 +
      Math.min(candidateMemory.proofPoints.length, 4) * 3 -
      blockers.length * 8,
  );

  let canonicalDecision: CanonicalJobDecision = "draft_first";
  if (confidenceScore < 30 && missingRequirements.length >= 3) {
    canonicalDecision = "no_go";
  } else if (confidenceScore >= 78 && blockers.length === 0) {
    canonicalDecision = "strong_yes";
  } else if (confidenceScore < 45 && blockers.length >= 2) {
    canonicalDecision = "risky";
  }

  const exactFitEvidence = matchedKeywords
    .slice(0, 5)
    .map((keyword) => `Candidate background aligns with ${formatKeyword(keyword)}.`);

  const emphasisPoints =
    matchedKeywords.length > 0
      ? matchedKeywords.slice(0, 5).map((keyword) => `Lead with ${formatKeyword(keyword)} experience.`)
      : candidateMemory.proofPoints
          .slice(0, 3)
          .map((point) => `Lead with ${point.title}.`);

  const proofPointsToHighlight =
    candidateMemory.proofPoints.length > 0
      ? candidateMemory.proofPoints.slice(0, 4).map((point) => point.title)
      : ["Highlight the strongest quantified outcomes already present in the resume."];

  const interviewStories =
    candidateMemory.storyBank.length > 0
      ? candidateMemory.storyBank.slice(0, 3).map((story) => ({
          title: story.title,
          reason: story.relevance || "Relevant reusable story from candidate memory.",
          talking_points: unique(
            [story.situation, story.outcome || ""].filter(Boolean),
          ),
        }))
      : candidateMemory.proofPoints.slice(0, 3).map((point) => ({
          title: point.title,
          reason: "Useful example for behavioral or impact questions.",
          talking_points: unique(
            [point.evidence, point.metric || ""].filter(Boolean),
          ),
        }));

  const fallbackTailoringSuggestions = [
    ...matchedKeywords
      .slice(0, 4)
      .map((keyword) => `Mirror the job language around ${formatKeyword(keyword)} in the summary and top bullets.`),
    ...missingRequirements
      .slice(0, 2)
      .map((line) => `Address the gap around: ${line}`),
  ].slice(0, 6);

  const riskMitigation = [
    ...blockers.map((blocker) => `Prepare a concise answer for: ${blocker}`),
    ...(reason ? [reason] : []),
  ].slice(0, 4);

  return {
    archetype: inferArchetype(args.jobTitle || "", args.jobDescription),
    canonical_decision: canonicalDecision,
    confidence_score: confidenceScore,
    exact_fit_evidence:
      exactFitEvidence.length > 0
        ? exactFitEvidence
        : ["Fallback evaluation used deterministic keyword overlap because AI evaluation was unavailable."],
    blockers,
    compensation: extractCompensationSignals(args.jobDescription),
    personalization_plan: {
      narrative:
        candidateMemory.headline ||
        "Lead with the strongest relevant outcomes and keep the framing tightly aligned to the role.",
      emphasis_points: emphasisPoints,
      ats_keywords: matchedKeywords.slice(0, 8).map(formatKeyword),
      proof_points_to_highlight: proofPointsToHighlight,
      risk_mitigation: riskMitigation,
    },
    interview_stories: interviewStories,
    missing_requirements: missingRequirements,
    tailoring_suggestions:
      fallbackTailoringSuggestions.length > 0
        ? fallbackTailoringSuggestions
        : ["Tailor the resume summary and top bullets to the role before submitting."],
    matched_keywords: matchedKeywords.map(formatKeyword),
    score_breakdown: {},
    ats_keyword_coverage: {},
  };
};

export async function evaluateAndPersistJobFit(
  args: EvaluateJobFitArgs,
): Promise<JobEvaluationResult> {
  let candidateMemory: CandidateMemory;
  try {
    candidateMemory = await fetchCandidateMemory(
      args.serviceClient,
      args.userId,
    );
  } catch (error) {
    console.error("Failed to fetch candidate memory for job evaluation", error);
    candidateMemory = createEmptyCandidateMemory();
  }
  const prompt = buildPrompt(args, formatCandidateMemoryForPrompt(candidateMemory));
  let parsed: JobEvaluationResult;

  try {
    const ai = createGeminiClient();
    const { result: response } = await withModelFallback(
      (model) => ai.models.generateContent({
        model,
        config: createGeminiConfig({
          systemInstruction:
            "You are Jobraker's structured evaluation engine. Reply with JSON only.",
          includeTools: false,
          thinkingLevel: "HIGH",
        }, model),
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    );

    const rawText = extractGeminiText(response);
    if (!rawText) {
      throw new Error("Empty response from AI job evaluation.");
    }
    parsed = normalizeEvaluation(parseJsonObject(rawText));
  } catch (error) {
    const fallbackReason = isGeminiAccessDeniedError(error)
      ? getGeminiAccessDeniedMessage("AI job evaluation")
      : "AI job evaluation fell back to deterministic scoring.";
    console.error("evaluateAndPersistJobFit falling back", error);
    parsed = buildFallbackEvaluation(args, candidateMemory, fallbackReason);
  }

  const candidateTextForCoverage = [
    args.profileSnapshot || "",
    args.resumeText || "",
    candidateMemory.summaryText,
    candidateMemory.skillKeywords.join(" "),
  ].join("\n");
  parsed = {
    ...parsed,
    score_breakdown:
      parsed.score_breakdown && Object.keys(parsed.score_breakdown).length > 0
        ? parsed.score_breakdown
        : calculateScoreBreakdown(parsed, args),
    ats_keyword_coverage:
      parsed.ats_keyword_coverage &&
      Object.keys(parsed.ats_keyword_coverage).length > 0
        ? parsed.ats_keyword_coverage
        : calculateKeywordCoverage(
            args.jobDescription,
            candidateTextForCoverage,
            parsed.matched_keywords,
          ),
  };

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
          score_breakdown: parsed.score_breakdown,
          ats_keyword_coverage: parsed.ats_keyword_coverage,
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
