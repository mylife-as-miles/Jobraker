import {
  fetchCandidateMemory,
  type TrackedCompanySeed,
} from "./candidate-memory.ts";
import {
  firecrawlFetch,
  resolveFirecrawlApiKey,
  withRetry,
} from "./firecrawl.ts";

type SourceKind =
  | "greenhouse"
  | "lever"
  | "ashby"
  | "workable"
  | "direct"
  | "firecrawl";

type VerificationStatus = "verified" | "stale" | "failed" | "unverified";

export interface DiscoveryJob {
  title: string;
  company: string;
  location: string | null;
  url: string;
  description: string;
  posted_at: string | null;
  source_id: string;
  source_type: "adapter" | "web_search";
  source_kind: SourceKind;
  source_confidence: number;
  verification_status: VerificationStatus;
  is_tracked_company: boolean;
  raw_data: Record<string, unknown>;
}

interface HybridDiscoveryArgs {
  serviceClient: any;
  userId: string;
  searchQuery: string;
  location: string;
  limit: number;
}

const KNOWN_ATS_HINTS: Array<{ kind: SourceKind; match: RegExp }> = [
  { kind: "greenhouse", match: /greenhouse/i },
  { kind: "lever", match: /lever/i },
  { kind: "ashby", match: /ashby/i },
  { kind: "workable", match: /workable/i },
];

