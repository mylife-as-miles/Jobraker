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
const DEFAULT_RTRVR_TIMEOUT_MS = 300_000;

async function dispatchAutoApplyQueue(applicationId: string): Promise<{
  dispatched: boolean;
  status?: number;
  reason?: string;
}> {
  const baseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!baseUrl || !serviceRoleKey) {
    return { dispatched: false, reason: "queue_dispatch_configuration_missing" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${baseUrl}/functions/v1/process-auto-apply-queue`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ applicationId, source: "apply-to-jobs" }),
      signal: controller.signal,
    });
    return {
      dispatched: response.ok,
      status: response.status,
      reason: response.ok ? undefined : "queue_processor_rejected_request",
    };
  } catch (error) {
    return {
      dispatched: false,
      reason: error instanceof Error ? error.message : "queue_dispatch_failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

const APPLY_AUTOMATION_HINTS = `[JobRaker automation — prioritize these]
1) Cookie/consent: Dismiss any cookie banner, “Manage preferences”, or privacy overlay first (Accept, Accept all, Reject non-essential, Save & close, or Close/X) so the form and file inputs are not covered.
2) Resume required: Parameters include a resume file URL (resume). On iCIMS and similar ATS, use device upload (“My Computer”, “Upload”, “Choose file”) and attach that file; prefer PDF; wait until the upload succeeds and validation clears before Next/Continue.
3) Breezy forms: click “Upload Resume” (not Indeed/LinkedIn), attach the resume file from the resume URL, then wait for a visible filename/upload success state before submitting.
4) Avoid burning steps only on overlays; complete resume upload, then remaining required fields.`;

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

type BrowserExecutionPreference = "automatic" | "my_chrome" | "jobraker_cloud";

function normalizeBrowserExecutionPreference(value: unknown): BrowserExecutionPreference {
  return value === "my_chrome" || value === "jobraker_cloud" || value === "automatic"
    ? value
    : "automatic";
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
}

function parseRtrvrTimeoutMs(): number {
  const raw = Deno.env.get("RTRVR_TIMEOUT_MS");
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_RTRVR_TIMEOUT_MS;
}

function configuredRtrvrRecordingContextForUrl(rawUrl: string | null | undefined): string | null {
  const envRecordingContext = (name: string): string | null => {
    const value = Deno.env.get(name)?.trim();
    return value || null;
  };

  if (!rawUrl) return envRecordingContext("RTRVR_DEFAULT_APPLICATION_RECORDING_CONTEXT");

  try {
    const hostname = new URL(rawUrl).hostname.toLowerCase();
    if (hostname.includes("greenhouse.io") || hostname.includes("greenhouse")) {
      return envRecordingContext("RTRVR_GREENHOUSE_RECORDING_CONTEXT");
    }
    if (hostname.includes("lever.co")) {
      return envRecordingContext("RTRVR_LEVER_RECORDING_CONTEXT");
    }
    if (hostname.includes("ashbyhq.com") || hostname.includes("ashby")) {
      return envRecordingContext("RTRVR_ASHBY_RECORDING_CONTEXT");
    }
    if (hostname.includes("myworkdayjobs.com") || hostname.includes("workdayjobs.com")) {
      return envRecordingContext("RTRVR_WORKDAY_RECORDING_CONTEXT");
    }
    if (hostname.includes("icims.com")) {
      return envRecordingContext("RTRVR_ICIMS_RECORDING_CONTEXT");
    }
    return envRecordingContext("RTRVR_DEFAULT_APPLICATION_RECORDING_CONTEXT");
  } catch {
    return envRecordingContext("RTRVR_DEFAULT_APPLICATION_RECORDING_CONTEXT");
  }
}

function guessMimeTypeFromPath(value: string): string {
  const lower = value.toLowerCase().split("?")[0] || "";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".txt")) return "text/plain";
  return "application/octet-stream";
}

function requestedResumeIdFromBody(body: Record<string, unknown>): string | null {
  const value = body?.resume_id ?? body?.resumeId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function resolveStoredResumeForApplication(opts: {
  serviceClient: any;
  userId: string;
  requestedResumeId: string | null;
}): Promise<{
  id: string;
  name: string | null;
  filePath: string;
  signedUrl: string;
  data?: Record<string, unknown> | null;
} | null> {
  const { data: resumeRows, error } = await opts.serviceClient
    .from("resumes")
    .select("id,name,file_path,data,is_favorite,updated_at")
    .eq("user_id", opts.userId)
    .limit(25);

  if (error) {
    console.warn("apply-to-jobs: unable to read stored resumes", error.message);
    return null;
  }

  const available = (Array.isArray(resumeRows) ? resumeRows : []).filter(
    (resume) => typeof resume?.file_path === "string" && resume.file_path.trim(),
  );
  const selected = opts.requestedResumeId
    ? available.find((resume) => resume.id === opts.requestedResumeId) || null
    : [...available].sort((left, right) => {
        const favoriteDifference = Number(right?.is_favorite === true) - Number(left?.is_favorite === true);
        if (favoriteDifference !== 0) return favoriteDifference;
        return String(right?.updated_at || "").localeCompare(String(left?.updated_at || ""));
      })[0] || null;

  if (!selected?.file_path) return null;

  const { data: signed, error: signError } = await opts.serviceClient.storage
    .from("resumes")
    .createSignedUrl(selected.file_path, 60 * 60 * 48);
  if (signError || !signed?.signedUrl) {
    console.warn("apply-to-jobs: unable to sign stored resume", signError?.message);
    return null;
  }

  return {
    id: selected.id,
    name: typeof selected.name === "string" ? selected.name : null,
    filePath: selected.file_path,
    signedUrl: signed.signedUrl,
    data: selected.data && typeof selected.data === "object" ? selected.data : null,
  };
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 50);
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function buildAutoApplyIdempotencyKey(opts: {
  userId: string;
  applicationTarget: string;
  applicationVersion?: string | null;
}): Promise<string> {
  const version = opts.applicationVersion?.trim() || "v1";
  const digest = await sha256Hex(
    `${opts.userId}:${opts.applicationTarget.trim().toLowerCase()}:${version}`,
  );
  return `auto-apply:${opts.userId}:${digest.slice(0, 40)}`;
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

async function resumeUrlForRtrvr(
  resumeUrl: string,
  userId: string,
  serviceClient: any,
): Promise<{ signedUrl: string; fileName: string; mimeType: string; expiresAt: string } | null> {
  const parsed = parseSupabaseSignedObjectPath(resumeUrl);
  if (!parsed || parsed.bucket !== "resumes" || !parsed.path.startsWith(`${userId}/`)) {
    return {
      signedUrl: resumeUrl,
      fileName: "resume",
      mimeType: guessMimeTypeFromPath(resumeUrl),
      expiresAt: new Date(Date.now() + parseRtrvrTimeoutMs() + 5 * 60_000).toISOString(),
    };
  }

  const ttlSeconds = Math.max(
    600,
    Math.min(60 * 30, Math.ceil(parseRtrvrTimeoutMs() / 1000) + 300),
  );
  const { data, error } = await serviceClient.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, ttlSeconds);

  if (error || !data?.signedUrl) {
    console.warn("apply-to-jobs: rtrvr signed URL refresh failed", error?.message);
    return null;
  }

  const fileName = parsed.path.split("/").filter(Boolean).pop() || "resume";
  return {
    signedUrl: data.signedUrl,
    fileName,
    mimeType: guessMimeTypeFromPath(parsed.path),
    expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
  };
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
    
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\\s+/i, "").trim();
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const isSystemTrigger = token && serviceRoleKey && token === serviceRoleKey;

    let userId: string;
    let subscriptionTier: string;
    let serviceClient: any;
    let email = "";

    if (isSystemTrigger) {
      if (!body?.user_id) {
         return new Response(JSON.stringify({ error: "user_id required for system calls" }), {
           status: 400,
           headers: { ...corsHeaders, "content-type": "application/json" }
         });
      }
      userId = body.user_id;
      
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      serviceClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false } }
      );
      
      const { resolveSubscriptionTier } = await import("../_shared/subscription.ts");
      subscriptionTier = await resolveSubscriptionTier(userId, serviceClient);
      
      const { data: userProfile } = await serviceClient.from("profiles").select("email").eq("id", userId).maybeSingle();
      email = typeof body?.email === "string" && body.email.trim() ? body.email.trim() : (userProfile?.email || "");
    } else {
      const authCtx = await requireSubscriptionTier(req, "Free", "Auto apply");
      userId = authCtx.user.id;
      subscriptionTier = authCtx.subscriptionTier;
      serviceClient = authCtx.serviceClient;
      email = typeof body?.email === "string" && body.email.trim() ? body.email.trim() : (authCtx.user.email || "");
    }
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

    const { data: profileRow } = await serviceClient
      .from("profiles")
      .select(
        "first_name,last_name,job_title,location,phone,linkedin_url,github_url,browser_execution_preference,rtrvr_device_id,rtrvr_prefer_extension,auto_apply_auto_submit",
      )
      .eq("id", userId)
      .maybeSingle();

    const [
      { data: experienceRows },
      { data: educationRows },
      { data: skillRows },
      { data: answerRows },
    ] = await Promise.all([
      serviceClient
        .from("profile_experiences")
        .select("title,company,location,start_date,end_date,is_current,description")
        .eq("user_id", userId)
        .order("start_date", { ascending: false })
        .limit(10),
      serviceClient
        .from("profile_education")
        .select("degree,school,location,start_date,end_date,gpa")
        .eq("user_id", userId)
        .order("start_date", { ascending: false })
        .limit(8),
      serviceClient
        .from("profile_skills")
        .select("name,level,category")
        .eq("user_id", userId)
        .order("name")
        .limit(80),
      serviceClient
        .from("answer_bank")
        .select("theme,question,tags,body")
        .eq("user_id", userId)
        .limit(50),
    ]);

    const requestedBrowserPreference = normalizeBrowserExecutionPreference(
      body?.browser_execution_preference ??
        body?.browserExecutionPreference ??
        profileRow?.browser_execution_preference,
    );
    const selectedRtrvrDeviceId =
      typeof body?.rtrvr_device_id === "string" && body.rtrvr_device_id.trim()
        ? body.rtrvr_device_id.trim()
        : typeof profileRow?.rtrvr_device_id === "string"
          ? profileRow.rtrvr_device_id
          : null;
    const preferRtrvrExtension = parseBoolean(
      body?.rtrvr_prefer_extension ?? body?.preferExtension,
      profileRow?.rtrvr_prefer_extension !== false,
    );
    const autoSubmit = parseBoolean(
      body?.auto_submit ?? body?.autoSubmit,
      Boolean(profileRow?.auto_apply_auto_submit),
    );

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

    const requestedResumeId = requestedResumeIdFromBody(body);
    let resumeUrlFromRequest =
      typeof body?.resume === "string" ? normalizeHttpUrlString(body.resume) : "";
    let resolvedStoredResume: Awaited<ReturnType<typeof resolveStoredResumeForApplication>> = null;

    // Chat and API callers may provide only a resume id. Resolve it on the server so
    // the automation provider receives a fresh, user-owned upload URL rather than a
    // browser-local file path it cannot access.
    if (requestedResumeId || !resumeUrlFromRequest) {
      resolvedStoredResume = await resolveStoredResumeForApplication({
        serviceClient,
        userId,
        requestedResumeId,
      });
      if (!resolvedStoredResume) {
        const error = requestedResumeId
          ? "The selected resume is unavailable. Choose another uploaded resume and try again."
          : "An uploaded resume PDF is required before an application can be submitted.";
        return new Response(JSON.stringify({ error, code: "resume_required" }), {
          status: 422,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }
      resumeUrlFromRequest = resolvedStoredResume.signedUrl;
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

    const rtrvrApiKey = (
      Deno.env.get("RTRVR_API_KEY") ||
      Deno.env.get("FIRECRAWL_API_KEY") ||
      ""
    ).trim();
    const rtrvrEnabled = parseBoolean(Deno.env.get("RTRVR_ENABLED"), true);
    if (!rtrvrEnabled || !rtrvrApiKey) {
      console.warn("[apply-to-jobs] RTRVR not configured:", {
        rtrvrEnabled,
        hasRtrvrApiKey: Boolean(Deno.env.get("RTRVR_API_KEY")?.trim()),
        hasFirecrawlApiKey: Boolean(Deno.env.get("FIRECRAWL_API_KEY")?.trim()),
      });
      return new Response(
        JSON.stringify({
          error: "Application automation is temporarily unavailable. RTRVR is not configured.",
          code: "rtrvr_not_configured",
          details: {
            rtrvr_enabled: rtrvrEnabled,
            has_api_key: Boolean(rtrvrApiKey),
          },
        }),
        { status: 503, headers: { ...corsHeaders, "content-type": "application/json" } },
      );
    }

    const applicationTarget = String(jobContext.job_id || jobUrls[0] || "").trim();
    const applicationVersion =
      typeof body?.application_version === "string"
        ? body.application_version
        : typeof jobContext.evaluation_id === "string"
          ? jobContext.evaluation_id
          : null;
    const automationIdempotencyKey = await buildAutoApplyIdempotencyKey({
      userId,
      applicationTarget,
      applicationVersion,
    });

    const { data: existingAutomation } = await serviceClient
      .from("applications")
      .select(
        "id, status, canonical_stage, provider_status, run_id, automation_provider, automation_selected_mode, automation_fallback_applied, automation_fallback_reason, updated_at",
      )
      .eq("user_id", userId)
      .eq("automation_idempotency_key", automationIdempotencyKey)
      .maybeSingle();

    if (
      existingAutomation &&
      !["Failed", "Terminated"].includes(String(existingAutomation.status || "")) &&
      !["failed", "terminated", "cancelled", "canceled"].includes(
        String(existingAutomation.provider_status || "").toLowerCase(),
      )
    ) {
      return new Response(
        JSON.stringify({
          ok: true,
          enqueued: true,
          existing_run: true,
          application: existingAutomation,
          automation: {
            provider: existingAutomation.automation_provider || "rtrvr",
            status: existingAutomation.provider_status || "waiting",
            run_id: existingAutomation.run_id || null,
            selected_mode: existingAutomation.automation_selected_mode || null,
            fallback_applied: existingAutomation.automation_fallback_applied === true,
            fallback_reason: existingAutomation.automation_fallback_reason || null,
          },
          provider: {
            name: existingAutomation.automation_provider || "rtrvr",
            status: existingAutomation.provider_status || "waiting",
          },
          submitted: { provider: "rtrvr", count: jobUrls.length },
        }),
        {
          headers: { ...corsHeaders, "content-type": "application/json" },
          status: 200,
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
        "Reserved credits for run. Net billing occurs when the automation provider completes execution.",
    };

    let additionalInformation =
      typeof body?.additional_information === "string"
        ? body.additional_information
        : "";
    const providedResume = resumeUrlFromRequest;
    let rtrvrResumeFile: {
      signedUrl: string;
      fileName: string;
      mimeType: string;
      expiresAt: string;
    } | null = null;
    const resumeText = typeof body?.resume_text === "string" ? body.resume_text : "";
    if (
      providedResume &&
      (providedResume.startsWith("http://") || providedResume.startsWith("https://"))
    ) {
      try {
        rtrvrResumeFile = await resumeUrlForRtrvr(
          providedResume,
          userId,
          serviceClient,
        );
      } catch (error: any) {
        console.warn("apply-to-jobs: resumeUrlForRtrvr", error?.message);
      }
    }
    const coverLetter =
      typeof body?.cover_letter === "string" ? body.cover_letter : "";
    const title = typeof body?.title === "string" ? body.title : undefined;

    const { data: candidateProfileRow } = await serviceClient
      .from("candidate_profiles")
      .select("full_name")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    const profileFirstAndLastName =
      [
        typeof profileRow?.first_name === "string" ? profileRow.first_name : userInput.first_name,
        typeof profileRow?.last_name === "string" ? profileRow.last_name : userInput.last_name,
      ]
        .filter(Boolean)
        .join(" ")
    const resumeBasics =
      (resolvedStoredResume?.data as any)?.basics ||
      (body?.resume_data as any)?.basics ||
      (body?.resume_basics as any) ||
      null;

    const candidateFullName =
      (typeof resumeBasics?.name === "string" && resumeBasics.name.trim()) ||
      (typeof userInput.full_name === "string" && userInput.full_name.trim()) ||
      (typeof candidateProfileRow?.full_name === "string" && candidateProfileRow.full_name.trim()) ||
      (typeof user?.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()) ||
      profileFirstAndLastName ||
      null;

    const candidatePhone =
      (typeof resumeBasics?.phone === "string" && resumeBasics.phone.trim()) ||
      (typeof userInput.phone === "string" && userInput.phone.trim()) ||
      (typeof profileRow?.phone === "string" && profileRow.phone.trim()) ||
      null;

    const candidateEmail =
      (typeof resumeBasics?.email === "string" && resumeBasics.email.trim()) ||
      email;

    const candidateLocation =
      (typeof resumeBasics?.location === "string" && resumeBasics.location.trim()) ||
      (typeof profileRow?.location === "string" && profileRow.location.trim()) ||
      (typeof userInput.location === "string" && userInput.location.trim()) ||
      null;

    const candidateHeadline =
      (typeof resumeBasics?.headline === "string" && resumeBasics.headline.trim()) ||
      (typeof profileRow?.job_title === "string" && profileRow.job_title.trim()) ||
      (typeof userInput.job_title === "string" && userInput.job_title.trim()) ||
      null;

    const safeUserInput = {
      ...userInput,
      id: userId,
      ...(candidateEmail ? { email: candidateEmail } : {}),
      ...(candidateFullName ? { full_name: candidateFullName } : {}),
      ...(candidatePhone ? { phone: candidatePhone } : {}),
      ...(resolvedStoredResume
        ? { resume_id: resolvedStoredResume.id, resume_name: resolvedStoredResume.name }
        : {}),
      ...(Object.keys(sourceCredentials).length > 0
        ? { source_credentials: sourceCredentials }
        : {}),
    };
    const portfolioLinks = [
      typeof profileRow?.linkedin_url === "string" ? profileRow.linkedin_url : null,
      typeof profileRow?.github_url === "string" ? profileRow.github_url : null,
      ...(Array.isArray(userInput.portfolio_links) ? userInput.portfolio_links : []),
    ]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .slice(0, 10);
    const candidateProfile = {
      fullName: candidateFullName,
      email: candidateEmail,
      phone: candidatePhone,
      location: candidateLocation,
      headline: candidateHeadline,
      portfolioLinks,
      employmentHistory: Array.isArray(experienceRows) ? experienceRows : [],
      education: Array.isArray(educationRows) ? educationRows : [],
      skills: Array.isArray(skillRows)
        ? skillRows
            .map((row: any) => row?.name)
            .filter((name: unknown): name is string => typeof name === "string" && name.trim().length > 0)
        : cleanStringArray(userInput.skills),
      workAuthorization:
        userInput.work_authorization && typeof userInput.work_authorization === "object"
          ? userInput.work_authorization
          : null,
      savedScreeningAnswers: Array.isArray(answerRows) ? answerRows : [],
    };

    if (!additionalInformation && safeUserInput && typeof safeUserInput === "object") {
      const parts: string[] = [];
      const fullName = (typeof safeUserInput.full_name === "string" && safeUserInput.full_name.trim()) || [safeUserInput.first_name, safeUserInput.last_name]
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

    const applyUrl = jobUrls[0] || null;
    const rtrvrRecordingContext = configuredRtrvrRecordingContextForUrl(applyUrl);
    const nowIso = new Date().toISOString();
    const applicationId = crypto.randomUUID();
    const rtrvrWebhookBase =
      (Deno.env.get("RTRVR_WEBHOOK_URL") || Deno.env.get("AUTOMATION_WORKER_PUBLIC_URL") || "")
        .replace(/\/$/, "");
    const rtrvrWebhookUrl = rtrvrWebhookBase
      ? `${rtrvrWebhookBase.endsWith("/webhooks/rtrvr") ? rtrvrWebhookBase : `${rtrvrWebhookBase}/webhooks/rtrvr`}`
      : null;
    const rtrvrStartInput = {
      applicationId,
      agentRunId,
      userId,
      applicationUrl: applyUrl || "",
      idempotencyKey: automationIdempotencyKey,
      attemptNumber: 1,
      job: {
        title: jobContext.job_title,
        company: jobContext.company,
        location: jobContext.location,
        salary: jobContext.salary,
        matchScore: jobContext.match_score,
        matchReasons: jobContext.match_reasons,
      },
      candidate: candidateProfile,
      resume: rtrvrResumeFile
        ? {
            signedUrl: rtrvrResumeFile.signedUrl,
            fileName: rtrvrResumeFile.fileName,
            mimeType: rtrvrResumeFile.mimeType,
            text: resumeText || null,
            expiresAt: rtrvrResumeFile.expiresAt,
          }
        : resumeText
          ? { text: resumeText }
          : null,
      coverLetter,
      autoSubmit,
      browserPreference: requestedBrowserPreference,
      preferExtension: preferRtrvrExtension,
      selectedDeviceId: selectedRtrvrDeviceId,
      rtrvrWebhookUrl,
      rtrvrWebhookSecret: Deno.env.get("RTRVR_WEBHOOK_SECRET") || null,
      metadata: {
        source: "apply-to-jobs",
        jobId: jobContext.job_id,
        evaluationId: jobContext.evaluation_id,
        rtrvrRecordingContext,
      },
    };
    const queueParameters = {
      provider: "rtrvr",
      rtrvr: rtrvrStartInput,
    };

    const data = {
      provider: "rtrvr",
      status: "waiting",
      run_id: null,
      requested_mode: requestedBrowserPreference,
      selected_mode: null,
      fallback_applied: false,
    };

    const applicationPayload = {
      id: applicationId,
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
      workflow_id: null,
      app_url: applyUrl,
      automation_provider: "rtrvr",
      automation_idempotency_key: automationIdempotencyKey,
      automation_requested_mode: requestedBrowserPreference,
      automation_selected_mode: null,
      automation_fallback_applied: false,
      automation_fallback_reason: null,
      automation_device_id: selectedRtrvrDeviceId,
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
        automation_provider: applicationPayload.automation_provider,
        automation_idempotency_key: applicationPayload.automation_idempotency_key,
        automation_requested_mode: applicationPayload.automation_requested_mode,
        automation_selected_mode: applicationPayload.automation_selected_mode,
        automation_fallback_applied: applicationPayload.automation_fallback_applied,
        automation_fallback_reason: applicationPayload.automation_fallback_reason,
        automation_device_id: applicationPayload.automation_device_id,
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

    // Dispatch directly so a healthy request does not depend solely on pg_net
    // trigger/cron delivery. The durable waiting row remains the source of truth,
    // and the trigger plus cron still provide retry coverage if this call fails.
    const queueDispatch = await dispatchAutoApplyQueue(applicationId);
    if (!queueDispatch.dispatched) {
      console.warn("apply-to-jobs: direct queue dispatch deferred", {
        applicationId,
        status: queueDispatch.status ?? null,
        reason: queueDispatch.reason ?? "unknown",
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        enqueued: true,
        automation: data,
        provider: data,
        queue_dispatch: queueDispatch,
        billing: billingForResponse,
        concurrency: {
          base_limit: concurrencyResult.baseLimit,
          boost_limit: concurrencyResult.addonLimit,
          total_limit: concurrencyResult.totalLimit,
          active_runs: concurrencyResult.activeRuns,
          available_runs: concurrencyResult.availableRuns,
          period_end: concurrencyResult.periodEnd,
        },
        submitted: { provider: "rtrvr", count: jobUrls.length },
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
