import {
  fetchCandidateMemory,
  type CandidateMemory,
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
  | "yc"
  | "hackernews"
  | "reddit"
  | "x"
  | "firecrawl";

export type PublicJobSource =
  | "web"
  | "ats"
  | "yc"
  | "x"
  | "reddit"
  | "hackernews"
  | "community";

interface SalarySignal {
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  salary_raw?: string | null;
}

export type VerificationStatus = "verified" | "stale" | "failed" | "unverified";

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
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  raw_data: Record<string, unknown>;
}

/** Result returned by discoverJobsFirecrawl with optional warnings for the client. */
export interface DiscoveryResult {
  jobs: DiscoveryJob[];
  /** User-facing warnings (e.g. "searched beyond your configured sources"). */
  warnings: string[];
}

interface FirecrawlDiscoveryArgs {
  serviceClient: any;
  userId: string;
  searchQuery: string;
  location: string;
  limit: number;
  sourceFocus?: PublicJobSource[];
  targetDomains?: string[];
}

interface JobSourceSettings {
  include_linkedin: boolean;
  include_indeed: boolean;
  include_search: boolean;
  allowed_domains: string[];
  enabled_default_sources: string[];
  source_credentials: Record<string, unknown>;
}

interface SearchSeed {
  type:
    | "general"
    | "profile_expansion"
    | "tracked_company"
    | "allowed_domain"
    | "default_source"
    | "credential_domain"
    | "ats_signal"
    | "yc_signal"
    | "x_signal"
    | "reddit_signal"
    | "hackernews_signal"
    | "community_signal"
    | "remote_fallback";
  query: string;
  limit: number;
  priority: number;
  domain?: string;
  company_name?: string;
  is_tracked_company: boolean;
}

interface FirecrawlSearchContext {
  candidateMemory: CandidateMemory;
  settings: JobSourceSettings;
  trackedCompanies: TrackedCompanySeed[];
  trackedCompanyDomains: string[];
}

interface FirecrawlSearchCandidate {
  title: string;
  company: string;
  location: string | null;
  url: string;
  description: string;
  posted_at: string | null;
  source_kind: SourceKind;
  source_confidence: number;
  is_tracked_company: boolean;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  seed_matches: string[];
  firecrawl_queries: string[];
  priority: number;
  raw_data: Record<string, unknown>;
}

interface NormalizedProviderJob {
  title: string;
  company: string;
  location: string | null;
  url: string;
  description: string;
  posted_at: string | null;
  provider_source_id: string;
  provider_job_id?: string;
  source_kind: SourceKind;
  source_confidence: number;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  raw_data: Record<string, unknown>;
}

interface RankingSignals {
  total: number;
  source_confidence: number;
  role_overlap: number;
  location_alignment: number;
  profile_alignment: number;
  tracked_company_bonus: number;
  seed_bonus: number;
  matched_role_terms: string[];
  matched_profile_terms: string[];
}

interface NormalizationContext {
  greenhouseBoards: Map<string, Promise<NormalizedProviderJob[]>>;
  leverSites: Map<string, Promise<NormalizedProviderJob[]>>;
  ashbyBoards: Map<string, Promise<NormalizedProviderJob[]>>;
  workableAccounts: Map<string, Promise<NormalizedProviderJob[]>>;
}

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
  "lead",
  "staff",
]);

const COMMON_SUBDOMAINS = new Set([
  "www",
  "careers",
  "jobs",
  "job",
  "boards",
  "apply",
]);

const KNOWN_ATS_HINTS: Array<{ kind: SourceKind; match: RegExp }> = [
  { kind: "greenhouse", match: /greenhouse/i },
  { kind: "lever", match: /lever/i },
  { kind: "ashby", match: /ashby/i },
  { kind: "workable", match: /workable/i },
  { kind: "yc", match: /ycombinator\.com\/jobs|workatastartup\.com/i },
  { kind: "hackernews", match: /news\.ycombinator\.com/i },
  { kind: "reddit", match: /reddit\.com/i },
  { kind: "x", match: /(?:^|\.)x\.com|twitter\.com/i },
];

const MAX_FIRECRAWL_SEEDS = 8;
const MAX_FIRECRAWL_RESULTS_PER_SEED = 12;
const MAX_RAW_CANDIDATES = 24;
const MAX_DIRECT_FETCHES = 6;
const MAX_VERIFICATION_POOL = 8;
const FIRECRAWL_SEARCH_TIMEOUT_MS = 20000;
const PROVIDER_LOOKUP_TIMEOUT_MS = 5000;
const DIRECT_PAGE_FETCH_TIMEOUT_MS = 3500;
const URL_VERIFY_TIMEOUT_MS = 2500;
const URL_VERIFY_CONCURRENCY = 10;
const PUBLIC_JOB_SOURCES = new Set<PublicJobSource>([
  "web",
  "ats",
  "yc",
  "x",
  "reddit",
  "hackernews",
  "community",
]);

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item));
};

const normalizePublicJobSources = (value: unknown): PublicJobSource[] => {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,;\s]+/) : [];
  const aliases: Record<string, PublicJobSource> = {
    twitter: "x",
    "x.com": "x",
    "twitter.com": "x",
    yc: "yc",
    "yc/jobs": "yc",
    "yc jobs": "yc",
    "ycombinator": "yc",
    "ycombinator.com": "yc",
    "workatastartup": "yc",
    "work at a startup": "yc",
    hn: "hackernews",
    hackernews: "hackernews",
    "hacker-news": "hackernews",
    "news.ycombinator.com": "hackernews",
    reddit: "reddit",
    ats: "ats",
    greenhouse: "ats",
    lever: "ats",
    ashby: "ats",
    workable: "ats",
    web: "web",
    general: "web",
    community: "community",
  };
  const normalized = raw
    .map((item) => String(item || "").trim().toLowerCase())
    .map((item) => aliases[item] || item)
    .filter((item): item is PublicJobSource => PUBLIC_JOB_SOURCES.has(item as PublicJobSource));
  return uniqueStrings(normalized);
};

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const trimText = (value: string, maxLength: number): string =>
  value.length > maxLength ? value.slice(0, maxLength).trim() : value.trim();

const decodeHtmlEntities = (value: string): string =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#(\d+);/g, (_match, code) => {
      const numeric = Number(code);
      return Number.isFinite(numeric) ? String.fromCharCode(numeric) : " ";
    });

const stripHtmlTags = (value: string): string =>
  decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|section|article|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]*>/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

const cleanJobDescription = (value: string | null | undefined, maxLength = 16000): string => {
  const raw = asString(value);
  if (!raw) return "";
  const withoutHtml = /<\/?[a-z][\s\S]*>/i.test(raw) ? stripHtmlTags(raw) : decodeHtmlEntities(raw);
  return trimText(
    withoutHtml
      .replace(/\[(.*?)\]\((.*?)\)/g, "$1 ($2)")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
    maxLength,
  );
};

const parseSalaryText = (value: string | null | undefined): SalarySignal => {
  const salaryRaw = asString(value);
  if (!salaryRaw) return {};
  const lower = salaryRaw.toLowerCase();
  const currency =
    /\bngn\b|naira|\u20a6/.test(lower)
      ? "NGN"
      : /\bgbp\b|pounds?|\u00a3/.test(lower)
        ? "GBP"
        : /\beur\b|euro|\u20ac/.test(lower)
          ? "EUR"
          : /\bcad\b/.test(lower)
            ? "CAD"
            : /\baud\b/.test(lower)
              ? "AUD"
              : /\busd\b|dollars?|\$/.test(lower)
                ? "USD"
                : null;

  const numbers = Array.from(
    salaryRaw.matchAll(/(?:[$\u00a3\u20ac\u20a6]\s*)?(\d[\d,]*(?:\.\d+)?)\s*(k|m)?/gi),
  )
    .map((match) => {
      const amount = Number(match[1].replace(/,/g, ""));
      if (!Number.isFinite(amount)) return null;
      const suffix = (match[2] || "").toLowerCase();
      if (suffix === "m") return Math.round(amount * 1_000_000);
      if (suffix === "k") return Math.round(amount * 1_000);
      return Math.round(amount);
    })
    .filter((amount): amount is number => Boolean(amount && amount > 0));

  if (!numbers.length) {
    return { salary_currency: currency, salary_raw: salaryRaw };
  }

  const [first, second] = numbers;
  return {
    salary_min: Math.min(first, second ?? first),
    salary_max: second ? Math.max(first, second) : null,
    salary_currency: currency,
    salary_raw: salaryRaw,
  };
};

const mergeSalarySignals = (...signals: SalarySignal[]): SalarySignal => {
  const merged: SalarySignal = {};
  for (const signal of signals) {
    if (merged.salary_min == null && signal.salary_min != null) merged.salary_min = signal.salary_min;
    if (merged.salary_max == null && signal.salary_max != null) merged.salary_max = signal.salary_max;
    if (!merged.salary_currency && signal.salary_currency) merged.salary_currency = signal.salary_currency;
    if (!merged.salary_raw && signal.salary_raw) merged.salary_raw = signal.salary_raw;
  }
  return merged;
};

const uniqueStrings = (values: Array<string | null | undefined>): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
};

