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
  composioGmailGetProfile,
  composioGmailGetSendAs,
  composioGmailListLabels,
  composioGmailListSendAs,
  composioGmailListThreads,
  composioGmailReplyToThread,
  composioGmailResolveLabelId,
  composioGmailSendDraft,
  composioGmailSendEmail,
  buildSubjectSenderQuery,
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
    // Pitfall 5: Hydration can return 404 NOT_FOUND for stale/inaccessible IDs; refresh IDs via fetch_gmail_emails_by_period
    const msg = error instanceof Error ? error.message : String(error);
    if (/404|not_found|not found/i.test(msg)) {
      return {
        success: false,
        error: "Message not found or ID is stale. Refresh message IDs via fetch_gmail_emails_by_period before retrying.",
        code: "gmail_message_not_found",
      };
    }
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
  start_date?: string;
  end_date?: string;
  date_range?: { start_date?: string; end_date?: string };
  newer_than?: string;
  category?: string;
  categories?: string[];
  label_name?: string;
  label_ids?: string[];
  max_results?: number;
  page_token?: string;
  include_payload?: boolean;
  verbose?: boolean;
  validate_profile?: boolean;
  use_thread_fallback?: boolean;
  top_n?: number;
  sort_newest?: boolean;
  max_pages?: number;
  hydrate_count?: number;
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

  const afterValue = args.after || args.start_date || args.date_range?.start_date;
  if (afterValue) {
    const afterClean = afterValue.trim().replace(/-/g, "/");
    parts.push(`after:${afterClean}`);
    const parsed = Date.parse(afterValue);
    if (!Number.isNaN(parsed)) startUtcEpochMs = parsed;
  }

  const beforeValue = args.before || args.end_date || args.date_range?.end_date;
  if (beforeValue) {
    const beforeClean = beforeValue.trim().replace(/-/g, "/");
    parts.push(`before:${beforeClean}`);
    const parsed = Date.parse(beforeValue);
    if (!Number.isNaN(parsed)) endUtcEpochMs = parsed;
  }

  const catList = [
    ...(args.category ? [args.category] : []),
    ...(Array.isArray(args.categories) ? args.categories : []),
  ];
  for (const cat of catList) {
    const cleanCat = String(cat).toLowerCase().trim();
    if (cleanCat) parts.push(`category:${cleanCat}`);
  }

  if (args.label_name && typeof args.label_name === "string") {
    const cleanLabel = args.label_name.trim();
    if (cleanLabel) parts.push(`label:${cleanLabel}`);
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

  // Step 1 (Optional): If mailbox identity/scopes are uncertain, validate access using GMAIL_GET_PROFILE
  let profileInfo = null;
  if (args.validate_profile) {
    try {
      profileInfo = await composioGmailGetProfile(userId);
    } catch (profileError) {
      console.warn("[composio-gmail] profile validation warning:", profileError);
    }
  }

  // Step 2 (Optional / Step 5): If filtering by label name and label_ids is not passed, resolve label ID
  let resolvedLabelIds = args.label_ids ? [...args.label_ids] : [];
  if (args.label_name && resolvedLabelIds.length === 0) {
    try {
      const resolvedId = await composioGmailResolveLabelId(userId, args.label_name);
      if (resolvedId) resolvedLabelIds.push(resolvedId);
    } catch {
      // ignore and rely on query label:<name>
    }
  }

  const { query, startUtcEpochMs, endUtcEpochMs } = buildTimePeriodQuery(args);
  // Step 2: Metadata-first with include_payload=false and practical max_results up to 500
  const maxResults = Math.min(Math.max(1, Number(args.max_results || 20)), 500);

  try {
    // Step 2: Fetch lightweight first page using GMAIL_FETCH_EMAILS
    let fetchResult = await composioGmailFetchEmails(userId, {
      query,
      maxResults,
      includePayload: args.include_payload === true,
      verbose: args.verbose === true,
      pageToken: args.page_token,
      labelIds: resolvedLabelIds.length > 0 ? resolvedLabelIds : undefined,
    });

    // Step 3: Aggregate and deduplicate by messageId
    const seen = new Set<string>();
    const deduplicated: ComposioGmailMessage[] = [];
    for (const msg of fetchResult.messages) {
      if (!seen.has(msg.id)) {
        seen.add(msg.id);
        deduplicated.push(msg);
      }
    }

    // Step 3: Paginate with GMAIL_FETCH_EMAILS (page_token=nextPageToken) until nextPageToken is missing/empty or desired count reached
    let currentPage = 1;
    let nextToken = fetchResult.nextPageToken;
    const maxPages = Math.min(Math.max(1, Number(args.max_pages || 1)), 5);
    const targetCount = args.top_n ? Math.min(Math.max(1, Number(args.top_n)), 100) : 0;

    while (nextToken && (currentPage < maxPages || (targetCount > 0 && deduplicated.length < targetCount))) {
      try {
        const nextPageResult = await composioGmailFetchEmails(userId, {
          query,
          maxResults,
          includePayload: false,
          verbose: false,
          pageToken: nextToken,
          labelIds: resolvedLabelIds.length > 0 ? resolvedLabelIds : undefined,
        });
        currentPage++;
        for (const msg of nextPageResult.messages) {
          if (!seen.has(msg.id)) {
            seen.add(msg.id);
            deduplicated.push(msg);
          }
        }
        nextToken = nextPageResult.nextPageToken;
      } catch (pageErr) {
        console.warn("[composio-gmail] pagination warning:", pageErr);
        break;
      }
    }

    // Step 8 Fallback: If results are unexpectedly empty and constraints were strict, retry with broader window
    if (deduplicated.length === 0 && (args.after || args.before || args.time_period || args.start_date || args.end_date)) {
      const broaderQuery = args.query ? args.query.trim() : "newer_than:60d";
      if (broaderQuery !== query) {
        try {
          const retryResult = await composioGmailFetchEmails(userId, {
            query: broaderQuery,
            maxResults,
            includePayload: false,
            verbose: false,
          });
          for (const msg of retryResult.messages) {
            if (!seen.has(msg.id)) {
              seen.add(msg.id);
              deduplicated.push(msg);
            }
          }
          if (retryResult.nextPageToken) nextToken = retryResult.nextPageToken;
        } catch {
          // ignore retry error and keep original result
        }
      }
    }

    // Step 4: Validate/filter each item by messageTimestamp/internalDate against intended UTC cutoff
    let filtered = deduplicated.filter((msg) =>
      isMessageWithinCutoff(msg, { startUtcEpochMs, endUtcEpochMs })
    );

    // Step 4 (Optional): If you must guarantee newest-N/latest, sort aggregated listings client-side by internalDate/messageTimestamp and take top N
    if (args.sort_newest || args.top_n) {
      filtered.sort((a, b) => getMessageEpochMs(b) - getMessageEpochMs(a));
      if (args.top_n) {
        filtered = filtered.slice(0, Math.max(1, Number(args.top_n)));
      }
    }

    // Step 6 (Optional): If full headers/body are needed for selected items, hydrate chosen messages using GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID
    const hydrateCount = Math.min(Math.max(0, Number(args.hydrate_count || 0)), 10);
    const hydratedMap = new Map<string, any>();
    if (hydrateCount > 0) {
      const toHydrate = filtered.slice(0, hydrateCount);
      for (const item of toHydrate) {
        try {
          const details = await composioGmailFetchMessageById(userId, item.id);
          hydratedMap.set(item.id, details);
        } catch (hErr) {
          console.warn(`[composio-gmail] hydration error for message ${item.id}:`, hErr);
        }
      }
    }

    const formattedMessages = filtered.map((msg) => {
      const hydrated = hydratedMap.get(msg.id);
      return {
        id: msg.id,
        threadId: msg.threadId,
        date: msg.date || msg.internalDate,
        from: msg.from,
        subject: msg.subject,
        snippet: msg.snippet,
        ...(hydrated
          ? {
              body: hydrated.body,
              html: hydrated.html,
              to: hydrated.to,
              labelIds: hydrated.labelIds,
            }
          : {}),
      };
    });

    // Step 7 (Optional conversation context): If conversation context is needed or requested
    let threadsResult = null;
    if (args.use_thread_fallback) {
      try {
        threadsResult = await composioGmailListThreads(userId, {
          query,
          maxResults: Math.min(maxResults, 50),
        });
      } catch (threadErr) {
        console.warn("[composio-gmail] thread fallback listing error:", threadErr);
      }
    }

    return {
      success: true,
      messages: formattedMessages,
      // Pitfall 1: nextPageToken may be an empty string; falsey treated as null
      nextPageToken: nextToken,
      totalCount: formattedMessages.length,
      queryUsed: query,
      hasMore: Boolean(nextToken),
      ...(profileInfo ? { profile: profileInfo } : {}),
      ...(threadsResult ? { threads: threadsResult.threads } : {}),
    };
  } catch (error) {
    return composioFailure(error, "gmail_fetch_emails_failed");
  }
}

