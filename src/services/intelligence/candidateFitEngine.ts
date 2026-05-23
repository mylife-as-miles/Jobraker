import type {
  CandidateProfileInput,
  JobIntelligenceJobInput,
  MatchBlocker,
  MissingSignal,
  ProfileEvidenceMatch,
  RankingReason,
  ScoreCap,
} from "./types";
import {
  clampScore,
  compactText,
  isExpired,
  normalizeText,
  reason,
  sentenceFragments,
  tokenize,
  unique,
} from "./textUtils";

export type CandidateFitResult = {
  score: number;
  reasons: RankingReason[];
  caps: ScoreCap[];
  blockers: MatchBlocker[];
  missingSignals: MissingSignal[];
  supportingEvidence: ProfileEvidenceMatch[];
};

type SeniorityLevel =
  | "intern"
  | "junior"
  | "mid"
  | "senior"
  | "staff"
  | "executive"
  | "unknown";

type SkillDefinition = {
  canonical: string;
  aliases: string[];
};

const SENIORITY_ORDER: Record<SeniorityLevel, number> = {
  intern: 0,
  junior: 1,
  mid: 2,
  senior: 3,
  staff: 4,
  executive: 5,
  unknown: 2,
};

const REQUIRED_PATTERNS = [
  /must have/i,
  /required/i,
  /requirements?/i,
  /minimum/i,
  /need(?:ed|s)?/i,
  /proficient/i,
  /strong experience/i,
  /experience (?:with|in)/i,
];

const NICE_TO_HAVE_PATTERNS = [
  /nice to have/i,
  /preferred/i,
  /bonus/i,
  /plus/i,
  /familiarity/i,
];

const SKILLS: SkillDefinition[] = [
  { canonical: "React", aliases: ["react", "react.js", "reactjs"] },
  { canonical: "TypeScript", aliases: ["typescript", "ts"] },
  { canonical: "JavaScript", aliases: ["javascript", "js", "ecmascript"] },
  { canonical: "Node.js", aliases: ["node", "node.js", "nodejs"] },
  { canonical: "Next.js", aliases: ["next", "next.js", "nextjs"] },
  { canonical: "Supabase", aliases: ["supabase"] },
  { canonical: "PostgreSQL", aliases: ["postgres", "postgresql"] },
  { canonical: "SQL", aliases: ["sql"] },
  { canonical: "Python", aliases: ["python"] },
  { canonical: "Django", aliases: ["django"] },
  { canonical: "FastAPI", aliases: ["fastapi"] },
  { canonical: "Go", aliases: ["golang", "go"] },
  { canonical: "Kubernetes", aliases: ["kubernetes", "k8s"] },
  { canonical: "Docker", aliases: ["docker", "container"] },
  { canonical: "AWS", aliases: ["aws", "amazon web services"] },
  { canonical: "GCP", aliases: ["gcp", "google cloud"] },
  { canonical: "Azure", aliases: ["azure"] },
  { canonical: "GraphQL", aliases: ["graphql"] },
  { canonical: "REST", aliases: ["rest", "rest api", "restful"] },
  { canonical: "Tailwind CSS", aliases: ["tailwind", "tailwind css"] },
  { canonical: "Vue", aliases: ["vue", "vue.js"] },
  { canonical: "Angular", aliases: ["angular"] },
  { canonical: "React Native", aliases: ["react native"] },
  { canonical: "Flutter", aliases: ["flutter"] },
  { canonical: "Terraform", aliases: ["terraform"] },
  { canonical: "CI/CD", aliases: ["ci/cd", "cicd", "continuous integration"] },
  { canonical: "GitHub Actions", aliases: ["github actions"] },
  { canonical: "Stripe", aliases: ["stripe"] },
  { canonical: "AI", aliases: ["ai", "artificial intelligence"] },
  { canonical: "LLM", aliases: ["llm", "large language model", "gpt", "gemini"] },
  { canonical: "RAG", aliases: ["rag", "retrieval augmented generation"] },
  { canonical: "Vector Search", aliases: ["vector search", "embedding", "embeddings", "pgvector"] },
  { canonical: "MongoDB", aliases: ["mongodb", "mongo"] },
  { canonical: "Redis", aliases: ["redis"] },
  { canonical: "Product Management", aliases: ["product management", "roadmap", "product manager"] },
  { canonical: "Growth", aliases: ["growth", "growth marketing"] },
  { canonical: "Analytics", aliases: ["analytics", "bi", "business intelligence"] },
];

