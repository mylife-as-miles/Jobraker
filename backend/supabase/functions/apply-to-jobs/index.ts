// @ts-nocheck
import { getCorsHeaders } from "../_shared/types.ts";
import {
  SubscriptionAccessError,
  requireSubscriptionTier,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";
import { decryptSymmetric } from "../_shared/crypto.ts";
import { signResumeProxyToken } from "../_shared/resume-proxy-token.ts";

const SKYVERN_ENDPOINT = "https://api.skyvern.com/v1/run/workflows";
const AUTOMATION_RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_AUTOMATIONS_PER_WINDOW = 20;

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

async function withRetry(fn: () => Promise<any>, attempts = 3, baseDelayMs = 500) {
  let last: any;
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (index < attempts - 1) {
        const delay = baseDelayMs * Math.pow(2, index);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw last;
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

  try {
    const body = await req.json().catch(() => ({}));
    const { user, serviceClient } = await requireSubscriptionTier(
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
    const jobUrls =
      jobUrlsFromJobUrls.length > 0 ? jobUrlsFromJobUrls : jobUrlsFromJobs;
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

    const automationJobCount = jobUrls.length;
    const { data: deductRaw, error: deductError } = await serviceClient.rpc(
      "deduct_auto_apply_credits",
      { p_user_id: userId, p_jobs_count: automationJobCount },
    );
    if (deductError) {
      console.error("apply-to-jobs: deduct_auto_apply_credits RPC error:", deductError);
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
    const deduct = deductRaw as Record<string, unknown> | null;
    if (!deduct || deduct.success !== true) {
      return new Response(
        JSON.stringify({
          error: (deduct?.message as string) || "Insufficient credits for auto apply.",
          code: "insufficient_credits",
          current_balance: deduct?.current_balance,
          required_credits: deduct?.required_credits,
        }),
        {
          status: 402,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    const envKey = Deno.env.get("SKYVERN_API_KEY");
    const headerKey = req.headers.get("x-skyvern-api-key") || req.headers.get("x-api-key");
    const apiKey = envKey || headerKey;
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "SKYVERN_API_KEY missing (env or x-skyvern-api-key header)",
        }),
        {
          status: 400,
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
      typeof body?.cover_letter === "string" ? body.cover_letter : undefined;
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

    const isResumeUrl = resume.startsWith("http://") || resume.startsWith("https://");
    const parameters: Record<string, unknown> = {
      job_urls: stringifyArrayForSkyvern(jobUrls),
      additional_information: additionalInformation,
      resume: isResumeUrl ? resume : "",
      resume_text: resumeText || (!isResumeUrl && resume ? resume : ""),
      user_input: JSON.stringify(safeUserInput),
      email,
    };

    if (coverLetter && coverLetter.trim()) {
      parameters.cover_letter = coverLetter;
    }

    let webhookUrl: string | undefined;
    try {
      const url = new URL(req.url);
      if (url.hostname.endsWith(".functions.supabase.co")) {
        webhookUrl = `${url.origin}/skyvern-webhook`;
      } else {
        const base = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
        if (base) webhookUrl = `${base}/functions/v1/skyvern-webhook`;
      }
    } catch {
      // Use empty webhook fallback.
    }

    const skyvernRun: Record<string, unknown> = { workflow_id: workflowId, parameters };
    if (proxyLocation) skyvernRun.proxy_location = proxyLocation;
    if (webhookUrl) skyvernRun.webhook_url = webhookUrl;
    if (title) skyvernRun.title = title;

    const response = await withRetry(
      () =>
        fetch(SKYVERN_ENDPOINT, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify(skyvernRun),
        }),
      2,
      700,
    );

    const text = await response.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Skyvern run failed", status: response.status, data }),
        {
          status: 502,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    const runId = data?.run_id || data?.id;
    const applyUrl = jobUrls[0] || null;
    const nowIso = new Date().toISOString();

    if (runId) {
      const applicationPayload = {
        run_id: runId,
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
        provider_status: "pending",
        failure_reason: null,
        match_score: jobContext.match_score,
        match_reasons: jobContext.match_reasons,
        ai_confidence_score: jobContext.ai_confidence_score,
        user_review_notes: null,
      };

      const upgradeDraftApplication = async (): Promise<boolean> => {
        if (!jobContext.job_id) return false;
        const upgradePatch = {
          run_id: applicationPayload.run_id,
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
        }
      }

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
    }

    return new Response(
      JSON.stringify({
        ok: true,
        skyvern: data,
        submitted: { workflow_id: workflowId, count: jobUrls.length },
      }),
      {
        headers: { ...corsHeaders, "content-type": "application/json" },
        status: 200,
      },
    );
  } catch (error: unknown) {
    if (error instanceof SubscriptionAccessError) {
      return subscriptionErrorResponse(error, corsHeaders);
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("apply-to-jobs error", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
