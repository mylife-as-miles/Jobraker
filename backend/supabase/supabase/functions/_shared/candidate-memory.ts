export interface CandidateProofPoint {
  title: string;
  evidence: string;
  metric?: string;
  tags?: string[];
}

export interface CandidateStory {
  title: string;
  situation: string;
  outcome?: string;
  relevance?: string;
}

export interface TrackedCompanySeed {
  name: string;
  careers_url?: string;
  source_hint?: string;
  domain?: string;
}

export interface CandidateMemory {
  fullName: string;
  headline: string | null;
  location: string | null;
  goals: string[];
  preferredNarratives: string[];
  redFlags: string[];
  targetArchetypes: string[];
  proofPoints: CandidateProofPoint[];
  storyBank: CandidateStory[];
  trackedCompanies: TrackedCompanySeed[];
  skillKeywords: string[];
  summaryText: string;
}

export function createEmptyCandidateMemory(
  fullName = "Candidate",
): CandidateMemory {
  return {
    fullName,
    headline: null,
    location: null,
    goals: [],
    preferredNarratives: [],
    redFlags: [],
    targetArchetypes: [],
    proofPoints: [],
    storyBank: [],
    trackedCompanies: [],
    skillKeywords: [],
    summaryText: `Candidate: ${fullName}`,
  };
}

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

const asJsonArray = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item),
  );
};

const splitDescriptionLines = (value: unknown): string[] => {
  if (typeof value !== "string") return [];
  return value
    .split(/\r?\n|[•\-]\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 20);
};

const normalizeTrackedCompanies = (value: unknown): TrackedCompanySeed[] => {
  const items = Array.isArray(value) ? value : [];
  return items
    .map((entry) => {
      if (typeof entry === "string") return { name: entry.trim() };
      if (!entry || typeof entry !== "object") return null;
      const raw = entry as Record<string, unknown>;
      const name =
        asString(raw.name) || asString(raw.company) || asString(raw.label) || asString(raw.domain);
      if (!name) return null;
      return {
        name,
        careers_url: asString(raw.careers_url) || asString(raw.careersUrl) || asString(raw.url),
        source_hint: asString(raw.source_hint) || asString(raw.sourceHint) || asString(raw.board_type),
        domain: asString(raw.domain),
      };
    })
    .filter((item): item is TrackedCompanySeed => Boolean(item));
};

const deriveProofPoints = (
  explicitProofPoints: CandidateProofPoint[],
  experiences: Record<string, unknown>[],
  parsedResume: Record<string, unknown> | null,
): CandidateProofPoint[] => {
  if (explicitProofPoints.length > 0) return explicitProofPoints.slice(0, 8);

  const derived: CandidateProofPoint[] = [];
  for (const experience of experiences.slice(0, 5)) {
    const title = asString(experience.title) || "Experience highlight";
    const company = asString(experience.company);
    const evidenceLines = splitDescriptionLines(experience.description);
    for (const line of evidenceLines.slice(0, 2)) {
      derived.push({
        title: company ? `${title} @ ${company}` : title,
        evidence: line,
      });
    }
  }

  if (derived.length > 0) return derived.slice(0, 8);

  const resumeExperience = Array.isArray(parsedResume?.experience)
    ? parsedResume?.experience
    : [];
  for (const item of resumeExperience.slice(0, 4)) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const title = asString(raw.title) || "Resume highlight";
    const company = asString(raw.company);
    const summary =
      splitDescriptionLines(raw.description)[0] ||
      asString(raw.summary) ||
      asString(raw.achievements);
    if (!summary) continue;
    derived.push({
      title: company ? `${title} @ ${company}` : title,
      evidence: summary,
    });
  }

  return derived.slice(0, 8);
};

const deriveStories = (
  explicitStories: CandidateStory[],
  experiences: Record<string, unknown>[],
  proofPoints: CandidateProofPoint[],
): CandidateStory[] => {
  if (explicitStories.length > 0) return explicitStories.slice(0, 6);

  const stories: CandidateStory[] = proofPoints.slice(0, 4).map((point) => ({
    title: point.title,
    situation: point.evidence,
    outcome: point.metric,
    relevance: point.tags?.join(", "),
  }));

  if (stories.length > 0) return stories;

  return experiences.slice(0, 4).map((experience) => ({
    title: asString(experience.title) || asString(experience.company) || "Career story",
    situation:
      splitDescriptionLines(experience.description)[0] ||
      "Demonstrated hands-on delivery in a prior role.",
    outcome: asString(experience.location) || undefined,
  }));
};

const normalizeProofPoints = (value: unknown): CandidateProofPoint[] => {
  const explicitObjects = asJsonArray(value)
    .map((item) => {
      const title = asString(item.title) || asString(item.headline);
      const evidence = asString(item.evidence) || asString(item.detail);
      if (!title || !evidence) return null;
      return {
        title,
        evidence,
        metric: asString(item.metric) || undefined,
        tags: asStringArray(item.tags),
      } satisfies CandidateProofPoint;
    })
    .filter((item): item is CandidateProofPoint => Boolean(item));

  if (explicitObjects.length > 0) return explicitObjects;

  return asStringArray(value).map((line, index) => ({
    title: `Proof point ${index + 1}`,
    evidence: line,
  }));
};

