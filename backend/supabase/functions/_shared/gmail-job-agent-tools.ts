/**
 * Gmail helpers for AI agent: job-related search + outbound send with server-side guardrails.
 * Requires gmail_connections row + OAuth scopes including gmail.readonly and gmail.send.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function requireEnv(name: string) {
  const v = Deno.env.get(name)?.trim();
  if (!v) throw new Error(`${name} is not configured`);
  return v;
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
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

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

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

type GmailConnectionRow = {
  email: string | null;
  scope?: string[] | null;
  access_token_ciphertext: string | null;
  refresh_token_ciphertext: string | null;
  token_expires_at: string | null;
};

const GMAIL_MODIFY_SCOPE = "https://www.googleapis.com/auth/gmail.modify";

function hasGmailModifyScope(connection: GmailConnectionRow) {
  const scopes = Array.isArray(connection.scope) ? connection.scope : [];
  return scopes.some((scope) =>
    scope === GMAIL_MODIFY_SCOPE || scope === "https://mail.google.com/"
  );
}

export async function getValidGmailAccessToken(
  serviceClient: SupabaseClient,
  userId: string,
  connection: GmailConnectionRow,
): Promise<string> {
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
    throw new Error(
      "Gmail is connected without a refresh token. Reconnect Gmail in Settings.",
    );
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

type GmailHeader = { name?: string; value?: string };
type GmailPayload = {
  mimeType?: string;
  headers?: GmailHeader[];
  body?: { data?: string };
  parts?: GmailPayload[];
};

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

function payloadToPlainPreview(payload: GmailPayload | undefined, maxChars: number) {
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

function getHeader(payload: GmailPayload | undefined, name: string) {
  const target = name.toLowerCase();
  return payload?.headers?.find((h) =>
    h.name?.toLowerCase() === target
  )?.value ?? "";
}

export async function agentSearchJobRelatedEmails(
  serviceClient: SupabaseClient,
  userId: string,
  args: { max_results?: number; refine_query?: string },
) {
  const { data: connection, error: connErr } = await serviceClient
    .from("gmail_connections")
    .select("email, access_token_ciphertext, refresh_token_ciphertext, token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (connErr) throw connErr;
  if (!connection) {
    return {
      success: false,
      error:
        "Gmail is not connected. Open Settings → Integrations and connect Gmail.",
      code: "gmail_not_connected",
    };
  }

  const max = Math.max(1, Math.min(15, Math.floor(Number(args.max_results) || 8)));
  const refine = sanitizeRefine(args.refine_query);
  const q = refine
    ? `(${JOB_EMAIL_GMAIL_QUERY_CORE}) (${refine})`
    : JOB_EMAIL_GMAIL_QUERY_CORE;

  const accessToken = await getValidGmailAccessToken(
    serviceClient,
    userId,
    connection as GmailConnectionRow,
  );

  const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  listUrl.searchParams.set("q", q);
  listUrl.searchParams.set("maxResults", String(max));

  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!listRes.ok) {
    return {
      success: false,
      error: `Gmail search failed (${listRes.status})`,
      code: "gmail_api_error",
    };
  }
  const listJson = await listRes.json() as { messages?: Array<{ id: string }> };
  const ids = (listJson.messages || []).map((m) => m.id).filter(Boolean);

  const summaries: Array<Record<string, unknown>> = [];
  for (const id of ids) {
    const msgUrl = new URL(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}`,
    );
    msgUrl.searchParams.set("format", "full");
    const mr = await fetch(msgUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!mr.ok) continue;
    const msg = await mr.json() as {
      id: string;
      threadId?: string;
      snippet?: string;
      payload?: GmailPayload;
    };
    const subject = getHeader(msg.payload, "Subject");
    const from = getHeader(msg.payload, "From");
    const date = getHeader(msg.payload, "Date");
    const bodyPreview = payloadToPlainPreview(msg.payload, 1200);
    summaries.push({
      id: msg.id,
      threadId: msg.threadId ?? null,
      subject,
      from,
      date,
      snippet: msg.snippet || "",
      bodyPreview,
    });
  }

  return {
    success: true,
    connectedAs: (connection as { email?: string | null }).email ?? null,
    queryUsed: q,
    count: summaries.length,
    messages: summaries,
  };
}

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

function buildRawEmail(
  fromEmail: string,
  to: string,
  subject: string,
  body: string,
) {
  const rfc822 = [
    `From: ${fromEmail}`,
    `To: ${to}`,
    `Subject: ${subject.replace(/\r?\n/g, " ")}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    body.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n"),
  ].join("\r\n");

  return btoa(unescape(encodeURIComponent(rfc822)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function getGmailConnection(
  serviceClient: SupabaseClient,
  userId: string,
  select =
    "email, scope, access_token_ciphertext, refresh_token_ciphertext, token_expires_at",
) {
  const { data: connection, error: connErr } = await serviceClient
    .from("gmail_connections")
    .select(select)
    .eq("user_id", userId)
    .maybeSingle();
  if (connErr) throw connErr;
  return connection as GmailConnectionRow | null;
}

function connectedEmailOrError(connection: GmailConnectionRow) {
  const fromEmail =
    typeof connection.email === "string" && connection.email.includes("@")
      ? connection.email
      : null;
  if (!fromEmail) {
    return {
      ok: false as const,
      error: "Connected Gmail address is missing. Reconnect Gmail in Settings.",
      code: "gmail_missing_profile_email",
    };
  }
  return { ok: true as const, fromEmail };
}

function gmailModifyScopeError() {
  return {
    success: false,
    error:
      "Gmail modify permission is missing. Disconnect and reconnect Gmail in Settings to enable draft creation and labeling.",
    code: "gmail_modify_scope_required",
  };
}

export async function agentCreateJobRelatedDraft(
  serviceClient: SupabaseClient,
  userId: string,
  args: { to?: string; subject?: string; body?: string },
) {
  const validated = validateJobEmailDraft(args);
  if (!validated.ok) {
    return {
      success: false,
      error: validated.error,
      code: validated.code,
    };
  }

  const connection = await getGmailConnection(serviceClient, userId);
  if (!connection) {
    return {
      success: false,
      error:
        "Gmail is not connected. Open Settings -> Integrations and connect Gmail.",
      code: "gmail_not_connected",
    };
  }
  if (!hasGmailModifyScope(connection)) return gmailModifyScopeError();

  const from = connectedEmailOrError(connection);
  if (!from.ok) return { success: false, error: from.error, code: from.code };

  const accessToken = await getValidGmailAccessToken(
    serviceClient,
    userId,
    connection,
  );
  const raw = buildRawEmail(
    from.fromEmail,
    validated.to,
    validated.subject,
    validated.body,
  );

  const draftRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: { raw } }),
    },
  );

  if (!draftRes.ok) {
    const t = await draftRes.text();
    return {
      success: false,
      error: `Gmail draft creation failed (${draftRes.status}): ${t.slice(0, 500)}`,
      code: "gmail_draft_failed",
    };
  }

  const draft = await draftRes.json() as {
    id?: string;
    message?: { id?: string; threadId?: string };
  };

  return {
    success: true,
    draftId: draft.id ?? null,
    messageId: draft.message?.id ?? null,
    threadId: draft.message?.threadId ?? null,
    draftFrom: from.fromEmail,
    to: validated.to,
  };
}

function sanitizeLabelName(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name) return "JobRaker/Applications";
  return name.replace(/[^\w\s/:-]/g, "").slice(0, 60) ||
    "JobRaker/Applications";
}

export async function agentLabelJobRelatedEmails(
  serviceClient: SupabaseClient,
  userId: string,
  args: {
    message_ids?: string[];
    refine_query?: string;
    max_results?: number;
    label_name?: string;
  },
) {
  const connection = await getGmailConnection(serviceClient, userId);
  if (!connection) {
    return {
      success: false,
      error:
        "Gmail is not connected. Open Settings -> Integrations and connect Gmail.",
      code: "gmail_not_connected",
    };
  }
  if (!hasGmailModifyScope(connection)) return gmailModifyScopeError();

  const accessToken = await getValidGmailAccessToken(
    serviceClient,
    userId,
    connection,
  );
  const labelName = sanitizeLabelName(args.label_name);
  const labelListRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/labels",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!labelListRes.ok) {
    return {
      success: false,
      error: `Gmail labels lookup failed (${labelListRes.status})`,
      code: "gmail_label_lookup_failed",
    };
  }

  const labelList = await labelListRes.json() as {
    labels?: Array<{ id?: string; name?: string }>;
  };
  let labelId = labelList.labels?.find((label) => label.name === labelName)?.id;

  if (!labelId) {
    const createLabelRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/labels",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: labelName,
          labelListVisibility: "labelShow",
          messageListVisibility: "show",
        }),
      },
    );
    if (!createLabelRes.ok) {
      const t = await createLabelRes.text();
      return {
        success: false,
        error: `Gmail label creation failed (${createLabelRes.status}): ${t.slice(0, 500)}`,
        code: "gmail_label_create_failed",
      };
    }
    const created = await createLabelRes.json() as { id?: string };
    labelId = created.id;
  }

  if (!labelId) {
    return {
      success: false,
      error: "Gmail label could not be resolved.",
      code: "gmail_label_missing",
    };
  }

  let ids = Array.isArray(args.message_ids)
    ? args.message_ids.filter((id) => typeof id === "string" && id.trim())
    : [];

  if (!ids.length) {
    const refine = sanitizeRefine(args.refine_query);
    const q = refine
      ? `(${JOB_EMAIL_GMAIL_QUERY_CORE}) (${refine})`
      : JOB_EMAIL_GMAIL_QUERY_CORE;
    const max = Math.max(
      1,
      Math.min(25, Math.floor(Number(args.max_results) || 10)),
    );
    const listUrl = new URL(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages",
    );
    listUrl.searchParams.set("q", q);
    listUrl.searchParams.set("maxResults", String(max));
    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!listRes.ok) {
      return {
        success: false,
        error: `Gmail search failed (${listRes.status})`,
        code: "gmail_api_error",
      };
    }
    const listJson = await listRes.json() as {
      messages?: Array<{ id?: string }>;
    };
    ids = (listJson.messages || [])
      .map((message) => message.id)
      .filter((id): id is string => Boolean(id));
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

  const modifyRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ids,
        addLabelIds: [labelId],
      }),
    },
  );
  if (!modifyRes.ok) {
    const t = await modifyRes.text();
    return {
      success: false,
      error: `Gmail label apply failed (${modifyRes.status}): ${t.slice(0, 500)}`,
      code: "gmail_label_apply_failed",
    };
  }

  return {
    success: true,
    labelId,
    labelName,
    labeledCount: ids.length,
    messageIds: ids,
  };
}

export async function agentSendJobRelatedEmail(
  serviceClient: SupabaseClient,
  userId: string,
  args: { to?: string; subject?: string; body?: string },
) {
  const validated = validateJobEmailDraft(args);
  if (!validated.ok) {
    return {
      success: false,
      error: validated.error,
      code: validated.code,
    };
  }
  const { to, subject, body } = validated;

  const combined = `${subject}\n${body}`;
  if (looksBlocked(combined)) {
    return {
      success: false,
      error:
        "This message was blocked because it matched non‑job safety rules. Only professional job-related email is allowed.",
      code: "content_blocked",
    };
  }
  if (countJobSignals(combined) < 2) {
    return {
      success: false,
      error:
        "Email must clearly relate to your job search (e.g. mention role, company, interview, application, or recruiter).",
      code: "not_job_related",
    };
  }

  const { data: connection, error: connErr } = await serviceClient
    .from("gmail_connections")
    .select("email, access_token_ciphertext, refresh_token_ciphertext, token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (connErr) throw connErr;
  if (!connection) {
    return {
      success: false,
      error:
        "Gmail is not connected. Open Settings → Integrations and connect Gmail (send permission required).",
      code: "gmail_not_connected",
    };
  }

  const fromEmail =
    typeof connection.email === "string" && connection.email.includes("@")
      ? connection.email
      : null;
  if (!fromEmail) {
    return {
      success: false,
      error: "Connected Gmail address is missing. Reconnect Gmail in Settings.",
      code: "gmail_missing_profile_email",
    };
  }

  const accessToken = await getValidGmailAccessToken(
    serviceClient,
    userId,
    connection as GmailConnectionRow,
  );

  const rfc822 = [
    `From: ${fromEmail}`,
    `To: ${to}`,
    `Subject: ${subject.replace(/\r?\n/g, " ")}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    body.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n"),
  ].join("\r\n");

  const raw = btoa(unescape(encodeURIComponent(rfc822)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const sendRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    },
  );

  if (!sendRes.ok) {
    const t = await sendRes.text();
    let hint = t;
    if (sendRes.status === 403 && /insufficient/i.test(t)) {
      hint =
        "Gmail send permission missing. Disconnect and reconnect Gmail in Settings to grant send access.";
    }
    return {
      success: false,
      error: `Gmail send failed (${sendRes.status}): ${hint.slice(0, 500)}`,
      code: "gmail_send_failed",
    };
  }

  const sent = await sendRes.json() as { id?: string };
  return {
    success: true,
    messageId: sent.id ?? null,
    sentFrom: fromEmail,
    to,
  };
}
