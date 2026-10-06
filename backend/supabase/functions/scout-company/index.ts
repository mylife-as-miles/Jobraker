import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyColdMailSpecialistCapabilityToken } from "../_shared/cold-mail-contract.ts";
import {
  buildRecruiterSearchQueries,
  buildStarterFirecrawlSearchBody,
  extractStarterFirecrawlWebRows,
  extractPublishedRecruiterContacts,
  normalizeContactProviderContacts,
} from "../_shared/recruiter-contact-discovery.ts";
import {
  candidateEmails,
  inferEmailPattern,
  type EmailPattern,
} from "../_shared/email-pattern.ts";
import { resolveRtrvrApiKey, rtrvrFetch } from "../_shared/firecrawl.ts";

interface ScoutRequest {
  companyName: string;
  jobId?: string;
  applicationId?: string;
  jobTitle?: string;
  jobDescription?: string;
  applyUrl?: string;
  limit?: number;
}

type RoleKind =
  | "recruiter"
  | "hiring_manager"
  | "team_lead"
  | "director"
  | "employee"
  | "unknown";

type EmailStatus =
  | "source_verified"
  | "provider_verified"
  | "domain_valid"
  | "pattern_only"
  | "unverified"
  | "not_found";

interface SearchItem {
  url: string;
  title: string;
  description: string;
  markdown: string;
  sourceQuery: string;
}

interface RecruiterContact {
  fullName: string;
  title: string;
  roleKind: RoleKind;
  linkedinUrl: string;
  linkedinSourceUrl: string;
  workEmail: string;
  emailStatus: EmailStatus;
  emailConfidence: number;
  emailSourceUrl: string;
  relevanceScore: number;
  evidence: Array<Record<string, unknown>>;
  safeToContact: boolean;
}

interface JobContext {
  id: string | null;
  applicationId: string | null;
  title: string;
  company: string;
  description: string;
  applyUrl: string;
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

const ALLOWED_ORIGINS = new Set([
  "https://app.jobraker.io",
  "https://admin.jobraker.io",
  "https://jobraker.io",
  "https://www.jobraker.io",
  "https://jobraker-tau.vercel.app",
  "https://jobraker.vercel.app",
  "https://jobraker.com",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
]);

const BLOCKED_OFFICIAL_HOSTS = new Set([
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
  "crunchbase.com",
  "facebook.com",
  "x.com",
  "twitter.com",
  "instagram.com",
  "youtube.com",
  "wikipedia.org",
  "greenhouse.io",
  "lever.co",
  "ashbyhq.com",
  "workday.com",
  "myworkdayjobs.com",
  "smartrecruiters.com",
]);

const ATS_HOST_PATTERNS = [
  /(^|\.)greenhouse\.io$/i,
  /(^|\.)lever\.co$/i,
  /(^|\.)ashbyhq\.com$/i,
  /(^|\.)myworkdayjobs\.com$/i,
  /(^|\.)smartrecruiters\.com$/i,
  /(^|\.)workable\.com$/i,
  /(^|\.)jobvite\.com$/i,
];

const COUNTRY_SECOND_LEVEL_SUFFIXES = new Set([
  "co.uk",
  "org.uk",
  "ac.uk",
  "com.au",
  "net.au",
  "org.au",
  "co.nz",
  "co.jp",
  "co.in",
  "com.br",
  "com.ng",
  "co.za",
]);

const TIER_RANK: Record<string, number> = {
  Free: 0,
  Starter: 1,
  Basics: 2,
  Pro: 3,
  Ultimate: 4,
};

const SCOUT_LIMITS: Record<string, { perMinute: number; perDay: number }> = {
  Basics: { perMinute: 3, perDay: 15 },
  Pro: { perMinute: 8, perDay: 40 },
  Ultimate: { perMinute: 15, perDay: 100 },
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeInput(value: unknown, maxLength: number): string {
  return asString(value)
    .slice(0, maxLength)
    .replace(/ignore all previous instructions|disregard previous instructions|system prompt/gi, "[REDACTED]")
    .trim();
}

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.min(max, Math.max(min, Math.floor(parsed)))
    : fallback;
}

function corsHeaders(req: Request): Record<string, string> {
  const requestedOrigin = asString(req.headers.get("origin")).replace(/\/+$/, "");
  const origin = ALLOWED_ORIGINS.has(requestedOrigin)
    ? requestedOrigin
    : "https://app.jobraker.io";
  const requestedHeaders = asString(req.headers.get("access-control-request-headers"));
  const headers = new Set(
    "authorization, x-client-info, apikey, content-type, accept, prefer"
      .split(",")
      .map((item) => item.trim()),
  );
  requestedHeaders.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean)
    .forEach((item) => headers.add(item));
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": Array.from(headers).join(", "),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonResponse(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function normalizeUrl(value: unknown): string {
  const raw = asString(value);
  if (!raw) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!/^https?:$/.test(url.protocol)) return "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function hostname(value: unknown): string {
  const url = normalizeUrl(value);
  if (!url) return "";
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function registrableDomain(host: string): string {
  const clean = host.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  const parts = clean.split(".").filter(Boolean);
  if (parts.length <= 2) return clean;
  const lastTwo = parts.slice(-2).join(".");
  return COUNTRY_SECOND_LEVEL_SUFFIXES.has(lastTwo)
    ? parts.slice(-3).join(".")
    : lastTwo;
}

function domainsCompatible(left: string, right: string): boolean {
  return Boolean(left && right && registrableDomain(left) === registrableDomain(right));
}

function isAtsHost(host: string): boolean {
  return ATS_HOST_PATTERNS.some((pattern) => pattern.test(host));
}

function isBlockedOfficialHost(host: string): boolean {
  return !host || BLOCKED_OFFICIAL_HOSTS.has(host) || isAtsHost(host);
}

function isLinkedInProfileUrl(value: unknown): boolean {
  const url = normalizeUrl(value);
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "") === "linkedin.com" &&
      /^\/in\/[a-z0-9_%\-]+\/?/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

function normalizeLinkedInProfileUrl(value: unknown): string {
  const url = normalizeUrl(value);
  if (!isLinkedInProfileUrl(url)) return "";
  const parsed = new URL(url);
  parsed.search = "";
  parsed.hash = "";
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  return parsed.toString();
}

function compactText(value: unknown, maxLength = 500): string {
  return asString(value).replace(/\s+/g, " ").slice(0, maxLength);
}

function sourceText(item: SearchItem): string {
  return `${item.title}\n${item.description}\n${item.markdown}`.trim();
}

function companyTokens(company: string): string[] {
  const stop = new Set([
    "inc", "incorporated", "llc", "ltd", "limited", "plc", "corp",
    "corporation", "company", "group", "holdings", "technologies",
    "technology", "international",
  ]);
  return company.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/)
    .filter((token) => token.length >= 3 && !stop.has(token));
}

function hostLooksLikeCompany(host: string, company: string): boolean {
  const flatHost = registrableDomain(host).replace(/[^a-z0-9]/g, "");
  return companyTokens(company).some((token) => flatHost.includes(token));
}

function extractEmails(text: string): string[] {
  const matches = text.match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/gi) || [];
  return Array.from(new Set(matches.map((email) => email.toLowerCase().replace(/[),.;:]+$/, ""))));
}