const STOP_WORDS = new Set([
  "and",
  "or",
  "the",
  "for",
  "with",
  "remote",
  "job",
  "jobs",
  "role",
  "roles",
  "hiring",
  "senior",
  "junior",
]);

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const stripHtmlTags = (value: string): string =>
  value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const safeUrl = (value: string | null | undefined): URL | null => {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const hostFromUrl = (value: string | null | undefined): string | null =>
  safeUrl(value)?.hostname.replace(/^www\./, "") ?? null;

const inferSourceKind = (
  url?: string | null,
  hint?: string | null,
): SourceKind => {
  const haystack = `${url || ""} ${hint || ""}`;
  for (const known of KNOWN_ATS_HINTS) {
    if (known.match.test(haystack)) return known.kind;
  }
  return url ? "direct" : "firecrawl";
};

const extractTerms = (query: string): string[] =>
  query
    .split(/[^a-zA-Z0-9+#./-]+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 1 && !STOP_WORDS.has(part));

const roleMatches = (job: { title: string; description: string }, query: string) => {
  const haystack = `${job.title} ${job.description}`.toLowerCase();
  const terms = extractTerms(query);
  if (terms.length === 0) return true;
  const matched = terms.filter((term) => haystack.includes(term));
  return matched.length >= Math.max(1, Math.ceil(terms.length / 3));
};

const locationMatches = (jobLocation: string | null, requestedLocation: string) => {
  const wanted = requestedLocation.trim().toLowerCase();
  if (!wanted || wanted === "remote") {
    if (!jobLocation) return true;
    return /remote|worldwide|anywhere/i.test(jobLocation);
  }
  if (!jobLocation) return true;
  return jobLocation.toLowerCase().includes(wanted);
};

const normalizeAbsoluteUrl = (value: string | null | undefined): string | null =>
  safeUrl(value)?.toString() ?? null;

const getGreenhouseBoardToken = (seed: TrackedCompanySeed): string | null => {
  const url = seed.careers_url || seed.domain;
  if (!url) return null;
  const parsed = safeUrl(url.startsWith("http") ? url : `https://${url}`);
  if (!parsed) return null;
  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  return parts[parts.length - 1];
};

const getLeverSite = (seed: TrackedCompanySeed): string | null => {
  const url = seed.careers_url || seed.domain;
  if (!url) return null;
  const parsed = safeUrl(url.startsWith("http") ? url : `https://${url}`);
  if (!parsed) return null;
  const parts = parsed.pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] || null;
};

const getAshbyBoard = (seed: TrackedCompanySeed): string | null => {
  const url = seed.careers_url || seed.domain;
  if (!url) return null;
  const parsed = safeUrl(url.startsWith("http") ? url : `https://${url}`);
  if (!parsed) return null;
  const parts = parsed.pathname.split("/").filter(Boolean);
  return parts[0] || parsed.hostname.split(".")[0] || null;
};

const getWorkableAccount = (seed: TrackedCompanySeed): string | null => {
  const url = seed.careers_url || seed.domain;
  if (!url) return null;
  const parsed = safeUrl(url.startsWith("http") ? url : `https://${url}`);
  if (!parsed) return null;
  const account =
    parsed.hostname.split(".")[0] === "apply"
      ? parsed.pathname.split("/").filter(Boolean)[0]
      : parsed.hostname.split(".")[0];
  return account || null;
};

const buildTrackedSeeds = async (
  serviceClient: any,
  userId: string,
): Promise<TrackedCompanySeed[]> => {
  const [candidateMemory, sourceSettingsRes] = await Promise.all([
    fetchCandidateMemory(serviceClient, userId),
    serviceClient
      .from("job_source_settings")
      .select("allowed_domains")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  const fromSettings = Array.isArray(sourceSettingsRes.data?.allowed_domains)
    ? sourceSettingsRes.data.allowed_domains
        .map((domain: unknown) => asString(domain))
        .filter((domain: string | null): domain is string => Boolean(domain))
        .map((domain) => ({ name: domain, domain }))
    : [];

  return [...candidateMemory.trackedCompanies, ...fromSettings].slice(0, 12);
};

const fetchGreenhouseJobs = async (
  seed: TrackedCompanySeed,
): Promise<DiscoveryJob[]> => {
  const boardToken = getGreenhouseBoardToken(seed);
  if (!boardToken) return [];
  const res = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`,
  );
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
  return jobs
    .map((job: Record<string, unknown>) => {
      const title = asString(job.title);
      const absoluteUrl = normalizeAbsoluteUrl(asString(job.absolute_url));
      if (!title || !absoluteUrl) return null;
      return {
        title,
        company: seed.name,
        location:
          asString((job.location as Record<string, unknown> | undefined)?.name) ||
          null,
        url: absoluteUrl,
        description: stripHtmlTags(asString(job.content) || ""),
        posted_at: asString(job.updated_at),
        source_id: `greenhouse:${boardToken}:${job.id}`,
        source_type: "adapter" as const,
        source_kind: "greenhouse" as const,
        source_confidence: 0.96,
        verification_status: "unverified" as const,
        is_tracked_company: true,
        raw_data: {
          provider: "greenhouse",
          board_token: boardToken,
          provider_job_id: job.id,
        },
      };
    })
    .filter((job): job is DiscoveryJob => Boolean(job));
};

const fetchLeverJobs = async (seed: TrackedCompanySeed): Promise<DiscoveryJob[]> => {
  const site = getLeverSite(seed);
  if (!site) return [];
  const res = await fetch(`https://api.lever.co/v0/postings/${site}?mode=json`);
  if (!res.ok) return [];
  const jobs = await res.json().catch(() => []);
  if (!Array.isArray(jobs)) return [];
  return jobs
    .map((job: Record<string, unknown>) => {
      const title = asString(job.text);
      const hostedUrl = normalizeAbsoluteUrl(asString(job.hostedUrl));
      if (!title || !hostedUrl) return null;
      const categories =
        job.categories && typeof job.categories === "object"
          ? (job.categories as Record<string, unknown>)
          : {};
      const description = [
        asString(job.descriptionPlain),
        asString(job.additionalPlain),
      ]
        .filter((part): part is string => Boolean(part))
        .join("\n\n");
      return {
        title,
        company: seed.name,
        location: asString(categories.location) || null,
        url: hostedUrl,
        description,
        posted_at: asString(job.createdAt),
        source_id: `lever:${site}:${job.id}`,
        source_type: "adapter" as const,
        source_kind: "lever" as const,
        source_confidence: 0.95,
        verification_status: "unverified" as const,
        is_tracked_company: true,
        raw_data: {
          provider: "lever",
          site,
          provider_job_id: job.id,
          categories,
        },
      };
    })
    .filter((job): job is DiscoveryJob => Boolean(job));
};

const fetchAshbyJobs = async (seed: TrackedCompanySeed): Promise<DiscoveryJob[]> => {
  const board = getAshbyBoard(seed);
  if (!board) return [];
  const res = await fetch(
    `https://jobs.ashbyhq.com/posting-api/job-board/${board}?includeCompensation=true`,
  );
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
  return jobs
    .map((job: Record<string, unknown>) => {
      const title = asString(job.title);
      const jobUrl =
        normalizeAbsoluteUrl(asString(job.jobUrl)) ||
        normalizeAbsoluteUrl(asString(job.applyUrl));
      if (!title || !jobUrl) return null;
      const location =
        asString(job.location) ||
        asString(job.locationName) ||
        asString((job.location as Record<string, unknown> | undefined)?.name) ||
        null;
      return {
        title,
        company: seed.name,
        location,
        url: jobUrl,
        description: stripHtmlTags(
          asString(job.descriptionHtml) ||
            asString(job.descriptionPlain) ||
            "",
        ),
        posted_at: asString(job.publishedAt) || asString(job.createdAt),
        source_id: `ashby:${board}:${job.id || title}`,
        source_type: "adapter" as const,
        source_kind: "ashby" as const,
        source_confidence: 0.95,
        verification_status: "unverified" as const,
        is_tracked_company: true,
        raw_data: {
          provider: "ashby",
          board,
          compensation: job.compensation,
        },
      };
    })
    .filter((job): job is DiscoveryJob => Boolean(job));
};

const fetchWorkableJobs = async (
  seed: TrackedCompanySeed,
): Promise<DiscoveryJob[]> => {
  const account = getWorkableAccount(seed);
  if (!account) return [];
  const res = await fetch(
    `https://www.workable.com/api/accounts/${account}?details=true`,
  );
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
  return jobs
    .map((job: Record<string, unknown>) => {
      const title =
        asString(job.title) || asString(job.full_title) || asString(job.name);
      const url =
        normalizeAbsoluteUrl(asString(job.url)) ||
        normalizeAbsoluteUrl(asString(job.shortlink)) ||
        normalizeAbsoluteUrl(asString(job.apply_url));
      if (!title || !url) return null;
      const locationObj =
        job.location && typeof job.location === "object"
          ? (job.location as Record<string, unknown>)
          : {};
      const location =
        asString(job.location) ||
        [asString(locationObj.city), asString(locationObj.country)]
          .filter((part): part is string => Boolean(part))
          .join(", ") ||
        null;
      return {
        title,
        company: seed.name,
        location,
        url,
        description: stripHtmlTags(
          asString(job.description) ||
            asString(job.requirements) ||
            asString(job.benefits) ||
            "",
        ),
        posted_at: asString(job.published) || asString(job.created_at),
        source_id: `workable:${account}:${job.id || title}`,
        source_type: "adapter" as const,
        source_kind: "workable" as const,
        source_confidence: 0.94,
        verification_status: "unverified" as const,
        is_tracked_company: true,
        raw_data: {
          provider: "workable",
          account,
        },
      };
    })
    .filter((job): job is DiscoveryJob => Boolean(job));
};

const fetchDirectCareerPageJobs = async (
  seed: TrackedCompanySeed,
): Promise<DiscoveryJob[]> => {
  if (!seed.careers_url) return [];
  const res = await fetch(seed.careers_url);
  if (!res.ok) return [];
  const html = await res.text();

  const discovered: DiscoveryJob[] = [];
  const jsonLdMatches = Array.from(
    html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  );

  for (const match of jsonLdMatches) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      const payload = JSON.parse(raw);
      const items = Array.isArray(payload) ? payload : [payload];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        if ((item as Record<string, unknown>)["@type"] !== "JobPosting") continue;
        const job = item as Record<string, unknown>;
        const title = asString(job.title);
        const url = normalizeAbsoluteUrl(asString(job.url));
        if (!title || !url) continue;
        const jobLocation =
          job.jobLocation && typeof job.jobLocation === "object"
            ? (job.jobLocation as Record<string, unknown>)
            : undefined;
        const address =
          jobLocation?.address && typeof jobLocation.address === "object"
            ? (jobLocation.address as Record<string, unknown>)
            : undefined;
        const location =
          asString(address?.addressLocality) ||
          asString(address?.addressCountry) ||
          null;
        discovered.push({
          title,
          company: seed.name,
          location,
          url,
          description: stripHtmlTags(asString(job.description) || ""),
          posted_at: asString(job.datePosted),
          source_id: `direct:${hostFromUrl(url)}:${title}`,
          source_type: "adapter",
          source_kind: "direct",
          source_confidence: 0.88,
          verification_status: "unverified",
          is_tracked_company: true,
          raw_data: {
            provider: "direct",
            careers_url: seed.careers_url,
            schema_type: "JobPosting",
          },
        });
      }
    } catch {
      continue;
    }
  }

  if (discovered.length > 0) return discovered;

  const anchorMatches = Array.from(
    html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi),
  );
  const baseUrl = new URL(seed.careers_url);
  const unique = new Map<string, DiscoveryJob>();

  for (const match of anchorMatches) {
    const href = match[1];
    const label = stripHtmlTags(match[2] || "");
    if (!href || !label) continue;
    if (!/job|career|opening|role/i.test(`${href} ${label}`)) continue;
    const absoluteUrl = new URL(href, baseUrl).toString();
    unique.set(absoluteUrl, {
      title: label,
      company: seed.name,
      location: null,
      url: absoluteUrl,
      description: "",
      posted_at: null,
      source_id: `direct:${hostFromUrl(absoluteUrl)}:${label}`,
      source_type: "adapter",
      source_kind: "direct",
      source_confidence: 0.75,
      verification_status: "unverified",
      is_tracked_company: true,
      raw_data: {
        provider: "direct",
        careers_url: seed.careers_url,
      },
    });
  }

  return Array.from(unique.values()).slice(0, 20);
};