export async function agentFetchEmails(
  serviceClient: SupabaseClient,
  userId: string,
  args: FetchEmailsByPeriodArgs = {},
) {
  return agentFetchEmailsByPeriod(serviceClient, userId, args);
}

export async function agentGetGmailProfile(
  _serviceClient: SupabaseClient,
  userId: string,
) {
  const connection = await getComposioGmailConnection(userId);
  if (!connection.connected) return gmailNotConnectedResult(connection);

  try {
    const profile = await composioGmailGetProfile(userId);
    return {
      success: true,
      profile,
    };
  } catch (error) {
    return composioFailure(error, "gmail_get_profile_failed");
  }
}

export async function agentListGmailThreads(
  _serviceClient: SupabaseClient,
  userId: string,
  args: { query?: string; max_results?: number; page_token?: string } = {},
) {
  const connection = await getComposioGmailConnection(userId);
  if (!connection.connected) return gmailNotConnectedResult(connection);

  try {
    const result = await composioGmailListThreads(userId, {
      query: args.query,
      maxResults: args.max_results,
      pageToken: args.page_token,
    });
    return {
      success: true,
      threads: result.threads,
      nextPageToken: result.nextPageToken,
    };
  } catch (error) {
    return composioFailure(error, "gmail_list_threads_failed");
  }
}

