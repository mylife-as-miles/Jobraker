import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { StartApplicationInput, StartApplicationResult } from "./types.js";
import { redactSensitiveValue } from "./logRedaction.js";

export type ServiceSupabaseClient = SupabaseClient<any, "public", any>;

export interface ClaimedRtrvrApplication {
  applicationId: string;
  attemptNumber: number;
  leaseToken: string;
}

export interface ApplicationAutomationFence {
  workerId: string;
  leaseToken: string;
}

export function createServiceSupabaseClientFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ServiceSupabaseClient {
  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function claimNextRtrvrApplications(
  supabase: ServiceSupabaseClient,
  limit: number,
  workerId: string,
  leaseSeconds: number,
): Promise<ClaimedRtrvrApplication[]> {
  const { data, error } = await supabase.rpc("claim_next_rtrvr_auto_apply_jobs", {
    p_limit: Math.max(1, Math.min(25, Math.floor(limit))),
    p_worker_id: workerId,
    p_lease_seconds: Math.max(60, Math.min(3600, Math.floor(leaseSeconds))),
  });
  if (error) throw error;
  return Array.isArray(data)
    ? data
        .map((row) => {
          if (typeof row === "string") {
            return null;
          }
          const applicationId = row?.application_id;
          const attemptNumber = Number(row?.attempt_number);
          const leaseToken = row?.lease_token;
          return typeof applicationId === "string" &&
            applicationId.length > 0 &&
            typeof leaseToken === "string" &&
            leaseToken.length > 0
            ? {
                applicationId,
                attemptNumber: Number.isFinite(attemptNumber) && attemptNumber > 0
                  ? Math.floor(attemptNumber)
                  : 1,
                leaseToken,
              }
            : null;
        })
        .filter((row): row is ClaimedRtrvrApplication => row !== null)
    : [];
}

export async function renewRtrvrApplicationLease(
  supabase: ServiceSupabaseClient,
  applicationId: string,
  workerId: string,
  leaseToken: string,
  leaseSeconds: number,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("renew_rtrvr_auto_apply_job_lease", {
    p_application_id: applicationId,
    p_worker_id: workerId,
    p_lease_token: leaseToken,
    p_lease_seconds: Math.max(60, Math.min(3600, Math.floor(leaseSeconds))),
  });
  if (error) throw error;
  return data === true;
}

export async function claimAutomationWorkerNonce(
  supabase: ServiceSupabaseClient,
  nonce: string,
  expiresAt: Date,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("claim_automation_worker_nonce", {
    p_nonce: nonce,
    p_expires_at: expiresAt.toISOString(),
  });
  if (error) throw error;
  return data === true;
}

export async function loadStartApplicationInput(
  supabase: ServiceSupabaseClient,
  applicationId: string,
): Promise<StartApplicationInput | null> {
  const { data, error } = await supabase
    .from("applications")
    .select(
      "id,user_id,agent_run_id,job_id,app_url,provider_run_output,automation_idempotency_key",
    )
    .eq("id", applicationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const runOutput =
    data.provider_run_output &&
    typeof data.provider_run_output === "object" &&
    !Array.isArray(data.provider_run_output)
      ? (data.provider_run_output as Record<string, unknown>)
      : {};
  const queueParameters =
    runOutput.queue_parameters &&
    typeof runOutput.queue_parameters === "object" &&
    !Array.isArray(runOutput.queue_parameters)
      ? (runOutput.queue_parameters as Record<string, unknown>)
      : {};
  const rtrvr =
    queueParameters.rtrvr &&
    typeof queueParameters.rtrvr === "object" &&
    !Array.isArray(queueParameters.rtrvr)
      ? (queueParameters.rtrvr as StartApplicationInput)
      : null;

  if (!rtrvr) return null;
  return {
    ...rtrvr,
    applicationId: data.id,
    userId: data.user_id,
    agentRunId: data.agent_run_id,
    applicationUrl: rtrvr.applicationUrl || data.app_url,
    idempotencyKey: data.automation_idempotency_key || rtrvr.idempotencyKey,
  };
}

export async function insertAutomationAttempt(
  supabase: ServiceSupabaseClient,
  input: StartApplicationInput,
  provider: "rtrvr" | "skyvern",
  status: string,
  workerId?: string | null,
  leaseSeconds?: number,
  leaseToken?: string | null,
): Promise<string | null> {
  const now = new Date();
  const attemptKey = `${input.idempotencyKey}:${provider}:${input.attemptNumber}`;
  const { data, error } = await supabase
    .from("application_automation_attempts")
    .upsert(
      {
        application_id: input.applicationId,
        agent_run_id: input.agentRunId || null,
        user_id: input.userId,
        provider,
        attempt_number: input.attemptNumber,
        target_mode: provider === "rtrvr" ? input.browserPreference : null,
        status,
        claimed_by: workerId || null,
        lease_token: leaseToken || null,
        lease_expires_at: workerId && leaseSeconds
          ? new Date(now.getTime() + leaseSeconds * 1000).toISOString()
          : null,
        heartbeat_at: workerId ? now.toISOString() : null,
        started_at: now.toISOString(),
        last_activity_at: now.toISOString(),
        idempotency_key: attemptKey,
        metadata: redactSensitiveValue(input.metadata || {}),
      },
      { onConflict: "idempotency_key" },
    )
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export async function finishAutomationAttempt(
  supabase: ServiceSupabaseClient,
  attemptId: string | null,
  result: StartApplicationResult,
  fence?: ApplicationAutomationFence,
): Promise<void> {
  if (!attemptId) return;
  let query = supabase
    .from("application_automation_attempts")
    .update({
      provider_run_id: result.providerRunId || null,
      provider_request_id: result.providerRequestId || null,
      provider_status: result.result?.status || result.status,
      status: result.status,
      lease_token: null,
      lease_expires_at: null,
      heartbeat_at: new Date().toISOString(),
      selected_mode: result.selectedMode || null,
      fallback_applied: result.fallbackApplied === true,
      fallback_reason: result.fallbackReason || null,
      device_id: result.deviceId || null,
      completed_at: ["completed", "failed", "needs_review", "waiting_for_user"].includes(result.status)
        ? new Date().toISOString()
        : null,
      last_activity_at: new Date().toISOString(),
      failure_code: result.failureCode || null,
      failure_message: result.failureMessage || null,
      result: redactSensitiveValue(result.result || {}),
      metadata: redactSensitiveValue({
        targetMode: result.targetMode,
        raw: result.raw,
      }),
    })
    .eq("id", attemptId);
  if (fence) {
    query = query
      .eq("claimed_by", fence.workerId)
      .eq("lease_token", fence.leaseToken)
      .select("id")
      .maybeSingle() as typeof query;
  }
  const { data, error } = (await query) as { data?: { id?: string } | null; error: unknown };
  if (error) throw error;
  if (fence && !data) {
    throw new Error("Automation attempt lease was lost before terminal update.");
  }
}

function applicationPatchFromResult(result: StartApplicationResult): Record<string, unknown> {
  const base: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    automation_provider: result.provider,
    automation_selected_mode: result.selectedMode || null,
    automation_fallback_applied: result.fallbackApplied === true,
    automation_fallback_reason: result.fallbackReason || null,
    automation_device_id: result.deviceId || null,
    automation_claimed_by: null,
    automation_lease_token: null,
    automation_lease_expires_at: null,
    automation_heartbeat_at: new Date().toISOString(),
  };

  if (result.providerRunId) base.run_id = result.providerRunId;

  if (result.provider === "skyvern" && result.status === "running") {
    return {
      ...base,
      provider_status: "pending",
      status: "Pending",
      canonical_stage: "queued",
    };
  }

  const structured = result.result;
  if (structured?.status === "completed" && structured.submitted) {
    return {
      ...base,
      provider_status: "completed",
      status: "Applied",
      canonical_stage: "submitted",
      receipt_url: structured.submissionEvidence?.finalUrl || null,
      success_url: structured.submissionEvidence?.finalUrl || null,
      failure_reason: null,
    };
  }

  if (structured?.status === "prepared" || result.status === "needs_review") {
    return {
      ...base,
      provider_status: "prepared",
      status: "Pending",
      canonical_stage: "queued",
      user_review_notes: structured?.summary || "Application prepared for review.",
      failure_reason: null,
    };
  }

  if (structured?.status === "waiting_for_user" || result.status === "waiting_for_user") {
    return {
      ...base,
      provider_status: "waiting_for_user",
      status: "Pending",
      canonical_stage: "queued",
      failure_reason:
        structured?.summary ||
        result.failureMessage ||
        "Security verification requires your attention.",
    };
  }

  return {
    ...base,
    provider_status: "failed",
    status: "Failed",
    canonical_stage: "failed",
    failure_reason:
      structured?.summary ||
      result.failureMessage ||
      "Automation could not complete this workflow.",
  };
}

export async function updateApplicationWithAutomationResult(
  supabase: ServiceSupabaseClient,
  applicationId: string,
  result: StartApplicationResult,
  fence?: ApplicationAutomationFence,
): Promise<void> {
  const { data: current, error: currentError } = await supabase
    .from("applications")
    .select("provider_run_output")
    .eq("id", applicationId)
    .maybeSingle();
  if (currentError) throw currentError;

  const existing =
    current?.provider_run_output &&
    typeof current.provider_run_output === "object" &&
    !Array.isArray(current.provider_run_output)
      ? (current.provider_run_output as Record<string, unknown>)
      : {};

  let query = supabase
    .from("applications")
    .update({
      ...applicationPatchFromResult(result),
      provider_run_output: {
        ...existing,
        latest_provider_result: redactSensitiveValue(result),
      },
    })
    .eq("id", applicationId);
  if (fence) {
    query = query
      .eq("automation_claimed_by", fence.workerId)
      .eq("automation_lease_token", fence.leaseToken)
      .select("id")
      .maybeSingle() as typeof query;
  }
  const { data, error } = (await query) as { data?: { id?: string } | null; error: unknown };
  if (error) throw error;
  if (fence && !data) {
    throw new Error("Application lease was lost before terminal update.");
  }
}
