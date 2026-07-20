// backend/supabase/functions/process-auto-apply-queue/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { restoreAutoApplyRunQuota } from "../_shared/feature-limits.ts";
import { refundUserCredits } from "../_shared/refunds.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const SKYVERN_ENDPOINT = "https://api.skyvern.com/v1/run/workflows";
const AUTO_APPLY_CREDIT_COST = 5;

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function startOfNextMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

async function resolveAutoApplyConcurrencyPeriod(
  userId: string,
  serviceClient: any,
  tier: string,
) {
  let periodStart = startOfCurrentMonth().toISOString();
  let periodEnd = startOfNextMonth().toISOString();

  if (tier !== "Free") {
    const { data: subscription } = await serviceClient
      .from("user_subscriptions")
      .select("current_period_start, current_period_end")
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("current_period_end", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const subscriptionStart = subscription?.current_period_start;
    const subscriptionEnd = subscription?.current_period_end;
    if (subscriptionStart && subscriptionEnd) {
      periodStart = subscriptionStart;
      periodEnd = subscriptionEnd;
    }
  }

  return { periodStart, periodEnd };
}

async function refundQueuedAutoApplyLaunch(
  supabase: any,
  appRow: { user_id: string; job_id?: string | null; agent_run_id?: string | null },
  appId: string,
  reason: string,
) {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", appRow.user_id)
      .maybeSingle();

    const tier = profile?.subscription_tier || "Free";
    const { periodStart, periodEnd } = await resolveAutoApplyConcurrencyPeriod(
      appRow.user_id,
      supabase,
      tier,
    );

    await restoreAutoApplyRunQuota(supabase, appRow.user_id, periodStart, periodEnd, 1);

    if (appRow.agent_run_id) {
      try {
        const { error: settleError } = await supabase.rpc(
          "check_and_settle_agent_run",
          { p_agent_run_id: appRow.agent_run_id }
        );
        if (settleError) {
          console.error("Failed to check and settle agent run:", settleError);
        }
      } catch (err) {
        console.error("Error invoking check_and_settle_agent_run:", err);
      }
    } else {
      await refundUserCredits({
        serviceClient: supabase,
        userId: appRow.user_id,
        amount: AUTO_APPLY_CREDIT_COST,
        description: `Refund: Auto-apply failed to start (${appId})`,
        referenceType: "refund",
        referenceId: appId,
        metadata: {
          refund_key: `process-auto-apply-queue:${appId}`,
          application_id: appId,
          job_id: appRow.job_id,
          source: "process-auto-apply-queue",
          reason,
        },
      });
    }

    console.log(`[process-auto-apply-queue] Refunded credits and run quota for user ${appRow.user_id}`);
  } catch (refundErr) {
    console.error("[process-auto-apply-queue] Refund failed", refundErr);
  }
}

