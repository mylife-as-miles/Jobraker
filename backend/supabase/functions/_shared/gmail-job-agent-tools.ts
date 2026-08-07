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
  composioGmailCreateDraft,
  composioGmailFetchEmails,
  composioGmailResolveLabelId,
  composioGmailSendEmail,
  getComposioGmailConnection,
  gmailNotConnectedResult,
  type ComposioGmailMessage,
  type GmailPayload,
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
  "interview",
  "position",
  "role",
  "offer",
  "recruiter",
  "hiring",
  "career",
  "resume",
  "cv",
  "candidate",
  "requisition",
  "screen",
  "assessment",
  "thank you",
  "follow up",
  "follow-up",
  "company",
  "team",
  "onboarding",
  "compensation",
  "salary",
  "withdraw",
  "rejection",
  "schedule",
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
  args: { to?: string; subject?: string; body?: string },
) {
  const to = typeof args.to === "string" ? args.to.trim() : "";
  const subject = typeof args.subject === "string" ? args.subject.trim() : "";
  const body = typeof args.body === "string" ? args.body.trim() : "";

  if (!to || !EMAIL_RE.test(to)) {
    return {
      ok: false as const,
      error: "Invalid recipient email.",
      code: "invalid_to",
    };
  }
  if (!subject || subject.length > 200) {
    return {
      ok: false as const,
      error: "Subject is required (max 200 characters).",
      code: "invalid_subject",
    };
  }
  if (body.length < 30 || body.length > 12_000) {
    return {
      ok: false as const,
      error: "Body must be between 30 and 12000 characters.",
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
  if (countJobSignals(combined) < 2) {
    return {
      ok: false as const,
      error:
        "Email must clearly relate to your job search (e.g. mention role, company, interview, application, or recruiter).",
      code: "not_job_related",
    };
  }

  return { ok: true as const, to, subject, body };
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
  args: { to?: string; subject?: string; body?: string },
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
    });

    return {
      success: true,
      draftId: draft.draftId,
      messageId: draft.messageId,
      threadId: draft.threadId,
      draftFrom: connection.identifier,
      to: validated.to,
    };
  } catch (error) {
    return composioFailure(error, "gmail_draft_failed");
  }
}

export async function agentSendJobRelatedEmail(
  _serviceClient: SupabaseClient,
  userId: string,
  args: { to?: string; subject?: string; body?: string },
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
    });

    return {
      success: true,
      messageId: sent.messageId,
      sentFrom: connection.identifier,
      to: validated.to,
    };
  } catch (error) {
    return composioFailure(error, "gmail_send_failed");
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