function dedupeSearchItems(items: SearchItem[]): SearchItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeUrl(item.url).toLowerCase().replace(/\/$/, "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractTeamKeywords(description: string, title: string): string[] {
  const text = `${description}\n${title}`.replace(/\s+/g, " ");
  const candidates: string[] = [];
  const patterns = [
    /\b(?:the|our|join(?:ing)?|within|support(?:ing)?)\s+([a-z0-9][a-z0-9&/+\-]*(?:\s+[a-z0-9][a-z0-9&/+\-]*){0,7})\s+(?:team|department|group|organization|org|function|unit)\b/gi,
    /\b([A-Z][A-Za-z0-9&/+\-]*(?:\s+[A-Z][A-Za-z0-9&/+\-]*){0,7})\s+(?:Team|Department|Group|Organization|Function|Unit)\b/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = compactText(match[1], 120)
        .replace(/^(?:a|an|and|for|in|of|on|the|to|with)\s+/i, "")
        .trim();
      if (value.length >= 3 && value.split(/\s+/).length <= 8) candidates.push(value);
    }
  }
  const titleCore = title
    .replace(/\b(?:senior|sr\.?|junior|jr\.?|principal|staff|intern|internship|remote|contract)\b/gi, " ")
    .replace(/[^a-z0-9+#./-]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (titleCore.length >= 3) candidates.push(titleCore);
  const seen = new Set<string>();
  return candidates.filter((value) => {
    const key = value.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

function inferRoleKind(title: string): RoleKind {
  const value = title.toLowerCase();
  if (/hiring manager/.test(value)) return "hiring_manager";
  if (/recruit|talent acquisition|talent partner|people partner|sourcer/.test(value)) return "recruiter";
  if (/team lead|engineering manager|product manager|design manager| manager\b|lead\b/.test(value)) return "team_lead";
  if (/director|head of|vice president|\bvp\b|chief/.test(value)) return "director";
  return title.trim() ? "employee" : "unknown";
}

function roleBaseScore(kind: RoleKind): number {
  return {
    hiring_manager: 98,
    recruiter: 94,
    team_lead: 88,
    director: 82,
    employee: 58,
    unknown: 45,
  }[kind];
}

function relevanceScore(
  title: string,
  roleKind: RoleKind,
  evidence: string,
  company: string,
  keywords: string[],
): number {
  const haystack = `${title} ${evidence}`.toLowerCase();
  let score = roleBaseScore(roleKind);
  score += Math.min(5, companyTokens(company).filter((token) => haystack.includes(token)).length * 2);
  score += Math.min(8, keywords.filter((keyword) => keyword.toLowerCase().split(/\s+/)
    .some((token) => token.length > 2 && haystack.includes(token))).length * 3);
  return Math.min(100, score);
}

function parseLinkedInResult(item: SearchItem): { fullName: string; title: string } | null {
  if (!isLinkedInProfileUrl(item.url)) return null;
  const clean = item.title.replace(/\s*\|\s*LinkedIn.*$/i, "").trim();
  const parts = clean.split(/\s+(?:-|–|—)\s+/).map((part) => part.trim()).filter(Boolean);
  const fullName = parts[0] || "";
  const title = parts.slice(1).join(" - ").slice(0, 240);
  if (fullName.split(/\s+/).length < 2 || fullName.length > 120) return null;
  return { fullName, title };
}

function officialDomainFrom(items: SearchItem[], company: string): string {
  const tokens = companyTokens(company);
  return items.map((item) => {
    const host = hostname(item.url);
    if (isBlockedOfficialHost(host)) return { host: "", score: -1 };
    const domain = registrableDomain(host);
    const flat = domain.replace(/[^a-z0-9]/g, "");
    let score = tokens.filter((token) => flat.includes(token)).length * 15;
    if (/careers?|jobs?|about us|official/i.test(sourceText(item))) score += 5;
    return { host: domain, score };
  }).filter((entry) => entry.host && entry.score >= 0)
    .sort((a, b) => b.score - a.score)[0]?.host || "";
}

function careersUrlFrom(items: SearchItem[], officialDomain: string): string {
  return items.map((item) => {
    const url = normalizeUrl(item.url);
    const host = hostname(url);
    const text = `${url} ${sourceText(item)}`.toLowerCase();
    let score = 0;
    if (/careers?|jobs?|join us|open roles|vacancies/.test(text)) score += 20;
    if (officialDomain && domainsCompatible(host, officialDomain)) score += 20;
    if (isAtsHost(host)) score += 10;
    if (isLinkedInProfileUrl(url)) score -= 50;
    return { url, score };
  }).filter((entry) => entry.url && entry.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.url || "";
}

function normalizePersonToken(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, "");
}

function nameParts(fullName: string): { first: string; last: string } | null {
  const parts = fullName.replace(/\([^)]*\)/g, " ").split(/\s+/)
    .map(normalizePersonToken).filter(Boolean);
  return parts.length >= 2 ? { first: parts[0], last: parts[parts.length - 1] } : null;
}

function personAppearsInText(fullName: string, text: string): boolean {
  const parts = nameParts(fullName);
  if (!parts) return false;
  const normalized = normalizePersonToken(text);
  return normalized.includes(parts.first) && normalized.includes(parts.last);
}

function emailPatterns(fullName: string, domain: string): string[] {
  const parts = nameParts(fullName);
  if (!parts || !domain) return [];
  const { first, last } = parts;
  return Array.from(new Set([
    `${first}.${last}@${domain}`,
    `${first}${last}@${domain}`,
    `${first[0]}${last}@${domain}`,
    `${first}${last[0]}@${domain}`,
    `${last}.${first}@${domain}`,
    `${first}_${last}@${domain}`,
  ]));
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function searchWeb(apiKey: string, query: string, limit: number): Promise<SearchItem[]> {
  try {
    return await withRetry(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort("firecrawl_timeout"), 25_000);
      try {
        const response = await fetch("https://api.firecrawl.dev/v2/search", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ query, limit, sources: ["web"] }),
          signal: controller.signal,
        }).finally(() => clearTimeout(timeout));
        if (!response.ok) throw new Error(`Search provider failed: ${response.status}`);
        const payload = await response.json();
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        return rows.map((row: any) => ({
          url: normalizeUrl(row?.url),
          title: compactText(row?.title, 500),
          description: compactText(row?.description, 1800),
          markdown: compactText(row?.markdown, 2400),
          sourceQuery: query,
        })).filter((item: SearchItem) => Boolean(item.url));
      } catch (err) {
        clearTimeout(timeout);
        throw err;
      }
    }, 3);
  } catch (error) {
    console.warn(`[searchWeb] Search provider connectivity error for query "${query}":`, error);
    return [];
  }
}

async function searchStarterColdMailWeb(
  apiKey: string,
  query: string,
  limit: number,
  includeMarkdown = false,
): Promise<SearchItem[]> {
  try {
    return await withRetry(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort("firecrawl_timeout"), 25_000);
      try {
        const response = await fetch("https://api.firecrawl.dev/v2/search", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(
            buildStarterFirecrawlSearchBody(query, limit, includeMarkdown),
          ),
          signal: controller.signal,
        }).finally(() => clearTimeout(timeout));
        if (!response.ok) throw new Error(`Search provider failed: ${response.status}`);
        const rows = extractStarterFirecrawlWebRows(await response.json());
        return rows.map((row) => ({
          url: normalizeUrl(row.url),
          title: compactText(row.title, 500),
          description: compactText(row.description, 1800),
          markdown: compactText(row.markdown, 2400),
          sourceQuery: query,
        })).filter((item) => Boolean(item.url));
      } catch (err) {
        clearTimeout(timeout);
        throw err;
      }
    }, 3);
  } catch (error) {
    console.warn(
      `[searchStarterColdMailWeb] Search provider connectivity error for query "${query}":`,
      error,
    );
    return [];
  }
}

