// Adapters for SmartRecruiters, Workable, Teamtailor, Breezy HR, Rippling and
// BambooHR. None of these expose application questions publicly.
import type { AtsAdapter, NormalizedJob, RemoteScope } from "./types.ts";
import { classifyLocation, mentionsWorldwide } from "./location.ts";
import { htmlToText } from "./text.ts";
import { parseSalarySummary } from "./salary.ts";

type Base = Omit<NormalizedJob, "remoteScope" | "countries"> & { remoteScope?: RemoteScope; countries?: string[] };

// Shared location handling: structured hints first, then the text, then an
// explicit "worldwide/anywhere" in the title or location wins.
function finish(
  job: Base,
  hints: { remote?: boolean | null; hybrid?: boolean | null; countries?: string[] },
): NormalizedJob {
  const worldwide = mentionsWorldwide(job.title) || mentionsWorldwide(job.locationText);
  const c = classifyLocation(job.locationText, { ...hints, countries: worldwide ? [] : hints.countries });
  const remoteScope: RemoteScope = worldwide && c.remoteScope !== "hybrid" ? "worldwide" : c.remoteScope;
  return { ...job, remoteScope, countries: worldwide ? [] : c.countries } as NormalizedJob;
}

const blank = {
  department: null, employmentType: null, jobUrl: null, descriptionText: null,
  salaryMin: null, salaryMax: null, salaryCurrency: null, salaryPeriod: null,
  questions: null, postedAt: null, sourceUpdatedAt: null,
};

// ---------- SmartRecruiters ----------
// List: https://api.smartrecruiters.com/v1/companies/{id}/postings?limit=100&offset=N
// Detail (description, compensation, applyUrl): .../postings/{postingId}
const SR = "https://api.smartrecruiters.com/v1/companies";

export function normalizeSmartRecruiters(item: any, detail: any | null, companyName: string): NormalizedJob {
  const loc = item?.location ?? {};
  const locationText = [loc?.city, loc?.region, loc?.country?.toUpperCase?.()].filter(Boolean).join(", ") || null;
  const sections = detail?.jobAd?.sections ?? {};
  const description = [sections?.jobDescription?.text, sections?.qualifications?.text, sections?.additionalInformation?.text]
    .filter(Boolean).join("\n");
  const comp = detail?.compensation ?? null;
  const company = item?.company?.identifier ?? "";
  const url = detail?.applyUrl ?? detail?.postingUrl ?? `https://jobs.smartrecruiters.com/${company}/${item.id}`;
  return finish({
    ...blank,
    externalId: String(item.id),
    title: String(item.name ?? "").trim(),
    companyName: item?.company?.name ?? companyName,
    locationText,
    department: item?.department?.label ?? null,
    employmentType: item?.typeOfEmployment?.label ?? null,
    applyUrl: String(url),
    jobUrl: detail?.postingUrl ?? String(url),
    descriptionText: description ? htmlToText(description) : null,
    salaryMin: typeof comp?.min === "number" ? comp.min : null,
    salaryMax: typeof comp?.max === "number" ? comp.max : null,
    salaryCurrency: comp?.currency ?? null,
    salaryPeriod: comp?.period ? String(comp.period).toLowerCase() : null,
    postedAt: item?.releasedDate ?? null,
    sourceUpdatedAt: item?.releasedDate ?? null,
  }, { remote: loc?.remote === true || loc?.fullyRemote === true, hybrid: loc?.hybrid === true, countries: loc?.country ? [String(loc.country)] : [] });
}

export const smartRecruitersAdapter: AtsAdapter = {
  ats: "smartrecruiters",
  async fetchJobs(company, fetchJson, options = {}) {
    const id = encodeURIComponent(company.boardToken);
    const items: any[] = [];
    for (let offset = 0, page = 0; page < 20; page++, offset += 100) {
      const data: any = await fetchJson(`${SR}/${id}/postings?limit=100&offset=${offset}`);
      const content: any[] = Array.isArray(data?.content) ? data.content : [];
      items.push(...content);
      if (content.length < 100 || items.length >= Number(data?.totalFound ?? 0)) break;
    }
    const out: NormalizedJob[] = [];
    for (let i = 0; i < items.length; i += 6) {
      const chunk = items.slice(i, i + 6);
      out.push(...await Promise.all(chunk.map(async (item) => {
        const pastDeadline = options.deadline !== undefined && Date.now() > options.deadline;
        if (pastDeadline || options.unchanged?.(String(item.id), item?.releasedDate ?? null)) {
          return { ...normalizeSmartRecruiters(item, null, company.name), partial: true };
        }
        const detail = await fetchJson(`${SR}/${id}/postings/${item.id}`).catch(() => null);
        return normalizeSmartRecruiters(item, detail, company.name);
      })));
    }
    return out;
  },
};

