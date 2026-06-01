// @ts-nocheck
import { getCorsHeaders } from "../_shared/types.ts";
import {
  SubscriptionAccessError,
  requireSubscriptionTier,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";
import { decryptSymmetric } from "../_shared/crypto.ts";
import { signResumeProxyToken } from "../_shared/resume-proxy-token.ts";
import { applyMicro1ReferralToUrl } from "../_shared/micro1-referral.ts";
import {
  consumeAutoApplyRunQuota,
  getAutoApplyConcurrencyLimit,
  restoreAutoApplyRunQuota,
} from "../_shared/feature-limits.ts";
import { refundUserCredits } from "../_shared/refunds.ts";

const AUTOMATION_RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_AUTOMATIONS_PER_WINDOW = 20;

/** Default above Skyvern’s typical 50-step cap (iCIMS / long ATS). Override via body.max_steps_override or SKYVERN_MAX_STEPS_OVERRIDE. */
const DEFAULT_MAX_STEPS_OVERRIDE = 200;
const MAX_MAX_STEPS_OVERRIDE = 500;

const APPLY_AUTOMATION_HINTS = `[JobRaker automation — prioritize these]
1) Cookie/consent: Dismiss any cookie banner, “Manage preferences”, or privacy overlay first (Accept, Accept all, Reject non-essential, Save & close, or Close/X) so the form and file inputs are not covered.
2) Resume required: Parameters include a resume file URL (resume). On iCIMS and similar ATS, use device upload (“My Computer”, “Upload”, “Choose file”) and attach that file; prefer PDF; wait until the upload succeeds and validation clears before Next/Continue.
3) Breezy forms: click “Upload Resume” (not Indeed/LinkedIn), attach the resume file from the resume URL, then wait for a visible filename/upload success state before submitting.
4) Avoid burning steps only on overlays; complete resume upload, then remaining required fields.`;

function resolveMaxStepsOverride(body: Record<string, unknown>): number {
  const fromBody = body?.max_steps_override ?? body?.maxStepsOverride;
  let n: number | null = null;
  if (typeof fromBody === "number" && Number.isFinite(fromBody) && fromBody > 0) {
    n = Math.floor(fromBody);
  } else if (typeof fromBody === "string" && /^\d+$/.test(fromBody.trim())) {
    const parsed = parseInt(fromBody.trim(), 10);
    if (parsed > 0) n = parsed;
  } else {
    const envRaw = Deno.env.get("SKYVERN_MAX_STEPS_OVERRIDE");
    if (envRaw && /^\d+$/.test(envRaw.trim())) {
      const parsed = parseInt(envRaw.trim(), 10);
      if (parsed > 0) n = parsed;
    }
  }
  if (n == null) n = DEFAULT_MAX_STEPS_OVERRIDE;
  return Math.min(MAX_MAX_STEPS_OVERRIDE, Math.max(1, n));
}

function appendAutomationHints(base: string): string {
  const trimmed = (base || "").trim();
  if (!trimmed) return APPLY_AUTOMATION_HINTS;
  if (trimmed.includes("[JobRaker automation")) return trimmed;
  return `${trimmed}\n\n${APPLY_AUTOMATION_HINTS}`;
}

function parseRpcJsonObject(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function isRpcSuccess(row: Record<string, unknown> | null): boolean {
  if (!row) return false;
  const s = row.success;
  return s === true || s === "true" || String(s).toLowerCase() === "t";
}

// Skyvern's file parser expects a plain URL string, not a JSON-encoded one.
function normalizeHttpUrlString(raw: string): string {
  // Strip inline whitespace (line breaks in pasted URLs break `new URL()` / path parsing).
  let value = raw.trim().replace(/\s+/g, "");

  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === "string") {
      value = parsed.trim();
    }
  } catch {
    // Fall through to quote trimming.
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }

  return value;
}

function parseSupabaseSignedObjectPath(
  urlStr: string,
): { bucket: string; path: string } | null {
  try {
    const url = new URL(urlStr);
    const match = url.pathname.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/);
    if (!match) return null;

    return {
      bucket: decodeURIComponent(match[1]),
      path: decodeURIComponent(match[2]),
    };
  } catch {
    return null;
  }
}

