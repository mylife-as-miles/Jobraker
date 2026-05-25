import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { getCorsHeaders } from "../_shared/cors.ts";
import {
  SubscriptionAccessError,
  requireSubscriptionTier,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";
import { createNotificationRecord } from "../_shared/notification-center.ts";
import {
  enforceFeatureRateLimit,
  recordFeatureUsage,
} from "../_shared/feature-limits.ts";

const DEFAULT_QUERY = [
  "newer_than:180d",
  "(",
  '"thank you for applying"',
  "OR",
  '"application received"',
  "OR",
  '"started your job application"',
  "OR",
  '"your application"',
  "OR",
  '"schedule interview"',
  "OR",
  '"interview invitation"',
  "OR",
  '"offer letter"',
  "OR",
  '"employment offer"',
  "OR",
  '"job offer"',
  "OR",
  '"offer of employment"',
  "OR",
  '"pleased to offer"',
  "OR",
  '"extend an offer"',
  "OR",
  '"extend you an offer"',
  "OR",
  "congratulations",
  "OR",
  '"pleased to inform"',
  "OR",
  '"selected for"',
  "OR",
  '"letter of appointment"',
  "OR",
  '"appointment letter"',
  "OR",
  '"contract of employment"',
  "OR",
  '"employment contract"',
  "OR",
  '"compensation package"',
  "OR",
  '"start date"',
  "OR",
  '"joining date"',
  "OR",
  '"not selected"',
  "OR",
  "unfortunately",
  "OR",
  "assessment",
  "OR",
  '"withdraw your application"',
  "OR",
  '"application withdrawn"',
  ")",
].join(" ");

const MAX_MESSAGE_BODY_CHARS = 14_000;

type RequestBody = {
  query?: string;
  maxResults?: number;
  force?: boolean;
};

type GmailConnection = {
  email: string | null;
  access_token_ciphertext: string | null;
  refresh_token_ciphertext: string | null;
  token_expires_at: string | null;
  sync_history_id: string | null;
};

type GmailListResponse = {
  messages?: Array<{ id: string; threadId?: string }>;
  nextPageToken?: string;
};

type GmailHeader = {
  name?: string;
  value?: string;
};

type GmailPayload = {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number };
  parts?: GmailPayload[];
};

type GmailMessage = {
  id: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  historyId?: string;
  payload?: GmailPayload;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type ApplicationStatus =
  | "Draft"
  | "Pending"
  | "Applied"
  | "Failed"
  | "Terminated"
  | "Interview"
  | "Offer"
  | "Rejected"
  | "Withdrawn";
type GmailEventType =
  | "application_confirmation"
  | "interview"
  | "offer"
  | "rejection"
  | "assessment"
  | "withdrawal"
  | "other";

type JobUrlRow = {
  apply_url: string | null;
  source_id: string | null;
};

type ApplicationRow = {
  id: string;
  job_id: string | null;
  job_title: string;
  company: string;
  status: ApplicationStatus;
  canonical_stage: string | null;
  notes: string | null;
  app_url: string | null;
  /** PostgREST embed from `applications.job_id → jobs`; null when job_id is null. */
  jobs: JobUrlRow | JobUrlRow[] | null;
};

type ParsedAddress = {
  name: string | null;
  email: string | null;
};

type ClassifiedMessage = {
  eventType: GmailEventType;
  status: ApplicationStatus | null;
  canonicalStage: string | null;
  confidence: number;
  company: string | null;
  jobTitle: string | null;
  nextStep: string | null;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  corsHeaders: Record<string, string>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function decodeBase64Url(data?: string) {
  if (!data) return "";
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - normalized.length % 4) % 4),
    "=",
  );
  try {
    return decoder.decode(fromBase64(padded));
  } catch {
    return "";
  }
}

async function getEncryptionKey() {
  const secret = requireEnv("GMAIL_TOKEN_ENCRYPTION_KEY");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

async function encryptSecret(value: string) {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const key = await getEncryptionKey();
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(value),
    ),
  );
  return `${toBase64(iv)}.${toBase64(ciphertext)}`;
}

async function decryptSecret(value: string | null | undefined) {
  if (!value) return null;
  const [ivBase64, ciphertextBase64] = value.split(".");
  if (!ivBase64 || !ciphertextBase64) {
    throw new Error("Stored Gmail token is invalid");
  }
  const key = await getEncryptionKey();
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(ivBase64) },
    key,
    fromBase64(ciphertextBase64),
  );
  return decoder.decode(plaintext);
}