async function recoverStaleAutoApplyRows(supabase: any): Promise<{
  requeued: number;
  failed: number;
}> {
  const launchingCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const workerCutoff = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const { data: staleRows, error } = await supabase
    .from("applications")
    .select(
      "id, user_id, job_id, agent_run_id, provider_status, retry_count, updated_at, automation_heartbeat_at",
    )
    .eq("canonical_stage", "queued")
    .in("provider_status", ["launching", "waiting_worker"])
    .order("updated_at", { ascending: true })
    .limit(200);

  if (error) {
    console.error("[process-auto-apply-queue] stale recovery query failed", error);
    return { requeued: 0, failed: 0 };
  }

  let requeued = 0;
  let failed = 0;
  for (const row of staleRows ?? []) {
    const staleCutoff = row.provider_status === "launching"
      ? new Date(launchingCutoff).getTime()
      : new Date(workerCutoff).getTime();
    const updatedAt = new Date(row.updated_at).getTime();
    if (!Number.isFinite(updatedAt) || updatedAt >= staleCutoff) {
      continue;
    }
    const heartbeatAt = row.automation_heartbeat_at
      ? new Date(row.automation_heartbeat_at).getTime()
      : 0;
    if (heartbeatAt > Date.now() - 10 * 60 * 1000) {
      continue;
    }

    const nextRetry = Number(row.retry_count || 0) + 1;
    if (nextRetry <= 3) {
      const { error: requeueError } = await supabase
        .from("applications")
        .update({
          provider_status: "waiting",
          retry_count: nextRetry,
          failure_reason: `Recovered stale ${row.provider_status} queue state; retrying (${nextRetry}/3).`,
          automation_claimed_by: null,
          automation_lease_token: null,
          automation_lease_expires_at: null,
          automation_heartbeat_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("canonical_stage", "queued")
        .eq("provider_status", row.provider_status);
      if (!requeueError) requeued += 1;
      continue;
    }

    const reason = `Automation did not leave ${row.provider_status} after 3 recovery attempts.`;
    const { error: failError } = await supabase
      .from("applications")
      .update({
        canonical_stage: "failed",
        status: "Failed",
        provider_status: "failed",
        retry_count: nextRetry,
        failure_reason: reason,
        automation_claimed_by: null,
        automation_lease_token: null,
        automation_lease_expires_at: null,
        automation_heartbeat_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("canonical_stage", "queued")
      .eq("provider_status", row.provider_status);
    if (failError) continue;

    if (row.job_id) {
      await supabase
        .from("jobs")
        .update({ canonical_status: "failed", updated_at: new Date().toISOString() })
        .eq("id", row.job_id);
    }
    await refundQueuedAutoApplyLaunch(supabase, row, row.id, reason);
    failed += 1;
  }

  return { requeued, failed };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // 1. Verify authorization
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!serviceRoleKey) {
      console.error("[process-auto-apply-queue] SUPABASE_SERVICE_ROLE_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Queue service configuration is unavailable.", code: "SERVICE_ROLE_CONFIGURATION_MISSING" }),
        { status: 500, headers: corsHeaders },
      );
    }

    if (!token || token !== serviceRoleKey) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey!, {
      auth: { persistSession: false },
    });

    const skyvernKey = Deno.env.get("SKYVERN_API_KEY");

    const recovery = await recoverStaleAutoApplyRows(supabase);
    if (recovery.requeued > 0 || recovery.failed > 0) {
      console.info("[process-auto-apply-queue] stale recovery complete", recovery);
    }

    // 2. Resolve platform-wide concurrency limit
    const rawLimit = Deno.env.get("AUTO_APPLY_MAX_CONCURRENCY") || "10";
    const platformConcurrencyLimit = parseInt(rawLimit, 10) || 10;

    // 3. Acquire candidate applications to run
    const { data: candidateIds, error: acquireError } = await supabase.rpc(
      "acquire_next_auto_apply_jobs",
      { p_platform_max_concurrency: platformConcurrencyLimit }
    );

    if (acquireError) {
      console.error("[process-auto-apply-queue] acquire Candidates RPC error:", acquireError);
      return new Response(
        JSON.stringify({ error: "Unable to acquire queued applications.", code: "QUEUE_ACQUISITION_FAILED" }),
        { status: 500, headers: corsHeaders },
      );
    }

    const ids = Array.isArray(candidateIds)
      ? candidateIds
          .map((row: any) => (typeof row === "string" ? row : row?.application_id))
          .filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
      : [];
    if (ids.length === 0) {
      return new Response(JSON.stringify({ success: true, launched: 0, recovery }), { status: 200, headers: corsHeaders });
    }

    console.log(`[process-auto-apply-queue] Found ${ids.length} candidates to process.`);

    // 4. Launch each candidate application run sequentially
    let launchedCount = 0;
    for (const appId of ids) {
      const { data: appRow, error: fetchError } = await supabase
        .from("applications")
        .select("user_id, job_id, provider_run_output, retry_count, agent_run_id")
        .eq("id", appId)
        .single();

      if (fetchError || !appRow) {
        console.error(`[process-auto-apply-queue] Failed to load application ${appId}`, fetchError);
        continue;
      }

      const previousRunOutput =
        appRow.provider_run_output && typeof appRow.provider_run_output === "object"
          ? appRow.provider_run_output
          : {};
      const queueParams = appRow.provider_run_output?.queue_parameters;
      if (!queueParams) {
        console.error(`[process-auto-apply-queue] No queue parameters found for application ${appId}`);
        // Mark failed permanently
        await supabase
          .from("applications")
          .update({
            canonical_stage: "failed",
            status: "Failed",
            provider_status: "failed",
            failure_reason: "Invalid queue parameters configuration",
            updated_at: new Date().toISOString(),
          })
          .eq("id", appId);
        await refundQueuedAutoApplyLaunch(
          supabase,
          appRow,
          appId,
          "Invalid queue parameters configuration",
        );
        continue;
      }

      const queueProvider =
        typeof queueParams.provider === "string" ? queueParams.provider : "skyvern";

      if (queueProvider === "rtrvr") {
        await supabase
          .from("applications")
          .update({
            provider_status: "waiting_worker",
            automation_provider: "rtrvr",
            automation_claimed_by: null,
            automation_lease_expires_at: null,
            automation_heartbeat_at: null,
            provider_run_output: {
              ...previousRunOutput,
              queue_parameters: queueParams,
              queue_handoff: {
                provider: "rtrvr",
                handed_off_at: new Date().toISOString(),
                worker: "automation-worker",
              },
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", appId);
        console.log(`[process-auto-apply-queue] Handed application ${appId} to rtrvr automation worker`);
        continue;
      }

      const skyvernQueue =
        queueParams.skyvern && typeof queueParams.skyvern === "object"
          ? queueParams.skyvern
          : queueParams;
      const { workflow_id, parameters, proxy_location, webhook_url, title, max_steps_override } = skyvernQueue;

      if (!skyvernKey || !workflow_id) {
        const reason = !skyvernKey
          ? "SKYVERN_API_KEY is not configured"
          : "Skyvern workflow_id is not configured";
        console.error(`[process-auto-apply-queue] ${reason} for application ${appId}`);
        await supabase
          .from("applications")
          .update({
            canonical_stage: "failed",
            status: "Failed",
            provider_status: "failed",
            failure_reason: reason,
            updated_at: new Date().toISOString(),
          })
          .eq("id", appId);
        await refundQueuedAutoApplyLaunch(supabase, appRow, appId, reason);
        continue;
      }

      const skyvernRun: Record<string, unknown> = {
        workflow_id,
        parameters,
      };
      if (proxy_location) skyvernRun.proxy_location = proxy_location;
      if (webhook_url) skyvernRun.webhook_url = webhook_url;
      if (title) skyvernRun.title = title;

      const skyvernHeaders: Record<string, string> = {
        "content-type": "application/json",
        "x-api-key": skyvernKey,
        "x-max-steps-override": String(max_steps_override || 200),
      };

      try {
        console.log(`[process-auto-apply-queue] Launching Skyvern run for application ${appId}`);
        const response = await fetch(SKYVERN_ENDPOINT, {
          method: "POST",
          headers: skyvernHeaders,
          body: JSON.stringify(skyvernRun),
        });

        const text = await response.text();
        let data: any = null;
        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }

        if (!response.ok) {
          const skyvernMessage = data?.detail || data?.message || data?.error || data?.raw || "";
          const isRateLimitOrServerErr = response.status === 429 || response.status >= 500;

          if (isRateLimitOrServerErr) {
            // Temporary error: increment retry counter and leave as waiting
            const nextRetries = (appRow.retry_count || 0) + 1;
            if (nextRetries <= 3) {
              console.warn(`[process-auto-apply-queue] Temporary error ${response.status} from Skyvern. Retrying later (${nextRetries}/3).`);
              await supabase
                .from("applications")
                .update({
                  provider_status: "waiting",
                  retry_count: nextRetries,
                  failure_reason: `Temporary automation launch error ${response.status}; retrying shortly.`,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", appId);
              continue;
            }
          }

          // Permanent error (or exceeded retries)
          const reason =
            response.status === 401 || response.status === 403
              ? "Automation service API key is invalid or expired. Please contact support."
              : response.status === 404
                ? "Automation template not found. Please contact support."
                : response.status === 422
                  ? `Automation service rejected the request: ${skyvernMessage}`
                  : `Automation service returned error ${response.status}: ${skyvernMessage}`;

          console.error(`[process-auto-apply-queue] Skyvern permanent error ${response.status}: ${reason}`);

          // Mark application failed
          await supabase
            .from("applications")
            .update({
              canonical_stage: "failed",
              status: "Failed",
              provider_status: "failed",
              failure_reason: reason,
              updated_at: new Date().toISOString(),
            })
            .eq("id", appId);

          if (appRow.job_id) {
            await supabase
              .from("jobs")
              .update({
                canonical_status: "failed",
                updated_at: new Date().toISOString(),
              })
              .eq("id", appRow.job_id);
          }

          await refundQueuedAutoApplyLaunch(supabase, appRow, appId, reason);
          continue;
        }

        // Success: update application with the launched Skyvern run_id
        const runId = data?.run_id || data?.id;
        if (runId) {
          await supabase
            .from("applications")
            .update({
              run_id: runId,
              provider_status: data.status || "pending",
              provider_run_output: {
                ...previousRunOutput,
                launch_response: data,
                queue_parameters: queueParams,
              },
              updated_at: new Date().toISOString(),
            })
            .eq("id", appId);

          launchedCount++;
          console.log(`[process-auto-apply-queue] Successfully launched application ${appId} with run_id ${runId}`);
        } else {
          const reason = "Automation service did not return a run ID.";
          await supabase
            .from("applications")
            .update({
              canonical_stage: "failed",
              status: "Failed",
              provider_status: "failed",
              failure_reason: reason,
              provider_run_output: {
                ...previousRunOutput,
                launch_response: data,
                queue_parameters: queueParams,
              },
              updated_at: new Date().toISOString(),
            })
            .eq("id", appId);
          await refundQueuedAutoApplyLaunch(supabase, appRow, appId, reason);
        }

      } catch (err) {
        console.error(`[process-auto-apply-queue] Unexpected error launching application ${appId}`, err);
        const nextRetries = (appRow.retry_count || 0) + 1;
        await supabase
          .from("applications")
          .update({
            provider_status: nextRetries <= 3 ? "waiting" : "failed",
            canonical_stage: nextRetries <= 3 ? "queued" : "failed",
            status: nextRetries <= 3 ? "Pending" : "Failed",
            retry_count: nextRetries,
            failure_reason:
              nextRetries <= 3
                ? "Temporary automation launch error; retrying shortly."
                : "Automation failed to launch after multiple attempts.",
            updated_at: new Date().toISOString(),
          })
          .eq("id", appId);
        if (nextRetries > 3) {
          await refundQueuedAutoApplyLaunch(
            supabase,
            appRow,
            appId,
            "Automation failed to launch after multiple attempts.",
          );
        }
      }
    }

    return new Response(JSON.stringify({ success: true, launched: launchedCount, recovery }), {
      status: 200,
      headers: corsHeaders,
    });

  } catch (error: any) {
    console.error("[process-auto-apply-queue] Server error:", error);
    return new Response(JSON.stringify({ error: "Unable to process the Auto Apply queue.", code: "AUTO_APPLY_QUEUE_FAILED" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
