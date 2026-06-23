import type { DiscoveryJob } from "./discovery-hybrid.ts";
import {
  applyFeedbackLearningToQuality,
  fetchFeedbackLearningProfile,
  scoreFeedbackLearningAdjustment,
} from "./job-feedback-learning.ts";
import { scoreDiscoveredJobQuality } from "./job-quality.ts";
import {
  createGeminiClient,
  extractGeminiText,
  withGeminiRetry,
} from "./gemini.ts";
import { parseStructuredJson } from "./structured-json.ts";

interface FormattedJobInfo {
  title: string;
  description: string;
}

export async function formatJobTitleAndDescriptionWithAi(
  title: string,
  description: string,
): Promise<FormattedJobInfo> {
  const model = Deno.env.get("SUPPORT_AI_MODEL") || "gemma-4-31b-it";
  const ai = createGeminiClient();

  const systemInstruction = `You are a professional recruiting assistant. Your task is to clean, normalize, and format a job title and description to make them clean, recruiter-ready, and well-structured.

Formatting Rules:
1. Job Title:
- Remove bracketed text, emojis, salary information, location information, employment type, or system codes (e.g., "Software Engineer (Remote) - 100% Remote" -> "Software Engineer").
- Keep only the actual title. Do not include team names or company names (e.g. "Operations Manager - Growth Team" -> "Operations Manager").
- Format in standard Title Case.
2. Job Description:
- Restructure the raw text into a clean, well-formatted markdown layout.
- Use clear markdown headers (e.g., "### About the Role", "### Responsibilities", "### Requirements", "### Benefits").
- Clean up any messy whitespace, formatting artifacts, parsing errors, or broken HTML tags.
- List responsibilities and requirements as clear, bulleted points.
- Do NOT fabricate or alter any actual requirements, responsibilities, or details. Preserve all original meaning and facts.

Return only a valid JSON object matching this schema:
{
  "title": "Clean Job Title",
  "description": "Clean Markdown Job Description"
}`;

  const prompt = `Raw Title: ${title}\n\nRaw Description:\n${description}`;

  try {
    const response = await withGeminiRetry(() =>
      ai.models.generateContent({
        model,
        config: {
          systemInstruction: {
            role: "system",
            parts: [{ text: systemInstruction }],
          },
          responseMimeType: "application/json",
        },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      })
    );

    const rawText = extractGeminiText(response);
    const parsed = parseStructuredJson<FormattedJobInfo>(rawText);
    if (parsed && typeof parsed.title === "string" && typeof parsed.description === "string") {
      return {
        title: parsed.title.trim() || title,
        description: parsed.description.trim() || description,
      };
    }
  } catch (error) {
    console.warn("[AiJobFormatter] Failed to format job title/description with Gemma-4 model, using fallbacks.", error);
  }

  return { title, description };
}

type JobRowInput = Record<string, unknown> & {
  id?: string;
  user_id: string;
  source_id?: string | null;
};

const asNumberOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;

type ExistingJobRow = {
  id: string;
  source_id: string | null;
  created_at?: string | null;
};

