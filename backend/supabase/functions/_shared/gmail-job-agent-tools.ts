/**
 * Gmail helpers for the AI agent: job-related search, draft, send and label,
 * with server-side guardrails.
 *
 * Transport is Composio (the same connected account Settings → Integrations
 * manages). It previously used JobRaker's own OAuth tokens in
 * `gmail_connections`, which meant the Settings card could read "Connected"
 * while the agent reported "unauthorized".
 *
 * The guardrails are unchanged and remain server-side:
 *  - search uses a fixed job-related Gmail query; callers may only AND a
 *    sanitized refinement onto it, never replace it
 *  - outbound mail must pass a blocklist and clear a job-signal threshold
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ComposioGmailError,
  composioGmailAddLabel,
  composioGmailBatchModify,
  composioGmailCreateDraft,
  composioGmailFetchEmails,
  composioGmailFetchMessageById,
  composioGmailFetchThreadById,
  composioGmailGetAttachment,
  composioGmailGetDraft,
  composioGmailListSendAs,
  composioGmailResolveLabelId,
  composioGmailSendDraft,
  composioGmailSendEmail,
  decodeBase64Url,
  getComposioGmailConnection,
  getMessageEpochMs,
  gmailNotConnectedResult,
  isMessageWithinCutoff,
  type ComposioGmailMessage,
  type GmailPayload,
  type GmailSendAsIdentity,
} from "./composio-gmail.ts";

const decoder = new TextDecoder();

/** Same intent as sync-gmail-application-events DEFAULT_QUERY — job pipeline only. */
const JOB_EMAIL_GMAIL_QUERY_CORE = [
  "newer_than:120d",
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

const REFINE_ALLOWED = /^[a-zA-Z0-9\s@."':\-_]+$/;

function sanitizeRefine(refine: unknown): string | null {
  if (typeof refine !== "string") return null;
  const t = refine.trim();
  if (!t || t.length > 120) return null;
  if (!REFINE_ALLOWED.test(t)) return null;
  return t;
}

function buildJobQuery(refine: unknown) {
  const clean = sanitizeRefine(refine);
  return clean
    ? `(${JOB_EMAIL_GMAIL_QUERY_CORE}) (${clean})`
    : JOB_EMAIL_GMAIL_QUERY_CORE;
}

/* ------------------------------ body extraction ----------------------------- */

function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
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

function stripHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function payloadToPlainPreview(
  payload: GmailPayload | undefined,
  maxChars: number,
) {
  if (!payload) return "";
  const chunks: string[] = [];
  function visit(part: GmailPayload) {
    const mimeType = (part.mimeType || "").toLowerCase();
    const decoded = decodeBase64Url(part.body?.data);
    if (decoded) {
      if (mimeType.includes("text/html")) chunks.push(stripHtml(decoded));
      else if (!mimeType || mimeType.includes("text/plain")) {
        chunks.push(decoded);
      }
    }
    for (const child of part.parts || []) visit(child);
  }
  visit(payload);
  return chunks.join("\n").replace(/\s+\n/g, "\n").trim().slice(0, maxChars);
}

export function getHeader(payload: GmailPayload | undefined, name: string) {
  const target = name.toLowerCase();
  return payload?.headers?.find((h) => h.name?.toLowerCase() === target)
    ?.value ?? "";
}

/** Prefers Composio's pre-extracted fields, falling back to raw payload parsing. */
function messageSubject(message: ComposioGmailMessage) {
  return message.subject || getHeader(message.payload, "Subject");
}

function messageFrom(message: ComposioGmailMessage) {
  return message.from || getHeader(message.payload, "From");
}

function messageDate(message: ComposioGmailMessage) {
  return message.date || getHeader(message.payload, "Date");
}

function messageBodyPreview(message: ComposioGmailMessage, maxChars = 1200) {
  const fromPayload = payloadToPlainPreview(message.payload, maxChars);
  if (fromPayload) return fromPayload;
  const text = message.messageText || "";
  return stripHtml(text).slice(0, maxChars);
}

/* -------------------------------- guardrails -------------------------------- */

const JOB_SIGNAL_WORDS = [
  "job",
  "application",
  "applied",
  "applying",
  "interview",
  "interviewing",
  "position",
  "role",
  "offer",
  "recruiter",
  "recruiting",
  "recruitment",
  "hiring",
  "career",
  "careers",
  "resume",
  "cv",
  "candidate",
  "requisition",
  "screen",
  "screening",
  "assessment",
  "thank you",
  "thanks",
  "follow up",
  "follow-up",
  "following up",
  "company",
  "team",
  "onboarding",
  "compensation",
  "salary",
  "withdraw",
  "rejection",
  "schedule",
  "scheduling",
  "opportunity",
  "opportunities",
  "intro",
  "introduction",
  "introducing",
  "connect",
  "connecting",
  "reach",
  "reaching",
  "touch base",
  "inquire",
  "inquiry",
  "inquiries",
  "interest",
  "interested",
  "discuss",
  "discussing",
  "discussion",
  "conversation",
  "chat",
  "profile",
  "background",
  "experience",
  "skills",
  "portfolio",
  "work",
  "hired",
  "talent",
  "sourcing",
  "outreach",
  "networking",
  "referral",
  "referrals",
  "update",
  "feedback",
  "status",
  "portal",
  "posting",
  "postings",
  "vacancy",
  "vacancies",
  "opening",
  "openings",
  "submit",
  "submitted",
  "submission",
  "letter",
  "cover letter",
  "attached",
  "attachment",
  "availab",
  "regards",
  "sincerely",
  "best",
];

const OUTBOUND_BLOCKLIST = [
  "password",
  "bitcoin",
  "crypto wallet",
  "lottery",
  "viagra",
  "invoice attached",
  "wire transfer",
  "social security",
];

function countJobSignals(text: string) {
  const lower = text.toLowerCase();
  let n = 0;
  for (const w of JOB_SIGNAL_WORDS) {
    if (lower.includes(w)) n += 1;
  }
  return n;
}

function looksBlocked(text: string) {
  const lower = text.toLowerCase();
  return OUTBOUND_BLOCKLIST.some((b) => lower.includes(b));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateJobEmailDraft(
  args: {
    to?: string;
    subject?: string;
    body?: string;
    cc?: string;
    bcc?: string;
    is_html?: boolean;
    from?: string;
    attachment?: unknown;
  },
) {
  const to = typeof args.to === "string" ? args.to.trim() : "";
  const cc = typeof args.cc === "string" ? args.cc.trim() : undefined;
  const bcc = typeof args.bcc === "string" ? args.bcc.trim() : undefined;
  const from = typeof args.from === "string" ? args.from.trim() : undefined;
  const subject = typeof args.subject === "string" ? args.subject.trim() : "";
  const body = typeof args.body === "string" ? args.body.trim() : "";
  const is_html = Boolean(args.is_html);

  // Pitfall: 400 validation errors occur if recipients are missing or empty
  if (!to || !EMAIL_RE.test(to)) {
    return {
      ok: false as const,
      error: "Invalid recipient email ('to' must be a valid email address).",
      code: "invalid_to",
    };
  }
  if (cc && !EMAIL_RE.test(cc)) {
    return {
      ok: false as const,
      error: "Invalid CC recipient email.",
      code: "invalid_cc",
    };
  }
  if (bcc && !EMAIL_RE.test(bcc)) {
    return {
      ok: false as const,
      error: "Invalid BCC recipient email.",
      code: "invalid_bcc",
    };
  }
  // Pitfall: 400 validation error if both subject and body are omitted
  if (!subject || subject.length > 250) {
    return {
      ok: false as const,
      error: "Subject is required (max 250 characters).",
      code: "invalid_subject",
    };
  }
  if (body.length < 5 || body.length > 25_000) {
    return {
      ok: false as const,
      error: "Body must be between 5 and 25000 characters.",
      code: "invalid_body",
    };
  }

  const combined = `${subject}\n${body}`;
  if (looksBlocked(combined)) {
    return {
      ok: false as const,
      error:
        "This message was blocked because it matched non-job safety rules. Only professional job-related email is allowed.",
      code: "content_blocked",
    };
  }
  if (countJobSignals(combined) < 1) {
    return {
      ok: false as const,
      error:
        "Email must relate to your job search, networking, or professional outreach (e.g. mention role, company, interview, application, or recruiter).",
      code: "not_job_related",
    };
  }

  return { ok: true as const, to, cc, bcc, from, subject, body, is_html, attachment: args.attachment };
}

function sanitizeLabelName(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name) return "JobRaker/Applications";
  return name.replace(/[^\w\s/:-]/g, "").slice(0, 60) ||
    "JobRaker/Applications";
}

/** Maps a thrown Composio failure onto the agent's result contract. */
function composioFailure(error: unknown, fallbackCode: string) {
  if (error instanceof ComposioGmailError) {
    if (error.code === "gmail_unauthorized") {
      return {
        success: false,
        error:
          "Gmail authorization was rejected by Google. Reconnect Gmail in Settings → Integrations.",
        code: "gmail_unauthorized",
      };
    }
    return { success: false, error: error.message, code: error.code };
  }
  return {
    success: false,
    error: error instanceof Error ? error.message : String(error),
    code: fallbackCode,
  };
}

/* ------------------------------- agent tools -------------------------------- */

/**
 * `_serviceClient` is retained so the ai-chat call sites keep a stable
 * signature; Gmail credentials now live in Composio, not in our database.
 */
export async function agentSearchJobRelatedEmails(
  _serviceClient: SupabaseClient,
  userId: string,
  args: { max_results?: number; refine_query?: string },
) {
  const connection = await getComposioGmailConnection(userId);
  if (!connection.connected) return gmailNotConnectedResult(connection);

  const max = Math.max(
    1,
    Math.min(15, Math.floor(Number(args.max_results) || 8)),
  );
  const q = buildJobQuery(args.refine_query);

  try {
    const { messages } = await composioGmailFetchEmails(userId, {
      query: q,
      maxResults: max,
      includePayload: true,
    });

    const summaries = messages.map((message) => ({
      id: message.id,
      threadId: message.threadId,
      subject: messageSubject(message),
      from: messageFrom(message),
      date: messageDate(message),
      snippet: message.snippet,
      bodyPreview: messageBodyPreview(message),
    }));

    return {
      success: true,
      connectedAs: connection.identifier,
      queryUsed: q,
      count: summaries.length,
      messages: summaries,
    };
  } catch (error) {
    return composioFailure(error, "gmail_api_error");
  }
}

export async function agentCreateJobRelatedDraft(
  _serviceClient: SupabaseClient,
  userId: string,
  args: {
    to?: string;
    subject?: string;
    body?: string;
    cc?: string;
    bcc?: string;
    is_html?: boolean;
    from?: string;
    attachment?: unknown;
  },
) {
  const validated = validateJobEmailDraft(args);
  if (!validated.ok) {
    return { success: false, error: validated.error, code: validated.code };
  }

  const connection = await getComposioGmailConnection(userId);
  if (!connection.connected) return gmailNotConnectedResult(connection);

  try {
    const draft = await composioGmailCreateDraft(userId, {
      to: validated.to,
      subject: validated.subject,
      body: validated.body,
      cc: validated.cc,
      bcc: validated.bcc,
      is_html: validated.is_html,
      from: validated.from,
      attachment: validated.attachment,
    });

    return {
      success: true,
      draftId: draft.draftId,
      messageId: draft.messageId,
      threadId: draft.threadId,
      draftFrom: validated.from || connection.identifier,
      to: validated.to,
      subject: validated.subject,
      body: validated.body,
    };
  } catch (error) {
    return composioFailure(error, "gmail_draft_failed");
  }
}

export async function agentSendJobRelatedEmail(
  _serviceClient: SupabaseClient,
  userId: string,
  args: {
    to?: string;
    subject?: string;
    body?: string;
    cc?: string;
    bcc?: string;
    is_html?: boolean;
    from?: string;
    attachment?: unknown;
  },
) {
  const validated = validateJobEmailDraft(args);
  if (!validated.ok) {
    return { success: false, error: validated.error, code: validated.code };
  }

  const connection = await getComposioGmailConnection(userId);
  if (!connection.connected) return gmailNotConnectedResult(connection);

  try {
    const sent = await composioGmailSendEmail(userId, {
      to: validated.to,
      subject: validated.subject,
      body: validated.body,
      cc: validated.cc,
      bcc: validated.bcc,
      is_html: validated.is_html,
      from: validated.from,
      attachment: validated.attachment,
    });

    return {
      success: true,
      messageId: sent.messageId,
      threadId: sent.threadId,
      sentFrom: validated.from || connection.identifier,
      to: validated.to,
      subject: validated.subject,
      body: validated.body,
    };
  } catch (error) {
    return composioFailure(error, "gmail_send_failed");
  }
}

export async function agentListSendAsIdentities(
  _serviceClient: SupabaseClient,
  userId: string,
) {
  const connection = await getComposioGmailConnection(userId);
  if (!connection.connected) return gmailNotConnectedResult(connection);

  try {
    const { sendAs } = await composioGmailListSendAs(userId);
    return {
      success: true,
      connectedAs: connection.identifier,
      identities: sendAs,
    };
  } catch (error) {
    return composioFailure(error, "gmail_list_send_as_failed");
  }
}

export async function agentGetJobRelatedDraft(
  _serviceClient: SupabaseClient,
  userId: string,
  args: { draft_id?: string },
) {
  const draftId = typeof args.draft_id === "string" ? args.draft_id.trim() : "";
  if (!draftId) {
    return { success: false, error: "draft_id is required", code: "missing_draft_id" };
  }

  const connection = await getComposioGmailConnection(userId);
  if (!connection.connected) return gmailNotConnectedResult(connection);

  try {
    const draft = await composioGmailGetDraft(userId, draftId);
    return {
      success: true,
      draft,
    };
  } catch (error) {
    return composioFailure(error, "gmail_get_draft_failed");
  }
}

export async function agentSendJobRelatedDraft(
  _serviceClient: SupabaseClient,
  userId: string,
  args: { draft_id?: string },
) {
  const draftId = typeof args.draft_id === "string" ? args.draft_id.trim() : "";
  if (!draftId) {
    return { success: false, error: "draft_id is required (GMAIL_SEND_DRAFT requires the draft identifier, not the message identifier).", code: "missing_draft_id" };
  }

  const connection = await getComposioGmailConnection(userId);
  if (!connection.connected) return gmailNotConnectedResult(connection);

  try {
    const sent = await composioGmailSendDraft(userId, draftId);
    return {
      success: true,
      messageId: sent.messageId,
      threadId: sent.threadId,
      sentFrom: connection.identifier,
      draftId,
    };
  } catch (error) {
    return composioFailure(error, "gmail_send_draft_failed");
  }
}

export async function agentFetchMessageMetadata(
  _serviceClient: SupabaseClient,
  userId: string,
  args: { message_id?: string },
) {
  const messageId = typeof args.message_id === "string" ? args.message_id.trim() : "";
  if (!messageId) {
    return { success: false, error: "message_id is required", code: "missing_message_id" };
  }

  const connection = await getComposioGmailConnection(userId);
  if (!connection.connected) return gmailNotConnectedResult(connection);

  try {
    const message = await composioGmailFetchMessageById(userId, messageId);
    return {
      success: true,
      message,
    };
  } catch (error) {
    return composioFailure(error, "gmail_fetch_message_failed");
  }
}

export async function agentLabelJobRelatedEmails(
  _serviceClient: SupabaseClient,
  userId: string,
  args: {
    message_ids?: string[];
    refine_query?: string;
    max_results?: number;
    label_name?: string;
  },
) {
  const connection = await getComposioGmailConnection(userId);
  if (!connection.connected) return gmailNotConnectedResult(connection);

  const labelName = sanitizeLabelName(args.label_name);

  try {
    let ids = Array.isArray(args.message_ids)
      ? args.message_ids.filter((id) => typeof id === "string" && id.trim())
      : [];

    // No explicit ids: fall back to the same fixed job-related query so the
    // agent can never label arbitrary personal mail.
    if (!ids.length) {
      const max = Math.max(
        1,
        Math.min(25, Math.floor(Number(args.max_results) || 10)),
      );
      const { messages } = await composioGmailFetchEmails(userId, {
        query: buildJobQuery(args.refine_query),
        maxResults: max,
        includePayload: false,
      });
      ids = messages.map((message) => message.id);
    }

    const labelId = await composioGmailResolveLabelId(userId, labelName);
    if (!labelId) {
      return {
        success: false,
        error: "Gmail label could not be resolved.",
        code: "gmail_label_missing",
      };
    }

    if (!ids.length) {
      return {
        success: true,
        labelId,
        labelName,
        labeledCount: 0,
        messageIds: [],
      };
    }

    const { labeled, failed } = await composioGmailAddLabel(
      userId,
      ids,
      labelId,
    );

    if (labeled.length === 0) {
      return {
        success: false,
        error: "Gmail label apply failed for every message.",
        code: "gmail_label_apply_failed",
        failed,
      };
    }

    return {
      success: true,
      labelId,
      labelName,
      labeledCount: labeled.length,
      messageIds: labeled,
      ...(failed.length ? { failed } : {}),
    };
  } catch (error) {
    return composioFailure(error, "gmail_label_apply_failed");
  }
}

export interface FetchEmailsByPeriodArgs {
  query?: string;
  time_period?: string;
  after?: string;
  before?: string;
  newer_than?: string;
  max_results?: number;
  page_token?: string;
  include_payload?: boolean;
  verbose?: boolean;
}

export function buildTimePeriodQuery(args: FetchEmailsByPeriodArgs): {
  query: string;
  startUtcEpochMs?: number;
  endUtcEpochMs?: number;
  isRolling: boolean;
} {
  const parts: string[] = [];
  let startUtcEpochMs: number | undefined;
  let endUtcEpochMs: number | undefined;
  let isRolling = false;

  const now = new Date();

  const period = args.time_period ? args.time_period.toLowerCase().trim() : null;
  if (period === "today") {
    const todayStr = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${String(now.getUTCDate()).padStart(2, "0")}`;
    parts.push(`after:${todayStr}`);
    startUtcEpochMs = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).getTime();
  } else if (period === "yesterday") {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yStr = `${yesterday.getUTCFullYear()}/${String(yesterday.getUTCMonth() + 1).padStart(2, "0")}/${String(yesterday.getUTCDate()).padStart(2, "0")}`;
    const todayStr = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${String(now.getUTCDate()).padStart(2, "0")}`;
    parts.push(`after:${yStr} before:${todayStr}`);
    startUtcEpochMs = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate())).getTime();
    endUtcEpochMs = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).getTime();
  } else if (period === "last_7_days" || period === "7d") {
    parts.push("newer_than:7d");
    startUtcEpochMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    isRolling = true;
  } else if (period === "last_14_days" || period === "14d") {
    parts.push("newer_than:14d");
    startUtcEpochMs = now.getTime() - 14 * 24 * 60 * 60 * 1000;
    isRolling = true;
  } else if (period === "last_30_days" || period === "30d") {
    parts.push("newer_than:30d");
    startUtcEpochMs = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    isRolling = true;
  } else if (period === "last_90_days" || period === "90d") {
    parts.push("newer_than:90d");
    startUtcEpochMs = now.getTime() - 90 * 24 * 60 * 60 * 1000;
    isRolling = true;
  }

  if (args.newer_than) {
    const cleanNewer = args.newer_than.trim();
    if (/^\d+[dhmy]$/.test(cleanNewer)) {
      parts.push(`newer_than:${cleanNewer}`);
      isRolling = true;
    }
  }

  if (args.after) {
    const afterClean = args.after.trim().replace(/-/g, "/");
    parts.push(`after:${afterClean}`);
    const parsed = Date.parse(args.after);
    if (!Number.isNaN(parsed)) startUtcEpochMs = parsed;
  }

  if (args.before) {
    const beforeClean = args.before.trim().replace(/-/g, "/");
    parts.push(`before:${beforeClean}`);
    const parsed = Date.parse(args.before);
    if (!Number.isNaN(parsed)) endUtcEpochMs = parsed;
  }

  if (args.query && typeof args.query === "string") {
    const cleanQ = args.query.trim();
    if (cleanQ) parts.push(cleanQ);
  }

  if (parts.length === 0) {
    parts.push("newer_than:30d");
    startUtcEpochMs = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    isRolling = true;
  }

  return {
    query: parts.join(" "),
    startUtcEpochMs,
    endUtcEpochMs,
    isRolling,
  };
}

