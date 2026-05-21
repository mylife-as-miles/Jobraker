import type { DiscoveryJob } from "./discovery-hybrid.ts";
import type { JobQualityResult } from "./job-quality.ts";

type FeedbackLabel =
  | "relevant"
  | "not_relevant"
  | "low_quality"
  | "duplicate"
  | "already_applied"
  | "good_fit";

type FeedbackRow = {
  label: FeedbackLabel;
  jobs?: {
    title?: string | null;
    company?: string | null;
    source_kind?: string | null;
    source_type?: string | null;
    lead_quality_tags?: string[] | null;
  } | null;
};

export interface FeedbackLearningProfile {
  samples: Array<{
    label: FeedbackLabel;
    titleTokens: Set<string>;
    company: string;
    sourceKind: string;
    sourceType: string;
    qualityTags: Set<string>;
  }>;
}

export interface FeedbackLearningAdjustment {
  delta: number;
  reason: string | null;
  tags: string[];
}

const LABEL_WEIGHTS: Record<FeedbackLabel, number> = {
  relevant: 5,
  good_fit: 8,
  not_relevant: -8,
  low_quality: -12,
  duplicate: -10,
  already_applied: -6,
};

const STOPWORDS = new Set([
  "and",
  "are",
  "for",
  "from",
  "job",
  "lead",
  "manager",
  "remote",
  "role",
  "senior",
  "the",
  "with",
]);

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, Math.round(value)));

const normalizeText = (value?: string | null): string =>
  (value || "").trim().toLowerCase();

const tokenizeTitle = (value?: string | null): Set<string> =>
  new Set(
    normalizeText(value)
      .replace(/[^a-z0-9+#.\s-]/g, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(
        (token) =>
          token.length >= 3 &&
          !STOPWORDS.has(token) &&
          !/^\d+$/.test(token),
      ),
  );

const titleOverlap = (left: Set<string>, right: Set<string>): number => {
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) overlap += 1;
  }
  return overlap / Math.min(left.size, right.size);
};

const getJobTags = (job: DiscoveryJob): Set<string> => {
  const scrapedData =
    job.raw_data?.scraped_data &&
    typeof job.raw_data.scraped_data === "object" &&
    !Array.isArray(job.raw_data.scraped_data)
      ? (job.raw_data.scraped_data as Record<string, unknown>)
      : {};
  const tags = [
    ...(Array.isArray(job.raw_data?.tags) ? (job.raw_data.tags as unknown[]) : []),
    ...(Array.isArray(scrapedData.tags) ? (scrapedData.tags as unknown[]) : []),
  ];
  return new Set(
    tags.filter((tag): tag is string => typeof tag === "string").map(normalizeText),
  );
};

export async function fetchFeedbackLearningProfile(
  serviceClient: any,
  userId: string,
): Promise<FeedbackLearningProfile> {
  const { data, error } = await serviceClient
    .from("job_feedback")
    .select(
      "label, jobs(title, company, source_kind, source_type, lead_quality_tags)",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) {
    console.warn("Failed to load job feedback learning profile", error);
    return { samples: [] };
  }

  const samples = ((data as FeedbackRow[] | null) ?? [])
    .map((row) => {
      const job = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
      if (!job) return null;
      return {
        label: row.label,
        titleTokens: tokenizeTitle(job.title),
        company: normalizeText(job.company),
        sourceKind: normalizeText(job.source_kind),
        sourceType: normalizeText(job.source_type),
        qualityTags: new Set(
          (job.lead_quality_tags ?? []).map((tag) => normalizeText(tag)),
        ),
      };
    })
    .filter((sample): sample is FeedbackLearningProfile["samples"][number] =>
      Boolean(sample),
    );

  return { samples };
}

export function scoreFeedbackLearningAdjustment(
  job: DiscoveryJob,
  profile: FeedbackLearningProfile,
): FeedbackLearningAdjustment {
  if (!profile.samples.length) {
    return { delta: 0, reason: null, tags: [] };
  }

  const jobTitleTokens = tokenizeTitle(job.title);
  const jobCompany = normalizeText(job.company);
  const jobSourceKind = normalizeText(job.source_kind);
  const jobSourceType = normalizeText(job.source_type);
  const jobTags = getJobTags(job);

  let weightedDelta = 0;
  let matchedSignals = 0;
  const tags = new Set<string>();

  for (const sample of profile.samples) {
    const companyMatch = jobCompany && sample.company === jobCompany;
    const sourceMatch =
      (jobSourceKind && sample.sourceKind === jobSourceKind) ||
      (jobSourceType && sample.sourceType === jobSourceType);
    const overlap = titleOverlap(jobTitleTokens, sample.titleTokens);
    let strength = 0;

    if (companyMatch) strength += 0.7;
    if (sourceMatch) strength += 0.2;
    if (overlap >= 0.5) strength += 0.5;
    else if (overlap >= 0.25) strength += 0.25;

    for (const tag of jobTags) {
      if (sample.qualityTags.has(tag)) strength += 0.1;
    }

    if (strength <= 0) continue;

    weightedDelta += LABEL_WEIGHTS[sample.label] * Math.min(strength, 1);
    matchedSignals += 1;
    tags.add(
      LABEL_WEIGHTS[sample.label] > 0
        ? "feedback_positive_match"
        : "feedback_negative_match",
    );
    if (companyMatch) tags.add("feedback_company_match");
    if (overlap >= 0.25) tags.add("feedback_title_match");
  }

  if (!matchedSignals) {
    return { delta: 0, reason: null, tags: [] };
  }

  const delta = clamp(weightedDelta / Math.max(1, matchedSignals), -18, 18);
  if (delta === 0) {
    return { delta: 0, reason: null, tags: Array.from(tags) };
  }

  return {
    delta,
    reason:
      delta > 0
        ? `Feedback learning boosted this lead by ${delta} points.`
        : `Feedback learning reduced this lead by ${Math.abs(delta)} points.`,
    tags: Array.from(tags),
  };
}

export function applyFeedbackLearningToQuality(
  quality: JobQualityResult,
  adjustment: FeedbackLearningAdjustment,
): JobQualityResult & { feedback_learning_adjustment: FeedbackLearningAdjustment } {
  const nextScore = clamp(quality.score + adjustment.delta, 0, 100);
  return {
    score: nextScore,
    reason: adjustment.reason
      ? `${quality.reason} ${adjustment.reason}`
      : quality.reason,
    tags: Array.from(new Set([...quality.tags, ...adjustment.tags])),
    feedback_learning_adjustment: adjustment,
  };
}
