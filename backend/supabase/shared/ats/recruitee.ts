import type { AtsAdapter, NormalizedJob, NormalizedQuestion } from "./types.ts";
import { classifyQuestion } from "./questions.ts";
import { classifyLocation, mentionsWorldwide } from "./location.ts";
import { htmlToText } from "./text.ts";

// Recruitee Careers Site API (public, no auth):
//   https://{company}.recruitee.com/api/offers/
// Each offer carries open_questions; name, email and CV are standard fields.
const STANDARD_FIELDS: NormalizedQuestion[] = [
  { label: "Full name", required: true, key: "first_name", kind: "text" },
  { label: "Email", required: true, key: "email", kind: "text" },
  { label: "Phone", required: false, key: "phone", kind: "text" },
  { label: "CV / resume", required: true, key: "resume", kind: "file" },
];

export function normalizeRecruiteeQuestions(offer: any): NormalizedQuestion[] {
  const custom = (Array.isArray(offer?.open_questions) ? offer.open_questions : [])
    .filter((q: any) => q?.kind !== "infobox")
    .map((q: any): NormalizedQuestion => {
      const options = (Array.isArray(q?.open_question_options) ? q.open_question_options : [])
        .map((o: any) => String(o?.body ?? ""))
        .filter(Boolean);
      return {
        label: String(q?.body ?? "").trim(),
        required: Boolean(q?.required),
        key: classifyQuestion(q?.body),
        kind: String(q?.kind ?? "unknown"),
        ...(options.length ? { options } : {}),
      };
    });
  return [...STANDARD_FIELDS, ...custom];
}

export function normalizeRecruiteeOffer(offer: any, companyName: string): NormalizedJob {
  const loc = Array.isArray(offer?.locations) ? offer.locations[0] : null;
  const locationText =
    [loc?.city, loc?.country].filter(Boolean).join(", ") || offer?.location || null;
  const countries = (Array.isArray(offer?.locations) ? offer.locations : [])
    .map((l: any) => l?.country_code)
    .filter(Boolean);
  const { remoteScope, countries: detected } = classifyLocation(locationText, {
    remote: offer?.remote,
    hybrid: offer?.hybrid,
    countries,
  });
  const salary = offer?.salary ?? {};
  const toNum = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
  return {
    externalId: String(offer.id),
    title: String(offer.title ?? "").trim(),
    companyName: offer?.company_name ? String(offer.company_name) : companyName,
    locationText,
    // A fully remote offer with no country list, or one whose title says
    // worldwide/anywhere, is open worldwide.
    remoteScope:
      remoteScope !== "hybrid" &&
        ((offer?.remote && countries.length === 0 && remoteScope === "restricted") || mentionsWorldwide(offer?.title))
        ? "worldwide"
        : remoteScope,
    countries: detected,
    department: offer?.department ?? null,
    employmentType: offer?.employment_type_code ?? null,
    applyUrl: String(offer.careers_apply_url ?? offer.careers_url),
    jobUrl: offer?.careers_url ?? null,
    descriptionText: htmlToText([offer?.description, offer?.requirements].filter(Boolean).join("\n")) || null,
    salaryMin: toNum(salary?.min),
    salaryMax: toNum(salary?.max),
    salaryCurrency: salary?.currency ?? null,
    salaryPeriod: salary?.period ?? null,
    questions: normalizeRecruiteeQuestions(offer),
    postedAt: offer?.published_at ?? offer?.created_at ?? null,
    sourceUpdatedAt: offer?.updated_at ?? null,
  };
}

export const recruiteeAdapter: AtsAdapter = {
  ats: "recruitee",
  async fetchJobs(company, fetchJson) {
    const slug = encodeURIComponent(company.boardToken);
    const data: any = await fetchJson(`https://${slug}.recruitee.com/api/offers/`);
    const offers: any[] = Array.isArray(data?.offers) ? data.offers : [];
    return offers
      .filter((o) => !o?.status || o.status === "published")
      .map((o) => normalizeRecruiteeOffer(o, company.name));
  },
};
