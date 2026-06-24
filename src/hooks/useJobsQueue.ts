import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabaseClient";
import { VISIBLE_JOB_QUEUE_STATES } from "@/lib/applicationState";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scope object passed to the jobs-queue hook.
 *
 * V2: When `agentRunId` is set, the hook fetches results via the
 * `get_job_search_results_for_run` RPC (which queries `job_search_results`)
 * instead of the legacy JSONB containment query against `raw_data.discovery`.
 *
 * V1 legacy fields (`searchQuery`, `location`, `startedAt`) are still
 * accepted and used as the fallback when `agentRunId` is absent.
 */
export type JobsQueueScope = {
  searchQuery: string;
  location: string;
  limit?: number;
  startedAt?: string;
  /** V2: canonical agent run ID returned by jobs-search */
  agentRunId?: string | null;
} | null;

/**
 * Shape returned by get_job_search_results_for_run.
 * Must match the RETURNS TABLE definition in the SQL migration.
 */
export interface RunResultRow {
  result_id: string;
  job_id: string;
  rank: number | null;
  displayable: boolean;
  is_new_to_user: boolean;
  title: string;
  company: string;
  location: string;
  apply_url: string;
  description: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  posted_at: string | null;
  source_kind: string | null;
  lead_quality_score: number | null;
  created_at: string;
}

interface JobsQueueQueryConfig<TJob> {
  scope: JobsQueueScope;
  supabase: ReturnType<typeof createClient>;
  mapJob: (dbJob: any) => TJob;
  decorateJobs?: (jobs: TJob[]) => Promise<TJob[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Query key factory
// ─────────────────────────────────────────────────────────────────────────────

export const jobsQueueKeys = {
  all: ["jobs-queue"] as const,
  list: (scope: JobsQueueScope) =>
    [
      ...jobsQueueKeys.all,
      // V2: key on agentRunId when present — this is unique and stable
      scope?.agentRunId ?? scope?.searchQuery?.trim() ?? null,
      scope?.agentRunId ? null : scope?.location?.trim() ?? null,
      typeof scope?.limit === "number" ? scope.limit : null,
      scope?.agentRunId ? null : scope?.startedAt ?? null,
    ] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// V2 query: fetch by agent_run_id
// ─────────────────────────────────────────────────────────────────────────────

async function fetchResultsByRunId(
  supabase: ReturnType<typeof createClient>,
  agentRunId: string,
): Promise<RunResultRow[]> {
  const { data, error } = await supabase.rpc(
    "get_job_search_results_for_run",
    { p_agent_run_id: agentRunId },
  );

  if (error) {
    console.error("[useJobsQueue] V2 RPC failed, falling back", {
      agentRunId,
      error,
    });
    throw error;
  }

  return (data as RunResultRow[] | null) ?? [];
}

/**
 * Map a RunResultRow from get_job_search_results_for_run into a shape
 * compatible with the existing jobs table row that mapJob expects.
 *
 * The returned object sets the fields that mapDbJobToUiJob reads from a
 * `jobs` table row, so no changes are needed to the mapper.
 */
export function runResultRowToJobsRow(row: RunResultRow): Record<string, unknown> {
  return {
    id: row.job_id,
    title: row.title,
    company: row.company,
    location: row.location,
    apply_url: row.apply_url,
    description: row.description,
    salary_min: row.salary_min,
    salary_max: row.salary_max,
    salary_currency: row.salary_currency,
    posted_at: row.posted_at,
    source_kind: row.source_kind,
    lead_quality_score: row.lead_quality_score,
    // Fields the jobs table row has that are not in the result row;
    // set safe defaults so mapJob doesn't choke.
    hidden: false,
    canonical_status: "discovered",
    status: "active",
    discovered_at: row.created_at,
    created_at: row.created_at,
    // V2 result-specific metadata — available to mapJob if it wants it.
    _v2_result_id: row.result_id,
    _v2_rank: row.rank,
    _v2_is_new_to_user: row.is_new_to_user,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// V1 legacy query: fetch by JSONB containment
// ─────────────────────────────────────────────────────────────────────────────

async function fetchResultsLegacy(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  scope: NonNullable<JobsQueueScope>,
): Promise<Record<string, unknown>[]> {
  let queryBuilder = supabase
    .from("jobs")
    .select("*")
    .eq("user_id", userId)
    .eq("hidden", false)
    .in("canonical_status", VISIBLE_JOB_QUEUE_STATES);

  const scopedSearchQuery = scope.searchQuery?.trim();
  const scopedLocation = scope.location?.trim();

  if (scopedSearchQuery) {
    const discoveryScope: Record<string, string> = {
      search_query: scopedSearchQuery,
    };
    if (scopedLocation) {
      discoveryScope.location = scopedLocation;
    }

    queryBuilder = queryBuilder
      .contains("raw_data", { discovery: discoveryScope })
      .order("discovered_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (scope.startedAt) {
      queryBuilder = queryBuilder.gte("discovered_at", scope.startedAt);
    }
  } else {
    queryBuilder = queryBuilder.order("created_at", { ascending: false });
  }

  const { data, error } = await queryBuilder;
  if (error) throw error;
  return (data ?? []) as Record<string, unknown>[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Core query options factory
// ─────────────────────────────────────────────────────────────────────────────

export function getJobsQueueQueryOptions<TJob>({
  scope,
  supabase,
  mapJob,
  decorateJobs,
}: JobsQueueQueryConfig<TJob>) {
  return {
    queryKey: jobsQueueKeys.list(scope),
    staleTime: 30 * 1000,
    queryFn: async (): Promise<TJob[]> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return [];
      }

      let rawRows: Record<string, unknown>[];

      // ── V2 path: fetch by agent_run_id ─────────────────────────────────────
      // When the scope carries an agentRunId (set after a successful V2 search),
      // we call get_job_search_results_for_run. This eliminates JSONB containment
      // queries and returns only verified, displayable results for the run.
      if (scope?.agentRunId) {
        try {
          const runResults = await fetchResultsByRunId(supabase, scope.agentRunId);
          rawRows = runResults.map(runResultRowToJobsRow);
        } catch {
          // V2 RPC failed — fall through to legacy query with same scope params.
          console.warn(
            "[useJobsQueue] V2 path failed; falling back to legacy query",
            { agentRunId: scope.agentRunId },
          );
          rawRows = await fetchResultsLegacy(supabase, user.id, scope);
        }
      } else {
        // ── Legacy path (no agentRunId) ─────────────────────────────────────
        rawRows = scope
          ? await fetchResultsLegacy(supabase, user.id, scope)
          : await (async () => {
              const { data, error } = await supabase
                .from("jobs")
                .select("*")
                .eq("user_id", user.id)
                .eq("hidden", false)
                .in("canonical_status", VISIBLE_JOB_QUEUE_STATES)
                .order("created_at", { ascending: false });
              if (error) throw error;
              return (data ?? []) as Record<string, unknown>[];
            })();
      }

      const mappedJobs = rawRows.map(mapJob);
      return decorateJobs ? await decorateJobs(mappedJobs) : mappedJobs;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useJobsQueue<TJob>({
  scope,
  enabled = true,
  mapJob,
  decorateJobs,
}: Omit<JobsQueueQueryConfig<TJob>, "supabase"> & { enabled?: boolean }) {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    ...getJobsQueueQueryOptions({
      scope,
      supabase,
      mapJob,
      decorateJobs,
    }),
    enabled,
  });
}
