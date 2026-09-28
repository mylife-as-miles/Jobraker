import type { AtsAdapter, NormalizedJob, RemoteScope } from "./types.ts";
import { classifyLocation, detectCountries, mentionsWorldwide, titleSaysWorldwide } from "./location.ts";
import { parseSalarySummary } from "./salary.ts";

// Ashby public job posting API (no auth):
//   https://api.ashbyhq.com/posting-api/job-board/{name}?includeCompensation=true
// Application questions are not exposed publicly.
const BASE = "https://api.ashbyhq.com/posting-api/job-board";

export function normalizeAshbyJob(job: any, companyName: string): NormalizedJob {
  const locationText = job?.location ? String(job.location) : null;
  const secondary = (Array.isArray(job?.secondaryLocations) ? job.secondaryLocations : [])
    .map((l: any) => String(l?.location ?? l?.address?.postalAddress?.addressCountry ?? ""))
    .filter(Boolean);
  const countryHints: string[] = [...new Set<string>(secondary.flatMap((s: string) => detectCountries(s)))];
  const workplace = String(job?.workplaceType ?? "").toLowerCase();
  const classified = classifyLocation(locationText, {
    remote: job?.isRemote === true || workplace === "remote",
    hybrid: workplace === "hybrid",
    countries: countryHints,
  });
  let remoteScope: RemoteScope = classified.remoteScope;
  if (remoteScope !== "hybrid" && (titleSaysWorldwide(job?.title) || mentionsWorldwide(locationText))) remoteScope = "worldwide";
  const salary = parseSalarySummary(job?.compensation?.scrapeableCompensationSalarySummary);
  return {
    externalId: String(job.id),
    title: String(job.title ?? "").trim(),
    companyName,
    locationText: [locationText, ...secondary].filter(Boolean).join("; ") || null,
    remoteScope,
    countries: classified.countries,
    department: job?.department ?? null,
    employmentType: job?.employmentType ?? null,
    applyUrl: String(job.applyUrl ?? job.jobUrl),
    jobUrl: job?.jobUrl ?? null,
    descriptionText: job?.descriptionPlain ? String(job.descriptionPlain) : null,
    salaryMin: salary.min,
    salaryMax: salary.max,
    salaryCurrency: salary.currency,
    salaryPeriod: salary.min !== null ? "year" : null,
    questions: null,
    postedAt: job?.publishedAt ?? null,
    sourceUpdatedAt: job?.publishedAt ?? null,
  };
}

export const ashbyAdapter: AtsAdapter = {
  ats: "ashby",
  async fetchJobs(company, fetchJson) {
    const data: any = await fetchJson(`${BASE}/${encodeURIComponent(company.boardToken)}?includeCompensation=true`);
    const jobs: any[] = Array.isArray(data?.jobs) ? data.jobs : [];
    return jobs.filter((j) => j?.isListed !== false).map((j) => normalizeAshbyJob(j, company.name));
  },
};
