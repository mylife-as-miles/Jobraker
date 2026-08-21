// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type MeteringMode = "off" | "shadow" | "enforce";

export function getProviderMeteringMode(provider: "firecrawl" | "rtrvr" | "skyvern"): MeteringMode {
  const envKey = `${provider.toUpperCase()}_CREDIT_METERING_MODE`;
  const raw = (Deno.env.get(envKey) || "enforce").toLowerCase().trim();
  if (raw === "off" || raw === "false" || raw === "disabled") return "off";
  if (raw === "shadow") return "shadow";
  return "enforce";
}

/**
 * Calculate user credit cost from provider billable nanos.
 * 20,000,000 nanos = $0.02 = 1 Jobraker Credit.
 */
export function calculateUserCreditCost(
  confirmedUnits: number,
  allocatedCostNanosPerUnit: number,
  safetyMultiplier = 1.20,
  minimumUserCredits = 1,
): number {
  const allocatedCostNanos = Math.round(confirmedUnits * allocatedCostNanosPerUnit);
  const billableBasisNanos = allocatedCostNanos * safetyMultiplier;
  const rawCredits = Math.ceil(billableBasisNanos / 20_000_000);
  return Math.max(minimumUserCredits, rawCredits);
}

export interface MeteredFirecrawlOptions<T> {
  serviceClient: any;
  userId: string;
  requestId?: string;
  parentRequestId?: string;
  featureKey?: string;
  operationKey: "search" | "scrape" | "map" | "crawl";
  endpoint: string;
  payload?: unknown;
  jobSearchRunId?: string;
  estimatedUnits?: number;
  execute: () => Promise<{ result: T; confirmedUnits?: number; providerRequestId?: string }>;
}

export async function runMeteredFirecrawlCall<T>(opts: MeteredFirecrawlOptions<T>): Promise<T> {
  const mode = getProviderMeteringMode("firecrawl");
  if (mode === "off" || !opts.userId) {
    const { result } = await opts.execute();
    return result;
  }

  const requestId = opts.requestId || crypto.randomUUID();
  const estimatedUnits = opts.estimatedUnits || 1;

  if (mode === "enforce") {
    // 1. Reserve
    const { data: resData, error: resErr } = await opts.serviceClient.rpc("reserve_external_provider_credits", {
      p_user_id: opts.userId,
      p_provider: "firecrawl",
      p_feature_key: opts.featureKey || "job_discovery",
      p_operation_key: opts.operationKey,
      p_request_id: requestId,
      p_estimated_units: estimatedUnits,
      p_parent_request_id: opts.parentRequestId,
      p_job_search_run_id: opts.jobSearchRunId,
      p_metadata: { endpoint: opts.endpoint },
    });

    if (resErr || (resData && resData.success === false)) {
      console.warn("[metered-firecrawl] Reservation failed or insufficient credits", resErr || resData);
      if (resData?.reason === "insufficient_credits") {
        throw new Error("Not enough credits available for job discovery search.");
      }
    }
  }

  let executionResult: { result: T; confirmedUnits?: number; providerRequestId?: string };
  let executionError: any = null;

  try {
    executionResult = await opts.execute();
  } catch (err) {
    executionError = err;
    if (mode === "enforce") {
      await opts.serviceClient.rpc("release_external_provider_credits", {
        p_request_id: requestId,
        p_reason: "execution_error",
        p_failure_owner: "firecrawl",
      }).catch(() => {});
    }
    throw err;
  }

  // 2. Settle
  const confirmedUnits = executionResult.confirmedUnits || estimatedUnits;
  if (mode === "enforce" || mode === "shadow") {
    const { error: settleErr } = await opts.serviceClient.rpc("settle_external_provider_credits", {
      p_request_id: requestId,
      p_confirmed_units: confirmedUnits,
      p_provider_request_id: executionResult.providerRequestId,
      p_status: "completed",
    }).catch(() => {});

    if (settleErr) {
      console.warn("[metered-firecrawl] Settlement logged warning", settleErr);
    }
  }

  return executionResult.result;
}

export interface MeteredRtrvrOptions<T> {
  serviceClient: any;
  userId: string;
  requestId?: string;
  parentRequestId?: string;
  applicationId?: string;
  automationAttemptId?: string;
  operationClass: "run" | "scrape" | "act";
  featureKey?: string;
  payload?: unknown;
  estimatedUnits?: number;
  execute: () => Promise<{
    result: T;
    confirmedUnits?: number;
    providerRunId?: string;
    /** False means the provider rejected or could not complete the request. */
    completed?: boolean;
  }>;
}

