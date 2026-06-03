import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { recordSkyvernUsageFromOutput } from "../_shared/provider-credits.ts";
import { createNotificationRecord } from "../_shared/notification-center.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);
const PUBLIC_APP_URL =
  Deno.env.get("PUBLIC_APP_URL") ||
  Deno.env.get("APP_BASE_URL") ||
  Deno.env.get("SITE_URL") ||
  "https://app.jobraker.io";

type AutomationEmailSettings = {
  email_notifications?: boolean | null;
  email_applications?: boolean | null;
};

type AutomationEmailPayload = {
  userId: string;
  application: {
    id: string;
    job_title?: string | null;
    company?: string | null;
  };
  providerStatus: string | null | undefined;
  failureReason: string | null;
  runId: string;
  event: "retried" | "finalized";
  actionUrl: string;
};

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

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractFailureReasonFromValue(value: unknown, depth = 0): string | null {
  if (!value || depth > 8) return null;

  if (typeof value === "string") {
    return cleanString(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractFailureReasonFromValue(item, depth + 1);
      if (nested) return nested;
    }
    return null;
  }

  if (typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  for (const key of ["failure_reason", "error", "error_message", "summary"]) {
    const direct = cleanString(record[key]);
    if (direct) return direct;
  }

  for (const key of [
    "auto_apply_job_output",
    "output_value",
    "for_each_job_output",
    "workflow_run_output",
    "workflow_outputs",
    "output",
    "data",
  ]) {
    const nested = extractFailureReasonFromValue(record[key], depth + 1);
    if (nested) return nested;
  }

  return null;
}

function extractFailureReason(payload: Record<string, unknown>): string | null {
  const nestedReason = extractFailureReasonFromValue(payload);
  if (nestedReason) return nestedReason;

  return (
    cleanString(payload.message) ||
    cleanString(payload.status_reason) ||
    null
  );
}

function resolveEmailSender(): string {
  return (
    String(Deno.env.get("RESEND_FROM_EMAIL") || "").trim() ||
    "JobRaker Alerts <onboarding@resend.dev>"
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function getApplicationEmailEnabled(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("notification_settings")
    .select("email_notifications,email_applications")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Failed to load notification email settings", error);
    return true;
  }

  const settings = (data || {}) as AutomationEmailSettings;
  return settings.email_notifications !== false && settings.email_applications !== false;
}

async function getUserEmail(userId: string): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error) {
    console.warn("Failed to load user email for automation notification", error);
    return null;
  }

  return cleanString(data?.user?.email);
}

async function sendAutomationFailureEmail(payload: AutomationEmailPayload) {
  const apiKey = String(Deno.env.get("RESEND_API_KEY") || "").trim();
  if (!apiKey) {
    console.warn("Skipping automation failure email: RESEND_API_KEY is not configured");
    return { sent: false, reason: "missing_resend_api_key" };
  }

  const emailEnabled = await getApplicationEmailEnabled(payload.userId);
  if (!emailEnabled) {
    return { sent: false, reason: "disabled_by_settings" };
  }

  const recipient = await getUserEmail(payload.userId);
  if (!recipient) {
    return { sent: false, reason: "missing_user_email" };
  }

  const jobTitle = payload.application.job_title?.trim() || "Application";
  const company = payload.application.company?.trim();
  const statusLabel = String(payload.providerStatus || "failed").toLowerCase();
  const reason = payload.failureReason?.trim() ||
    "The automation could not complete this application.";
  const fullActionUrl = new URL(payload.actionUrl, PUBLIC_APP_URL).toString();
  const isRetry = payload.event === "retried";
  const subject = isRetry
    ? `JobRaker auto-apply issue: ${jobTitle}`
    : `JobRaker auto-apply failed: ${jobTitle}`;
  const intro = isRetry
    ? "JobRaker hit an automation issue and queued another attempt."
    : "JobRaker could not complete this auto-apply run.";
  const companyLine = company ? `Company: ${company}\n` : "";
  const text = [
    intro,
    "",
    `Role: ${jobTitle}`,
    companyLine.trimEnd(),
    `Status: ${statusLabel}`,
    `Reason: ${reason}`,
    "",
    `Open this application: ${fullActionUrl}`,
  ].filter(Boolean).join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
      <p>${escapeHtml(intro)}</p>
      <p>
        <strong>Role:</strong> ${escapeHtml(jobTitle)}<br>
        ${company ? `<strong>Company:</strong> ${escapeHtml(company)}<br>` : ""}
        <strong>Status:</strong> ${escapeHtml(statusLabel)}
      </p>
      <p><strong>Reason:</strong> ${escapeHtml(reason)}</p>
      <p><a href="${escapeHtml(fullActionUrl)}">Open this application in JobRaker</a></p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: resolveEmailSender(),
      to: recipient,
      subject,
      text,
      html,
    }),
  });

  const responsePayload = await response.json().catch(async () => ({
    raw: await response.text().catch(() => ""),
  }));

  if (!response.ok) {
    console.error("automation-failure-email.resend_failed", {
      status: response.status,
      payload: responsePayload,
      runId: payload.runId,
      applicationId: payload.application.id,
    });
    return { sent: false, reason: "resend_error", status: response.status };
  }

  return { sent: true };
}

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
    const reason = payload.failureReason?.trim();
    message = reason
      ? `${reason} JobRaker queued another attempt.`
      : company
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
    type = "application";
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

  if (providerStatus === "failed" || providerStatus === "terminated") {
    try {
      await sendAutomationFailureEmail({
        userId,
        application,
        providerStatus: payload.providerStatus,
        failureReason: payload.failureReason,
        runId: payload.runId,
        event: payload.event,
        actionUrl,
      });
    } catch (error) {
      console.warn("Failed to send automation failure email", error);
    }
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
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
    const failureReason = extractFailureReason(payload);

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
      .select("id, user_id, job_id, retry_count, notes, job_title, company, agent_run_id")
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
          provider_status: "waiting",
          run_id: null,
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

    if (applicationRow.agent_run_id) {
      try {
        const { data: settleResult, error: settleError } = await supabase.rpc(
          "check_and_settle_agent_run",
          { p_agent_run_id: applicationRow.agent_run_id }
        );
        if (settleError) {
          console.error("Failed to check and settle agent run:", settleError);
        } else {
          console.log("Check and settle agent run result:", settleResult);
        }
      } catch (err) {
        console.error("Error invoking check_and_settle_agent_run:", err);
      }
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
