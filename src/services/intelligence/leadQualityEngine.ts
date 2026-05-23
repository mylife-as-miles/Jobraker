import type {
  JobIntelligenceJobInput,
  MatchBlocker,
  RankingReason,
  ScoreCap,
} from "./types";
import type { JobDuplicateResult } from "./jobDedupeEngine";
import {
  clampScore,
  compactText,
  daysSince,
  getUrlHost,
  hasValidHttpUrl,
  isExpired,
  normalizeText,
  reason,
  textIncludesAny,
} from "./textUtils";

export type LeadQualityResult = {
  score: number;
  reasons: RankingReason[];
  caps: ScoreCap[];
  warnings: MatchBlocker[];
};

type LeadQualityOptions = {
  duplicate?: JobDuplicateResult;
};

const TRUSTED_ATS_HOSTS = [
  "greenhouse.io",
  "lever.co",
  "ashbyhq.com",
  "workdayjobs.com",
  "myworkdayjobs.com",
  "workable.com",
  "smartrecruiters.com",
  "icims.com",
  "bamboohr.com",
  "comeet.com",
  "boards.greenhouse.io",
];

const TRUSTED_SOURCE_TYPES = new Set([
  "ats",
  "company_board",
  "api",
  "greenhouse",
  "lever",
  "ashby",
  "workday",
]);

const SUSPICIOUS_HOST_PATTERNS = [
  /bit\.ly$/,
  /tinyurl\.com$/,
  /t\.me$/,
  /telegram/i,
  /whatsapp/i,
];

const SPAM_PATTERNS = [
  /no experience needed/i,
  /earn money fast/i,
  /work from home today/i,
  /commission only/i,
  /telegram|whatsapp/i,
  /upfront fee|training fee/i,
  /crypto wallet/i,
  /send money/i,
];

const hasSalarySignal = (job: JobIntelligenceJobInput): boolean => {
  if (typeof job.salary_min === "number" || typeof job.salary_max === "number") {
    return true;
  }
  const rawSalary = (job.raw_data?.salary ||
    (job.raw_data?.scraped_data as Record<string, unknown> | undefined)?.salary ||
    job.raw_data?.salaryRange) as unknown;
  return typeof rawSalary === "string" && rawSalary.trim().length > 0;
};

const hasCredibleCompany = (job: JobIntelligenceJobInput): boolean => {
  const company = compactText(job.company);
  return company.length >= 2 && !/^unknown|confidential|n\/a|stealth$/i.test(company);
};

const hasCompanyMetadata = (job: JobIntelligenceJobInput): boolean =>
  Boolean(
    compactText(job.company_logo) ||
      job.is_tracked_company ||
      compactText((job.raw_data?.companyWebsite as string | undefined) ?? null),
  );

const scoreSourceTrust = (job: JobIntelligenceJobInput): number => {
  const sourceType = normalizeText(job.source_type || job.source_kind);
  const host = getUrlHost(job.apply_url);
  const confidence =
    typeof job.source_confidence === "number" ? job.source_confidence : null;

  if (
    (sourceType && TRUSTED_SOURCE_TYPES.has(sourceType)) ||
    (host && TRUSTED_ATS_HOSTS.some((trusted) => host.endsWith(trusted)))
  ) {
    return 20;
  }
  if (confidence != null && confidence >= 0.9) return 18;
  if (confidence != null && confidence >= 0.7) return 14;
  if (host) return 10;
  if (sourceType) return 8;
  return 3;
};

const freshnessScore = (job: JobIntelligenceJobInput): number => {
  const age =
    daysSince(job.posted_at) ??
    daysSince(job.discovered_at) ??
    daysSince(job.created_at);
  if (age == null) return 7;
  if (age <= 7) return 15;
  if (age <= 14) return 12;
  if (age <= 30) return 8;
  if (age <= 45) return 4;
  return 0;
};

const descriptionQualityScore = (description: string): number => {
  if (description.length >= 800) return 15;
  if (description.length >= 300) return 10;
  if (description.length >= 120) return 5;
  return 0;
};

const applyCaps = (score: number, caps: ScoreCap[]): number =>
  caps.filter((cap) => cap.applied).reduce((next, cap) => Math.min(next, cap.maxScore), score);