// ---------- Workable ----------
// https://www.workable.com/api/accounts/{subdomain}?details=true
export function normalizeWorkable(job: any, companyName: string): NormalizedJob {
  const locs: any[] = Array.isArray(job?.locations) ? job.locations.filter((l: any) => !l?.hidden) : [];
  const locationText = locs.map((l) => [l?.city, l?.region, l?.country].filter(Boolean).join(", ")).filter(Boolean).join("; ")
    || [job?.city, job?.state, job?.country].filter(Boolean).join(", ") || null;
  return finish({
    ...blank,
    externalId: String(job.shortcode),
    title: String(job.title ?? "").trim(),
    companyName,
    locationText,
    department: job?.department || null,
    employmentType: job?.employment_type || null,
    applyUrl: String(job.application_url ?? job.url),
    jobUrl: job?.url ?? null,
    descriptionText: job?.description ? htmlToText(job.description) : null,
    postedAt: job?.published_on ?? job?.created_at ?? null,
    sourceUpdatedAt: job?.published_on ?? null,
  }, { remote: job?.telecommuting === true, countries: locs.map((l) => l?.countryCode).filter(Boolean) });
}

export const workableAdapter: AtsAdapter = {
  ats: "workable",
  async fetchJobs(company, fetchJson) {
    const data: any = await fetchJson(`https://www.workable.com/api/accounts/${encodeURIComponent(company.boardToken)}?details=true`);
    const jobs: any[] = Array.isArray(data?.jobs) ? data.jobs : [];
    return jobs.map((j) => normalizeWorkable(j, data?.name || company.name));
  },
};

// ---------- Teamtailor ----------
// RSS: https://{company}.teamtailor.com/jobs.rss  (remoteStatus: none | hybrid | temporary | fully)
const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? m[1].replace(/^<!\[CDATA\[|\]\]>$/g, "").trim() : null;
};

export function parseTeamtailorRss(xml: string, companyName: string): NormalizedJob[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return items.map((item) => {
    const cities = [...item.matchAll(/<tt:location>([\s\S]*?)<\/tt:location>/g)].map((m) =>
      [tag(m[1], "tt:city"), tag(m[1], "tt:country")].filter(Boolean).join(", "));
    const remoteStatus = (tag(item, "remoteStatus") ?? "").toLowerCase();
    const link = tag(item, "link") ?? "";
    const pub = tag(item, "pubDate");
    return finish({
      ...blank,
      externalId: tag(item, "guid") ?? link,
      title: htmlToText(tag(item, "title") ?? ""),
      companyName,
      locationText: cities.filter(Boolean).join("; ") || null,
      department: tag(item, "tt:department"),
      applyUrl: link,
      jobUrl: link,
      descriptionText: htmlToText(tag(item, "description") ?? "") || null,
      postedAt: pub ? new Date(pub).toISOString() : null,
      sourceUpdatedAt: pub ? new Date(pub).toISOString() : null,
    }, { remote: remoteStatus === "fully", hybrid: remoteStatus === "hybrid" });
  }).filter((j) => j.applyUrl && j.title);
}

export const teamtailorAdapter: AtsAdapter = {
  ats: "teamtailor",
  async fetchJobs(company, _fetchJson, options = {}) {
    if (!options.fetchText) throw new Error("Teamtailor adapter needs fetchText");
    // board_token is the careers host, for example "career.teamtailor.com" or "acme".
    const host = company.boardToken.includes(".") ? company.boardToken : `${company.boardToken}.teamtailor.com`;
    return parseTeamtailorRss(await options.fetchText(`https://${host}/jobs.rss`), company.name);
  },
};

