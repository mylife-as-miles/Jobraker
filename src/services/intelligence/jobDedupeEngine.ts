import type { JobIntelligenceJobInput, RankingReason, ScoreCap } from "./types";
import {
  compactText,
  jaccardSimilarity,
  normalizeText,
  normalizeUrlKey,
  reason,
  safeDateMs,
  tokenize,
} from "./textUtils";

export type JobDuplicateResult = {
  jobId: string;
  isDuplicate: boolean;
  duplicateOfJobId?: string;
  duplicateJobIds: string[];
  confidence: number;
  reasons: RankingReason[];
  caps: ScoreCap[];
};

const emptyResult = (jobId: string): JobDuplicateResult => ({
  jobId,
  isDuplicate: false,
  duplicateJobIds: [],
  confidence: 0,
  reasons: [],
  caps: [],
});

const addToGroup = (groups: Map<string, Set<string>>, key: string | null, jobId: string) => {
  if (!key) return;
  const normalized = key.trim().toLowerCase();
  if (!normalized) return;
  const group = groups.get(normalized) ?? new Set<string>();
  group.add(jobId);
  groups.set(normalized, group);
};

const titleCompanyKey = (job: JobIntelligenceJobInput): string | null => {
  const title = normalizeText(job.title);
  const company = normalizeText(job.company);
  if (!title || !company) return null;
  return `${company}|${title}`;
};

const companyTitleLocationKey = (job: JobIntelligenceJobInput): string | null => {
  const base = titleCompanyKey(job);
  if (!base) return null;
  const location = normalizeText(job.location || job.remote_type);
  return location ? `${base}|${location}` : base;
};

const sourceIdKey = (job: JobIntelligenceJobInput): string | null => {
  const sourceId = compactText(job.source_id);
  if (!sourceId) return null;
  return `${normalizeText(job.source_type || job.source_kind || "source")}|${sourceId}`;
};

const jobTimestamp = (job: JobIntelligenceJobInput): number => {
  const value =
    safeDateMs(job.posted_at) ??
    safeDateMs(job.discovered_at) ??
    safeDateMs(job.created_at) ??
    0;
  return value;
};

const pickCanonicalJob = (
  jobIds: string[],
  byId: Map<string, JobIntelligenceJobInput>,
): string => {
  return [...jobIds].sort((leftId, rightId) => {
    const left = byId.get(leftId);
    const right = byId.get(rightId);
    const leftQuality =
      typeof left?.lead_quality_score === "number" ? left.lead_quality_score : 0;
    const rightQuality =
      typeof right?.lead_quality_score === "number" ? right.lead_quality_score : 0;
    return (
      rightQuality - leftQuality ||
      jobTimestamp(right ?? { id: rightId }) - jobTimestamp(left ?? { id: leftId }) ||
      leftId.localeCompare(rightId)
    );
  })[0];
};

const confidenceForKey = (key: string): number => {
  if (key.startsWith("url:")) return 98;
  if (key.startsWith("source:")) return 95;
  if (key.startsWith("description:")) return 92;
  if (key.startsWith("title_company_location:")) return 88;
  return 82;
};

const reasonForDuplicate = (
  confidence: number,
  duplicateOfJobId: string,
  evidence: string[],
): RankingReason =>
  reason(
    `dedupe-${duplicateOfJobId}`,
    "dedupe",
    "negative",
    "Possible duplicate or repost",
    `This listing overlaps with another saved job at ${confidence}% confidence.`,
    { evidence, scoreDelta: -8 },
  );

export function detectJobDuplicates(
  jobs: JobIntelligenceJobInput[],
): Map<string, JobDuplicateResult> {
  const byId = new Map(jobs.map((job) => [job.id, job]));
  const results = new Map(jobs.map((job) => [job.id, emptyResult(job.id)]));
  const groups = new Map<string, Set<string>>();

  for (const job of jobs) {
    const urlKey = normalizeUrlKey(job.apply_url);
    const sourceKey = sourceIdKey(job);
    const titleKey = titleCompanyKey(job);
    const titleLocationKey = companyTitleLocationKey(job);
    addToGroup(groups, urlKey ? `url:${urlKey}` : null, job.id);
    addToGroup(groups, sourceKey ? `source:${sourceKey}` : null, job.id);
    addToGroup(groups, titleKey ? `title_company:${titleKey}` : null, job.id);
    addToGroup(
      groups,
      titleLocationKey ? `title_company_location:${titleLocationKey}` : null,
      job.id,
    );
  }

  for (let index = 0; index < jobs.length; index += 1) {
    const current = jobs[index];
    const currentDescription = normalizeText(current.description);
    if (currentDescription.length < 320) continue;

    for (let nextIndex = index + 1; nextIndex < jobs.length; nextIndex += 1) {
      const next = jobs[nextIndex];
      if (titleCompanyKey(current) !== titleCompanyKey(next)) continue;
      const nextDescription = normalizeText(next.description);
      if (nextDescription.length < 320) continue;
      const similarity = jaccardSimilarity(
        tokenize(currentDescription),
        tokenize(nextDescription),
      );
      if (similarity >= 0.72) {
        addToGroup(
          groups,
          `description:${current.id}:${next.id}:${Math.round(similarity * 100)}`,
          current.id,
        );
        addToGroup(
          groups,
          `description:${current.id}:${next.id}:${Math.round(similarity * 100)}`,
          next.id,
        );
      }
    }
  }

  for (const [key, group] of groups) {
    if (group.size < 2) continue;
    const jobIds = [...group];
    const canonicalJobId = pickCanonicalJob(jobIds, byId);
    const confidence = confidenceForKey(key);
    const evidence = key.startsWith("url:")
      ? ["Same external application URL"]
      : key.startsWith("source:")
        ? ["Same source identifier"]
        : key.startsWith("description:")
          ? ["High normalized description overlap"]
          : key.startsWith("title_company_location:")
            ? ["Same company, title, and location"]
            : ["Same company and title"];

    for (const jobId of jobIds) {
      if (jobId === canonicalJobId) continue;
      const existing = results.get(jobId) ?? emptyResult(jobId);
      if (existing.confidence > confidence) continue;
      results.set(jobId, {
        jobId,
        isDuplicate: true,
        duplicateOfJobId: canonicalJobId,
        duplicateJobIds: jobIds.filter((id) => id !== jobId),
        confidence,
        reasons: [reasonForDuplicate(confidence, canonicalJobId, evidence)],
        caps: [
          {
            id: `dedupe-cap-${canonicalJobId}`,
            category: "dedupe",
            maxScore: 82,
            applied: true,
            reason: "Possible duplicate listings are capped below the original opportunity.",
          },
        ],
      });
    }
  }

  return results;
}
