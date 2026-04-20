// @ts-nocheck
import {
  getFirecrawlCreditUsage,
  getFirecrawlHistoricalCreditUsage,
  resolveFirecrawlApiKey,
} from "./firecrawl.ts";

type ProviderName = "firecrawl" | "skyvern";

const SKYVERN_TERMINAL_STATUSES = new Set([
  "completed",
  "succeeded",
  "success",
  "failed",
  "error",
  "cancelled",
  "canceled",
  "terminated",
  "timed_out",
]);

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizePositiveInteger(value: unknown): number {
  const numeric = asNumber(value);
  if (numeric === null) return 0;
  return Math.max(0, Math.floor(numeric));
}

function getTimestamp(value: unknown): number | null {
  if (!value) return null;
  const timestamp = new Date(String(value)).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getPeriodCredits(period: any): number {
  return normalizePositiveInteger(
    period?.totalCredits ??
      period?.total_credits ??
      period?.creditsUsed ??
      period?.credits_used,
  );
}

function getCurrentFirecrawlPeriodCredits(
  periods: any[],
  billingPeriodStart?: unknown,
  billingPeriodEnd?: unknown,
): number {
  if (!Array.isArray(periods) || periods.length === 0) return 0;

  const now = Date.now();
  const billingStart = getTimestamp(billingPeriodStart);
  const billingEnd = getTimestamp(billingPeriodEnd);

  const matchingPeriod = periods.find((period) => {
    const start = getTimestamp(period?.startDate ?? period?.start_date ?? period?.periodStart);
    const end = getTimestamp(period?.endDate ?? period?.end_date ?? period?.periodEnd);
    if (!start || !end) return false;

    if (billingStart && billingEnd) {
      return start < billingEnd && end > billingStart;
    }

    return start <= now && now <= end;
  });

  if (matchingPeriod) return getPeriodCredits(matchingPeriod);

  const latestPeriod = [...periods].sort((a, b) => {
    const aTime = getTimestamp(a?.endDate ?? a?.end_date ?? a?.periodEnd) ?? 0;
    const bTime = getTimestamp(b?.endDate ?? b?.end_date ?? b?.periodEnd) ?? 0;
    return bTime - aTime;
  })[0];

  return getPeriodCredits(latestPeriod);
}

function extractSkyvernStepCount(output: any): number {
  const candidates = [
    output?.step_count,
    output?.steps_count,
    output?.usage?.step_count,
    output?.usage?.steps_count,
    output?.data?.step_count,
    output?.data?.steps_count,
  ];

  for (const candidate of candidates) {
    const value = normalizePositiveInteger(candidate);
    if (value > 0) return value;
  }

  return 0;
}

function isSkyvernTerminalStatus(status: unknown): boolean {
  return SKYVERN_TERMINAL_STATUSES.has(String(status || "").toLowerCase());
}

function resolveAlertSender(): string {
  return (
    String(Deno.env.get("RESEND_FROM_EMAIL") || "").trim() ||
    "JobRaker Alerts <onboarding@resend.dev>"
  );
}

function getEnvValue(...names: string[]): string {
  for (const name of names) {
    const value = String(Deno.env.get(name) || "").trim();
    if (value) return value;
  }
  return "";
}

function isEnvEnabled(name: string, defaultValue = false): boolean {
  const value = String(Deno.env.get(name) || "").trim().toLowerCase();
  if (!value) return defaultValue;
  return ["1", "true", "yes", "on"].includes(value);
}

function usesResendTestingDomain(sender: string): boolean {
  return /@resend\.dev\b/i.test(sender);
}

function resolveAlertRecipient(row: any): string {
  const ownerEmail = getEnvValue(
    "RESEND_OWNER_EMAIL",
    "RESEND_ACCOUNT_EMAIL",
    "PROVIDER_CREDIT_ALERT_EMAIL",
    "RESEND_ALERT_EMAIL",
    "ADMIN_ALERT_EMAIL",
  );
  const sender = resolveAlertSender();
  const ownerOnly = isEnvEnabled("RESEND_OWNER_ONLY", false) || usesResendTestingDomain(sender);

  if (ownerOnly) {
    return ownerEmail;
  }

  return String(row?.alert_email || "").trim() || ownerEmail;
}

function formatProviderName(provider: ProviderName, displayName?: string): string {
  if (displayName) return displayName;
  return provider === "firecrawl" ? "Firecrawl" : "Skyvern";
}

async function sendResendEmail(args: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const apiKey = String(Deno.env.get("RESEND_API_KEY") || "").trim();
  if (!apiKey) {
    return { sent: false, reason: "missing_resend_api_key" };
  }

  if (!args.to) {
    return { sent: false, reason: "missing_alert_email" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: resolveAlertSender(),
      to: args.to,
      subject: args.subject,
      text: args.text,
      html: args.html,
    }),
  });

  const payload = await response.json().catch(async () => ({
    raw: await response.text().catch(() => ""),
  }));

  if (!response.ok) {
    console.error("provider-credit-alert.resend_failed", {
      status: response.status,
      payload,
    });
    return { sent: false, reason: "resend_error", status: response.status, payload };
  }

  return { sent: true, data: payload };
}

