import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  payload?: unknown;
  metadata?: Record<string, unknown>;
}

export interface MeteredAiSettleOptions {
  serviceClient: SupabaseClient;
  userId: string;
  requestId: string;
  inputTokens: number;
  outputTokens: number;
  billable?: boolean;
  metadata?: Record<string, unknown>;
}

export interface MeteredAiReleaseOptions {
  serviceClient: SupabaseClient;
  userId: string;
  requestId: string;
  reason?: string;
}

export interface MeteredAiCallContext {
  requestId: string;
  maxOutputTokens: number;
}

/** The only supported public contract for a metered provider call. */
export interface MeteredAiCallOptions<T> {
  serviceClient?: SupabaseClient;
  userId: string;
  featureKey: string;
  requestId?: string;
  provider?: string;
  model?: string;
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  maxOutputTokens?: number;
  promptTextLength?: number;
  parentRequestId?: string;
  payload?: unknown;
  metadata?: Record<string, unknown>;
  execute: (context: MeteredAiCallContext) => Promise<T>;
}

export class AiUsageSettlementError extends Error {
  constructor(
    message: string,
    public readonly requestId: string,
  ) {
    super(message);
    this.name = "AiUsageSettlementError";
  }
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
export async function hashPayload(payload: unknown): Promise<string> {
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
): Promise<Record<string, unknown>> {
  const { data, error } = await options.serviceClient.rpc("settle_ai_usage", {
    p_user_id: options.userId,
    p_request_id: options.requestId,
    p_input_tokens: options.inputTokens,
    p_output_tokens: options.outputTokens,
    p_billable: options.billable ?? true,
    p_metadata: options.metadata || {},
  });

  if (error) {
    console.error("[metered-ai] RPC settle error:", error);
    throw new AiUsageSettlementError(
      `AI usage settlement failed: ${error.message}`,
      options.requestId,
    );
  }

  const result = data && typeof data === "object"
    ? data as Record<string, unknown>
    : null;
  if (!result || result.success !== true) {
    throw new AiUsageSettlementError(
      typeof result?.message === "string"
        ? `AI usage settlement rejected: ${result.message}`
        : "AI usage settlement rejected",
      options.requestId,
    );
  }

  return result;
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

function getServiceClient(serviceClient?: SupabaseClient): SupabaseClient {
  if (serviceClient) return serviceClient;

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase service credentials for AI usage metering.");
  }
  return createClient(url, serviceRoleKey);
}

function logCriticalReconciliation(details: Record<string, unknown>): void {
  console.error(
    "[metered-ai] CRITICAL_RECONCILIATION_REQUIRED",
    JSON.stringify({ event: "ai_usage_reconciliation_required", ...details }),
  );
}

// Unified, object-only metering wrapper. Provider and ledger failures are deliberately separate.
export async function runMeteredAiCall<T>(
  options: MeteredAiCallOptions<T>,
): Promise<T> {
  const supabase = getServiceClient(options.serviceClient);
  const estimatedInputTokens = options.estimatedInputTokens
    ?? (options.promptTextLength !== undefined ? Math.ceil(options.promptTextLength / 4) : 1000);
  const estOutput = options.estimatedOutputTokens ?? options.maxOutputTokens ?? 1024;
  const { requestId, availableNanos } = await reserveAiUsage({
    serviceClient: supabase,
    userId: options.userId,
    featureKey: options.featureKey,
    requestId: options.requestId,
    provider: options.provider,
    model: options.model,
    estimatedInputTokens,
    estimatedOutputTokens: options.estimatedOutputTokens,
    maxOutputTokens: options.maxOutputTokens,
    parentRequestId: options.parentRequestId,
    payload: options.payload,
    metadata: options.metadata,
  });

  let effectiveMaxOutputTokens = options.maxOutputTokens ?? estOutput;
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

  let rawResult: T;
  try {
    rawResult = await options.execute({
      requestId,
      maxOutputTokens: effectiveMaxOutputTokens,
    });
  } catch (providerError) {
    await settleAiUsage({
      serviceClient: supabase,
      userId: options.userId,
      requestId,
      inputTokens: estimatedInputTokens,
      outputTokens: 0,
      billable: false,
      metadata: {
        ...(options.metadata ?? {}),
        provider_error: providerError instanceof Error
          ? providerError.message
          : String(providerError),
      },
    }).catch((settlementError) => {
      logCriticalReconciliation({
        request_id: requestId,
        user_id: options.userId,
        feature_key: options.featureKey,
        provider_succeeded: false,
        settlement_error: settlementError instanceof Error
          ? settlementError.message
          : String(settlementError),
      });
    });
    throw providerError;
  }

  const tokenUsage = extractProviderTokenUsage(rawResult);
  const inputTokens = tokenUsage.inputTokens > 0 ? tokenUsage.inputTokens : estimatedInputTokens;
  const outputTokens = tokenUsage.outputTokens > 0 ? tokenUsage.outputTokens : estOutput;

  try {
    await settleAiUsage({
      serviceClient: supabase,
      userId: options.userId,
      requestId,
      inputTokens,
      outputTokens,
      billable: true,
      metadata: {
        ...(options.metadata ?? {}),
        settled_model: options.model ?? "gemini-3-flash-preview",
        extracted_usage: tokenUsage,
      },
    });
  } catch (settlementError) {
    // Explicit policy: fail the user-visible operation and emit a durable structured log for reconciliation.
    // Never write a second, non-billable settlement after a successful provider call.
    logCriticalReconciliation({
      request_id: requestId,
      user_id: options.userId,
      feature_key: options.featureKey,
      provider_succeeded: true,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      settlement_error: settlementError instanceof Error
        ? settlementError.message
        : String(settlementError),
    });
    throw new AiUsageSettlementError(
      "AI provider completed but usage settlement failed; reconciliation is required.",
      requestId,
    );
  }

  return rawResult;
}