export async function attachExistingJobIdsBySourceId(
  serviceClient: any,
  userId: string,
  rows: JobRowInput[],
): Promise<JobRowInput[]> {
  if (!rows.length) {
    return rows;
  }

  const sourceIds = Array.from(
    new Set(
      rows
        .map((row) =>
          typeof row.source_id === "string" && row.source_id.trim().length > 0
            ? row.source_id.trim()
            : null,
        )
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (!sourceIds.length) {
    return rows;
  }

  const { data, error } = await serviceClient
    .from("jobs")
    .select("id, source_id, created_at")
    .eq("user_id", userId)
    .in("source_id", sourceIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const existingBySourceId = new Map<string, ExistingJobRow>();
  for (const row of ((data as ExistingJobRow[] | null) ?? [])) {
    if (typeof row.source_id === "string" && !existingBySourceId.has(row.source_id)) {
      existingBySourceId.set(row.source_id, row);
    }
  }

  return rows.map((row) => {
    const sourceId =
      typeof row.source_id === "string" ? row.source_id.trim() : "";
    const existing = sourceId ? existingBySourceId.get(sourceId) : undefined;
    return {
      ...row,
      id: existing ? existing.id : crypto.randomUUID(),
    };
  });
}

interface PersistDiscoveryOptions {
  userId: string;
  searchQuery: string;
  location: string;
  trigger: "live_search" | "manual_cron" | "scheduled_cron";
  requestedLimit?: number | null;
  effectiveLimit?: number | null;
  subscriptionTier?: string | null;
}

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export async function persistDiscoveredJobs(
  serviceClient: any,
  jobs: DiscoveryJob[],
  options: PersistDiscoveryOptions,
) {
  if (!jobs.length) {
    return {
      jobsInserted: 0,
      rows: [] as JobRowInput[],
    };
  }

  const nowIso = new Date().toISOString();
  const feedbackLearningProfile = await fetchFeedbackLearningProfile(
    serviceClient,
    options.userId,
  );

  const formattedJobs = await Promise.all(
    jobs.map(async (job) => {
      const formatted = await formatJobTitleAndDescriptionWithAi(job.title, job.description || "");
      return {
        ...job,
        title: formatted.title,
        description: formatted.description,
      };
    })
  );

  const rows = formattedJobs.map((job) => {
    const rawData = toRecord(job.raw_data);
    const discovery = toRecord(rawData.discovery);
    const baseLeadQuality = scoreDiscoveredJobQuality(job, {
      searchQuery: options.searchQuery,
    });
    const feedbackLearningAdjustment = scoreFeedbackLearningAdjustment(
      job,
      feedbackLearningProfile,
    );
    const leadQuality = applyFeedbackLearningToQuality(
      baseLeadQuality,
      feedbackLearningAdjustment,
    );

    return {
      user_id: options.userId,
      source_type: job.source_type,
      source_id: job.source_id,
      title: job.title,
      company: job.company,
      location: job.location,
      apply_url: job.url,
      status: "active",
      canonical_status: "discovered",
      verification_status: job.verification_status,
      source_kind: job.source_kind,
      source_confidence: job.source_confidence,
      lead_quality_score: leadQuality.score,
      lead_quality_reason: leadQuality.reason,
      lead_quality_tags: leadQuality.tags,
      is_tracked_company: job.is_tracked_company,
      discovered_at: nowIso,
      last_verified_at: nowIso,
      description: job.description,
      posted_at: job.posted_at,
      salary_min: asNumberOrNull(job.salary_min),
      salary_max: asNumberOrNull(job.salary_max),
      salary_currency:
        typeof job.salary_currency === "string" && job.salary_currency.trim()
          ? job.salary_currency.trim().toUpperCase()
          : null,
      raw_data: {
        ...rawData,
        discovery: {
          ...discovery,
          mode: "firecrawl",
          search_query: options.searchQuery,
          location: options.location,
          trigger: options.trigger,
          source_kind: job.source_kind,
          source_confidence: job.source_confidence,
          verification_status: job.verification_status,
          lead_quality_score: leadQuality.score,
          lead_quality_reason: leadQuality.reason,
          lead_quality_tags: leadQuality.tags,
          feedback_learning_adjustment:
            leadQuality.feedback_learning_adjustment,
          requested_limit: options.requestedLimit ?? null,
          effective_limit: options.effectiveLimit ?? null,
          subscription_tier: options.subscriptionTier ?? null,
        },
      },
    } satisfies JobRowInput;
  });

  const rowsWithIds = await attachExistingJobIdsBySourceId(
    serviceClient,
    options.userId,
    rows,
  );

  // ── Protected upsert: never overwrite a terminal application status ──────
  // Statuses set by user actions (or sourced from Gmail/auto-apply) must not
  // be clobbered when a discovery run re-encounters the same job.
  const PROTECTED_STATUSES = new Set([
    "applied",
    "submitted",
    "interview",
    "rejected",
    "offer",
    "archived",
  ]);

  // Split rows: new jobs (no pre-existing id in DB) vs existing jobs
  const existingSourceIds = new Set(
    rowsWithIds
      .filter((r) => r.source_id != null)
      .map((r) => r.source_id as string),
  );

  // We already have the existing DB rows from attachExistingJobIdsBySourceId —
  // re-fetch canonical_status for those rows so we can gate the update.
  const { data: existingStatuses, error: statusFetchError } =
    await serviceClient
      .from("jobs")
      .select("id, source_id, canonical_status")
      .eq("user_id", options.userId)
      .in("source_id", Array.from(existingSourceIds));

  if (statusFetchError) {
    throw statusFetchError;
  }

  const statusBySourceId = new Map<string, string>(
    (existingStatuses ?? []).map((r: { source_id: string; canonical_status: string }) => [
      r.source_id,
      r.canonical_status,
    ]),
  );

  // Partition
  const newRows = rowsWithIds.filter(
    (r) =>
      !r.source_id || !statusBySourceId.has(r.source_id as string),
  );
  const existingRows = rowsWithIds.filter(
    (r) =>
      r.source_id && statusBySourceId.has(r.source_id as string),
  );

  const insertedIds: string[] = [];

  // 1. Insert brand-new rows (no conflict risk — they don't exist yet)
  if (newRows.length > 0) {
    const { data: insertData, error: insertError } = await serviceClient
      .from("jobs")
      .upsert(newRows, { onConflict: "user_id,source_type,source_id" })
      .select("id");

    if (insertError) throw insertError;
    insertedIds.push(...(insertData ?? []).map((r: { id: string }) => r.id));
  }

  // 2. Update existing rows — only overwrite safe fields; never touch canonical_status
  //    when the current status is a protected terminal state.
  for (const row of existingRows) {
    const currentStatus = statusBySourceId.get(row.source_id as string) ?? "";
    const isProtected = PROTECTED_STATUSES.has(currentStatus.toLowerCase());

    // Fields safe to refresh from discovery data regardless of status
    const safeUpdate: Record<string, unknown> = {
      title: row.title,
      company: row.company,
      location: row.location,
      description: row.description,
      apply_url: row.apply_url,
      salary_min: row.salary_min,
      salary_max: row.salary_max,
      salary_currency: row.salary_currency,
      lead_quality_score: row.lead_quality_score,
      lead_quality_reason: row.lead_quality_reason,
      lead_quality_tags: row.lead_quality_tags,
      last_verified_at: row.last_verified_at,
      raw_data: row.raw_data,
    };

    // Only update canonical_status when the existing status is NOT protected
    if (!isProtected) {
      safeUpdate.canonical_status = row.canonical_status;
      safeUpdate.status = row.status;
    }

    const { data: updateData, error: updateError } = await serviceClient
      .from("jobs")
      .update(safeUpdate)
      .eq("id", row.id)
      .select("id");

    if (updateError) throw updateError;
    insertedIds.push(...(updateData ?? []).map((r: { id: string }) => r.id));
  }

  return {
    jobsInserted: insertedIds.length,
    rows: rowsWithIds,
  };
}

/** Matches the job queue filters used by the dashboard (useJobsQueue / JobPage). */
export const DISPLAYABLE_JOB_QUEUE_STATES = ["discovered", "evaluated"] as const;

export interface DisplayableJobSearchScope {
  userId: string;
  searchQuery: string;
  location?: string;
  searchStartedAt?: string;
}

/**
 * Count jobs the user will actually see for a search run.
 * Billing must use this count — not in-flight discovery totals.
 */
export async function countDisplayableJobsForSearch(
  serviceClient: any,
  scope: DisplayableJobSearchScope,
): Promise<number> {
  const searchQuery = scope.searchQuery?.trim();
  if (!searchQuery) {
    return 0;
  }

  let queryBuilder = serviceClient
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", scope.userId)
    .eq("hidden", false)
    .in("canonical_status", DISPLAYABLE_JOB_QUEUE_STATES);

  const discoveryScope: Record<string, string> = {
    search_query: searchQuery,
  };
  const location = scope.location?.trim();
  if (location) {
    discoveryScope.location = location;
  }

  queryBuilder = queryBuilder.contains("raw_data", { discovery: discoveryScope });

  if (scope.searchStartedAt) {
    queryBuilder = queryBuilder.gte("discovered_at", scope.searchStartedAt);
  }

  const { count, error } = await queryBuilder;
  if (error) {
    console.error("[countDisplayableJobsForSearch] count query failed", error);
    return 0;
  }

  return count ?? 0;
}

export function resolveJobSearchCreditsToCharge(
  displayableJobCount: number,
  maxCredits: number,
): number {
  return Math.min(Math.max(0, displayableJobCount), Math.max(0, maxCredits));
}

export async function settleJobSearchRunCredits(
  serviceClient: any,
  options: {
    agentRunId: string;
    userId: string;
    searchQuery: string;
    location: string;
    searchStartedAt?: string;
    maxCredits: number;
    searchFailed?: boolean;
    failureReason?: string;
    jobsInserted?: number;
    jobsDiscovered?: number;
  },
): Promise<{ displayableJobCount: number; creditsCharged: number; currentBalance?: number }> {
  const displayableJobCount = options.searchFailed
    ? 0
    : await countDisplayableJobsForSearch(serviceClient, {
      userId: options.userId,
      searchQuery: options.searchQuery,
      location: options.location,
      searchStartedAt: options.searchStartedAt,
    });

  const creditsCharged = options.searchFailed
    ? 0
    : resolveJobSearchCreditsToCharge(displayableJobCount, options.maxCredits);

  const { data: settleRaw, error: settleError } = await serviceClient.rpc("settle_run_credits", {
    p_agent_run_id: options.agentRunId,
    p_actual_credits: creditsCharged,
    p_status: options.searchFailed ? "failed" : "completed",
    p_failure_reason: options.failureReason,
    p_receipt: {
      jobs_displayable: displayableJobCount,
      jobs_inserted: options.jobsInserted ?? null,
      jobs_discovered: options.jobsDiscovered ?? null,
      search_query: options.searchQuery,
      location: options.location,
      search_started_at: options.searchStartedAt ?? null,
    },
  });

  if (settleError) {
    console.error("[settleJobSearchRunCredits] settlement failed", settleError);
  }

  const settleData = settleRaw as Record<string, unknown> | null;

  return {
    displayableJobCount,
    creditsCharged,
    currentBalance: typeof settleData?.current_balance === "number"
      ? settleData.current_balance
      : undefined,
  };
}