export async function agentFetchEmailsByPeriod(
  _serviceClient: SupabaseClient,
  userId: string,
  args: FetchEmailsByPeriodArgs = {},
) {
  const connection = await getComposioGmailConnection(userId);
  if (!connection.connected) return gmailNotConnectedResult(connection);

  const { query, startUtcEpochMs, endUtcEpochMs } = buildTimePeriodQuery(args);
  const maxResults = Math.min(Math.max(1, Number(args.max_results || 15)), 50);

  try {
    // Step 2: Retrieve first page using GMAIL_FETCH_EMAILS (include_payload=false, verbose=false, practical max_results)
    let fetchResult = await composioGmailFetchEmails(userId, {
      query,
      maxResults,
      includePayload: args.include_payload === true,
      verbose: args.verbose === true,
      pageToken: args.page_token,
    });

    // Step 7 Fallback: If results are unexpectedly empty and constraints were strict, retry with broader window
    if (fetchResult.messages.length === 0 && (args.after || args.before || args.time_period)) {
      const broaderQuery = args.query ? args.query.trim() : "newer_than:60d";
      if (broaderQuery !== query) {
        try {
          const retryResult = await composioGmailFetchEmails(userId, {
            query: broaderQuery,
            maxResults,
            includePayload: args.include_payload === true,
            verbose: false,
          });
          if (retryResult.messages.length > 0) {
            fetchResult = retryResult;
          }
        } catch {
          // ignore retry error and keep original result
        }
      }
    }

    // Step 3: Deduplicate by messageId
    const seen = new Set<string>();
    const deduplicated: ComposioGmailMessage[] = [];
    for (const msg of fetchResult.messages) {
      if (!seen.has(msg.id)) {
        seen.add(msg.id);
        deduplicated.push(msg);
      }
    }

    // Step 4: Validate/filter each item by messageTimestamp/internalDate against intended UTC cutoff
    const filtered = deduplicated.filter((msg) =>
      isMessageWithinCutoff(msg, { startUtcEpochMs, endUtcEpochMs })
    );

    const formattedMessages = filtered.map((msg) => ({
      id: msg.id,
      threadId: msg.threadId,
      date: msg.date || msg.internalDate,
      from: msg.from,
      subject: msg.subject,
      snippet: msg.snippet,
    }));

    return {
      success: true,
      messages: formattedMessages,
      // Pitfall 1: nextPageToken may be an empty string; falsey treated as null
      nextPageToken: fetchResult.nextPageToken,
      totalCount: formattedMessages.length,
      queryUsed: query,
      hasMore: Boolean(fetchResult.nextPageToken),
    };
  } catch (error) {
    return composioFailure(error, "gmail_fetch_emails_failed");
  }
}