function parseVerifierResponse(payload: any) {
  const value = payload?.data && typeof payload.data === "object" ? payload.data : payload;
  const status = asString(value?.status || value?.result || value?.verdict).toLowerCase();
  const valid = value?.valid === true || value?.is_valid === true ||
    value?.deliverable === true || value?.is_deliverable === true ||
    ["valid", "deliverable", "safe", "ok", "verified"].includes(status);
  const catchAll = value?.catch_all === true || value?.is_catch_all === true ||
    value?.accept_all === true || value?.is_accept_all === true ||
    ["catch_all", "accept_all"].includes(status);
  const rawScore = Number(value?.confidence ?? value?.score ?? value?.probability);
  return {
    valid: valid && !catchAll,
    confidence: Number.isFinite(rawScore)
      ? Math.min(0.99, Math.max(0.5, rawScore > 1 ? rawScore / 100 : rawScore))
      : 0.92,
  };
}

async function verifyEmail(email: string, fullName: string, company: string) {
  const verifierUrl = asString(Deno.env.get("RECRUITER_EMAIL_VERIFIER_URL"));
  if (!verifierUrl) return { valid: false, confidence: 0 };
  const apiKey = asString(Deno.env.get("RECRUITER_EMAIL_VERIFIER_API_KEY"));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("email_verifier_timeout"), 15_000);
  try {
    const response = await fetch(verifierUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}`, "X-API-Key": apiKey } : {}),
      },
      body: JSON.stringify({ email, fullName, company }),
      signal: controller.signal,
    });
    return response.ok ? parseVerifierResponse(await response.json().catch(() => null)) : { valid: false, confidence: 0 };
  } catch {
    return { valid: false, confidence: 0 };
  } finally {
    clearTimeout(timeout);
  }
}

async function searchContactProvider(
  company: string,
  officialDomain: string,
  jobTitle: string,
  teamKeywords: string[],
  limit: number,
): Promise<RecruiterContact[]> {
  const providerUrl = asString(Deno.env.get("RECRUITER_CONTACT_PROVIDER_URL"));
  if (!providerUrl || !officialDomain) return [];
  const providerKey = asString(Deno.env.get("RECRUITER_CONTACT_PROVIDER_API_KEY"));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("contact_provider_timeout"), 15_000);
  try {
    const response = await fetch(providerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(providerKey
          ? { Authorization: `Bearer ${providerKey}`, "X-API-Key": providerKey }
          : {}),
      },
      body: JSON.stringify({
        company,
        domain: officialDomain,
        jobTitle,
        teamKeywords,
        roles: [
          "recruiter",
          "talent acquisition",
          "hiring manager",
          "team lead",
          "director",
        ],
        limit,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn("contact provider search failed", { status: response.status });
      return [];
    }
    return normalizeContactProviderContacts(await response.json(), {
      company,
      officialDomain,
      jobTitle,
      teamKeywords,
      providerUrl,
    }) as RecruiterContact[];
  } catch (error) {
    console.warn("contact provider search failed", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

// Hunter.io (https://hunter.io/api-documentation/v2): lists the people at a
// company domain by department, finds a named person's work email, and
// verifies addresses. Used when HUNTER_API_KEY is set. Only addresses Hunter
// reports as "valid" are treated as verified; catch-all domains never are.
const HUNTER_API = "https://api.hunter.io/v2";
const HUNTER_PROVIDER = "https://hunter.io";
const HUNTER_MAX_VERIFICATIONS = 3;
const RECRUITING_INBOX = /^(?:jobs?|careers?|recruit(?:ing|ment|er)?|talent|hiring|hr|people)(?:[._+-].*)?@/i;

const hunterKey = () => asString(Deno.env.get("HUNTER_API_KEY"));

async function hunterGet(path: string, params: Record<string, string>): Promise<any> {
  const key = hunterKey();
  if (!key) return null;
  const url = new URL(`${HUNTER_API}/${path}`);
  for (const [name, value] of Object.entries(params)) {
    if (value) url.searchParams.set(name, value);
  }
  url.searchParams.set("api_key", key);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("hunter_timeout"), 20_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      console.warn("hunter request failed", { path, status: response.status });
      return null;
    }
    const json = await response.json().catch(() => null);
    return json?.data ?? null;
  } catch (error) {
    console.warn("hunter request failed", {
      path,
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function hunterVerifyStatus(email: string): Promise<string> {
  const data = await hunterGet("email-verifier", { email });
  return asString(data?.status).toLowerCase();
}

interface HunterDiscovery {
  domain: string;
  contacts: RecruiterContact[];
  genericInbox: { email: string; sourceUrl: string } | null;
}

async function searchHunter(
  company: string,
  officialDomain: string,
  jobTitle: string,
  teamKeywords: string[],
  limit: number,
): Promise<HunterDiscovery> {
  const empty: HunterDiscovery = { domain: officialDomain, contacts: [], genericInbox: null };
  if (!hunterKey()) return empty;
  // Without a known domain Hunter resolves the company name itself.
  const target: Record<string, string> = officialDomain ? { domain: officialDomain } : { company };
  const [recruiting, management] = await Promise.all([
    hunterGet("domain-search", { ...target, department: "hr", limit: "10" }),
    hunterGet("domain-search", { ...target, department: "management", limit: "10" }),
  ]);
  const domain = officialDomain || asString(recruiting?.domain) || asString(management?.domain);
  if (!domain) return empty;

  let genericInbox: HunterDiscovery["genericInbox"] = null;
  const people: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  for (const row of [...(recruiting?.emails || []), ...(management?.emails || [])]) {
    const email = asString(row?.value).toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    const status = asString(row?.verification?.status).toLowerCase();
    const sourceUrl = asString(row?.sources?.[0]?.uri) || `${HUNTER_PROVIDER}/domain-search/${domain}`;
    if (row?.type === "generic") {
      if (!genericInbox && RECRUITING_INBOX.test(email) && status !== "invalid") {
        genericInbox = { email, sourceUrl };
      }
      continue;
    }
    const fullName = [asString(row?.first_name), asString(row?.last_name)].filter(Boolean).join(" ");
    const title = asString(row?.position) ||
      (row?.department === "hr" ? "Talent Acquisition" : "");
    if (!fullName || !title) continue;
    people.push({
      email,
      full_name: fullName,
      title,
      status,
      confidence: Number(row?.confidence) || 0,
      linkedin_url: asString(row?.linkedin),
    });
  }

  // Domain search often returns addresses Hunter has not verified yet. Verify
  // the most likely few rather than every row, since each check costs a credit.
  let verifications = 0;
  for (const person of people.sort((a, b) => Number(b.confidence) - Number(a.confidence))) {
    if (person.status === "valid" || verifications >= HUNTER_MAX_VERIFICATIONS) continue;
    verifications += 1;
    person.status = await hunterVerifyStatus(String(person.email));
  }

  const contacts = normalizeContactProviderContacts({ contacts: people }, {
    company,
    officialDomain: domain,
    jobTitle,
    teamKeywords,
    providerUrl: HUNTER_PROVIDER,
  }) as RecruiterContact[];
  return { domain, contacts: contacts.slice(0, limit), genericInbox };
}

/** Hunter Email Finder for a named contact (e.g. found on LinkedIn). */
async function findEmailWithHunter(
  contact: RecruiterContact,
  officialDomain: string,
): Promise<RecruiterContact | null> {
  const data = await hunterGet("email-finder", {
    domain: officialDomain,
    full_name: contact.fullName,
  });
  const email = asString(data?.email).toLowerCase();
  if (!email || !domainsCompatible(email.split("@")[1] || "", officialDomain)) return null;
  let status = asString(data?.verification?.status).toLowerCase();
  if (status !== "valid") status = await hunterVerifyStatus(email);
  if (status !== "valid") return null;
  const score = Number(data?.score);
  return {
    ...contact,
    workEmail: email,
    emailStatus: "provider_verified",
    emailConfidence: Number.isFinite(score) && score > 0 ? Math.min(0.99, Math.max(0.5, score / 100)) : 0.9,
    emailSourceUrl: HUNTER_PROVIDER,
    safeToContact: true,
    evidence: [...contact.evidence, { type: "provider_verified_finder", provider: HUNTER_PROVIDER }],
  };
}

// ---------------------------------------------------------------------------
// Self-built email discovery: RTRVR reads the company's own site for recruiters
// and published addresses, the company's email format is learned from what it
// publishes, Reoon (REOON_API_KEY) confirms candidate mailboxes, and results
// are cached for every user in company_email_profiles and
// shared_recruiter_contacts. A domain whose mail server accepts any address
// cannot be confirmed; those contacts get the format-matched address as
// "pattern_only" (shown as Likely) and are never marked safe.
// ---------------------------------------------------------------------------

const REOON_ENDPOINT = "https://emailverifier.reoon.com/api/v1/verify";
const REOON_SOURCE = "https://www.reoon.com/email-verifier/";
const SHARED_DISCOVERY_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_REOON_CHECKS_PER_RUN = 12;
const MAX_CONTACTS_TO_RESOLVE = 5;
const VERIFY_PHASE_BUDGET_MS = 40_000;

type ReoonStatus =
  | "safe"
  | "invalid"
  | "disabled"
  | "disposable"
  | "inbox_full"
  | "catch_all"
  | "role_account"
  | "spamtrap"
  | "unknown";

const reoonKey = () => asString(Deno.env.get("REOON_API_KEY"));

async function reoonVerify(email: string): Promise<ReoonStatus> {
  const key = reoonKey();
  if (!key) return "unknown";
  const url = new URL(REOON_ENDPOINT);
  url.searchParams.set("email", email);
  url.searchParams.set("key", key);
  url.searchParams.set("mode", "power");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("reoon_timeout"), 25_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      console.warn("reoon verify failed", { status: response.status });
      return "unknown";
    }
    const data = await response.json().catch(() => null);
    if (data?.is_catch_all === true) return "catch_all";
    const status = asString(data?.status).toLowerCase() as ReoonStatus;
    return status || "unknown";
  } catch (error) {
    console.warn("reoon verify failed", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return "unknown";
  } finally {
    clearTimeout(timeout);
  }
}

/** Free MX lookup over DNS-over-HTTPS. Null when the lookup itself failed. */
async function domainReceivesMail(domain: string): Promise<boolean | null> {
  try {
    const response = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`,
      { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(8_000) },
    );
    if (!response.ok) return null;
    const data = await response.json();
    return Array.isArray(data?.Answer) && data.Answer.some((answer: any) => answer?.type === 15);
  } catch {
    return null;
  }
}