// ---------- Breezy HR ----------
// https://{company}.breezy.hr/json
export function normalizeBreezy(job: any, companyName: string): NormalizedJob {
  const locs: any[] = Array.isArray(job?.locations) && job.locations.length ? job.locations : job?.location ? [job.location] : [];
  const salary = parseSalarySummary(job?.salary);
  const url = String(job?.url ?? "");
  return finish({
    ...blank,
    externalId: String(job.id),
    title: String(job.name ?? "").trim(),
    companyName: job?.company?.name ?? companyName,
    locationText: locs.map((l) => l?.name).filter(Boolean).join("; ") || null,
    department: job?.department ?? null,
    employmentType: job?.type?.name ?? null,
    applyUrl: url ? `${url.replace(/\/$/, "")}/apply` : url,
    jobUrl: url || null,
    salaryMin: salary.min,
    salaryMax: salary.max,
    salaryCurrency: salary.currency,
    salaryPeriod: /hour/i.test(String(job?.salary ?? "")) ? "hour" : salary.min !== null ? "year" : null,
    postedAt: job?.published_date ?? null,
    sourceUpdatedAt: job?.published_date ?? null,
  }, { remote: locs.some((l) => l?.is_remote === true), countries: locs.map((l) => l?.country?.id).filter(Boolean) });
}

export const breezyAdapter: AtsAdapter = {
  ats: "breezy",
  async fetchJobs(company, fetchJson) {
    const data: any = await fetchJson(`https://${encodeURIComponent(company.boardToken)}.breezy.hr/json`);
    return (Array.isArray(data) ? data : []).map((j) => normalizeBreezy(j, company.name));
  },
};

// ---------- Rippling ----------
// https://ats.rippling.com/api/v2/board/{slug}/jobs?page=N  (0-based, 20 per page)
export function normalizeRippling(job: any, companyName: string): NormalizedJob {
  const locs: any[] = Array.isArray(job?.locations) ? job.locations : [];
  const types = locs.map((l) => String(l?.workplaceType ?? "").toUpperCase());
  return finish({
    ...blank,
    externalId: String(job.id),
    title: String(job.name ?? "").trim(),
    companyName,
    locationText: locs.map((l) => l?.name).filter(Boolean).join("; ") || null,
    department: job?.department?.name ?? null,
    applyUrl: String(job.url),
    jobUrl: job?.url ?? null,
  }, {
    remote: types.includes("REMOTE"),
    hybrid: types.includes("HYBRID"),
    countries: locs.map((l) => l?.countryCode).filter(Boolean),
  });
}

export const ripplingAdapter: AtsAdapter = {
  ats: "rippling",
  async fetchJobs(company, fetchJson) {
    const slug = encodeURIComponent(company.boardToken);
    const out: NormalizedJob[] = [];
    for (let page = 0; page < 60; page++) {
      const data: any = await fetchJson(`https://ats.rippling.com/api/v2/board/${slug}/jobs?page=${page}`);
      const items: any[] = Array.isArray(data?.items) ? data.items : [];
      out.push(...items.map((j) => normalizeRippling(j, company.name)));
      if (!items.length || page + 1 >= Number(data?.totalPages ?? 0)) break;
    }
    return out;
  },
};

// ---------- BambooHR ----------
// https://{company}.bamboohr.com/careers/list  (JSON with Accept: application/json)
// locationType: "0" on-site, "1" remote, "2" hybrid (BambooHR careers convention).
export function normalizeBamboo(job: any, companyName: string, boardToken: string): NormalizedJob {
  const loc = job?.location ?? {};
  const ats = job?.atsLocation ?? {};
  const locationText = [loc?.city, String(loc?.state ?? "").trim(), ats?.country].filter(Boolean).join(", ") || null;
  const type = String(job?.locationType ?? "");
  const url = `https://${boardToken}.bamboohr.com/careers/${job.id}`;
  return finish({
    ...blank,
    externalId: String(job.id),
    title: String(job.jobOpeningName ?? "").trim(),
    companyName,
    locationText,
    department: job?.departmentLabel ?? null,
    employmentType: job?.employmentStatusLabel ?? null,
    applyUrl: url,
    jobUrl: url,
  }, { remote: job?.isRemote === true || type === "1", hybrid: type === "2" });
}

export const bambooAdapter: AtsAdapter = {
  ats: "bamboohr",
  async fetchJobs(company, fetchJson) {
    const token = encodeURIComponent(company.boardToken);
    const data: any = await fetchJson(`https://${token}.bamboohr.com/careers/list`);
    return (Array.isArray(data?.result) ? data.result : []).map((j: any) => normalizeBamboo(j, company.name, token));
  },
};
