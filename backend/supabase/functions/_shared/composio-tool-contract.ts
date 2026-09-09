/**
 * Direct Composio execution requires a dated toolkit version when application
 * code parses the response. Keep this pin aligned with the Gmail toolkit
 * catalog before adopting a newer output schema.
 */
export const GMAIL_TOOLKIT_VERSION = "20260828_00";

export const buildComposioExecuteBody = (
  userId: string,
  args: Record<string, unknown>,
) => ({
  user_id: userId,
  arguments: args,
  version: GMAIL_TOOLKIT_VERSION,
});

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const looksLikeToolPayload = (value: Record<string, unknown>) =>
  [
    "messages",
    "labels",
    "id",
    "draft_id",
    "draftId",
    "message_id",
    "messageId",
    "thread_id",
    "threadId",
  ].some((key) => key in value);

/** Unwraps the SDK and REST envelopes while preserving draft-specific IDs. */
export function unwrapComposioToolData(
  result: unknown,
): Record<string, unknown> {
  const root = asRecord(result);
  if (!root) return {};

  const successful = root.successful ?? root.success;
  if (successful === false) {
    const error = asRecord(root.error);
    const message = typeof root.error === "string" ? root.error : error?.message;
    throw new Error(
      typeof message === "string" && message
        ? message
        : "Composio reported the Gmail action as unsuccessful",
    );
  }

  for (const key of ["data", "response_data", "result"]) {
    const nested = asRecord(root[key]);
    if (!nested) continue;
    const deeper = asRecord(nested.response_data) ?? asRecord(nested.data);
    return deeper && looksLikeToolPayload(deeper) ? deeper : nested;
  }

  return root;
}
