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

const SKYVERN_ENDPOINT = "https://api.skyvern.com/v1/run/workflows";

/** Match `backend/supabase/functions/apply-to-jobs` — Skyvern defaults to 50 steps without this header. */
const DEFAULT_MAX_STEPS_OVERRIDE = 200;
const MAX_MAX_STEPS_OVERRIDE = 500;

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

/** Strip accidental JSON/Jinja quotes so Skyvern's fetcher gets a real URL. */
function normalizeHttpUrlString(raw: string): string {
  let s = raw.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/**
 * Parse bucket + object path from a Supabase Storage signed URL
 * (/storage/v1/object/sign/{bucket}/{path...}).
 */
function parseSupabaseSignedObjectPath(urlStr: string): { bucket: string; path: string } | null {
  try {
    const u = new URL(urlStr);
    const m = u.pathname.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/);
    if (!m) return null;
    return { bucket: m[1], path: m[2] };
  } catch {
    return null;
  }
}

/**
 * Mint a fresh long-lived signed URL server-side so Skyvern can download the PDF
 * after queue delays (client URLs often expire in 1h).
 */
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
  const ttlSec = 60 * 60 * 48; // 48h
  const { data, error } = await serviceClient.storage
    .from(bucket)
    .createSignedUrl(path, ttlSec);
  if (error || !data?.signedUrl) {
    console.warn("apply-to-jobs: refresh signed URL failed", error?.message);
    return resumeUrl;
  }
  return data.signedUrl;
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

    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count } = await serviceClient
      .from("applications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", oneMinuteAgo);

    if (count && count >= 5) {
      return new Response(
        JSON.stringify({
          error:
            "Rate limit exceeded. Please wait a moment before heavily automating applications.",
        }),
        {
          status: 429,
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
    let resume = typeof body?.resume === "string" ? normalizeHttpUrlString(body.resume) : "";
    const resumeText = typeof body?.resume_text === "string" ? body.resume_text : "";
    if (
      resume &&
      (resume.startsWith("http://") || resume.startsWith("https://"))
    ) {
      try {
        resume = await refreshResumeSignedUrlIfPossible(resume, userId, serviceClient);
      } catch (e: any) {
        console.warn("apply-to-jobs: refreshResumeSignedUrlIfPossible", e?.message);
      }
      try {
        resume = await resumeUrlForSkyvern(resume, userId);
      } catch (e: any) {
        console.warn("apply-to-jobs: resumeUrlForSkyvern", e?.message);
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

    // `resume` = signed PDF URL for the workflow's pdf_parser block.
    // `resume_text` = plain text for form-filling when the user edited/tailored
    //  the resume via AI (no PDF exists for the tailored version).
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
      const base = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
      const webhookSecret = Deno.env.get("SKYVERN_WEBHOOK_SECRET") ||
        Deno.env.get("SKYVERN_API_KEY") || "";
      if (base) {
        webhookUrl = `${base}/functions/v1/skyvern-webhook` +
          (webhookSecret ? `?token=${encodeURIComponent(webhookSecret)}` : "");
      }
    } catch {
      // Use empty webhook fallback.
    }

    const skyvernRun: Record<string, unknown> = { workflow_id: workflowId, parameters };
    if (proxyLocation) skyvernRun.proxy_location = proxyLocation;
    if (webhookUrl) skyvernRun.webhook_url = webhookUrl;
    if (title) skyvernRun.title = title;

    const maxSteps = resolveMaxStepsOverride(body as Record<string, unknown>);
    const response = await withRetry(
      () =>
        fetch(SKYVERN_ENDPOINT, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "x-max-steps-override": String(maxSteps),
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
      const skyvernMessage =
        data?.detail || data?.message || data?.error || data?.raw || "";
      const reason =
        response.status === 401 || response.status === 403
          ? "Skyvern API key is invalid or expired. Check SKYVERN_API_KEY in project secrets."
          : response.status === 404
            ? "Skyvern workflow not found. Check SKYVERN_WORKFLOW_ID."
            : response.status === 422
              ? `Skyvern rejected the request: ${skyvernMessage}`
              : response.status === 429
                ? "Skyvern rate limit exceeded. Try again in a minute."
                : `Skyvern returned ${response.status}: ${skyvernMessage}`;

      console.error("apply-to-jobs skyvern error", {
        status: response.status,
        reason,
        data,
        workflowId,
        jobUrls,
      });

      return new Response(
        JSON.stringify({ error: reason, skyvern_status: response.status, data }),
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

      const { error: applicationError } = await serviceClient
        .from("applications")
        .insert(applicationPayload);

      if (applicationError) {
        console.error("Failed to create queued application record", applicationError);
      }

      if (jobContext.job_id) {
        const { error: jobUpdateError } = await serviceClient
          .from("jobs")
          .update({
            canonical_status: "queued",
            updated_at: nowIso,
          })
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