interface CompanyEmailProfile {
  domain: string;
  mx_ok: boolean | null;
  catch_all: boolean | null;
  email_pattern: EmailPattern | null;
  pattern_confidence: number | null;
  pattern_samples: number;
  checked_at: string;
}

interface SharedDiscovery {
  profile: CompanyEmailProfile | null;
  contacts: RecruiterContact[];
}

const isFresh = (iso: string | null | undefined) =>
  Boolean(iso) && Date.now() - new Date(iso as string).getTime() < SHARED_DISCOVERY_TTL_MS;

async function loadSharedDiscovery(serviceClient: any, domain: string): Promise<SharedDiscovery> {
  const [{ data: profile }, { data: rows }] = await Promise.all([
    serviceClient.from("company_email_profiles").select("*").eq("domain", domain).maybeSingle(),
    serviceClient
      .from("shared_recruiter_contacts")
      .select("*")
      .eq("domain", domain)
      .neq("email_status", "bounced")
      .gte("last_checked_at", new Date(Date.now() - SHARED_DISCOVERY_TTL_MS).toISOString())
      .limit(20),
  ]);
  const contacts = (rows || []).map((row: any): RecruiterContact => {
    const roleKind = (row.role_kind || inferRoleKind(row.title || "")) as RoleKind;
    const verified = row.email_status === "provider_verified" || row.email_status === "source_verified";
    return {
      fullName: row.full_name,
      title: row.title || "",
      roleKind,
      linkedinUrl: row.linkedin_url || "",
      linkedinSourceUrl: row.linkedin_url || "",
      workEmail: row.email,
      emailStatus: row.email_status,
      emailConfidence: Number(row.email_confidence) || 0,
      emailSourceUrl: row.source_url || `https://${domain}`,
      relevanceScore: relevanceScore(row.title || "", roleKind, `${row.full_name} ${row.title || ""}`, row.company, []),
      evidence: [{ type: "shared_discovery_cache", checkedAt: row.last_checked_at }],
      safeToContact: verified,
    };
  });
  return { profile: isFresh(profile?.checked_at) ? profile : null, contacts };
}

async function saveSharedDiscovery(
  serviceClient: any,
  domain: string,
  company: string,
  profile: Omit<CompanyEmailProfile, "domain" | "checked_at">,
  contacts: RecruiterContact[],
) {
  const now = new Date().toISOString();
  const { error: profileError } = await serviceClient.from("company_email_profiles").upsert({
    domain,
    company,
    ...profile,
    checked_at: now,
    updated_at: now,
  }, { onConflict: "domain" });
  if (profileError) console.warn("company email profile upsert failed", profileError);

  const rows = contacts
    .filter((contact) => contact.workEmail &&
      ["provider_verified", "source_verified", "pattern_only"].includes(contact.emailStatus))
    .map((contact) => ({
      domain,
      company,
      full_name: contact.fullName,
      title: contact.title || null,
      role_kind: contact.roleKind,
      linkedin_url: contact.linkedinUrl || null,
      email: contact.workEmail.toLowerCase(),
      email_status: contact.emailStatus,
      email_confidence: contact.emailConfidence,
      source_url: contact.emailSourceUrl || null,
      last_checked_at: now,
      updated_at: now,
    }));
  if (!rows.length) return;
  const { error } = await serviceClient
    .from("shared_recruiter_contacts")
    .upsert(rows, { onConflict: "domain,email" });
  if (error) console.warn("shared recruiter contacts upsert failed", error);
}

interface SiteScan {
  people: Array<{ fullName: string; title: string; email: string; sourceUrl: string }>;
  emails: string[];
}