const fetchFromSeed = async (seed: TrackedCompanySeed): Promise<DiscoveryJob[]> => {
  const sourceKind = inferSourceKind(seed.careers_url || seed.domain, seed.source_hint);
  switch (sourceKind) {
    case "greenhouse":
      return fetchGreenhouseJobs(seed);
    case "lever":
      return fetchLeverJobs(seed);
    case "ashby":
      return fetchAshbyJobs(seed);
    case "workable":
      return fetchWorkableJobs(seed);
    default:
      return fetchDirectCareerPageJobs(seed);
  }
};

const verifyJobUrl = async (url: string): Promise<VerificationStatus> => {
  const tryFetch = async (method: "HEAD" | "GET") => {
    const res = await fetch(url, {
      method,
      redirect: "follow",
      headers: {
        "user-agent": "JobrakerBot/1.0 (+https://jobraker.com)",
      },
    });
    return res.status;
  };

  try {
    const headStatus = await tryFetch("HEAD");
    if (headStatus >= 200 && headStatus < 400) return "verified";
    if (headStatus === 404 || headStatus === 410) return "stale";
  } catch {
    // Ignore and retry with GET.
  }

  try {
    const getStatus = await tryFetch("GET");
    if (getStatus >= 200 && getStatus < 400) return "verified";
    if (getStatus === 404 || getStatus === 410) return "stale";
    return "failed";
  } catch {
    return "failed";
  }
};

