export type ColdMailDraftAttemptRow = {
  id: string;
  status:
    | "creating"
    | "created"
    | "uncertain"
    | "sending"
    | "sent"
    | "send_uncertain";
  provider_draft_id: string | null;
  provider_message_id: string | null;
  provider_thread_id: string | null;
  draft_from: string | null;
  recipient_email: string;
};

const asString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export async function fingerprintColdMailPreparationToken(token: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function resolveColdMailDraftAttempt(
  row: ColdMailDraftAttemptRow | null,
) {
  if (!row) return { action: "create" as const };

  const draftId = asString(row.provider_draft_id);
  if ((row.status === "created" || row.status === "sent") && draftId) {
    return {
      action: "replay" as const,
      response: {
        success: true,
        draftId,
        messageId: asString(row.provider_message_id) || null,
        threadId: asString(row.provider_thread_id) || null,
        draftFrom: asString(row.draft_from) || null,
        to: asString(row.recipient_email),
        idempotentReplay: true,
      },
    };
  }

  return {
    action: "block" as const,
    response: {
      success: false,
      code: "gmail_draft_state_uncertain",
      error:
        "A Gmail draft attempt already exists but is not safely repeatable. Check Gmail drafts before trying again.",
    },
  };
}

export function resolveColdMailSendAttempt(
  row: ColdMailDraftAttemptRow | null,
) {
  if (!row) {
    return {
      action: "block" as const,
      response: {
        success: false,
        code: "gmail_draft_not_found",
        error: "The reviewed Gmail draft could not be found for this account.",
      },
    };
  }

  const draftId = asString(row.provider_draft_id);
  const messageId = asString(row.provider_message_id);
  if (row.status === "sent" && draftId && messageId) {
    return {
      action: "replay" as const,
      response: {
        success: true,
        draftId,
        messageId,
        threadId: asString(row.provider_thread_id) || null,
        sentFrom: asString(row.draft_from) || null,
        to: asString(row.recipient_email),
        idempotentReplay: true,
      },
    };
  }

  if (row.status === "created" && draftId) {
    return { action: "send" as const, draftId };
  }

  return {
    action: "block" as const,
    response: {
      success: false,
      code: "gmail_send_state_uncertain",
      error:
        "This Gmail draft is already being processed or has an uncertain delivery state. Check Gmail Sent before trying again.",
    },
  };
}