async function refreshAccessToken(refreshToken: string) {
  const params = new URLSearchParams({
    client_id: requireEnv("GOOGLE_GMAIL_CLIENT_ID"),
    client_secret: requireEnv("GOOGLE_GMAIL_CLIENT_SECRET"),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const data = await response.json() as GoogleTokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || "Gmail token refresh failed",
    );
  }
  return {
    accessToken: data.access_token,
    expiresAt: new Date(
      Date.now() + Math.max(30, data.expires_in || 3600) * 1000,
    ).toISOString(),
  };
}

async function getValidAccessToken(
  serviceClient: any,
  userId: string,
  connection: GmailConnection,
) {
  const expiresAt = connection.token_expires_at
    ? Date.parse(connection.token_expires_at)
    : 0;
  const shouldRefresh = !expiresAt || expiresAt - Date.now() < 90_000;
  const currentAccessToken = await decryptSecret(
    connection.access_token_ciphertext,
  );

  if (currentAccessToken && !shouldRefresh) {
    return currentAccessToken;
  }

  const refreshToken = await decryptSecret(connection.refresh_token_ciphertext);
  if (!refreshToken) {
    throw new Error("Gmail is connected without a refresh token. Reconnect Gmail.");
  }

  const refreshed = await refreshAccessToken(refreshToken);
  const { error } = await serviceClient
    .from("gmail_connections")
    .update({
      access_token_ciphertext: await encryptSecret(refreshed.accessToken),
      token_expires_at: refreshed.expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) throw error;
  return refreshed.accessToken;
}

async function listGmailMessages(
  accessToken: string,
  query: string,
  maxResults: number,
) {
  const messages: Array<{ id: string; threadId?: string }> = [];
  let pageToken: string | undefined;

  while (messages.length < maxResults) {
    const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
    url.searchParams.set("q", query);
    url.searchParams.set("maxResults", String(Math.min(100, maxResults - messages.length)));
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`Gmail message search failed (${response.status}): ${await response.text()}`);
    }

    const data = await response.json() as GmailListResponse;
    messages.push(...(data.messages || []));
    pageToken = data.nextPageToken;
    if (!pageToken || !data.messages?.length) break;
  }

  return messages;
}

async function getGmailMessage(accessToken: string, messageId: string) {
  const url = new URL(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}`,
  );
  url.searchParams.set("format", "full");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Gmail message fetch failed (${response.status}): ${await response.text()}`);
  }
  return await response.json() as GmailMessage;
}

function getHeader(payload: GmailPayload | undefined, name: string) {
  const target = name.toLowerCase();
  return payload?.headers?.find((header) =>
    header.name?.toLowerCase() === target
  )?.value ?? "";
}

function stripHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"');
}

function payloadToText(payload: GmailPayload | undefined): string {
  if (!payload) return "";
  const chunks: string[] = [];

  function visit(part: GmailPayload) {
    const mimeType = (part.mimeType || "").toLowerCase();
    const decoded = decodeBase64Url(part.body?.data);
    if (decoded) {
      if (mimeType.includes("text/html")) {
        chunks.push(stripHtml(decoded));
      } else if (!mimeType || mimeType.includes("text/plain")) {
        chunks.push(decoded);
      }
    }
    for (const child of part.parts || []) visit(child);
  }

  visit(payload);
  return chunks
    .join("\n")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, MAX_MESSAGE_BODY_CHARS);
}

