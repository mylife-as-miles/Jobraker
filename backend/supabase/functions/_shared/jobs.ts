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
  /** V2: agent run ID to link results to job_search_results table */
  agentRunId?: string | null;
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

  const results = await Promise.all(
    formattedJobs.map(async (job) => {
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

      const computedRawData = {
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
      };

      const experienceLevel = typeof job.raw_data?.experience_level === "string"
        ? job.raw_data.experience_level
        : null;

      const tags = Array.isArray(job.raw_data?.tags)
        ? job.raw_data.tags.filter((t): t is string => typeof t === "string")
        : null;

      const { data, error } = await serviceClient.rpc("upsert_job_from_discovery", {
        p_user_id: options.userId,
        p_source_type: job.source_type,
        p_source_id: job.source_id,
        p_title: job.title,
        p_company: job.company,
        p_description: job.description,
        p_location: job.location,
        p_apply_url: job.url,
        p_salary_min: asNumberOrNull(job.salary_min),
        p_salary_max: asNumberOrNull(job.salary_max),
        p_salary_currency:
          typeof job.salary_currency === "string" && job.salary_currency.trim()
            ? job.salary_currency.trim().toUpperCase()
            : null,
        p_experience_level: experienceLevel,
        p_tags: tags,
        p_raw_data: computedRawData,
        p_lead_quality_score: leadQuality.score,
        p_lead_quality_reason: leadQuality.reason,
        p_lead_quality_tags: leadQuality.tags,
        p_source_kind: job.source_kind,
        p_source_confidence: job.source_confidence,
        p_verification_status: job.verification_status,
        p_is_tracked_company: job.is_tracked_company,
      });

      if (error) {
        console.error("[persistDiscoveredJobs] upsert rpc failed", error);
        throw error;
      }

      const rpcResult = (data as Array<{ job_id: string; is_new_to_user: boolean }> | null)?.[0];
      if (!rpcResult) {
        throw new Error("[persistDiscoveredJobs] upsert rpc returned no data");
      }

      return {
        job_id: rpcResult.job_id,
        is_new_to_user: rpcResult.is_new_to_user,
        job,
      };
    })
  );

  const newResultCount = results.filter((result) => result.is_new_to_user).length;
  const duplicateResultCount = results.length - newResultCount;

  // ── V2: Insert job_search_results rows ─────────────────────────────────────
  // Link each job to the agent run with billing eligibility flags.
  if (options.agentRunId) {
    const agentRunId = options.agentRunId;

    const resultInserts = results.map((res, idx) => ({
      p_agent_run_id:    agentRunId,
      p_user_id:         options.userId,
      p_job_id:          res.job_id,
      p_rank:            idx + 1,
      // Fresh-search results should show opportunities the user has not already
      // seen. Duplicate rows remain linked to the run for auditability.
      p_displayable:     res.is_new_to_user,
      // Only charge for jobs that are genuinely new to this user
      p_is_new_to_user:  res.is_new_to_user,
      // Billable = displayable AND new AND has an apply URL
      p_billable:        res.is_new_to_user && Boolean(res.job.url),
      p_duplicate_reason: res.is_new_to_user
        ? null
        : "previously_seen_by_user",
    }));

    // Insert in batches of 25 to avoid RPC payload limits
    for (let i = 0; i < resultInserts.length; i += 25) {
      const batch = resultInserts.slice(i, i + 25);
      await Promise.all(
        batch.map((params) =>
          serviceClient.rpc("insert_job_search_result", params).then(
            ({ error }: { error: unknown }) => {
              if (error) {
                // Non-fatal: log and continue so billing settlement still works
                console.warn("[persistDiscoveredJobs] Failed to insert job_search_result", {
                  jobId: params.p_job_id,
                  agentRunId,
                  error,
                });
              }
            }
          )
        )
      );
    }
  }

  // Map to the format expected by the caller (JobRowInput[])
  const rows = results.map((res) => {
    return {
      id: res.job_id,
      user_id: options.userId,
      source_type: res.job.source_type,
      source_id: res.job.source_id,
      title: res.job.title,
      company: res.job.company,
      location: res.job.location,
      apply_url: res.job.url,
      status: "active",
      canonical_status: "discovered",
      verification_status: res.job.verification_status,
      source_kind: res.job.source_kind,
      source_confidence: res.job.source_confidence,
      lead_quality_score: res.job.raw_data?.discovery?.lead_quality_score,
      lead_quality_reason: res.job.raw_data?.discovery?.lead_quality_reason,
      lead_quality_tags: res.job.raw_data?.discovery?.lead_quality_tags,
      is_tracked_company: res.job.is_tracked_company,
      discovered_at: nowIso,
      last_verified_at: nowIso,
      description: res.job.description,
      posted_at: res.job.posted_at,
      salary_min: asNumberOrNull(res.job.salary_min),
      salary_max: asNumberOrNull(res.job.salary_max),
      salary_currency:
        typeof res.job.salary_currency === "string" && res.job.salary_currency.trim()
          ? res.job.salary_currency.trim().toUpperCase()
          : null,
      raw_data: res.job.raw_data,
    } satisfies JobRowInput;
  });

  return {
    jobsInserted: newResultCount,
    jobsProcessed: results.length,
    duplicateCount: duplicateResultCount,
    displayableCount: newResultCount,
    rows,
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
  _maxCredits: number,
): number {
  return Math.max(0, displayableJobCount);
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
    /** V2: settlement idempotency key — when provided, calls settle_search_run_v2 */
    settlementIdempotencyKey?: string;
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

  // ── V2 settlement path ────────────────────────────────────────────────────
  // When a settlementIdempotencyKey is provided the database RPC
  // settle_search_run_v2 calculates the actual cost itself by counting rows
  // from job_search_results. This is more accurate than countDisplayableJobsForSearch.
  if (options.settlementIdempotencyKey) {
    const { data: v2Raw, error: v2Error } = await serviceClient.rpc(
      "settle_search_run_v2",
      {
        p_agent_run_id:               options.agentRunId,
        p_settlement_idempotency_key: options.settlementIdempotencyKey,
        p_status:                     options.searchFailed ? "failed" : "completed",
        p_metadata: {
          jobs_inserted:   options.jobsInserted ?? null,
          jobs_discovered: options.jobsDiscovered ?? null,
          failure_reason:  options.failureReason ?? null,
        },
      }
    );

    if (v2Error) {
      console.error("[settleJobSearchRunCredits] V2 settlement failed", v2Error);
      // Fall through to legacy path below
    } else {
      const v2Data = v2Raw as Record<string, unknown> | null;
      const v2Cost = typeof v2Data?.actual_cost === "number" ? v2Data.actual_cost : creditsCharged;
      const v2Count = typeof v2Data?.billable_results === "number"
        ? v2Data.billable_results
        : displayableJobCount;
      return {
        displayableJobCount: v2Count,
        creditsCharged: v2Cost,
        currentBalance: undefined,
      };
    }
  }

  // ── Legacy settlement path (fallback) ────────────────────────────────────
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