async function maybeSendProviderCreditAlert(serviceClient: any, provider: ProviderName) {
  const { data: row, error } = await serviceClient
    .from("provider_credit_balances")
    .select("*")
    .eq("provider", provider)
    .maybeSingle();

  if (error || !row) {
    console.warn("provider-credit-alert.balance_lookup_failed", { provider, error });
    return { sent: false, reason: "balance_not_found" };
  }

  const remaining = normalizePositiveInteger(row.remaining_credits);
  const threshold = normalizePositiveInteger(row.alert_threshold ?? 500);
  if (!row.alert_enabled || remaining > threshold) {
    return { sent: false, reason: "above_threshold", remaining, threshold };
  }

  const lastRemaining = asNumber(row.last_alert_remaining);
  const lastSentAt = row.last_alert_sent_at ? new Date(row.last_alert_sent_at) : null;
  const hoursSinceLastAlert = lastSentAt
    ? (Date.now() - lastSentAt.getTime()) / (1000 * 60 * 60)
    : Infinity;
  const currentBucket = Math.floor(remaining / 100);
  const lastBucket = lastRemaining === null ? null : Math.floor(lastRemaining / 100);
  const crossedThreshold = lastRemaining === null || lastRemaining > threshold;
  const crossedLowerBucket = lastBucket !== null && currentBucket < lastBucket;

  if (!crossedThreshold && !crossedLowerBucket && hoursSinceLastAlert < 24) {
    return { sent: false, reason: "alert_cooldown", remaining, threshold };
  }

  const to = resolveAlertRecipient(row);
  const providerName = formatProviderName(provider, row.display_name);
  const total = normalizePositiveInteger(row.total_credits);
  const used = Math.max(0, total - remaining);
  const subject = `Low ${providerName} credits: ${remaining.toLocaleString()} remaining`;
  const text = [
    `${providerName} credits are below the configured threshold.`,
    `Remaining: ${remaining.toLocaleString()}`,
    `Threshold: ${threshold.toLocaleString()}`,
    `Total: ${total.toLocaleString()}`,
    `Used: ${used.toLocaleString()}`,
    "Open the JobRaker admin provider credits page to update credits or top up the provider account.",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
      <h2 style="margin:0 0 12px">${providerName} credits are running low</h2>
      <p>The remaining provider credits are below the configured alert threshold.</p>
      <ul>
        <li><strong>Remaining:</strong> ${remaining.toLocaleString()}</li>
        <li><strong>Threshold:</strong> ${threshold.toLocaleString()}</li>
        <li><strong>Total:</strong> ${total.toLocaleString()}</li>
        <li><strong>Used:</strong> ${used.toLocaleString()}</li>
      </ul>
      <p>Open the JobRaker admin provider credits page to update credits or top up the provider account.</p>
    </div>
  `;

  const result = await sendResendEmail({ to, subject, text, html });

  if (result.sent) {
    await serviceClient
      .from("provider_credit_balances")
      .update({
        last_alert_sent_at: new Date().toISOString(),
        last_alert_remaining: remaining,
      })
      .eq("provider", provider);

    await serviceClient.from("provider_credit_transactions").insert({
      provider,
      event_type: "alert",
      amount: 0,
      balance_before: remaining,
      balance_after: remaining,
      total_credits: total,
      source: "resend",
      description: `${providerName} low-credit alert sent`,
      metadata: { to, threshold, remaining },
    });
  }

  return { ...result, remaining, threshold };
}

async function syncFirecrawlCreditUsage(
  serviceClient: any,
  metadata: Record<string, unknown> = {},
) {
  const apiKey = await resolveFirecrawlApiKey();
  const usage = await getFirecrawlCreditUsage(apiKey);
  let historicalUsage: any = null;
  let historicalWarning: string | null = null;

  try {
    historicalUsage = await getFirecrawlHistoricalCreditUsage(apiKey);
  } catch (error) {
    historicalWarning =
      error instanceof Error ? error.message : "Firecrawl historical usage unavailable";
    console.warn("firecrawl.historical_credit_usage_failed", { error: historicalWarning });
  }

  const remainingCredits = normalizePositiveInteger(usage.remainingCredits);
  const planCredits = normalizePositiveInteger(usage.planCredits);
  const currentPeriodUsedCredits = getCurrentFirecrawlPeriodCredits(
    historicalUsage?.periods || [],
    usage.billingPeriodStart,
    usage.billingPeriodEnd,
  );
  const effectiveTotalCredits = Math.max(
    planCredits,
    remainingCredits,
    remainingCredits + currentPeriodUsedCredits,
  );

  const { data, error } = await serviceClient.rpc("set_provider_credit_balance", {
    p_provider: "firecrawl",
    p_total_credits: effectiveTotalCredits,
    p_remaining_credits: remainingCredits,
    p_source: "firecrawl_api",
    p_description: "Firecrawl credit balance refreshed from API",
    p_metadata: {
      ...metadata,
      planCredits,
      reportedRemainingCredits: remainingCredits,
      currentPeriodUsedCredits,
      effectiveTotalCredits,
      historicalWarning,
      billingPeriodStart: usage.billingPeriodStart,
      billingPeriodEnd: usage.billingPeriodEnd,
    },
  });

  if (error) {
    console.error("firecrawl.credit_sync_failed", error);
    throw error;
  }

  const alert = await maybeSendProviderCreditAlert(serviceClient, "firecrawl");
  return {
    usage: {
      ...usage,
      planCredits,
      remainingCredits,
      currentPeriodUsedCredits,
      effectiveTotalCredits,
    },
    historicalUsage,
    balance: data,
    alert,
  };
}

async function recordSkyvernUsageFromOutput(
  serviceClient: any,
  output: any,
  metadata: Record<string, unknown> = {},
) {
  const runId =
    String(metadata.runId || output?.run_id || output?.id || "").trim() || null;
  const status = output?.status || metadata.status;

  if (!isSkyvernTerminalStatus(status)) {
    return { recorded: false, reason: "non_terminal_status", status };
  }

  const stepCount = extractSkyvernStepCount(output);
  if (stepCount <= 0) {
    return { recorded: false, reason: "missing_step_count", status };
  }

  const { data, error } = await serviceClient.rpc("record_provider_credit_usage", {
    p_provider: "skyvern",
    p_credits_consumed: stepCount,
    p_external_id: runId,
    p_source: String(metadata.source || "skyvern_output"),
    p_description: `Skyvern run consumed ${stepCount} step credits`,
    p_metadata: {
      ...metadata,
      runId,
      status,
      step_count: stepCount,
    },
  });

  if (error) {
    console.error("skyvern.credit_usage_record_failed", { runId, error });
    throw error;
  }

  const alert = await maybeSendProviderCreditAlert(serviceClient, "skyvern");
  return { recorded: true, usage: data, alert };
}

export {
  maybeSendProviderCreditAlert,
  recordSkyvernUsageFromOutput,
  syncFirecrawlCreditUsage,
};
