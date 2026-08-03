import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface MeteredAiOptions {
  userId: string;
  featureKey: string;
  provider?: string;
  model?: string;
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  maxOutputTokens?: number;
  parentRequestId?: string;
  requestId?: string;
  payload?: any;
  metadata?: Record<string, any>;
}

export class MeteredAiLimitError extends Error {
  public window: "rolling_24h" | "weekly" | "monthly";
  public resetsAt: string | null;
  public resetsGradually: boolean;

  constructor(
    message: string,
    window: "rolling_24h" | "weekly" | "monthly",
    resetsAt: string | null,
    resetsGradually: boolean,
  ) {
    super(message);
    this.name = "MeteredAiLimitError";
    this.window = window;
    this.resetsAt = resetsAt;
    this.resetsGradually = resetsGradually;
  }
}

// Compute SHA-256 payload hash server-side
export async function hashPayload(payload: any): Promise<string> {
  const str = typeof payload === "string" ? payload : JSON.stringify(payload || {});
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Compute nanodollar preflight reservation cost
// Input tokens: $0.50 per 1M (500 nanos/token)
// Output tokens: $3.00 per 1M (3000 nanos/token)
export function estimatePreflightReservationNanos(
  inputTokens = 1000,
  outputTokens = 1024,
): bigint {
  const input = BigInt(Math.max(0, Math.floor(inputTokens)));
  const output = BigInt(Math.max(0, Math.floor(outputTokens)));
  return input * 500n + output * 3000n;
}

// Extract provider token usage metadata from Gemini response object
export function extractProviderTokenUsage(response: any): {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
} {
  const usage = response?.usageMetadata || response?.response?.usageMetadata || {};

  const promptTokenCount = Number(usage.promptTokenCount || 0);
  const cachedContentTokenCount = Number(usage.cachedContentTokenCount || 0);
  const candidatesTokenCount = Number(usage.candidatesTokenCount || 0);
  const thoughtsTokenCount = Number(
    usage.thoughtsTokenCount || usage.thinkingTokenCount || 0,
  );
  const totalTokenCount = Number(usage.totalTokenCount || 0);

  const inputTokens = promptTokenCount + cachedContentTokenCount;
  const outputTokens = candidatesTokenCount + thoughtsTokenCount;
  const computedTotal = inputTokens + outputTokens;

  return {
    inputTokens,
    outputTokens,
    totalTokens: totalTokenCount > 0 ? totalTokenCount : computedTotal,
  };
}

// Exported reservation helper for manual/streaming calls
export async function reserveAiUsage(
  supabase: SupabaseClient,
  options: MeteredAiOptions,
): Promise<{
  requestId: string;
  availableNanos: number;
}> {
  const requestId = options.requestId || crypto.randomUUID();
  const provider = options.provider || "gemini";
  const model = options.model || "gemini-3-flash-preview";

  const estInput = options.estimatedInputTokens || 1000;
  const estOutput = options.estimatedOutputTokens || options.maxOutputTokens || 1024;
  const estimatedCostNanos = estimatePreflightReservationNanos(estInput, estOutput);
  const payloadHash = options.payload ? await hashPayload(options.payload) : null;

  const { data: resData, error: resErr } = await supabase.rpc("reserve_ai_usage", {
    p_user_id: options.userId,
    p_request_id: requestId,
    p_feature_key: options.featureKey,
    p_provider: provider,
    p_model: model,
    p_estimated_cost_nanos: Number(estimatedCostNanos),
    p_parent_request_id: options.parentRequestId || null,
    p_payload_hash: payloadHash,
    p_metadata: options.metadata || {},
  });

  if (resErr) {
    console.error("[metered-ai] RPC reserve error:", resErr);
    throw new Error(`AI usage reservation failed: ${resErr.message}`);
  }

  if (!resData || !resData.success) {
    if (resData?.error === "AI_USAGE_LIMIT_REACHED") {
      throw new MeteredAiLimitError(
        resData.message || "You’ve reached your AI usage limit for this period.",
        resData.window || "rolling_24h",
        resData.resetsAt || null,
        Boolean(resData.resetsGradually),
      );
    }
    throw new Error(resData?.message || "AI usage reservation rejected");
  }

  return {
    requestId,
    availableNanos: Number(resData.available_nanos ?? 0),
  };
}

// Exported settlement helper for manual/streaming calls
export async function settleAiUsage(
  supabase: SupabaseClient,
  options: {
    userId: string;
    requestId: string;
    inputTokens: number;
    outputTokens: number;
    billable?: boolean;
    metadata?: Record<string, any>;
  },
): Promise<void> {
  const { error } = await supabase.rpc("settle_ai_usage", {
    p_user_id: options.userId,
    p_request_id: options.requestId,
    p_input_tokens: options.inputTokens,
    p_output_tokens: options.outputTokens,
    p_billable: options.billable ?? true,
    p_metadata: options.metadata || {},
  });

  if (error) {
    console.error("[metered-ai] RPC settle error:", error);
  }
}

// Exported release helper for cancelled/failed calls
export async function releaseAiUsage(
  supabase: SupabaseClient,
  options: {
    userId: string;
    requestId: string;
    reason?: string;
  },
): Promise<void> {
  const { error } = await supabase.rpc("release_ai_usage", {
    p_user_id: options.userId,
    p_request_id: options.requestId,
    p_reason: options.reason || "cancelled",
  });

  if (error) {
    console.error("[metered-ai] RPC release error:", error);
  }
}

// Unified runMeteredAiCall helper
export async function runMeteredAiCall<T>(
  supabase: SupabaseClient,
  options: MeteredAiOptions,
  callFn: (meta: { requestId: string; maxOutputTokens: number }) => Promise<T>,
): Promise<T> {
  const estOutput = options.estimatedOutputTokens || options.maxOutputTokens || 1024;
  const { requestId, availableNanos } = await reserveAiUsage(supabase, options);

  let effectiveMaxOutputTokens = options.maxOutputTokens || estOutput;
  if (availableNanos > 0) {
    const maxAffordableOutput = Math.floor(availableNanos / 3000);
    if (maxAffordableOutput < 50) {
      await releaseAiUsage(supabase, {
        userId: options.userId,
        requestId,
        reason: "insufficient_capacity_for_min_output",
      });
      throw new MeteredAiLimitError(
        "You’ve reached your AI usage limit for this period.",
        "rolling_24h",
        null,
        true,
      );
    }
    effectiveMaxOutputTokens = Math.min(effectiveMaxOutputTokens, maxAffordableOutput);
  }

  try {
    const result = await callFn({
      requestId,
      maxOutputTokens: effectiveMaxOutputTokens,
    });

    const tokenUsage = extractProviderTokenUsage(result);
    const estInput = options.estimatedInputTokens || 1000;

    await settleAiUsage(supabase, {
      userId: options.userId,
      requestId,
      inputTokens: tokenUsage.inputTokens > 0 ? tokenUsage.inputTokens : estInput,
      outputTokens: tokenUsage.outputTokens > 0 ? tokenUsage.outputTokens : estOutput,
      billable: true,
      metadata: {
        ...(options.metadata || {}),
        settled_model: options.model || "gemini-3-flash-preview",
        extracted_usage: tokenUsage,
      },
    });

    return result;
  } catch (err: any) {
    const estInput = options.estimatedInputTokens || 1000;
    await settleAiUsage(supabase, {
      userId: options.userId,
      requestId,
      inputTokens: estInput,
      outputTokens: 0,
      billable: false,
      metadata: {
        ...(options.metadata || {}),
        error: err?.message || String(err),
      },
    });
    throw err;
  }
}
