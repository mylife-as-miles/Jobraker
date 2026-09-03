/**
 * Composio-backed Gmail transport.
 *
 * JobRaker previously held its own Google OAuth tokens in `gmail_connections`
 * and called the Gmail REST API directly. Settings → Integrations connects
 * Gmail through Composio, so the two systems disagreed: the card read
 * "Connected" while the agent reported "unauthorized". Everything Gmail now
 * goes through the same Composio connected account the UI manages.
 *
 * Tool slugs and parameter names follow Composio's Gmail toolkit.
 */

import { Composio } from "npm:@composio/core@0.13.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runMeteredComposioCall } from "./metered-composio.ts";
import {
  normalizeConnectedAccount,
  resolveIntegrationConnection,
  filterConnectedAccountsForUser,
  type ComposioAccount,
} from "./composio-connected-account.ts";

export const GMAIL_TOOLKIT_SLUG = "gmail";

export const GMAIL_TOOL = {
  fetchEmails: "GMAIL_FETCH_EMAILS",
  createDraft: "GMAIL_CREATE_EMAIL_DRAFT",
  sendEmail: "GMAIL_SEND_EMAIL",
  listLabels: "GMAIL_LIST_LABELS",
  createLabel: "GMAIL_CREATE_LABEL",
  addLabels: "GMAIL_ADD_LABEL_TO_EMAIL",
  listSendAs: "GMAIL_LIST_SEND_AS",
  getDraft: "GMAIL_GET_DRAFT",
  sendDraft: "GMAIL_SEND_DRAFT",
  fetchMessageById: "GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID",
  fetchThreadById: "GMAIL_FETCH_MESSAGE_BY_THREAD_ID",
  getAttachment: "GMAIL_GET_ATTACHMENT",
  batchModifyMessages: "GMAIL_BATCH_MODIFY_MESSAGES",
  getProfile: "GMAIL_GET_PROFILE",
  listThreads: "GMAIL_LIST_THREADS",
  settingsSendAsGet: "GMAIL_SETTINGS_SEND_AS_GET",
} as const;

const COMPOSIO_REST_BASE = "https://backend.composio.dev/api/v3.1";

function apiKey() {
  return Deno.env.get("COMPOSIO_API_KEY") || "";
}