const skillAliasLookup = new Map(
  SKILLS.flatMap((skill) =>
    skill.aliases.map((alias) => [normalizeText(alias), skill.canonical] as const),
  ),
);

const aliasPattern = (alias: string): RegExp => {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9+#.])${escaped}([^a-z0-9+#.]|$)`, "i");
};

export const extractKnownSkills = (text?: string | null): string[] => {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  const found: string[] = [];
  for (const skill of SKILLS) {
    if (skill.aliases.some((alias) => aliasPattern(normalizeText(alias)).test(normalized))) {
      found.push(skill.canonical);
    }
  }
  return unique(found);
};

const canonicalSkillName = (skill: string): string => {
  const normalized = normalizeText(skill);
  return skillAliasLookup.get(normalized) ?? compactText(skill);
};

const candidateSkillSet = (profile: CandidateProfileInput): Set<string> => {
  const explicitSkills = (profile.skills ?? [])
    .map((skill) => canonicalSkillName(skill.name))
    .filter(Boolean);
  const experienceSkills = extractKnownSkills(
    (profile.experiences ?? [])
      .map((experience) =>
        [
          experience.title,
          experience.company,
          experience.description,
        ].filter(Boolean).join(" "),
      )
      .join("\n"),
  );
  const proofPointText = Array.isArray(profile.proofPoints)
    ? profile.proofPoints
        .map((point) =>
          typeof point === "string"
            ? point
            : [point.title, point.evidence, point.metric, ...(point.tags ?? [])]
                .filter(Boolean)
                .join(" "),
        )
        .join("\n")
    : "";
  const proofPointSkills = extractKnownSkills(proofPointText);
  const resumeSkills = extractKnownSkills(profile.resumeText);
  return new Set(unique([...explicitSkills, ...experienceSkills, ...proofPointSkills, ...resumeSkills]));
};

const jobSkillRequirements = (job: JobIntelligenceJobInput) => {
  const titleAndTags = [
    job.title,
    ...(Array.isArray(job.raw_data?.tags) ? (job.raw_data.tags as string[]) : []),
    ...(((job.raw_data?.scraped_data as Record<string, unknown> | undefined)?.tags as string[] | undefined) ?? []),
  ]
    .filter(Boolean)
    .join(" ");
  const fragments = sentenceFragments(job.description);
  const allSkills = unique([
    ...extractKnownSkills(titleAndTags),
    ...extractKnownSkills(job.description),
  ]);
  const required = unique(
    fragments
      .filter((fragment) => REQUIRED_PATTERNS.some((pattern) => pattern.test(fragment)))
      .flatMap(extractKnownSkills),
  );
  const niceToHave = unique(
    fragments
      .filter((fragment) => NICE_TO_HAVE_PATTERNS.some((pattern) => pattern.test(fragment)))
      .flatMap(extractKnownSkills),
  ).filter((skill) => !required.includes(skill));

  return {
    allSkills,
    requiredSkills: required.length > 0 ? required : allSkills.slice(0, 6),
    explicitRequiredSkills: required,
    niceToHaveSkills: niceToHave,
  };
};