/** RTRVR browses the company's own site for recruiters and published emails. */
async function scanCompanySiteWithRtrvr(
  domain: string,
  company: string,
  jobTitle: string,
): Promise<SiteScan> {
  const empty: SiteScan = { people: [], emails: [] };
  if (!domain || !asString(Deno.env.get("RTRVR_API_KEY"))) return empty;
  try {
    const apiKey = await resolveRtrvrApiKey();
    const result: any = await rtrvrFetch("/extract", apiKey, {
      urls: [`https://${domain}`],
      prompt:
        `You are on ${company}'s website (${domain}). Open its team, about, leadership, people, careers and contact pages, at most 5 pages on ${domain}. ` +
        `List people who work in recruiting, talent acquisition, HR or people operations, and leaders of the team that would hire a "${jobTitle || "new hire"}". ` +
        `For each give the full name, job title, the email address shown for them if any, and the page URL. ` +
        `Also list every email address ending in ${domain} that appears on those pages. Only report what is written on the pages. Never guess an email.`,
      schema: {
        type: "object",
        properties: {
          people: {
            type: "array",
            items: {
              type: "object",
              properties: {
                fullName: { type: "string" },
                title: { type: "string" },
                email: { type: "string" },
                pageUrl: { type: "string" },
              },
              required: ["fullName"],
            },
          },
          emails: { type: "array", items: { type: "string" } },
        },
        required: ["people", "emails"],
      },
    }, undefined, 60_000);
    const json = result?.data?.json || {};
    const onDomain = (email: string) => domainsCompatible(email.split("@")[1] || "", domain);
    const people = (Array.isArray(json.people) ? json.people : [])
      .map((person: any) => ({
        fullName: asString(person?.fullName),
        title: asString(person?.title),
        email: asString(person?.email).toLowerCase(),
        sourceUrl: asString(person?.pageUrl) || `https://${domain}`,
      }))
      .filter((person: SiteScan["people"][number]) => person.fullName.split(/\s+/).length >= 2)
      .map((person: SiteScan["people"][number]) => ({
        ...person,
        email: extractEmails(person.email).find(onDomain) || "",
      }));
    const emails = (Array.isArray(json.emails) ? json.emails : [])
      .flatMap((value: unknown) => extractEmails(asString(value)))
      .filter(onDomain);
    return { people, emails: [...new Set<string>(emails)] };
  } catch (error) {
    console.warn("rtrvr site scan failed", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return empty;
  }
}

interface PatternResolution {
  contacts: RecruiterContact[];
  genericInbox: { email: string; sourceUrl: string } | null;
}

/**
 * Gives contacts without a confirmed address one: the learned or most common
 * company format, confirmed by Reoon when the server allows it, otherwise
 * returned as pattern_only (never safe to send without the user's approval).
 */
async function resolveEmailsByPattern(opts: {
  serviceClient: any;
  domain: string;
  company: string;
  contacts: RecruiterContact[];
  samples: Array<{ email: string; fullName?: string }>;
  cachedProfile: CompanyEmailProfile | null;
  needGenericInbox: boolean;
}): Promise<PatternResolution> {
  const { domain, company } = opts;
  const deadline = Date.now() + VERIFY_PHASE_BUDGET_MS;
  let checks = 0;
  const canCheck = () => Boolean(reoonKey()) && checks < MAX_REOON_CHECKS_PER_RUN && Date.now() < deadline;
  const check = async (email: string) => {
    checks += 1;
    return await reoonVerify(email);
  };

  // Domain profile: cached, or worked out now.
  let profile = opts.cachedProfile;
  if (!profile) {
    const learned = inferEmailPattern(opts.samples, domain);
    const mxOk = await domainReceivesMail(domain);
    let catchAll: boolean | null = null;
    if (mxOk !== false && canCheck()) {
      // A random mailbox that cannot exist: if it "verifies", nothing will.
      const probe = await check(`zz-${crypto.randomUUID().slice(0, 12)}@${domain}`);
      catchAll = probe === "catch_all" || probe === "safe" ? true
        : probe === "invalid" || probe === "disabled" ? false
        : null;
    }
    profile = {
      domain,
      mx_ok: mxOk,
      catch_all: catchAll,
      email_pattern: learned?.pattern || null,
      pattern_confidence: learned?.confidence ?? null,
      pattern_samples: learned?.samples || 0,
      checked_at: new Date().toISOString(),
    };
  }
  if (profile.mx_ok === false) {
    return { contacts: opts.contacts, genericInbox: null };
  }

  const verifiedFor = (contact: RecruiterContact, email: string): RecruiterContact => ({
    ...contact,
    workEmail: email,
    emailStatus: "provider_verified",
    emailConfidence: 0.95,
    emailSourceUrl: REOON_SOURCE,
    safeToContact: true,
    evidence: [...contact.evidence, { type: "mailbox_verified", provider: "reoon" }],
  });
  const likelyFor = (contact: RecruiterContact, email: string): RecruiterContact => ({
    ...contact,
    workEmail: email,
    emailStatus: "pattern_only",
    emailConfidence: profile!.email_pattern
      ? Number((0.4 + 0.4 * Number(profile!.pattern_confidence || 0)).toFixed(2))
      : 0.3,
    emailSourceUrl: `https://${domain}`,
    safeToContact: false,
    evidence: [...contact.evidence, {
      type: "company_email_format",
      pattern: profile!.email_pattern || "common_format",
      patternSamples: profile!.pattern_samples,
      catchAll: profile!.catch_all,
    }],
  });

  const pending = opts.contacts
    .map((contact, index) => ({ contact, index }))
    .filter(({ contact }) => !(contact.safeToContact && contact.workEmail))
    .slice(0, MAX_CONTACTS_TO_RESOLVE);
  const resolved = [...opts.contacts];

  // Reoon allows up to 5 parallel requests; contacts are checked in parallel,
  // each contact's candidates one after another.
  await Promise.all(pending.map(async ({ contact, index }) => {
    const candidates = candidateEmails(contact.fullName, domain, profile!.email_pattern);
    if (!candidates.length) return;
    if (profile!.catch_all === true || !reoonKey()) {
      resolved[index] = likelyFor(contact, candidates[0]);
      return;
    }
    let rejected = 0;
    for (const candidate of candidates) {
      if (!canCheck()) break;
      const status = await check(candidate);
      if (status === "safe") {
        resolved[index] = verifiedFor(contact, candidate);
        return;
      }
      if (status === "catch_all") {
        profile!.catch_all = true;
        break;
      }
      if (status === "invalid" || status === "disabled") {
        rejected += 1;
        continue;
      }
      break; // unknown, inbox_full, ...: the server will not say more.
    }
    // Every format was rejected outright: do not offer a guess.
    if (rejected < candidates.length) resolved[index] = likelyFor(contact, candidates[0]);
  }));

  // A confirmed jobs@/careers@ inbox is a good fallback recipient.
  let genericInbox: PatternResolution["genericInbox"] = null;
  if (opts.needGenericInbox && profile.catch_all === false) {
    for (const local of ["careers", "jobs", "recruiting", "talent"]) {
      if (!canCheck()) break;
      const email = `${local}@${domain}`;
      if (await check(email) === "safe") {
        genericInbox = { email, sourceUrl: REOON_SOURCE };
        break;
      }
    }
  }

  // A newly learned pattern from verified addresses beats a guess next time.
  if (!profile.email_pattern) {
    const learned = inferEmailPattern(
      resolved
        .filter((contact) => contact.emailStatus === "provider_verified" || contact.emailStatus === "source_verified")
        .map((contact) => ({ email: contact.workEmail, fullName: contact.fullName })),
      domain,
    );
    if (learned) {
      profile.email_pattern = learned.pattern;
      profile.pattern_confidence = learned.confidence;
      profile.pattern_samples = learned.samples;
    }
  }

  await saveSharedDiscovery(opts.serviceClient, domain, company, {
    mx_ok: profile.mx_ok,
    catch_all: profile.catch_all,
    email_pattern: profile.email_pattern,
    pattern_confidence: profile.pattern_confidence,
    pattern_samples: profile.pattern_samples,
  }, resolved);

  return { contacts: resolved, genericInbox };
}

async function enrichEmail(
  contact: RecruiterContact,
  officialDomain: string,
  firecrawlKey: string,
  company: string,
  search: (apiKey: string, query: string, limit: number) => Promise<SearchItem[]> = searchWeb,
): Promise<RecruiterContact> {
  if (!officialDomain) return contact;
  try {
    const items = await search(firecrawlKey, `"${contact.fullName}" "${company}" "@${officialDomain}"`, 5);
    for (const item of items) {
      const text = sourceText(item);
      if (!personAppearsInText(contact.fullName, text)) continue;
      const email = extractEmails(text).find((candidate) =>
        domainsCompatible(candidate.split("@")[1] || "", officialDomain));
      if (!email) continue;
      const officialSource = domainsCompatible(hostname(item.url), officialDomain);
      return {
        ...contact,
        workEmail: email,
        emailStatus: "source_verified",
        emailConfidence: officialSource ? 0.98 : 0.88,
        emailSourceUrl: item.url,
        safeToContact: true,
        evidence: [...contact.evidence, {
          type: "published_work_email",
          sourceUrl: item.url,
          excerpt: compactText(text, 380),
        }],
      };
    }
  } catch {
    // Continue to an optional verifier. Never create a user-visible guess.
  }
  if (hunterKey()) {
    return await findEmailWithHunter(contact, officialDomain) ||
      { ...contact, workEmail: "", emailStatus: "not_found", emailConfidence: 0, emailSourceUrl: "", safeToContact: false };
  }
  for (const candidate of emailPatterns(contact.fullName, officialDomain)) {
    const result = await verifyEmail(candidate, contact.fullName, company);
    if (!result.valid) continue;
    return {
      ...contact,
      workEmail: candidate,
      emailStatus: "provider_verified",
      emailConfidence: result.confidence,
      emailSourceUrl: asString(Deno.env.get("RECRUITER_EMAIL_VERIFIER_URL")),
      safeToContact: true,
      evidence: [...contact.evidence, {
        type: "provider_verified_pattern",
        provider: asString(Deno.env.get("RECRUITER_EMAIL_VERIFIER_URL")),
      }],
    };
  }
  return { ...contact, workEmail: "", emailStatus: "not_found", emailConfidence: 0, emailSourceUrl: "", safeToContact: false };
}

function verifiedRecruitmentInbox(items: SearchItem[], officialDomain: string) {
  const localPattern = /^(?:jobs?|careers?|recruit(?:ing|ment)?|talent|hiring|hr|people)(?:[._+-].*)?@/i;
  for (const item of items) {
    for (const email of extractEmails(sourceText(item))) {
      if (domainsCompatible(email.split("@")[1] || "", officialDomain) && localPattern.test(email)) {
        return { email, sourceUrl: item.url };
      }
    }
  }
  return null;
}

async function authenticate(req: Request) {
  const authHeader = asString(req.headers.get("authorization"));
  if (!authHeader) throw new HttpError(401, "Missing authorization header");
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) throw new Error("Supabase runtime configuration is incomplete");
  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await authClient.auth.getUser();
  if (error || !user) throw new HttpError(401, "Unauthorized");
  const serviceClient = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: rawTier } = await serviceClient.rpc("get_user_tier", { p_user_id: user.id });
  const aliases: Record<string, string> = {
    Basic: "Basics", "Starter Plan": "Starter", Professional: "Pro",
    Executive: "Ultimate", Enterprise: "Ultimate", "Ultimate Plan": "Ultimate",
  };
  const tier = aliases[asString(rawTier)] || asString(rawTier) || "Free";
  let coldMailCapability = null;
  if (tier === "Starter") {
    const token = asString(req.headers.get("x-cold-mail-capability"));
    const secret = asString(Deno.env.get("COLD_MAIL_SIGNING_SECRET")) || serviceKey;
    try {
      coldMailCapability = await verifyColdMailSpecialistCapabilityToken(
        token,
        secret,
        { userId: user.id, operation: "scout_company" },
      );
    } catch {
      throw new HttpError(
        403,
        "Recruiter discovery is available on Starter only inside an authorized 1-Click Recruiter Cold Mail run.",
      );
    }
  } else if ((TIER_RANK[tier] || 0) < TIER_RANK.Basics) {
    throw new HttpError(403, "Recruiter and hiring-team discovery requires the Basics plan or higher.");
  }
  return { user, serviceClient, tier, coldMailCapability };
}