export async function runMeteredRtrvrCall<T>(opts: MeteredRtrvrOptions<T>): Promise<T> {
  const mode = getProviderMeteringMode("rtrvr");
  if (mode === "off" || !opts.userId) {
    const { result } = await opts.execute();
    return result;
  }

  const requestId = opts.requestId || crypto.randomUUID();
  const estimatedUnits = opts.estimatedUnits || 1;

  if (mode === "enforce") {
    const { data: resData, error: resErr } = await opts.serviceClient.rpc("reserve_external_provider_credits", {
      p_user_id: opts.userId,
      p_provider: "rtrvr",
      p_feature_key: opts.featureKey || "browser_automation",
      p_operation_key: opts.operationClass,
      p_request_id: requestId,
      p_estimated_units: estimatedUnits,
      p_parent_request_id: opts.parentRequestId,
      p_application_id: opts.applicationId,
      p_automation_attempt_id: opts.automationAttemptId,
    });

    if (resErr || (resData && resData.success === false)) {
      if (resData?.reason === "insufficient_credits") {
        throw new Error("Not enough credits available for browser automation.");
      }
    }
  }

  let executionResult: {
    result: T;
    confirmedUnits?: number;
    providerRunId?: string;
    completed?: boolean;
  };
  try {
    executionResult = await opts.execute();
  } catch (err) {
    if (mode === "enforce") {
      await opts.serviceClient.rpc("release_external_provider_credits", {
        p_request_id: requestId,
        p_reason: "execution_error",
        p_failure_owner: "rtrvr",
      }).catch(() => {});
    }
    throw err;
  }

  if (executionResult.completed === false) {
    if (mode === "enforce") {
      await opts.serviceClient.rpc("release_external_provider_credits", {
        p_request_id: requestId,
        p_reason: "provider_request_failed",
        p_failure_owner: "rtrvr",
      }).catch(() => {});
    }
    return executionResult.result;
  }

  const confirmedUnits = executionResult.confirmedUnits ?? estimatedUnits;
  await opts.serviceClient.rpc("settle_external_provider_credits", {
    p_request_id: requestId,
    p_confirmed_units: confirmedUnits,
    p_provider_run_id: executionResult.providerRunId,
    p_status: "completed",
  }).catch(() => {});

  return executionResult.result;
}

export interface MeteredSkyvernOptions<T> {
  serviceClient: any;
  userId: string;
  requestId?: string;
  parentRequestId?: string;
  applicationId?: string;
  automationAttemptId?: string;
  operationClass: "workflow_run" | "step";
  featureKey?: string;
  payload?: unknown;
  estimatedUnits?: number;
  execute: () => Promise<{ result: T; confirmedUnits?: number; providerRunId?: string }>;
}

export async function runMeteredSkyvernCall<T>(opts: MeteredSkyvernOptions<T>): Promise<T> {
  const mode = getProviderMeteringMode("skyvern");
  if (mode === "off" || !opts.userId) {
    const { result } = await opts.execute();
    return result;
  }

  const requestId = opts.requestId || crypto.randomUUID();
  const estimatedUnits = opts.estimatedUnits || 1;

  if (mode === "enforce") {
    const { data: resData, error: resErr } = await opts.serviceClient.rpc("reserve_external_provider_credits", {
      p_user_id: opts.userId,
      p_provider: "skyvern",
      p_feature_key: opts.featureKey || "application_automation",
      p_operation_key: opts.operationClass,
      p_request_id: requestId,
      p_estimated_units: estimatedUnits,
      p_parent_request_id: opts.parentRequestId,
      p_application_id: opts.applicationId,
      p_automation_attempt_id: opts.automationAttemptId,
    });

    if (resErr || (resData && resData.success === false)) {
      if (resData?.reason === "insufficient_credits") {
        throw new Error("Not enough credits available for application automation.");
      }
    }
  }

  let executionResult: { result: T; confirmedUnits?: number; providerRunId?: string };
  try {
    executionResult = await opts.execute();
  } catch (err) {
    if (mode === "enforce") {
      await opts.serviceClient.rpc("release_external_provider_credits", {
        p_request_id: requestId,
        p_reason: "execution_error",
        p_failure_owner: "skyvern",
      }).catch(() => {});
    }
    throw err;
  }

  const confirmedUnits = executionResult.confirmedUnits || estimatedUnits;
  await opts.serviceClient.rpc("settle_external_provider_credits", {
    p_request_id: requestId,
    p_confirmed_units: confirmedUnits,
    p_provider_run_id: executionResult.providerRunId,
    p_status: "completed",
  }).catch(() => {});

  return executionResult.result;
}
