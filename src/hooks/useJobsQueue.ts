import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabaseClient";
import { VISIBLE_JOB_QUEUE_STATES } from "@/lib/applicationState";

export type JobsQueueScope = {
  searchQuery: string;
  location: string;
  limit?: number;
  startedAt?: string;
} | null;

interface JobsQueueQueryConfig<TJob> {
  scope: JobsQueueScope;
  supabase: ReturnType<typeof createClient>;
  mapJob: (dbJob: any) => TJob;
  decorateJobs?: (jobs: TJob[]) => Promise<TJob[]>;
}

export const jobsQueueKeys = {
  all: ["jobs-queue"] as const,
  list: (scope: JobsQueueScope) =>
    [
      ...jobsQueueKeys.all,
      scope?.searchQuery?.trim() || null,
      scope?.location?.trim() || null,
      typeof scope?.limit === "number" ? scope.limit : null,
      scope?.startedAt || null,
    ] as const,
};

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

      let queryBuilder = supabase
        .from("jobs")
        .select("*")
        .eq("user_id", user.id)
        .eq("hidden", false)
        .in("canonical_status", VISIBLE_JOB_QUEUE_STATES);

      const scopedSearchQuery = scope?.searchQuery?.trim();
      const scopedLocation = scope?.location?.trim();
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

        if (scope?.startedAt) {
          queryBuilder = queryBuilder.gte("discovered_at", scope.startedAt);
        }


      } else {
        queryBuilder = queryBuilder.order("created_at", { ascending: false });
      }

      const { data, error } = await queryBuilder;
      if (error) {
        throw error;
      }

      const mappedJobs = ((data || []) as any[]).map(mapJob);
      return decorateJobs ? await decorateJobs(mappedJobs) : mappedJobs;
    },
  };
}

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