function parseAddress(value: string): ParsedAddress {
  const emailMatch = value.match(/<([^>]+)>/) ||
    value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const email = emailMatch
    ? (emailMatch[1] || emailMatch[0]).trim().toLowerCase()
    : null;
  const name = value
    .replace(/<[^>]+>/g, "")
    .replace(/[",]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return { name: name || null, email };
}

function titleCase(value: string) {
  return value
    .split(/[\s.-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function companyFromDomain(email: string | null) {
  if (!email) return null;
  const domain = email.split("@")[1] || "";
  const parts = domain.split(".").filter(Boolean);
  if (parts.length < 2) return null;
  const candidate = parts.length > 2 && ["mail", "email", "careers", "jobs"].includes(parts[0])
    ? parts[1]
    : parts[parts.length - 2];
  if (!candidate || ["gmail", "googlemail", "outlook", "yahoo", "workdayjobs"].includes(candidate)) {
    return null;
  }
  return titleCase(candidate);
}

function cleanCompany(value: string | null | undefined) {
  if (!value) return null;
  const cleaned = value
    .replace(/\b(hiring team|recruiting team|talent team|careers|recruiting|notifications?|no-?reply)\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s:,-]+|[\s:,-]+$/g, "")
    .trim();
  if (!cleaned || cleaned.length < 2) return null;
  if (/^(gmail|google|linkedin|indeed|workday|greenhouse|lever)$/i.test(cleaned)) {
    return null;
  }
  return cleaned.slice(0, 120);
}

function firstRegexGroup(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].replace(/\s+/g, " ").trim();
    }
  }
  return null;
}

function inferCompany(text: string, subject: string, from: ParsedAddress) {
  const fromName = cleanCompany(from.name);
  const explicit = firstRegexGroup(`${subject}\n${text}`, [
    /offer (?:from|with|at)\s+([A-Z][A-Za-z0-9&.,' -]{2,80})/i,
    /(?:selected|chosen) (?:to join|for)\s+([A-Z][A-Za-z0-9&.,' -]{2,80})/i,
    /thank you for applying to\s+([^\n.!?]+)/i,
    /thank you for your interest in\s+([^\n.!?]+)/i,
    /application (?:with|at)\s+([A-Z][A-Za-z0-9&.,' -]{2,80})/i,
    /(?:regards|sincerely),?\s+([A-Z][A-Za-z0-9&.,' -]{2,80})(?:\s+hiring team|\s+recruiting team)?/i,
  ]);
  return cleanCompany(explicit) || fromName || companyFromDomain(from.email);
}

function inferJobTitle(text: string, subject: string) {
  const source = `${subject}\n${text}`;
  const title = firstRegexGroup(source, [
    /offer (?:for|of employment as)\s+(?:the\s+)?([A-Za-z0-9,/'&+ -]{3,100})(?:\s+position|\s+role| at |\n|\.|,)/i,
    /selected for\s+(?:the\s+)?([A-Za-z0-9,/'&+ -]{3,100})(?:\s+position|\s+role| at |\n|\.|,)/i,
    /join (?:us|our team) as\s+(?:a\s+|an\s+|the\s+)?([A-Za-z0-9,/'&+ -]{3,100})(?:\n|\.|,)/i,
    /position of\s+([^\n.]+)/i,
    /for the position of\s+([^\n.]+)/i,
    /for the\s+([A-Za-z0-9,/'&+ -]{3,100})\s+(?:position|role)/i,
    /your application for\s+(?:the\s+)?([A-Za-z0-9,/'&+ -]{3,100})(?:\s+position|\s+role| at |\n|\.|,)/i,
    /application for\s+(?:the\s+)?([A-Za-z0-9,/'&+ -]{3,100})(?:\s+position|\s+role| at |\n|\.|,)/i,
    /interview for\s+(?:the\s+)?([A-Za-z0-9,/'&+ -]{3,100})(?:\s+position|\s+role| at |\n|\.|,)/i,
  ]);
  return title?.replace(/\bhave available\b.*$/i, "").trim().slice(0, 140) || null;
}

/** Normalize curly/smart quotes so phrase checks match mobile Gmail & ATS templates. */
function normalizeForPhraseMatch(text: string) {
  return text
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"');
}

function looksLikeMarketingOffer(text: string) {
  return /\b(discount|promo|coupon|sale|black friday|limited time offer|subscription offer|special offer|renewal offer|upgrade offer)\b/i
    .test(text);
}

function classifyMessage(
  subject: string,
  snippet: string,
  bodyText: string,
  from: ParsedAddress,
): ClassifiedMessage {
  const combined = normalizeForPhraseMatch(
    `${subject}\n${snippet}\n${bodyText}`,
  );
  const lower = combined.toLowerCase();
  const company = inferCompany(bodyText, subject, from);
  const jobTitle = inferJobTitle(bodyText, subject);

  const strongOffer =
    /\b(pleased to offer|offer letter|employment offer|job offer|offer of employment|extend(?:ing)? (?:you )?an offer|we are delighted to offer|we are happy to offer|we would like to offer|letter of appointment|appointment letter|contract of employment|employment contract|compensation package)\b/i
      .test(combined);
  const contextualOffer =
    /\b(congratulations[,\s]+(?:you have been|we are|on your|from)|pleased to inform you[\s\S]{0,160}(?:selected|offer)|selected (?:for|to join)|start date|joining date)\b/i
      .test(combined) &&
    /\b(role|position|job|employment|candidate|hiring|recruitment|interview|salary|compensation|joining|start date)\b/i
      .test(combined);

  if ((strongOffer || contextualOffer) && !looksLikeMarketingOffer(combined)) {
    return {
      eventType: "offer",
      status: "Offer",
      canonicalStage: "offer",
      confidence: 0.96,
      company,
      jobTitle,
      nextStep: "Review the offer details and prepare your response.",
    };
  }

  if (/\b(schedule (an? )?interview|invited? (you )?to interview|interview invitation|phone screen|technical screen|book a time|select a time|calendar invite)\b/i.test(combined)) {
    return {
      eventType: "interview",
      status: "Interview",
      canonicalStage: "interview",
      confidence: 0.92,
      company,
      jobTitle,
      nextStep: "Reply or book the interview time.",
    };
  }

  if (/\b(unfortunately|not selected|not moving forward|move forward with other candidates|decided not to proceed|no longer under consideration)\b/i.test(combined)) {
    return {
      eventType: "rejection",
      status: "Rejected",
      canonicalStage: "rejected",
      confidence: 0.9,
      company,
      jobTitle,
      nextStep: "Archive the role and reuse any learnings for the next application.",
    };
  }

  if (
    /\b(you\s+)?withdrew|withdraw\s+your\s+application|withdrawal\s+of\s+your\s+application|application\s+(?:has\s+been\s+)?withdrawn|successfully\s+withdrawn|retract(?:ed|ing)?\s+your\s+application\b/i
      .test(combined)
  ) {
    return {
      eventType: "withdrawal",
      status: "Withdrawn",
      canonicalStage: "withdrawn",
      confidence: 0.88,
      company,
      jobTitle,
      nextStep: "This role is marked as withdrawn.",
    };
  }

  if (/\b(assessment|coding challenge|take-?home|complete (your )?(assessment|test)|online test)\b/i.test(combined)) {
    return {
      eventType: "assessment",
      status: "Applied",
      canonicalStage: "submitted",
      confidence: 0.76,
      company,
      jobTitle,
      nextStep: "Complete the requested assessment.",
    };
  }

  if (
    lower.includes("thank you for applying") ||
    lower.includes("application received") ||
    lower.includes("we received your application") ||
    lower.includes("you've started your job application") ||
    lower.includes("you have started your job application") ||
    lower.includes("submitted your application") ||
    lower.includes("your application for")
  ) {
    return {
      eventType: "application_confirmation",
      status: "Applied",
      canonicalStage: "submitted",
      confidence: 0.82,
      company,
      jobTitle,
      nextStep: "Watch for recruiter follow-up or next steps.",
    };
  }

  return {
    eventType: "other",
    status: null,
    canonicalStage: null,
    confidence: 0,
    company,
    jobTitle,
    nextStep: null,
  };
}

function normalizeForMatch(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|limited|corp|corporation|company|co|plc)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const TRACKING_QUERY_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "mc_eid",
]);

/** Strip trailing punctuation often glued to URLs in email HTML/plain text. */
function stripTrailingUrlJunk(raw: string) {
  return raw.replace(/[),.;:!?\]}>'"\u201d\u2019]+$/u, "").trim();
}

/** Extract http(s) URLs from free text (body, subject, snippets, notes). */
function extractHttpUrls(text: string): string[] {
  const re = /https?:\/\/[^\s<>\[\]()'"]+/gi;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of text.matchAll(re)) {
    const cleaned = stripTrailingUrlJunk(m[0]);
    if (!seen.has(cleaned)) {
      seen.add(cleaned);
      out.push(cleaned);
    }
  }
  return out;
}

/**
 * Comparable key: lowercase host (no www), path, and non-tracking query string.
 * Aligns http/https and most trailing-slash variants.
 */
function normalizeUrlForMatch(raw: string): string | null {
  const cleaned = stripTrailingUrlJunk(raw);
  try {
    const u = new URL(cleaned);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const params = new URLSearchParams(u.search);
    for (const k of [...params.keys()]) {
      if (TRACKING_QUERY_PARAMS.has(k.toLowerCase())) params.delete(k);
    }
    const search = params.toString();
    let path = u.pathname;
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    const qs = search ? `?${search}` : "";
    return `${host}${path || "/"}${qs}`;
  } catch {
    return null;
  }
}

/** Extra keys for ATS links where query param identity matters across URL variants. */
function supplementalUrlKeys(href: string): string[] {
  const keys: string[] = [];
  try {
    const u = new URL(stripTrailingUrlJunk(href));
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const p = u.searchParams.get("p");
    if (
      p && /^[A-Za-z0-9_-]+$/.test(p) &&
      (host.includes("icims") || u.pathname.toLowerCase().includes("icims") ||
        u.pathname.toLowerCase().includes("r.jsp"))
    ) {
      keys.push(`icims:p:${p}`);
    }
    for (const param of ["job_id", "jobId", "jid", "req", "requisition", "rid"]) {
      const v = u.searchParams.get(param);
      if (v && /^[A-Za-z0-9._-]+$/.test(v) && v.length <= 64) {
        keys.push(`q:${param.toLowerCase()}=${v}`);
      }
    }
  } catch {
    // ignore
  }
  return keys;
}

function urlKeysForHref(href: string): string[] {
  const keys: string[] = [];
  const norm = normalizeUrlForMatch(href);
  if (norm) keys.push(norm);
  keys.push(...supplementalUrlKeys(href));
  return keys.filter(Boolean);
}

function collectUrlKeysFromText(text: string): Set<string> {
  const keys = new Set<string>();
  for (const href of extractHttpUrls(text)) {
    for (const k of urlKeysForHref(href)) keys.add(k);
  }
  return keys;
}

function primaryJobEmbed(
  jobs: ApplicationRow["jobs"],
): JobUrlRow | null {
  if (!jobs) return null;
  return Array.isArray(jobs) ? (jobs[0] ?? null) : jobs;
}

/** URLs we stored on the application row, linked job, or inside notes (e.g. Source: url|url). */
function applicationStoredUrlKeys(app: ApplicationRow): Set<string> {
  const keys = new Set<string>();
  const absorb = (raw: string | null | undefined) => {
    if (!raw?.trim()) return;
    for (const k of collectUrlKeysFromText(raw)) keys.add(k);
  };
  absorb(app.app_url);
  const job = primaryJobEmbed(app.jobs);
  absorb(job?.apply_url ?? null);
  absorb(app.notes);
  return keys;
}

/** If the email mentions a job UUID that matches an application.job_id, prefer that row. */
function matchApplicationByJobIdInText(
  applications: ApplicationRow[],
  text: string,
): ApplicationRow | null {
  const uuidRegex =
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
  const found = new Set<string>();
  for (const m of text.matchAll(uuidRegex)) {
    found.add(m[0].toLowerCase());
  }
  if (found.size === 0) return null;
  const hits = applications.filter((a) =>
    a.job_id && found.has(a.job_id.toLowerCase())
  );
  return hits.length === 1 ? hits[0] : null;
}

/** Match when any URL/key in the email overlaps stored application or job URLs. */
function matchApplicationByUrls(
  applications: ApplicationRow[],
  emailText: string,
  classified: ClassifiedMessage,
): ApplicationRow | null {
  const emailKeys = collectUrlKeysFromText(emailText);
  if (emailKeys.size === 0) return null;

  const winners: ApplicationRow[] = [];
  const lowerEmail = emailText.toLowerCase();
  for (const app of applications) {
    const stored = applicationStoredUrlKeys(app);
    let hit = false;
    for (const k of emailKeys) {
      if (stored.has(k)) {
        hit = true;
        break;
      }
    }
    if (!hit) {
      const job = primaryJobEmbed(app.jobs);
      const sid = job?.source_id?.trim();
      if (
        sid &&
        sid.length >= 4 &&
        sid.length <= 80 &&
        /^[A-Za-z0-9._-]+$/.test(sid) &&
        lowerEmail.includes(sid.toLowerCase())
      ) {
        hit = true;
      }
    }
    if (hit) winners.push(app);
  }

  if (winners.length === 0) return null;
  if (winners.length === 1) return winners[0];

  let best: { app: ApplicationRow; score: number } | null = null;
  for (const app of winners) {
    const score = matchScore(app, classified);
    if (!best || score > best.score) best = { app, score };
  }
  return best?.app ?? winners[0];
}

function matchScore(app: ApplicationRow, classified: ClassifiedMessage) {
  const appCompany = normalizeForMatch(app.company);
  const eventCompany = normalizeForMatch(classified.company);
  const appTitle = normalizeForMatch(app.job_title);
  const eventTitle = normalizeForMatch(classified.jobTitle);
  let score = 0;

  if (appCompany && eventCompany) {
    if (appCompany === eventCompany) score += 0.65;
    else if (appCompany.includes(eventCompany) || eventCompany.includes(appCompany)) score += 0.55;
  }

  if (appTitle && eventTitle) {
    if (appTitle === eventTitle) score += 0.35;
    else if (appTitle.includes(eventTitle) || eventTitle.includes(appTitle)) score += 0.25;
  }

  return score;
}

function findMatchingApplication(
  applications: ApplicationRow[],
  classified: ClassifiedMessage,
  emailText: string,
) {
  const byJobId = matchApplicationByJobIdInText(applications, emailText);
  if (byJobId) return byJobId;

  const byUrl = matchApplicationByUrls(applications, emailText, classified);
  if (byUrl) return byUrl;

  let best: { app: ApplicationRow; score: number } | null = null;
  for (const app of applications) {
    const score = matchScore(app, classified);
    if (!best || score > best.score) best = { app, score };
  }
  return best && best.score >= 0.5 ? best.app : null;
}

function shouldUpdateStatus(
  current: ApplicationStatus,
  next: ClassifiedMessage["status"],
) {
  if (!next || current === next) return false;
  if (current === "Offer") {
    return next === "Rejected" || next === "Withdrawn";
  }
  if (next === "Offer") return true;
  if (next === "Rejected") return current !== "Withdrawn";
  if (next === "Withdrawn") return current !== "Withdrawn";
  if (next === "Interview") {
    return ["Draft", "Pending", "Applied", "Failed", "Terminated"].includes(
      current,
    );
  }
  if (next === "Applied") {
    return ["Draft", "Pending", "Failed"].includes(current);
  }
  return false;
}

function fallbackJobTitle(classified: ClassifiedMessage) {
  if (classified.jobTitle) return classified.jobTitle;
  if (classified.eventType === "interview") return "Interview opportunity";
  if (classified.eventType === "offer") return "Offer received";
  return "Application update";
}

function notificationFor(classified: ClassifiedMessage, company: string, jobTitle: string) {
  switch (classified.eventType) {
    case "offer":
      return {
        type: "application",
        title: `Offer found: ${jobTitle}`,
        message: `${company} appears to have sent an offer update.`,
        priority: "high",
      };
    case "interview":
      return {
        type: "interview",
        title: `Interview found: ${jobTitle}`,
        message: `${company} appears to have sent an interview invitation.`,
        priority: "high",
      };
    case "rejection":
      return {
        type: "system",
        title: `Rejection found: ${jobTitle}`,
        message: `${company} appears to have sent a rejection update.`,
        priority: "medium",
      };
    case "assessment":
      return {
        type: "application",
        title: `Assessment found: ${jobTitle}`,
        message: `${company} appears to have requested an assessment.`,
        priority: "medium",
      };
    case "application_confirmation":
      return {
        type: "application",
        title: `Application confirmed: ${jobTitle}`,
        message: `${company} confirmed or started an application.`,
        priority: "low",
      };
    case "withdrawal":
      return {
        type: "application",
        title: `Withdrawal: ${jobTitle}`,
        message: `${company} indicates your application was withdrawn.`,
        priority: "medium",
      };
    default:
      return null;
  }
}

async function createNotification(
  serviceClient: any,
  userId: string,
  classified: ClassifiedMessage,
  company: string,
  jobTitle: string,
  opts: {
    applicationId: string | null;
    eventId: string | null;
    gmailMessageId: string;
    gmailThreadId: string | null;
    subject: string;
    senderName: string | null;
    senderEmail: string | null;
    snippet: string | null;
    receivedAt: string;
  },
) {
  const notification = notificationFor(classified, company, jobTitle);
  if (!notification) return;
  try {
    await createNotificationRecord(serviceClient, {
      userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      company,
      priority: notification.priority,
      source: "gmail",
      sourceRecordId: opts.eventId,
      sourceRecordType: "gmail_event",
      actionUrl: opts.applicationId
        ? `/dashboard/application?application=${encodeURIComponent(opts.applicationId)}`
        : "/dashboard/application",
      actionLabel: opts.applicationId ? "Open application" : "Open applications",
      dedupeKey: `gmail-event:${opts.gmailMessageId}`,
      metadata: {
        event_type: classified.eventType,
        status: classified.status,
        canonical_stage: classified.canonicalStage,
        confidence: classified.confidence,
        gmail_message_id: opts.gmailMessageId,
        gmail_thread_id: opts.gmailThreadId,
        subject: opts.subject,
        sender_name: opts.senderName,
        sender_email: opts.senderEmail,
        snippet: opts.snippet,
        received_at: opts.receivedAt,
        application_id: opts.applicationId,
        company,
        job_title: jobTitle,
      },
    });
  } catch (error) {
    console.warn("Failed to create Gmail sync notification", error);
  }
}

function receivedAtFor(message: GmailMessage, dateHeader: string) {
  const internal = Number(message.internalDate || "");
  if (Number.isFinite(internal) && internal > 0) {
    return new Date(internal).toISOString();
  }
  const parsed = Date.parse(dateHeader);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  return new Date().toISOString();
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin") || undefined);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders);
  }

  try {
    const { user, serviceClient, subscriptionTier } = await requireSubscriptionTier(
      req,
      "Pro",
      "Gmail application checks",
    );
    await enforceFeatureRateLimit({
      userId: user.id,
      featureKey: "sync_gmail_application_events",
      serviceClient,
      subscriptionTier,
    });
    const body = await req.json().catch(() => ({})) as RequestBody;
    const maxResults = Math.max(1, Math.min(100, Number(body.maxResults || 30)));
    const query = typeof body.query === "string" && body.query.trim()
      ? body.query.trim()
      : DEFAULT_QUERY;
    const force = body.force === true;

    const { data: connection, error: connectionError } = await serviceClient
      .from("gmail_connections")
      .select("email, access_token_ciphertext, refresh_token_ciphertext, token_expires_at, sync_history_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (connectionError) throw connectionError;
    if (!connection) {
      return jsonResponse(
        { error: "Gmail is not connected. Connect Gmail in Settings first." },
        409,
        corsHeaders,
      );
    }

    const accessToken = await getValidAccessToken(
      serviceClient,
      user.id,
      connection as GmailConnection,
    );
    const list = await listGmailMessages(accessToken, query, maxResults);
    const ids = list.map((message) => message.id);

    /** Skip only messages already processed and linked to an application (retry orphans until they match). */
    const existingIds = new Set<string>();
    if (ids.length > 0 && !force) {
      const { data: existingEvents, error: existingError } = await serviceClient
        .from("gmail_application_events")
        .select("gmail_message_id, application_id")
        .eq("user_id", user.id)
        .in("gmail_message_id", ids);
      if (existingError) throw existingError;
      for (const event of existingEvents || []) {
        if (
          typeof event.gmail_message_id === "string" &&
          event.application_id != null
        ) {
          existingIds.add(event.gmail_message_id);
        }
      }
    }

    const { data: applicationsData, error: applicationsError } = await serviceClient
      .from("applications")
      .select(
        "id, job_id, job_title, company, status, canonical_stage, notes, app_url, jobs(apply_url, source_id)",
      )
      .eq("user_id", user.id);
    if (applicationsError) throw applicationsError;

    const applications = (applicationsData || []).map((row: Record<string, unknown>) => ({
      ...(row as ApplicationRow),
      app_url: (row.app_url as string | null) ?? null,
      jobs: (row.jobs as ApplicationRow["jobs"]) ?? null,
    })) as ApplicationRow[];
    let classifiedCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    let skippedExistingCount = 0;
    let skippedNoMatchCount = 0;
    let latestHistoryId: string | null = null;
    const events: Array<Record<string, unknown>> = [];

    for (const listed of list) {
      if (!force && existingIds.has(listed.id)) {
        skippedExistingCount += 1;
        continue;
      }

      const message = await getGmailMessage(accessToken, listed.id);
      latestHistoryId = message.historyId || latestHistoryId;
      const subject = getHeader(message.payload, "Subject");
      const from = parseAddress(getHeader(message.payload, "From"));
      const dateHeader = getHeader(message.payload, "Date");
      const receivedAt = receivedAtFor(message, dateHeader);
      const bodyText = payloadToText(message.payload);
      const classified = classifyMessage(
        subject,
        message.snippet || "",
        bodyText,
        from,
      );

      if (classified.eventType === "other" || classified.confidence < 0.55) {
        continue;
      }

      const company = classified.company || "Unknown company";
      const jobTitle = fallbackJobTitle(classified);
      const emailMatchText = `${subject}\n${message.snippet || ""}\n${bodyText}`;
      let matched = findMatchingApplication(
        applications,
        classified,
        emailMatchText,
      );

      if (!matched) {
        if (classified.eventType === "offer" && classified.confidence >= 0.8) {
          const offerNotes = [
            "Offer detected from Gmail.",
            `Subject: ${subject || "No subject"}`,
            from.email ? `From: ${from.name ? `${from.name} <${from.email}>` : from.email}` : null,
            message.snippet ? `Snippet: ${message.snippet}` : null,
          ].filter(Boolean).join("\n");

          const { data: createdApplication, error: createApplicationError } =
            await serviceClient
              .from("applications")
              .insert({
                user_id: user.id,
                job_title: jobTitle,
                company,
                location: "",
                applied_date: receivedAt,
                status: "Offer",
                canonical_stage: "offer",
                notes: offerNotes,
                next_step: classified.nextStep,
                provider_status: "gmail:offer",
                provider_run_output: {
                  source: "gmail_offer_detection",
                  gmail_message_id: message.id,
                  gmail_thread_id: message.threadId || listed.threadId || null,
                  sender_name: from.name,
                  sender_email: from.email,
                  subject,
                  snippet: message.snippet || null,
                  received_at: receivedAt,
                  bodyPreview: bodyText.slice(0, 2000),
                },
                updated_at: new Date().toISOString(),
              })
              .select("id, job_id, job_title, company, status, canonical_stage, notes, app_url")
              .single();

          if (createApplicationError) throw createApplicationError;
          if (!createdApplication?.id) {
            throw new Error("Failed to create application tracker entry for Gmail offer");
          }

          matched = {
            ...(createdApplication as ApplicationRow),
            app_url: (createdApplication?.app_url as string | null) ?? null,
            jobs: null,
          };
          applications.push(matched);
          createdCount += 1;
        } else {
          skippedNoMatchCount += 1;
          const { error: orphanEventError } = await serviceClient
            .from("gmail_application_events")
            .upsert(
              {
                user_id: user.id,
                application_id: null,
                gmail_message_id: message.id,
                gmail_thread_id: message.threadId || listed.threadId || null,
                event_type: classified.eventType,
                status: classified.status,
                confidence: classified.confidence,
                company,
                job_title: jobTitle,
                sender_name: from.name,
                sender_email: from.email,
                subject,
                snippet: message.snippet || null,
                received_at: receivedAt,
                processed_at: new Date().toISOString(),
                raw: {
                  labelIds: message.labelIds || [],
                  query,
                  bodyPreview: bodyText.slice(0, 2000),
                  skippedReason: "no_matched_application",
                },
              },
              { onConflict: "user_id,gmail_message_id" },
            );
          if (orphanEventError) throw orphanEventError;
          continue;
        }
      }

      classifiedCount += 1;
      let applicationId: string | null = matched.id;

      const shouldUpdate = shouldUpdateStatus(matched.status, classified.status);
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        provider_status: `gmail:${classified.eventType}`,
      };
      if (classified.nextStep) patch.next_step = classified.nextStep;
      if (shouldUpdate && classified.status && classified.canonicalStage) {
        patch.status = classified.status;
        patch.canonical_stage = classified.canonicalStage;
      }

      if (Object.keys(patch).length > 2 || shouldUpdate) {
        const { error: updateError } = await serviceClient
          .from("applications")
          .update(patch)
          .eq("id", matched.id)
          .eq("user_id", user.id);
        if (updateError) throw updateError;

        if (shouldUpdate && classified.status) {
          matched.status = classified.status;
          matched.canonical_stage = classified.canonicalStage || matched.canonical_stage;
        }
        updatedCount += shouldUpdate ? 1 : 0;

        if (matched.job_id && classified.canonicalStage) {
          await serviceClient
            .from("jobs")
            .update({
              canonical_status: classified.canonicalStage,
              updated_at: new Date().toISOString(),
            })
            .eq("id", matched.job_id)
            .eq("user_id", user.id);
        }
      }

      const { data: eventRow, error: eventError } = await serviceClient
        .from("gmail_application_events")
        .upsert(
          {
            user_id: user.id,
            application_id: applicationId,
            gmail_message_id: message.id,
            gmail_thread_id: message.threadId || listed.threadId || null,
            event_type: classified.eventType,
            status: classified.status,
            confidence: classified.confidence,
            company,
            job_title: jobTitle,
            sender_name: from.name,
            sender_email: from.email,
            subject,
            snippet: message.snippet || null,
            received_at: receivedAt,
            processed_at: new Date().toISOString(),
            raw: {
              labelIds: message.labelIds || [],
              query,
              bodyPreview: bodyText.slice(0, 2000),
            },
          },
          { onConflict: "user_id,gmail_message_id" },
        )
        .select("id")
        .single();
      if (eventError) throw eventError;

      await createNotification(
        serviceClient,
        user.id,
        classified,
        company,
        jobTitle,
        {
          applicationId,
          eventId: typeof eventRow?.id === "string" ? eventRow.id : null,
          gmailMessageId: message.id,
          gmailThreadId: message.threadId || listed.threadId || null,
          subject,
          senderName: from.name,
          senderEmail: from.email,
          snippet: message.snippet || null,
          receivedAt,
        },
      );

      events.push({
        messageId: message.id,
        eventType: classified.eventType,
        status: classified.status,
        company,
        jobTitle,
        confidence: classified.confidence,
        applicationId,
        receivedAt,
      });
    }

    const { error: syncUpdateError } = await serviceClient
      .from("gmail_connections")
      .update({
        last_sync_at: new Date().toISOString(),
        sync_history_id: latestHistoryId || (connection as GmailConnection).sync_history_id,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);
    if (syncUpdateError) throw syncUpdateError;

    await recordFeatureUsage({
      userId: user.id,
      featureKey: "sync_gmail_application_events",
      serviceClient,
      subscriptionTier,
      metadata: {
        scanned: list.length,
        classified: classifiedCount,
        updated: updatedCount,
      },
    });

    return jsonResponse(
      {
        ok: true,
        query,
        scanned: list.length,
        classified: classifiedCount,
        created: createdCount,
        updated: updatedCount,
        skippedExisting: skippedExistingCount,
        skippedNoMatch: skippedNoMatchCount,
        events,
      },
      200,
      corsHeaders,
    );
  } catch (error) {
    if (error instanceof SubscriptionAccessError) {
      return subscriptionErrorResponse(error, corsHeaders);
    }
    console.error("sync-gmail-application-events error", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Gmail sync failed" },
      500,
      corsHeaders,
    );
  }
});
