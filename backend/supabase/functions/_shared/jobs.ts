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
  runMeteredAiCall,
} from "./gemini.ts";
import { parseStructuredJson } from "./structured-json.ts";

interface FormattedJobInfo {
  title: string;
  description: string;
}

export async function cleanJobDescriptionWithAI(
  title: string,
  description: string,
  model = "gemini-3-flash-preview",
  userId?: string,
): Promise<FormattedJobInfo> {
  const ai = createGeminiClient();

  const systemInstruction = `You are an expert AI job posting parser and editor.
Clean and reformat raw job title and description text.

Rules:
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
    let response: any;
    if (userId) {
      const metered = await runMeteredAiCall({
        userId,
        featureKey: "clean_job_description",
        model,
        promptTextLength: prompt.length,
        execute: async () => {
          const rawRes = await withGeminiRetry(() =>
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
          return {
            result: rawRes,
            usageMetadata: (rawRes as any)?.usageMetadata,
          };
        },
      });
      response = metered.result;
    } else {
      response = await withGeminiRetry(() =>
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
    }

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

export const formatJobTitleAndDescriptionWithAi = cleanJobDescriptionWithAI;

/* ------------------------- deferred AI job formatting ----------------------- */

/** Formatting is cosmetic, so a slow model must never hold up job visibility. */
const JOB_FORMAT_TIMEOUT_MS = 20_000;
/** Bounded so a batch cannot fire N concurrent Gemini calls and self-inflict 429s. */
const JOB_FORMAT_CONCURRENCY = 3;

type PendingJobFormat = {
  jobId: string;
  title: string;
  description: string;
};

/**
 * Cheap gate: a posting that already looks like clean markdown gains little
 * from a model round trip, so skip it entirely.
 */
function alreadyLooksFormatted(title: string, description: string): boolean {
  const desc = description.trim();
  if (desc.length < 200) return true; // nothing meaningful to restructure
  const hasMarkdownHeadings = /^#{2,4}\s+\S/m.test(desc);
  const hasBullets = /^[-*]\s+\S/m.test(desc);
  const hasHtmlArtifacts = /<[a-z][^>]*>/i.test(desc);
  const titleIsNoisy = /[\[\]{}|]|\b(remote|hybrid|onsite|full[- ]time|part[- ]time)\b/i
    .test(title);
  return hasMarkdownHeadings && hasBullets && !hasHtmlArtifacts && !titleIsNoisy;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`job formatting timed out after ${ms}ms`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Reformat already-persisted jobs and update them in place.
 *
 * Runs OFF the discovery critical path: jobs are saved with their scraped text
 * first so they appear immediately, then this tidies them up. Never throws —
 * a formatting failure must not fail a search.
 */
export async function formatPersistedJobs(
  serviceClient: any,
  userId: string,
  pending: PendingJobFormat[],
): Promise<void> {
  const work = pending.filter(
    (entry) =>
      entry.jobId &&
      !alreadyLooksFormatted(entry.title, entry.description || ""),
  );
  if (!work.length) return;

  let cursor = 0;
  const runWorker = async () => {
    while (cursor < work.length) {
      const entry = work[cursor];
      cursor += 1;
      try {
        const formatted = await withTimeout(
          formatJobTitleAndDescriptionWithAi(entry.title, entry.description || ""),
          JOB_FORMAT_TIMEOUT_MS,
        );
        const nextTitle = formatted.title?.trim() || entry.title;
        const nextDescription = formatted.description?.trim() ||
          entry.description;
        if (
          nextTitle === entry.title && nextDescription === entry.description
        ) {
          continue;
        }
        const { error } = await serviceClient
          .from("jobs")
          .update({ title: nextTitle, description: nextDescription })
          .eq("id", entry.jobId)
          .eq("user_id", userId);
        if (error) {
          console.warn("[formatPersistedJobs] update failed", {
            jobId: entry.jobId,
            error,
          });
        }
      } catch (error) {
        // Cosmetic step: leave the scraped text in place and move on.
        console.warn("[formatPersistedJobs] formatting skipped", {
          jobId: entry.jobId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(JOB_FORMAT_CONCURRENCY, work.length) },
      () => runWorker(),
    ),
  );
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

  // AI formatting used to run here, one Gemini call per job, blocking the batch
  // before anything could be shown. Jobs are now persisted with their scraped
  // text immediately and tidied up afterwards by formatPersistedJobs().
  const results = await Promise.all(
    jobs.map(async (job) => {
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
        const errorMsg = typeof error === "object" && error !== null && "message" in error ? String((error as any).message) : String(error);
        if (/23505|duplicate key|jobs_user_fingerprint_idx/i.test(errorMsg)) {
          console.warn("[persistDiscoveredJobs] Duplicate job detected during RPC, merging gracefully.", errorMsg);
          return {
            job_id: crypto.randomUUID(),
            is_new_to_user: false,
            job,
          };
        }
        console.error("[persistDiscoveredJobs] upsert rpc failed", error);
        throw error;
      }

      const rpcResult = (data as Array<{ job_id: string; is_new_to_user: boolean }> | null)?.[0];
      if (!rpcResult) {
        return {
          job_id: crypto.randomUUID(),
          is_new_to_user: false,
          job,
        };
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

  // Kick off cosmetic reformatting without awaiting it, so the caller can show
  // these jobs now. `waitUntil` keeps it alive past a short-lived response;
  // long-running workers can also await `formattingTask` before exiting.
  const formattingTask = formatPersistedJobs(
    serviceClient,
    options.userId,
    results.map((res) => ({
      jobId: res.job_id,
      title: res.job.title,
      description: res.job.description || "",
    })),
  ).catch((error) => {
    console.warn("[persistDiscoveredJobs] deferred formatting failed", error);
  });

  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
    .EdgeRuntime;
  if (typeof runtime?.waitUntil === "function") {
    runtime.waitUntil(formattingTask);
  }

  return {
    jobsInserted: newResultCount,
    jobsProcessed: results.length,
    duplicateCount: duplicateResultCount,
    displayableCount: newResultCount,
    rows,
    /** Resolves when deferred AI formatting has finished. Safe to ignore. */
    formattingTask,
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
  const settlementKey =
    options.settlementIdempotencyKey ||
    `settle:${options.agentRunId}:${Date.now()}`;

  // ── V2 settlement path (Primary) ─────────────────────────────────────────
  // settle_search_run_v2 calculates the actual cost itself by counting billable rows
  // from job_search_results. If 0 jobs found or failed -> actual_cost = 0, 100% refunded.
  // If partial results (e.g. 30/50) -> actual_cost = 30, remaining 20 refunded.
  const { data: v2Raw, error: v2Error } = await serviceClient.rpc(
    "settle_search_run_v2",
    {
      p_agent_run_id:               options.agentRunId,
      p_settlement_idempotency_key: settlementKey,
      p_status:                     options.searchFailed ? "failed" : "completed",
      p_metadata: {
        jobs_inserted:   options.jobsInserted ?? null,
        jobs_discovered: options.jobsDiscovered ?? null,
        failure_reason:  options.failureReason ?? null,
      },
    },
  );

  if (!v2Error && v2Raw) {
    const v2Data = v2Raw as Record<string, unknown>;
    const v2Cost = typeof v2Data?.actual_cost === "number"
      ? (options.searchFailed ? 0 : v2Data.actual_cost)
      : (options.searchFailed ? 0 : (typeof v2Data?.charged === "number" ? v2Data.charged : 0));
    const v2Count = typeof v2Data?.billable_results === "number"
      ? v2Data.billable_results
      : (options.jobsInserted ?? 0);
    const availableBalance = typeof v2Data?.available === "number"
      ? v2Data.available
      : undefined;

    return {
      displayableJobCount: v2Count,
      creditsCharged: v2Cost,
      currentBalance: availableBalance,
    };
  }

  if (v2Error) {
    console.warn("[settleJobSearchRunCredits] V2 settlement RPC error, attempting legacy fallback:", v2Error);
  }

  // ── Legacy settlement path (fallback) ────────────────────────────────────
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
    p_settlement_idempotency_key: settlementKey,
  });

  if (settleError) {
    console.error("[settleJobSearchRunCredits] Legacy settlement failed", settleError);
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
