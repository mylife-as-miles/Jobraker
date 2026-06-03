import {
  createGeminiClient,
  createGeminiConfig,
  extractGeminiText,
  withGeminiRetry,
  withModelFallback,
} from "./gemini.ts";
import { parseStructuredJson } from "./structured-json.ts";
import {
  CandidateMemory,
  fetchCandidateMemory,
  formatCandidateMemoryForPrompt,
} from "./candidate-memory.ts";

export type AnswerTheme =
  | "identity"
  | "beliefs"
  | "stories"
  | "career"
  | "skills"
  | "voice";

export interface AnswerBankEntryRecord {
  id: string;
  user_id: string;
  theme: AnswerTheme;
  slug: string;
  question: string;
  tags: string[];
  body: string;
  created_at: string;
  updated_at: string;
}

export interface AnswerBankEntryInput {
  theme: AnswerTheme;
  slug?: string | null;
  question: string;
  tags?: string[] | null;
  body: string;
}

interface GenerateAnswerBankOptions {
  themes?: AnswerTheme[];
  limit?: number;
}

interface UpsertAnswerBankOptions {
  replaceExisting?: boolean;
}

export const ALL_THEMES: AnswerTheme[] = [
  "identity",
  "beliefs",
  "stories",
  "career",
  "skills",
  "voice",
];

const THEME_LABELS: Record<AnswerTheme, string> = {
  identity: "Identity",
  beliefs: "Beliefs",
  stories: "Stories",
  career: "Career",
  skills: "Skills",
  voice: "Voice",
};

const DEFAULT_ENTRY_LIMIT = 12;
const MAX_ENTRY_LIMIT = 18;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

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

const uniqueStrings = (values: Array<string | null | undefined>) =>
  [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.floor(value)));

function normalizeTheme(value: unknown): AnswerTheme | null {
  const normalized = asString(value)?.toLowerCase();
  return ALL_THEMES.includes(normalized as AnswerTheme)
    ? (normalized as AnswerTheme)
    : null;
}

