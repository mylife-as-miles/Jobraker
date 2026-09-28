// Job discovery from the ATS job index (public.ats_jobs) instead of the open
// web. Returns DiscoveryJob rows in the same shape as the Firecrawl discovery,
// so persistDiscoveredJobs, credits settlement, the task flow and the Jobs page
// are unchanged. Every result is a real posting with a direct apply URL.
import { detectCountries } from "../../shared/ats/location.ts";

// Structural copies of the DiscoveryJob/DiscoveryResult shapes in
// discovery-hybrid.ts. Importing that file (even type-only) would pull its
// Deno-only dependencies into the app typecheck via this module's tests.
type DiscoveryJob = {
  title: string;
  company: string;
  location: string | null;
  url: string;
  description: string;
  posted_at: string | null;
  source_id: string;
  source_type: "adapter" | "web_search";
  source_kind: any;
  source_confidence: number;
  verification_status: "verified" | "stale" | "failed" | "unverified";
  is_tracked_company: boolean;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  raw_data: Record<string, unknown>;
};
type DiscoveryResult = { jobs: DiscoveryJob[]; warnings: string[] };

interface AtsIndexDiscoveryArgs {
  serviceClient: any;
  userId: string;
  searchQuery: string;
  location: string;
  limit: number;
  // Chosen by the user on the Jobs page; "ANY" = no country filter.
  workableFrom?: string;
}

const KNOWN_SOURCE_KINDS = new Set(["greenhouse", "lever", "ashby", "workable"]);
const REMOTE_LOCATION = /^\s*$|remote|anywhere|worldwide|global/i;
const BATCH_SIZE = 10;

// Users on the allowlist (ATS_INDEX_SEARCH_USERS, comma-separated user ids),
// or everyone when ATS_INDEX_SEARCH_ALL=true, search the index.
// Read through globalThis so this module also typechecks outside Deno (tests).
const envVar = (name: string): string => String((globalThis as any).Deno?.env?.get(name) ?? "");

export function useAtsIndexFor(userId: string): boolean {
  if (envVar("ATS_INDEX_SEARCH_ALL").trim().toLowerCase() === "true") return true;
  const allow = envVar("ATS_INDEX_SEARCH_USERS")
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);
  return allow.includes(userId);
}

async function userCountry(serviceClient: any, userId: string): Promise<string | null> {
  const { data } = await serviceClient.from("profiles").select("location").eq("id", userId).maybeSingle();
  return detectCountries(typeof data?.location === "string" ? data.location : null)[0] ?? null;
}

export async function discoverJobsFromAtsIndex(
  args: AtsIndexDiscoveryArgs,
  onBatch?: (jobs: DiscoveryJob[]) => Promise<void>,
): Promise<DiscoveryResult> {
  const { serviceClient, userId, searchQuery, location } = args;
  const limit = Math.max(1, Math.min(Number(args.limit) || 20, 100));
  const remoteSearch = REMOTE_LOCATION.test(location || "");
  const chosen = (args.workableFrom || "").trim().toUpperCase();
  // An explicit choice wins ("ANY" = no filter). Otherwise: remote search
  // uses the profile country; a location search uses that location's country.
  const homeCountry = chosen ? null : await userCountry(serviceClient, userId);
  const workableFrom = chosen
    ? (chosen === "ANY" ? null : chosen)
    : remoteSearch ? homeCountry : (detectCountries(location)[0] ?? homeCountry);

  const { data: hits, error } = await serviceClient.rpc("search_ats_jobs", {
    p_query: searchQuery,
    p_workable_from: workableFrom,
    p_remote_scopes: remoteSearch ? ["worldwide", "restricted"] : null,
    p_limit: limit,
    p_offset: 0,
  });
  if (error) throw new Error(`ATS index search failed: ${error.message}`);
  const rows: any[] = Array.isArray(hits) ? hits : [];
  if (!rows.length) {
    return {
      jobs: [],
      warnings: [
        workableFrom
          ? `No open jobs in our index match "${searchQuery}" for candidates in ${workableFrom}. Try a broader title.`
          : `No open jobs in our index match "${searchQuery}". Try a broader title.`,
      ],
    };
  }

  // The search API omits long fields; load description, ids and questions.
  const { data: details, error: detailError } = await serviceClient
    .from("ats_jobs")
    .select("id, external_id, description_text, questions")
    .in("id", rows.map((r) => r.id));
  if (detailError) throw new Error(`ATS index detail load failed: ${detailError.message}`);
  const byId = new Map((details ?? []).map((d: any) => [d.id, d]));

  const jobs: DiscoveryJob[] = rows.map((r) => {
    const d: any = byId.get(r.id) ?? {};
    return {
      title: r.title,
      company: r.company_name,
      location: r.location_text,
      url: r.apply_url,
      description: d.description_text || "",
      posted_at: r.posted_at,
      source_id: `ats:${r.ats}:${d.external_id ?? r.id}`,
      source_type: "adapter",
      source_kind: KNOWN_SOURCE_KINDS.has(r.ats) ? r.ats : "direct",
      source_confidence: 0.95,
      verification_status: "verified",
      is_tracked_company: true,
      salary_min: r.salary_min,
      salary_max: r.salary_max,
      salary_currency: r.salary_currency,
      raw_data: {
        ats: {
          platform: r.ats,
          ats_job_id: r.id,
          company_id: r.company_id,
          remote_scope: r.remote_scope,
          countries: r.countries,
          salary_period: r.salary_period,
          questions_known: r.questions_known,
          required_question_keys: r.required_question_keys,
          questions: d.questions ?? null,
        },
        tags: [r.ats, r.remote_scope].filter(Boolean),
      },
    };
  });

  if (onBatch) {
    for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
      await onBatch(jobs.slice(i, i + BATCH_SIZE));
    }
  }
  return { jobs, warnings: [] };
}
