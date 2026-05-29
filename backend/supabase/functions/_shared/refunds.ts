type RefundCreditsParams = {
  serviceClient: any;
  userId: string;
  amount: number;
  description: string;
  referenceType?: string;
  referenceId?: string | null;
  metadata?: Record<string, unknown>;
};

function asPositiveInteger(value: unknown): number {
  const amount = Math.floor(Number(value));
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function asRpcObject(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

function rpcSucceeded(raw: unknown): boolean {
  const row = asRpcObject(raw);
  const success = row?.success;
  return success === true || success === "true" || String(success).toLowerCase() === "t";
}

export async function refundUserCredits({
  serviceClient,
  userId,
  amount,
  description,
  referenceType = "refund",
  referenceId = null,
  metadata = {},
}: RefundCreditsParams): Promise<Record<string, unknown>> {
  const refundAmount = asPositiveInteger(amount);
  if (refundAmount <= 0) {
    return { success: false, reason: "invalid_amount", message: "Refund amount must be greater than 0." };
  }

  const payload = {
    p_user_id: userId,
    p_amount: refundAmount,
    p_description: description,
    p_reference_type: referenceType,
    p_reference_id: referenceId,
    p_metadata: metadata,
  };

  const { data, error } = await serviceClient.rpc("refund_credits", payload);
  if (!error && rpcSucceeded(data)) {
    return asRpcObject(data) || { success: true };
  }

  if (error && !String(error.message || "").includes("refund_credits")) {
    throw error;
  }

  const fallback = await serviceClient.rpc("add_credits", payload);
  if (fallback.error) {
    throw fallback.error;
  }
  return asRpcObject(fallback.data) || { success: true, fallback: true };
}

export async function refundAiChatTurn({
  serviceClient,
  userId,
  consumed,
  reason,
  metadata = {},
}: {
  serviceClient: any;
  userId: string;
  consumed: Record<string, unknown> | null;
  reason: string;
  metadata?: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const source = typeof consumed?.source === "string" ? consumed.source : "credits";
  const creditsUsed = asPositiveInteger(consumed?.credits_used);
  const periodEnd = typeof consumed?.period_end === "string" ? consumed.period_end : null;

  const { data, error } = await serviceClient.rpc("refund_ai_chat_message", {
    p_user_id: userId,
    p_source: source,
    p_credits: Math.max(1, creditsUsed || 1),
    p_period_end: periodEnd,
    p_reason: reason,
    p_metadata: metadata,
  });

  if (!error && rpcSucceeded(data)) {
    return asRpcObject(data) || { success: true };
  }

  if (source === "credits") {
    return refundUserCredits({
      serviceClient,
      userId,
      amount: Math.max(1, creditsUsed || 1),
      description: `Refund: ${reason}`,
      referenceType: "refund",
      metadata: {
        ...metadata,
        source: "ai_chat",
        original_source: source,
      },
    });
  }

  if (error) {
    throw error;
  }
  return asRpcObject(data) || { success: false, reason: "refund_failed" };
}

