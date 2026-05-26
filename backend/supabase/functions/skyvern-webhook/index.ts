import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { recordSkyvernUsageFromOutput } from "../_shared/provider-credits.ts";
import { createNotificationRecord } from "../_shared/notification-center.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

function hasValidWebhookSecret(req: Request): boolean {
  const expectedSecrets = [
    Deno.env.get("SKYVERN_WEBHOOK_SECRET"),
    Deno.env.get("SKYVERN_API_KEY"),
  ]
    .map((secret) => String(secret || "").trim())
    .filter(Boolean);
  if (expectedSecrets.length === 0) return false;

  let querySecret = "";
  try {
    querySecret = new URL(req.url).searchParams.get("token")?.trim() || "";
  } catch {
    querySecret = "";
  }

  const headerSecret = String(
    req.headers.get("x-jobraker-webhook-secret") ||
      req.headers.get("x-skyvern-webhook-secret") ||
      "",
  ).trim();
  const authSecret = String(req.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  return [querySecret, headerSecret, authSecret].some((provided) =>
    expectedSecrets.includes(provided)
  );
}

const mapProviderStatusToDisplay = (status: string | null | undefined) => {
  switch ((status || "").toLowerCase()) {
    case "completed":
      return { status: "Applied", canonical_stage: "submitted" };
    case "failed":
    case "terminated":
      return { status: "Failed", canonical_stage: "failed" };
    default:
      return { status: "Pending", canonical_stage: "queued" };
  }
};

const mapProviderStatusToJobState = (status: string | null | undefined) => {
  switch ((status || "").toLowerCase()) {
    case "completed":
      return "submitted";
    case "failed":
    case "terminated":
      return "failed";
    default:
      return "queued";
  }
};

async function createAutomationNotification(
  userId: string,
  application: {
    id: string;
    job_title?: string | null;
    company?: string | null;
  },
  payload: {
    providerStatus: string | null | undefined;
    failureReason: string | null;
    runId: string;
    event: "retried" | "finalized";
  },
) {
  const providerStatus = (payload.providerStatus || "").toLowerCase();
  const jobTitle = application.job_title?.trim() || "Application";
  const company = application.company?.trim() || null;
  const actionUrl = `/dashboard/application?application=${encodeURIComponent(application.id)}`;

  let title = `Automation update: ${jobTitle}`;
  let message = "Your auto-apply run changed state.";
  let priority: "low" | "medium" | "high" = "medium";
  let type: "application" | "system" | "interview" = "application";

  if (payload.event === "retried") {
    title = `Retrying auto-apply: ${jobTitle}`;
    message = company
      ? `${company} hit a temporary automation issue. JobRaker queued another attempt.`
      : "JobRaker queued another attempt after a temporary automation issue.";
    priority = "medium";
  } else if (providerStatus === "completed") {
    title = `Auto-apply completed: ${jobTitle}`;
    message = company
      ? `${company} was completed successfully by automation.`
      : "Your application automation completed successfully.";
    priority = "high";
  } else if (providerStatus === "failed" || providerStatus === "terminated") {
    title = `Auto-apply failed: ${jobTitle}`;
    message = payload.failureReason?.trim()
      ? payload.failureReason.trim()
      : company
        ? `${company} could not be completed automatically.`
        : "The automation could not complete this application.";
    priority = "high";
    type = "system";
  }

  try {
    await createNotificationRecord(supabase, {
      userId,
      type,
      title,
      message,
      company,
      priority,
      source: "automation",
      sourceRecordId: application.id,
      sourceRecordType: "application",
      actionUrl,
      actionLabel: "Open application",
      dedupeKey: `${payload.event === "retried" ? "automation-retry" : "automation-status"}:${payload.runId}:${providerStatus || "unknown"}`,
      metadata: {
        run_id: payload.runId,
        provider_status: payload.providerStatus || null,
        failure_reason: payload.failureReason,
        event: payload.event,
        application_id: application.id,
        job_title: jobTitle,
        company,
      },
    });
  } catch (error) {
    console.warn("Failed to create automation notification", error);
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    if (!hasValidWebhookSecret(req)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized webhook request" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const payload = await req.json();
    const runId = payload.id || payload.run_id;
    const providerStatus = payload.status;
    const screenshotUrls: string[] = payload.screenshot_urls || [];
    const failureReason =
      payload.error || payload.failure_reason || payload.message || null;

    if (!runId) {
      return new Response("Missing run_id", { status: 400 });
    }

    let receiptUrl = null;
    let successUrl = null;

    if (screenshotUrls.length > 0) {
      receiptUrl = screenshotUrls[0];
      if (providerStatus === "completed" && screenshotUrls.length > 1) {
        successUrl = screenshotUrls[screenshotUrls.length - 1];
      } else if (providerStatus === "completed") {
        successUrl = screenshotUrls[0];
      }
    }

    const { data: applicationRow, error: fetchError } = await supabase
      .from("applications")
      .select("id, user_id, job_id, retry_count, notes, job_title, company")
      .eq("run_id", runId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError || !applicationRow) {
      console.error("Failed to fetch application for webhook", fetchError);
      return new Response(JSON.stringify({ error: "Application not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      await recordSkyvernUsageFromOutput(supabase, payload, {
        runId,
        status: providerStatus,
        userId: applicationRow.user_id,
        applicationId: applicationRow.id,
        jobId: applicationRow.job_id,
        source: "skyvern-webhook",
      });
    } catch (creditError) {
      console.warn("Failed to record Skyvern provider credits", creditError);
    }

    const isFailed =
      providerStatus === "failed" || providerStatus === "terminated";
    const currentRetries = applicationRow.retry_count || 0;
    const MAX_RETRIES = 2;

    if (isFailed && currentRetries < MAX_RETRIES) {
      const { error: retryUpdateError } = await supabase
        .from("applications")
        .update({
          provider_status: "pending",
          retry_count: currentRetries + 1,
          status: "Pending",
          canonical_stage: "queued",
          failure_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", applicationRow.id);

      if (retryUpdateError) {
        console.error("Failed to mark retry in webhook", retryUpdateError);
      }

      if (applicationRow.job_id) {
        await supabase
          .from("jobs")
          .update({
            canonical_status: "queued",
            updated_at: new Date().toISOString(),
          })
          .eq("id", applicationRow.job_id)
          .eq("user_id", applicationRow.user_id);
      }

      await createAutomationNotification(applicationRow.user_id, applicationRow, {
        providerStatus,
        failureReason,
        runId,
        event: "retried",
      });

      return new Response(JSON.stringify({ success: true, retried: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const normalized = mapProviderStatusToDisplay(providerStatus);
    const updatePayload: Record<string, unknown> = {
      provider_status: providerStatus,
      status: normalized.status,
      canonical_stage: normalized.canonical_stage,
      failure_reason:
        normalized.canonical_stage === "failed" ? failureReason : null,
      updated_at: new Date().toISOString(),
      provider_run_output: payload,
    };

    if (receiptUrl) updatePayload.receipt_url = receiptUrl;
    if (successUrl) updatePayload.success_url = successUrl;

    const { error: updateError } = await supabase
      .from("applications")
      .update(updatePayload)
      .eq("run_id", runId);

    if (updateError) {
      console.error("Failed to update application via webhook", updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (applicationRow.job_id) {
      const { error: jobUpdateError } = await supabase
        .from("jobs")
        .update({
          canonical_status: mapProviderStatusToJobState(providerStatus),
          updated_at: new Date().toISOString(),
        })
        .eq("id", applicationRow.job_id)
        .eq("user_id", applicationRow.user_id);

      if (jobUpdateError) {
        console.error("Failed to update related job state", jobUpdateError);
      }
    }

    await createAutomationNotification(applicationRow.user_id, applicationRow, {
      providerStatus,
      failureReason,
      runId,
      event: "finalized",
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error processing webhook", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