let cachedClient: Composio | null = null;
function client() {
  if (!cachedClient) cachedClient = new Composio({ apiKey: apiKey() });
  return cachedClient;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Composio wraps tool output in an envelope whose exact shape varies between
 * the SDK and the REST endpoint (`data`, `response_data`, or the payload
 * inline). Unwrap defensively rather than trusting one shape.
 */
function unwrapToolData(result: unknown): Record<string, unknown> {
  const root = asRecord(result);
  if (!root) return {};

  const successful = root.successful ?? root.success;
  if (successful === false) {
    const message = typeof root.error === "string"
      ? root.error
      : asRecord(root.error)?.message;
    throw new Error(
      typeof message === "string" && message
        ? message
        : "Composio reported the Gmail action as unsuccessful",
    );
  }

  for (const key of ["data", "response_data", "result"]) {
    const nested = asRecord(root[key]);
    if (nested) {
      const deeper = asRecord(nested.response_data) ?? asRecord(nested.data);
      // Only descend when the inner object looks like the real payload.
      if (deeper && (deeper.messages || deeper.labels || deeper.id)) {
        return deeper;
      }
      return nested;
    }
  }

  return root;
}

export class ComposioGmailError extends Error {
  code: string;
  constructor(message: string, code = "composio_gmail_error") {
    super(message);
    this.name = "ComposioGmailError";
    this.code = code;
  }
}

const isReadOnlyGmailTool = (slug: string): boolean =>
  /^(GMAIL_(FETCH|GET|LIST|SEARCH|READ)_)/.test(slug);

/** Executes a Composio tool as `userId`. Writes never retry through REST after an ambiguous SDK failure. */
export async function executeComposioTool(
  userId: string,
  slug: string,
  args: Record<string, unknown>,
  options?: { serviceClient?: any; requestId?: string; parentRequestId?: string },
): Promise<Record<string, unknown>> {
  const serviceClient = options?.serviceClient || createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  );

  return await runMeteredComposioCall({
    serviceClient,
    userId,
    requestId: options?.requestId,
    parentRequestId: options?.parentRequestId,
    toolkitSlug: GMAIL_TOOLKIT_SLUG,
    toolSlug: slug,
    payload: args,
    execute: async () => {
      let sdkError: unknown = null;

      const executeFn = (client() as unknown as {
        tools?: { execute?: (...a: unknown[]) => Promise<unknown> };
      })?.tools?.execute;

      if (typeof executeFn === "function") {
        try {
          const result = await executeFn.call(
            (client() as unknown as { tools: unknown }).tools,
            slug,
            { userId, arguments: args },
          );
          return unwrapToolData(result);
        } catch (error) {
          sdkError = error;
          console.warn(`[composio-gmail] SDK execute failed for ${slug}:`, error);
          if (!isReadOnlyGmailTool(slug)) {
            throw new ComposioGmailError(
              `Composio ${slug} may have executed; refusing an unsafe REST retry.`,
              "composio_ambiguous_write",
            );
          }
        }
      }

      const key = apiKey();
      if (!key) {
        throw new ComposioGmailError(
          "COMPOSIO_API_KEY is not configured",
          "composio_not_configured",
        );
      }

      const response = await fetch(
        `${COMPOSIO_REST_BASE}/tools/execute/${encodeURIComponent(slug)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": key },
          body: JSON.stringify({ user_id: userId, arguments: args }),
        },
      );

      if (!response.ok) {
        const text = await response.text();
        const code = response.status === 401 || response.status === 403
          ? "gmail_unauthorized"
          : "composio_gmail_error";
        throw new ComposioGmailError(
          `Composio ${slug} failed (${response.status}): ${text.slice(0, 400)}`,
          code,
        );
      }

      try {
        return unwrapToolData(await response.json());
      } catch (error) {
        if (error instanceof Error && sdkError) {
          throw new ComposioGmailError(error.message, "composio_gmail_error");
        }
        throw error;
      }
    },
  });
}

/* ------------------------------ connection state ---------------------------- */

async function listGmailAccounts(userId: string): Promise<ComposioAccount[]> {
  const accounts = new Map<string, ComposioAccount>();
  const key = apiKey();

  const add = (items: unknown, scoped: boolean) => {
    const list = Array.isArray(items)
      ? items
      : (asRecord(items)?.items ?? asRecord(items)?.data);
    if (!Array.isArray(list)) return;
    for (const raw of list) {
      const item = asRecord(raw);
      if (!item) continue;
      const norm = normalizeConnectedAccount(item);
      if (!norm.id) continue;
      if (norm.userId && norm.userId !== userId) continue;
      if (!norm.userId && !scoped) continue;
      accounts.set(norm.id, norm.userId ? item : { ...item, user_id: userId });
    }
  };

  try {
    add(await client().connectedAccounts.list({ userIds: [userId] }), true);
  } catch (error) {
    console.warn("[composio-gmail] SDK connectedAccounts.list failed:", error);
  }

  if (key) {
    try {
      const res = await fetch(
        `${COMPOSIO_REST_BASE}/connected_accounts?user_id=${encodeURIComponent(userId)}`,
        { headers: { "x-api-key": key } },
      );
      if (res.ok) add(await res.json(), true);
    } catch (error) {
      console.warn("[composio-gmail] REST connected_accounts failed:", error);
    }
  }

  return filterConnectedAccountsForUser(Array.from(accounts.values()), userId);
}

export interface GmailConnectionInfo {
  connected: boolean;
  state: "active" | "pending" | "inactive";
  identifier: string | null;
  connectionId: string | null;
}

/** Resolves the caller's Gmail connection using the same rules as the Settings UI. */
export async function getComposioGmailConnection(
  userId: string,
): Promise<GmailConnectionInfo> {
  const accounts = await listGmailAccounts(userId);
  const { account, state } = resolveIntegrationConnection(accounts, {
    slug: GMAIL_TOOLKIT_SLUG,
  });
  const normalized = account ? normalizeConnectedAccount(account) : null;
  return {
    connected: state === "active",
    state,
    identifier: normalized?.identifier ?? null,
    connectionId: normalized?.id ?? null,
  };
}

/** Shared not-connected / half-authorized payload so every tool reports it identically. */
export function gmailNotConnectedResult(info: GmailConnectionInfo) {
  if (info.state === "pending") {
    return {
      success: false,
      error:
        "Gmail authorization was started but never finished. Open Settings → Integrations and complete the Gmail connection.",
      code: "gmail_authorization_incomplete",
    };
  }
  return {
    success: false,
    error:
      "Gmail is not connected. Open Settings → Integrations and connect Gmail.",
    code: "gmail_not_connected",
  };
}

/* --------------------------------- messages --------------------------------- */

export type GmailHeader = { name?: string; value?: string };
export type GmailPayload = {
  mimeType?: string;
  headers?: GmailHeader[];
  body?: { data?: string };
  parts?: GmailPayload[];
};

export interface ComposioGmailMessage {
  id: string;
  threadId: string | null;
  historyId: string | null;
  internalDate: string | null;
  snippet: string;
  payload: GmailPayload | undefined;
  /** Present when Composio pre-extracts the text body. */
  messageText: string | null;
  subject: string | null;
  from: string | null;
  date: string | null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }
  return null;
}

/**
 * Composio's Gmail payload keys drift between snake_case and camelCase
 * depending on the tool version, so read both spellings.
 */
function normalizeMessage(raw: unknown): ComposioGmailMessage | null {
  const item = asRecord(raw);
  if (!item) return null;

  const id = firstString(item.messageId, item.message_id, item.id);
  if (!id) return null;

  const payload = (asRecord(item.payload) ?? undefined) as
    | GmailPayload
    | undefined;

  return {
    id,
    threadId: firstString(item.threadId, item.thread_id),
    historyId: firstString(item.historyId, item.history_id),
    internalDate: firstString(item.internalDate, item.internal_date),
    snippet: firstString(item.snippet, item.preview) ?? "",
    payload,
    messageText: firstString(
      item.messageText,
      item.message_text,
      item.text,
      item.body,
    ),
    subject: firstString(item.subject),
    from: firstString(item.sender, item.from, item.from_email),
    date: firstString(item.messageTimestamp, item.date, item.internalDate),
  };
}

const textDecoder = new TextDecoder();

export function decodeBase64Url(data?: string | null): string {
  if (!data || typeof data !== "string") return "";
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return textDecoder.decode(bytes);
  } catch {
    return "";
  }
}

export function extractBodyFromPayload(payload?: GmailPayload): { text: string; html: string } {
  if (!payload) return { text: "", html: "" };
  let text = "";
  let html = "";

  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    if (payload.mimeType?.includes("html")) {
      html = decoded;
    } else {
      text = decoded;
    }
  }

  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.body?.data) {
        const decoded = decodeBase64Url(part.body.data);
        if (part.mimeType === "text/plain") {
          text = text ? `${text}\n${decoded}` : decoded;
        } else if (part.mimeType === "text/html") {
          html = html ? `${html}\n${decoded}` : decoded;
        }
      }
      if (Array.isArray(part.parts)) {
        const nested = extractBodyFromPayload(part);
        if (nested.text) text = text ? `${text}\n${nested.text}` : nested.text;
        if (nested.html) html = html ? `${html}\n${nested.html}` : nested.html;
      }
    }
  }

  return { text, html };
}

export function getMessageEpochMs(message: ComposioGmailMessage): number | null {
  if (message.internalDate) {
    const parsed = parseInt(message.internalDate, 10);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  if (message.date) {
    const parsed = Date.parse(message.date);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

export function isMessageWithinCutoff(
  message: ComposioGmailMessage,
  cutoffs: { startUtcEpochMs?: number; endUtcEpochMs?: number },
): boolean {
  const epoch = getMessageEpochMs(message);
  if (epoch === null) return true;
  if (cutoffs.startUtcEpochMs != null && epoch < cutoffs.startUtcEpochMs) return false;
  if (cutoffs.endUtcEpochMs != null && epoch > cutoffs.endUtcEpochMs) return false;
  return true;
}

export interface FetchEmailsOptions {
  query: string;
  maxResults: number;
  includePayload?: boolean;
  verbose?: boolean;
  pageToken?: string;
  labelIds?: string[];
}

export interface FetchEmailsResult {
  messages: ComposioGmailMessage[];
  nextPageToken: string | null;
}

export async function composioGmailFetchEmails(
  userId: string,
  options: FetchEmailsOptions,
): Promise<FetchEmailsResult> {
  // Step 3 & Pitfall 2: metadata-first with include_payload=false and practical max_results up to 500.
  // Setting include_payload=true can trigger oversized/offloaded responses or 413 errors.
  const maxResults = Math.min(Math.max(1, options.maxResults || 20), 500);
  const data = await executeComposioTool(userId, GMAIL_TOOL.fetchEmails, {
    query: options.query,
    max_results: maxResults,
    include_payload: Boolean(options.includePayload),
    verbose: Boolean(options.verbose),
    user_id: "me",
    ...(options.pageToken ? { page_token: options.pageToken } : {}),
    ...(options.labelIds && options.labelIds.length > 0 ? { label_ids: options.labelIds } : {}),
  });

  const rawData = asRecord(data);
  // Pitfall 2: Large listings may be offloaded/truncated; messages can appear under
  // response.data_preview.messages, response.data.messages, response.response_data.messages, or inline
  const rawList = Array.isArray(rawData?.messages)
    ? rawData.messages
    : Array.isArray((rawData?.data as any)?.messages)
    ? (rawData.data as any).messages
    : Array.isArray((rawData?.data_preview as any)?.messages)
    ? (rawData.data_preview as any).messages
    : Array.isArray((rawData?.response_data as any)?.messages)
    ? (rawData.response_data as any).messages
    : Array.isArray(rawData?.data)
    ? (rawData.data as unknown[])
    : Array.isArray(rawData?.items)
    ? (rawData.items as unknown[])
    : [];

  const messages = rawList
    .map(normalizeMessage)
    .filter((m): m is ComposioGmailMessage => m !== null);

  // Pitfall 1: nextPageToken may be an empty string; treat falsey tokens as null to avoid infinite loops
  const rawToken = firstString(
    rawData?.nextPageToken,
    rawData?.next_page_token,
    (rawData?.data as any)?.nextPageToken,
    (rawData?.data as any)?.next_page_token,
    (rawData?.data_preview as any)?.nextPageToken,
    (rawData?.data_preview as any)?.next_page_token,
  );
  const nextPageToken = rawToken && rawToken.trim().length > 0 ? rawToken.trim() : null;

  return {
    messages,
    nextPageToken,
  };
}

export async function composioGmailCreateDraft(
  userId: string,
  args: {
    to: string;
    subject: string;
    body: string;
    cc?: string;
    bcc?: string;
    is_html?: boolean;
    from?: string;
    attachment?: unknown;
  },
): Promise<{ draftId: string | null; messageId: string | null; threadId: string | null }> {
  const data = await executeComposioTool(userId, GMAIL_TOOL.createDraft, {
    recipient_email: args.to,
    ...(args.cc ? { cc: args.cc } : {}),
    ...(args.bcc ? { bcc: args.bcc } : {}),
    subject: args.subject,
    body: args.body,
    is_html: Boolean(args.is_html),
    ...(args.from ? { from: args.from } : {}),
    ...(args.attachment ? { attachment: args.attachment } : {}),
    user_id: "me",
  });

  const message = asRecord(data.message);
  // Pitfall note: draftId differs from messageId; GMAIL_SEND_DRAFT requires draftId
  return {
    draftId: firstString(data.draft_id, data.draftId, data.id),
    messageId: firstString(
      message?.id,
      (asRecord(data.response_data)?.message as Record<string, unknown>)?.id,
      data.message_id,
    ),
    threadId: firstString(message?.threadId, message?.thread_id, data.thread_id),
  };
}

export async function composioGmailSendEmail(
  userId: string,
  args: {
    to: string;
    subject: string;
    body: string;
    cc?: string;
    bcc?: string;
    is_html?: boolean;
    from?: string;
    attachment?: unknown;
  },
): Promise<{ messageId: string | null; threadId: string | null }> {
  const data = await executeComposioTool(userId, GMAIL_TOOL.sendEmail, {
    recipient_email: args.to,
    ...(args.cc ? { cc: args.cc } : {}),
    ...(args.bcc ? { bcc: args.bcc } : {}),
    subject: args.subject,
    body: args.body,
    is_html: Boolean(args.is_html),
    ...(args.from ? { from: args.from } : {}),
    ...(args.attachment ? { attachment: args.attachment } : {}),
    user_id: "me",
  });

  return {
    messageId: firstString(data.id, data.messageId, data.message_id),
    threadId: firstString(data.threadId, data.thread_id),
  };
}

export interface GmailSendAsIdentity {
  sendAsEmail: string;
  displayName: string | null;
  replyToAddress: string | null;
  isPrimary: boolean;
  isDefault: boolean;
}

export async function composioGmailListSendAs(
  userId: string,
): Promise<{ sendAs: GmailSendAsIdentity[] }> {
  const data = await executeComposioTool(userId, GMAIL_TOOL.listSendAs, {
    user_id: "me",
  });

  const rawList = Array.isArray(data.sendAs)
    ? data.sendAs
    : Array.isArray((data as any).send_as)
    ? (data as any).send_as
    : Array.isArray((data as any).items)
    ? (data as any).items
    : Array.isArray((data as any).data)
    ? (data as any).data
    : [];

  const sendAs: GmailSendAsIdentity[] = rawList
    .map((item: any) => {
      const rec = asRecord(item);
      if (!rec) return null;
      const email = firstString(rec.sendAsEmail, rec.send_as_email, rec.email);
      if (!email) return null;
      return {
        sendAsEmail: email,
        displayName: firstString(rec.displayName, rec.display_name),
        replyToAddress: firstString(rec.replyToAddress, rec.reply_to_address),
        isPrimary: Boolean(rec.isPrimary ?? rec.is_primary),
        isDefault: Boolean(rec.isDefault ?? rec.is_default),
      };
    })
    .filter((id): id is GmailSendAsIdentity => id !== null);

  return { sendAs };
}

export async function composioGmailGetDraft(
  userId: string,
  draftId: string,
): Promise<{
  draftId: string;
  messageId: string | null;
  to: string | null;
  subject: string | null;
  snippet: string | null;
  body: string | null;
}> {
  const data = await executeComposioTool(userId, GMAIL_TOOL.getDraft, {
    id: draftId,
    draft_id: draftId,
    user_id: "me",
  });

  const message = asRecord(data.message) || data;
  const payload = asRecord(message.payload) as GmailPayload | undefined;

  return {
    draftId,
    messageId: firstString(message.id, data.message_id),
    to: getHeader(payload, "To") || firstString(data.to, data.recipient_email),
    subject: getHeader(payload, "Subject") || firstString(data.subject),
    snippet: firstString(message.snippet, data.snippet),
    body: payload ? payloadToPlainPreview(payload, 2000) : firstString(data.body, (message as any).text),
  };
}

export async function composioGmailSendDraft(
  userId: string,
  draftId: string,
): Promise<{ messageId: string | null; threadId: string | null }> {
  // GMAIL_SEND_DRAFT requires the draft_id, not the message_id
  const data = await executeComposioTool(userId, GMAIL_TOOL.sendDraft, {
    id: draftId,
    draft_id: draftId,
    user_id: "me",
  });

  return {
    messageId: firstString(data.id, data.messageId, data.message_id),
    threadId: firstString(data.threadId, data.thread_id),
  };
}

export async function composioGmailFetchMessageById(
  userId: string,
  messageId: string,
): Promise<{
  id: string;
  threadId: string | null;
  subject: string | null;
  from: string | null;
  to: string | null;
  date: string | null;
  labelIds: string[];
  snippet: string | null;
  body: string | null;
  html: string | null;
}> {
  const data = await executeComposioTool(userId, GMAIL_TOOL.fetchMessageById, {
    message_id: messageId,
    id: messageId,
    user_id: "me",
  });

  const message = normalizeMessage(data) || normalizeMessage(data.message) || (data as any);
  const payload = (asRecord(data.payload) ?? asRecord((data as any).message?.payload)) as GmailPayload | undefined;
  // Pitfall 5: Body content may be base64url in payload.parts[].body.data and requires base64url decoding
  const bodyInfo = extractBodyFromPayload(payload);

  return {
    id: messageId,
    threadId: firstString(message?.threadId, data.threadId, (data as any).thread_id),
    subject: (message ? messageSubject(message) : null) || getHeader(payload, "Subject"),
    from: (message ? messageFrom(message) : null) || getHeader(payload, "From"),
    to: getHeader(payload, "To"),
    date: (message ? messageDate(message) : null) || getHeader(payload, "Date"),
    labelIds: Array.isArray(data.labelIds)
      ? data.labelIds
      : Array.isArray((data as any).label_ids)
      ? (data as any).label_ids
      : [],
    snippet: firstString(message?.snippet, data.snippet),
    body: bodyInfo.text || bodyInfo.html || firstString(message?.messageText, (data as any).body, (data as any).text),
    html: bodyInfo.html || null,
  };
}

export async function composioGmailFetchThreadById(
  userId: string,
  threadId: string,
): Promise<{
  threadId: string;
  messages: Array<{
    id: string;
    snippet: string;
    from: string | null;
    to: string | null;
    subject: string | null;
    date: string | null;
    body: string | null;
  }>;
}> {
  const data = await executeComposioTool(userId, GMAIL_TOOL.fetchThreadById, {
    thread_id: threadId,
    id: threadId,
    user_id: "me",
  });

  const rawThread = asRecord(data.thread) || data;
  const rawList = Array.isArray(rawThread.messages)
    ? rawThread.messages
    : Array.isArray((data as any).messages)
    ? (data as any).messages
    : [];

  const messages = rawList.map((rawMsg: any) => {
    const msg = normalizeMessage(rawMsg) || rawMsg;
    const payload = (asRecord(msg?.payload) ?? asRecord(rawMsg?.payload)) as GmailPayload | undefined;
    const bodyInfo = extractBodyFromPayload(payload);
    return {
      id: firstString(msg?.id, rawMsg?.id) ?? "",
      snippet: firstString(msg?.snippet, rawMsg?.snippet) ?? "",
      from: (msg ? messageFrom(msg) : null) || getHeader(payload, "From"),
      to: getHeader(payload, "To"),
      subject: (msg ? messageSubject(msg) : null) || getHeader(payload, "Subject"),
      date: (msg ? messageDate(msg) : null) || getHeader(payload, "Date"),
      body: bodyInfo.text || bodyInfo.html || firstString(msg?.messageText, rawMsg?.snippet),
    };
  });

  return { threadId, messages };
}

export async function composioGmailGetAttachment(
  userId: string,
  args: { messageId: string; attachmentId: string },
): Promise<{
  attachmentId: string;
  size: number;
  data: string | null;
  mimeType: string | null;
}> {
  const res = await executeComposioTool(userId, GMAIL_TOOL.getAttachment, {
    message_id: args.messageId,
    attachment_id: args.attachmentId,
    id: args.attachmentId,
    user_id: "me",
  });

  return {
    attachmentId: args.attachmentId,
    size: Number(res.size ?? 0),
    data: firstString(res.data, (res as any).attachment_data),
    mimeType: firstString(res.mimeType, (res as any).mime_type),
  };
}

export async function composioGmailBatchModify(
  userId: string,
  args: {
    messageIds: string[];
    addLabelIds?: string[];
    removeLabelIds?: string[];
  },
): Promise<{ success: boolean; modifiedCount: number }> {
  await executeComposioTool(userId, GMAIL_TOOL.batchModifyMessages, {
    ids: args.messageIds,
    add_label_ids: args.addLabelIds || [],
    remove_label_ids: args.removeLabelIds || [],
    user_id: "me",
  });

  return { success: true, modifiedCount: args.messageIds.length };
}

export async function composioGmailListLabels(
  userId: string,
): Promise<Array<{ id: string; name: string; type: string | null }>> {
  const listed = await executeComposioTool(userId, GMAIL_TOOL.listLabels, {
    user_id: "me",
  });

  const rawData = asRecord(listed);
  const labels = Array.isArray(rawData?.labels)
    ? rawData.labels
    : Array.isArray((rawData?.data as any)?.labels)
    ? (rawData.data as any).labels
    : Array.isArray((rawData?.data_preview as any)?.labels)
    ? (rawData.data_preview as any).labels
    : Array.isArray(rawData?.data)
    ? (rawData.data as unknown[])
    : [];

  return labels
    .map((raw) => {
      const l = asRecord(raw);
      if (!l) return null;
      const id = firstString(l.id, l.labelId, l.label_id);
      const name = firstString(l.name);
      if (!id || !name) return null;
      return {
        id,
        name,
        type: firstString(l.type),
      };
    })
    .filter((l): l is { id: string; name: string; type: string | null } => l !== null);
}

export async function composioGmailResolveLabelId(
  userId: string,
  labelName: string,
): Promise<string | null> {
  const labels = await composioGmailListLabels(userId);
  const targetLower = labelName.toLowerCase().trim();
  for (const label of labels) {
    if (label.name.toLowerCase() === targetLower) {
      return label.id;
    }
  }

  const created = await executeComposioTool(userId, GMAIL_TOOL.createLabel, {
    label_name: labelName,
    label_list_visibility: "labelShow",
    message_list_visibility: "show",
    user_id: "me",
  });

  return firstString(created.labelId, created.label_id, created.id);
}

/**
 * Composio exposes per-message label mutation, so a batch is applied one
 * message at a time; partial success is reported rather than thrown.
 */
export async function composioGmailAddLabel(
  userId: string,
  messageIds: string[],
  labelId: string,
): Promise<{ labeled: string[]; failed: string[] }> {
  const labeled: string[] = [];
  const failed: string[] = [];

  for (const messageId of messageIds) {
    try {
      await executeComposioTool(userId, GMAIL_TOOL.addLabels, {
        message_id: messageId,
        add_label_ids: [labelId],
        user_id: "me",
      });
      labeled.push(messageId);
    } catch (error) {
      console.warn(`[composio-gmail] label failed for ${messageId}:`, error);
      failed.push(messageId);
    }
  }

  return { labeled, failed };
}

export async function composioGmailGetProfile(
  userId: string,
): Promise<{
  emailAddress: string | null;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string | null;
}> {
  // Pitfall 4: Always target default connected mailbox "me" to avoid 403 delegation/impersonation errors
  const data = await executeComposioTool(userId, GMAIL_TOOL.getProfile, {
    user_id: "me",
  });

  const profile = asRecord(data.profile) || data;
  return {
    emailAddress: firstString(profile.emailAddress, profile.email, (profile as any).email_address),
    messagesTotal: Number(profile.messagesTotal ?? (profile as any).messages_total ?? 0),
    threadsTotal: Number(profile.threadsTotal ?? (profile as any).threads_total ?? 0),
    historyId: firstString(profile.historyId, (profile as any).history_id),
  };
}

export async function composioGmailListThreads(
  userId: string,
  options: {
    query?: string;
    maxResults?: number;
    pageToken?: string;
  } = {},
): Promise<{
  threads: Array<{ id: string; snippet: string; historyId: string | null }>;
  nextPageToken: string | null;
}> {
  const data = await executeComposioTool(userId, GMAIL_TOOL.listThreads, {
    ...(options.query ? { query: options.query } : {}),
    max_results: options.maxResults || 20,
    user_id: "me",
    ...(options.pageToken ? { page_token: options.pageToken } : {}),
  });

  const rawData = asRecord(data);
  const rawList = Array.isArray(rawData?.threads)
    ? rawData.threads
    : Array.isArray((rawData?.data as any)?.threads)
    ? (rawData.data as any).threads
    : Array.isArray((rawData?.data_preview as any)?.threads)
    ? (rawData.data_preview as any).threads
    : Array.isArray(rawData?.data)
    ? (rawData.data as unknown[])
    : [];

  const threads = rawList.map((raw: any) => {
    const item = asRecord(raw) || {};
    return {
      id: firstString(item.id, item.threadId, item.thread_id) ?? "",
      snippet: firstString(item.snippet, item.preview) ?? "",
      historyId: firstString(item.historyId, item.history_id),
    };
  }).filter((t: { id: string }) => Boolean(t.id));

  const rawToken = firstString(
    rawData?.nextPageToken,
    rawData?.next_page_token,
    (rawData?.data as any)?.nextPageToken,
    (rawData?.data_preview as any)?.nextPageToken,
  );
  const nextPageToken = rawToken && rawToken.trim().length > 0 ? rawToken.trim() : null;

  return { threads, nextPageToken };
}

export async function composioGmailGetSendAs(
  userId: string,
  sendAsEmail?: string,
): Promise<{
  sendAsEmail: string | null;
  displayName: string | null;
  replyToAddress: string | null;
  isPrimary: boolean;
  isDefault: boolean;
  treatAsAlias: boolean;
  verificationStatus: string | null;
}> {
  const data = await executeComposioTool(userId, GMAIL_TOOL.settingsSendAsGet, {
    user_id: "me",
    ...(sendAsEmail ? { send_as_email: sendAsEmail, sendAsEmail } : {}),
  });

  const raw = asRecord(data) || {};
  return {
    sendAsEmail: firstString(raw.sendAsEmail, raw.send_as_email, raw.email),
    displayName: firstString(raw.displayName, raw.display_name, raw.name),
    replyToAddress: firstString(raw.replyToAddress, raw.reply_to_address),
    isPrimary: Boolean(raw.isPrimary ?? raw.is_primary),
    isDefault: Boolean(raw.isDefault ?? raw.is_default),
    treatAsAlias: Boolean(raw.treatAsAlias ?? raw.treat_as_alias),
    verificationStatus: firstString(raw.verificationStatus, raw.verification_status),
  };
}