const normalizeStories = (value: unknown): CandidateStory[] =>
  asJsonArray(value)
    .map((item) => {
      const title = asString(item.title);
      const situation = asString(item.situation) || asString(item.story);
      if (!title || !situation) return null;
      return {
        title,
        situation,
        outcome: asString(item.outcome) || undefined,
        relevance: asString(item.relevance) || undefined,
      } satisfies CandidateStory;
    })
    .filter((item): item is CandidateStory => Boolean(item));

const formatCandidateMemorySummary = (memory: Omit<CandidateMemory, "summaryText">): string => {
  const lines: string[] = [];
  const pushSection = (title: string, values: string[]) => {
    if (!values.length) return;
    lines.push(`${title}:`);
    values.forEach((value) => lines.push(`- ${value}`));
  };

  if (memory.fullName) lines.push(`Candidate: ${memory.fullName}`);
  if (memory.headline) lines.push(`Headline: ${memory.headline}`);
  if (memory.location) lines.push(`Location: ${memory.location}`);
  pushSection("Goals", memory.goals);
  pushSection("Preferred narratives", memory.preferredNarratives);
  pushSection("Red flags", memory.redFlags);
  pushSection("Target archetypes", memory.targetArchetypes);

  if (memory.proofPoints.length > 0) {
    lines.push("Proof points:");
    memory.proofPoints.slice(0, 6).forEach((point) => {
      lines.push(`- ${point.title}: ${point.evidence}`);
    });
  }

  if (memory.storyBank.length > 0) {
    lines.push("Story bank:");
    memory.storyBank.slice(0, 4).forEach((story) => {
      lines.push(`- ${story.title}: ${story.situation}`);
    });
  }

  if (memory.skillKeywords.length > 0) {
    lines.push(`Core skills: ${memory.skillKeywords.slice(0, 12).join(", ")}`);
  }

  if (memory.trackedCompanies.length > 0) {
    lines.push(
      `Tracked companies: ${memory.trackedCompanies.slice(0, 10).map((c) => c.name).join(", ")}`,
    );
  }

  return lines.join("\n");
};

export async function fetchCandidateMemory(
  serviceClient: any,
  userId: string,
): Promise<CandidateMemory> {
  const [profileRes, experiencesRes, skillsRes, parsedResumeRes] = await Promise.all([
    serviceClient
      .from("profiles")
      .select(
        "first_name, last_name, job_title, location, goals, proof_points, preferred_narratives, red_flags, target_archetypes, story_bank, tracked_companies",
      )
      .eq("id", userId)
      .maybeSingle(),
    serviceClient
      .from("profile_experiences")
      .select("title, company, location, description")
      .eq("user_id", userId)
      .order("start_date", { ascending: false })
      .limit(8),
    serviceClient
      .from("profile_skills")
      .select("name")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(20),
    serviceClient
      .from("parsed_resumes")
      .select("json")
      .eq("user_id", userId)
      .order("extracted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const profile = profileRes.data ?? {};
  const parsedResume =
    parsedResumeRes.data?.json && typeof parsedResumeRes.data.json === "object"
      ? (parsedResumeRes.data.json as Record<string, unknown>)
      : null;
  const fullName =
    `${asString(profile.first_name) || ""} ${asString(profile.last_name) || ""}`.trim() ||
    "Candidate";
  const explicitProofPoints = normalizeProofPoints(profile.proof_points);
  const proofPoints = deriveProofPoints(explicitProofPoints, experiencesRes.data ?? [], parsedResume);
  const explicitStories = normalizeStories(profile.story_bank);
  const storyBank = deriveStories(explicitStories, experiencesRes.data ?? [], proofPoints);

  const skillKeywords = [
    ...new Set([
      ...((skillsRes.data ?? [])
        .map((item: Record<string, unknown>) => asString(item.name))
        .filter((item: string | null): item is string => Boolean(item))),
      ...asStringArray(parsedResume?.skills),
    ]),
  ];

  const memoryWithoutSummary: Omit<CandidateMemory, "summaryText"> = {
    fullName,
    headline: asString(profile.job_title) || asString(parsedResume?.summary) || null,
    location: asString(profile.location),
    goals: asStringArray(profile.goals),
    preferredNarratives: asStringArray(profile.preferred_narratives),
    redFlags: asStringArray(profile.red_flags),
    targetArchetypes: asStringArray(profile.target_archetypes),
    proofPoints,
    storyBank,
    trackedCompanies: normalizeTrackedCompanies(profile.tracked_companies),
    skillKeywords,
  };

  return {
    ...memoryWithoutSummary,
    summaryText: formatCandidateMemorySummary(memoryWithoutSummary),
  };
}

export function formatCandidateMemoryForPrompt(memory: CandidateMemory): string {
  return memory.summaryText;
}
