import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface MeteredAiReserveOptions {
  serviceClient: SupabaseClient;
  userId: string;
  featureKey: string;
  requestId?: string;
  provider?: string;
  model?: string;
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  maxOutputTokens?: number;
  parentRequestId?: string;
  payload?: any;
  metadata?: Record<string, any>;
}

export interface MeteredAiSettleOptions {
  serviceClient: SupabaseClient;
  userId: string;
  requestId: string;
  inputTokens: number;
  outputTokens: number;
  billable?: boolean;
  metadata?: Record<string, any>;
}

export interface MeteredAiReleaseOptions {
  serviceClient: SupabaseClient;
  userId: string;
  requestId: string;
  reason?: string;
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

// Compute nanodollar preflight reservation cost ($0.50/1M input => 500 nanos, $3.00/1M output => 3000 nanos)
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

// Unified Object-Based Reserve API
export async function reserveAiUsage(
  options: MeteredAiReserveOptions,
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

  const { data: resData, error: resErr } = await options.serviceClient.rpc("reserve_ai_usage", {
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

// Unified Object-Based Settle API
export async function settleAiUsage(
  options: MeteredAiSettleOptions,
): Promise<void> {
  const { error } = await options.serviceClient.rpc("settle_ai_usage", {
    p_user_id: options.userId,
    p_request_id: options.requestId,
    p_input_tokens: options.inputTokens,
    p_output_tokens: options.outputTokens,
    p_billable: options.billable ?? true,
    p_metadata: options.metadata || {},
  });

  if (error) {
    console.error("[metered-ai] RPC settle error:", error);
    throw new Error(`AI usage settlement failed: ${error.message}`);
  }
}

// Unified Object-Based Release API
export async function releaseAiUsage(
  options: MeteredAiReleaseOptions,
): Promise<void> {
  const { error } = await options.serviceClient.rpc("release_ai_usage", {
    p_user_id: options.userId,
    p_request_id: options.requestId,
    p_reason: options.reason || "cancelled",
  });

  if (error) {
    console.error("[metered-ai] RPC release error:", error);
  }
}

// Explicitly Named Internal Unmetered System Call (for reviewed background system tasks ONLY)
export async function runInternalUnmeteredAiCall<T>(
  reason: string,
  callFn: () => Promise<T>,
): Promise<T> {
  console.info(`[metered-ai] System call bypassing metering: ${reason}`);
  return await callFn();
}

// Unified runMeteredAiCall wrapper supporting object options or positional args
export async function runMeteredAiCall<T>(
  arg1: any,
  arg2?: any,
  arg3?: any,
): Promise<T> {
  let supabase: SupabaseClient;
  let options: Omit<MeteredAiReserveOptions, "serviceClient">;
  let callFn: (meta: { requestId: string; maxOutputTokens: number }) => Promise<T>;

  if (arg1 && typeof arg1.rpc === "function") {
    // Positional signature: (supabase, options, callFn)
    supabase = arg1;
    options = arg2;
    callFn = arg3;
  } else {
    // Options object signature: ({ serviceClient, userId, featureKey, callFn, execute, promptTextLength, ... })
    const opts = arg1;
    supabase = opts.serviceClient;
    options = {
      userId: opts.userId,
      featureKey: opts.featureKey,
      provider: opts.provider,
      model: opts.model,
      estimatedInputTokens: opts.estimatedInputTokens || (opts.promptTextLength ? Math.ceil(opts.promptTextLength / 4) : 1000),
      estimatedOutputTokens: opts.estimatedOutputTokens,
      maxOutputTokens: opts.maxOutputTokens,
      parentRequestId: opts.parentRequestId,
      payload: opts.payload,
      metadata: opts.metadata,
    };
    callFn = opts.callFn || (async (meta: any) => {
      if (typeof opts.execute === "function") {
        const execRes = await opts.execute(meta);
        return execRes;
      }
      throw new Error("callFn or execute function required for runMeteredAiCall");
    });
  }

  const estOutput = options.estimatedOutputTokens || options.maxOutputTokens || 1024;
  const { requestId, availableNanos } = await reserveAiUsage({
    ...options,
    serviceClient: supabase,
  });

  let effectiveMaxOutputTokens = options.maxOutputTokens || estOutput;
  if (availableNanos > 0) {
    const maxAffordableOutput = Math.floor(availableNanos / 3000);
    if (maxAffordableOutput < 50) {
      await releaseAiUsage({
        serviceClient: supabase,
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
    const rawResult = await callFn({
      requestId,
      maxOutputTokens: effectiveMaxOutputTokens,
    });

    const tokenUsage = extractProviderTokenUsage(rawResult);
    const estInput = options.estimatedInputTokens || 1000;

    await settleAiUsage({
      serviceClient: supabase,
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

    return rawResult as T;
  } catch (err: any) {
    const estInput = options.estimatedInputTokens || 1000;
    await settleAiUsage({
      serviceClient: supabase,
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