const detectSeniority = (value?: string | null, years?: number | null): SeniorityLevel => {
  const normalized = normalizeText(value);
  if (/\b(intern|internship)\b/.test(normalized)) return "intern";
  if (/\b(junior|entry|graduate|new grad|associate)\b/.test(normalized)) return "junior";
  if (/\b(staff|principal|architect)\b/.test(normalized)) return "staff";
  if (/\b(director|head of|vp|chief|cto|executive)\b/.test(normalized)) return "executive";
  if (/\b(senior|sr\.?|lead)\b/.test(normalized)) return "senior";
  if (/\b(mid|intermediate)\b/.test(normalized)) return "mid";
  if (typeof years === "number") {
    if (years <= 1) return "junior";
    if (years <= 4) return "mid";
    if (years <= 8) return "senior";
    return "staff";
  }
  return "unknown";
};

const extractRequiredYears = (job: JobIntelligenceJobInput): number | null => {
  const text = `${job.experience_level ?? ""}\n${job.description ?? ""}`;
  const matches = [...text.matchAll(/(\d{1,2})\+?\s*(?:years|yrs)(?:\s+of)?\s+experience/gi)];
  if (!matches.length) return null;
  return Math.max(...matches.map((match) => Number(match[1])).filter(Number.isFinite));
};

const overlapRatio = (candidate: Set<string>, required: string[]): number => {
  if (!required.length) return 1;
  const matched = required.filter((skill) => candidate.has(skill)).length;
  return matched / required.length;
};

const titleOverlap = (job: JobIntelligenceJobInput, profile: CandidateProfileInput): number => {
  const jobTokens = new Set(tokenize(job.title));
  const targetTokens = new Set(
    tokenize(
      [profile.targetTitle, profile.searchQuery, ...(profile.goals ?? [])]
        .filter(Boolean)
        .join(" "),
    ).filter((token) => !["remote", "role", "job"].includes(token)),
  );
  if (!jobTokens.size || !targetTokens.size) return 0.45;
  let overlap = 0;
  for (const token of targetTokens) {
    if (jobTokens.has(token)) overlap += 1;
  }
  return Math.min(1, overlap / Math.min(jobTokens.size, targetTokens.size));
};

const locationCompatibility = (job: JobIntelligenceJobInput, profile: CandidateProfileInput) => {
  const jobLocation = normalizeText(`${job.location ?? ""} ${job.remote_type ?? ""}`);
  const profileLocation = normalizeText(profile.location);
  const scope = normalizeText(profile.locationScope);
  const remoteOk = /\b(remote|anywhere|global|worldwide)\b/.test(jobLocation);
  if (remoteOk || scope === "global") {
    return { score: 10, impossible: false, detail: "Remote/global-compatible location signal found." };
  }
  if (!jobLocation || !profileLocation) {
    return { score: 5, impossible: false, detail: "Location compatibility is unknown." };
  }
  if (jobLocation.includes(profileLocation) || profileLocation.includes(jobLocation)) {
    return { score: 10, impossible: false, detail: "Job location overlaps with the candidate location." };
  }
  const onsite = /\b(onsite|on-site|office|hybrid)\b/.test(jobLocation);
  if (onsite && scope !== "country" && scope !== "global") {
    return { score: 0, impossible: true, detail: "The job appears location-bound and does not match the candidate location." };
  }
  return { score: 4, impossible: false, detail: "Location may require more research." };
};

const makeEvidenceMatches = (
  matchedSkills: string[],
  profile: CandidateProfileInput,
): ProfileEvidenceMatch[] => {
  const skillLevel = new Map(
    (profile.skills ?? []).map((skill) => [canonicalSkillName(skill.name), skill.level]),
  );
  const experienceText = (profile.experiences ?? [])
    .map((experience) => [experience.title, experience.company, experience.description].filter(Boolean).join(" "))
    .join("\n");

  return matchedSkills.map((skill) => {
    const level = skillLevel.get(skill);
    const inExperience = extractKnownSkills(experienceText).includes(skill);
    return {
      id: `skill-evidence-${normalizeText(skill).replace(/\s+/g, "-")}`,
      skill,
      requirement: skill,
      evidenceText: inExperience
        ? `${skill} appears in profile experience evidence.`
        : level
          ? `${skill} is listed as a ${level} profile skill.`
          : `${skill} appears in candidate profile signals.`,
      evidenceSource: inExperience ? "profile_experience" : "profile_skill",
      confidence: level === "Expert" || inExperience ? 90 : level === "Advanced" ? 82 : 68,
    };
  });
};

