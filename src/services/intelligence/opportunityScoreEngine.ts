import {
  DEFAULT_OPPORTUNITY_WEIGHTS,
  type CandidateProfileInput,
  type ExplainableJobOpportunity,
  type JobIntelligenceJobInput,
  type MatchBlocker,
  type MissingSignal,
  type ProfileEvidenceMatch,
  type RankLabel,
  type RankingReason,
  type RecommendedJobAction,
  type ScoreCap,
  type ScoreWeights,
  type GraphProofPath,
} from "./types";
import type { JobDuplicateResult } from "./jobDedupeEngine";
import { detectJobDuplicates } from "./jobDedupeEngine";
import { scoreCandidateFit, extractKnownSkills } from "./candidateFitEngine";
import { scoreLeadQuality } from "./leadQualityEngine";
import { clampScore, compactText, normalizeText, reason } from "./textUtils";
import type { SemanticMatchResult } from "./semanticMatchEngine";
import type { GraphReasoningResult } from "./graphReasoningEngine";
import { scoreFeedbackLearning } from "./feedbackLearningEngine";

export type OpportunityScoreResult = {
  opportunityScore: number;
  leadQualityScore: number;
  candidateFitScore: number;
  profileEvidenceScore: number;
  strategicValueScore: number;
  feedbackLearningScore: number;
  visibleReasons: RankingReason[];
  capsApplied: ScoreCap[];
  blockers: MatchBlocker[];
  missingSignals: MissingSignal[];
  supportingEvidence: ProfileEvidenceMatch[];
  proofPaths?: GraphProofPath[];
  recommendedAction: RecommendedJobAction;
};

export type OpportunityScoringOptions = {
  weights?: Partial<ScoreWeights>;
  duplicate?: JobDuplicateResult;
  feedbackLearningScore?: number;
  feedbackEvents?: any[];
  semanticResult?: SemanticMatchResult;
  graphResult?: GraphReasoningResult;
};

const actionCopy: Record<RecommendedJobAction, string> = {
  apply_now: "Apply now",
  save_for_later: "Save for later",
  tailor_resume_first: "Tailor resume first",
  needs_more_research: "Needs more research",
  skip: "Skip",
  ignore_bad_lead: "Ignore bad lead",
};

export const getRecommendedActionLabel = (action: RecommendedJobAction): string =>
  actionCopy[action];

const normalizeWeights = (weights?: Partial<ScoreWeights>): ScoreWeights => {
  const merged = { ...DEFAULT_OPPORTUNITY_WEIGHTS, ...weights };
  const total =
    merged.leadQuality +
    merged.candidateFit +
    merged.profileEvidence +
    merged.strategicValue +
    merged.feedbackLearning;
  if (total <= 0) return DEFAULT_OPPORTUNITY_WEIGHTS;
  return {
    leadQuality: merged.leadQuality / total,
    candidateFit: merged.candidateFit / total,
    profileEvidence: merged.profileEvidence / total,
    strategicValue: merged.strategicValue / total,
    feedbackLearning: merged.feedbackLearning / total,
  };
};

const applyCaps = (score: number, caps: ScoreCap[]): number =>
  caps.filter((cap) => cap.applied).reduce((next, cap) => Math.min(next, cap.maxScore), score);

const getRankLabel = (score: number, leadQualityScore: number): RankLabel => {
  if (leadQualityScore < 35 || score < 25) return "bad_lead";
  if (score >= 85) return "excellent";
  if (score >= 72) return "strong";
  if (score >= 52) return "possible";
  return "weak";
};

const chooseRecommendedAction = (
  score: number,
  leadQualityScore: number,
  candidateFitScore: number,
  blockers: MatchBlocker[],
  caps: ScoreCap[],
): RecommendedJobAction => {
  if (leadQualityScore < 35 || caps.some((cap) => cap.category === "source" && cap.maxScore <= 30)) {
    return "ignore_bad_lead";
  }
  if (blockers.some((blocker) => blocker.severity === "critical")) return "skip";
  if (score >= 82 && candidateFitScore >= 78 && blockers.length === 0) return "apply_now";
  if (
    caps.some((cap) => cap.category === "candidate_fit" || cap.category === "seniority") ||
    blockers.some((blocker) => blocker.canImprove)
  ) {
    return "tailor_resume_first";
  }
  if (score >= 60) return "save_for_later";
  return "needs_more_research";
};

const profileEvidenceScore = (
  evidence: ProfileEvidenceMatch[],
  profile: CandidateProfileInput,
): number => {
  if (!evidence.length) return profile.skills?.length ? 35 : 10;
  const averageConfidence =
    evidence.reduce((sum, item) => sum + item.confidence, 0) / evidence.length;
  const backedByExperience = evidence.filter(
    (item) => item.evidenceSource === "profile_experience",
  ).length;
  const proofPoints = Array.isArray(profile.proofPoints) ? profile.proofPoints.length : 0;
  return clampScore(
    averageConfidence * 0.72 +
      Math.min(evidence.length, 8) * 3 +
      Math.min(backedByExperience, 4) * 4 +
      Math.min(proofPoints, 4) * 3,
  );
};