async function enforceRateLimit(serviceClient: any, userId: string, tier: string) {
  const limit = SCOUT_LIMITS[tier] || SCOUT_LIMITS.Basics;
  const now = Date.now();
  const count = async (since: number) => {
    const { count, error } = await serviceClient.from("feature_usage_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("feature_key", "scout_company")
      .gte("created_at", new Date(since).toISOString());
    if (error) throw new Error("Could not verify feature rate limits.");
    return count || 0;
  };
  const [perMinute, perDay] = await Promise.all([count(now - 60_000), count(now - 86_400_000)]);
  if (perMinute >= limit.perMinute) throw new HttpError(429, "Too many recruiter discovery requests. Please wait about a minute.");
  if (perDay >= limit.perDay) throw new HttpError(429, "You have reached today's recruiter discovery limit.");
}

async function recordUsage(serviceClient: any, userId: string, tier: string, metadata: Record<string, unknown>) {
  const { error } = await serviceClient.from("feature_usage_events").insert({
    user_id: userId,
    feature_key: "scout_company",
    quantity: 1,
    reference_type: "rate_limit",
    metadata: { subscription_tier: tier, ...metadata },
  });
  if (error) console.warn("feature usage recording failed", error);
}

async function resolveJob(serviceClient: any, userId: string, request: ScoutRequest, company: string): Promise<JobContext> {
  let application: any = null;
  let job: any = null;
  if (request.applicationId) {
    const { data } = await serviceClient.from("applications")
      .select("id, job_id, job_title, company, app_url")
      .eq("id", request.applicationId).eq("user_id", userId).maybeSingle();
    application = data;
  }
  const jobId = request.jobId || asString(application?.job_id);
  if (jobId) {
    const { data } = await serviceClient.from("jobs")
      .select("id, title, company, description, apply_url, raw_data")
      .eq("id", jobId).eq("user_id", userId).maybeSingle();
    job = data;
  }
  if (!job) {
    const { data } = await serviceClient.from("jobs")
      .select("id, title, company, description, apply_url, raw_data, created_at")
      .eq("user_id", userId).ilike("company", company)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    job = data;
  }
  return {
    id: asString(job?.id) || null,
    applicationId: asString(application?.id) || asString(request.applicationId) || null,
    title: sanitizeInput(request.jobTitle || job?.title || application?.job_title, 240),
    company: sanitizeInput(job?.company || application?.company || company, 200),
    description: sanitizeInput(request.jobDescription || job?.description || job?.raw_data?.description, 25_000),
    applyUrl: normalizeUrl(request.applyUrl || job?.apply_url || application?.app_url),
  };
}

async function createRun(serviceClient: any, userId: string, job: JobContext, keywords: string[], queries: string[]) {
  const { data, error } = await serviceClient.from("recruiter_discovery_runs").insert({
    user_id: userId,
    job_id: job.id,
    application_id: job.applicationId,
    company: job.company,
    job_title: job.title || null,
    team_keywords: keywords,
    status: "pending",
    query_plan: { queries, version: "recruiter_discovery_v2" },
  }).select("id").single();
  if (error) {
    console.warn("recruiter discovery run insert failed", error);
    return null;
  }
  return asString(data?.id) || null;
}

async function updateRun(serviceClient: any, runId: string | null, patch: Record<string, unknown>) {
  if (!runId) return;
  const { error } = await serviceClient.from("recruiter_discovery_runs")
    .update({ ...patch, updated_at: new Date().toISOString() }).eq("id", runId);
  if (error) console.warn("recruiter discovery run update failed", error);
}

async function hash(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function persistContacts(serviceClient: any, userId: string, runId: string | null, job: JobContext, contacts: RecruiterContact[]) {
  if (!contacts.length) return;
  const now = new Date().toISOString();
  const rows = await Promise.all(contacts.map(async (contact) => ({
    user_id: userId,
    discovery_run_id: runId,
    job_id: job.id,
    application_id: job.applicationId,
    identity_key: await hash((contact.linkedinUrl || contact.workEmail || `${job.company}|${contact.fullName}|${contact.title}`).toLowerCase()),
    company: job.company,
    full_name: contact.fullName,
    title: contact.title || null,
    role_kind: contact.roleKind,
    linkedin_url: contact.linkedinUrl || null,
    linkedin_source_url: contact.linkedinSourceUrl || null,
    work_email: contact.workEmail || null,
    email_status: contact.emailStatus,
    email_confidence: contact.emailConfidence,
    email_source_url: contact.emailSourceUrl || null,
    relevance_score: contact.relevanceScore,
    evidence: contact.evidence,
    safe_to_contact: contact.safeToContact,
    discovered_at: now,
    last_verified_at: contact.safeToContact ? now : null,
    updated_at: now,
  })));
  const { error } = await serviceClient.from("recruiter_contacts")
    .upsert(rows, { onConflict: "user_id,identity_key" });
  if (error) console.warn("recruiter contacts upsert failed", error);
}

serve(async (req) => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, headers);

  let runId: string | null = null;
  let serviceClient: any = null;
  try {
    const context = await authenticate(req);
    serviceClient = context.serviceClient;
    if (!context.coldMailCapability) {
      await enforceRateLimit(serviceClient, context.user.id, context.tier);
    }

    const request = (await req.json()) as ScoutRequest;
    if (
      context.coldMailCapability &&
      asString(request.jobId) !== context.coldMailCapability.jobId
    ) {
      throw new HttpError(403, "The Cold Mail capability does not authorize this job.");
    }
    const companyName = sanitizeInput(request.companyName, 200);
    if (!companyName) throw new HttpError(400, "companyName is required");

    const job = await resolveJob(serviceClient, context.user.id, request, companyName);
    const teamKeywords = extractTeamKeywords(job.description, job.title);
    const isYcCompany = /yc|y combinator|workatastartup|ycombinator/i.test(`${job.company} ${job.title} ${job.description} ${job.applyUrl}`);
    const initialSearchPlan = buildRecruiterSearchQueries({
      company: job.company,
      jobTitle: job.title,
      teamKeywords,
      officialDomain: "",
    });
    const officialQuery = initialSearchPlan.officialDiscovery;
    const ycQuery = `site:ycombinator.com/companies/ "${job.company}" founder team hiring`;

    const firecrawlKey = asString(Deno.env.get("FIRECRAWL_API_KEY"));
    if (!firecrawlKey) throw new Error("Search provider API key is not configured.");
    const isStarterColdMailRun = Boolean(context.coldMailCapability);
    const searchForRun = (
      query: string,
      limit: number,
      includeMarkdown = false,
    ) => isStarterColdMailRun
      ? searchStarterColdMailWeb(firecrawlKey, query, limit, includeMarkdown)
      : searchWeb(firecrawlKey, query, limit);
    const [officialItems, ycItems] = await Promise.all([
      searchForRun(officialQuery, 7),
      isYcCompany ? searchForRun(ycQuery, 6) : Promise.resolve([]),
    ]);
    
    let officialDomain = officialDomainFrom(officialItems, job.company);
    if (!officialDomain && isYcCompany) {
      officialDomain = `${job.company.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;
    }
    const searchPlan = buildRecruiterSearchQueries({
      company: job.company,
      jobTitle: job.title,
      teamKeywords,
      officialDomain,
    });
    const queries = [
      officialQuery,
      searchPlan.linkedInRecruiters,
      searchPlan.linkedInManagers,
      searchPlan.officialPeople,
      searchPlan.publicPeople,
      searchPlan.publicEmails,
      ...(isYcCompany ? [ycQuery] : []),
    ];
    runId = await createRun(serviceClient, context.user.id, job, teamKeywords, queries);
    const [
      recruiterItems,
      managerItems,
      officialPeopleItems,
      publicPeopleItems,
      publicEmailItems,
      providerContacts,
      hunter,
      siteScan,
    ] = await Promise.all([
      searchForRun(searchPlan.linkedInRecruiters, 8),
      searchForRun(searchPlan.linkedInManagers, 8),
      searchForRun(searchPlan.officialPeople, 6),
      searchForRun(searchPlan.publicPeople, 6),
      searchForRun(searchPlan.publicEmails, 6, true),
      searchContactProvider(job.company, officialDomain, job.title, teamKeywords, 8),
      searchHunter(job.company, officialDomain, job.title, teamKeywords, 8),
      scanCompanySiteWithRtrvr(officialDomain, job.company, job.title),
    ]);
    // Hunter can resolve the domain when the web search could not.
    if (!officialDomain && hunter.domain) officialDomain = hunter.domain;
    const publicItems = dedupeSearchItems([
      ...officialItems,
      ...ycItems,
      ...officialPeopleItems,
      ...publicPeopleItems,
      ...publicEmailItems,
    ]);
    const allItems = dedupeSearchItems([
      ...publicItems,
      ...recruiterItems,
      ...managerItems,
    ]);
    const careersPageUrl = careersUrlFrom(officialItems, officialDomain) || 
      (isYcCompany ? `https://www.ycombinator.com/companies/${job.company.toLowerCase().replace(/[^a-z0-9]/g, "")}` : "");

    const contactsByIdentity = new Map<string, RecruiterContact>();
    const addContact = (contact: RecruiterContact) => {
      const key = (contact.workEmail || contact.linkedinUrl ||
        `${contact.fullName}|${contact.title}`).toLowerCase();
      const existing = contactsByIdentity.get(key);
      if (!existing || (!existing.safeToContact && contact.safeToContact) ||
        contact.relevanceScore > existing.relevanceScore) {
        contactsByIdentity.set(key, contact);
      }
    };
    for (const contact of extractPublishedRecruiterContacts(publicItems, {
      company: job.company,
      jobTitle: job.title,
      teamKeywords,
      officialDomain,
    }) as RecruiterContact[]) {
      addContact(contact);
    }
    for (const contact of providerContacts) addContact(contact);
    for (const contact of hunter.contacts) addContact(contact);
    const shared: SharedDiscovery = officialDomain
      ? await loadSharedDiscovery(serviceClient, officialDomain)
      : { profile: null, contacts: [] };
    for (const contact of shared.contacts) addContact(contact);
    for (const person of siteScan.people) {
      const roleKind = inferRoleKind(person.title);
      if (roleKind === "unknown" || roleKind === "employee") continue;
      addContact({
        fullName: person.fullName,
        title: person.title,
        roleKind,
        linkedinUrl: "",
        linkedinSourceUrl: "",
        workEmail: person.email,
        emailStatus: person.email ? "source_verified" : "not_found",
        emailConfidence: person.email ? 0.9 : 0,
        emailSourceUrl: person.email ? person.sourceUrl : "",
        relevanceScore: relevanceScore(person.title, roleKind, `${person.fullName} ${person.title}`, job.company, teamKeywords),
        evidence: [{ type: "company_site_rtrvr", sourceUrl: person.sourceUrl }],
        safeToContact: Boolean(person.email),
      });
    }
    for (const item of allItems) {
      const linkedinUrl = normalizeLinkedInProfileUrl(item.url);
      if (!linkedinUrl) continue;
      const parsed = parseLinkedInResult(item);
      if (!parsed) continue;
      const evidence = sourceText(item);
      const companyMatch = companyTokens(job.company).some((token) => evidence.toLowerCase().includes(token));
      if (!companyMatch) continue;
      const roleKind = inferRoleKind(parsed.title);
      const score = relevanceScore(parsed.title, roleKind, evidence, job.company, teamKeywords);
      if (roleKind === "unknown" || score < 65) continue;
      addContact({
        fullName: parsed.fullName,
        title: parsed.title,
        roleKind,
        linkedinUrl,
        linkedinSourceUrl: item.url,
        workEmail: "",
        emailStatus: "not_found",
        emailConfidence: 0,
        emailSourceUrl: "",
        relevanceScore: score,
        evidence: [{
          type: "public_linkedin_search_result",
          sourceUrl: item.url,
          sourceQuery: item.sourceQuery,
          excerpt: compactText(evidence, 450),
        }],
        safeToContact: false,
      });
    }

    const limit = clamp(request.limit, 5, 1, 8);
    const ranked = Array.from(contactsByIdentity.values())
      .sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, limit);
    const contacts: RecruiterContact[] = [];
    for (const contact of ranked) {
      contacts.push(contact.safeToContact && contact.workEmail
        ? contact
        : await enrichEmail(
          contact,
          officialDomain,
          firecrawlKey,
          job.company,
          isStarterColdMailRun
            ? (apiKey, query, limit) =>
              searchStarterColdMailWeb(apiKey, query, limit, true)
            : searchWeb,
        ));
    }
    const publishedInbox = verifiedRecruitmentInbox(publicItems, officialDomain) || hunter.genericInbox;
    let patternInbox: { email: string; sourceUrl: string } | null = null;
    if (officialDomain) {
      const resolution = await resolveEmailsByPattern({
        serviceClient,
        domain: officialDomain,
        company: job.company,
        contacts,
        samples: [
          ...siteScan.people.filter((person) => person.email)
            .map((person) => ({ email: person.email, fullName: person.fullName })),
          ...siteScan.emails.map((email) => ({ email })),
          ...publicItems.flatMap((item) => extractEmails(sourceText(item))).map((email) => ({ email })),
          ...contacts.filter((contact) => contact.safeToContact && contact.workEmail)
            .map((contact) => ({ email: contact.workEmail, fullName: contact.fullName })),
        ],
        cachedProfile: shared.profile,
        needGenericInbox: !publishedInbox,
      });
      contacts.splice(0, contacts.length, ...resolution.contacts);
      patternInbox = resolution.genericInbox;
    }
    await persistContacts(serviceClient, context.user.id, runId, job, contacts);

    const genericInbox = publishedInbox || patternInbox;
    const bestEmail = contacts.filter((contact) => contact.safeToContact && contact.workEmail)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)[0]?.workEmail || genericInbox?.email || "";
    const safeCount = contacts.filter((contact) => contact.safeToContact).length;
    const confidence = safeCount > 0 ? "high" : contacts.length || careersPageUrl ? "medium" : "low";
    const publicContactChannels: string[] = [];
    if (careersPageUrl) publicContactChannels.push(`Careers page | ${careersPageUrl}`);
    for (const contact of contacts) {
      if (contact.linkedinUrl) {
        publicContactChannels.push(`LinkedIn | ${contact.fullName} | ${contact.title || contact.roleKind} | ${contact.linkedinUrl} | relevance=${contact.relevanceScore}`);
      }
      if (contact.safeToContact && contact.workEmail) {
        publicContactChannels.push(`Verified work email | ${contact.fullName} | ${contact.workEmail} | ${contact.emailStatus} | source=${contact.emailSourceUrl}`);
      } else if (contact.emailStatus === "pattern_only" && contact.workEmail) {
        publicContactChannels.push(`Likely work email (matches company format, not confirmed) | ${contact.fullName} | ${contact.workEmail}`);
      }
    }
    if (genericInbox) {
      publicContactChannels.push(`Verified recruitment inbox | ${genericInbox.email} | source=${genericInbox.sourceUrl}`);
    }
    if (!publicContactChannels.length) publicContactChannels.push("No evidence-backed recruiter contact was found.");

    await updateRun(serviceClient, runId, {
      official_domain: officialDomain || null,
      careers_page_url: careersPageUrl || null,
      status: contacts.length || careersPageUrl ? "completed" : "partial",
      result_summary: {
        contacts: contacts.length,
        safe_contacts: safeCount,
        verified_individual_emails: contacts.filter((contact) => contact.safeToContact && contact.workEmail).length,
        verified_recruitment_inbox: genericInbox?.email || null,
      },
      error: null,
    });
    if (!context.coldMailCapability) {
      await recordUsage(serviceClient, context.user.id, context.tier, {
        company_name: job.company,
        job_id: job.id,
        confidence,
        contacts: contacts.length,
        safe_contacts: safeCount,
        has_email: Boolean(bestEmail),
        source: "public_indexed_recruiter_discovery_v2",
      });
    }

    return jsonResponse({
      domain: officialDomain,
      careersPageUrl,
      contactEmail: bestEmail,
      publicContactChannels,
      confidence,
      foundSource: "Official company/team pages, public indexed web results, an optional contact provider, and public LinkedIn profile results. Work emails are returned only when published in evidence or confirmed by a configured non-catch-all provider.",
      job,
      teamKeywords,
      recruiterContacts: contacts,
      verificationPolicy: {
        guessedEmailsReturned: false,
        patternOnlyAddressesPersistedAsSafe: false,
        authenticatedLinkedInScrapingUsed: false,
        linkedinDiscoveryMode: "public_indexed_profile_urls",
        directLinkedInMessageAvailable: false,
        emailAutoSendAllowed: false,
        requiresExplicitApprovalBeforeExternalSend: true,
        configuredEmailVerifier: Boolean(asString(Deno.env.get("RECRUITER_EMAIL_VERIFIER_URL"))),
        configuredContactProvider: Boolean(asString(Deno.env.get("RECRUITER_CONTACT_PROVIDER_URL"))) || Boolean(hunterKey()),
      },
      discoveryRunId: runId,
    }, 200, headers);
  } catch (error) {
    if (serviceClient && runId) {
      await updateRun(serviceClient, runId, {
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown recruiter discovery error",
      });
    }
    const status = error instanceof HttpError ? error.status : 500;
    console.error("scout-company recruiter discovery failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Internal recruiter discovery error" }, status, headers);
  }
});
