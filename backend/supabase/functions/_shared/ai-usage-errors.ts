const FALLBACK_RESERVATION_ERROR =
  "We couldn’t reserve AI capacity for this request. Please try again.";

export function getAiReservationErrorMessage(
  code: unknown,
  message?: unknown,
): string {
  const providedMessage =
    typeof message === "string" &&
    message.trim() &&
    message !== "AI usage reservation rejected"
      ? message.trim()
      : null;

  if (providedMessage) return providedMessage;

  switch (code) {
    case "AI_USAGE_LIMIT_REACHED":
      return "You’ve reached your AI usage limit for now. It becomes available again as your 24-hour allowance rolls forward.";
    case "AI_REQUEST_IN_PROGRESS":
      return "This AI request is already in progress. Please wait for it to finish.";
    case "AI_REQUEST_EXPIRED":
      return "This AI request expired before it could start. Please send it again.";
    case "AI_REQUEST_ALREADY_COMPLETED":
      return "This AI request has already completed. Please send a new message.";
    case "INVALID_REQUEST_ID_REUSE":
      return "This AI request could not be reused. Please send your message again.";
    default:
      return FALLBACK_RESERVATION_ERROR;
  }
}
