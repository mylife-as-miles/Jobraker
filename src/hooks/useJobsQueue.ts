import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabaseClient";
import { VISIBLE_JOB_QUEUE_STATES } from "@/lib/applicationState";
import { shouldDisplayFreshRunResult } from "../../../backend/supabase/functions/_shared/discovery-freshness";

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
      scope?.agentRunId ? null : (scope?.location?.trim() ?? null),
      typeof scope?.limit === "number" ? scope.limit : null,
      scope?.agentRunId ? null : (scope?.startedAt ?? null),
    ] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// V2 query: fetch by agent_run_id
// ─────────────────────────────────────────────────────────────────────────────

async function fetchResultsByRunId(
  supabase: ReturnType<typeof createClient>,
  agentRunId: string,
): Promise<RunResultRow[]> {
  const { data, error } = await supabase.rpc("get_job_search_results_for_run", {
    p_agent_run_id: agentRunId,
  });

  if (error) {
    console.error("[useJobsQueue] V2 RPC failed, falling back", {
      agentRunId,
      error,
    });
    throw error;
  }

  // The database normally excludes duplicate run rows. Keep a client-side
  // guard so older RPC deployments cannot reintroduce previously seen jobs.
  return ((data as RunResultRow[] | null) ?? []).filter(shouldDisplayFreshRunResult);
}

/**
 * Map a RunResultRow from get_job_search_results_for_run into a shape
 * compatible with the existing jobs table row that mapJob expects.
 *
 * The returned object sets the fields that mapDbJobToUiJob reads from a
 * `jobs` table row, so no changes are needed to the mapper.
 */
export function runResultRowToJobsRow(
  row: RunResultRow,
): Record<string, unknown> {
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
  const scopedSearchQuery = scope.searchQuery?.trim();
  const scopedLocation = scope.location?.trim();

  const runQuery = async (
    includeLocation: boolean,
    includeStartedAt: boolean,
    visibleQueueOnly = true,
  ): Promise<Record<string, unknown>[]> => {
    let queryBuilder = supabase
      .from("jobs")
      .select("*")
      .eq("user_id", userId)
      .eq("hidden", false);

    if (visibleQueueOnly) {
      queryBuilder = queryBuilder.in(
        "canonical_status",
        VISIBLE_JOB_QUEUE_STATES,
      );
    }

    if (!scopedSearchQuery) {
      const { data, error } = await queryBuilder.order("created_at", {
        ascending: false,
      });
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    }

    const discoveryScope: Record<string, string> = {
      search_query: scopedSearchQuery,
    };
    if (includeLocation && scopedLocation) {
      discoveryScope.location = scopedLocation;
    }

    queryBuilder = queryBuilder
      .contains("raw_data", { discovery: discoveryScope })
      .order("discovered_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (includeStartedAt && scope.startedAt) {
      queryBuilder = queryBuilder.gte("discovered_at", scope.startedAt);
    }

    const { data, error } = await queryBuilder;
    if (error) throw error;
    return (data ?? []) as Record<string, unknown>[];
  };

  let rows = await runQuery(Boolean(scopedLocation), true);
  if (rows.length === 0 && scopedSearchQuery && scopedLocation) {
    rows = await runQuery(false, true);
  }
  if (rows.length === 0 && scopedSearchQuery && scope.startedAt) {
    rows = await runQuery(false, false);
  }
  if (rows.length === 0 && scopedSearchQuery) {
    rows = await runQuery(false, false, false);
  }

  return rows;
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
          const runResults = await fetchResultsByRunId(
            supabase,
            scope.agentRunId,
          );
          rawRows = runResults.map(runResultRowToJobsRow);
          // A completed run with zero fresh rows is a valid result. Do not
          // broaden it into historical jobs from previous searches.
        } catch (error) {
          // Never replace a failed run-scoped lookup with historical jobs.
          // React Query will expose the recoverable error and can retry the
          // same agentRunId without corrupting the visible result set.
          console.error("[useJobsQueue] V2 run lookup failed", {
            agentRunId: scope.agentRunId,
            error,
          });
          throw error;
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
