import type { AtsAdapter, NormalizedJob, RemoteScope } from "./types.ts";
import { classifyLocation, mentionsWorldwide, titleSaysWorldwide } from "./location.ts";

// Lever postings API (no auth):
//   https://api.lever.co/v0/postings/{site}?mode=json   (EU: api.eu.lever.co)
// Custom application questions are not exposed publicly.
const BASES = ["https://api.lever.co/v0/postings", "https://api.eu.lever.co/v0/postings"];

export function normalizeLeverPosting(posting: any, companyName: string): NormalizedJob {
  const cats = posting?.categories ?? {};
  const all: string[] = Array.isArray(cats?.allLocations) ? cats.allLocations.map(String) : [];
  const locationText = [cats?.location, ...all.filter((l) => l !== cats?.location)].filter(Boolean).join("; ") || null;
  const workplace = String(posting?.workplaceType ?? "").toLowerCase();
  const worldwide = mentionsWorldwide(locationText) || titleSaysWorldwide(posting?.text);
  // `country` is the posting's legal entity; ignore it when the location
  // itself says Global/Anywhere, or a worldwide role becomes single-country.
  const classified = classifyLocation(locationText, {
    remote: workplace === "remote",
    hybrid: workplace === "hybrid",
    countries: !worldwide && posting?.country ? [String(posting.country)] : [],
  });
  const remoteScope: RemoteScope = worldwide && classified.remoteScope !== "hybrid" ? "worldwide" : classified.remoteScope;
  const range = posting?.salaryRange ?? null;
  const createdAt = typeof posting?.createdAt === "number" ? new Date(posting.createdAt).toISOString() : null;
  return {
    externalId: String(posting.id),
    title: String(posting.text ?? "").trim(),
    companyName,
    locationText,
    remoteScope,
    countries: worldwide ? [] : classified.countries,
    department: cats?.department ?? cats?.team ?? null,
    employmentType: cats?.commitment ?? null,
    applyUrl: String(posting.applyUrl ?? posting.hostedUrl),
    jobUrl: posting?.hostedUrl ?? null,
    descriptionText: [posting?.descriptionPlain, posting?.additionalPlain].filter(Boolean).join("\n\n") || null,
    salaryMin: typeof range?.min === "number" ? range.min : null,
    salaryMax: typeof range?.max === "number" ? range.max : null,
    salaryCurrency: range?.currency ?? null,
    salaryPeriod: range?.interval ?? null,
    questions: null,
    postedAt: createdAt,
    sourceUpdatedAt: createdAt,
  };
}

export const leverAdapter: AtsAdapter = {
  ats: "lever",
  async fetchJobs(company, fetchJson) {
    let lastError: unknown = null;
    for (const base of BASES) {
      try {
        const data: any = await fetchJson(`${base}/${encodeURIComponent(company.boardToken)}?mode=json`);
        const postings: any[] = Array.isArray(data) ? data : [];
        return postings.map((p) => normalizeLeverPosting(p, company.name));
      } catch (err) {
        lastError = err; // site may live on the EU instance
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Lever fetch failed");
  },
};
