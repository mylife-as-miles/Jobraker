import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MeteredAiLimitError, hashPayload } from "./metered-ai.ts";

export interface MeteredComposioCallOptions<T> {
  serviceClient: SupabaseClient;
  userId: string;
  requestId?: string;
  parentRequestId?: string;
  toolkitSlug: string;
  toolSlug: string;
  connectedAccountId?: string;
  sessionId?: string;
  payload?: unknown;
  metadata?: Record<string, unknown>;
  execute: () => Promise<T>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export async function runMeteredComposioCall<T>(
  options: MeteredComposioCallOptions<T>,
): Promise<T> {
  const requestId = options.requestId || crypto.randomUUID();
  const payloadHash = options.payload === undefined
    ? null
    : await hashPayload(options.payload);

  const reservePayload = {
    p_user_id: options.userId,
    p_request_id: requestId,
    p_toolkit_slug: options.toolkitSlug,
    p_tool_slug: options.toolSlug,
    p_parent_request_id: options.parentRequestId ?? null,
    p_payload_hash: payloadHash,
    p_metadata: options.metadata ?? {},
  };

  // 1. Reserve Composio usage against shared AI limits
  const { data: reserveData, error: reserveError } = await options.serviceClient.rpc(
    "reserve_composio_usage",
    reservePayload,
  );

  if (reserveError) {
    console.error("[metered-composio] RPC reserve error:", reserveError);
    throw new Error(`Composio usage reservation failed: ${reserveError.message}`);
  }

  const reserveResult = asRecord(reserveData);
  if (!reserveResult || reserveResult.success !== true) {
    const errorType = typeof reserveResult?.error === "string" ? reserveResult.error : "";
    if (errorType === "AI_USAGE_LIMIT_REACHED") {
      throw new MeteredAiLimitError(
        (typeof reserveResult?.message === "string" ? reserveResult.message : "AI usage limit reached"),
        (reserveResult?.window as any) || "rolling_24h",
        (reserveResult?.resetsAt as string) || null,
        Boolean(reserveResult?.resetsGradually),
      );
    }
    throw new Error(
      typeof reserveResult?.message === "string"
        ? reserveResult.message
        : "Composio usage reservation rejected",
    );
  }

  // 2. Execute provider call
  let executionResult: T;
  let providerFailed = false;
  let providerError: unknown = null;

  try {
    executionResult = await options.execute();
  } catch (err) {
    providerFailed = true;
    providerError = err;
    console.warn(`[metered-composio] Tool execution threw for ${options.toolSlug}:`, err);
    executionResult = null as unknown as T;
  }

  // 3. Extract execution details
  const root = asRecord(executionResult);
  const isSuccessful = !providerFailed && (root?.success !== false && root?.successful !== false);
  const executionId = (typeof root?.execution_id === "string" ? root.execution_id : null) ||
    (typeof root?.id === "string" ? root.id : null);
  const logId = typeof root?.log_id === "string" ? root.log_id : null;
  const failureOwner = providerFailed ? "composio" : (isSuccessful ? null : "user");

  // 4. Settle Composio usage
  try {
    const { error: settleError } = await options.serviceClient.rpc(
      "settle_composio_usage",
      {
        p_user_id: options.userId,
        p_request_id: requestId,
        p_tool_slug: options.toolSlug,
        p_execution_id: executionId,
        p_composio_log_id: logId,
        p_session_id: options.sessionId ?? null,
        p_connected_account_id: options.connectedAccountId ?? null,
        p_call_class: options.metadata?.call_class || "standard",
        p_provider_cost_nanos: 0,
        p_billable: isSuccessful,
        p_failure_owner: failureOwner,
        p_metadata: options.metadata ?? {},
      },
    );

    if (settleError) {
      console.error("[metered-composio] CRITICAL RECONCILIATION LOG - Settle failed after provider execution:", settleError, {
        userId: options.userId,
        requestId,
        toolSlug: options.toolSlug,
        isSuccessful,
      });
    }
  } catch (settleEx) {
    console.error("[metered-composio] CRITICAL RECONCILIATION LOG - Settle threw after provider execution:", settleEx);
  }

  if (providerFailed) {
    throw providerError;
  }

  return executionResult;
}