export async function agentListGmailLabels(
  _serviceClient: SupabaseClient,
  userId: string,
) {
  const connection = await getComposioGmailConnection(userId);
  if (!connection.connected) return gmailNotConnectedResult(connection);

  try {
    const labels = await composioGmailListLabels(userId);
    return {
      success: true,
      labels,
    };
  } catch (error) {
    return composioFailure(error, "gmail_list_labels_failed");
  }
}

export interface CheckGmailConnectionStatusArgs {
  include_threads_crosscheck?: boolean;
  include_labels?: boolean;
  include_settings_send_as?: boolean;
  sample_size?: number;
}

export async function agentCheckGmailConnectionStatus(
  _serviceClient: SupabaseClient,
  userId: string,
  args: CheckGmailConnectionStatusArgs = {},
) {
  const connection = await getComposioGmailConnection(userId);
  if (!connection.connected) return gmailNotConnectedResult(connection);

  const sampleSize = Math.min(Math.max(1, Number(args.sample_size || 5)), 20);

  // Step 1: Confirm authentication and connected mailbox context using GMAIL_GET_PROFILE
  // Pitfall 1: 401/403 or 400 FAILED_PRECONDITION is non-retryable until connection/scopes are corrected
  // Pitfall 2: Frequent polling can trigger 403 userRateLimitExceeded or 429 rateLimitExceeded
  let profile: {
    emailAddress: string | null;
    messagesTotal: number;
    threadsTotal: number;
    historyId: string | null;
  };
  try {
    profile = await composioGmailGetProfile(userId);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const isAuthOrPrecondition = /401|403|FAILED_PRECONDITION|unauthorized|forbidden|scope/i.test(errorMsg);
    const isRateLimit = /429|rateLimitExceeded|userRateLimitExceeded/i.test(errorMsg);
    return {
      success: false,
      connected: false,
      step: "get_profile",
      error: isAuthOrPrecondition
        ? "Gmail authentication failed or scopes are insufficient (non-retryable). Please reconnect Gmail in Settings > Integrations."
        : isRateLimit
        ? "Gmail rate limit exceeded. Please wait with exponential backoff before checking again."
        : `Failed to confirm Gmail profile: ${errorMsg}`,
      code: isAuthOrPrecondition ? "gmail_auth_failed" : isRateLimit ? "gmail_rate_limit" : "gmail_profile_failed",
    };
  }

  // Step 2: Prove practical read/list access using GMAIL_FETCH_EMAILS
  // Pitfall 3: max_results is capped and payload-heavy options can create oversized responses; keep health checks IDs/metadata-first
  // Pitfall 4: nextPageToken may be returned even for tiny samples and can be empty string; treat empty/falsy as end-of-list
  // Pitfall 5: Non-verbose/lightweight modes may omit bodies; messages=[] or missing bodies is still healthy read access
  let readAccessVerified = false;
  let fetchResult: { messages: ComposioGmailMessage[]; nextPageToken: string | null } | null = null;
  let fetchError: string | null = null;

  try {
    fetchResult = await composioGmailFetchEmails(userId, {
      maxResults: sampleSize,
      includePayload: false,
      verbose: false,
    });
    readAccessVerified = true;
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
  }

  // Step 3 (Optional / Fallback): If GMAIL_FETCH_EMAILS fails or results look unexpectedly empty/inconsistent,
  // cross-check list/read behavior using GMAIL_LIST_THREADS
  let threadsCrossCheck: {
    success: boolean;
    threadsCount: number;
    error?: string;
  } | null = null;

  if (args.include_threads_crosscheck || !readAccessVerified) {
    try {
      const threadRes = await composioGmailListThreads(userId, {
        maxResults: sampleSize,
      });
      threadsCrossCheck = {
        success: true,
        threadsCount: threadRes.threads.length,
      };
      if (!readAccessVerified && threadRes.threads.length > 0) {
        readAccessVerified = true;
      }
    } catch (err) {
      threadsCrossCheck = {
        success: false,
        threadsCount: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // Step 4 (Optional): If label visibility/scoping needs debugging, enumerate labels using GMAIL_LIST_LABELS
  let labelsCheck: {
    success: boolean;
    labelsCount: number;
    labels?: Array<{ id: string; name: string; type: string }>;
    error?: string;
  } | null = null;

  if (args.include_labels) {
    try {
      const labels = await composioGmailListLabels(userId);
      labelsCheck = {
        success: true,
        labelsCount: labels.length,
        labels: labels.slice(0, 15),
      };
    } catch (err) {
      labelsCheck = {
        success: false,
        labelsCount: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // Step 5 (Optional): If verifying settings endpoints under current scopes, validate settings readability using GMAIL_SETTINGS_SEND_AS_GET
  let settingsSendAsCheck: {
    success: boolean;
    sendAsEmail?: string | null;
    isPrimary?: boolean;
    error?: string;
  } | null = null;

  if (args.include_settings_send_as) {
    try {
      const sendAs = await composioGmailGetSendAs(userId, profile.emailAddress ?? undefined);
      settingsSendAsCheck = {
        success: true,
        sendAsEmail: sendAs.sendAsEmail,
        isPrimary: sendAs.isPrimary,
      };
    } catch (err) {
      settingsSendAsCheck = {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return {
    success: true,
    connected: true,
    account: {
      canonicalEmail: profile.emailAddress,
      messagesTotal: profile.messagesTotal,
      threadsTotal: profile.threadsTotal,
    },
    readAccessVerified,
    sampleMessagesCount: fetchResult ? fetchResult.messages.length : 0,
    hasMorePages: Boolean(fetchResult?.nextPageToken),
    ...(fetchError ? { fetchError } : {}),
    ...(threadsCrossCheck ? { threadsCrossCheck } : {}),
    ...(labelsCheck ? { labelsCheck } : {}),
    ...(settingsSendAsCheck ? { settingsSendAsCheck } : {}),
  };
}

export async function agentGetGmailSettingsSendAs(
  _serviceClient: SupabaseClient,
  userId: string,
  args: { send_as_email?: string } = {},
) {
  const connection = await getComposioGmailConnection(userId);
  if (!connection.connected) return gmailNotConnectedResult(connection);

  try {
    const sendAs = await composioGmailGetSendAs(userId, args.send_as_email);
    return {
      success: true,
      sendAs,
    };
  } catch (error) {
    return composioFailure(error, "gmail_settings_send_as_failed");
  }
}

export interface FetchEmailRepliesOrThreadArgs {
  thread_id?: string;
  message_id?: string;
  query?: string;
  page_token?: string;
  max_results?: number;
  use_thread_discovery?: boolean;
  attachment_id?: string;
  account_context?: string;
}

export async function agentFetchThreadContext(
  _serviceClient: SupabaseClient,
  userId: string,
  args: FetchEmailRepliesOrThreadArgs = {},
) {
  const connection = await getComposioGmailConnection(userId);
  if (!connection.connected) return gmailNotConnectedResult(connection);

  const activeMailbox = args.account_context?.trim() || connection.identifier;

  // Step 6 (Optional attachment): Download attachment if requested
  if (args.attachment_id && args.message_id) {
    try {
      const attachment = await composioGmailGetAttachment(userId, {
        messageId: args.message_id,
        attachmentId: args.attachment_id,
      });
      return { success: true, connectedAs: activeMailbox, attachment };
    } catch (attErr) {
      return composioFailure(attErr, "gmail_get_attachment_failed");
    }
  }

  let resolvedThreadId = args.thread_id?.trim();

  // Step 1: If only message_id is known, resolve authoritative thread linkage using GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID
  if (!resolvedThreadId && args.message_id?.trim()) {
    try {
      const msgMeta = await composioGmailFetchMessageById(userId, args.message_id.trim());
      resolvedThreadId = msgMeta.threadId || undefined;
    } catch (err) {
      return composioFailure(err, "gmail_resolve_thread_from_message_failed");
    }
  }

  // Step 3 (Optional thread-first discovery): If thread-first discovery is preferred
  if (!resolvedThreadId && args.use_thread_discovery) {
    try {
      const threadsList = await composioGmailListThreads(userId, {
        query: args.query,
        maxResults: Math.min(Math.max(1, Number(args.max_results || 10)), 50),
        pageToken: args.page_token,
      });
      if (threadsList.threads.length > 0) {
        resolvedThreadId = threadsList.threads[0].id;
      }
    } catch (thErr) {
      console.warn("[composio-gmail] thread discovery error:", thErr);
    }
  }

  // Step 2: Discover candidate conversations using GMAIL_FETCH_EMAILS if thread_id still not known
  // (metadata-first; retain messageId+threadId; de-dupe by threadId; treat messages=[] as valid no-results)
  let candidateThreads: Array<{ threadId: string; messageId: string; subject: string; from: string; date: string; snippet: string }> = [];
  let nextPageToken: string | null = null;
  if (!resolvedThreadId) {
    try {
      const fetchResult = await composioGmailFetchEmails(userId, {
        query: args.query || "",
        maxResults: Math.min(Math.max(1, Number(args.max_results || 20)), 500),
        includePayload: false,
        verbose: false,
        pageToken: args.page_token,
      });
      nextPageToken = fetchResult.nextPageToken;
      const seenThreadIds = new Set<string>();
      for (const m of fetchResult.messages) {
        if (m.threadId && !seenThreadIds.has(m.threadId)) {
          seenThreadIds.add(m.threadId);
          candidateThreads.push({
            threadId: m.threadId,
            messageId: m.id,
            subject: m.subject || "",
            from: m.from || "",
            date: m.date || m.internalDate || "",
            snippet: m.snippet || "",
          });
        }
      }
      if (candidateThreads.length > 0) {
        resolvedThreadId = candidateThreads[0].threadId;
      }
    } catch (fetchErr) {
      return composioFailure(fetchErr, "gmail_discover_threads_failed");
    }
  }

  // If no thread was identified, treat as valid no-results
  if (!resolvedThreadId) {
    return {
      success: true,
      connectedAs: activeMailbox,
      count: 0,
      threads: [],
      nextPageToken,
      hasMore: Boolean(nextPageToken),
    };
  }

  // Step 4: Hydrate conversation using GMAIL_FETCH_MESSAGE_BY_THREAD_ID
  // (locate data.messages[] defensively; messages sorted client-side by timestamp)
  try {
    const threadData = await composioGmailFetchThreadById(userId, resolvedThreadId);
    return {
      success: true,
      connectedAs: activeMailbox,
      threadId: threadData.threadId,
      messageCount: threadData.messages.length,
      messages: threadData.messages,
      candidateThreads: candidateThreads.length > 1 ? candidateThreads : undefined,
      nextPageToken,
      hasMore: Boolean(nextPageToken),
    };
  } catch (error) {
    // Step 5 Fallback: If thread hydration fails, is partial/too large (HTTP 413), or returns notFound due to mailbox mismatch
    // Fall back to fetching specific messages via GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID
    if (args.message_id?.trim()) {
      try {
        const fallbackMsg = await composioGmailFetchMessageById(userId, args.message_id.trim());
        return {
          success: true,
          connectedAs: activeMailbox,
          threadId: resolvedThreadId,
          fallbackUsed: true,
          messageCount: 1,
          messages: [
            {
              id: fallbackMsg.id,
              snippet: fallbackMsg.snippet,
              from: fallbackMsg.from,
              to: fallbackMsg.to,
              subject: fallbackMsg.subject,
              date: fallbackMsg.date,
              body: fallbackMsg.body,
            },
          ],
        };
      } catch {
        // Continue to return original failure
      }
    }
    return composioFailure(error, "gmail_fetch_thread_failed");
  }
}

export const agentFetchEmailRepliesOrThread = agentFetchThreadContext;

export interface ReplyToThreadArgs {
  thread_id: string;
  to: string;
  subject: string;
  body: string;
  message_id?: string;
  cc?: string;
  bcc?: string;
  is_html?: boolean;
  from?: string;
  attachment?: unknown;
}

export async function agentReplyToThread(
  _serviceClient: SupabaseClient,
  userId: string,
  args: ReplyToThreadArgs,
) {
  const connection = await getComposioGmailConnection(userId);
  if (!connection.connected) return gmailNotConnectedResult(connection);

  const threadId = typeof args.thread_id === "string" ? args.thread_id.trim() : "";
  const to = typeof args.to === "string" ? args.to.trim() : "";
  const subject = typeof args.subject === "string" ? args.subject.trim() : "";
  const body = typeof args.body === "string" ? args.body.trim() : "";

  if (!threadId) {
    return { success: false, error: "thread_id is required to reply in-thread.", code: "missing_thread_id" };
  }
  if (!to) {
    return { success: false, error: "Recipient email ('to') is required to reply.", code: "missing_to" };
  }
  if (!body) {
    return { success: false, error: "Email body is required to reply.", code: "missing_body" };
  }

  // Ensure professional content and check blocklist
  if (looksBlocked(`${subject} ${body}`)) {
    return {
      success: false,
      error: "This reply was blocked because it matched safety rules.",
      code: "content_blocked",
    };
  }

  try {
    const result = await composioGmailReplyToThread(userId, {
      threadId,
      to,
      subject,
      body,
      messageId: args.message_id,
      cc: args.cc,
      bcc: args.bcc,
      isHtml: args.is_html,
      from: args.from,
      attachment: args.attachment,
    });
    return {
      success: true,
      sent: true,
      messageId: result.messageId,
      threadId: result.threadId,
    };
  } catch (error) {
    return composioFailure(error, "gmail_reply_thread_failed");
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

export interface SearchEmailsBySubjectSenderArgs {
  subject?: string;
  sender?: string;
  from?: string;
  query?: string;
  label_name?: string;
  label_ids?: string[];
  max_results?: number;
  page_token?: string;
  include_spam_trash?: boolean;
  hydrate_shortlist?: boolean;
  hydrate_count?: number;
  thread_id?: string;
  get_thread_context?: boolean;
  attachment_id?: string;
  message_id?: string;
}

export async function agentSearchEmailsBySubjectSender(
  _serviceClient: SupabaseClient,
  userId: string,
  args: SearchEmailsBySubjectSenderArgs = {},
) {
  const connection = await getComposioGmailConnection(userId);
  if (!connection.connected) return gmailNotConnectedResult(connection);

  // Step 7 (Optional attachment): If message_id and attachment_id are directly requested
  if (args.attachment_id && args.message_id) {
    try {
      const attachment = await composioGmailGetAttachment(userId, {
        messageId: args.message_id,
        attachmentId: args.attachment_id,
      });
      return { success: true, attachment };
    } catch (attErr) {
      return composioFailure(attErr, "gmail_get_attachment_failed");
    }
  }

  // Step 6 (Optional thread context): If thread_id is directly passed
  if (args.thread_id && args.get_thread_context) {
    try {
      const threadResult = await composioGmailFetchThreadById(userId, args.thread_id);
      return { success: true, thread: threadResult };
    } catch (thErr) {
      return composioFailure(thErr, "gmail_fetch_thread_failed");
    }
  }

  // Step 1 (Optional label resolution): If label-scoped search is intended and label IDs are unclear
  let resolvedLabelIds = args.label_ids ? [...args.label_ids] : [];
  if (args.label_name && resolvedLabelIds.length === 0) {
    try {
      const resolvedId = await composioGmailResolveLabelId(userId, args.label_name);
      if (resolvedId) resolvedLabelIds.push(resolvedId);
    } catch {
      // Avoid over-restricting the query
    }
  }

  // Step 2: Search using GMAIL_FETCH_EMAILS with a query combining sender and subject terms
  // Start lightweight (IDs/metadata only) and capture messageId/id plus threadId
  const primaryQuery = buildSubjectSenderQuery({
    subject: args.subject,
    sender: args.sender || args.from,
    query: args.query,
    includeSpamTrash: args.include_spam_trash,
    relaxed: false,
  });

  const maxResults = Math.min(Math.max(1, Number(args.max_results || 20)), 500);

  try {
    const fetchResult = await composioGmailFetchEmails(userId, {
      query: primaryQuery,
      maxResults,
      includePayload: false,
      verbose: false,
      pageToken: args.page_token,
      labelIds: resolvedLabelIds.length > 0 ? resolvedLabelIds : undefined,
    });

    const messages = fetchResult.messages;
    let usedQuery = primaryQuery;
    let fallbackUsed = false;

    // Step 3 (Optional pagination): If page_token is passed or completeness is requested
    const seen = new Set<string>();
    const deduplicated: ComposioGmailMessage[] = [];
    for (const msg of messages) {
      if (!seen.has(msg.id)) {
        seen.add(msg.id);
        deduplicated.push(msg);
      }
    }

    // Step 4 Fallback: If messages is empty or results are too broad, re-run with relaxed constraints
    // (Pitfall 1: messages can be [] even on a successful call; treat as a valid no-match state and adjust/relax query)
    if (deduplicated.length === 0 && (args.subject || args.sender || args.from)) {
      const relaxedQuery = buildSubjectSenderQuery({
        subject: args.subject,
        sender: undefined, // temporarily drop sender or relax subject
        query: args.query,
        includeSpamTrash: true, // optionally include spam/trash
        relaxed: true,
      });

      if (relaxedQuery && relaxedQuery !== primaryQuery) {
        try {
          const fallbackResult = await composioGmailFetchEmails(userId, {
            query: relaxedQuery,
            maxResults,
            includePayload: false,
            verbose: false,
            labelIds: resolvedLabelIds.length > 0 ? resolvedLabelIds : undefined,
          });
          if (fallbackResult.messages.length > 0) {
            for (const msg of fallbackResult.messages) {
              if (!seen.has(msg.id)) {
                seen.add(msg.id);
                deduplicated.push(msg);
              }
            }
            usedQuery = relaxedQuery;
            fallbackUsed = true;
          }
        } catch {
          // ignore fallback error and keep empty list
        }
      }
    }

    // Step 5 (Optional Hydration): Hydrate shortlisted hits using GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID
    // (metadata first; full content only when needed; Pitfall 4: ID fields vary (messageId vs id))
    const hydrateCount = args.hydrate_shortlist
      ? Math.min(Math.max(1, Number(args.hydrate_count || 5)), 10)
      : Math.min(Math.max(0, Number(args.hydrate_count || 0)), 10);

    const hydratedDetails = new Map<string, any>();
    if (hydrateCount > 0 && deduplicated.length > 0) {
      const shortlist = deduplicated.slice(0, hydrateCount);
      for (const item of shortlist) {
        try {
          const detail = await composioGmailFetchMessageById(userId, item.id);
          hydratedDetails.set(item.id, detail);
        } catch (hErr) {
          console.warn(`[composio-gmail] hydration error for messageId ${item.id}:`, hErr);
        }
      }
    }

    // Step 6 (Optional thread context for first message if get_thread_context is requested)
    let threadDetails = null;
    if (args.get_thread_context && deduplicated.length > 0 && deduplicated[0].threadId) {
      try {
        threadDetails = await composioGmailFetchThreadById(userId, deduplicated[0].threadId);
      } catch (thErr) {
        console.warn("[composio-gmail] thread context error:", thErr);
      }
    }

    const formattedList = deduplicated.map((m) => {
      const hydrated = hydratedDetails.get(m.id);
      return {
        id: m.id,
        threadId: m.threadId,
        subject: m.subject || hydrated?.subject,
        from: m.from || hydrated?.from,
        to: hydrated?.to,
        date: m.date || m.internalDate || hydrated?.date,
        snippet: m.snippet,
        ...(hydrated
          ? {
              body: hydrated.body,
              html: hydrated.html,
              labelIds: hydrated.labelIds,
            }
          : {}),
      };
    });

    return {
      success: true,
      count: formattedList.length,
      messages: formattedList,
      queryUsed: usedQuery,
      fallbackUsed,
      // Pitfall 2: nextPageToken may be "" at the end; treat empty/falsy as null
      nextPageToken: fetchResult.nextPageToken,
      hasMore: Boolean(fetchResult.nextPageToken),
      ...(threadDetails ? { thread: threadDetails } : {}),
    };
  } catch (error) {
    return composioFailure(error, "gmail_search_emails_failed");
  }
}

export interface FetchUnreadImportantEmailsArgs {
  max_results?: number;
  page_token?: string;
  query?: string;
  account_context?: string;
  label_ids?: string[];
  strict_filter?: boolean;
  sort_newest?: boolean;
  hydrate_shortlist?: boolean;
  hydrate_count?: number;
  get_thread_context?: boolean;
  thread_id?: string;
  attachment_id?: string;
  message_id?: string;
  mark_as_read?: boolean;
  add_label_ids?: string[];
  remove_label_ids?: string[];
  max_pages?: number;
}

export async function agentFetchUnreadImportantEmails(
  _serviceClient: SupabaseClient,
  userId: string,
  args: FetchUnreadImportantEmailsArgs = {},
) {
  const connection = await getComposioGmailConnection(userId);
  if (!connection.connected) return gmailNotConnectedResult(connection);

  // Step 1: Select intended mailbox context (avoid listing from wrong account)
  const activeMailbox = args.account_context?.trim() || connection.identifier;

  // Step 7 (Optional attachment): Download attachment if IDs are provided
  if (args.attachment_id && args.message_id) {
    try {
      const attachment = await composioGmailGetAttachment(userId, {
        messageId: args.message_id,
        attachmentId: args.attachment_id,
      });
      return { success: true, connectedAs: activeMailbox, attachment };
    } catch (attErr) {
      return composioFailure(attErr, "gmail_get_attachment_failed");
    }
  }

  // Step 5 (Optional thread context): Fetch conversation if thread_id is directly passed
  if (args.thread_id && args.get_thread_context) {
    try {
      const threadResult = await composioGmailFetchThreadById(userId, args.thread_id);
      return { success: true, connectedAs: activeMailbox, thread: threadResult };
    } catch (thErr) {
      return composioFailure(thErr, "gmail_fetch_thread_failed");
    }
  }

  // Step 2: Fetch unread/high-priority candidates using GMAIL_FETCH_EMAILS
  // Use focused unread+important query; start with small max_results (default 20, up to 500); keep include_payload=false and verbose=false
  const baseQuery = args.query && args.query.trim()
    ? `is:unread is:important ${args.query.trim()}`
    : "is:unread is:important";

  const maxResults = Math.min(Math.max(1, Number(args.max_results || 20)), 500);
  const maxPages = Math.min(Math.max(1, Number(args.max_pages || 3)), 10);

  const seenIds = new Set<string>();
  const seenTokens = new Set<string>();
  const accumulated: ComposioGmailMessage[] = [];
  let currentToken: string | null = args.page_token?.trim() || null;
  let queryUsed = baseQuery;
  let retryBroadQuery = false;

  try {
    // Step 3: Paginate using GMAIL_FETCH_EMAILS with page_token until nextPageToken is falsy;
    // accumulate and dedupe by messages[].id; stop if tokens or IDs stop progressing
    let pageCount = 0;
    while (pageCount < maxPages) {
      pageCount++;
      if (currentToken) {
        if (seenTokens.has(currentToken)) {
          // Token is repeating - stop progression
          break;
        }
        seenTokens.add(currentToken);
      }

      const fetchResult = await composioGmailFetchEmails(userId, {
        query: queryUsed,
        maxResults,
        includePayload: false,
        verbose: false,
        pageToken: currentToken || undefined,
        labelIds: args.label_ids,
      });

      const initialCount = seenIds.size;
      for (const msg of fetchResult.messages) {
        if (!seenIds.has(msg.id)) {
          seenIds.add(msg.id);
          accumulated.push(msg);
        }
      }

      // Stop if messageId set stops progressing
      if (fetchResult.messages.length > 0 && seenIds.size === initialCount) {
        break;
      }

      // Treat falsy / empty string as end-of-pages
      if (!fetchResult.nextPageToken || !fetchResult.nextPageToken.trim()) {
        currentToken = null;
        break;
      }

      currentToken = fetchResult.nextPageToken.trim();
    }

    // Step 7 / Step 2 Fallback: If messages is empty (Pitfall 1: valid no-match state before widening filters),
    // retry GMAIL_FETCH_EMAILS with a broader/simpler query (e.g. is:unread or label-checked)
    if (accumulated.length === 0) {
      const broaderQuery = args.query && args.query.trim()
        ? `is:unread ${args.query.trim()}`
        : "is:unread";

      if (broaderQuery !== queryUsed) {
        try {
          const fallbackRes = await composioGmailFetchEmails(userId, {
            query: broaderQuery,
            maxResults,
            includePayload: false,
            verbose: false,
            labelIds: args.label_ids,
          });
          for (const msg of fallbackRes.messages) {
            if (!seenIds.has(msg.id)) {
              seenIds.add(msg.id);
              accumulated.push(msg);
            }
          }
          if (accumulated.length > 0) {
            queryUsed = broaderQuery;
            retryBroadQuery = true;
          }
        } catch {
          // ignore fallback error and keep empty list
        }
      }
    }

    // Step 4 (Optional client-side post-filter and sorting):
    // Post-filter using labelIds (retaining UNREAD / IMPORTANT) and sort by messageTimestamp descending
    let filteredList = accumulated;
    if (args.strict_filter) {
      filteredList = filteredList.filter((m) => {
        const labels = Array.isArray(m.labelIds) ? m.labelIds.map((l) => String(l).toUpperCase()) : [];
        const isUnread = labels.length === 0 || labels.includes("UNREAD");
        const isImportant = labels.length === 0 || labels.includes("IMPORTANT");
        return isUnread && isImportant;
      });
    }

    if (args.sort_newest !== false) {
      filteredList.sort((a, b) => getMessageEpochMs(b) - getMessageEpochMs(a));
    }

    // Step 5 (Optional shortlist hydration): Hydrate a shortlist using GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID
    const hydrateCount = args.hydrate_shortlist
      ? Math.min(Math.max(1, Number(args.hydrate_count || 5)), 10)
      : Math.min(Math.max(0, Number(args.hydrate_count || 0)), 10);

    const hydratedDetails = new Map<string, any>();
    if (hydrateCount > 0 && filteredList.length > 0) {
      const shortlist = filteredList.slice(0, hydrateCount);
      for (const item of shortlist) {
        try {
          const detail = await composioGmailFetchMessageById(userId, item.id);
          hydratedDetails.set(item.id, detail);
        } catch (hErr) {
          // Pitfall 4: messageId can yield HTTP 404 NOT_FOUND for inaccessible/stale IDs
          console.warn(`[composio-gmail] hydration error for messageId ${item.id}:`, hErr);
        }
      }
    }

    // Optional thread context for first message
    let threadContext = null;
    if (args.get_thread_context && filteredList.length > 0 && filteredList[0].threadId) {
      try {
        threadContext = await composioGmailFetchThreadById(userId, filteredList[0].threadId);
      } catch (thErr) {
        console.warn("[composio-gmail] thread context error:", thErr);
      }
    }

    // Step 6: Optional mailbox updates via GMAIL_BATCH_MODIFY_MESSAGES
    // (after explicit confirmation for mailbox changes)
    let batchModifyResult = null;
    const toRemoveLabels: string[] = args.remove_label_ids ? [...args.remove_label_ids] : [];
    if (args.mark_as_read) {
      toRemoveLabels.push("UNREAD");
    }
    if ((toRemoveLabels.length > 0 || (args.add_label_ids && args.add_label_ids.length > 0)) && filteredList.length > 0) {
      const messageIdsToModify = filteredList.map((m) => m.id);
      try {
        batchModifyResult = await composioGmailBatchModify(userId, {
          messageIds: messageIdsToModify,
          addLabelIds: args.add_label_ids,
          removeLabelIds: toRemoveLabels,
        });
      } catch (bmErr) {
        console.warn("[composio-gmail] batch modify error:", bmErr);
      }
    }

    const formattedMessages = filteredList.map((m) => {
      const hydrated = hydratedDetails.get(m.id);
      return {
        id: m.id,
        threadId: m.threadId,
        subject: m.subject || hydrated?.subject,
        from: m.from || hydrated?.from,
        to: hydrated?.to,
        date: m.date || m.internalDate || hydrated?.date,
        snippet: m.snippet,
        labelIds: hydrated?.labelIds || m.labelIds,
        ...(hydrated
          ? {
              body: hydrated.body,
              html: hydrated.html,
            }
          : {}),
      };
    });

    return {
      success: true,
      connectedAs: activeMailbox,
      count: formattedMessages.length,
      messages: formattedMessages,
      queryUsed,
      retryBroadQuery,
      nextPageToken: currentToken,
      hasMore: Boolean(currentToken),
      ...(threadContext ? { thread: threadContext } : {}),
      ...(batchModifyResult ? { batchModified: batchModifyResult } : {}),
    };
  } catch (error) {
    return composioFailure(error, "gmail_fetch_unread_important_failed");
  }
}