const strategicValueScore = (
  job: JobIntelligenceJobInput,
  profile: CandidateProfileInput,
): { score: number; reasons: RankingReason[] } => {
  let score = 45;
  const reasons: RankingReason[] = [];
  const jobText = normalizeText(
    [
      job.title,
      job.company,
      job.description,
      job.source_kind,
      job.remote_type,
      job.employment_type,
    ]
      .filter(Boolean)
      .join(" "),
  );
  const goals = (profile.goals ?? []).map(normalizeText).filter(Boolean);
  const target = normalizeText(profile.targetTitle || profile.searchQuery);

  if (job.is_tracked_company) {
    score += 18;
    reasons.push(
      reason(
        "tracked-company",
        "strategic_value",
        "positive",
        "Tracked company",
        "This company is already in the candidate's tracked company set.",
        { scoreDelta: 18 },
      ),
    );
  }

  if (target && normalizeText(job.title).includes(target.split(" ")[0] ?? "")) {
    score += 10;
    reasons.push(
      reason(
        "target-role-strategy",
        "strategic_value",
        "positive",
        "Matches target search direction",
        "The role supports the current search target.",
        { scoreDelta: 10 },
      ),
    );
  }

  const matchingGoals = goals.filter((goal) => goal && jobText.includes(goal));
  if (matchingGoals.length > 0) {
    score += Math.min(15, matchingGoals.length * 6);
    reasons.push(
      reason(
        "goal-alignment",
        "strategic_value",
        "positive",
        "Goal alignment found",
        "The role overlaps with one or more candidate goals.",
        { evidence: matchingGoals.slice(0, 3) },
      ),
    );
  }

  if (/\b(remote|hybrid|flexible)\b/.test(jobText)) {
    score += 5;
  }

  return { score: clampScore(score), reasons };
};

const feedbackScoreFromJob = (job: JobIntelligenceJobInput, override?: number): number => {
  if (typeof override === "number") return clampScore(override);
  const raw = job.raw_data?.feedback_learning_adjustment;
  if (raw && typeof raw === "object" && "delta" in raw) {
    const delta = Number((raw as { delta?: unknown }).delta);
    if (Number.isFinite(delta)) return clampScore(50 + delta * 2);
  }
  return 50;
};

const topVisibleReasons = (reasons: RankingReason[]): RankingReason[] => {
  const score = (item: RankingReason) => {
    if (item.impact === "cap") return 100;
    if (item.impact === "negative") return 80;
    if (item.category === "candidate_fit") return 70;
    if (item.category === "profile_evidence") return 65;
    if (item.category === "lead_quality") return 60;
    return 40;
  };
  return [...reasons]
    .sort((a, b) => score(b) - score(a))
    .slice(0, 8);
};