export function scoreLeadQuality(
  job: JobIntelligenceJobInput,
  options: LeadQualityOptions = {},
): LeadQualityResult {
  const reasons: RankingReason[] = [];
  const caps: ScoreCap[] = [];
  const warnings: MatchBlocker[] = [];
  const description = compactText(job.description);
  const combined = `${job.title ?? ""}\n${job.company ?? ""}\n${description}`;
  const host = getUrlHost(job.apply_url);
  let score = 0;

  const sourceScore = scoreSourceTrust(job);
  score += sourceScore;
  reasons.push(
    reason(
      "source-trust",
      "source",
      sourceScore >= 14 ? "positive" : "negative",
      sourceScore >= 14 ? "Trusted source signal" : "Weak source signal",
      sourceScore >= 14
        ? "This role appears to come from a credible ATS, company board, or high-confidence source."
        : "The source has limited trust metadata, so the lead needs more scrutiny.",
      { scoreDelta: sourceScore, evidence: [host || job.source_kind || job.source_type || "unknown source"] },
    ),
  );

  const freshScore = freshnessScore(job);
  score += freshScore;
  const age =
    daysSince(job.posted_at) ??
    daysSince(job.discovered_at) ??
    daysSince(job.created_at);
  reasons.push(
    reason(
      "freshness",
      "freshness",
      freshScore >= 8 ? "positive" : "negative",
      freshScore >= 8 ? "Fresh or recent posting" : "Stale or unknown freshness",
      age == null
        ? "No reliable posting date was available."
        : `This job is about ${Math.max(0, age)} day${age === 1 ? "" : "s"} old.`,
      { scoreDelta: freshScore },
    ),
  );

  const descriptionScore = descriptionQualityScore(description);
  score += descriptionScore;
  reasons.push(
    reason(
      "description-quality",
      "lead_quality",
      descriptionScore >= 10 ? "positive" : "negative",
      descriptionScore >= 10 ? "Clear role description" : "Thin role description",
      descriptionScore >= 10
        ? "The posting has enough detail to evaluate responsibilities and requirements."
        : "The posting is too thin or vague to trust fully.",
      { scoreDelta: descriptionScore },
    ),
  );

  if (compactText(job.location) || compactText(job.remote_type)) {
    score += 10;
    reasons.push(
      reason(
        "location-clarity",
        "location",
        "positive",
        "Location policy is visible",
        "The listing gives at least one location or remote-work signal.",
        { scoreDelta: 10 },
      ),
    );
  } else {
    reasons.push(
      reason(
        "location-unclear",
        "location",
        "negative",
        "Location policy is unclear",
        "No location or remote policy was found in the job record.",
        { scoreDelta: 0 },
      ),
    );
  }

  if (hasSalarySignal(job)) {
    score += 10;
    reasons.push(
      reason(
        "salary-visible",
        "salary",
        "positive",
        "Salary signal is listed",
        "Compensation transparency improves lead quality.",
        { scoreDelta: 10 },
      ),
    );
  } else {
    reasons.push(
      reason(
        "salary-missing",
        "salary",
        "neutral",
        "Salary not listed",
        "No salary range was found; this does not block the lead but weakens confidence.",
      ),
    );
  }

  if (hasCredibleCompany(job)) {
    const companyScore = hasCompanyMetadata(job) ? 10 : 7;
    score += companyScore;
    reasons.push(
      reason(
        "company-credible",
        "lead_quality",
        "positive",
        "Company identity is credible",
        hasCompanyMetadata(job)
          ? "The company has identifying metadata or is tracked."
          : "The company name is present and usable.",
        { scoreDelta: companyScore, evidence: [compactText(job.company)] },
      ),
    );
  } else {
    warnings.push({
      id: "missing-company",
      severity: "high",
      title: "Company identity is weak",
      detail: "The posting does not provide a credible company identity.",
      canImprove: false,
    });
    reasons.push(
      reason(
        "company-missing",
        "lead_quality",
        "negative",
        "No credible company identity",
        "Missing or anonymous company data makes this lead less trustworthy.",
        { scoreDelta: -20 },
      ),
    );
  }

  if (hasValidHttpUrl(job.apply_url)) {
    score += 5;
    reasons.push(
      reason(
        "application-url",
        "lead_quality",
        "positive",
        "Application path is available",
        "The job has a valid application URL.",
        { scoreDelta: 5 },
      ),
    );
  } else {
    warnings.push({
      id: "missing-apply-url",
      severity: "medium",
      title: "No reliable apply URL",
      detail: "The user may need to verify the application path before investing time.",
      canImprove: false,
    });
  }

  const duplicate = options.duplicate;
  if (duplicate?.isDuplicate) {
    reasons.push(...duplicate.reasons);
    caps.push(...duplicate.caps);
    warnings.push({
      id: "duplicate-suspicion",
      severity: "medium",
      title: "Duplicate or repost suspicion",
      detail: "This role appears to overlap with another saved job lead.",
      canImprove: false,
    });
  } else {
    score += 10;
    reasons.push(
      reason(
        "not-duplicate",
        "dedupe",
        "positive",
        "No duplicate found",
        "No exact duplicate URL, source ID, or same company/title duplicate was detected.",
        { scoreDelta: 10 },
      ),
    );
  }

  const spamSignal = textIncludesAny(combined, SPAM_PATTERNS);
  if (!spamSignal) {
    score += 5;
    reasons.push(
      reason(
        "no-spam-signals",
        "source",
        "positive",
        "No obvious spam signals",
        "The posting does not contain common scam or spam language.",
        { scoreDelta: 5 },
      ),
    );
  } else {
    caps.push({
      id: "spam-source-cap",
      category: "source",
      maxScore: 30,
      applied: true,
      reason: "Suspicious scam or spam language was detected in the posting.",
    });
    warnings.push({
      id: "spam-source-warning",
      severity: "critical",
      title: "Suspicious source signals",
      detail: "The job contains language commonly associated with scams or spam.",
      canImprove: false,
    });
    reasons.push(
      reason(
        "spam-source",
        "source",
        "cap",
        "Suspicious posting language",
        "Hard cap applied because the job contains scam or spam signals.",
      ),
    );
  }

  if (isExpired(job.expires_at)) {
    caps.push({
      id: "expired-job-cap",
      category: "freshness",
      maxScore: 20,
      applied: true,
      reason: "The job appears to be expired or closed.",
    });
    reasons.push(
      reason(
        "expired-job",
        "freshness",
        "cap",
        "Expired job",
        "The opportunity is capped because the expiration date is in the past.",
      ),
    );
  } else if (age != null && age > 45) {
    caps.push({
      id: "stale-job-cap",
      category: "freshness",
      maxScore: 60,
      applied: true,
      reason: "The job is older than 45 days and may no longer be active.",
    });
  }

  if (
    host &&
    SUSPICIOUS_HOST_PATTERNS.some((pattern) => pattern.test(host)) &&
    sourceScore < 14
  ) {
    caps.push({
      id: "suspicious-source-cap",
      category: "source",
      maxScore: 30,
      applied: true,
      reason: "The source host looks suspicious and has weak trust metadata.",
    });
  }

  const finalScore = clampScore(applyCaps(score, caps));
  return {
    score: finalScore,
    reasons,
    caps,
    warnings,
  };
}
