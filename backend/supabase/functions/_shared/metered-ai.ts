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
  reservationTtlSeconds?: number;
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
  reservationTtlSeconds?: number;
  execute: (context: MeteredAiCallContext) => Promise<T>;
}

export interface ProviderTokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  hasProviderUsage: boolean;
  usageSource: "provider" | "missing";
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

export class AiUsageIdempotencyError extends Error {
  constructor(
    message: string,
    public readonly requestId: string,
    public readonly code: string,
    public readonly status: string | null,
  ) {
    super(message);
    this.name = "AiUsageIdempotencyError";
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

export async function hashPayload(payload: unknown): Promise<string> {
  const serialized = typeof payload === "string"
    ? payload
    : JSON.stringify(payload ?? {});
  const encoder = new TextEncoder();
  const data = encoder.encode(serialized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function estimatePreflightReservationNanos(
  inputTokens = 1000,
  outputTokens = 1024,
): bigint {
  const input = BigInt(Math.max(0, Math.floor(inputTokens)));
  const output = BigInt(Math.max(0, Math.floor(outputTokens)));
  return input * 500n + output * 3000n;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? value as Record<string, unknown>
    : null;
}

function readFiniteNonNegativeNumber(
  source: Record<string, unknown>,
  key: string,
): number {
  const value = Number(source[key] ?? 0);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function extractProviderTokenUsage(response: unknown): ProviderTokenUsage {
  const responseRecord = asRecord(response);
  const nestedResponse = asRecord(responseRecord?.response);
  const usage = asRecord(responseRecord?.usageMetadata)
    ?? asRecord(nestedResponse?.usageMetadata);

  if (!usage) {
    return {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      hasProviderUsage: false,
      usageSource: "missing",
    };
  }

  const knownUsageKeys = [
    "promptTokenCount",
    "cachedContentTokenCount",
    "candidatesTokenCount",
    "thoughtsTokenCount",
    "thinkingTokenCount",
    "totalTokenCount",
  ];
  const hasProviderUsage = knownUsageKeys.some((key) => key in usage);

  const promptTokenCount = readFiniteNonNegativeNumber(usage, "promptTokenCount");
  const cachedContentTokenCount = readFiniteNonNegativeNumber(
    usage,
    "cachedContentTokenCount",
  );
  const candidatesTokenCount = readFiniteNonNegativeNumber(
    usage,
    "candidatesTokenCount",
  );
  const thoughtsTokenCount = Math.max(
    readFiniteNonNegativeNumber(usage, "thoughtsTokenCount"),
    readFiniteNonNegativeNumber(usage, "thinkingTokenCount"),
  );
  const totalTokenCount = readFiniteNonNegativeNumber(usage, "totalTokenCount");

  const inputTokens = Math.floor(promptTokenCount + cachedContentTokenCount);
  const outputTokens = Math.floor(candidatesTokenCount + thoughtsTokenCount);
  const computedTotal = inputTokens + outputTokens;

  return {
    inputTokens,
    outputTokens,
    totalTokens: Math.floor(totalTokenCount > 0 ? totalTokenCount : computedTotal),
    hasProviderUsage,
    usageSource: hasProviderUsage ? "provider" : "missing",
  };
}

export async function reserveAiUsage(
  options: MeteredAiReserveOptions,
): Promise<{
  requestId: string;
  availableNanos: number;
  idempotent: boolean;
  status: string;
}> {
  const requestId = options.requestId ?? crypto.randomUUID();
  const provider = options.provider ?? "gemini";
  const model = options.model ?? "gemini-3-flash-preview";
  const estimatedInputTokens = options.estimatedInputTokens ?? 1000;
  const estimatedOutputTokens = options.estimatedOutputTokens
    ?? options.maxOutputTokens
    ?? 1024;
  const estimatedCostNanos = estimatePreflightReservationNanos(
    estimatedInputTokens,
    estimatedOutputTokens,
  );
  const payloadHash = options.payload === undefined
    ? null
    : await hashPayload(options.payload);
  const metadata: Record<string, unknown> = {
    ...(options.metadata ?? {}),
  };
  if (options.reservationTtlSeconds !== undefined) {
    metadata.reservation_ttl_seconds = options.reservationTtlSeconds;
  }

  const { data, error } = await options.serviceClient.rpc("reserve_ai_usage", {
    p_user_id: options.userId,
    p_request_id: requestId,
    p_feature_key: options.featureKey,
    p_provider: provider,
    p_model: model,
    p_estimated_cost_nanos: Number(estimatedCostNanos),
    p_parent_request_id: options.parentRequestId ?? null,
    p_payload_hash: payloadHash,
    p_metadata: metadata,
  });

  if (error) {
    console.error("[metered-ai] RPC reserve error:", error);
    throw new Error(`AI usage reservation failed: ${error.message}`);
  }

  const result = asRecord(data);
  if (!result || result.success !== true) {
    const code = typeof result?.error === "string"
      ? result.error
      : "AI_USAGE_RESERVATION_REJECTED";
    const message = typeof result?.message === "string"
      ? result.message
      : "AI usage reservation rejected";

    if (code === "AI_USAGE_LIMIT_REACHED") {
      const rawWindow = typeof result?.window === "string"
        ? result.window
        : "rolling_24h";
      const window = rawWindow === "weekly" || rawWindow === "monthly"
        ? rawWindow
        : "rolling_24h";
      throw new MeteredAiLimitError(
        message,
        window,
        typeof result?.resetsAt === "string" ? result.resetsAt : null,
        Boolean(result?.resetsGradually),
      );
    }

    if (
      code === "AI_REQUEST_IN_PROGRESS"
      || code === "AI_REQUEST_ALREADY_COMPLETED"
      || code === "AI_REQUEST_EXPIRED"
      || code === "INVALID_REQUEST_ID_REUSE"
    ) {
      throw new AiUsageIdempotencyError(
        message,
        requestId,
        code,
        typeof result?.status === "string" ? result.status : null,
      );
    }

    throw new Error(message);
  }

  return {
    requestId,
    availableNanos: Number(result.available_nanos ?? 0),
    idempotent: result.idempotent === true,
    status: typeof result.status === "string" ? result.status : "reserved",
  };
}

export async function settleAiUsage(
  options: MeteredAiSettleOptions,
): Promise<Record<string, unknown>> {
  const { data, error } = await options.serviceClient.rpc("settle_ai_usage", {
    p_user_id: options.userId,
    p_request_id: options.requestId,
    p_input_tokens: options.inputTokens,
    p_output_tokens: options.outputTokens,
    p_billable: options.billable ?? true,
    p_metadata: options.metadata ?? {},
  });

  if (error) {
    console.error("[metered-ai] RPC settle error:", error);
    throw new AiUsageSettlementError(
      `AI usage settlement failed: ${error.message}`,
      options.requestId,
    );
  }

  const result = asRecord(data);
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

export async function releaseAiUsage(
  options: MeteredAiReleaseOptions,
): Promise<void> {
  const { data, error } = await options.serviceClient.rpc("release_ai_usage", {
    p_user_id: options.userId,
    p_request_id: options.requestId,
    p_reason: options.reason ?? "cancelled",
  });

  if (error) {
    console.error("[metered-ai] RPC release error:", error);
    throw new Error(`AI usage release failed: ${error.message}`);
  }

  const result = asRecord(data);
  if (!result || result.success !== true) {
    throw new Error("AI usage release was rejected");
  }
}

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

export async function runMeteredAiCall<T>(
  options: MeteredAiCallOptions<T>,
): Promise<T> {
  const serviceClient = getServiceClient(options.serviceClient);
  const estimatedInputTokens = options.estimatedInputTokens
    ?? (options.promptTextLength !== undefined
      ? Math.max(1, Math.ceil(options.promptTextLength / 4))
      : 1000);
  const estimatedOutputTokens = options.estimatedOutputTokens
    ?? options.maxOutputTokens
    ?? 1024;

  const reservation = await reserveAiUsage({
    serviceClient,
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
    reservationTtlSeconds: options.reservationTtlSeconds,
  });

  if (reservation.idempotent || reservation.status !== "reserved") {
    throw new AiUsageIdempotencyError(
      `AI request ${reservation.requestId} is already in ${reservation.status} state.`,
      reservation.requestId,
      "AI_REQUEST_ALREADY_EXISTS",
      reservation.status,
    );
  }

  const estimatedInputCostNanos = estimatedInputTokens * 500;
  const affordableOutputBudgetNanos = Math.max(
    0,
    reservation.availableNanos - estimatedInputCostNanos,
  );
  const maxAffordableOutputTokens = Math.floor(affordableOutputBudgetNanos / 3000);
  let effectiveMaxOutputTokens = options.maxOutputTokens ?? estimatedOutputTokens;

  if (maxAffordableOutputTokens < 50) {
    try {
      await releaseAiUsage({
        serviceClient,
        userId: options.userId,
        requestId: reservation.requestId,
        reason: "insufficient_capacity_for_min_output",
      });
    } catch (releaseError) {
      logCriticalReconciliation({
        request_id: reservation.requestId,
        user_id: options.userId,
        feature_key: options.featureKey,
        provider_succeeded: false,
        release_error: releaseError instanceof Error
          ? releaseError.message
          : String(releaseError),
      });
    }
    throw new MeteredAiLimitError(
      "You’ve reached your AI usage limit for this period.",
      "rolling_24h",
      null,
      true,
    );
  }
  effectiveMaxOutputTokens = Math.min(
    effectiveMaxOutputTokens,
    maxAffordableOutputTokens,
  );

  let rawResult: T;
  try {
    rawResult = await options.execute({
      requestId: reservation.requestId,
      maxOutputTokens: effectiveMaxOutputTokens,
    });
  } catch (providerError) {
    const failedUsage = extractProviderTokenUsage(providerError);
    try {
      if (
        failedUsage.hasProviderUsage
        && (failedUsage.inputTokens > 0 || failedUsage.outputTokens > 0)
      ) {
        await settleAiUsage({
          serviceClient,
          userId: options.userId,
          requestId: reservation.requestId,
          inputTokens: failedUsage.inputTokens,
          outputTokens: failedUsage.outputTokens,
          billable: false,
          metadata: {
            ...(options.metadata ?? {}),
            usage_source: "provider",
            provider_usage_confirmed: true,
            provider_succeeded: false,
            provider_error: providerError instanceof Error
              ? providerError.message
              : String(providerError),
          },
        });
      } else {
        await releaseAiUsage({
          serviceClient,
          userId: options.userId,
          requestId: reservation.requestId,
          reason: providerError instanceof Error
            ? providerError.message
            : "provider_error_without_usage_metadata",
        });
      }
    } catch (ledgerError) {
      logCriticalReconciliation({
        request_id: reservation.requestId,
        user_id: options.userId,
        feature_key: options.featureKey,
        provider_succeeded: false,
        provider_usage_confirmed: failedUsage.hasProviderUsage,
        ledger_error: ledgerError instanceof Error
          ? ledgerError.message
          : String(ledgerError),
      });
    }
    throw providerError;
  }

  const tokenUsage = extractProviderTokenUsage(rawResult);
  const providerUsageConfirmed = tokenUsage.hasProviderUsage;
  const inputTokens = providerUsageConfirmed
    ? tokenUsage.inputTokens
    : estimatedInputTokens;
  const outputTokens = providerUsageConfirmed
    ? tokenUsage.outputTokens
    : effectiveMaxOutputTokens;

  if (!providerUsageConfirmed) {
    logCriticalReconciliation({
      request_id: reservation.requestId,
      user_id: options.userId,
      feature_key: options.featureKey,
      provider_succeeded: true,
      provider_usage_confirmed: false,
      estimated_input_tokens: inputTokens,
      estimated_output_tokens: outputTokens,
      reason: "provider_usage_metadata_missing",
    });
  }

  try {
    await settleAiUsage({
      serviceClient,
      userId: options.userId,
      requestId: reservation.requestId,
      inputTokens,
      outputTokens,
      billable: true,
      metadata: {
        ...(options.metadata ?? {}),
        settled_model: options.model ?? "gemini-3-flash-preview",
        usage_source: providerUsageConfirmed ? "provider" : "estimated",
        provider_usage_confirmed: providerUsageConfirmed,
        extracted_usage: tokenUsage,
      },
    });
  } catch (settlementError) {
    logCriticalReconciliation({
      request_id: reservation.requestId,
      user_id: options.userId,
      feature_key: options.featureKey,
      provider_succeeded: true,
      provider_usage_confirmed: providerUsageConfirmed,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      settlement_error: settlementError instanceof Error
        ? settlementError.message
        : String(settlementError),
    });
    throw new AiUsageSettlementError(
      "AI provider completed but usage settlement failed; reconciliation is required.",
      reservation.requestId,
    );
  }

  return rawResult;
}