const safeUrl = (value: string | null | undefined): URL | null => {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs = 8000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("fetch_timeout"), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

const normalizeDomain = (value: string | null | undefined): string | null => {
  const direct = asString(value);
  if (!direct) return null;

  const fromUrl = safeUrl(
    direct.startsWith("http://") || direct.startsWith("https://")
      ? direct
      : `https://${direct}`,
  );
  const hostname = fromUrl?.hostname || direct;
  const normalized = hostname
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .trim();

  return normalized.length > 0 ? normalized : null;
};

const hostFromUrl = (value: string | null | undefined): string | null =>
  normalizeDomain(safeUrl(value)?.hostname ?? value);

const extractTargetDomainsFromText = (value: string | null | undefined): string[] => {
  const text = asString(value) || "";
  const domains = new Set<string>();

  for (const match of text.matchAll(/\bsite:([a-z0-9.-]+\.[a-z]{2,})(?:\/[^\s)"']*)?/gi)) {
    const domain = normalizeDomain(match[1]);
    if (domain) domains.add(domain);
  }

  for (const match of text.matchAll(/https?:\/\/[^\s<>"')]+/gi)) {
    const domain = hostFromUrl(match[0]);
    if (domain) domains.add(domain);
  }

  return Array.from(domains);
};

const normalizeTargetDomains = (value: unknown): string[] =>
  uniqueStrings([
    ...asStringArray(value).map((item) => normalizeDomain(item)).filter((item): item is string => Boolean(item)),
    ...(typeof value === "string" ? extractTargetDomainsFromText(value) : []),
  ]).slice(0, 12);

const stripSourceTargetsFromQuery = (value: string): string =>
  value
    .replace(/\bsite:[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s)"']*)?/gi, " ")
    .replace(/https?:\/\/[^\s<>"')]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const hostMatchesDomain = (
  host: string | null | undefined,
  domain: string | null | undefined,
): boolean => {
  const normalizedHost = normalizeDomain(host);
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedHost || !normalizedDomain) return false;
  return normalizedHost === normalizedDomain || normalizedHost.endsWith(`.${normalizedDomain}`);
};

const hostMatchesAnyDomain = (
  host: string | null | undefined,
  domains: string[],
): boolean => domains.some((domain) => hostMatchesDomain(host, domain));

const isKnownAtsHost = (host: string | null | undefined): boolean => {
  const normalized = normalizeDomain(host) || "";
  return /(?:^|\.)boards\.greenhouse\.io$|(?:^|\.)jobs\.lever\.co$|(?:^|\.)lever\.co$|(?:^|\.)jobs\.ashbyhq\.com$|(?:^|\.)apply\.workable\.com$|(?:^|\.)breezy\.hr$|(?:^|\.)recruitee\.com$|(?:^|\.)smartrecruiters\.com$/i.test(normalized);
};

const seedDomainMatchesTargets = (
  value: unknown,
  targetDomains: string[],
): boolean =>
  typeof value === "string" && targetDomains.some((domain) => hostMatchesDomain(value, domain));

const candidateMatchesTargetDomains = (
  candidate: { url: string; raw_data?: Record<string, unknown>; seed_matches?: string[] },
  targetDomains: string[],
): boolean => {
  if (!targetDomains.length) return true;
  const host = hostFromUrl(candidate.url);
  if (hostMatchesAnyDomain(host, targetDomains)) return true;

  const raw = toRecord(candidate.raw_data);
  const firecrawlResult = toRecord(raw.firecrawl_result);
  const seedDomain = asString(firecrawlResult.seed_domain);
  const seedMatchedTarget =
    seedDomainMatchesTargets(seedDomain, targetDomains) ||
    (candidate.seed_matches || []).some((match) => seedDomainMatchesTargets(match, targetDomains));

  return seedMatchedTarget && isKnownAtsHost(host);
};

const normalizeCanonicalJobUrl = (value: string | null | undefined): string | null => {
  const parsed = safeUrl(value);
  if (!parsed) return null;
  parsed.hash = "";
  parsed.search = "";

  let pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  if (/lever\.co$/i.test(parsed.hostname) && /\/apply$/i.test(pathname)) {
    pathname = pathname.replace(/\/apply$/i, "");
  }
  parsed.pathname = pathname || "/";
  return parsed.toString();
};

const domainLabel = (domain: string | null | undefined): string => {
  const normalized = normalizeDomain(domain);
  if (!normalized) return "Unknown";
  const parts = normalized.split(".");
  while (parts.length > 1 && COMMON_SUBDOMAINS.has(parts[0])) {
    parts.shift();
  }
  return parts[0]
    ? parts[0]
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase())
    : normalized;
};

const normalizeLocation = (value: string | null | undefined): string => {
  const normalized = asString(value);
  return normalized || "Remote";
};

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

const SOCIAL_SIGNAL_HOSTS = /(reddit\.com|(?:^|\.)x\.com|twitter\.com|news\.ycombinator\.com)/i;

const isKnownJobDetailUrl = (url: string): boolean => {
  const parsed = safeUrl(url);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();

  if (/boards\.greenhouse\.io|job-boards\.greenhouse\.io/i.test(host) && /\/jobs?\//i.test(path)) return true;
  if (/lever\.co$/i.test(host) && path.split("/").filter(Boolean).length >= 2) return true;
  if (/ashbyhq\.com|jobs\.ashbyhq\.com/i.test(host) && path.split("/").filter(Boolean).length >= 2) return true;
  if (/workable\.com/i.test(host) && /\/j\/|\/jobs?\//i.test(path)) return true;
  if (/ycombinator\.com/i.test(host) && /\/companies\/[^/]+\/jobs?\//i.test(path)) return true;
  if (/workatastartup\.com/i.test(host) && /\/jobs?\/\d+/i.test(path)) return true;
  if (/jobs\.micro1\.ai/i.test(host) && path.split("/").filter(Boolean).length >= 1) return true;
  if (/weworkremotely\.com|remoteok\.com|remotive\.com|jobicy\.com|workingnomads\.com/i.test(host) && /\/(remote-)?jobs?\//i.test(path)) return true;
  if (/builtin\.com|startup\.jobs|cryptojobslist\.com|nodesk\.co|remote\.co/i.test(host) && /\/jobs?\//i.test(path) && path.split("/").filter(Boolean).length >= 2) return true;
  if (/meetfrank\.com/i.test(host) && /\/job\//i.test(path)) return true;

  return /\/(job|jobs|posting|openings?|careers?|positions?|vacancies?)\/[a-z0-9][a-z0-9-_%]+/i.test(path) &&
    !/\/(jobs?|careers?|openings?|positions?|vacancies?)\/?$/i.test(path);
};

export const isLikelyAggregateJobPage = (
  url: string,
  title?: string | null,
  description?: string | null,
): boolean => {
  const parsed = safeUrl(url);
  const path = parsed?.pathname.toLowerCase() || "";
  const text = `${title || ""} ${description || ""}`.toLowerCase();

  if (isKnownJobDetailUrl(url)) return false;
  if (/\/(search|job-search|jobs-search|find-jobs|browse|companies|categories|jobs?\/role)(\/|$)/i.test(path)) return true;
  if (/\/(jobs?|careers?|openings?|positions?|vacancies?|remote-jobs)\/?$/i.test(path)) return true;
  if (/\b\d+\s+(?:fully\s+remote\s+)?[\w\s()/-]{2,80}\s+jobs?\s+in\b/i.test(text)) return true;
  if (/\b(jobs|vacancies|openings)\s+in\s+(the\s+best\s+)?companies\b/i.test(text)) return true;
  if (/\b(show|find|browse|view)\s+\d+\+?\s+jobs?\b/i.test(text)) return true;
  if (/\bnew offers\b.*\bstartups\b.*\bscaleups\b.*\bcorporate\b/i.test(text)) return true;
  if (/\bjob board\b|\bsearch results\b|\ball jobs\b|\bmore jobs\b/i.test(text)) return true;

  return false;
};

const isPotentialJobUrl = (url: string): boolean => {
  const parsed = safeUrl(url);
  if (!parsed) return false;
  const lower = url.toLowerCase();
  if (/\/login|\/signin|\/auth|\/pricing|\/blog|\/about|\/privacy|\/terms/i.test(lower)) return false;
  if (isProfileUrl(lower)) return false;
  if (isKnownJobDetailUrl(url)) return true;
  if (SOCIAL_SIGNAL_HOSTS.test(parsed.hostname)) return /hiring|job|role|work/i.test(lower);
  return /\/(job|jobs|posting|opening|position|career|apply|vacanc)/i.test(parsed.pathname);
};

const inferSignalSource = (url: string | null | undefined): string | null => {
  const host = hostFromUrl(url);
  if (!host) return null;
  if (/reddit\.com$/i.test(host) || host.endsWith(".reddit.com")) return "reddit_public_post";
  if (/x\.com$/i.test(host) || host.endsWith(".x.com") || /twitter\.com$/i.test(host)) return "x_public_post";
  if (/news\.ycombinator\.com$/i.test(host)) return "hackernews_who_is_hiring";
  if (/ycombinator\.com$/i.test(host) || /workatastartup\.com$/i.test(host)) return "yc_jobs";
  return null;
};

const extractTerms = (query: string): string[] =>
  query
    .split(/[^a-zA-Z0-9+#./-]+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 1 && !STOP_WORDS.has(part));

const isProfileUrl = (url: string): boolean => {
  const lower = url.toLowerCase();

  if (lower.includes("upwork.com")) {
    if (
      /upwork\.com\/(freelancers|fl|agencies|o|search\/profiles)/i.test(lower)
    ) {
      return true;
    }
    if (!lower.includes("/jobs/") && !lower.includes("/freelance-jobs/")) {
      return true;
    }
  }

  if (lower.includes("linkedin.com")) {
    if (/linkedin\.com\/in\//i.test(lower)) return true;
    if (
      /linkedin\.com\/company\/[^/]+\/?$/i.test(lower) &&
      !lower.includes("/jobs")
    ) {
      return true;
    }
  }

  if (
    /\/(freelancers?|profiles?|users?|people|team|about-us)(\/|$)/i.test(lower)
  ) {
    return true;
  }

  return false;
};

const titleLooksLikeProfile = (title: string): boolean => {
  if (
    /^[A-Z][a-z]+\s+[A-Z]\.?\s*[-|]/.test(title) &&
    /upwork|freelancer|fiverr|toptal|guru\.com/i.test(title)
  ) {
    return true;
  }
  return /- upwork$/i.test(title.trim());
};

const isExcludedSourceUrl = (
  url: string,
  settings: JobSourceSettings,
): boolean => {
  const lower = url.toLowerCase();
  if (isProfileUrl(lower)) return true;
  if (!settings.include_linkedin && /linkedin\.com/i.test(lower)) return true;
  if (!settings.include_indeed && /indeed\./i.test(lower)) return true;
  if (/\/search(\?|\/|$)|[?&]q=|\/jobs\/search/i.test(lower)) return true;
  if (/\/login|\/signin|\/auth/i.test(lower)) return true;
  return false;
};

const roleMatches = (
  job: { title: string; description: string },
  query: string,
  relaxed = false,
): boolean => {
  const haystack = `${job.title} ${job.description}`.toLowerCase();
  const terms = extractTerms(query);
  if (terms.length === 0) return true;
  const matched = terms.filter((term) => haystack.includes(term));
  // In relaxed mode (fallback/broadened searches), require only 1 term match
  const threshold = relaxed ? 1 : Math.max(1, Math.ceil(terms.length / 3));
  return matched.length >= threshold;
};

const evaluateLocationAlignment = (
  jobLocation: string | null,
  requestedLocation: string,
): number => {
  const wanted = normalizeLocation(requestedLocation).toLowerCase();
  if (!jobLocation) {
    return wanted === "remote" ? 80 : 55;
  }

  const haystack = jobLocation.toLowerCase();
  const jobIsRemote = /remote|worldwide|anywhere/i.test(haystack);
  if (wanted === "remote") {
    return jobIsRemote ? 100 : 35;
  }
  if (jobIsRemote) {
    return 85;
  }
  return haystack.includes(wanted) ? 100 : 40;
};

const parsePublishedAt = (metadata: Record<string, unknown>): string | null => {
  const candidates = [
    asString(metadata.published_at),
    asString(metadata.datePublished),
    asString(metadata.publishedTime),
    asString(metadata.published_time),
    asString(metadata.date),
    asString(metadata.modifiedTime),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const date = new Date(candidate);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return null;
};

const MAX_DISCOVERY_POST_AGE_DAYS = 60;
const MAX_DISCOVERY_POST_AGE_MS =
  MAX_DISCOVERY_POST_AGE_DAYS * 24 * 60 * 60 * 1000;

function postedAtTimestamp(postedAt: string | null | undefined): number | null {
  if (!postedAt) return null;
  const timestamp = new Date(postedAt).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function isStalePostedAt(postedAt: string | null | undefined): boolean {
  const timestamp = postedAtTimestamp(postedAt);
  if (timestamp === null) return false;
  return Date.now() - timestamp > MAX_DISCOVERY_POST_AGE_MS;
}

const deriveLocationFromText = (value: string): string | null => {
  if (!value) return null;
  if (/remote|worldwide|anywhere/i.test(value)) return "Remote";

  const match = value.match(
    /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*,\s*[A-Z][a-zA-Z]+)\b/,
  );
  return match?.[1] || null;
};

const deriveLocation = (
  metadata: Record<string, unknown>,
  description: string,
): string | null => {
  const direct = uniqueStrings([
    asString(metadata.location),
    asString(metadata.region),
    asString(metadata.jobLocation),
    asString(metadata.job_location),
    asString(metadata.addressLocality),
  ]);
  if (direct.length > 0) return direct[0];
  return deriveLocationFromText(description);
};

const deriveCompanyName = (
  title: string,
  metadata: Record<string, unknown>,
  url: string,
  seedCompanyName?: string,
): string => {
  const explicit = uniqueStrings([
    asString(metadata.company),
    asString(metadata.companyName),
    asString(metadata.organization),
    seedCompanyName,
  ]);
  if (explicit.length > 0) return explicit[0];

  const separators = [/ at /i, /\|/, / - /, /: /];
  for (const separator of separators) {
    const parts = title.split(separator).map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return parts[parts.length - 1];
    }
  }

  return domainLabel(hostFromUrl(url));
};

const buildQueryText = (...parts: Array<string | null | undefined>): string =>
  parts.filter((part): part is string => Boolean(part && part.trim())).join(" ");

const buildGeneralQuery = (
  query: string,
  location: string,
  extraTerms?: string,
): string =>
  buildQueryText(
    query,
    location,
    extraTerms,
    "jobs",
    "(hiring OR careers OR openings)",
    "-inurl:search",
    "-inurl:login",
  );

const buildTrackedCompanyQuery = (
  query: string,
  location: string,
  companyName: string,
  domain?: string,
): string =>
  buildQueryText(
    domain ? `site:${domain}` : null,
    `"${companyName}"`,
    query,
    location,
    "jobs",
    "(hiring OR careers OR openings)",
    "-inurl:search",
    "-inurl:login",
  );

const buildDomainQuery = (
  query: string,
  location: string,
  domain: string,
): string =>
  buildQueryText(
    `site:${domain}`,
    query,
    location,
    "jobs",
    "(hiring OR careers OR openings)",
    "-inurl:search",
    "-inurl:login",
  );

const buildAtsSignalQuery = (query: string, location: string): string =>
  buildQueryText(
    query,
    location,
    "(site:boards.greenhouse.io OR site:jobs.lever.co OR site:lever.co OR site:jobs.ashbyhq.com OR site:apply.workable.com)",
    "(hiring OR apply OR opening)",
    "-inurl:search",
    "-inurl:login",
  );

const buildYcSignalQuery = (query: string, location: string): string =>
  buildQueryText(
    query,
    location,
    "(site:ycombinator.com/jobs OR site:workatastartup.com)",
    "(hiring OR apply OR startup)",
    "-inurl:login",
  );

const buildXSignalQuery = (query: string, location: string): string =>
  buildQueryText(
    `"${query}"`,
    location,
    "(site:x.com OR site:twitter.com)",
    "(hiring OR \"we're hiring\" OR \"is hiring\" OR \"join our team\" OR \"apply now\")",
    "-inurl:login",
    "-inurl:i/flow",
  );

const buildRedditSignalQuery = (query: string, location: string): string =>
  buildQueryText(
    `"${query}"`,
    location,
    "(site:reddit.com/r/forhire OR site:reddit.com/r/remotework OR site:reddit.com/r/jobs OR site:reddit.com/r/startups)",
    "(hiring OR \"we're hiring\" OR \"job opening\" OR \"apply\")",
    "-inurl:login",
  );

const buildHackerNewsSignalQuery = (query: string, location: string): string =>
  buildQueryText(
    `"${query}"`,
    location,
    "site:news.ycombinator.com",
    "(\"Who is hiring\" OR hiring OR remote OR onsite)",
  );

const buildCommunitySignalQuery = (query: string, location: string): string =>
  buildQueryText(
    `"${query}"`,
    location,
    "(site:news.ycombinator.com OR site:reddit.com/r/forhire OR site:reddit.com/r/remotework OR site:reddit.com/r/jobs OR site:x.com OR site:twitter.com)",
    "(hiring OR \"we're hiring\" OR \"who is hiring\" OR \"apply\")",
    "-inurl:login",
  );

const extractCredentialDomains = (
  sourceCredentials: Record<string, unknown>,
): string[] => {
  const domains: string[] = [];
  for (const [key, value] of Object.entries(sourceCredentials)) {
    const normalizedKey = normalizeDomain(key);
    if (normalizedKey) domains.push(normalizedKey);

    const record = toRecord(value);
    const nested = uniqueStrings([
      asString(record.domain),
      asString(record.hostname),
      asString(record.url),
    ])
      .map((item) => normalizeDomain(item))
      .filter((item): item is string => Boolean(item));
    domains.push(...nested);
  }
  return uniqueStrings(domains);
};

const buildTrackedCompanyDomains = (trackedCompanies: TrackedCompanySeed[]): string[] =>
  uniqueStrings(
    trackedCompanies.flatMap((company) => [
      normalizeDomain(company.domain),
      normalizeDomain(company.careers_url),
    ]),
  );

const mergeDiscoveryArrays = (
  left: unknown,
  right: unknown,
): string[] => uniqueStrings([...asStringArray(left), ...asStringArray(right)]);

const matchesTrackedDomain = (
  hostname: string | null,
  trackedDomains: string[],
): boolean => {
  if (!hostname) return false;
  return trackedDomains.some((domain) =>
    hostname === domain || hostname.endsWith(`.${domain}`)
  );
};

const chooseBetterCandidate = (
  current: FirecrawlSearchCandidate,
  incoming: FirecrawlSearchCandidate,
): FirecrawlSearchCandidate => {
  const currentScore =
    current.priority * -10 +
    current.source_confidence * 100 +
    (current.is_tracked_company ? 15 : 0) +
    Math.min(current.description.length / 80, 10);
  const incomingScore =
    incoming.priority * -10 +
    incoming.source_confidence * 100 +
    (incoming.is_tracked_company ? 15 : 0) +
    Math.min(incoming.description.length / 80, 10);

  if (incomingScore > currentScore) {
    return {
      ...incoming,
      seed_matches: mergeDiscoveryArrays(current.seed_matches, incoming.seed_matches),
      firecrawl_queries: mergeDiscoveryArrays(
        current.firecrawl_queries,
        incoming.firecrawl_queries,
      ),
    };
  }

  return {
    ...current,
    seed_matches: mergeDiscoveryArrays(current.seed_matches, incoming.seed_matches),
    firecrawl_queries: mergeDiscoveryArrays(
      current.firecrawl_queries,
      incoming.firecrawl_queries,
    ),
  };
};

const verificationRank = (status: VerificationStatus): number => {
  switch (status) {
    case "verified":
      return 3;
    case "unverified":
      return 2;
    case "failed":
      return 1;
    case "stale":
    default:
      return 0;
  }
};

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];

  const results = new Array<R>(items.length);
  let index = 0;

  const runWorker = async () => {
    while (true) {
      const currentIndex = index;
      index += 1;
      if (currentIndex >= items.length) return;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()),
  );

  return results;
}

async function fetchJobSourceSettings(
  serviceClient: any,
  userId: string,
): Promise<JobSourceSettings> {
  const { data, error } = await serviceClient
    .from("job_source_settings")
    .select(
      "include_linkedin, include_indeed, include_search, allowed_domains, enabled_default_sources, source_credentials",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("job_source_settings lookup failed", { userId, error });
  }

  const row = toRecord(data);
  return {
    include_linkedin: row.include_linkedin !== false,
    include_indeed: row.include_indeed !== false,
    include_search: row.include_search !== false,
    allowed_domains: asStringArray(row.allowed_domains).map((value) => normalizeDomain(value))
      .filter((value): value is string => Boolean(value)),
    enabled_default_sources: asStringArray(row.enabled_default_sources)
      .map((value) => normalizeDomain(value))
      .filter((value): value is string => Boolean(value)),
    source_credentials: toRecord(row.source_credentials),
  };
}

async function buildSearchContext(
  serviceClient: any,
  userId: string,
): Promise<FirecrawlSearchContext> {
  const [candidateMemory, settings] = await Promise.all([
    fetchCandidateMemory(serviceClient, userId),
    fetchJobSourceSettings(serviceClient, userId),
  ]);

  return {
    candidateMemory,
    settings,
    trackedCompanies: candidateMemory.trackedCompanies,
    trackedCompanyDomains: buildTrackedCompanyDomains(candidateMemory.trackedCompanies),
  };
}

function buildSearchSeeds(
  args: FirecrawlDiscoveryArgs,
  context: FirecrawlSearchContext,
): SearchSeed[] {
  const location = normalizeLocation(args.location || context.candidateMemory.location);
  const searchQuery = args.searchQuery.trim();
  const sourceFocus = normalizePublicJobSources(args.sourceFocus);
  const targetDomains = normalizeTargetDomains([
    ...(args.targetDomains || []),
    ...extractTargetDomainsFromText(searchQuery),
  ]);
  const roleQuery = targetDomains.length > 0
    ? stripSourceTargetsFromQuery(searchQuery) || searchQuery
    : searchQuery;
  const wantsSource = (source: PublicJobSource) =>
    sourceFocus.length === 0 ||
    sourceFocus.includes(source) ||
    (source !== "web" && source !== "ats" && sourceFocus.includes("community"));
  const profileTerms = uniqueStrings(
    context.candidateMemory.skillKeywords
      .slice(0, 4)
      .flatMap((item) => extractTerms(item)),
  )
    .slice(0, 3)
    .join(" ");

  const credentialDomains = extractCredentialDomains(
    context.settings.source_credentials,
  );

  const seeds: Omit<SearchSeed, "limit">[] = [];

  if (targetDomains.length > 0) {
    for (const domain of targetDomains) {
      seeds.push({
        type: "allowed_domain",
        query: buildDomainQuery(roleQuery, location, domain),
        priority: 0,
        domain,
        is_tracked_company: context.trackedCompanyDomains.some((trackedDomain) =>
          hostMatchesDomain(domain, trackedDomain)
        ),
      });
    }
  } else if (context.settings.include_search && wantsSource("web")) {
    seeds.push({
      type: "general",
      query: buildGeneralQuery(searchQuery, location),
      priority: 1,
      is_tracked_company: false,
    });

    if (profileTerms) {
      seeds.push({
        type: "profile_expansion",
        query: buildGeneralQuery(searchQuery, location, profileTerms),
        priority: 2,
        is_tracked_company: false,
      });
    }
  }

  if (targetDomains.length === 0 && wantsSource("web")) {
    for (const company of context.trackedCompanies.slice(0, 2)) {
      const domain =
        normalizeDomain(company.domain) || normalizeDomain(company.careers_url);
      seeds.push({
        type: "tracked_company",
        query: buildTrackedCompanyQuery(searchQuery, location, company.name, domain || undefined),
        priority: 0,
        domain: domain || undefined,
        company_name: company.name,
        is_tracked_company: true,
      });
    }

    for (const domain of context.settings.allowed_domains.slice(0, 1)) {
      seeds.push({
        type: "allowed_domain",
        query: buildDomainQuery(searchQuery, location, domain),
        priority: 3,
        domain,
        is_tracked_company: false,
      });
    }

    for (const domain of context.settings.enabled_default_sources.slice(0, 1)) {
      seeds.push({
        type: "default_source",
        query: buildDomainQuery(searchQuery, location, domain),
        priority: 4,
        domain,
        is_tracked_company: false,
      });
    }

    for (const domain of credentialDomains.slice(0, 1)) {
      seeds.push({
        type: "credential_domain",
        query: buildDomainQuery(searchQuery, location, domain),
        priority: 4,
        domain,
        is_tracked_company: false,
      });
    }
  }

  if (targetDomains.length === 0 && wantsSource("ats")) {
    seeds.push({
      type: "ats_signal",
      query: buildAtsSignalQuery(searchQuery, location),
      priority: 2,
      is_tracked_company: false,
    });
  }

  if (targetDomains.length === 0 && wantsSource("yc")) {
    seeds.push({
      type: "yc_signal",
      query: buildYcSignalQuery(searchQuery, location),
      priority: 3,
      is_tracked_company: false,
    });
  }

  if (targetDomains.length === 0 && (sourceFocus.length === 0 || sourceFocus.includes("community"))) {
    seeds.push({
      type: "community_signal",
      query: buildCommunitySignalQuery(searchQuery, location),
      priority: 6,
      is_tracked_company: false,
    });
  } else {
    if (wantsSource("x")) {
      seeds.push({
        type: "x_signal",
        query: buildXSignalQuery(searchQuery, location),
        priority: 4,
        is_tracked_company: false,
      });
    }
    if (wantsSource("reddit")) {
      seeds.push({
        type: "reddit_signal",
        query: buildRedditSignalQuery(searchQuery, location),
        priority: 5,
        is_tracked_company: false,
      });
    }
    if (wantsSource("hackernews")) {
      seeds.push({
        type: "hackernews_signal",
        query: buildHackerNewsSignalQuery(searchQuery, location),
        priority: 5,
        is_tracked_company: false,
      });
    }
  }

  if (targetDomains.length === 0 && location.toLowerCase() === "remote" && wantsSource("web")) {
    seeds.push({
      type: "remote_fallback",
      query: buildGeneralQuery(searchQuery, "Remote"),
      priority: 5,
      is_tracked_company: false,
    });
  }

  const deduped = new Map<string, Omit<SearchSeed, "limit">>();
  for (const seed of seeds) {
    const key = seed.query.toLowerCase();
    if (!deduped.has(key)) {
      deduped.set(key, seed);
    }
  }

  const finalSeeds = Array.from(deduped.values())
    .sort((left, right) => left.priority - right.priority)
    .slice(0, MAX_FIRECRAWL_SEEDS);
  const perSeedLimit = Math.min(
    MAX_FIRECRAWL_RESULTS_PER_SEED,
    Math.max(5, Math.ceil((args.limit * 1.2) / Math.max(1, finalSeeds.length))),
  );

  return finalSeeds.map((seed) => ({
    ...seed,
    limit: perSeedLimit,
  }));
}

function mapFirecrawlItems(response: Record<string, unknown>): Record<string, unknown>[] {
  const data = toRecord(response.data);
  const webItems = data.web;
  if (Array.isArray(webItems)) {
    return webItems
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
  }
  if (Array.isArray(data.items)) {
    return data.items
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
  }
  if (Array.isArray(response.data)) {
    return response.data
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
  }
  return [];
}

function extractLinksFromFirecrawlItem(item: Record<string, unknown>): string[] {
  const links = Array.isArray(item.links) ? item.links : [];
  const fromLinks = links
    .map((link) => {
      if (typeof link === "string") return link;
      const record = toRecord(link);
      return asString(record.url) || asString(record.href);
    })
    .filter((link): link is string => Boolean(link));

  const markdown = asString(item.markdown) || "";
  const fromMarkdown = Array.from(markdown.matchAll(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/g))
    .map((match) => match[1])
    .filter(Boolean);

  return uniqueStrings([...fromLinks, ...fromMarkdown])
    .map((link) => normalizeCanonicalJobUrl(link))
    .filter((link): link is string => Boolean(link));
}

function sourceSignalBoost(seed: SearchSeed, url: string): string[] {
  return uniqueStrings([
    seed.type,
    seed.domain,
    seed.company_name,
    inferSignalSource(url),
  ]);
}

function mapFirecrawlItemToCandidate(
  item: Record<string, unknown>,
  seed: SearchSeed,
  settings: JobSourceSettings,
): FirecrawlSearchCandidate | null {
  const metadata = toRecord(item.metadata);
  const url =
    normalizeCanonicalJobUrl(asString(item.url)) ||
    normalizeCanonicalJobUrl(asString(metadata.sourceURL)) ||
    normalizeCanonicalJobUrl(asString(metadata.url));

  if (!url || isExcludedSourceUrl(url, settings)) return null;

  const rawTitle =
    asString(item.title) ||
    asString(metadata.title) ||
    asString(metadata.ogTitle) ||
    "Job opening";

  if (titleLooksLikeProfile(rawTitle)) return null;

  const description = cleanJobDescription(
    asString(item.markdown) ||
      asString(item.description) ||
      asString(item.snippet) ||
      asString(metadata.description) ||
      "",
    16000,
  );

  if (isLikelyAggregateJobPage(url, rawTitle, description)) return null;
  if (!isPotentialJobUrl(url) && !/\b(job|hiring|career|opening|apply)\b/i.test(`${rawTitle} ${description}`)) {
    return null;
  }
  if (SOCIAL_SIGNAL_HOSTS.test(url) && description.length < 280) {
    return null;
  }

  const company = deriveCompanyName(rawTitle, metadata, url, seed.company_name);
  const location = deriveLocation(metadata, description);
  const postedAt = parsePublishedAt(metadata);
  if (isStalePostedAt(postedAt)) return null;

  const sourceKind = inferSourceKind(url, rawTitle);
  const salary = parseSalaryText(`${description}\n${asString(metadata.salary) || ""}`);
  const baseConfidence =
    seed.type === "tracked_company"
      ? 0.82
      : seed.domain
        ? 0.78
        : seed.type === "community_signal"
          ? 0.58
          : 0.72;
  const sourceConfidence =
    sourceKind === "firecrawl" ? baseConfidence : Math.min(0.86, baseConfidence + 0.06);

  return {
    title: trimText(rawTitle, 300),
    company: trimText(company, 200),
    location,
    url,
    description,
    posted_at: postedAt,
    source_kind: sourceKind === "direct" ? "firecrawl" : sourceKind,
    source_confidence: sourceConfidence,
    is_tracked_company: seed.is_tracked_company,
    salary_min: salary.salary_min ?? null,
    salary_max: salary.salary_max ?? null,
    salary_currency: salary.salary_currency ?? null,
    seed_matches: sourceSignalBoost(seed, url),
    firecrawl_queries: [seed.query],
    priority: seed.priority,
    raw_data: {
      provider: "firecrawl",
      metadata,
      salary: salary.salary_raw || null,
      firecrawl_result: {
        query: seed.query,
        seed_type: seed.type,
        seed_domain: seed.domain || null,
        seed_company: seed.company_name || null,
        signal_source: inferSignalSource(url),
        priority: seed.priority,
      },
    },
  };
}

function mapLinkedJobUrlToCandidate(
  linkedUrl: string,
  parent: Record<string, unknown>,
  seed: SearchSeed,
  settings: JobSourceSettings,
): FirecrawlSearchCandidate | null {
  const url = normalizeCanonicalJobUrl(linkedUrl);
  if (!url || isExcludedSourceUrl(url, settings)) return null;
  if (!isPotentialJobUrl(url)) return null;
  if (isLikelyAggregateJobPage(url)) return null;

  const parentMetadata = toRecord(parent.metadata);
  const parentUrl =
    normalizeCanonicalJobUrl(asString(parent.url)) ||
    normalizeCanonicalJobUrl(asString(parentMetadata.sourceURL));
  const title = domainLabel(hostFromUrl(url));
  const company = seed.company_name || domainLabel(hostFromUrl(url));
  const sourceKind = inferSourceKind(url, title);
  const sourceSignal = inferSignalSource(parentUrl || url);

  return {
    title: trimText(title === "Unknown" ? "Job opening" : `${title} job opening`, 300),
    company: trimText(company, 200),
    location: null,
    url,
    description: cleanJobDescription(
      asString(parent.description) ||
        asString(parent.snippet) ||
        asString(parentMetadata.description) ||
        seed.query,
      2000,
    ),
    posted_at: parsePublishedAt(parentMetadata),
    source_kind: sourceKind === "direct" ? "firecrawl" : sourceKind,
    source_confidence: sourceSignal ? 0.62 : 0.7,
    is_tracked_company: seed.is_tracked_company,
    seed_matches: sourceSignalBoost(seed, url),
    firecrawl_queries: [seed.query],
    priority: seed.priority,
    raw_data: {
      provider: "firecrawl",
      metadata: parentMetadata,
      discovered_from: parentUrl,
      signal_source: sourceSignal,
      firecrawl_result: {
        query: seed.query,
        seed_type: seed.type,
        linked_from: parentUrl,
      },
    },
  };
}

async function expandAggregatePageWithMap(
  item: Record<string, unknown>,
  seed: SearchSeed,
  apiKey: string,
  settings: JobSourceSettings,
): Promise<FirecrawlSearchCandidate[]> {
  const metadata = toRecord(item.metadata);
  const url =
    normalizeCanonicalJobUrl(asString(item.url)) ||
    normalizeCanonicalJobUrl(asString(metadata.sourceURL)) ||
    normalizeCanonicalJobUrl(asString(metadata.url));
  if (!url) return [];

  try {
    const response = await withRetry(
      () =>
        firecrawlFetch(
          "/map",
          apiKey,
          {
            url,
            search: seed.query,
            sitemap: "include",
            includeSubdomains: true,
            ignoreQueryParameters: true,
            limit: 40,
            timeout: 15000,
          },
          undefined,
          20000,
        ),
      2,
      1500,
    );

    const responseData = toRecord(response?.data);
    const links = Array.isArray(response?.links)
      ? response.links
      : Array.isArray(responseData.links)
        ? responseData.links
        : [];
    return links
      .map((link: unknown) => {
        const record = toRecord(link);
        return mapLinkedJobUrlToCandidate(
          asString(record.url) || "",
          {
            ...item,
            title: asString(record.title) || asString(item.title),
            description: asString(record.description) || asString(item.description),
          },
          seed,
          settings,
        );
      })
      .filter((candidate): candidate is FirecrawlSearchCandidate => Boolean(candidate))
      .slice(0, 6);
  } catch (error) {
    console.warn("firecrawl.map_expand_failed", {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

async function runSeedSearch(
  seed: SearchSeed,
  apiKey: string,
  settings: JobSourceSettings,
): Promise<FirecrawlSearchCandidate[]> {
  const payload = {
    query: seed.query,
    limit: seed.limit,
    sources: ["web"],
    scrapeOptions: {
      formats: ["markdown", "links"],
      onlyMainContent: true,
      onlyCleanContent: true,
      removeBase64Images: true,
      blockAds: true,
      timeout: 45000,
    },
  };

  try {
    const response = await withRetry(
      () =>
        firecrawlFetch(
          "/search",
          apiKey,
          payload,
          undefined,
          FIRECRAWL_SEARCH_TIMEOUT_MS,
        ),
      2,
      2000,
    );
    const items = mapFirecrawlItems(toRecord(response));
    const candidates: FirecrawlSearchCandidate[] = [];
    const aggregateItems: Record<string, unknown>[] = [];

    for (const item of items) {
      const metadata = toRecord(item.metadata);
      const url =
        normalizeCanonicalJobUrl(asString(item.url)) ||
        normalizeCanonicalJobUrl(asString(metadata.sourceURL)) ||
        normalizeCanonicalJobUrl(asString(metadata.url));
      const title = asString(item.title) || asString(metadata.title);
      const description = cleanJobDescription(
        asString(item.markdown) || asString(item.description) || asString(metadata.description) || "",
        4000,
      );

      if (url && isLikelyAggregateJobPage(url, title, description)) {
        aggregateItems.push(item);
      }

      const primary = mapFirecrawlItemToCandidate(item, seed, settings);
      if (primary) candidates.push(primary);

      const linked = extractLinksFromFirecrawlItem(item)
        .map((linkedUrl) => mapLinkedJobUrlToCandidate(linkedUrl, item, seed, settings))
        .filter((candidate): candidate is FirecrawlSearchCandidate => Boolean(candidate))
        .slice(0, 4);
      candidates.push(...linked);
    }

    const mappedFromAggregates = (
      await runWithConcurrency(aggregateItems.slice(0, 2), 2, (item) =>
        expandAggregatePageWithMap(item, seed, apiKey, settings)
      )
    ).flat();

    const byUrl = new Map<string, FirecrawlSearchCandidate>();
    for (const candidate of [...candidates, ...mappedFromAggregates]) {
      const key = normalizeCanonicalJobUrl(candidate.url) || candidate.url;
      const existing = byUrl.get(key);
      byUrl.set(key, existing ? chooseBetterCandidate(existing, candidate) : candidate);
    }

    return Array.from(byUrl.values());
  } catch (error) {
    console.error("firecrawl.seed_search_failed", {
      query: seed.query,
      seedType: seed.type,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
async function fetchFirecrawlJobExtraction(
  url: string,
  apiKey: string,
  candidate: FirecrawlSearchCandidate,
): Promise<NormalizedProviderJob | null> {
  try {
    const response = await firecrawlFetch(
      "/scrape",
      apiKey,
      {
        url,
        formats: [
          "markdown",
          {
            type: "json",
            schema: {
              type: "object",
              properties: {
                isJobPosting: { type: "boolean" },
                title: { type: "string" },
                company: { type: "string" },
                location: { type: "string" },
                posted_at: { type: "string" },
                employment_type: { type: "string" },
                experience_level: { type: "string" },
                description: { type: "string" },
                salary: { type: "string" },
                salary_min: { type: "number" },
                salary_max: { type: "number" },
                salary_currency: { type: "string" },
                apply_url: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
              },
            },
            prompt:
              "Extract exactly one real job posting from this page. If it is a job list, search results page, company directory, blog post, or generic careers page, set isJobPosting=false and do not invent a job. Return a plain text description with responsibilities, requirements, benefits, salary if stated, and no HTML.",
          },
        ],
        onlyMainContent: true,
        onlyCleanContent: true,
        removeBase64Images: true,
        blockAds: true,
      },
      undefined,
      12000,
    );

    const data = toRecord(response.data);
    const extracted = toRecord(data.json);
    const markdown = cleanJobDescription(asString(data.markdown) || "");
    const extractedDescription = cleanJobDescription(asString(extracted.description) || "");
    const finalDescription = extractedDescription.length >= 200 ? extractedDescription : markdown;
    const isJobPosting = extracted.isJobPosting !== false;

    if (!isJobPosting || isLikelyAggregateJobPage(url, asString(extracted.title), finalDescription)) {
      return null;
    }
    if (finalDescription.length < 160 && !isKnownJobDetailUrl(url)) {
      return null;
    }

    const salary = mergeSalarySignals(
      {
        salary_min:
          typeof extracted.salary_min === "number" ? Math.round(extracted.salary_min) : null,
        salary_max:
          typeof extracted.salary_max === "number" ? Math.round(extracted.salary_max) : null,
        salary_currency: asString(extracted.salary_currency),
        salary_raw: asString(extracted.salary),
      },
      parseSalaryText(finalDescription),
    );

    const applyUrl = normalizeCanonicalJobUrl(asString(extracted.apply_url)) || url;

    return {
      title: asString(extracted.title) || candidate.title,
      company: asString(extracted.company) || candidate.company,
      location: asString(extracted.location) || candidate.location,
      url: applyUrl,
      description: finalDescription,
      posted_at: asString(extracted.posted_at) || candidate.posted_at,
      provider_source_id: `firecrawl_extract:${applyUrl}`,
      source_kind: inferSourceKind(applyUrl, asString(extracted.title) || candidate.title),
      source_confidence: isKnownJobDetailUrl(applyUrl) ? 0.88 : 0.76,
      salary_min: salary.salary_min ?? null,
      salary_max: salary.salary_max ?? null,
      salary_currency: salary.salary_currency ?? null,
      raw_data: {
        provider: "firecrawl",
        extraction_method: "scrape_json_markdown",
        salary: salary.salary_raw || null,
        tags: Array.isArray(extracted.tags) ? extracted.tags : [],
      },
    };
  } catch (error) {
    console.warn("firecrawl.scrape_failed", {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function parseGreenhouseUrl(
  url: string,
): { boardToken: string; jobId?: string } | null {
  const parsed = safeUrl(url);
  if (!parsed || !/greenhouse/i.test(parsed.hostname)) return null;

  const parts = parsed.pathname.split("/").filter(Boolean);
  const boardToken =
    (parts[0] && parts[0] !== "embed" ? parts[0] : asString(parsed.searchParams.get("for"))) ||
    undefined;
  const numericPart = parts.find((part) => /^\d+$/.test(part));
  const jobId = numericPart || asString(parsed.searchParams.get("gh_jid")) || undefined;

  if (!boardToken) return null;
  return { boardToken, jobId };
}

function parseLeverUrl(url: string): { site: string; jobId?: string } | null {
  const parsed = safeUrl(url);
  if (!parsed || !/lever\.co$/i.test(parsed.hostname)) return null;
  const parts = parsed.pathname.split("/").filter(Boolean);
  const site = parts[0];
  const jobId = parts[1];
  if (!site) return null;
  return { site, jobId };
}

function parseAshbyUrl(url: string): { board: string; jobId?: string } | null {
  const parsed = safeUrl(url);
  if (!parsed || !/ashby/i.test(parsed.hostname)) return null;
  const parts = parsed.pathname.split("/").filter(Boolean);
  const board =
    parts[0] ||
    parsed.hostname.split(".").filter((part) => part !== "jobs" && part !== "ashbyhq")[0];
  const jobId = parts[1];
  if (!board) return null;
  return { board, jobId };
}

function parseWorkableUrl(
  url: string,
): { account: string; jobId?: string } | null {
  const parsed = safeUrl(url);
  if (!parsed || !/workable/i.test(parsed.hostname)) return null;

  const parts = parsed.pathname.split("/").filter(Boolean);
  let account = parsed.hostname.split(".")[0];
  if (account === "apply" && parts[0]) {
    account = parts[0];
  }

  const jobId =
    parts.find((part, index) => parts[index - 1] === "j") ||
    parts.find((part) => /^[a-z0-9-]{6,}$/i.test(part));

  return account ? { account, jobId } : null;
}

async function fetchGreenhouseBoardJobs(
  boardToken: string,
  companyHint?: string,
): Promise<NormalizedProviderJob[]> {
  const res = await fetchWithTimeout(
    `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`,
    {},
    PROVIDER_LOOKUP_TIMEOUT_MS,
  );
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];

  return jobs
    .map((job: Record<string, unknown>) => {
      const title = asString(job.title);
      const url = normalizeCanonicalJobUrl(asString(job.absolute_url));
      if (!title || !url) return null;

      return {
        title,
        company: companyHint || domainLabel(boardToken),
        location:
          asString((job.location as Record<string, unknown> | undefined)?.name) ||
          null,
        url,
        description: trimText(stripHtmlTags(asString(job.content) || ""), 16000),
        posted_at: asString(job.updated_at),
        provider_source_id: `greenhouse:${boardToken}:${job.id}`,
        provider_job_id: asString(job.id) || undefined,
        source_kind: "greenhouse" as const,
        source_confidence: 0.98,
        raw_data: {
          provider: "greenhouse",
          board_token: boardToken,
          provider_job_id: job.id,
        },
      } as NormalizedProviderJob;
    })
    .filter(
      (job: NormalizedProviderJob | null): job is NormalizedProviderJob =>
        Boolean(job) && !isStalePostedAt(job?.posted_at),
    );
}

async function fetchLeverSiteJobs(
  site: string,
  companyHint?: string,
): Promise<NormalizedProviderJob[]> {
  const res = await fetchWithTimeout(
    `https://api.lever.co/v0/postings/${site}?mode=json`,
    {},
    PROVIDER_LOOKUP_TIMEOUT_MS,
  );
  if (!res.ok) return [];
  const jobs = await res.json().catch(() => []);
  if (!Array.isArray(jobs)) return [];

  return jobs
    .map((job: Record<string, unknown>) => {
      const title = asString(job.text);
      const url = normalizeCanonicalJobUrl(asString(job.hostedUrl));
      if (!title || !url) return null;

      const categories =
        job.categories && typeof job.categories === "object"
          ? (job.categories as Record<string, unknown>)
          : {};

      return {
        title,
        company: companyHint || domainLabel(site),
        location: asString(categories.location) || null,
        url,
        description: trimText(
          uniqueStrings([
            asString(job.descriptionPlain),
            asString(job.additionalPlain),
          ]).join("\n\n"),
          16000,
        ),
        posted_at: asString(job.createdAt),
        provider_source_id: `lever:${site}:${job.id}`,
        provider_job_id: asString(job.id) || undefined,
        source_kind: "lever" as const,
        source_confidence: 0.97,
        raw_data: {
          provider: "lever",
          site,
          provider_job_id: job.id,
          categories,
        },
      } as NormalizedProviderJob;
    })
    .filter(
      (job: NormalizedProviderJob | null): job is NormalizedProviderJob =>
        Boolean(job) && !isStalePostedAt(job?.posted_at),
    );
}

async function fetchAshbyBoardJobs(
  board: string,
  companyHint?: string,
): Promise<NormalizedProviderJob[]> {
  const res = await fetchWithTimeout(
    `https://jobs.ashbyhq.com/posting-api/job-board/${board}?includeCompensation=true`,
    {},
    PROVIDER_LOOKUP_TIMEOUT_MS,
  );
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];

  return jobs
    .map((job: Record<string, unknown>) => {
      const title = asString(job.title);
      const url =
        normalizeCanonicalJobUrl(asString(job.jobUrl)) ||
        normalizeCanonicalJobUrl(asString(job.applyUrl));
      if (!title || !url) return null;

      return {
        title,
        company: companyHint || domainLabel(board),
        location:
          asString(job.location) ||
          asString(job.locationName) ||
          asString((job.location as Record<string, unknown> | undefined)?.name) ||
          null,
        url,
        description: trimText(
          stripHtmlTags(
            asString(job.descriptionHtml) ||
              asString(job.descriptionPlain) ||
              "",
          ),
          16000,
        ),
        posted_at: asString(job.publishedAt) || asString(job.createdAt),
        provider_source_id: `ashby:${board}:${job.id || title}`,
        provider_job_id: asString(job.id) || undefined,
        source_kind: "ashby" as const,
        source_confidence: 0.97,
        raw_data: {
          provider: "ashby",
          board,
          compensation: job.compensation,
        },
      } as NormalizedProviderJob;
    })
    .filter(
      (job: NormalizedProviderJob | null): job is NormalizedProviderJob =>
        Boolean(job) && !isStalePostedAt(job?.posted_at),
    );
}

async function fetchWorkableAccountJobs(
  account: string,
  companyHint?: string,
): Promise<NormalizedProviderJob[]> {
  const res = await fetchWithTimeout(
    `https://www.workable.com/api/accounts/${account}?details=true`,
    {},
    PROVIDER_LOOKUP_TIMEOUT_MS,
  );
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];

  return jobs
    .map((job: Record<string, unknown>) => {
      const title =
        asString(job.title) || asString(job.full_title) || asString(job.name);
      const url =
        normalizeCanonicalJobUrl(asString(job.url)) ||
        normalizeCanonicalJobUrl(asString(job.shortlink)) ||
        normalizeCanonicalJobUrl(asString(job.apply_url));
      if (!title || !url) return null;

      const locationObj =
        job.location && typeof job.location === "object"
          ? (job.location as Record<string, unknown>)
          : {};

      const locationText =
        asString(job.location) ||
        uniqueStrings([
          asString(locationObj.city),
          asString(locationObj.country),
        ]).join(", ");

      return {
        title,
        company: companyHint || domainLabel(account),
        location: locationText || null,
        url,
        description: trimText(
          stripHtmlTags(
            asString(job.description) ||
              asString(job.requirements) ||
              asString(job.benefits) ||
              "",
          ),
          16000,
        ),
        posted_at: asString(job.published) || asString(job.created_at),
        provider_source_id: `workable:${account}:${job.id || title}`,
        provider_job_id: asString(job.id) || undefined,
        source_kind: "workable" as const,
        source_confidence: 0.96,
        raw_data: {
          provider: "workable",
          account,
        },
      } as NormalizedProviderJob;
    })
    .filter(
      (job: NormalizedProviderJob | null): job is NormalizedProviderJob =>
        Boolean(job) && !isStalePostedAt(job?.posted_at),
    );
}

function extractMetaContent(html: string, key: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return stripHtmlTags(match[1]);
  }
  return null;
}

function extractJsonLdJobPosting(html: string): Record<string, unknown> | null {
  const matches = Array.from(
    html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  );

  for (const match of matches) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      const payload = JSON.parse(raw);
      const items = Array.isArray(payload) ? payload : [payload];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const record = item as Record<string, unknown>;
        if (record["@type"] === "JobPosting") {
          return record;
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

function parseJsonLdBaseSalary(baseSalary: unknown): SalarySignal {
  const record = toRecord(baseSalary);
  const value = toRecord(record.value);
  const raw = uniqueStrings([
    asString(record.currency),
    asString(record.unitText),
    asString(value.unitText),
    asString(value.value),
  ]).join(" ");

  const minValue = Number(value.minValue ?? value.value);
  const maxValue = Number(value.maxValue ?? value.value);
  const currency = asString(record.currency) || asString(value.currency) || null;

  return mergeSalarySignals(
    {
      salary_min: Number.isFinite(minValue) ? Math.round(minValue) : null,
      salary_max: Number.isFinite(maxValue) ? Math.round(maxValue) : null,
      salary_currency: currency,
      salary_raw: raw || null,
    },
    parseSalaryText(raw),
  );
}

async function fetchDirectJobPage(
  url: string,
  companyHint?: string,
): Promise<NormalizedProviderJob | null> {
  try {
    const res = await fetchWithTimeout(
      url,
      {
        headers: {
          "user-agent": "JobrakerBot/1.0 (+https://jobraker.com)",
        },
      },
      DIRECT_PAGE_FETCH_TIMEOUT_MS,
    );
    if (!res.ok) return null;

    const html = await res.text();
    const canonicalUrl = normalizeCanonicalJobUrl(url) || url;
    const jobPosting = extractJsonLdJobPosting(html);
    const pageTitleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const pageTitle = stripHtmlTags(pageTitleMatch?.[1] || "");
    const metaTitle =
      extractMetaContent(html, "og:title") || extractMetaContent(html, "title");
    const metaDescription =
      extractMetaContent(html, "description") ||
      extractMetaContent(html, "og:description");

    if (jobPosting) {
      const hiringOrganization = toRecord(jobPosting.hiringOrganization);
      const jobLocation = toRecord(jobPosting.jobLocation);
      const address = toRecord(jobLocation.address);
      const salary = parseJsonLdBaseSalary(jobPosting.baseSalary);
      return {
        title:
          asString(jobPosting.title) || metaTitle || pageTitle || "Job opening",
        company:
          asString(hiringOrganization.name) ||
          companyHint ||
          domainLabel(hostFromUrl(canonicalUrl)),
        location:
          asString(address.addressLocality) ||
          asString(address.addressCountry) ||
          deriveLocationFromText(metaDescription || "") ||
          null,
        url: canonicalUrl,
        description: cleanJobDescription(asString(jobPosting.description) || metaDescription || ""),
        posted_at: asString(jobPosting.datePosted),
        provider_source_id: `direct:${canonicalUrl}`,
        source_kind: "direct",
        source_confidence: 0.9,
        salary_min: salary.salary_min ?? null,
        salary_max: salary.salary_max ?? null,
        salary_currency: salary.salary_currency ?? null,
        raw_data: {
          provider: "direct",
          schema_type: "JobPosting",
          salary: salary.salary_raw || null,
        },
      };
    }

    const bodyPreview = cleanJobDescription(html);
    if (!/job|career|responsibilit|qualif|apply/i.test(bodyPreview)) {
      return null;
    }
    if (isLikelyAggregateJobPage(canonicalUrl, metaTitle || pageTitle, bodyPreview)) {
      return null;
    }
    const salary = parseSalaryText(bodyPreview);

    return {
      title: metaTitle || pageTitle || "Job opening",
      company: companyHint || domainLabel(hostFromUrl(canonicalUrl)),
      location: deriveLocationFromText(bodyPreview) || null,
      url: canonicalUrl,
      description: trimText(metaDescription || bodyPreview, 16000),
      posted_at: null,
      provider_source_id: `direct:${canonicalUrl}`,
      source_kind: "direct",
      source_confidence: 0.82,
      salary_min: salary.salary_min ?? null,
      salary_max: salary.salary_max ?? null,
      salary_currency: salary.salary_currency ?? null,
      raw_data: {
        provider: "direct",
        schema_type: "html_fallback",
        salary: salary.salary_raw || null,
      },
    };
  } catch {
    return null;
  }
}

async function getCachedProviderJobs(
  cache: Map<string, Promise<NormalizedProviderJob[]>>,
  key: string,
  fetcher: () => Promise<NormalizedProviderJob[]>,
): Promise<NormalizedProviderJob[]> {
  if (!cache.has(key)) {
    cache.set(key, fetcher());
  }
  return cache.get(key)!;
}

function matchProviderJob(
  jobs: NormalizedProviderJob[],
  normalizedUrl: string,
  providerJobId?: string,
): NormalizedProviderJob | null {
  for (const job of jobs) {
    if (normalizeCanonicalJobUrl(job.url) === normalizedUrl) {
      return job;
    }
  }

  if (!providerJobId) return null;
  for (const job of jobs) {
    if (job.provider_job_id && String(job.provider_job_id) === providerJobId) {
      return job;
    }
    if (job.provider_source_id.endsWith(`:${providerJobId}`)) {
      return job;
    }
  }

  return null;
}

async function normalizeCandidate(
  candidate: FirecrawlSearchCandidate,
  context: NormalizationContext,
  options?: { allowDirectPageFetch?: boolean; apiKey?: string },
): Promise<DiscoveryJob> {
  const canonicalUrl = normalizeCanonicalJobUrl(candidate.url) || candidate.url;
  const classifiedAs = inferSourceKind(canonicalUrl, candidate.title);

  let normalized: NormalizedProviderJob | null = null;
  let normalizationSource = "firecrawl_fallback";
  let providerSourceId: string | null = null;

  if (classifiedAs === "greenhouse") {
    const parsed = parseGreenhouseUrl(canonicalUrl);
    if (parsed) {
      const jobs = await getCachedProviderJobs(
        context.greenhouseBoards,
        parsed.boardToken,
        () => fetchGreenhouseBoardJobs(parsed.boardToken, candidate.company),
      );
      normalized = matchProviderJob(jobs, canonicalUrl, parsed.jobId);
      if (normalized) normalizationSource = "greenhouse_board_lookup";
    }
  } else if (classifiedAs === "lever") {
    const parsed = parseLeverUrl(canonicalUrl);
    if (parsed) {
      const jobs = await getCachedProviderJobs(
        context.leverSites,
        parsed.site,
        () => fetchLeverSiteJobs(parsed.site, candidate.company),
      );
      normalized = matchProviderJob(jobs, canonicalUrl, parsed.jobId);
      if (normalized) normalizationSource = "lever_site_lookup";
    }
  } else if (classifiedAs === "ashby") {
    const parsed = parseAshbyUrl(canonicalUrl);
    if (parsed) {
      const jobs = await getCachedProviderJobs(
        context.ashbyBoards,
        parsed.board,
        () => fetchAshbyBoardJobs(parsed.board, candidate.company),
      );
      normalized = matchProviderJob(jobs, canonicalUrl, parsed.jobId);
      if (normalized) normalizationSource = "ashby_board_lookup";
    }
  } else if (classifiedAs === "workable") {
    const parsed = parseWorkableUrl(canonicalUrl);
    if (parsed) {
      const jobs = await getCachedProviderJobs(
        context.workableAccounts,
        parsed.account,
        () => fetchWorkableAccountJobs(parsed.account, candidate.company),
      );
      normalized = matchProviderJob(jobs, canonicalUrl, parsed.jobId);
      if (normalized) normalizationSource = "workable_account_lookup";
    }
  }

  if (!normalized && candidate.description && candidate.description.length >= 250) {
    normalized = {
      title: candidate.title,
      company: candidate.company,
      location: candidate.location,
      url: candidate.url,
      description: candidate.description,
      posted_at: candidate.posted_at,
      source_kind: candidate.source_kind,
      source_confidence: candidate.source_confidence,
      salary_min: candidate.salary_min ?? null,
      salary_max: candidate.salary_max ?? null,
      salary_currency: candidate.salary_currency ?? null,
      raw_data: candidate.raw_data,
    };
    normalizationSource = "search_seed_markdown";
  }

  if (!normalized && options?.allowDirectPageFetch !== false) {
    const direct = await fetchDirectJobPage(canonicalUrl, candidate.company);
    if (direct) {
      normalized = direct;
      normalizationSource = classifiedAs === "direct"
        ? "direct_job_page"
        : "direct_page_fallback";
    }
  }

  // Final fallback/enrichment: use Firecrawl scrape JSON + clean markdown.
  // This is deliberately "detail page first": if Firecrawl says the page is a
  // list/search page, we do not invent or persist it as a job.
  if ((!normalized?.description || normalized.description.length < 500) && options?.apiKey) {
    const extracted = await fetchFirecrawlJobExtraction(canonicalUrl, options.apiKey, candidate);
    if (extracted) {
      if (normalized) {
        normalized = {
          ...normalized,
          title: extracted.title || normalized.title,
          company: extracted.company || normalized.company,
          location: extracted.location || normalized.location,
          url: extracted.url || normalized.url,
          description: extracted.description || normalized.description,
          posted_at: extracted.posted_at || normalized.posted_at,
          salary_min: extracted.salary_min ?? normalized.salary_min ?? null,
          salary_max: extracted.salary_max ?? normalized.salary_max ?? null,
          salary_currency: extracted.salary_currency ?? normalized.salary_currency ?? null,
          raw_data: {
            ...normalized.raw_data,
            firecrawl_extraction: extracted.raw_data,
          },
        };
        normalizationSource = `${normalizationSource}_with_firecrawl_extract`;
      } else {
        normalized = extracted;
        normalizationSource = "firecrawl_extract_primary";
      }
    }
  }

  providerSourceId = normalized?.provider_source_id || null;

  const finalUrl = normalizeCanonicalJobUrl(normalized?.url) || canonicalUrl;
  const finalSourceKind =
    normalized?.source_kind ||
    (classifiedAs === "firecrawl" ? inferSourceKind(finalUrl, candidate.title) : classifiedAs);

  const finalTitle = trimText(normalized?.title || candidate.title || "Job opening", 300);
  const finalCompany = trimText(
    normalized?.company || candidate.company || domainLabel(hostFromUrl(canonicalUrl)),
    200,
  );
  const finalLocation = normalized?.location || candidate.location || null;
  const finalDescription = trimText(
    cleanJobDescription(normalized?.description || candidate.description || ""),
    16000,
  );
  const finalPostedAt = normalized?.posted_at || candidate.posted_at || null;
  const salary = mergeSalarySignals(
    {
      salary_min: normalized?.salary_min ?? null,
      salary_max: normalized?.salary_max ?? null,
      salary_currency: normalized?.salary_currency ?? null,
    },
    {
      salary_min: candidate.salary_min ?? null,
      salary_max: candidate.salary_max ?? null,
      salary_currency: candidate.salary_currency ?? null,
    },
    parseSalaryText(finalDescription),
  );

  let confidence = candidate.source_confidence;
  if (normalized && normalizationSource.endsWith("_lookup")) {
    confidence = normalized.source_confidence;
  } else if (normalized && normalizationSource === "direct_page_fallback") {
    confidence = classifiedAs === "firecrawl"
      ? normalized.source_confidence
      : 0.84;
  } else if (normalized) {
    confidence = normalized.source_confidence;
  }

  const discovery = {
    mode: "firecrawl",
    seed_matches: candidate.seed_matches,
    firecrawl_queries: candidate.firecrawl_queries,
    classified_as: classifiedAs,
    normalization_source: normalizationSource,
    provider_source_id: providerSourceId,
    canonical_url: canonicalUrl,
    final_url: finalUrl,
  };

  return {
    title: finalTitle,
    company: finalCompany,
    location: finalLocation,
    url: finalUrl,
    description: finalDescription,
    posted_at: finalPostedAt,
    source_id: `job:${finalUrl}`,
    source_type: "web_search",
    source_kind: finalSourceKind,
    source_confidence: Math.max(0.5, Math.min(0.99, confidence)),
    verification_status: "unverified",
    is_tracked_company: candidate.is_tracked_company,
    salary_min: salary.salary_min ?? null,
    salary_max: salary.salary_max ?? null,
    salary_currency: salary.salary_currency ?? null,
    raw_data: {
      ...candidate.raw_data,
      provider_source_id: providerSourceId,
      salary: salary.salary_raw || toRecord(normalized?.raw_data).salary || toRecord(candidate.raw_data).salary || null,
      normalization: {
        classified_as: classifiedAs,
        normalization_source: normalizationSource,
        provider_source_id: providerSourceId,
        provider_job_id: normalized?.provider_job_id || null,
        normalized_via: normalized?.source_kind || null,
      },
      discovery,
    },
  };
}

const tryFetchStatus = async (url: string, method: "HEAD" | "GET") => {
  const response = await fetchWithTimeout(
    url,
    {
      method,
      redirect: "follow",
      headers: {
        "user-agent": "JobrakerBot/1.0 (+https://jobraker.com)",
      },
    },
    URL_VERIFY_TIMEOUT_MS,
  );
  return response.status;
};

async function verifyJobUrl(url: string): Promise<VerificationStatus> {
  try {
    const headStatus = await tryFetchStatus(url, "HEAD");
    if (headStatus >= 200 && headStatus < 400) return "verified";
    if (headStatus === 404 || headStatus === 410) return "stale";
    return "unverified";
  } catch {
    return "unverified";
  }
}

async function verifyJobs(jobs: DiscoveryJob[]): Promise<DiscoveryJob[]> {
  return runWithConcurrency(jobs, URL_VERIFY_CONCURRENCY, async (job) => {
    const verificationStatus = await verifyJobUrl(job.url);
    const discovery = toRecord(job.raw_data.discovery);
    return {
      ...job,
      verification_status: verificationStatus,
      raw_data: {
        ...job.raw_data,
        discovery: {
          ...discovery,
          verification_status: verificationStatus,
        },
      },
    };
  });
}

/** ISO country hint for Firecrawl geo-targeting (optional). */
const inferCountryFromLocation = (location: string): string | undefined => {
  const lower = location.toLowerCase();
  if (/\bnigeria\b/.test(lower)) return "NG";
  if (/\b(united states|u\.s\.a\.?|usa)\b/.test(lower)) return "US";
  if (/\b(united kingdom|england|scotland|wales)\b/.test(lower) || /\buk\b/.test(lower))
    return "UK";
  if (/\bcanada\b/.test(lower)) return "CA";
  return undefined;
};

const fallbackFirecrawlSearch = async (
  query: string,
  location: string,
  limit: number,
): Promise<DiscoveryJob[]> => {
  let firecrawlApiKey: string;
  try {
    firecrawlApiKey = await resolveFirecrawlApiKey();
  } catch {
    return [];
  }

  const loc = (location || "Remote").trim();
  const country = inferCountryFromLocation(loc);
  const payload: Record<string, unknown> = {
    query: `${query} ${loc} jobs (hiring OR careers OR openings) -inurl:search -inurl:login`,
    limit,
    sources: ["web"],
  };
  if (loc.toLowerCase() !== "remote") {
    payload.location = loc;
    if (country) payload.country = country;
  }

  let response: { data?: { web?: unknown[] } } | null;
  try {
    response = await withRetry(
      () => firecrawlFetch("/search", firecrawlApiKey, payload),
      3,
      1200,
    );
  } catch (e: unknown) {
    const err = e as { firecrawlError?: string; message?: string };
    console.error("firecrawl.seed_search_failed", {
      query: payload.query,
      seedType: "general",
      error: err?.firecrawlError || err?.message || String(e),
    });
    return [];
  }

  const items = Array.isArray(response?.data?.web) ? response.data.web : [];
  const results: DiscoveryJob[] = [];
  for (const raw of items) {
    const item = toRecord(raw);
    const url =
      normalizeCanonicalJobUrl(asString(item.url)) ||
      normalizeCanonicalJobUrl(
        asString((item.metadata as Record<string, unknown> | undefined)?.sourceURL),
      );
    if (!url) continue;
    if (isProfileUrl(url)) continue;
    const sourceKind = inferSourceKind(url, null);
    const rawTitle =
      asString(item.title) ||
      asString((item.metadata as Record<string, unknown> | undefined)?.title) ||
      "Job opening";
    if (titleLooksLikeProfile(rawTitle)) continue;
    const company =
      rawTitle.split(/[|:-]| at /i).slice(-1)[0]?.trim() ||
      hostFromUrl(url) ||
      "Unknown";
    results.push({
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
    });
  }
  return results;
};

function buildProfileTerms(memory: CandidateMemory): string[] {
  return uniqueStrings([
    ...(memory.headline ? extractTerms(memory.headline) : []),
    ...memory.skillKeywords.slice(0, 10).flatMap((keyword) => extractTerms(keyword)),
    ...memory.goals.slice(0, 5).flatMap((goal) => extractTerms(goal)),
    ...memory.targetArchetypes.slice(0, 4).flatMap((goal) => extractTerms(goal)),
  ]).slice(0, 24);
}

function computeRankingSignals(
  job: DiscoveryJob,
  searchQuery: string,
  requestedLocation: string,
  memory: CandidateMemory,
): RankingSignals {
  const haystack = `${job.title} ${job.description}`.toLowerCase();
  const roleTerms = extractTerms(searchQuery);
  const matchedRoleTerms = roleTerms.filter((term) => haystack.includes(term));
  const roleOverlap = roleTerms.length === 0
    ? 60
    : Math.round((matchedRoleTerms.length / roleTerms.length) * 100);

  const profileTerms = buildProfileTerms(memory);
  const matchedProfileTerms = profileTerms.filter((term) => haystack.includes(term));
  const profileAlignment = profileTerms.length === 0
    ? 60
    : Math.min(
      100,
      Math.round((matchedProfileTerms.length / profileTerms.length) * 180),
    );

  const locationAlignment = evaluateLocationAlignment(
    job.location,
    requestedLocation || memory.location || "Remote",
  );

  const discovery = toRecord(job.raw_data.discovery);
  const seedMatches = asStringArray(discovery.seed_matches);
  const seedBonus = seedMatches.length > 0 ? Math.min(12, seedMatches.length * 4) : 0;
  const trackedCompanyBonus = job.is_tracked_company ? 15 : 0;
  const confidenceScore = Math.round(job.source_confidence * 100);

  const total = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        confidenceScore * 0.35 +
          roleOverlap * 0.25 +
          locationAlignment * 0.15 +
          profileAlignment * 0.15 +
          trackedCompanyBonus +
          seedBonus,
      ),
    ),
  );

  return {
    total,
    source_confidence: confidenceScore,
    role_overlap: roleOverlap,
    location_alignment: locationAlignment,
    profile_alignment: profileAlignment,
    tracked_company_bonus: trackedCompanyBonus,
    seed_bonus: seedBonus,
    matched_role_terms: matchedRoleTerms,
    matched_profile_terms: matchedProfileTerms.slice(0, 10),
  };
}

function attachRankingSignals(
  job: DiscoveryJob,
  signals: RankingSignals,
): DiscoveryJob {
  const discovery = toRecord(job.raw_data.discovery);
  return {
    ...job,
    raw_data: {
      ...job.raw_data,
      discovery: {
        ...discovery,
        ranking_signals: signals,
        rank_score: signals.total,
      },
    },
  };
}

function compareRankedJobs(left: DiscoveryJob, right: DiscoveryJob): number {
  const leftDiscovery = toRecord(left.raw_data.discovery);
  const rightDiscovery = toRecord(right.raw_data.discovery);
  const leftSignals = toRecord(leftDiscovery.ranking_signals);
  const rightSignals = toRecord(rightDiscovery.ranking_signals);
  const leftRank = Number(leftSignals.total ?? 0);
  const rightRank = Number(rightSignals.total ?? 0);

  if (rightRank !== leftRank) return rightRank - leftRank;

  const verificationDelta =
    verificationRank(right.verification_status) -
    verificationRank(left.verification_status);
  if (verificationDelta !== 0) return verificationDelta;

  if (right.source_confidence !== left.source_confidence) {
    return right.source_confidence > left.source_confidence ? 1 : -1;
  }

  if (right.is_tracked_company !== left.is_tracked_company) {
    return right.is_tracked_company ? 1 : -1;
  }

  const rightPosted = right.posted_at ? new Date(right.posted_at).getTime() : 0;
  const leftPosted = left.posted_at ? new Date(left.posted_at).getTime() : 0;
  return rightPosted - leftPosted;
}

function onlyFreshOrUndatedJobs<T extends { posted_at: string | null }>(
  jobs: T[],
): T[] {
  return jobs.filter((job) => !isStalePostedAt(job.posted_at));
}

function chooseBetterDiscoveredJob(
  current: DiscoveryJob,
  incoming: DiscoveryJob,
): DiscoveryJob {
  const currentDiscovery = toRecord(current.raw_data.discovery);
  const incomingDiscovery = toRecord(incoming.raw_data.discovery);
  const currentSignals = toRecord(currentDiscovery.ranking_signals);
  const incomingSignals = toRecord(incomingDiscovery.ranking_signals);
  const currentRank = Number(currentSignals.total ?? 0);
  const incomingRank = Number(incomingSignals.total ?? 0);

  let winner = current;
  let loser = incoming;

  if (
    incomingRank > currentRank ||
    (incomingRank === currentRank &&
      (incoming.source_confidence > current.source_confidence ||
        (incoming.source_confidence === current.source_confidence &&
          verificationRank(incoming.verification_status) >
            verificationRank(current.verification_status))))
  ) {
    winner = incoming;
    loser = current;
  }

  const winnerDiscovery = toRecord(winner.raw_data.discovery);
  const loserDiscovery = toRecord(loser.raw_data.discovery);
  const mergedDiscovery = {
    ...winnerDiscovery,
    seed_matches: mergeDiscoveryArrays(
      winnerDiscovery.seed_matches,
      loserDiscovery.seed_matches,
    ),
    firecrawl_queries: mergeDiscoveryArrays(
      winnerDiscovery.firecrawl_queries,
      loserDiscovery.firecrawl_queries,
    ),
  };

  return {
    ...winner,
    raw_data: {
      ...winner.raw_data,
      discovery: mergedDiscovery,
    },
  };
}

function dedupeDiscoveredJobs(jobs: DiscoveryJob[]): DiscoveryJob[] {
  const byUrl = new Map<string, DiscoveryJob>();
  const urlForSourceId = new Map<string, string>();

  for (const job of jobs) {
    const canonicalUrl = normalizeCanonicalJobUrl(job.url) || job.url;
    const sourceId = asString(job.source_id);
    const existingUrl = byUrl.get(canonicalUrl);
    if (existingUrl) {
      byUrl.set(canonicalUrl, chooseBetterDiscoveredJob(existingUrl, job));
      if (sourceId) urlForSourceId.set(sourceId, canonicalUrl);
      continue;
    }

    if (sourceId && urlForSourceId.has(sourceId)) {
      const previousUrl = urlForSourceId.get(sourceId)!;
      const previous = byUrl.get(previousUrl);
      if (previous) {
        const merged = chooseBetterDiscoveredJob(previous, job);
        byUrl.delete(previousUrl);
        byUrl.set(canonicalUrl, merged);
        urlForSourceId.set(sourceId, canonicalUrl);
        continue;
      }
    }

    byUrl.set(canonicalUrl, job);
    if (sourceId) urlForSourceId.set(sourceId, canonicalUrl);
  }

  return Array.from(byUrl.values());
}

// ---------------------------------------------------------------------------
// Location broadening helpers
// ---------------------------------------------------------------------------

/** Known country names mapped from city/region locations. */
const COUNTRY_NAMES: Record<string, string> = {
  NG: "Nigeria",
  US: "United States",
  UK: "United Kingdom",
  CA: "Canada",
};

/**
 * Broaden a location string: city → country → Remote.
 * Returns null when no further broadening is possible.
 */
function broadenLocation(location: string): string | null {
  const lower = location.toLowerCase().trim();
  if (lower === "remote") return null; // already broadest

  // If it looks like a country already, broaden to Remote
  const knownCountries = Object.values(COUNTRY_NAMES).map((c) => c.toLowerCase());
  if (knownCountries.includes(lower)) return "Remote";

  // Try to extract country from the location string
  const country = inferCountryFromLocation(location);
  if (country && COUNTRY_NAMES[country]) return COUNTRY_NAMES[country];

  // Fallback: just go to Remote
  return "Remote";
}

/**
 * Unrestricted web search — searches the open web without domain restrictions.
 * Used as a last resort when configured sources yield 0 results.
 * Returns jobs with lower confidence scores to reflect the broader source.
 */
async function unrestrictedWebSearch(
  searchQuery: string,
  location: string,
  limit: number,
): Promise<DiscoveryJob[]> {
  let apiKey: string;
  try {
    apiKey = await resolveFirecrawlApiKey();
  } catch {
    return [];
  }

  const loc = (location || "Remote").trim();
  const country = inferCountryFromLocation(loc);
  const payload: Record<string, unknown> = {
    query: `${searchQuery} ${loc} job posting (hiring OR careers OR apply) -inurl:search -inurl:login`,
    limit: Math.min(limit * 2, 30),
    sources: ["web"],
    scrapeOptions: {
      formats: ["markdown", "links"],
      onlyMainContent: true,
      onlyCleanContent: true,
      removeBase64Images: true,
      blockAds: true,
    },
  };
  if (loc.toLowerCase() !== "remote") {
    payload.location = loc;
    if (country) payload.country = country;
  }

  let response: { data?: { web?: unknown[] } } | null;
  try {
    response = await withRetry(
      () => firecrawlFetch("/search", apiKey, payload),
      2,
      1500,
    );
  } catch (e: unknown) {
    const err = e as { firecrawlError?: string; message?: string };
    console.error("firecrawl.unrestricted_search_failed", {
      query: payload.query,
      error: err?.firecrawlError || err?.message || String(e),
    });
    return [];
  }

  const items = Array.isArray(response?.data?.web) ? response.data.web : [];
  console.info("firecrawl.unrestricted_search", {
    query: payload.query,
    rawCount: items.length,
  });

  const results: DiscoveryJob[] = [];
  for (const raw of items) {
    const item = toRecord(raw);
    const metadata = toRecord(item.metadata);
    const url =
      normalizeCanonicalJobUrl(asString(item.url)) ||
      normalizeCanonicalJobUrl(asString(metadata.sourceURL));
    if (!url) continue;
    if (isProfileUrl(url)) continue;
    if (/\/login|\/signin|\/auth/i.test(url)) continue;

    const rawTitle =
      asString(item.title) ||
      asString(metadata.title) ||
      asString(metadata.ogTitle) ||
      "Job opening";
    if (titleLooksLikeProfile(rawTitle)) continue;

    const description = cleanJobDescription(
      asString(item.markdown) || asString(item.description) || asString(metadata.description) || "",
      16000,
    );
    if (isLikelyAggregateJobPage(url, rawTitle, description)) continue;

    const company =
      rawTitle.split(/[|:\-–]| at /i).slice(-1)[0]?.trim() ||
      hostFromUrl(url) ||
      "Unknown";

    const sourceKind = inferSourceKind(url, rawTitle);
    const postedAt = parsePublishedAt(metadata);
    if (isStalePostedAt(postedAt)) continue;
    const salary = parseSalaryText(description);

    results.push({
      title: trimText(rawTitle, 300),
      company: trimText(company, 200),
      location: loc,
      url,
      description,
      posted_at: postedAt,
      source_id: `firecrawl:${url}`,
      source_type: "web_search" as const,
      source_kind: sourceKind === "direct" ? "firecrawl" : sourceKind,
      // Lower confidence for unrestricted results
      source_confidence: sourceKind === "direct" ? 0.55 : 0.65,
      verification_status: "unverified" as const,
      is_tracked_company: false,
      salary_min: salary.salary_min ?? null,
      salary_max: salary.salary_max ?? null,
      salary_currency: salary.salary_currency ?? null,
      raw_data: {
        provider: "firecrawl",
        discovery_mode: "unrestricted_fallback",
        metadata,
        salary: salary.salary_raw || null,
      },
    });
  }
  return results;
}

export async function discoverJobsFirecrawl(
  args: FirecrawlDiscoveryArgs,
  onBatch?: (jobs: DiscoveryJob[]) => Promise<void>,
): Promise<DiscoveryResult> {
  const startedAt = Date.now();
  const warnings: string[] = [];
  const apiKey = await resolveFirecrawlApiKey();
  const context = await buildSearchContext(args.serviceClient, args.userId);
  const requestedSources = normalizePublicJobSources(args.sourceFocus);
  const targetDomains = normalizeTargetDomains([
    ...(args.targetDomains || []),
    ...extractTargetDomainsFromText(args.searchQuery),
  ]);
  const roleQuery = targetDomains.length > 0
    ? stripSourceTargetsFromQuery(args.searchQuery) || args.searchQuery
    : args.searchQuery;
  if (requestedSources.includes("x")) {
    warnings.push(
      "X/Twitter discovery uses public/indexed pages only. JobRaker will not bypass logins, CAPTCHAs, or private profile access.",
    );
  }
  if (requestedSources.some((source) => ["reddit", "hackernews", "x", "community"].includes(source))) {
    warnings.push(
      "Community-source results are treated as leads until verified against an official company careers page or application channel.",
    );
  }
  if (targetDomains.length > 0) {
    warnings.push(
      `Restricted search to requested career-source domain${targetDomains.length === 1 ? "" : "s"}: ${targetDomains.join(", ")}.`,
    );
  }
  const seeds = buildSearchSeeds(args, context);
  console.info("firecrawl.discovery.stage", {
    stage: "seed_build",
    seedCount: seeds.length,
    sourceFocus: requestedSources,
    limit: args.limit,
    elapsed_ms: Date.now() - startedAt,
  });

  const seedResults = (
    await runWithConcurrency(seeds, 3, (seed) =>
      runSeedSearch(seed, apiKey, context.settings)
    )
  ).flat();
  console.info("firecrawl.discovery.stage", {
    stage: "seed_search",
    seedCount: seeds.length,
    seedResultCount: seedResults.length,
    elapsed_ms: Date.now() - startedAt,
  });

  const rawByUrl = new Map<string, FirecrawlSearchCandidate>();
  for (const candidate of seedResults) {
    if (!candidateMatchesTargetDomains(candidate, targetDomains)) continue;
    const trackedDomainHit = matchesTrackedDomain(
      hostFromUrl(candidate.url),
      context.trackedCompanyDomains,
    );
    const enrichedCandidate = trackedDomainHit
      ? {
          ...candidate,
          is_tracked_company: true,
          seed_matches: uniqueStrings([
            ...candidate.seed_matches,
            "tracked_company_domain",
            hostFromUrl(candidate.url),
          ]),
        }
      : candidate;

    if (!roleMatches(enrichedCandidate, roleQuery)) continue;
    const key = normalizeCanonicalJobUrl(enrichedCandidate.url) || enrichedCandidate.url;
    const existing = rawByUrl.get(key);
    rawByUrl.set(
      key,
      existing
        ? chooseBetterCandidate(existing, enrichedCandidate)
        : enrichedCandidate,
    );
  }

  const rawCandidates = Array.from(rawByUrl.values())
    .sort((left, right) => {
      if (left.is_tracked_company !== right.is_tracked_company) {
        return left.is_tracked_company ? -1 : 1;
      }
      if (left.priority !== right.priority) return left.priority - right.priority;
      return right.source_confidence - left.source_confidence;
    })
    .slice(0, Math.min(Math.max(args.limit + 6, 18), MAX_RAW_CANDIDATES));

  const directFetchBudget = Math.min(
    Math.max(Math.ceil(args.limit / 6), 4),
    MAX_DIRECT_FETCHES,
  );

  const batches: FirecrawlSearchCandidate[][] = [];
  for (let i = 0; i < rawCandidates.length; i += 10) {
    batches.push(rawCandidates.slice(i, i + 10));
  }

  const normalizationContext: NormalizationContext = {
    greenhouseBoards: new Map(),
    leverSites: new Map(),
    ashbyBoards: new Map(),
    workableAccounts: new Map(),
  };

  const batchResults = await runWithConcurrency(batches, 2, async (batchCandidates, b) => {
    const batchOffset = b * 10;
    
    const normalized = await runWithConcurrency(batchCandidates, 6, (candidate, index) =>
      normalizeCandidate(candidate, normalizationContext, {
        allowDirectPageFetch:
          candidate.is_tracked_company ||
          candidate.source_kind !== "firecrawl" ||
          candidate.priority <= 1 ||
          (batchOffset + index) < directFetchBudget,
        apiKey,
      })
    );

    const ranked = normalized
      .filter((job) => !isLikelyAggregateJobPage(job.url, job.title, job.description))
      .filter((job) => job.description.length >= 120 || isKnownJobDetailUrl(job.url))
      .filter((job) => roleMatches(job, roleQuery))
      .filter((job) => candidateMatchesTargetDomains(job, targetDomains))
      .filter((job) => !isStalePostedAt(job.posted_at))
      .map((job) =>
        attachRankingSignals(
          job,
          computeRankingSignals(
            job,
            roleQuery,
            args.location || context.candidateMemory.location || "Remote",
            context.candidateMemory,
          ),
        )
      );

    const deduped = dedupeDiscoveredJobs(ranked).sort(compareRankedJobs);
    
    // Partially verify this batch
    const verificationPool = deduped.slice(0, Math.min(deduped.length, 6));
    const verified = await verifyJobs(verificationPool);
    
    const verifiedUrls = new Set(verified.map((job) => job.url));
    const fallbackUnverified = deduped.filter((job) => !verifiedUrls.has(job.url));
    const batchFinal = [...verified, ...fallbackUnverified].sort(compareRankedJobs);

    if (onBatch && batchFinal.length > 0) {
      await onBatch(batchFinal);
    }

    console.info("firecrawl.discovery.batch_complete", {
      batchIndex: b,
      batchSize: batchFinal.length,
      elapsed_ms: Date.now() - startedAt,
    });

    return batchFinal;
  });

  const allProcessedJobs = batchResults.flat();

  let finalJobs = onlyFreshOrUndatedJobs(dedupeDiscoveredJobs(allProcessedJobs))
    .sort(compareRankedJobs)
    .slice(0, args.limit);

  // -----------------------------------------------------------------------
  // Fallback 1: Location broadening — try country-level then Remote
  // -----------------------------------------------------------------------
  if (targetDomains.length === 0 && finalJobs.length === 0) {
    const broadened = broadenLocation(args.location);
    if (broadened && broadened.toLowerCase() !== args.location.toLowerCase()) {
      console.info("firecrawl.discovery.broadening_location", {
        original: args.location,
        broadened,
        elapsed_ms: Date.now() - startedAt,
      });

      const broadenedSeeds = buildSearchSeeds(
        { ...args, location: broadened },
        context,
      );
      const broadenedResults = (
        await runWithConcurrency(broadenedSeeds, 3, (seed) =>
          runSeedSearch(seed, apiKey, context.settings),
        )
      ).flat();

      const broadenedByUrl = new Map<string, FirecrawlSearchCandidate>();
      for (const candidate of broadenedResults) {
        if (!roleMatches(candidate, args.searchQuery, true)) continue;
        const key = normalizeCanonicalJobUrl(candidate.url) || candidate.url;
        if (!broadenedByUrl.has(key)) broadenedByUrl.set(key, candidate);
      }

      if (broadenedByUrl.size > 0) {
        const broadenedCandidates = Array.from(broadenedByUrl.values())
          .sort((a, b) => b.source_confidence - a.source_confidence)
          .slice(0, Math.min(Math.max(args.limit + 6, 18), MAX_RAW_CANDIDATES));

        const broadenedNormalized = await runWithConcurrency(
          broadenedCandidates,
          6,
          (candidate) =>
            normalizeCandidate(candidate, normalizationContext, {
              allowDirectPageFetch: true,
              apiKey,
            }),
        );

        finalJobs = dedupeDiscoveredJobs(
          broadenedNormalized
            .filter((job) => !isLikelyAggregateJobPage(job.url, job.title, job.description))
            .filter((job) => job.description.length >= 120 || isKnownJobDetailUrl(job.url))
            .filter((job) => roleMatches(job, args.searchQuery, true))
            .filter((job) => !isStalePostedAt(job.posted_at)),
        )
          .sort(compareRankedJobs)
          .slice(0, args.limit);

        if (finalJobs.length > 0) {
          warnings.push(
            `No jobs found in "${args.location}". Showing results for "${broadened}" instead.`,
          );
          if (onBatch) await onBatch(finalJobs);
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Fallback 2: Unrestricted web search — search beyond configured sources
  // -----------------------------------------------------------------------
  if (targetDomains.length === 0 && finalJobs.length === 0) {
    console.info("firecrawl.discovery.unrestricted_fallback", {
      searchQuery: args.searchQuery,
      location: args.location,
      elapsed_ms: Date.now() - startedAt,
    });

    const unrestrictedJobs = await unrestrictedWebSearch(
      args.searchQuery,
      args.location,
      args.limit,
    );

    // Apply relaxed role matching
    const matched = onlyFreshOrUndatedJobs(
      unrestrictedJobs
        .filter((job) => !isLikelyAggregateJobPage(job.url, job.title, job.description))
        .filter((job) => job.description.length >= 120 || isKnownJobDetailUrl(job.url))
        .filter((job) => roleMatches(job, args.searchQuery, true)),
    );

    finalJobs = dedupeDiscoveredJobs(matched)
      .sort((a, b) => b.source_confidence - a.source_confidence)
      .slice(0, args.limit);

    if (finalJobs.length > 0) {
      warnings.push(
        "No results found from your configured job sources. These results were found from the broader web and may be less relevant.",
      );
      if (onBatch) await onBatch(finalJobs);
    } else {
      warnings.push(
        `Your search "${args.searchQuery}" in "${args.location}" is very specific and returned no results. Try broadening your job title or changing the location.`,
      );
    }
  }

  const socialLeadsAllowed = requestedSources.some((source) =>
    ["x", "reddit", "hackernews", "community"].includes(source)
  );
  finalJobs = finalJobs
    .filter((job) => candidateMatchesTargetDomains(job, targetDomains))
    .filter((job) => socialLeadsAllowed || !SOCIAL_SIGNAL_HOSTS.test(job.url))
    .slice(0, args.limit);

  if (targetDomains.length > 0 && finalJobs.length === 0) {
    warnings.push(
      "No matching jobs were found on the requested official career-source domains. I did not include off-domain social posts or broad web matches.",
    );
  }

  console.info("firecrawl.discovery.complete", {
    returnedCount: finalJobs.length,
    warningCount: warnings.length,
    elapsed_ms: Date.now() - startedAt,
  });
  return { jobs: finalJobs, warnings };
}

export async function discoverJobsHybrid(
  args: FirecrawlDiscoveryArgs,
): Promise<DiscoveryResult> {
  return discoverJobsFirecrawl(args);
}