export function scoreExplainableOpportunity(
  job: JobIntelligenceJobInput,
  profile: CandidateProfileInput,
  options: OpportunityScoringOptions = {},
): OpportunityScoreResult {
  const duplicate = options.duplicate;
  const leadQuality = scoreLeadQuality(job, { duplicate });
  const candidateFit = scoreCandidateFit(job, profile);
  
  // 1. Semantic Match Integration
  let candidateFitScore = candidateFit.score;
  const semanticReasons: RankingReason[] = [];
  let extraEvidence: ProfileEvidenceMatch[] = [];
  if (options.semanticResult) {
    if (options.semanticResult.semanticFitScore > 50) {
      const boost = Math.round((options.semanticResult.semanticFitScore - 50) * 0.2);
      candidateFitScore = clampScore(candidateFitScore + boost);
    }
    semanticReasons.push(...options.semanticResult.reasons);
    extraEvidence = options.semanticResult.matchedEvidence;
  }

  // 2. Graph Reasoning Integration
  let evidenceScore = profileEvidenceScore(candidateFit.supportingEvidence, profile);
  const graphReasons: RankingReason[] = [];
  const graphBlockers: MatchBlocker[] = [];
  if (options.graphResult) {
    evidenceScore = clampScore(evidenceScore * 0.4 + options.graphResult.graphScore * 0.6);
    graphReasons.push(...options.graphResult.reasons);
    graphBlockers.push(...options.graphResult.blockers);
  }

  const strategic = strategicValueScore(job, profile);

  // 3. Feedback Learning Integration
  let feedbackLearningScore = feedbackScoreFromJob(job, options.feedbackLearningScore);
  const feedbackReasons: RankingReason[] = [];
  if (options.feedbackEvents && options.feedbackEvents.length > 0) {
    const feedbackResult = scoreFeedbackLearning(job, options.feedbackEvents);
    feedbackLearningScore = feedbackResult.score;
    feedbackReasons.push(...feedbackResult.reasons);
  } else if (feedbackLearningScore !== 50) {
    feedbackReasons.push(
      reason(
        "feedback-learning",
        "feedback",
        feedbackLearningScore > 50 ? "positive" : "negative",
        feedbackLearningScore > 50 ? "Feedback learning boost" : "Feedback learning penalty",
        "Prior user feedback adjusted this opportunity.",
        { scoreDelta: feedbackLearningScore - 50 },
      ),
    );
  }

  const weights = normalizeWeights(options.weights);
  const allCaps = [...leadQuality.caps, ...candidateFit.caps];

  const profileEvidenceReasons: RankingReason[] = [
    reason(
      "profile-evidence-strength",
      "profile_evidence",
      evidenceScore >= 70 ? "positive" : evidenceScore >= 40 ? "neutral" : "negative",
      evidenceScore >= 70 ? "Strong profile evidence" : "Profile evidence needs work",
      candidateFit.supportingEvidence.length
        ? `${candidateFit.supportingEvidence.length} profile evidence signal${
            candidateFit.supportingEvidence.length === 1 ? "" : "s"
          } support this match.`
        : "Few profile evidence signals support the job requirements.",
      {
        scoreDelta: evidenceScore,
        evidence: candidateFit.supportingEvidence
          .map((item) => item.skill || item.requirement)
          .filter(Boolean)
          .slice(0, 5),
      },
    ),
  ];

  const uncapped =
    leadQuality.score * weights.leadQuality +
    candidateFitScore * weights.candidateFit +
    evidenceScore * weights.profileEvidence +
    strategic.score * weights.strategicValue +
    feedbackLearningScore * weights.feedbackLearning;
  
  const opportunityScore = clampScore(applyCaps(uncapped, allCaps));
  const blockers = [...leadQuality.warnings, ...candidateFit.blockers, ...graphBlockers];
  const recommendedAction = chooseRecommendedAction(
    opportunityScore,
    leadQuality.score,
    candidateFitScore,
    blockers,
    allCaps,
  );

  return {
    opportunityScore,
    leadQualityScore: leadQuality.score,
    candidateFitScore,
    profileEvidenceScore: evidenceScore,
    strategicValueScore: strategic.score,
    feedbackLearningScore,
    visibleReasons: topVisibleReasons([
      ...leadQuality.reasons,
      ...candidateFit.reasons,
      ...profileEvidenceReasons,
      ...semanticReasons,
      ...graphReasons,
      ...strategic.reasons,
      ...feedbackReasons,
      reason(
        "recommended-action",
        "strategic_value",
        "neutral",
        "Recommended action",
        getRecommendedActionLabel(recommendedAction),
      ),
    ]),
    capsApplied: allCaps.filter((cap) => cap.applied),
    blockers,
    missingSignals: candidateFit.missingSignals,
    supportingEvidence: [...candidateFit.supportingEvidence, ...extraEvidence],
    proofPaths: options.graphResult?.proofPaths,
    recommendedAction,
  };
}

export function buildExplainableJobOpportunities(
  jobs: JobIntelligenceJobInput[],
  profile: CandidateProfileInput,
  options: Omit<OpportunityScoringOptions, "duplicate"> = {},
): ExplainableJobOpportunity[] {
  const duplicateMap = detectJobDuplicates(jobs);
  const opportunities = jobs.map((job) => {
    const result = scoreExplainableOpportunity(job, profile, {
      ...options,
      duplicate: duplicateMap.get(job.id),
    });
    const rankLabel = getRankLabel(result.opportunityScore, result.leadQualityScore);
    return {
      jobId: job.id,
      ...result,
      rank: 0,
      rankLabel,
      debug: {
        deterministicRules: {
          weights: normalizeWeights(options.weights),
          source: compactText(job.source_kind || job.source_type),
          detectedSkills: extractKnownSkills(job.description),
        },
      },
    } satisfies ExplainableJobOpportunity;
  });

  const rankedIds = [...opportunities]
    .sort((left, right) => {
      const leftCreated = jobTimestamp(jobs.find((job) => job.id === left.jobId));
      const rightCreated = jobTimestamp(jobs.find((job) => job.id === right.jobId));
      return right.opportunityScore - left.opportunityScore || rightCreated - leftCreated;
    })
    .map((item) => item.jobId);
  const rankById = new Map(rankedIds.map((id, index) => [id, index + 1]));

  return opportunities.map((item) => ({
    ...item,
    rank: rankById.get(item.jobId) ?? 0,
  }));
}

const jobTimestamp = (job?: JobIntelligenceJobInput): number => {
  if (!job) return 0;
  const value = job.discovered_at || job.posted_at || job.created_at;
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};