export function scoreCandidateFit(
  job: JobIntelligenceJobInput,
  profile: CandidateProfileInput,
): CandidateFitResult {
  const reasons: RankingReason[] = [];
  const caps: ScoreCap[] = [];
  const blockers: MatchBlocker[] = [];
  const missingSignals: MissingSignal[] = [];
  const candidateSkills = candidateSkillSet(profile);
  const requirements = jobSkillRequirements(job);
  const matchedRequired = requirements.requiredSkills.filter((skill) =>
    candidateSkills.has(skill),
  );
  const missingRequired = requirements.requiredSkills.filter(
    (skill) => !candidateSkills.has(skill),
  );
  const matchedAll = requirements.allSkills.filter((skill) => candidateSkills.has(skill));
  const roleScore = Math.round(titleOverlap(job, profile) * 20);
  const allSkillCoverage = overlapRatio(candidateSkills, requirements.allSkills);
  const requiredCoverage = overlapRatio(candidateSkills, requirements.requiredSkills);
  const skillsScore = Math.round(allSkillCoverage * 30);
  const requiredScore = Math.round(requiredCoverage * 20);
  const candidateSeniority = detectSeniority(
    [profile.targetTitle, profile.searchQuery].filter(Boolean).join(" "),
    profile.experienceYears,
  );
  const jobSeniority = detectSeniority(
    [job.title, job.experience_level, job.description].filter(Boolean).join(" "),
  );
  const seniorityGap =
    SENIORITY_ORDER[jobSeniority] - SENIORITY_ORDER[candidateSeniority];
  const requiredYears = extractRequiredYears(job);
  let seniorityScore = 12;
  if (jobSeniority === "unknown" || candidateSeniority === "unknown") {
    seniorityScore = 9;
  } else if (seniorityGap <= 0) {
    seniorityScore = 15;
  } else if (seniorityGap === 1) {
    seniorityScore = 8;
  } else {
    seniorityScore = 3;
  }

  const location = locationCompatibility(job, profile);
  const salaryScore =
    typeof job.salary_min === "number" || typeof job.salary_max === "number" ? 5 : 2;

  reasons.push(
    reason(
      "role-title-fit",
      "candidate_fit",
      roleScore >= 12 ? "positive" : "negative",
      roleScore >= 12 ? "Role title aligns" : "Role title is only a partial match",
      roleScore >= 12
        ? "The job title overlaps with the candidate target role/search intent."
        : "The title does not strongly overlap with the candidate target role.",
      { scoreDelta: roleScore },
    ),
    reason(
      "skill-coverage",
      "candidate_fit",
      requiredCoverage >= 0.7 ? "positive" : "negative",
      requiredCoverage >= 0.7 ? "Required skills are covered" : "Required skill coverage is weak",
      requirements.requiredSkills.length
        ? `${matchedRequired.length}/${requirements.requiredSkills.length} required skill signals are supported.`
        : "No explicit skill requirements were detected.",
      {
        scoreDelta: skillsScore + requiredScore,
        evidence: matchedRequired,
      },
    ),
    reason(
      "seniority-fit",
      "seniority",
      seniorityGap <= 0 ? "positive" : seniorityGap === 1 ? "neutral" : "negative",
      seniorityGap <= 0 ? "Seniority fits" : "Seniority may be a stretch",
      `Detected job seniority: ${jobSeniority}; candidate seniority: ${candidateSeniority}.`,
      { scoreDelta: seniorityScore },
    ),
    reason(
      "location-fit",
      "location",
      location.impossible ? "negative" : location.score >= 8 ? "positive" : "neutral",
      location.impossible ? "Location may block this job" : "Location is workable",
      location.detail,
      { scoreDelta: location.score },
    ),
  );

  if (requirements.allSkills.length === 0) {
    missingSignals.push({
      id: "job-skills-unclear",
      category: "candidate_fit",
      title: "Skills are not clear in the posting",
      detail: "The job description did not expose enough structured skill signals.",
      importance: "medium",
      evidenceNeeded: ["Clear required skills from the posting"],
    });
  }

  if (candidateSkills.size === 0) {
    missingSignals.push({
      id: "candidate-skills-missing",
      category: "profile_evidence",
      title: "Candidate skill profile is empty",
      detail: "Add profile skills or parsed resume evidence to improve fit scoring.",
      importance: "high",
      evidenceNeeded: ["Profile skills", "Parsed resume skills", "Project evidence"],
    });
  }

  for (const skill of missingRequired.slice(0, 6)) {
    missingSignals.push({
      id: `missing-required-${normalizeText(skill).replace(/\s+/g, "-")}`,
      category: "candidate_fit",
      title: `Missing evidence for ${skill}`,
      detail: `${skill} appears in the job requirements but was not found in candidate evidence.`,
      importance: requirements.explicitRequiredSkills.includes(skill) ? "critical" : "high",
      evidenceNeeded: [`Project, work, or resume evidence for ${skill}`],
    });
  }

  if (requirements.explicitRequiredSkills.length > 0 && requiredCoverage < 0.6) {
    caps.push({
      id: "missing-required-skill-cap",
      category: "candidate_fit",
      maxScore: 75,
      applied: true,
      reason: "One or more explicit required skills lacks candidate evidence.",
    });
    blockers.push({
      id: "missing-required-skill",
      severity: "high",
      title: "Required skill evidence is missing",
      detail: `Missing: ${missingRequired.slice(0, 4).join(", ") || "required skills"}.`,
      canImprove: true,
    });
  }

  if (seniorityGap >= 2) {
    caps.push({
      id: "severe-seniority-mismatch-cap",
      category: "seniority",
      maxScore: 65,
      applied: true,
      reason: "The job seniority appears materially above the candidate target level.",
    });
    blockers.push({
      id: "seniority-mismatch",
      severity: "high",
      title: "Seniority mismatch",
      detail: `The role reads as ${jobSeniority}, while the candidate profile reads as ${candidateSeniority}.`,
      canImprove: false,
    });
  }

  if (
    typeof requiredYears === "number" &&
    typeof profile.experienceYears === "number" &&
    requiredYears >= 5 &&
    profile.experienceYears + 1 < requiredYears
  ) {
    caps.push({
      id: "years-experience-cap",
      category: "seniority",
      maxScore: 65,
      applied: true,
      reason: `The job asks for ${requiredYears}+ years and the profile shows ${profile.experienceYears}.`,
    });
  }

  if (location.impossible) {
    caps.push({
      id: "location-impossible-cap",
      category: "location",
      maxScore: 50,
      applied: true,
      reason: "The job appears location-bound and incompatible with the candidate location.",
    });
    blockers.push({
      id: "location-blocker",
      severity: "critical",
      title: "Location blocker",
      detail: location.detail,
      canImprove: false,
    });
  }

  if (isExpired(job.expires_at)) {
    caps.push({
      id: "expired-fit-cap",
      category: "freshness",
      maxScore: 20,
      applied: true,
      reason: "Expired jobs cannot be a strong fit until verified open.",
    });
  }

  const uncappedScore =
    roleScore + skillsScore + requiredScore + seniorityScore + location.score + salaryScore;
  const cappedScore = caps
    .filter((cap) => cap.applied)
    .reduce((next, cap) => Math.min(next, cap.maxScore), uncappedScore);

  return {
    score: clampScore(cappedScore),
    reasons,
    caps,
    blockers,
    missingSignals,
    supportingEvidence: makeEvidenceMatches(matchedAll, profile),
  };
}