export function normalizeAnswerBankSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function truncate(value: string | null | undefined, max: number): string {
  if (!value) return "";
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

function normalizeTags(tags: unknown): string[] {
  const values = Array.isArray(tags) ? tags : [];
  return [...new Set(
    values
      .map((tag) => asString(tag)?.toLowerCase())
      .filter((tag): tag is string => Boolean(tag))
      .slice(0, 8),
  )];
}

function sanitizeEntry(
  entry: Partial<AnswerBankEntryInput> | null | undefined,
  usedSlugs: Set<string>,
): AnswerBankEntryInput | null {
  const theme = normalizeTheme(entry?.theme);
  const question = asString(entry?.question);
  const body = asString(entry?.body);
  if (!theme || !question || !body) return null;

  const baseSlug = normalizeAnswerBankSlug(
    asString(entry?.slug) || question || `${theme}-entry`,
  );
  if (!baseSlug) return null;

  let slug = baseSlug;
  let suffix = 2;
  while (usedSlugs.has(`${theme}:${slug}`)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
  usedSlugs.add(`${theme}:${slug}`);

  return {
    theme,
    slug,
    question: truncate(question, 140),
    body: truncate(body, 4000),
    tags: normalizeTags(entry?.tags),
  };
}

function buildVoiceFallback(memory: CandidateMemory) {
  const parts = uniqueStrings([
    memory.preferredNarratives[0] || null,
    memory.headline ? `I write as ${memory.headline}.` : null,
    memory.location ? `My answers should feel grounded and direct, not generic.` : null,
  ]);
  return parts.length > 0
    ? parts.join(" ")
    : "I write in a concise, clear, credible voice. I prefer concrete examples, direct sentences, and natural language over buzzwords.";
}

function buildDeterministicEntries(memory: CandidateMemory): AnswerBankEntryInput[] {
  const entries: AnswerBankEntryInput[] = [];

  const identityFacts = uniqueStrings([
    memory.fullName !== "Candidate" ? `Full name: ${memory.fullName}` : null,
    memory.location ? `Location: ${memory.location}` : null,
    memory.headline ? `Current focus: ${memory.headline}` : null,
  ]);
  if (identityFacts.length > 0) {
    entries.push({
      theme: "identity",
      slug: "candidate-basics",
      question: "Candidate basics",
      tags: ["identity", "profile"],
      body: identityFacts.join("\n"),
    });
  }

  if (memory.preferredNarratives.length > 0 || memory.redFlags.length > 0) {
    const beliefLines = [
      ...memory.preferredNarratives.slice(0, 4).map((item) => `I value: ${item}`),
      ...memory.redFlags.slice(0, 3).map((item) => `I avoid: ${item}`),
    ];
    entries.push({
      theme: "beliefs",
      slug: "working-principles",
      question: "How I like to work",
      tags: ["beliefs", "work-style"],
      body: beliefLines.join("\n"),
    });
  }

  memory.storyBank.slice(0, 3).forEach((story, index) => {
    const lines = uniqueStrings([
      story.situation,
      story.outcome ? `Outcome: ${story.outcome}` : null,
      story.relevance ? `Relevance: ${story.relevance}` : null,
    ]);
    if (!lines.length) return;
    entries.push({
      theme: "stories",
      slug: normalizeAnswerBankSlug(story.title || `story-${index + 1}`),
      question: story.title || `Career story ${index + 1}`,
      tags: ["story", "experience"],
      body: lines.join("\n"),
    });
  });

  const careerLines = [
    ...memory.goals.slice(0, 4).map((goal) => `Goal: ${goal}`),
    ...memory.targetArchetypes.slice(0, 4).map((item) => `Target role: ${item}`),
  ];
  if (careerLines.length > 0) {
    entries.push({
      theme: "career",
      slug: "career-direction",
      question: "What I want next",
      tags: ["career", "goals"],
      body: careerLines.join("\n"),
    });
  }

  if (memory.skillKeywords.length > 0) {
    entries.push({
      theme: "skills",
      slug: "core-skills",
      question: "Core skills and tools",
      tags: ["skills", "stack"],
      body: memory.skillKeywords.slice(0, 20).join(", "),
    });
  }

  entries.push({
    theme: "voice",
    slug: "writing-voice",
    question: "My writing voice",
    tags: ["voice", "tone"],
    body: buildVoiceFallback(memory),
  });

  return entries;
}

async function loadAnswerBankContext(serviceClient: any, userId: string) {
  const [memory, profileRes, parsedResumeRes, coverLettersRes] = await Promise.all([
    fetchCandidateMemory(serviceClient, userId),
    serviceClient
      .from("profiles")
      .select(
        "first_name, last_name, job_title, location, goals, about, preferred_narratives, red_flags, target_archetypes",
      )
      .eq("id", userId)
      .maybeSingle(),
    serviceClient
      .from("parsed_resumes")
      .select("raw_text, json")
      .eq("user_id", userId)
      .order("extracted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    serviceClient
      .from("cover_letters")
      .select("name, role, company, content")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(3),
  ]);

  return {
    memory,
    profile: profileRes.data ?? null,
    parsedResume: parsedResumeRes.data ?? null,
    coverLetters: Array.isArray(coverLettersRes.data) ? coverLettersRes.data : [],
  };
}

function buildGenerationPrompt(
  context: Awaited<ReturnType<typeof loadAnswerBankContext>>,
  themes: AnswerTheme[],
  limit: number,
) {
  const coverLetterSummary = context.coverLetters
    .map((item: Record<string, unknown>, index: number) => {
      const name = asString(item.name) || `Cover letter ${index + 1}`;
      const role = asString(item.role) || "General";
      const company = asString(item.company) || "Unknown company";
      const content = truncate(asString(item.content), 700);
      return `- ${name} (${role} @ ${company})\n${content}`;
    })
    .join("\n\n");

  const resumeText = truncate(asString(context.parsedResume?.raw_text), 6000);
  const about = truncate(asString(context.profile?.about), 1200);

  return `
You are generating reusable Answer Bank entries for JobRaker.

Return valid JSON only in this shape:
{
  "entries": [
    {
      "theme": "identity" | "beliefs" | "stories" | "career" | "skills" | "voice",
      "slug": "kebab-case-slug",
      "question": "short prompt title",
      "tags": ["tag-one", "tag-two"],
      "body": "first-person reusable answer content"
    }
  ]
}

Rules:
- Generate at most ${limit} entries.
- Restrict themes to: ${themes.join(", ")}.
- Use only facts grounded in the supplied candidate context.
- Do not invent employers, metrics, education, work authorization, or demographic details.
- Write reusable first-person snippets that can help with applications, cover letters, interview answers, and AI drafting.
- Make stories concrete and specific.
- Make voice entries describe tone and phrasing preferences in first person.
- Prefer concise but substantial bodies between 2 and 8 lines.
- Avoid duplicate ideas across entries.

Candidate memory:
${formatCandidateMemoryForPrompt(context.memory)}

Profile about:
${about || "None"}

Recent parsed resume text:
${resumeText || "None"}

Recent cover letters:
${coverLetterSummary || "None"}
`.trim();
}

async function generateEntriesWithGemini(
  context: Awaited<ReturnType<typeof loadAnswerBankContext>>,
  themes: AnswerTheme[],
  limit: number,
): Promise<AnswerBankEntryInput[]> {
  const ai = createGeminiClient();
  const { result: response } = await withModelFallback(
    (model) => withGeminiRetry(() =>
      ai.models.generateContent({
        model,
        config: createGeminiConfig({
          systemInstruction:
            "You create structured reusable candidate knowledge snippets for a job-search assistant. Return only valid JSON.",
          responseMimeType: "application/json",
        }),
        contents: [{ role: "user", parts: [{ text: buildGenerationPrompt(context, themes, limit) }] }],
      }),
    ),
  );

  const text = extractGeminiText(response);
  const parsed = parseStructuredJson<{ entries?: unknown[] }>(text);
  const rawEntries = Array.isArray(parsed.entries) ? parsed.entries : [];
  const usedSlugs = new Set<string>();
  return rawEntries
    .map((item) => sanitizeEntry(isRecord(item) ? (item as Partial<AnswerBankEntryInput>) : null, usedSlugs))
    .filter((item): item is AnswerBankEntryInput => Boolean(item))
    .filter((item) => themes.includes(item.theme))
    .slice(0, limit);
}

export async function fetchAnswerBankEntries(
  serviceClient: any,
  userId: string,
  options?: {
    theme?: AnswerTheme | null;
    limit?: number;
    query?: string | null;
  },
): Promise<AnswerBankEntryRecord[]> {
  let query = serviceClient
    .from("answer_bank")
    .select("*")
    .eq("user_id", userId)
    .order("theme")
    .order("slug");

  if (options?.theme) {
    query = query.eq("theme", options.theme);
  }

  if (options?.limit) {
    query = query.limit(clamp(options.limit, 1, 50));
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = Array.isArray(data) ? (data as AnswerBankEntryRecord[]) : [];
  const q = asString(options?.query)?.toLowerCase();
  if (!q) return rows;

  return rows.filter((row) =>
    [row.question, row.body, ...(row.tags || []), row.slug, row.theme]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(q)),
  );
}

export function formatAnswerBankForPrompt(
  entries: Array<Pick<AnswerBankEntryRecord, "theme" | "question" | "body" | "tags" | "slug">>,
  limit = 12,
): string | null {
  const selected = entries.slice(0, limit);
  if (!selected.length) return null;

  const grouped = new Map<AnswerTheme, typeof selected>();
  for (const entry of selected) {
    const bucket = grouped.get(entry.theme as AnswerTheme) || [];
    bucket.push(entry);
    grouped.set(entry.theme as AnswerTheme, bucket);
  }

  const lines: string[] = [];
  for (const theme of ALL_THEMES) {
    const items = grouped.get(theme);
    if (!items?.length) continue;
    lines.push(`${THEME_LABELS[theme]}:`);
    for (const item of items) {
      const tagSuffix =
        Array.isArray(item.tags) && item.tags.length > 0
          ? ` [tags: ${item.tags.slice(0, 5).join(", ")}]`
          : "";
      lines.push(`- ${item.question}${tagSuffix}`);
      lines.push(`  ${truncate(item.body, 280)}`);
    }
  }

  return lines.join("\n");
}

export async function createAnswerBankEntry(
  serviceClient: any,
  userId: string,
  entry: AnswerBankEntryInput,
) {
  const sanitized = sanitizeEntry(entry, new Set<string>());
  if (!sanitized) {
    throw new Error("Invalid answer bank entry payload.");
  }

  const { data, error } = await serviceClient
    .from("answer_bank")
    .insert({
      user_id: userId,
      theme: sanitized.theme,
      slug: sanitized.slug,
      question: sanitized.question,
      body: sanitized.body,
      tags: sanitized.tags,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as AnswerBankEntryRecord;
}

export async function updateAnswerBankEntry(
  serviceClient: any,
  userId: string,
  id: string,
  patch: Partial<AnswerBankEntryInput>,
) {
  const { data: existing, error: fetchError } = await serviceClient
    .from("answer_bank")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!existing) throw new Error("Answer Bank entry not found.");

  const merged = sanitizeEntry(
    {
      theme: normalizeTheme(patch.theme) || existing.theme,
      slug: asString(patch.slug) || existing.slug,
      question: asString(patch.question) || existing.question,
      body: asString(patch.body) || existing.body,
      tags: Array.isArray(patch.tags) ? patch.tags : existing.tags,
    },
    new Set<string>(),
  );
  if (!merged) throw new Error("Invalid answer bank update payload.");

  const updatePatch = {
    theme: merged.theme,
    slug: merged.slug,
    question: merged.question,
    body: merged.body,
    tags: merged.tags,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await serviceClient
    .from("answer_bank")
    .update(updatePatch)
    .eq("user_id", userId)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as AnswerBankEntryRecord;
}

export async function deleteAnswerBankEntry(
  serviceClient: any,
  userId: string,
  id: string,
) {
  const { error } = await serviceClient
    .from("answer_bank")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
  return { success: true, id };
}

export async function generateAnswerBankEntries(
  serviceClient: any,
  userId: string,
  options?: GenerateAnswerBankOptions,
): Promise<AnswerBankEntryInput[]> {
  const themes = (options?.themes?.filter((theme): theme is AnswerTheme => ALL_THEMES.includes(theme)) ||
    ALL_THEMES).slice(0, ALL_THEMES.length);
  const limit = clamp(options?.limit ?? DEFAULT_ENTRY_LIMIT, 1, MAX_ENTRY_LIMIT);
  const context = await loadAnswerBankContext(serviceClient, userId);

  let generated: AnswerBankEntryInput[] = [];
  try {
    generated = await generateEntriesWithGemini(context, themes, limit);
  } catch (error) {
    console.warn("generateAnswerBankEntries fallback", error);
  }

  if (generated.length === 0) {
    const usedSlugs = new Set<string>();
    generated = buildDeterministicEntries(context.memory)
      .filter((entry) => themes.includes(entry.theme))
      .map((entry) => sanitizeEntry(entry, usedSlugs))
      .filter((entry): entry is AnswerBankEntryInput => Boolean(entry));
  }

  return generated.slice(0, limit);
}

export async function upsertGeneratedAnswerBankEntries(
  serviceClient: any,
  userId: string,
  entries: AnswerBankEntryInput[],
  options?: UpsertAnswerBankOptions,
) {
  if (!entries.length) {
    return { inserted: 0, updated: 0, entries: [] as AnswerBankEntryRecord[] };
  }

  const existingRows = await fetchAnswerBankEntries(serviceClient, userId);
  const byKey = new Map(
    existingRows.map((entry) => [`${entry.theme}:${entry.slug}`, entry] as const),
  );

  let inserted = 0;
  let updated = 0;

  const payload = entries.map((entry) => ({
    user_id: userId,
    theme: entry.theme,
    slug: normalizeAnswerBankSlug(entry.slug || entry.question),
    question: truncate(entry.question, 140),
    body: truncate(entry.body, 4000),
    tags: normalizeTags(entry.tags),
    updated_at: new Date().toISOString(),
  }));

  payload.forEach((item) => {
    if (byKey.has(`${item.theme}:${item.slug}`)) updated += 1;
    else inserted += 1;
  });

  const { error } = await serviceClient
    .from("answer_bank")
    .upsert(payload, {
      onConflict: "user_id,theme,slug",
      ignoreDuplicates: false,
    });
  if (error) throw error;

  if (options?.replaceExisting) {
    const keepKeys = new Set(payload.map((item) => `${item.theme}:${item.slug}`));
    const affectedThemes = new Set(payload.map((item) => item.theme));
    const staleIds = existingRows
      .filter(
        (entry) =>
          affectedThemes.has(entry.theme) &&
          keepKeys.has(`${entry.theme}:${entry.slug}`) === false,
      )
      .map((entry) => entry.id);
    if (staleIds.length > 0) {
      await serviceClient
        .from("answer_bank")
        .delete()
        .eq("user_id", userId)
        .in("id", staleIds);
    }
  }

  const refreshed = await fetchAnswerBankEntries(serviceClient, userId);
  return { inserted, updated, entries: refreshed };
}
