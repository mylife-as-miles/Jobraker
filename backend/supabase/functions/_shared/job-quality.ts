import type { DiscoveryJob } from "./discovery-hybrid.ts";

export interface JobQualityResult {
  score: number;
  reason: string;
  tags: string[];
}

const SPAM_PATTERNS = [
  /no experience needed/i,
  /earn money fast/i,
  /work from home today/i,
  /commission only/i,
  /telegram|whatsapp/i,
  /upfront fee|training fee/i,
];

const SENIORITY_TERMS = [
  "intern",
  "junior",
  "entry",
  "mid",
  "senior",
  "staff",
  "principal",
  "lead",
  "director",
  "manager",
];

const clamp = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

const daysSince = (value?: string | null): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return Math.floor((Date.now() - parsed) / (24 * 60 * 60 * 1000));
};

const hasValidUrl = (value?: string | null): boolean => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

const includesSeniority = (value: string, term: string): boolean => {
  if (term === "entry") return /\b(entry|graduate|new grad)\b/i.test(value);
  return new RegExp(`\\b${term}\\b`, "i").test(value);
};

const getSearchSeniority = (searchQuery: string): string | null => {
  const normalized = searchQuery.toLowerCase();
  return SENIORITY_TERMS.find((term) => includesSeniority(normalized, term)) ?? null;
};

export function scoreDiscoveredJobQuality(
  job: DiscoveryJob,
  options: { searchQuery?: string | null } = {},
): JobQualityResult {
  const tags: string[] = [];
  let score = 55;

  const title = job.title?.trim() || "";
  const company = job.company?.trim() || "";
  const description = job.description?.trim() || "";
  const combined = `${title}\n${company}\n${description}`;

  if (title.length >= 6) {
    score += 6;
    tags.push("has_title");
  } else {
    score -= 16;
    tags.push("weak_title");
  }

  if (company.length >= 2 && !/^unknown|confidential|n\/a$/i.test(company)) {
    score += 10;
    tags.push("has_company");
  } else {
    score -= 18;
    tags.push("missing_company");
  }

  if (description.length >= 800) {
    score += 12;
    tags.push("rich_description");
  } else if (description.length >= 280) {
    score += 5;
    tags.push("usable_description");
  } else {
    score -= 18;
    tags.push("thin_description");
  }

  const postedAge = daysSince(job.posted_at);
  if (postedAge == null) {
    tags.push("unknown_freshness");
  } else if (postedAge <= 14) {
    score += 12;
    tags.push("fresh");
  } else if (postedAge <= 45) {
    score += 3;
    tags.push("recent");
  } else {
    score -= 16;
    tags.push("stale");
  }

  if (hasValidUrl(job.url)) {
    score += 10;
    tags.push("valid_url");
  } else {
    score -= 24;
    tags.push("invalid_url");
  }

  const sourceConfidence =
    typeof job.source_confidence === "number" ? job.source_confidence : 0;
  if (sourceConfidence >= 0.9) {
    score += 10;
    tags.push("high_source_confidence");
  } else if (sourceConfidence >= 0.7) {
    score += 4;
    tags.push("medium_source_confidence");
  } else {
    score -= 8;
    tags.push("low_source_confidence");
  }

  const hasSpamSignal = SPAM_PATTERNS.some((pattern) => pattern.test(combined));
  if (hasSpamSignal) {
    score -= 30;
    tags.push("spam_signal");
  }

  const expectedSeniority = getSearchSeniority(options.searchQuery || "");
  if (expectedSeniority) {
    const hasExpected = includesSeniority(combined, expectedSeniority);
    if (hasExpected) {
      score += 5;
      tags.push("seniority_match");
    } else if (SENIORITY_TERMS.some((term) => includesSeniority(combined, term))) {
      score -= 8;
      tags.push("seniority_mismatch");
    }
  }

  const finalScore = clamp(score);
  const strongestSignals = tags
    .filter((tag) => !tag.startsWith("has_"))
    .slice(0, 4)
    .join(", ");

  return {
    score: finalScore,
    reason:
      strongestSignals.length > 0
        ? `Quality ${finalScore}/100 based on ${strongestSignals}.`
        : `Quality ${finalScore}/100 based on basic listing completeness.`,
    tags: Array.from(new Set(tags)),
  };
}
