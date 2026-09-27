import type { AtsAdapter, NormalizedJob, NormalizedQuestion } from "./types.ts";
import { classifyQuestion } from "./questions.ts";
import { classifyLocation, mentionsWorldwide } from "./location.ts";
import { htmlToText } from "./text.ts";

// Greenhouse Job Board API (public, no auth):
//   list: https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true
//   job:  https://boards-api.greenhouse.io/v1/boards/{token}/jobs/{id}?questions=true
const BASE = "https://boards-api.greenhouse.io/v1/boards";

export function normalizeGreenhouseQuestions(detail: any): NormalizedQuestion[] {
  const out: NormalizedQuestion[] = [];
  for (const q of Array.isArray(detail?.questions) ? detail.questions : []) {
    const fields = Array.isArray(q?.fields) ? q.fields : [];
    const first = fields[0] ?? {};
    const options = fields.flatMap((f: any) => (Array.isArray(f?.values) ? f.values : []))
      .map((v: any) => String(v?.label ?? ""))
      .filter(Boolean);
    out.push({
      label: String(q?.label ?? "").trim(),
      required: Boolean(q?.required),
      key: classifyQuestion(q?.label),
      kind: String(first?.type ?? "unknown"),
      ...(options.length ? { options } : {}),
    });
  }
  if (Array.isArray(detail?.location_questions) && detail.location_questions.length) {
    out.push({
      label: "Location",
      required: detail.location_questions.some((q: any) => q?.required),
      key: "location_current",
      kind: "location",
    });
  }
  return out;
}

export function normalizeGreenhouseJob(
  job: any,
  companyName: string,
  questions: NormalizedQuestion[] | null | undefined,
): NormalizedJob {
  const locationText = job?.location?.name ? String(job.location.name) : null;
  const classified = classifyLocation(locationText);
  const remoteScope = mentionsWorldwide(job?.title) && classified.remoteScope !== "hybrid"
    ? "worldwide"
    : classified.remoteScope;
  const { countries } = classified;
  return {
    externalId: String(job.id),
    title: String(job.title ?? "").trim(),
    companyName,
    locationText,
    remoteScope,
    countries,
    department: job?.departments?.[0]?.name ?? null,
    employmentType: null,
    applyUrl: String(job.absolute_url),
    jobUrl: String(job.absolute_url),
    descriptionText: job?.content ? htmlToText(job.content) : null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryPeriod: null,
    questions,
    postedAt: job?.first_published ?? null,
    sourceUpdatedAt: job?.updated_at ?? null,
  };
}

export const greenhouseAdapter: AtsAdapter = {
  ats: "greenhouse",
  async fetchJobs(company, fetchJson, options = {}) {
    const token = encodeURIComponent(company.boardToken);
    const list: any = await fetchJson(`${BASE}/${token}/jobs?content=true`);
    const jobs: any[] = Array.isArray(list?.jobs) ? list.jobs : [];
    const out: NormalizedJob[] = [];
    // One detail request per job for its questions; skip unchanged jobs and
    // run a few at a time to stay polite and inside the function time limit.
    const CONCURRENCY = 6;
    for (let i = 0; i < jobs.length; i += CONCURRENCY) {
      const chunk = jobs.slice(i, i + CONCURRENCY);
      const results = await Promise.all(chunk.map(async (job) => {
        if (options.unchanged?.(String(job.id), job?.updated_at ?? null)) {
          return normalizeGreenhouseJob(job, company.name, undefined);
        }
        try {
          const detail = await fetchJson(`${BASE}/${token}/jobs/${job.id}?questions=true`);
          return normalizeGreenhouseJob(job, company.name, normalizeGreenhouseQuestions(detail));
        } catch {
          return normalizeGreenhouseJob(job, company.name, null);
        }
      }));
      out.push(...results);
    }
    return out;
  },
};
