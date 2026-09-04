const AI_CAPACITY_LIMIT_MESSAGE =
  "Your AI allowance has been used for now. You can continue with available credits, or wait as capacity becomes available gradually over your rolling 5-hour allowance.";

export const getAiCapacityErrorMessage = (raw: unknown): string | null => {
  const message = typeof raw === "string" ? raw : String(raw || "");
  const normalized = message.toLowerCase();

  if (
    normalized.includes("ai usage reservation rejected") ||
    normalized.includes("ai_usage_limit_reached") ||
    normalized.includes("reached your ai usage limit")
  ) {
    return AI_CAPACITY_LIMIT_MESSAGE;
  }

  return null;
};

export const isAiCapacityExhausted = (percentLeft: number | undefined) =>
  typeof percentLeft === "number" && percentLeft <= 0;
