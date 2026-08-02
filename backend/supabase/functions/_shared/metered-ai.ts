import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SubscriptionAccessError } from "./subscription.ts";

export const INPUT_COST_NANOS_PER_TOKEN = 500n;   // $0.50 per 1,000,000 tokens
export const OUTPUT_COST_NANOS_PER_TOKEN = 3000n;  // $3.00 per 1,000,000 tokens
export const ONE_USD_NANOS = 1_000_000_000n;

export function calculateAiCostNanos(
  inputTokens: number | bigint,
  outputTokens: number | bigint,
): bigint {
  const input = BigInt(Math.max(0, Math.floor(Number(inputTokens) || 0)));
  const output = BigInt(Math.max(0, Math.floor(Number(outputTokens) || 0)));
  return input * INPUT_COST_NANOS_PER_TOKEN + output * OUTPUT_COST_NANOS_PER_TOKEN;
}

export function estimatePreflightReservationNanos(
  promptTextLength: number = 0,
  maxOutputTokens: number = 2048,
): bigint {
  const estimatedInputTokens = Math.max(100, Math.ceil(promptTextLength / 3));
  const estimatedOutputTokens = Math.max(250, maxOutputTokens);
  return calculateAiCostNanos(estimatedInputTokens, estimatedOutputTokens);
}

function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export interface MeteredUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thinkingTokenCount?: number;
  totalTokenCount?: number;
}

export interface RunMeteredAiCallOptions<T> {
  userId: string;
  subscriptionTier?: string | null;
  featureKey: string;
  requestId?: string;
  parentRequestId?: string;
  provider?: string;
  model?: string;
  promptTextLength?: number;
  maxOutputTokens?: number;
  estimatedCostNanos?: bigint | number;
  metadata?: Record<string, unknown>;
  execute: (context: {
    requestId: string;
    model: string;
  }) => Promise<{
    result: T;
    usageMetadata?: MeteredUsageMetadata | null;
    modelUsed?: string;
  }>;
}

export interface MeteredAiLimitErrorPayload {
  error: "AI_USAGE_LIMIT_REACHED";
  window: "rolling_24h" | "weekly" | "monthly";
  message: string;
  resetsAt: string | null;
  resetsGradually: boolean;
}

export class MeteredAiLimitError extends SubscriptionAccessError {
  payload: MeteredAiLimitErrorPayload;

  constructor(payload: MeteredAiLimitErrorPayload) {
    super(429, payload.message);
    this.name = "MeteredAiLimitError";
    this.payload = payload;
  }
}

export async function reserveAiUsage(options: {
  userId: string;
  requestId: string;
  featureKey: string;
  provider?: string;
  model?: string;
  estimatedCostNanos: bigint;
  parentRequestId?: string;
  metadata?: Record<string, unknown>;
  serviceClient?: any;
}) {
  const serviceClient = options.serviceClient || createServiceClient();
  const { data, error } = await serviceClient.rpc("reserve_ai_usage", {
    p_user_id: options.userId,
    p_request_id: options.requestId,
    p_feature_key: options.featureKey,
    p_provider: options.provider || "gemini",
    p_model: options.model || "gemini-3-flash-preview",
    p_estimated_cost_nanos: Number(options.estimatedCostNanos),
    p_parent_request_id: options.parentRequestId || null,
    p_metadata: options.metadata || {},
  });

  if (error) {
    console.error("[metered-ai] reserve_ai_usage RPC error:", error);
    return { success: true, fallback: true };
  }

  return data;
}

export async function settleAiUsage(options: {
  userId: string;
  requestId: string;
  inputTokens: number;
  outputTokens: number;
  billable?: boolean;
  metadata?: Record<string, unknown>;
  serviceClient?: any;
}) {
  const serviceClient = options.serviceClient || createServiceClient();
  const { data, error } = await serviceClient.rpc("settle_ai_usage", {
    p_user_id: options.userId,
    p_request_id: options.requestId,
    p_input_tokens: options.inputTokens,
    p_output_tokens: options.outputTokens,
    p_billable: options.billable ?? true,
    p_metadata: options.metadata || {},
  });

  if (error) {
    console.error("[metered-ai] settle_ai_usage RPC error:", error);
  }

  return data;
}