export async function agentFetchThreadContext(
  _serviceClient: SupabaseClient,
  userId: string,
  args: { thread_id?: string },
) {
  const threadId = typeof args.thread_id === "string" ? args.thread_id.trim() : "";
  if (!threadId) {
    return { success: false, error: "thread_id is required", code: "missing_thread_id" };
  }

  const connection = await getComposioGmailConnection(userId);
  if (!connection.connected) return gmailNotConnectedResult(connection);

  try {
    const thread = await composioGmailFetchThreadById(userId, threadId);
    return {
      success: true,
      thread,
    };
  } catch (error) {
    return composioFailure(error, "gmail_fetch_thread_failed");
  }
}

export async function agentGetEmailAttachment(
  _serviceClient: SupabaseClient,
  userId: string,
  args: { message_id?: string; attachment_id?: string },
) {
  const messageId = typeof args.message_id === "string" ? args.message_id.trim() : "";
  const attachmentId = typeof args.attachment_id === "string" ? args.attachment_id.trim() : "";
  if (!messageId || !attachmentId) {
    return {
      success: false,
      error: "message_id and attachment_id are both required",
      code: "missing_attachment_params",
    };
  }

  const connection = await getComposioGmailConnection(userId);
  if (!connection.connected) return gmailNotConnectedResult(connection);

  try {
    const attachment = await composioGmailGetAttachment(userId, {
      messageId,
      attachmentId,
    });
    return {
      success: true,
      attachment,
    };
  } catch (error) {
    return composioFailure(error, "gmail_get_attachment_failed");
  }
}

export async function agentBatchModifyEmails(
  _serviceClient: SupabaseClient,
  userId: string,
  args: {
    message_ids?: string[];
    add_label_ids?: string[];
    remove_label_ids?: string[];
  },
) {
  const messageIds = Array.isArray(args.message_ids)
    ? args.message_ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];

  if (messageIds.length === 0) {
    return {
      success: false,
      error: "message_ids must contain at least one message ID",
      code: "missing_message_ids",
    };
  }

  const connection = await getComposioGmailConnection(userId);
  if (!connection.connected) return gmailNotConnectedResult(connection);

  try {
    const result = await composioGmailBatchModify(userId, {
      messageIds,
      addLabelIds: Array.isArray(args.add_label_ids) ? args.add_label_ids : [],
      removeLabelIds: Array.isArray(args.remove_label_ids) ? args.remove_label_ids : [],
    });
    return {
      success: true,
      modifiedCount: result.modifiedCount,
      messageIds,
    };
  } catch (error) {
    return composioFailure(error, "gmail_batch_modify_failed");
  }
}