async function refreshResumeSignedUrlIfPossible(
  resumeUrl: string,
  userId: string,
  serviceClient: any,
): Promise<string> {
  const parsed = parseSupabaseSignedObjectPath(resumeUrl);
  if (!parsed) return resumeUrl;

  const { bucket, path } = parsed;
  if (bucket !== "resumes" || !path.startsWith(`${userId}/`)) {
    return resumeUrl;
  }

  const ttlSeconds = 60 * 60 * 48;
  const { data, error } = await serviceClient.storage
    .from(bucket)
    .createSignedUrl(path, ttlSeconds);

  if (error || !data?.signedUrl) {
    console.warn("apply-to-jobs: refresh signed URL failed", error?.message);
    return resumeUrl;
  }

  return data.signedUrl;
}

/**
 * Skyvern often cannot fetch Supabase Storage signed URLs from its servers.
 * Replace with our edge `proxy-resume` URL (HMAC token) when possible.
 */
async function resumeUrlForSkyvern(
  resumeUrl: string,
  userId: string,
): Promise<string> {
  const parsed = parseSupabaseSignedObjectPath(resumeUrl);
  if (!parsed || parsed.bucket !== "resumes" || !parsed.path.startsWith(`${userId}/`)) {
    return resumeUrl;
  }
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 72; // 72h
  const token = await signResumeProxyToken({
    path: parsed.path,
    uid: userId,
    exp,
  });
  const base = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  if (!base) return resumeUrl;
  return `${base}/functions/v1/proxy-resume?t=${encodeURIComponent(token)}`;
}

function asArray(val: any): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Fall through.
    }
    const trimmed = val.trim();
    if (trimmed) return [trimmed];
  }
  if (val && typeof val === "object") return [val];
  return [];
}