export async function releaseAiUsage(options: {
  userId: string;
  requestId: string;
  reason?: string;
  serviceClient?: any;
}) {
  const serviceClient = options.serviceClient || createServiceClient();
  const { data, error } = await serviceClient.rpc("release_ai_usage", {
    p_user_id: options.userId,
    p_request_id: options.requestId,
    p_reason: options.reason || "cancelled",
  });

  if (error) {
    console.error("[metered-ai] release_ai_usage RPC error:", error);
  }

  return data;
}

export async function runMeteredAiCall<T>(
  options: RunMeteredAiCallOptions<T>,
): Promise<{ result: T; requestId: string; modelUsed: string }> {
  const serviceClient = createServiceClient();
  const requestId = options.requestId || crypto.randomUUID();
  const model = options.model || "gemini-3-flash-preview";

  const estimatedCostNanos =
    options.estimatedCostNanos !== undefined
      ? BigInt(options.estimatedCostNanos)
      : estimatePreflightReservationNanos(
          options.promptTextLength || 0,
          options.maxOutputTokens || 2048,
        );

  console.log(
    `[Telemetry] AI reservation created | requestId=${requestId} | user=${options.userId} | feature=${options.featureKey} | model=${model}`,
  );

  const reservation = await reserveAiUsage({
    userId: options.userId,
    requestId,
    featureKey: options.featureKey,
    provider: options.provider || "gemini",
    model,
    estimatedCostNanos,
    parentRequestId: options.parentRequestId,
    metadata: options.metadata,
    serviceClient,
  });

  if (reservation && reservation.success === false) {
    console.log(
      `[Telemetry] AI reservation denied | requestId=${requestId} | user=${options.userId} | window=${reservation.window}`,
    );
    throw new MeteredAiLimitError({
      error: "AI_USAGE_LIMIT_REACHED",
      window: reservation.window || "rolling_24h",
      message: reservation.message || "You’ve reached your AI usage limit for this period.",
      resetsAt: reservation.resetsAt || null,
      resetsGradually: Boolean(reservation.resetsGradually),
    });
  }

  try {
    const executed = await options.execute({ requestId, model });
    const modelUsed = executed.modelUsed || model;
    const usage = executed.usageMetadata;

    const inputTokens = Math.max(0, Number(usage?.promptTokenCount || 0));
    const outputTokens = Math.max(
      0,
      Number(usage?.candidatesTokenCount || 0) + Number(usage?.thinkingTokenCount || 0),
    );

    if (!usage || (inputTokens === 0 && outputTokens === 0)) {
      console.warn(
        `[Telemetry] Missing or zero usage metadata | requestId=${requestId} | feature=${options.featureKey}`,
      );
    }

    const settledCostNanos = calculateAiCostNanos(inputTokens, outputTokens);

    await settleAiUsage({
      userId: options.userId,
      requestId,
      inputTokens,
      outputTokens,
      billable: true,
      metadata: {
        model_used: modelUsed,
        thinking_tokens: usage?.thinkingTokenCount || 0,
      },
      serviceClient,
    });

    console.log(
      `[Telemetry] AI reservation settled | requestId=${requestId} | user=${options.userId} | costNanos=${settledCostNanos} | feature=${options.featureKey}`,
    );

    return {
      result: executed.result,
      requestId,
      modelUsed,
    };
  } catch (error) {
    console.warn(
      `[Telemetry] AI execution failed, releasing reservation | requestId=${requestId} | user=${options.userId} | error=${error?.message || error}`,
    );
    await releaseAiUsage({
      userId: options.userId,
      requestId,
      reason: String(error?.message || "execution_failed"),
      serviceClient,
    });
    throw error;
  }
}
