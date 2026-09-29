import { getAutoApplyReadiness, WORKABLE_FROM_OPTIONS } from "@/lib/atsReadiness";
import type { ProfileAnswers } from "../../backend/supabase/shared/application-profile";

// Guards for bulk auto-apply (fixed product rules).
export const BULK_MIN_MATCH_SCORE = 55;
export const BULK_MAX_PER_EMPLOYER_30D = 2;

export type BulkJobInput = {
  id: string;
  title?: string | null;
  company?: string | null;
  location?: string | null;
  matchScore?: number | null;
  raw_data?: unknown;
};

export type BulkPlanItem = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  matchScore: number | null;
  // ready: all questions covered; unknown: questions not published; needs: will stop to ask.
  readiness: "ready" | "unknown" | "needs";
  missing?: string[];
  reason?: string;
};

export type BulkPlan = { selected: BulkPlanItem[]; skipped: BulkPlanItem[] };

export const companyKey = (company: string | null | undefined) =>
  String(company ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const CITY_HINTS: Record<string, string> = { lagos: "NG", abuja: "NG", enugu: "NG", nairobi: "KE", london: "GB" };

// Best-effort ISO country from free text such as "Lagos, Nigeria".
export function countryFromText(text: string | null | undefined): string | null {
  const t = String(text ?? "").toLowerCase();
  if (!t) return null;
  for (const o of WORKABLE_FROM_OPTIONS) {
    if (o.code.length === 2 && t.includes(o.label.toLowerCase())) return o.code;
  }
  for (const [city, code] of Object.entries(CITY_HINTS)) if (t.includes(city)) return code;
  return null;
}

const countryName = (code: string) => WORKABLE_FROM_OPTIONS.find((o) => o.code === code)?.label ?? code;

// Picks which jobs a bulk run may apply to: fit >= 55%, workable from the
// candidate's country, and at most 2 applications per employer in 30 days
// (counting applications already sent). Everything else is skipped with a
// reason the user can see (and override by ticking it).
export function planBulkApply(
  jobs: BulkJobInput[],
  opts: { country: string | null; recentByCompany: Record<string, number>; answers?: ProfileAnswers | null },
): BulkPlan {
  const selected: BulkPlanItem[] = [];
  const skipped: BulkPlanItem[] = [];
  const planned: Record<string, number> = {};
  // Jobs that will not stop to ask go first, then unknown, then those that
  // will ask; best match first within each group. Runs are submitted in this order.
  const RANK = { ready: 0, unknown: 1, needs: 2 } as const;
  const withReadiness = jobs.map((job) => ({ job, readiness: getAutoApplyReadiness(job, opts.answers ?? null, opts.country) }));
  const ordered = withReadiness.sort((a, b) =>
    RANK[a.readiness.state] - RANK[b.readiness.state] || (b.job.matchScore ?? -1) - (a.job.matchScore ?? -1));

  for (const { job, readiness } of ordered) {
    const item: BulkPlanItem = {
      id: job.id,
      title: String(job.title ?? "Untitled role"),
      company: String(job.company ?? "Unknown company"),
      location: job.location ?? null,
      matchScore: typeof job.matchScore === "number" ? Math.round(job.matchScore) : null,
      readiness: readiness.state,
      ...(readiness.state === "needs" ? { missing: readiness.missing } : {}),
    };
    const skip = (reason: string) => skipped.push({ ...item, reason });

    if (item.matchScore === null) { skip("Not scored yet"); continue; }
    if (item.matchScore < BULK_MIN_MATCH_SCORE) { skip(`Below ${BULK_MIN_MATCH_SCORE}% fit`); continue; }

    const ats = (job.raw_data as { ats?: { remote_scope?: string; countries?: string[] } } | null)?.ats;
    if (!ats?.remote_scope) { skip("Location not verified"); continue; }
    if (opts.country && ats.remote_scope !== "worldwide") {
      const countries = Array.isArray(ats.countries) ? ats.countries : [];
      if (!countries.includes(opts.country)) {
        const where = ats.remote_scope === "onsite" || ats.remote_scope === "hybrid" ? `${ats.remote_scope === "onsite" ? "On-site" : "Hybrid"} role` : "Remote role";
        skip(`${where} not open to ${countryName(opts.country)}`);
        continue;
      }
    }

    const key = companyKey(job.company);
    const used = (opts.recentByCompany[key] ?? 0) + (planned[key] ?? 0);
    if (key && used >= BULK_MAX_PER_EMPLOYER_30D) {
      skip(`Already ${BULK_MAX_PER_EMPLOYER_30D} applications to ${item.company} this month`);
      continue;
    }
    planned[key] = (planned[key] ?? 0) + 1;
    selected.push(item);
  }
  return { selected, skipped };
}
