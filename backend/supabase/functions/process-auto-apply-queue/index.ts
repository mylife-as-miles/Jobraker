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
      await supabase.rpc("settle_run_credits", {
        p_agent_run_id: appRow.agent_run_id,
        p_actual_credits: 0,
        p_status: "failed",
        p_failure_reason: `Failed during launch: ${reason}`,
        p_receipt: {
          application_id: appId,
          job_id: appRow.job_id,
          reason: reason,
          source: "process-auto-apply-queue"
        }
      });
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

    if (!token || (token !== serviceRoleKey && token !== "SYSTEM_TRIGGER")) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey!, {
      auth: { persistSession: false },
    });

    const skyvernKey = Deno.env.get("SKYVERN_API_KEY");
    if (!skyvernKey) {
      console.error("[process-auto-apply-queue] SKYVERN_API_KEY is not configured.");
      return new Response("SKYVERN_API_KEY is not configured", { status: 500, headers: corsHeaders });
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
      return new Response(JSON.stringify({ error: acquireError.message }), { status: 500, headers: corsHeaders });
    }

    const ids = Array.isArray(candidateIds)
      ? candidateIds
          .map((row: any) => (typeof row === "string" ? row : row?.application_id))
          .filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
      : [];
    if (ids.length === 0) {
      return new Response(JSON.stringify({ success: true, launched: 0 }), { status: 200, headers: corsHeaders });
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

      const { workflow_id, parameters, proxy_location, webhook_url, title, max_steps_override } = queueParams;

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

    return new Response(JSON.stringify({ success: true, launched: launchedCount }), {
      status: 200,
      headers: corsHeaders,
    });

  } catch (error: any) {
    console.error("[process-auto-apply-queue] Server error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
