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

  // Classification under internal pricing rules:
  // Input: Prompt tokens + Cached content tokens ($0.50 / 1M => 500 nanos)
  // Output: Candidate output tokens + Thinking/Thoughts tokens ($3.00 / 1M => 3000 nanos)
  const inputTokens = promptTokenCount + cachedContentTokenCount;
  const outputTokens = candidatesTokenCount + thoughtsTokenCount;
  const computedTotal = inputTokens + outputTokens;

  return {
    inputTokens,
    outputTokens,
    totalTokens: totalTokenCount > 0 ? totalTokenCount : computedTotal,
  };
}

export async function runMeteredAiCall<T>(
  supabase: SupabaseClient,
  options: MeteredAiOptions,
  callFn: (meta: { requestId: string; maxOutputTokens: number }) => Promise<T>,
): Promise<T> {
  const requestId = crypto.randomUUID();
  const provider = options.provider || "gemini";
  const model = options.model || "gemini-3-flash-preview";

  const estInput = options.estimatedInputTokens || 1000;
  const estOutput = options.estimatedOutputTokens || options.maxOutputTokens || 1024;

  // Nanodollar pricing calculation: Input $0.50/M (500 nanos), Output $3.00/M (3000 nanos)
  const estimatedCostNanos = BigInt(estInput * 500 + estOutput * 3000);
  const payloadHash = options.payload ? await hashPayload(options.payload) : null;

  // 1. Atomic Reservation via RPC
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

  // 2. Dynamic Output Token Clamping
  let effectiveMaxOutputTokens = options.maxOutputTokens || estOutput;
  if (typeof resData.available_nanos === "number" && resData.available_nanos > 0) {
    const maxAffordableOutput = Math.floor(resData.available_nanos / 3000);
    if (maxAffordableOutput < 50) {
      // Release reservation & throw limit error
      await supabase.rpc("release_ai_usage", {
        p_user_id: options.userId,
        p_request_id: requestId,
        p_reason: "insufficient_capacity_for_min_output",
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

  // 3. Execute Model Call & Settle Provider Usage
  try {
    const result = await callFn({
      requestId,
      maxOutputTokens: effectiveMaxOutputTokens,
    });

    const tokenUsage = extractProviderTokenUsage(result);

    // Settle actual tokens atomically
    await supabase.rpc("settle_ai_usage", {
      p_user_id: options.userId,
      p_request_id: requestId,
      p_input_tokens: tokenUsage.inputTokens > 0 ? tokenUsage.inputTokens : estInput,
      p_output_tokens: tokenUsage.outputTokens > 0 ? tokenUsage.outputTokens : estOutput,
      p_billable: true,
      p_metadata: {
        ...(options.metadata || {}),
        settled_model: model,
        extracted_usage: tokenUsage,
      },
    });

    return result;
  } catch (err: any) {
    // Settle failed attempt as non-billable event (retains operational provider cost record)
    await supabase.rpc("settle_ai_usage", {
      p_user_id: options.userId,
      p_request_id: requestId,
      p_input_tokens: estInput,
      p_output_tokens: 0,
      p_billable: false,
      p_metadata: {
        ...(options.metadata || {}),
        error: err?.message || String(err),
      },
    });
    throw err;
  }
}
