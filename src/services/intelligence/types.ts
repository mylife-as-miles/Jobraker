export type RankingReasonCategory =
  | "lead_quality"
  | "candidate_fit"
  | "profile_evidence"
  | "seniority"
  | "location"
  | "salary"
  | "source"
  | "freshness"
  | "dedupe"
  | "strategic_value"
  | "feedback"
  | "semantic"
  | "graph"
  | "llm";

export type RankingReasonImpact = "positive" | "negative" | "neutral" | "cap";

export type RankingReason = {
  id: string;
  category: RankingReasonCategory;
  impact: RankingReasonImpact;
  weight?: number;
  scoreDelta?: number;
  title: string;
  detail: string;
  evidence?: string[];
  source?: string;
};

export type ScoreCap = {
  id: string;
  category: RankingReasonCategory;
  maxScore: number;
  applied: boolean;
  reason: string;
};

export type MatchBlocker = {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  detail: string;
  canImprove: boolean;
};

export type MissingSignal = {
  id: string;
  category: RankingReasonCategory;
  title: string;
  detail: string;
  importance: "low" | "medium" | "high" | "critical";
  evidenceNeeded?: string[];
};

export type RecommendedJobAction =
  | "apply_now"
  | "save_for_later"
  | "tailor_resume_first"
  | "needs_more_research"
  | "skip"
  | "ignore_bad_lead";

export type RankLabel = "excellent" | "strong" | "possible" | "weak" | "bad_lead";

export type ProfileEvidenceMatch = {
  id: string;
  skill?: string;
  requirement: string;
  evidenceText: string;
  evidenceSource: "profile_skill" | "profile_experience" | "profile_goal" | "resume" | "inferred";
  confidence: number;
};

export type GraphProofPath = {
  nodes: string[];
  edges: string[];
  confidence: number;
};

export type ExplainableJobOpportunity = {
  jobId: string;
  opportunityScore: number;
  leadQualityScore: number;
  candidateFitScore: number;
  profileEvidenceScore: number;
  strategicValueScore: number;
  feedbackLearningScore: number;
  rank: number;
  rankLabel: RankLabel;
  visibleReasons: RankingReason[];
  capsApplied: ScoreCap[];
  blockers: MatchBlocker[];
  missingSignals: MissingSignal[];
  supportingEvidence: ProfileEvidenceMatch[];
  proofPaths?: GraphProofPath[];
  recommendedAction: RecommendedJobAction;
  debug?: {
    deterministicRules: unknown;
    semanticSignals?: unknown;
    graphSignals?: unknown;
    llmSignals?: unknown;
  };
};

export type JobIntelligenceJobInput = {
  id: string;
  title?: string | null;
  company?: string | null;
  company_logo?: string | null;
  description?: string | null;
  location?: string | null;
  remote_type?: string | null;
  employment_type?: string | null;
  experience_level?: string | null;
  apply_url?: string | null;
  posted_at?: string | null;
  discovered_at?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  source_kind?: string | null;
  source_confidence?: number | null;
  is_tracked_company?: boolean | null;
  lead_quality_score?: number | null;
  lead_quality_reason?: string | null;
  lead_quality_tags?: string[] | null;
  raw_data?: Record<string, unknown> | null;
  evaluation_summary?: {
    confidence_score?: number | null;
    blockers?: string[] | null;
    exact_fit_evidence?: string[] | null;
    matched_keywords?: string[] | null;
  } | null;
};

export type CandidateProfileInput = {
  targetTitle?: string | null;
  searchQuery?: string | null;
  location?: string | null;
  locationScope?: "city" | "country" | "global" | string | null;
  experienceYears?: number | null;
  goals?: string[] | null;
  skills?: Array<{
    name: string;
    level?: string | null;
    category?: string | null;
  }> | null;
  experiences?: Array<{
    title?: string | null;
    company?: string | null;
    description?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    is_current?: boolean | null;
  }> | null;
  proofPoints?: Array<{
    title?: string | null;
    evidence?: string | null;
    metric?: string | null;
    tags?: string[] | null;
  }> | string[] | null;
  resumeText?: string | null;
};

export type ScoreWeights = {
  leadQuality: number;
  candidateFit: number;
  profileEvidence: number;
  strategicValue: number;
  feedbackLearning: number;
};

export const DEFAULT_OPPORTUNITY_WEIGHTS: ScoreWeights = {
  leadQuality: 0.3,
  candidateFit: 0.4,
  profileEvidence: 0.15,
  strategicValue: 0.1,
  feedbackLearning: 0.05,
};
