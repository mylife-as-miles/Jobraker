// Syncs the ATS job index (public.ats_companies / public.ats_jobs) from ATS
// public job-board APIs. Server-to-server only: requires the x-internal-secret
// header to match ATS_SYNC_SECRET, and fails closed when that is not set.
//
// POST body (all optional): { "limit": 3, "companyIds": ["uuid", ...] }
import { createClient } from "npm:@supabase/supabase-js@2";
import { ATS_ADAPTERS, type AtsName, type NormalizedJob } from "../../shared/ats/index.ts";

const TIME_BUDGET_MS = 300_000; // stop starting new companies well before the 400 s limit
const FETCH_TIMEOUT_MS = 15_000;
const UPSERT_CHUNK = 200;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "JobRaker-ATS-Sync/1.0" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${new URL(url).host}`);
  return res.json();
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "JobRaker-ATS-Sync/1.0" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${new URL(url).host}`);
  return res.text();
}

// Platforms whose per-job detail request carries questions; for the others
// an unchanged source timestamp alone is enough to skip the detail request.
const QUESTION_PLATFORMS = new Set(["greenhouse"]);

const toRow = (job: NormalizedJob, companyId: string, ats: string, nowIso: string) => ({
  company_id: companyId,
  ats,
  external_id: job.externalId,
  title: job.title,
  company_name: job.companyName,
  location_text: job.locationText,
  remote_scope: job.remoteScope,
  countries: job.countries,
  department: job.department,
  employment_type: job.employmentType,
  // Skipped details must not overwrite stored description/salary/URLs.
  ...(job.partial
    ? {}
    : {
      apply_url: job.applyUrl,
      job_url: job.jobUrl,
      description_text: job.descriptionText,
      salary_min: job.salaryMin,
      salary_max: job.salaryMax,
      salary_currency: job.salaryCurrency,
      salary_period: job.salaryPeriod,
    }),
  posted_at: job.postedAt,
  source_updated_at: job.sourceUpdatedAt,
  status: "open",
  closed_at: null,
  last_seen_at: nowIso,
  // questions / questions_known only when this sync fetched them (see below).
  ...(job.questions === undefined
    ? {}
    : { questions: job.questions, questions_known: Array.isArray(job.questions) }),
});

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const expected = (Deno.env.get("ATS_SYNC_SECRET") || "").trim();
  if (!expected) return json(503, { error: "ats_sync_secret_not_configured" });
  const provided = (req.headers.get("x-internal-secret") || "").trim();
  if (!provided || !constantTimeEquals(provided, expected)) return json(401, { error: "Unauthorized" });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  let body: any = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }
  const limit = Math.min(Math.max(Number(body?.limit) || 3, 1), 20);
  const companyIds: string[] = Array.isArray(body?.companyIds) ? body.companyIds.filter((v: unknown) => typeof v === "string") : [];

  let query = supabase
    .from("ats_companies")
    .select("id, ats, board_token, name")
    .eq("active", true)
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (companyIds.length) query = query.in("id", companyIds);
  const { data: companies, error: companiesError } = await query;
  if (companiesError) return json(500, { error: companiesError.message });

  const started = Date.now();
  const results: Array<Record<string, unknown>> = [];

  for (const company of companies ?? []) {
    if (Date.now() - started > TIME_BUDGET_MS) {
      results.push({ company: company.name, skipped: "time_budget" });
      continue;
    }
    const adapter = ATS_ADAPTERS[company.ats as AtsName];
    const syncStartIso = new Date().toISOString();
    if (!adapter) {
      await supabase.from("ats_companies").update({
        last_synced_at: syncStartIso, last_sync_status: "unsupported", last_sync_error: `No adapter for ${company.ats}`,
        updated_at: syncStartIso,
      }).eq("id", company.id);
      results.push({ company: company.name, status: "unsupported" });
      continue;
    }

    try {
      // Existing jobs, so unchanged ones skip their per-job question request.
      const { data: existing } = await supabase
        .from("ats_jobs")
        .select("external_id, source_updated_at, questions_known")
        .eq("company_id", company.id);
      const known = new Map((existing ?? []).map((r: any) => [r.external_id, r]));
      const unchanged = (externalId: string, updatedAt: string | null) => {
        const row: any = known.get(externalId);
        const questionsOk = row?.questions_known || !QUESTION_PLATFORMS.has(company.ats);
        return Boolean(row && questionsOk && updatedAt && row.source_updated_at &&
          new Date(row.source_updated_at).getTime() === new Date(updatedAt).getTime());
      };

      const jobs = await adapter.fetchJobs(
        { ats: company.ats as AtsName, boardToken: company.board_token, name: company.name },
        fetchJson,
        { unchanged, fetchText },
      );

      // Upsert rows grouped by their column set: a bulk upsert writes NULL
      // for columns a row lacks, so an unchanged job (no fresh questions or
      // details) must never share a batch with fully fetched rows.
      const rows = jobs.filter((j) => j.applyUrl && j.title).map((j) => toRow(j, company.id, company.ats, syncStartIso));
      const withQuestions = rows.filter((r) => "questions" in r);
      const withoutQuestions = rows.filter((r) => !("questions" in r));
      const groups = new Map<string, typeof rows>();
      for (const row of rows) {
        const signature = Object.keys(row).sort().join(",");
        groups.set(signature, [...(groups.get(signature) ?? []), row]);
      }
      for (const group of groups.values()) {
        for (let i = 0; i < group.length; i += UPSERT_CHUNK) {
          const { error } = await supabase
            .from("ats_jobs")
            .upsert(group.slice(i, i + UPSERT_CHUNK), { onConflict: "company_id,external_id" });
          if (error) throw new Error(`upsert failed: ${error.message}`);
        }
      }

      // Anything not seen in this sync has been taken down by the employer.
      const { error: closeError } = await supabase
        .from("ats_jobs")
        .update({ status: "closed", closed_at: syncStartIso })
        .eq("company_id", company.id)
        .eq("status", "open")
        .lt("last_seen_at", syncStartIso);
      if (closeError) throw new Error(`close failed: ${closeError.message}`);

      await supabase.from("ats_companies").update({
        last_synced_at: syncStartIso, last_sync_status: "ok", last_sync_error: null,
        open_job_count: rows.length, updated_at: syncStartIso,
      }).eq("id", company.id);
      results.push({
        company: company.name, status: "ok", open: rows.length,
        questionsFetched: withQuestions.length, unchanged: withoutQuestions.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabase.from("ats_companies").update({
        last_synced_at: syncStartIso, last_sync_status: "error", last_sync_error: message.slice(0, 500),
        updated_at: syncStartIso,
      }).eq("id", company.id);
      results.push({ company: company.name, status: "error", error: message });
    }
  }

  return json(200, { processed: results.length, elapsedMs: Date.now() - started, results });
});
