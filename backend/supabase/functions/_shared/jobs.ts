import type { DiscoveryJob } from "./discovery-hybrid.ts";

type JobRowInput = Record<string, unknown> & {
  id?: string;
  user_id: string;
  source_id?: string | null;
};

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
    return existing ? { ...row, id: existing.id } : row;
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
  const rows = jobs.map((job) => {
    const rawData = toRecord(job.raw_data);
    const discovery = toRecord(rawData.discovery);

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
      is_tracked_company: job.is_tracked_company,
      discovered_at: nowIso,
      last_verified_at: nowIso,
      description: job.description,
      posted_at: job.posted_at,
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

  const { data, error } = await serviceClient
    .from("jobs")
    .upsert(rowsWithIds, { onConflict: "user_id,source_type,source_id" })
    .select("id");

  if (error) {
    throw error;
  }

  return {
    jobsInserted: data?.length ?? jobs.length,
    rows: rowsWithIds,
  };
}