function extractJobUrls(input: any): string[] {
  const arr = asArray(input);
  const urls: string[] = [];
  for (const item of arr) {
    if (typeof item === "string") {
      urls.push(item);
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const url = item.sourceUrl || item.url || item.source_url;
    if (typeof url === "string" && url.trim()) {
      urls.push(url.trim());
    }
  }
  return Array.from(new Set(urls));
}

function stringifyArrayForSkyvern(urls: string[]): string {
  return JSON.stringify(urls, null, 2);
}

function extractJobContext(body: any) {
  const firstJob = asArray(body?.jobs).find(
    (item) => item && typeof item === "object",
  ) as Record<string, any> | undefined;

  return {
    job_id: body?.job_id || firstJob?.job_id || null,
    job_title: body?.job_title || firstJob?.job_title || null,
    company: body?.company || firstJob?.company || null,
    location: body?.location || firstJob?.location || null,
    salary: body?.salary || firstJob?.salary || null,
    match_score:
      typeof body?.match_score === "number"
        ? body.match_score
        : typeof firstJob?.match_score === "number"
          ? firstJob.match_score
          : null,
    match_reasons:
      Array.isArray(body?.match_reasons)
        ? body.match_reasons
        : Array.isArray(firstJob?.match_reasons)
          ? firstJob.match_reasons
          : null,
    ai_confidence_score:
      typeof body?.ai_confidence_score === "number"
        ? body.ai_confidence_score
        : typeof firstJob?.ai_confidence_score === "number"
          ? firstJob.ai_confidence_score
          : null,
    evaluation_id: body?.evaluation_id || firstJob?.evaluation_id || null,
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin") || undefined);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  let billingForResponse: Record<string, unknown> | null = null;
  let agentRunId: string | null = null;
  let applicationEnqueued = false;

  try {
    const body = await req.json().catch(() => ({}));
    const { user, serviceClient, subscriptionTier } = await requireSubscriptionTier(
      req,
      "Free",
      "Auto apply",
    );

    const userId = user.id;
    const email =
      typeof body?.email === "string" && body.email.trim()
        ? body.email.trim()
        : user.email || "";
    const jobUrlsFromJobUrls = extractJobUrls(body?.job_urls);
    const jobUrlsFromJobs = extractJobUrls(body?.jobs);
    const jobUrls = (
      jobUrlsFromJobUrls.length > 0 ? jobUrlsFromJobUrls : jobUrlsFromJobs
    ).map((u) => applyMicro1ReferralToUrl(u));
    const jobContext = extractJobContext(body);
    const userInput = typeof body?.user_input === "object" ? body.user_input : {};
    const sourceCredentials: Record<string, any> = {};

    // Pull per-domain login credentials into the Skyvern payload when available.
    try {
      const { data: sourceSettings } = await serviceClient
        .from("job_source_settings")
        .select("source_credentials")
        .eq("id", userId)
        .single();

      if (sourceSettings && sourceSettings.source_credentials) {
        for (const [domain, encryptedCreds] of Object.entries(
          sourceSettings.source_credentials,
        )) {
          if (typeof encryptedCreds === "string") {
            try {
              const decryptedJson = await decryptSymmetric(encryptedCreds);
              sourceCredentials[domain] = JSON.parse(decryptedJson);
            } catch (error: any) {
              console.error(`Failed to decrypt credentials for ${domain}:`, error.message);
            }
          }
        }
      }
    } catch (error: any) {
      console.error("Error fetching job source settings:", error.message);
    }

    if (!jobUrls.length) {
      return new Response(
        JSON.stringify({
          error: "job_urls is required (array of URLs or jobs with sourceUrl)",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    // Tier gate is Free+; rate limit and credits (client / other RPCs) constrain abuse.
    const oneMinuteAgo = new Date(
      Date.now() - AUTOMATION_RATE_LIMIT_WINDOW_MS,
    ).toISOString();
    const { count } = await serviceClient
      .from("applications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", oneMinuteAgo);

    if (count && count >= MAX_AUTOMATIONS_PER_WINDOW) {
      return new Response(
        JSON.stringify({
          error:
            "Rate limit exceeded. Please wait a moment before heavily automating applications.",
          retry_after_seconds: Math.ceil(
            AUTOMATION_RATE_LIMIT_WINDOW_MS / 1000,
          ),
          limit: MAX_AUTOMATIONS_PER_WINDOW,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    const workflowId =
      typeof body?.workflow_id === "string" && body.workflow_id
        ? body.workflow_id
        : Deno.env.get("SKYVERN_WORKFLOW_ID") || "";

    if (!workflowId) {
      return new Response(
        JSON.stringify({
          error: "workflow_id not provided and SKYVERN_WORKFLOW_ID env not set",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    const concurrencyResult = await getAutoApplyConcurrencyLimit({
      userId,
      serviceClient,
      subscriptionTier,
    });

    const automationJobCount = jobUrls.length;
    const quotaResult = await consumeAutoApplyRunQuota({
      userId,
      serviceClient,
      subscriptionTier,
      quantity: automationJobCount,
    });
    if (!quotaResult.success) {
      return new Response(
        JSON.stringify({
          error: quotaResult.message,
          code: "auto_apply_quota_exceeded",
          remaining_runs: quotaResult.remaining,
          included_runs: quotaResult.included,
          used_runs: quotaResult.used,
          period_end: quotaResult.periodEnd,
          subscription_tier: quotaResult.subscriptionTier,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    const runIdempotencyKey = crypto.randomUUID();
    const { data: reserveRaw, error: reserveError } = await serviceClient.rpc(
      "reserve_credits_for_run",
      {
        p_user_id: userId,
        p_run_type: "auto_apply",
        p_estimated_credits: automationJobCount * 5,
        p_idempotency_key: runIdempotencyKey,
        p_metadata: {
          job_id: jobContext.job_id,
          job_urls: jobUrls,
          source: "apply-to-jobs",
        },
      },
    );

    if (reserveError) {
      console.error("apply-to-jobs: reserve_credits_for_run RPC error:", reserveError);
      if (quotaResult.success && quotaResult.periodStart && quotaResult.periodEnd) {
        await restoreAutoApplyRunQuota(
          serviceClient,
          userId,
          quotaResult.periodStart,
          quotaResult.periodEnd,
          automationJobCount,
        );
      }
      return new Response(
        JSON.stringify({
          error: "Could not verify automation credits. Please try again.",
          code: "billing_error",
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    const reserve = parseRpcJsonObject(reserveRaw);
    if (!isRpcSuccess(reserve)) {
      if (quotaResult.success && quotaResult.periodStart && quotaResult.periodEnd) {
        await restoreAutoApplyRunQuota(
          serviceClient,
          userId,
          quotaResult.periodStart,
          quotaResult.periodEnd,
          automationJobCount,
        );
      }
      return new Response(
        JSON.stringify({
          error: (reserve?.message as string) || "Insufficient credits for auto apply.",
          code: "insufficient_credits",
          current_balance: reserve?.current_balance,
          required_credits: automationJobCount * 5,
        }),
        {
          status: 402,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    agentRunId = reserve.agent_run_id as string;

    billingForResponse = {
      agent_run_id: agentRunId,
      credits_reserved: reserve?.credits_reserved ?? automationJobCount * 5,
      remaining_balance: reserve?.current_balance,
      jobs_count: automationJobCount,
      auto_apply_runs_remaining: quotaResult.remaining,
      auto_apply_runs_included: quotaResult.included,
      auto_apply_period_end: quotaResult.periodEnd,
      auto_apply_parallel_runs_base: concurrencyResult.baseLimit,
      auto_apply_parallel_runs_boost: concurrencyResult.addonLimit,
      auto_apply_parallel_runs_total: concurrencyResult.totalLimit,
      auto_apply_parallel_runs_active: concurrencyResult.activeRuns,
      auto_apply_parallel_runs_available_before_launch:
        concurrencyResult.availableRuns,
      note:
        "Reserved credits for run. Net billing occurs when Skyvern completes execution.",
    };

    let additionalInformation =
      typeof body?.additional_information === "string"
        ? body.additional_information
        : "";
    let resume =
      typeof body?.resume === "string" ? normalizeHttpUrlString(body.resume) : "";
    const resumeText = typeof body?.resume_text === "string" ? body.resume_text : "";
    if (resume && (resume.startsWith("http://") || resume.startsWith("https://"))) {
      try {
        resume = await refreshResumeSignedUrlIfPossible(
          resume,
          userId,
          serviceClient,
        );
      } catch (error: any) {
        console.warn("apply-to-jobs: refreshResumeSignedUrlIfPossible", error?.message);
      }
      try {
        resume = await resumeUrlForSkyvern(resume, userId);
      } catch (error: any) {
        console.warn("apply-to-jobs: resumeUrlForSkyvern", error?.message);
      }
    }
    const coverLetter =
      typeof body?.cover_letter === "string" ? body.cover_letter : "";
    const title = typeof body?.title === "string" ? body.title : undefined;
    const proxyLocation =
      typeof body?.proxy_location === "string" ? body.proxy_location : undefined;

    const safeUserInput = {
      ...userInput,
      id: userId,
      ...(email ? { email } : {}),
      ...(Object.keys(sourceCredentials).length > 0
        ? { source_credentials: sourceCredentials }
        : {}),
    };

    if (!additionalInformation && safeUserInput && typeof safeUserInput === "object") {
      const parts: string[] = [];
      const fullName = [safeUserInput.first_name, safeUserInput.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (fullName) parts.push(`Name: ${fullName}`);
      if (email) parts.push(`Email: ${email}`);
      if (safeUserInput.job_title) parts.push(`Current Title: ${safeUserInput.job_title}`);
      if (safeUserInput.experience_years != null) {
        parts.push(`Experience: ${safeUserInput.experience_years} years`);
      }
      if (safeUserInput.location) parts.push(`Location: ${safeUserInput.location}`);
      if (Array.isArray(safeUserInput.goals) && safeUserInput.goals.length) {
        parts.push(`Goals: ${safeUserInput.goals.join(", ")}`);
      }
      additionalInformation = parts.join("\n");
    }

    const skipHints =
      body?.skip_automation_hints === true || body?.skipAutomationHints === true;
    if (!skipHints) {
      additionalInformation = appendAutomationHints(additionalInformation);
    }

    const isResumeUrl = resume.startsWith("http://") || resume.startsWith("https://");
    const parameters: Record<string, unknown> = {
      job_urls: stringifyArrayForSkyvern(jobUrls),
      additional_information: additionalInformation,
      resume: isResumeUrl ? resume : "",
      resume_text: resumeText || (!isResumeUrl && resume ? resume : ""),
      user_input: JSON.stringify(safeUserInput),
      email,
      cover_letter: coverLetter,
    };

    let webhookUrl: string | undefined;
    try {
      const url = new URL(req.url);
      const webhookSecret =
        Deno.env.get("SKYVERN_WEBHOOK_SECRET") ||
        Deno.env.get("SKYVERN_API_KEY") ||
        "";
      if (url.hostname.endsWith(".functions.supabase.co")) {
        webhookUrl = `${url.origin}/skyvern-webhook` +
          (webhookSecret ? `?token=${encodeURIComponent(webhookSecret)}` : "");
      } else {
        const base = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
        if (base) {
          webhookUrl = `${base}/functions/v1/skyvern-webhook` +
            (webhookSecret ? `?token=${encodeURIComponent(webhookSecret)}` : "");
        }
      }
    } catch {
      // Use empty webhook fallback.
    }

    const maxSteps = resolveMaxStepsOverride(body as Record<string, unknown>);
    const queueParameters = {
      workflow_id: workflowId,
      parameters,
      proxy_location: proxyLocation,
      webhook_url: webhookUrl,
      title,
      max_steps_override: maxSteps,
    };

    const data = { status: "waiting", run_id: null };
    const applyUrl = jobUrls[0] || null;
    const nowIso = new Date().toISOString();

    const applicationPayload = {
      run_id: null,
      agent_run_id: agentRunId,
      job_id: jobContext.job_id,
      user_id: userId,
      job_title: jobContext.job_title || title || "Automation run",
      company: jobContext.company || "Unknown",
      location: jobContext.location || "",
      applied_date: nowIso,
      status: "Pending",
      canonical_stage: "queued",
      draft_status: "sent",
      salary: jobContext.salary || null,
      notes: `Source: ${jobUrls.join("|")}`,
      next_step: null,
      interview_date: null,
      logo: null,
      workflow_id: workflowId,
      app_url: applyUrl,
      provider_status: "waiting",
      failure_reason: null,
      match_score: jobContext.match_score,
      match_reasons: jobContext.match_reasons,
      ai_confidence_score: jobContext.ai_confidence_score,
      user_review_notes: null,
      provider_run_output: { queue_parameters: queueParameters },
    };

    const upgradeDraftApplication = async (): Promise<boolean> => {
      if (!jobContext.job_id) return false;
      const upgradePatch = {
        run_id: applicationPayload.run_id,
        agent_run_id: applicationPayload.agent_run_id,
        job_title: applicationPayload.job_title,
        company: applicationPayload.company,
        location: applicationPayload.location,
        applied_date: applicationPayload.applied_date,
        status: applicationPayload.status,
        canonical_stage: applicationPayload.canonical_stage,
        draft_status: applicationPayload.draft_status,
        salary: applicationPayload.salary,
        notes: applicationPayload.notes,
        next_step: applicationPayload.next_step,
        interview_date: applicationPayload.interview_date,
        logo: applicationPayload.logo,
        workflow_id: applicationPayload.workflow_id,
        app_url: applicationPayload.app_url,
        provider_status: applicationPayload.provider_status,
        failure_reason: applicationPayload.failure_reason,
        match_score: applicationPayload.match_score,
        match_reasons: applicationPayload.match_reasons,
        ai_confidence_score: applicationPayload.ai_confidence_score,
        user_review_notes: applicationPayload.user_review_notes,
        provider_run_output: applicationPayload.provider_run_output,
        updated_at: nowIso,
      };
      const { data: upgraded, error: upgradeError } = await serviceClient
        .from("applications")
        .update(upgradePatch)
        .eq("user_id", userId)
        .eq("job_id", jobContext.job_id)
        .eq("canonical_stage", "draft_ready")
        .select("id");
      if (upgradeError) {
        console.error("Failed to upgrade draft application row", upgradeError);
        return false;
      }
      return Array.isArray(upgraded) && upgraded.length > 0;
    };

    const upgradedFromDraft = await upgradeDraftApplication();
    if (!upgradedFromDraft) {
      const { error: applicationError } = await serviceClient
        .from("applications")
        .insert(applicationPayload);

      if (applicationError) {
        console.error("Failed to create queued application record", applicationError);
        if (quotaResult.success && quotaResult.periodStart && quotaResult.periodEnd) {
          await restoreAutoApplyRunQuota(
            serviceClient,
            userId,
            quotaResult.periodStart,
            quotaResult.periodEnd,
            automationJobCount,
          );
        }
        if (agentRunId) {
          await serviceClient.rpc("settle_run_credits", {
            p_agent_run_id: agentRunId,
            p_actual_credits: 0,
            p_status: "failed",
            p_failure_reason: "Failed to queue application: " + applicationError.message,
            p_receipt: { reason: applicationError.message, error_code: "auto_apply_enqueue_failed" }
          });
        }
        return new Response(
          JSON.stringify({
            error: "Could not queue this auto-apply run. Your credits and run quota were refunded.",
            code: "auto_apply_enqueue_failed",
          }),
          {
            status: 503,
            headers: { ...corsHeaders, "content-type": "application/json" },
          },
        );
      }
    }
    applicationEnqueued = true;

    if (jobContext.job_id) {
      const jobUpdateBase: Record<string, unknown> = {
        canonical_status: "queued",
        updated_at: nowIso,
      };
      const { data: jobRow, error: jobFetchError } = await serviceClient
        .from("jobs")
        .select("raw_data")
        .eq("id", jobContext.job_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (jobFetchError) {
        console.warn("apply-to-jobs: fetch job raw_data", jobFetchError.message);
      } else if (
        jobRow?.raw_data &&
        typeof jobRow.raw_data === "object" &&
        !Array.isArray(jobRow.raw_data) &&
        "application_draft" in (jobRow.raw_data as object)
      ) {
        const { application_draft: _draft, ...restRaw } = jobRow.raw_data as Record<
          string,
          unknown
        >;
        jobUpdateBase.raw_data = restRaw;
      }

      const { error: jobUpdateError } = await serviceClient
        .from("jobs")
        .update(jobUpdateBase)
        .eq("id", jobContext.job_id)
        .eq("user_id", userId);

      if (jobUpdateError) {
        console.error("Failed to update queued job state", jobUpdateError);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        enqueued: true,
        automation: data,
        provider: data,
        billing: billingForResponse,
        concurrency: {
          base_limit: concurrencyResult.baseLimit,
          boost_limit: concurrencyResult.addonLimit,
          total_limit: concurrencyResult.totalLimit,
          active_runs: concurrencyResult.activeRuns,
          available_runs: concurrencyResult.availableRuns,
          period_end: concurrencyResult.periodEnd,
        },
        submitted: {
          workflow_id: workflowId,
          count: jobUrls.length,
          max_steps_override: maxSteps,
        },
      }),
      {
        headers: { ...corsHeaders, "content-type": "application/json" },
        status: 200,
      },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("apply-to-jobs error", message);
    if (agentRunId && !applicationEnqueued) {
      try {
        await serviceClient.rpc("settle_run_credits", {
          p_agent_run_id: agentRunId,
          p_actual_credits: 0,
          p_status: "failed",
          p_failure_reason: "Function execution error: " + message,
          p_receipt: { reason: "Edge function execution crash", error: message }
        });
      } catch (settleErr) {
        console.error("Failed to settle run on exception fallback:", settleErr);
      }
    }
    if (error instanceof SubscriptionAccessError) {
      return subscriptionErrorResponse(error, corsHeaders);
    }
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