const verifyJobs = async (jobs: DiscoveryJob[]): Promise<DiscoveryJob[]> => {
  return Promise.all(
    jobs.map(async (job) => {
      const verificationStatus = await verifyJobUrl(job.url);
      return {
        ...job,
        verification_status: verificationStatus,
        raw_data: {
          ...job.raw_data,
          verification_status: verificationStatus,
        },
      };
    }),
  );
};

const fallbackFirecrawlSearch = async (
  query: string,
  location: string,
  limit: number,
): Promise<DiscoveryJob[]> => {
  const firecrawlApiKey = await resolveFirecrawlApiKey();
  const payload = {
    query: `${query} ${location || "Remote"} jobs (hiring OR careers) -inurl:search -inurl:login`,
    limit,
    sources: ["web"],
    scrapeOptions: { formats: ["markdown"] },
  };
  const response = await withRetry(
    () => firecrawlFetch("/search", firecrawlApiKey, payload),
    1,
    1000,
  );
  const items = Array.isArray(response?.data?.web) ? response.data.web : [];
  return items
    .map((item: Record<string, unknown>) => {
      const url =
        normalizeAbsoluteUrl(asString(item.url)) ||
        normalizeAbsoluteUrl(
          asString((item.metadata as Record<string, unknown> | undefined)?.sourceURL),
        );
      if (!url) return null;
      const sourceKind = inferSourceKind(url, null);
      const rawTitle =
        asString(item.title) ||
        asString((item.metadata as Record<string, unknown> | undefined)?.title) ||
        "Job opening";
      const company =
        rawTitle.split(/[|:-]| at /i).slice(-1)[0]?.trim() ||
        hostFromUrl(url) ||
        "Unknown";
      return {
        title: rawTitle,
        company,
        location: location || "Remote",
        url,
        description:
          asString(item.markdown) || asString(item.description) || "",
        posted_at: new Date().toISOString(),
        source_id: `firecrawl:${url}`,
        source_type: "web_search" as const,
        source_kind: sourceKind === "direct" ? "firecrawl" : sourceKind,
        source_confidence: sourceKind === "direct" ? 0.68 : 0.8,
        verification_status: "unverified" as const,
        is_tracked_company: false,
        raw_data: {
          provider: "firecrawl",
          metadata: item.metadata || null,
        },
      };
    })
    .filter((job): job is DiscoveryJob => Boolean(job));
};

export async function discoverJobsHybrid(
  args: HybridDiscoveryArgs,
): Promise<DiscoveryJob[]> {
  const trackedSeeds = await buildTrackedSeeds(args.serviceClient, args.userId);

  const adapterResults = (
    await Promise.all(trackedSeeds.map((seed) => fetchFromSeed(seed)))
  ).flat();

  const filteredAdapterResults = adapterResults.filter(
    (job) =>
      roleMatches(job, args.searchQuery) &&
      locationMatches(job.location, args.location || "Remote"),
  );

  const deduped = new Map<string, DiscoveryJob>();
  const pushJobs = (jobs: DiscoveryJob[]) => {
    for (const job of jobs) {
      if (!job.url || deduped.has(job.url)) continue;
      deduped.set(job.url, job);
    }
  };

  pushJobs(filteredAdapterResults);

  if (deduped.size < args.limit) {
    const firecrawlJobs = await fallbackFirecrawlSearch(
      args.searchQuery,
      args.location || "Remote",
      args.limit - deduped.size,
    );
    pushJobs(firecrawlJobs);
  }

  const verified = await verifyJobs(Array.from(deduped.values()).slice(0, args.limit));

  return verified.filter((job) => job.verification_status !== "stale");
}
