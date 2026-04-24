
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createGeminiClient,
  GEMINI_MODEL,
  withGeminiRetry,
  isGeminiRateLimitError,
} from "../_shared/gemini.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { fetchUserContext, formatUserContextForPrompt } from "../_shared/user-context.ts";
import { APP_INTERFACE_GUIDE } from "../_shared/app-map.ts";
import { APP_PAGES, resolveAppPage } from "../_shared/app-pages.ts";
import {
  EDGE_FUNCTIONS,
  getEdgeFunctionDefinition,
} from "../_shared/edge-function-registry.ts";
import {
  normalizeSubscriptionTier,
  requireSubscriptionTier,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";
import {
  agentSearchJobRelatedEmails,
  agentSendJobRelatedEmail,
} from "../_shared/gmail-job-agent-tools.ts";

console.log("JobRaker AI Chat Starting...");

const MAX_CHAT_IMAGES = 3;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const DEFAULT_APPLICATION_SYNC_LIMIT = 5;
const MAX_APPLICATION_SYNC_LIMIT = 12;
const DEFAULT_APPLICATION_LIST_LIMIT = 12;
const MAX_APPLICATION_LIST_LIMIT = 25;
const SKYVERN_TERMINAL_PROVIDER_STATUSES = new Set([
  "succeeded",
  "completed",
  "failed",
  "error",
  "cancelled",
  "canceled",
  "timed_out",
  "terminated",
]);
const ACTIVE_APPLICATION_STATUSES = new Set(["Pending", "Applied", "Interview"]);

type SupabaseLikeClient = ReturnType<typeof createClient>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function clampNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = asNumber(value);
  if (parsed == null) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function buildProfileSnapshot(profile: Record<string, unknown> | null): string {
  if (!profile) return "";
  const lines: string[] = [];
  const fullName = [asString(profile.first_name), asString(profile.last_name)]
    .filter(Boolean)
    .join(" ");
  if (fullName) lines.push(`Name: ${fullName}`);
  const jobTitle = asString(profile.job_title);
  if (jobTitle) lines.push(`Current title: ${jobTitle}`);
  const location = asString(profile.location);
  if (location) lines.push(`Location: ${location}`);
  const years = asNumber(profile.experience_years);
  if (years != null) lines.push(`Experience years: ${years}`);
  const goals = Array.isArray(profile.goals)
    ? profile.goals.filter((goal): goal is string => typeof goal === "string" && goal.trim().length > 0)
    : [];
  if (goals.length > 0) lines.push(`Goals: ${goals.join(", ")}`);
  const phone = asString(profile.phone);
  if (phone) lines.push(`Phone: ${phone}`);
  return lines.join("\n");
}

async function resolveAutoApplyArtifacts(
  serviceClient: SupabaseLikeClient,
  userId: string,
) {
  const { data: profileRow } = await serviceClient
    .from("profiles")
    .select("first_name, last_name, job_title, experience_years, location, goals, phone")
    .eq("id", userId)
    .maybeSingle();

  const { data: resumeRows } = await serviceClient
    .from("resumes")
    .select("id, name, file_path, file_ext, is_favorite, updated_at")
    .eq("user_id", userId)
    .order("is_favorite", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(5);

  const preferredResume =
    Array.isArray(resumeRows) && resumeRows.length > 0 ? resumeRows[0] : null;

  let resumeUrl = "";
  if (preferredResume?.file_path) {
    try {
      const { data } = await serviceClient.storage
        .from("resumes")
        .createSignedUrl(preferredResume.file_path, 60 * 60 * 48);
      resumeUrl = data?.signedUrl || "";
    } catch (error) {
      console.warn("ai-chat.resolveAutoApplyArtifacts.resumeSignedUrl", error);
    }
  }

  let resumeText = "";
  if (preferredResume?.id) {
    const { data: parsedResume } = await serviceClient
      .from("parsed_resumes")
      .select("raw_text")
      .eq("user_id", userId)
      .eq("resume_id", preferredResume.id)
      .order("extracted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    resumeText = asString(parsedResume?.raw_text) || "";
  }

  if (!resumeText) {
    const { data: parsedResume } = await serviceClient
      .from("parsed_resumes")
      .select("raw_text")
      .eq("user_id", userId)
      .order("extracted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    resumeText = asString(parsedResume?.raw_text) || "";
  }

  const userInput = isRecord(profileRow) ? profileRow : {};

  return {
    profileRow: isRecord(profileRow) ? profileRow : null,
    profileSnapshot: buildProfileSnapshot(isRecord(profileRow) ? profileRow : null),
    userInput,
    preferredResume,
    resumeUrl,
    resumeText,
  };
}

const RESUME_STATUSES = new Set(["Active", "Draft", "Archived"]);

function normalizeResumeExperienceItem(
  raw: Record<string, unknown>,
  fallbackId: string,
): Record<string, unknown> {
  const id = asString(raw.id) || fallbackId;
  const company = asString(raw.company) || "";
  const position = asString(raw.position) || asString(raw.title) || "";
  const period = asString(raw.period) || asString(raw.date) || "";
  const description = asString(raw.description) || asString(raw.summary) || "";
  return {
    id,
    hidden: raw.hidden === true,
    company,
    position,
    location: asString(raw.location) || "",
    period: period || "",
    date: asString(raw.date) || period || "",
    summary: asString(raw.summary) || description,
    description,
    website: isRecord(raw.website) ? raw.website : { url: "", label: "" },
    columns: typeof raw.columns === "number" && Number.isFinite(raw.columns) ? raw.columns : 1,
  };
}

/**
 * Direct DB update for the resume builder JSON. Used by the agent (no update-resume edge function).
 */
async function runUpdateResumeTool(
  sb: SupabaseLikeClient,
  userId: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const resumeId = asString(args.resume_id);
  const updateAll = args.update_all === true;

  let query = sb
    .from("resumes")
    .select("id, name, data, user_id, status")
    .eq("user_id", userId);
  if (resumeId) {
    query = query.eq("id", resumeId);
  } else {
    query = query.order("updated_at", { ascending: false });
  }
  const { data: rows, error: listErr } = await query;
  if (listErr) {
    return { success: false, error: listErr.message };
  }
  let resumes = (rows || []) as Array<{
    id: string;
    name: string;
    data: unknown;
    status?: string;
  }>;
  if (!updateAll && !resumeId && resumes.length > 1) {
    resumes = [resumes[0]];
  }
  if (resumes.length === 0) {
    return { success: false, error: "No resumes found" };
  }

  const setExperience = Array.isArray(args.set_experience_items)
    ? (args.set_experience_items as unknown[]).filter((x) => isRecord(x))
    : null;
  const displayName = asString(args.display_name);
  const fullName = asString(args.full_name);
  const headline = asString(args.headline);
  const email = asString(args.email);
  const phone = asString(args.phone);
  const location = asString(args.location);
  const summary = asString(args.summary);
  const statusIn = asString(args.resume_status);
  const newStatus = statusIn && RESUME_STATUSES.has(statusIn) ? statusIn : null;

  const results: string[] = [];
  for (const resume of resumes) {
    const currentData = (resume.data && typeof resume.data === "object" ? resume.data : {}) as Record<
      string,
      unknown
    >;
    const basics = { ...((isRecord(currentData.basics) ? currentData.basics : {}) as Record<string, unknown>) };
    const sum = { ...((isRecord(currentData.summary) ? currentData.summary : {}) as Record<string, unknown>) };
    const changed: string[] = [];

    if (fullName) {
      basics.name = fullName;
      changed.push("name");
    }
    if (headline) {
      basics.headline = headline;
      changed.push("headline");
    }
    if (email) {
      basics.email = email;
      changed.push("email");
    }
    if (phone) {
      basics.phone = phone;
      changed.push("phone");
    }
    if (location) {
      basics.location = location;
      changed.push("location");
    }
    if (summary) {
      sum.content = summary;
      sum.hidden = false;
      changed.push("summary");
    }

    const sections = isRecord(currentData.sections) ? { ...currentData.sections } : {};
    if (setExperience && setExperience.length > 0) {
      const existingExp = isRecord(sections.experience) ? (sections.experience as Record<string, unknown>) : {};
      const items = setExperience.map((row) =>
        normalizeResumeExperienceItem(row as Record<string, unknown>, crypto.randomUUID()),
      );
      sections.experience = { ...existingExp, items, hidden: false };
      changed.push("experience");
    }

    const newData: Record<string, unknown> = {
      ...currentData,
      basics,
      summary: sum,
    };
    if (setExperience && setExperience.length > 0) {
      newData.sections = sections;
    } else {
      newData.sections = currentData.sections;
    }

    const patch: Record<string, unknown> = {
      data: newData,
      updated_at: new Date().toISOString(),
    };
    if (displayName) {
      patch.name = displayName;
      changed.push("display name");
    }
    if (newStatus) {
      patch.status = newStatus;
      changed.push("status");
    }

    if (changed.length === 0) {
      continue;
    }

    const { error: updateErr } = await sb.from("resumes").update(patch).eq("id", resume.id);
    if (updateErr) {
      results.push(`Failed to update "${resume.name}": ${updateErr.message}`);
    } else {
      results.push(`Updated "${resume.name}" (${changed.join(", ")})`);
    }
  }
  if (results.length === 0) {
    return {
      success: false,
      error:
        "No changes applied. Provide at least one of: display_name, full_name, headline, email, phone, location, summary, set_experience_items, resume_status.",
    };
  }
  return { success: true, results, updated_count: results.length };
}

function sanitizeForwardHeaders(raw: unknown): Record<string, string> {
  if (!isRecord(raw)) return {};
  const forbidden = new Set([
    "authorization",
    "apikey",
    "content-length",
    "host",
    "origin",
  ]);
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== "string") continue;
    const lower = key.toLowerCase();
    if (forbidden.has(lower)) continue;
    headers[key] = value;
  }
  return headers;
}

async function invokeEdgeFunctionByName(opts: {
  authHeader: string;
  name: string;
  payload?: unknown;
  method?: string | null;
  headers?: unknown;
}) {
  const baseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  if (!baseUrl) {
    return {
      success: false,
      error: "SUPABASE_URL is not configured.",
    };
  }

  const name = opts.name.trim();
  if (!name) {
    return { success: false, error: "Function name is required." };
  }
  if (name === "ai-chat") {
    return {
      success: false,
      error: "ai-chat cannot be invoked from inside the ai-chat agent loop.",
    };
  }

  const method = (opts.method || "POST").toUpperCase();
  let url = `${baseUrl}/functions/v1/${name}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: opts.authHeader,
    ...sanitizeForwardHeaders(opts.headers),
  };
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (anonKey) {
    headers.apikey = headers.apikey || anonKey;
  }

  let body: string | undefined;
  if (method === "GET" && isRecord(opts.payload)) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(opts.payload)) {
      if (value == null) continue;
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        params.set(key, String(value));
      }
    }
    const query = params.toString();
    if (query) url = `${url}?${query}`;
  } else if (opts.payload !== undefined) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    body = JSON.stringify(opts.payload);
  }

  const response = await fetch(url, {
    method,
    headers,
    ...(body !== undefined ? { body } : {}),
  });

  const rawText = await response.text();
  let data: unknown = null;
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = rawText;
    }
  }

  return {
    success: response.ok,
    status: response.status,
    function: name,
    method,
    data,
  };
}

async function fetchApplicationProcessSnapshot(opts: {
  serviceClient: SupabaseLikeClient;
  userId: string;
  applicationId?: string | null;
  limit?: number;
  includeRecentEvents?: boolean;
}) {
  const limit = clampNumber(
    opts.limit,
    DEFAULT_APPLICATION_LIST_LIMIT,
    1,
    MAX_APPLICATION_LIST_LIMIT,
  );

  let query = opts.serviceClient
    .from("applications")
    .select(
      "id, job_id, job_title, company, location, status, canonical_stage, applied_date, updated_at, next_step, interview_date, provider_status, run_id, workflow_id, failure_reason, app_url, receipt_url, success_url, draft_status, ai_confidence_score, user_review_notes",
    )
    .eq("user_id", opts.userId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (opts.applicationId) {
    query = query.eq("id", opts.applicationId);
  }

  const { data: applications, error: applicationsError } = await query;
  if (applicationsError) {
    return {
      success: false,
      error: applicationsError.message,
      applications: [],
    };
  }

  const rows = Array.isArray(applications) ? applications : [];
  const applicationIds = rows
    .map((row) => asString((row as Record<string, unknown>).id))
    .filter((value): value is string => Boolean(value));

  let recentEventsByApplication: Record<string, Record<string, unknown>[]> = {};
  if (opts.includeRecentEvents !== false && applicationIds.length > 0) {
    const { data: events } = await opts.serviceClient
      .from("gmail_application_events")
      .select(
        "application_id, event_type, status, confidence, company, job_title, subject, received_at, processed_at",
      )
      .eq("user_id", opts.userId)
      .in("application_id", applicationIds)
      .order("received_at", { ascending: false })
      .limit(applicationIds.length * 5);

    for (const event of Array.isArray(events) ? events : []) {
      const applicationId = asString((event as Record<string, unknown>).application_id);
      if (!applicationId) continue;
      if (!recentEventsByApplication[applicationId]) {
        recentEventsByApplication[applicationId] = [];
      }
      if (recentEventsByApplication[applicationId].length < 3) {
        recentEventsByApplication[applicationId].push(event as Record<string, unknown>);
      }
    }
  }

  const summary = {
    total: rows.length,
    by_status: {} as Record<string, number>,
    by_canonical_stage: {} as Record<string, number>,
    active_count: 0,
    failed_count: 0,
    upcoming_interviews: 0,
  };

  const hydrated = rows.map((row) => {
    const record = row as Record<string, unknown>;
    const status = asString(record.status) || "Pending";
    const canonicalStage = asString(record.canonical_stage) || "queued";
    const applicationId = asString(record.id) || "";
    const interviewDate = asString(record.interview_date);

    summary.by_status[status] = (summary.by_status[status] || 0) + 1;
    summary.by_canonical_stage[canonicalStage] =
      (summary.by_canonical_stage[canonicalStage] || 0) + 1;
    if (ACTIVE_APPLICATION_STATUSES.has(status)) summary.active_count += 1;
    if (canonicalStage === "failed" || canonicalStage === "terminated") {
      summary.failed_count += 1;
    }
    if (interviewDate) {
      const interviewAt = Date.parse(interviewDate);
      if (!Number.isNaN(interviewAt) && interviewAt >= Date.now()) {
        summary.upcoming_interviews += 1;
      }
    }

    return {
      ...record,
      recent_events: recentEventsByApplication[applicationId] || [],
      needs_provider_refresh:
        Boolean(asString(record.run_id)) &&
        !SKYVERN_TERMINAL_PROVIDER_STATUSES.has(
          (asString(record.provider_status) || "").toLowerCase(),
        ),
    };
  });

  return {
    success: true,
    summary,
    applications: hydrated,
  };
}

async function refreshApplicationProcesses(opts: {
  authHeader: string;
  serviceClient: SupabaseLikeClient;
  userId: string;
  applicationId?: string | null;
  includeGmail?: boolean;
  includeSkyvern?: boolean;
  gmailMaxResults?: number;
  force?: boolean;
  limit?: number;
}) {
  const gmailEnabled = opts.includeGmail !== false;
  const skyvernEnabled = opts.includeSkyvern !== false;
  let gmailSync: Record<string, unknown> | null = null;

  if (gmailEnabled) {
    try {
      gmailSync = await invokeEdgeFunctionByName({
        authHeader: opts.authHeader,
        name: "sync-gmail-application-events",
        payload: {
          maxResults: clampNumber(opts.gmailMaxResults, 10, 1, 25),
          force: opts.force === true,
        },
      }) as Record<string, unknown>;
    } catch (error) {
      gmailSync = {
        success: false,
        error: error instanceof Error ? error.message : "Gmail sync failed",
      };
    }
  }

  const limit = clampNumber(
    opts.limit,
    DEFAULT_APPLICATION_SYNC_LIMIT,
    1,
    MAX_APPLICATION_SYNC_LIMIT,
  );

  let skyvernSync: Record<string, unknown> = {
    success: true,
    synced_runs: [],
  };

  if (skyvernEnabled) {
    let runQuery = opts.serviceClient
      .from("applications")
      .select("id, run_id, provider_status")
      .eq("user_id", opts.userId)
      .not("run_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (opts.applicationId) {
      runQuery = runQuery.eq("id", opts.applicationId);
    }

    const { data: runRows } = await runQuery;
    const syncedRuns: Record<string, unknown>[] = [];

    for (const row of Array.isArray(runRows) ? runRows : []) {
      const record = row as Record<string, unknown>;
      const runId = asString(record.run_id);
      const providerStatus = (asString(record.provider_status) || "").toLowerCase();
      if (!runId) continue;
      if (SKYVERN_TERMINAL_PROVIDER_STATUSES.has(providerStatus)) continue;
      try {
        const syncResult = await invokeEdgeFunctionByName({
          authHeader: opts.authHeader,
          name: "sync-skyvern-status",
          payload: { run_id: runId },
        });
        syncedRuns.push(syncResult as Record<string, unknown>);
      } catch (error) {
        syncedRuns.push({
          success: false,
          function: "sync-skyvern-status",
          run_id: runId,
          error: error instanceof Error ? error.message : "Skyvern sync failed",
        });
      }
    }

    skyvernSync = {
      success: true,
      synced_runs: syncedRuns,
    };
  }

  const snapshot = await fetchApplicationProcessSnapshot({
    serviceClient: opts.serviceClient,
    userId: opts.userId,
    applicationId: opts.applicationId,
    limit,
    includeRecentEvents: true,
  });

  return {
    success: true,
    gmail_sync: gmailSync,
    skyvern_sync: skyvernSync,
    snapshot,
  };
}

async function runAutoApplyFromUrl(opts: {
  authHeader: string;
  serviceClient: SupabaseLikeClient;
  userId: string;
  userEmail: string;
  url: string;
  coverLetter?: string | null;
  additionalInformation?: string | null;
  workflowId?: string | null;
  proxyLocation?: string | null;
  title?: string | null;
  maxStepsOverride?: number | null;
  reapply?: boolean;
}) {
  const url = asString(opts.url);
  if (!url) {
    return { success: false, error: "A valid job URL is required." };
  }

  const artifacts = await resolveAutoApplyArtifacts(opts.serviceClient, opts.userId);
  const intakeResult = await invokeEdgeFunctionByName({
    authHeader: opts.authHeader,
    name: "intake-job-url",
    payload: {
      url,
      profileSnapshot: artifacts.profileSnapshot,
      resumeText: artifacts.resumeText,
    },
  });

  if (!(intakeResult as Record<string, unknown>).success) {
    return {
      success: false,
      error: "Failed to intake the job URL before apply.",
      intake: intakeResult,
    };
  }

  const intakeData = isRecord((intakeResult as Record<string, unknown>).data)
    ? ((intakeResult as Record<string, unknown>).data as Record<string, unknown>)
    : {};
  const intakeJob = isRecord(intakeData.job) ? intakeData.job : {};
  const intakeEvaluation = isRecord(intakeData.evaluation)
    ? intakeData.evaluation
    : {};
  const jobId = asString(intakeJob.id);

  let existingApplications: Record<string, unknown>[] = [];
  let existingQuery = opts.serviceClient
    .from("applications")
    .select("id, job_title, company, status, canonical_stage, updated_at, app_url, run_id")
    .eq("user_id", opts.userId)
    .order("updated_at", { ascending: false })
    .limit(5);

  if (jobId) {
    existingQuery = existingQuery.eq("job_id", jobId);
  } else {
    existingQuery = existingQuery.eq("app_url", url);
  }

  const { data: existingRows } = await existingQuery;
  existingApplications = (Array.isArray(existingRows) ? existingRows : []) as Record<string, unknown>[];

  if (existingApplications.length > 0 && opts.reapply !== true) {
    return {
      success: false,
      requires_reapply: true,
      message:
        "An application already exists for this job. Set reapply=true or use reapply_job to start another automation run.",
      intake: intakeData,
      existing_applications: existingApplications,
    };
  }

  const applyResult = await invokeEdgeFunctionByName({
    authHeader: opts.authHeader,
    name: "apply-to-jobs",
    payload: {
      job_urls: [url],
      additional_information: asString(opts.additionalInformation) || undefined,
      resume: artifacts.resumeUrl || undefined,
      resume_text: artifacts.resumeText || undefined,
      cover_letter: asString(opts.coverLetter) || undefined,
      workflow_id: asString(opts.workflowId) || undefined,
      proxy_location: asString(opts.proxyLocation) || undefined,
      title: asString(opts.title) || undefined,
      max_steps_override:
        typeof opts.maxStepsOverride === "number" ? opts.maxStepsOverride : undefined,
      email: opts.userEmail || undefined,
      job_id: jobId,
      job_title: asString(intakeJob.title),
      company: asString(intakeJob.company),
      location: asString(intakeJob.location),
      match_reasons: Array.isArray(intakeEvaluation.matched_keywords)
        ? intakeEvaluation.matched_keywords
        : undefined,
      match_score: asNumber(intakeEvaluation.confidence_score),
      ai_confidence_score: asNumber(intakeEvaluation.confidence_score),
      evaluation_id: asString(intakeEvaluation.evaluation_id),
      user_input: artifacts.userInput,
    },
  });

  const applyData = isRecord((applyResult as Record<string, unknown>).data)
    ? ((applyResult as Record<string, unknown>).data as Record<string, unknown>)
    : {};
  const skyvern = isRecord(applyData.skyvern) ? applyData.skyvern : {};
  const runId = asString(skyvern.run_id) || asString(skyvern.id);

  let latestApplication: Record<string, unknown> | null = null;
  if (runId) {
    const { data } = await opts.serviceClient
      .from("applications")
      .select(
        "id, job_id, job_title, company, status, canonical_stage, updated_at, app_url, run_id, provider_status",
      )
      .eq("user_id", opts.userId)
      .eq("run_id", runId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    latestApplication = (data as Record<string, unknown> | null) || null;
  }

  return {
    success: (applyResult as Record<string, unknown>).success === true,
    intake: intakeData,
    apply: applyResult,
    latest_application: latestApplication,
    warnings: [
      !artifacts.resumeUrl && !artifacts.resumeText
        ? "No stored resume file or parsed resume text was found for the user."
        : null,
    ].filter(Boolean),
  };
}

async function runApplyToJobTool(opts: {
  authHeader: string;
  serviceClient: SupabaseLikeClient;
  userId: string;
  userEmail: string;
  args: Record<string, unknown>;
}) {
  const directUrl = asString(opts.args.url);
  if (directUrl) {
    return runAutoApplyFromUrl({
      authHeader: opts.authHeader,
      serviceClient: opts.serviceClient,
      userId: opts.userId,
      userEmail: opts.userEmail,
      url: directUrl,
      coverLetter: asString(opts.args.cover_letter),
      additionalInformation: asString(opts.args.additional_information),
      workflowId: asString(opts.args.workflow_id),
      proxyLocation: asString(opts.args.proxy_location),
      title: asString(opts.args.title),
      maxStepsOverride: asNumber(opts.args.max_steps_override),
      reapply: opts.args.reapply === true,
    });
  }

  const applicationId = asString(opts.args.application_id);
  if (applicationId) {
    const { data: application } = await opts.serviceClient
      .from("applications")
      .select("id, app_url, job_id, job_title, company")
      .eq("user_id", opts.userId)
      .eq("id", applicationId)
      .maybeSingle();
    let targetUrl = asString(application?.app_url);
    if (!targetUrl) {
      const linkedJobId = asString(application?.job_id);
      if (linkedJobId) {
        const { data: linkedJob } = await opts.serviceClient
          .from("jobs")
          .select("apply_url")
          .eq("user_id", opts.userId)
          .eq("id", linkedJobId)
          .maybeSingle();
        targetUrl = asString(linkedJob?.apply_url);
      }
    }
    if (!targetUrl) {
      return {
        success: false,
        error: "That application does not have a reusable application URL.",
      };
    }
    return runAutoApplyFromUrl({
      authHeader: opts.authHeader,
      serviceClient: opts.serviceClient,
      userId: opts.userId,
      userEmail: opts.userEmail,
      url: targetUrl,
      coverLetter: asString(opts.args.cover_letter),
      additionalInformation: asString(opts.args.additional_information),
      workflowId: asString(opts.args.workflow_id),
      proxyLocation: asString(opts.args.proxy_location),
      title: asString(opts.args.title) || asString(application?.job_title),
      maxStepsOverride: asNumber(opts.args.max_steps_override),
      reapply: true,
    });
  }

  const jobId = asString(opts.args.job_id);
  if (!jobId) {
    return {
      success: false,
      error: "Provide a job_id, application_id, or direct url.",
    };
  }

  const { data: job } = await opts.serviceClient
    .from("jobs")
    .select("id, title, company, apply_url")
    .eq("user_id", opts.userId)
    .eq("id", jobId)
    .maybeSingle();
  const targetUrl = asString(job?.apply_url);
  if (!targetUrl) {
    return {
      success: false,
      error: "That job does not have an apply_url.",
    };
  }

  return runAutoApplyFromUrl({
    authHeader: opts.authHeader,
    serviceClient: opts.serviceClient,
    userId: opts.userId,
    userEmail: opts.userEmail,
    url: targetUrl,
    coverLetter: asString(opts.args.cover_letter),
    additionalInformation: asString(opts.args.additional_information),
    workflowId: asString(opts.args.workflow_id),
    proxyLocation: asString(opts.args.proxy_location),
    title: asString(opts.args.title) || asString(job?.title),
    maxStepsOverride: asNumber(opts.args.max_steps_override),
    reapply: opts.args.reapply === true,
  });
}

function estimateBase64Bytes(b64: string): number {
  const clean = b64.replace(/\s/g, "");
  return Math.floor((clean.length * 3) / 4);
}

function normalizeChatImages(raw: unknown): { mimeType: string; data: string }[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: { mimeType: string; data: string }[] = [];
  for (const item of raw.slice(0, MAX_CHAT_IMAGES)) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const mimeType = typeof rec.mimeType === "string" ? rec.mimeType : "";
    const dataRaw = typeof rec.data === "string" ? rec.data : "";
    const data = dataRaw.replace(/\s/g, "");
    if (!mimeType.startsWith("image/") || !data) continue;
    if (estimateBase64Bytes(data) > MAX_IMAGE_BYTES) {
      throw new Error(`Each image must be under ${MAX_IMAGE_BYTES / (1024 * 1024)}MB`);
    }
    out.push({ mimeType, data });
  }
  return out.length ? out : undefined;
}

/** Extract incremental/cumulative text from a @google/genai stream chunk. */
function streamChunkText(chunk: unknown): string {
  const c = chunk as Record<string, unknown> | null;
  if (!c) return "";
  const textField = c.text;
  if (typeof textField === "function") {
    try {
      const v = (textField as () => unknown)();
      return typeof v === "string" ? v : "";
    } catch {
      return "";
    }
  }
  if (typeof textField === "string") return textField;
  const candidates = c.candidates as
    | Array<{ content?: { parts?: Array<{ text?: string }> } }>
    | undefined;
  const parts = candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    return parts.filter((p) => typeof p?.text === "string").map((p) => p.text!).join("");
  }
  return "";
}

/** Gemini multimodal user turn */
function buildGeminiUserParts(
  text: string,
  images?: { mimeType: string; data: string }[],
): Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> {
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
  for (const img of images || []) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
  }
  const trimmed = (text || "").trim();
  if (trimmed) {
    parts.push({ text: trimmed });
  } else if (parts.length > 0) {
    parts.push({
      text:
        "The user shared a screenshot or image. Describe what you see and help with their request (errors, UI, job postings, resume feedback, etc.).",
    });
  }
  return parts;
}

const ACCOUNT_ACCESS_RULES = `
You are inside the authenticated user's JobRaker workspace.
You DO have access to the user's JobRaker account data provided in this prompt and, in agent mode, through the available tools.
Do not claim that you lack access to the user's JobRaker profile, resumes, tracked jobs, applications, credits, cover letters, subscription period / renewal / days-to-renewal (when the "Subscription & billing" section is present), or recent conversations when that information is present in context or retrievable through tools.
Only describe limitations for external systems that are not connected here, such as LinkedIn dashboards, Indeed, or third-party job boards when Gmail is not connected.
If the user has connected Gmail in JobRaker Settings, job-related inbox tools may be available in agent mode (search/send guardrails still apply).
When the user asks for totals, counts, lists, or recent activity inside JobRaker, answer from the account context or tools first before giving generic advice.
`;

const createAuthedSupabaseClient = (authHeader: string) =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

const createServiceSupabaseClient = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

const AGENT_FUNCTION_DECLARATIONS = [
  {
    name: "get_account_snapshot",
    description:
      "Get a summary of the user's JobRaker account, including applications, jobs, resumes, credits, subscription tier, and when present subscription period end / days until next renewal (same source as the Billing page DB fields).",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "run_job_search",
    description: "Search for job listings based on a query and location.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Job search query, e.g. 'software engineer'" },
        location: { type: "string", description: "Location, e.g. 'Remote' or 'New York'" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_user_profile",
    description: "Get the user's career profile (skills, experience, headline).",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "list_applications",
    description: "List detailed application processes, including stages, next steps, provider status, and recent Gmail-linked events.",
    parameters: {
      type: "object",
      properties: {
        application_id: { type: "string" },
        limit: { type: "number" },
        include_recent_events: { type: "boolean" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "refresh_application_processes",
    description: "Refresh multi-stage application tracking by syncing Gmail application events and recent Skyvern provider runs, then return the updated application snapshot.",
    parameters: {
      type: "object",
      properties: {
        application_id: { type: "string" },
        limit: { type: "number" },
        include_gmail: { type: "boolean" },
        include_skyvern: { type: "boolean" },
        gmail_max_results: { type: "number" },
        force: { type: "boolean" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "list_resumes",
    description: "List all resumes uploaded by the user.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_credits_balance",
    description: "Check remaining AI credits.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "list_recent_jobs",
    description: "Get the latest discovered job listings.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Default 10" },
      },
    },
  },
  {
    name: "list_app_pages",
    description: "List every known page, settings tab, builder route, and admin route in the JobRaker app.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "open_app_page",
    description: "Navigate the app to a known page route or a concrete deep link. Use when the user asks to open or go to a page.",
    parameters: {
      type: "object",
      properties: {
        page_id: { type: "string", description: "A page id from list_app_pages, e.g. dashboard-application." },
        route: { type: "string", description: "An exact concrete route, e.g. /dashboard/jobs?autoApplyJobId=..." },
        query: { type: "string", description: "Natural-language page lookup, e.g. 'settings integrations'." },
      },
      additionalProperties: true,
    },
  },
  {
    name: "apply_to_job",
    description: "Start an application automation from a job_id, application_id, or direct URL.",
    parameters: {
      type: "object",
      properties: {
        job_id: { type: "string" },
        application_id: { type: "string" },
        url: { type: "string" },
        cover_letter: { type: "string" },
        additional_information: { type: "string" },
        workflow_id: { type: "string" },
        proxy_location: { type: "string" },
        title: { type: "string" },
        max_steps_override: { type: "number" },
        reapply: { type: "boolean" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "auto_apply_from_url",
    description: "Ingest a job from a raw URL and immediately start auto-apply from that URL using the user's stored resume/profile context.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string" },
        cover_letter: { type: "string" },
        additional_information: { type: "string" },
        workflow_id: { type: "string" },
        proxy_location: { type: "string" },
        title: { type: "string" },
        max_steps_override: { type: "number" },
        reapply: { type: "boolean" },
      },
      required: ["url"],
      additionalProperties: true,
    },
  },
  {
    name: "reapply_job",
    description: "Re-run application automation for an existing application or direct job URL.",
    parameters: {
      type: "object",
      properties: {
        application_id: { type: "string" },
        url: { type: "string" },
        cover_letter: { type: "string" },
        additional_information: { type: "string" },
        workflow_id: { type: "string" },
        proxy_location: { type: "string" },
        title: { type: "string" },
        max_steps_override: { type: "number" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "analyze_resume",
    description: "Analyze a resume for improvements.",
    parameters: { type: "object", properties: { target_role: { type: "string" } } },
  },
  {
    name: "generate_cover_letter",
    description: "Generate a tailored cover letter.",
    parameters: { type: "object", properties: { job_description: { type: "string" }, instructions: { type: "string" } }, required: ["job_description"] },
  },
  {
    name: "evaluate_job_fit",
    description: "Evaluate matching between user and a job.",
    parameters: { type: "object", properties: { job_description: { type: "string" } }, required: ["job_description"] },
  },
  {
    name: "intake_job_url",
    description: "Import a job from a URL.",
    parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
  },
  {
    name: "update_profile",
    description:
      "Update the signed-in user's career profile in the database: headline (job_title), name, about, location, goals, years of experience.",
    parameters: {
      type: "object",
      properties: {
        job_title: { type: "string", description: "Professional headline shown in settings / profile" },
        location: { type: "string" },
        about: { type: "string", description: "Professional summary / bio" },
        goals: { type: "string" },
        first_name: { type: "string" },
        last_name: { type: "string" },
        experience_years: { type: "number" },
      },
    },
  },
  {
    name: "add_skill",
    description: "Add or update a skill on the profile.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        level: { type: "string", description: "Beginner, Intermediate, Advanced, or Expert" },
        category: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "remove_skill",
    description: "Remove a profile skill by name (case-insensitive).",
    parameters: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
  },
  {
    name: "add_experience",
    description: "Add a work experience row to the profile (separate from resume builder JSON).",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        company: { type: "string" },
        location: { type: "string" },
        start_date: { type: "string", description: "YYYY-MM-DD" },
        end_date: { type: "string" },
        is_current: { type: "boolean" },
        description: { type: "string" },
      },
      required: ["title", "company", "start_date"],
    },
  },
  {
    name: "save_cover_letter",
    description: "Save a cover letter to the account.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        content: { type: "string" },
        role: { type: "string" },
        company: { type: "string" },
      },
      required: ["name", "content"],
    },
  },
  {
    name: "update_resume",
    description:
      "Update the resume document in the database (builder JSON in resumes.data). Can change name, headline, summary, contact, set status to Active/Draft/Archived, and replace the full Experience section via set_experience_items. All resumes are addressable: call list_resumes for ids. For experience bullets, pass set_experience_items (each item: company, position, period, description with achievements).",
    parameters: {
      type: "object",
      properties: {
        resume_id: { type: "string" },
        update_all: { type: "boolean" },
        display_name: { type: "string" },
        full_name: { type: "string" },
        headline: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        location: { type: "string" },
        summary: { type: "string" },
        resume_status: { type: "string", description: "One of: Active, Draft, Archived" },
        set_experience_items: {
          type: "array",
          description: "Replaces data.sections.experience.items in the builder for the selected resume(s).",
        },
      },
    },
  },
  {
    name: "update_application_status",
    description: "Update a job application status in the database.",
    parameters: {
      type: "object",
      properties: {
        application_id: { type: "string" },
        status: { type: "string" },
      },
      required: ["application_id", "status"],
    },
  },
  {
    name: "bookmark_job",
    description: "Set bookmarked on a tracked job.",
    parameters: {
      type: "object",
      properties: {
        job_id: { type: "string" },
        bookmarked: { type: "boolean" },
      },
      required: ["job_id", "bookmarked"],
    },
  },
  {
    name: "hide_job",
    description: "Hide/dismiss a job from the job queue.",
    parameters: {
      type: "object",
      properties: { job_id: { type: "string" } },
      required: ["job_id"],
    },
  },
  {
    name: "polish_content",
    description: "Improve professional text.",
    parameters: { type: "object", properties: { content: { type: "string" }, instruction: { type: "string" } }, required: ["content"] },
  },
  {
    name: "list_edge_functions",
    description: "List JobRaker edge functions and the parameters they accept.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_edge_function_details",
    description: "Inspect one edge function by name, including payload shape and notes.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "invoke_edge_function",
    description: "Invoke a JobRaker edge function with an arbitrary JSON payload and optional custom headers. Confirm before using side-effectful functions.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        payload: { type: "object" },
        method: { type: "string", description: "Defaults to POST. Can also be GET for read-like endpoints." },
        headers: { type: "object" },
      },
      required: ["name"],
      additionalProperties: true,
    },
  },
  {
    name: "search_gmail_job_emails",
    description:
      "Search the user's Gmail ONLY for job-search correspondence (applications, interviews, offers, rejections, assessments, recruiter mail). Uses a fixed job-related query on the server; cannot search arbitrary personal mail. Requires Gmail connected in Settings → Integrations.",
    parameters: {
      type: "object",
      properties: {
        max_results: {
          type: "number",
          description: "Max messages to return (1–15, default 8).",
        },
        refine_query: {
          type: "string",
          description:
            "Optional extra Gmail search terms to AND with the job filter (e.g. company or role). Letters, numbers, spaces, basic punctuation only.",
        },
      },
    },
  },
  {
    name: "send_gmail_job_email",
    description:
      "Send an email from the user's Gmail address ONLY for professional job-related communication (recruiter follow-up, thank-you after interview, application status). The server rejects content that does not look job-related. Always confirm recipient, subject, and body with the user before calling. Requires Gmail connected with send permission.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address" },
        subject: { type: "string", description: "Email subject line" },
        body: { type: "string", description: "Plain-text body" },
      },
      required: ["to", "subject", "body"],
    },
  },
];

serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get("origin"), req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    const body = await req.json();
    const {
      messages,
      system,
      mode = "ask",
      model: requestedModel,
      webSearch = false,
    } = body;
    const { authHeader, user, subscriptionTier } = await requireSubscriptionTier(req, "Pro", "AI chat");

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages are required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    let normalizedMessages: { role: string; content: string; images?: { mimeType: string; data: string }[] }[];
    try {
      normalizedMessages = messages.map((m: any, i: number) => {
        const role = m?.role === "assistant" ? "assistant" : "user";
        const content = typeof m?.content === "string" ? m.content : "";
        const isLast = i === messages.length - 1;
        const images =
          isLast && role === "user" ? normalizeChatImages(m?.images) : undefined;
        return { role, content, images };
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e?.message || "Invalid image payload" }), {
        status: 413,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const lastNorm = normalizedMessages[normalizedMessages.length - 1];
    if (
      lastNorm.role === "user" &&
      !lastNorm.content.trim() &&
      !lastNorm.images?.length
    ) {
      return new Response(JSON.stringify({ error: "Message text or image is required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const serviceClient = createServiceSupabaseClient();

    // --- Rate limit check ---
    const { data: rateLimitResult, error: rlError } = await serviceClient.rpc(
      "check_chat_rate_limit",
      { p_user_id: userId, p_tier: subscriptionTier },
    );
    if (!rlError && rateLimitResult && rateLimitResult.allowed === false) {
      return new Response(
        JSON.stringify({
          error: rateLimitResult.message,
          code: rateLimitResult.reason,
          retry_after: rateLimitResult.retry_after_seconds,
        }),
        {
          status: 429,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    // --- Credit / quota consumption ---
    const { data: consumeResult, error: consumeError } = await serviceClient.rpc(
      "consume_chat_message",
      { p_user_id: userId },
    );
    if (consumeError) {
      console.error("consume_chat_message RPC error:", consumeError);
      return new Response(
        JSON.stringify({
          error: "Could not verify chat billing. Please try again.",
          code: "billing_error",
        }),
        {
          status: 503,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }
    const consumed = consumeResult as Record<string, unknown> | null;
    if (!consumed || consumed.success !== true) {
      const c = consumed || {};
      return new Response(
        JSON.stringify({
          error: (c.message as string) || "Chat billing failed.",
          code: (c.reason as string) || "insufficient_credits",
          balance: c.balance,
          free_remaining: c.free_remaining,
        }),
        {
          status: 402,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    const genAI = createGeminiClient();
    const modelName = requestedModel || GEMINI_MODEL;
    let userContext = null;
    try {
      userContext = await fetchUserContext(user.id, authHeader);
      if (userContext) {
        userContext.email = user.email ?? "";
        userContext.subscriptionTier = subscriptionTier;
      }
    } catch (contextError) {
      console.error("Failed to fetch AI chat user context:", contextError);
    }

    let systemInstruction = [ACCOUNT_ACCESS_RULES.trim(), APP_INTERFACE_GUIDE.trim()]
      .filter(Boolean)
      .join("\n\n");

    if (system) {
      systemInstruction = `${systemInstruction}\n\n${system}`;
    }
    
    if (userContext) {
      const contextStr = formatUserContextForPrompt(userContext);
      systemInstruction = `User Info:\n${contextStr}\n\n${systemInstruction}`;
    }

    if (mode === "agent") {
      const gmailJobRules = `
Job-related Gmail (only when tools are available):
- search_gmail_job_emails searches using a fixed job-search filter on the server; it is not a full inbox search.
- send_gmail_job_email sends only if the message clearly relates to the user's job search; the server may reject other content. Always show the user the exact To, Subject, and body and obtain explicit confirmation before sending.
Never use Gmail tools for personal, medical, financial (non-compensation job offer), or unrelated topics.`;
      const agentCapabilityRules = `
Profile, resume, and in-app data (execute directly — do not ask the user to copy-paste):
- update_profile, add_skill, remove_skill, add_experience, save_cover_letter, update_resume, update_application_status, bookmark_job, and hide_job write to the user's own rows via the authenticated Supabase client.
- For resume Experience bullets or sections, use update_resume with list_resumes for ids; use set_experience_items to replace builder experience items, and resume_status to set Active/Draft/Archived when asked.

Navigation and page control:
- Use list_app_pages to inspect the full app map.
- Use open_app_page only when the user wants to open or move to a page.

Application process tracking:
- Use list_applications and refresh_application_processes to keep up with multi-stage application pipelines across JobRaker, Gmail, and Skyvern.

Edge functions:
- Use list_edge_functions and get_edge_function_details before invoke_edge_function when you need to inspect or manipulate edge-function parameters.
- Confirm before invoking side-effectful functions such as apply-to-jobs, init-payment, send_gmail_job_email, or webhook-like endpoints.`;
      systemInstruction =
        `You are JobRaker Agent. Be proactive, use tools to help the user, and answer from JobRaker data before falling back to general advice. Confirm before applying, deleting, sending email, navigating away for the user, or triggering any side-effectful workflow.\nAfter every batch of tool calls, you MUST reply in plain language: what you did, the result, and the next step or a direct answer (never end with only tools and no message).\n\n${gmailJobRules.trim()}\n\n${agentCapabilityRules.trim()}\n\n${systemInstruction}`;
    }

    const chatConfig: Record<string, unknown> = {
      systemInstruction: {
        role: "system",
        parts: [{ text: systemInstruction }],
      },
      thinkingConfig: { thinkingLevel: "MEDIUM" },
    };
    if (mode === "agent") {
      chatConfig.tools = webSearch
        ? [
            { functionDeclarations: AGENT_FUNCTION_DECLARATIONS },
            { googleSearch: {} },
          ]
        : [{ functionDeclarations: AGENT_FUNCTION_DECLARATIONS }];
      /** Required when mixing built-in tools (e.g. googleSearch) with functionDeclarations. */
      if (webSearch) {
        chatConfig.toolConfig = {
          includeServerSideToolInvocations: true,
        };
      }
    } else if (webSearch) {
      chatConfig.tools = [{ googleSearch: {} }];
    }

    const history = normalizedMessages.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const lastUserParts = buildGeminiUserParts(
      normalizedMessages[normalizedMessages.length - 1].content,
      normalizedMessages[normalizedMessages.length - 1].images,
    );

    const streamBody = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const enqueueEvent = (ev: string, data: any) => {
          const payload = typeof data === "string" ? data : JSON.stringify(data);
          controller.enqueue(encoder.encode(`event: ${ev}\ndata: ${payload}\n\n`));
        };

        try {
          if (mode === "agent") {
            const chat = genAI.chats.create({
              model: modelName,
              config: chatConfig,
              history,
            });
            /** Max tool *rounds* (each round may include multiple parallel function calls). */
            const MAX_AGENT_TOOL_ROUNDS = 12;

            let response = await withGeminiRetry(() =>
              chat.sendMessage({ message: lastUserParts }),
            );
            let toolRounds = 0;
            let streamedAnyAssistantText = false;
            let agentStoppedForBilling = false;

            while (true) {
              const parts = response.candidates?.[0]?.content?.parts || [];
              let textDelta = "";
              for (const p of parts) {
                const pr = p as { text?: string };
                if (typeof pr.text === "string" && pr.text.length > 0) {
                  textDelta += pr.text;
                }
              }
              if (textDelta) {
                streamedAnyAssistantText = true;
                enqueueEvent("message", { delta: textDelta });
              }

              const functionCalls = parts.filter((p) => p.functionCall);
              if (functionCalls.length === 0) {
                break;
              }

              toolRounds += 1;
              if (toolRounds > MAX_AGENT_TOOL_ROUNDS) {
                enqueueEvent("message", {
                  delta:
                    "\n\n—\n*I reached the maximum number of tool steps for this turn. Ask me to **continue** if you need more (e.g. finish applying or summarize).*",
                });
                streamedAnyAssistantText = true;
                break;
              }

              // Option C: extra credit per agent tool round (Ask mode has no surcharge)
              const { data: surchargeResult, error: surchargeError } = await serviceClient.rpc(
                "consume_ai_chat_tool_surcharge",
                { p_user_id: userId, p_credits: 1 },
              );
              const sur = surchargeResult as Record<string, unknown> | null;
              const surchargeOk =
                sur &&
                (sur.success === true || sur.success === "true" || sur.success === "t");
              if (surchargeError || !surchargeOk) {
                if (surchargeError) {
                  console.error("consume_ai_chat_tool_surcharge RPC error:", surchargeError);
                }
                const rpcMsg =
                  typeof sur?.message === "string" ? sur.message : null;
                enqueueEvent("error", {
                  error: surchargeError
                    ? `Could not charge credits for agent tools. ${(surchargeError as { message?: string }).message || "Please try again."}`
                    : rpcMsg ||
                      "Not enough credits to run agent tools this step. Add credits or switch to Ask mode.",
                  code: surchargeError ? "billing_error" : "agent_tool_surcharge",
                  balance: sur?.balance,
                  reason: sur?.reason,
                });
                agentStoppedForBilling = true;
                break;
              }
              enqueueEvent("agent_surcharge", {
                credits_charged: sur.credits_charged,
                balance: sur.balance,
              });

              const toolResults = [];
              for (const fc of functionCalls) {
                const fn = fc.functionCall;
                console.log(`[Agent] Executing: ${fn.name}`);
                let result;
                try {
                  const args = isRecord(fn.args) ? fn.args : {};
                  const supabaseUser = createAuthedSupabaseClient(authHeader!);

                  if (fn.name === "get_account_snapshot") {
                    result = {
                      success: true,
                      snapshot: {
                        name: userContext?.name || "User",
                        email: userContext?.email || "",
                        headline: userContext?.headline || null,
                        credits: userContext?.credits || 0,
                        subscriptionTier: userContext?.subscriptionTier || subscriptionTier,
                        subscription: userContext
                          ? {
                              status: userContext.subscriptionStatus,
                              currentPeriodStart: userContext.subscriptionCurrentPeriodStart,
                              currentPeriodEnd: userContext.subscriptionCurrentPeriodEnd,
                              cancelAtPeriodEnd: userContext.subscriptionCancelAtPeriodEnd,
                              billingCycle: userContext.subscriptionBillingCycle,
                              nextRenewalOrEnd: userContext.subscriptionNextRenewalOrEndIso,
                              daysUntilNextOrEnd: userContext.subscriptionDaysRemaining,
                            }
                          : null,
                        applicationCount: userContext?.applicationCount || 0,
                        jobCount: userContext?.jobCount || 0,
                        resumeCount: userContext?.resumeCount || 0,
                        recentApplications: userContext?.recentApplications || [],
                        recentJobs: userContext?.recentJobs || [],
                        resumes: userContext?.resumes || [],
                      },
                    };
                  } else if (fn.name === "run_job_search") {
                    result = await invokeEdgeFunctionByName({
                      authHeader: authHeader!,
                      name: "jobs-search",
                      payload: {
                        searchQuery: asString(args.query) || "",
                        location: asString(args.location) || undefined,
                      },
                    });
                  } else if (fn.name === "get_credits_balance") {
                    const { data } = await supabaseUser
                      .from("user_credits")
                      .select("balance")
                      .eq("user_id", userId)
                      .maybeSingle();
                    result = { success: true, balance: data?.balance || 0 };
                  } else if (fn.name === "get_user_profile") {
                    result = { success: true, profile: userContext };
                  } else if (fn.name === "list_app_pages") {
                    result = {
                      success: true,
                      pages: APP_PAGES,
                    };
                  } else if (fn.name === "open_app_page") {
                    const requestedRoute = asString(args.route);
                    const page = resolveAppPage({
                      pageId: asString(args.page_id),
                      route: requestedRoute,
                      query: asString(args.query),
                    });
                    const resolvedRoute = requestedRoute || page?.route || null;

                    if (!page && !resolvedRoute) {
                      result = {
                        success: false,
                        error: "Could not resolve a page from the provided page_id, route, or query.",
                      };
                    } else if (!resolvedRoute || resolvedRoute.includes(":")) {
                      result = {
                        success: false,
                        requires_params: true,
                        page,
                        error:
                          "That target route still contains path parameters. Provide a concrete route if you want me to open it.",
                      };
                    } else {
                      enqueueEvent("ui_action", {
                        type: "navigate",
                        route: resolvedRoute,
                        pageId: page?.id || null,
                        pageTitle: page?.title || resolvedRoute,
                        replace: false,
                      });
                      result = {
                        success: true,
                        page,
                        route: resolvedRoute,
                        navigated: true,
                      };
                    }
                  } else if (fn.name === "list_applications") {
                    result = await fetchApplicationProcessSnapshot({
                      serviceClient,
                      userId,
                      applicationId: asString(args.application_id),
                      limit: asNumber(args.limit) || undefined,
                      includeRecentEvents: args.include_recent_events !== false,
                    });
                  } else if (fn.name === "refresh_application_processes") {
                    result = await refreshApplicationProcesses({
                      authHeader: authHeader!,
                      serviceClient,
                      userId,
                      applicationId: asString(args.application_id),
                      includeGmail: args.include_gmail !== false,
                      includeSkyvern: args.include_skyvern !== false,
                      gmailMaxResults: asNumber(args.gmail_max_results) || undefined,
                      force: args.force === true,
                      limit: asNumber(args.limit) || undefined,
                    });
                  } else if (fn.name === "list_resumes") {
                    const { data, error } = await supabaseUser
                      .from("resumes")
                      .select("id, name, status, updated_at, is_favorite, file_path, file_ext")
                      .eq("user_id", userId)
                      .order("updated_at", { ascending: false });
                    if (error) {
                      console.error("list_resumes:", error.message);
                      result = { success: false, error: error.message, resumes: [] };
                    } else {
                      result = { success: true, resumes: data || [] };
                    }
                  } else if (fn.name === "list_recent_jobs") {
                    const { data } = await supabaseUser
                      .from("jobs")
                      .select("id, title, company, location, apply_url, created_at, status, canonical_status, verification_status")
                      .eq("user_id", userId)
                      .order("created_at", { ascending: false })
                      .limit(clampNumber(args.limit, 10, 1, 25));
                    result = { success: true, jobs: data || [] };
                  } else if (fn.name === "apply_to_job") {
                    result = await runApplyToJobTool({
                      authHeader: authHeader!,
                      serviceClient,
                      userId,
                      userEmail: user.email ?? "",
                      args,
                    });
                  } else if (fn.name === "auto_apply_from_url") {
                    result = await runAutoApplyFromUrl({
                      authHeader: authHeader!,
                      serviceClient,
                      userId,
                      userEmail: user.email ?? "",
                      url: asString(args.url) || "",
                      coverLetter: asString(args.cover_letter),
                      additionalInformation: asString(args.additional_information),
                      workflowId: asString(args.workflow_id),
                      proxyLocation: asString(args.proxy_location),
                      title: asString(args.title),
                      maxStepsOverride: asNumber(args.max_steps_override),
                      reapply: args.reapply === true,
                    });
                  } else if (fn.name === "reapply_job") {
                    result = await runApplyToJobTool({
                      authHeader: authHeader!,
                      serviceClient,
                      userId,
                      userEmail: user.email ?? "",
                      args: {
                        ...args,
                        reapply: true,
                      },
                    });
                  } else if (fn.name === "list_edge_functions") {
                    result = {
                      success: true,
                      functions: EDGE_FUNCTIONS,
                    };
                  } else if (fn.name === "get_edge_function_details") {
                    const definition = getEdgeFunctionDefinition(asString(args.name));
                    result = definition
                      ? { success: true, function: definition }
                      : { success: false, error: "Unknown edge function name." };
                  } else if (fn.name === "invoke_edge_function") {
                    result = await invokeEdgeFunctionByName({
                      authHeader: authHeader!,
                      name: asString(args.name) || "",
                      payload: args.payload,
                      method: asString(args.method),
                      headers: args.headers,
                    });
                  } else if (fn.name === "search_gmail_job_emails") {
                    result = await agentSearchJobRelatedEmails(
                      serviceClient,
                      userId,
                      (args || {}) as {
                        max_results?: number;
                        refine_query?: string;
                      },
                    );
                  } else if (fn.name === "send_gmail_job_email") {
                    result = await agentSendJobRelatedEmail(
                      serviceClient,
                      userId,
                      (args || {}) as {
                        to?: string;
                        subject?: string;
                        body?: string;
                      },
                    );
                  } else if (fn.name === "update_profile") {
                    const patch: Record<string, unknown> = {};
                    const allowed = [
                      "job_title",
                      "location",
                      "about",
                      "goals",
                      "first_name",
                      "last_name",
                      "experience_years",
                    ] as const;
                    for (const key of allowed) {
                      if (args[key] !== undefined && args[key] !== null) patch[key] = args[key];
                    }
                    if (Object.keys(patch).length === 0) {
                      result = { success: false, error: "No fields to update" };
                    } else {
                      patch.updated_at = new Date().toISOString();
                      const { error: upErr } = await supabaseUser
                        .from("profiles")
                        .update(patch)
                        .eq("id", userId);
                      result = upErr
                        ? { success: false, error: upErr.message }
                        : {
                            success: true,
                            updated_fields: Object.keys(patch).filter((k) => k !== "updated_at"),
                          };
                    }
                  } else if (fn.name === "add_skill") {
                    const name = asString(args.name) || "";
                    if (!name) {
                      result = { success: false, error: "Skill name is required" };
                    } else {
                      const { data: existing } = await supabaseUser
                        .from("profile_skills")
                        .select("id")
                        .ilike("name", name)
                        .maybeSingle();
                      if (existing) {
                        const updatePatch: Record<string, unknown> = {
                          updated_at: new Date().toISOString(),
                        };
                        if (args.level) updatePatch.level = args.level;
                        if (args.category) updatePatch.category = args.category;
                        await supabaseUser.from("profile_skills").update(updatePatch).eq("id", existing.id);
                        result = { success: true, action: "updated", skill: name };
                      } else {
                        const { error: insErr } = await supabaseUser.from("profile_skills").insert({
                          user_id: userId,
                          name,
                          level: asString(args.level) || "Intermediate",
                          category: asString(args.category) || "",
                        });
                        result = insErr
                          ? { success: false, error: insErr.message }
                          : { success: true, action: "added", skill: name };
                      }
                    }
                  } else if (fn.name === "remove_skill") {
                    const name = asString(args.name) || "";
                    if (!name) {
                      result = { success: false, error: "Skill name is required" };
                    } else {
                      const { data: skill } = await supabaseUser
                        .from("profile_skills")
                        .select("id")
                        .ilike("name", name)
                        .maybeSingle();
                      if (!skill) {
                        result = { success: false, error: `Skill "${name}" not found` };
                      } else {
                        const { error: delErr } = await supabaseUser
                          .from("profile_skills")
                          .delete()
                          .eq("id", skill.id);
                        result = delErr
                          ? { success: false, error: delErr.message }
                          : { success: true, removed: name };
                      }
                    }
                  } else if (fn.name === "add_experience") {
                    const title = asString(args.title) || "";
                    const company = asString(args.company) || "";
                    const start = asString(args.start_date) || "";
                    if (!title || !company || !start) {
                      result = {
                        success: false,
                        error: "title, company, and start_date (YYYY-MM-DD) are required",
                      };
                    } else {
                      const row: Record<string, unknown> = {
                        user_id: userId,
                        title,
                        company,
                        start_date: start,
                        location: asString(args.location) || "",
                        description: asString(args.description) || "",
                        is_current: args.is_current === true,
                      };
                      const end = asString(args.end_date);
                      if (end) row.end_date = end;
                      const { error: exErr } = await supabaseUser.from("profile_experiences").insert(row);
                      result = exErr
                        ? { success: false, error: exErr.message }
                        : { success: true, action: "added", title, company };
                    }
                  } else if (fn.name === "save_cover_letter") {
                    const cname = asString(args.name) || "";
                    const content = asString(args.content) || "";
                    if (!cname || !content) {
                      result = { success: false, error: "name and content are required" };
                    } else {
                      const { error: clErr } = await supabaseUser.from("cover_letters").insert({
                        user_id: userId,
                        name: cname,
                        content,
                        role: asString(args.role) || null,
                        company: asString(args.company) || null,
                      });
                      result = clErr
                        ? { success: false, error: clErr.message }
                        : { success: true, action: "saved", name: cname };
                    }
                  } else if (fn.name === "update_resume") {
                    result = await runUpdateResumeTool(supabaseUser, userId, args);
                  } else if (fn.name === "update_application_status") {
                    const appId = asString(args.application_id) || "";
                    const st = asString(args.status) || "";
                    if (!appId || !st) {
                      result = { success: false, error: "application_id and status are required" };
                    } else {
                      const { error: appErr } = await supabaseUser
                        .from("applications")
                        .update({ status: st, updated_at: new Date().toISOString() })
                        .eq("id", appId);
                      result = appErr
                        ? { success: false, error: appErr.message }
                        : { success: true, application_id: appId, new_status: st };
                    }
                  } else if (fn.name === "bookmark_job") {
                    const jId = asString(args.job_id) || "";
                    if (!jId) {
                      result = { success: false, error: "job_id is required" };
                    } else {
                      const { error: bErr } = await supabaseUser
                        .from("jobs")
                        .update({ bookmarked: args.bookmarked === true })
                        .eq("id", jId);
                      result = bErr
                        ? { success: false, error: bErr.message }
                        : { success: true, job_id: jId, bookmarked: args.bookmarked === true };
                    }
                  } else if (fn.name === "hide_job") {
                    const jId = asString(args.job_id) || "";
                    if (!jId) {
                      result = { success: false, error: "job_id is required" };
                    } else {
                      const { error: hErr } = await supabaseUser
                        .from("jobs")
                        .update({ hidden: true })
                        .eq("id", jId);
                      result = hErr
                        ? { success: false, error: hErr.message }
                        : { success: true, job_id: jId, hidden: true };
                    }
                  } else if (fn.name === "evaluate_job_fit") {
                    const t = normalizeSubscriptionTier(subscriptionTier);
                    if (t === "Free") {
                      result = {
                        success: false,
                        error:
                          "AI job fit reports require Basics or higher. Upgrade at Billing to unlock full evaluation (blockers, confidence, interview angles).",
                        upgrade_required: true,
                        required_tier: "Basics",
                        billing_path: "/dashboard/billing",
                      };
                    } else {
                      const jd =
                        asString(args.job_description) ||
                        asString(args.jobDescription) ||
                        "";
                      result = await invokeEdgeFunctionByName({
                        authHeader: authHeader!,
                        name: "evaluate-job-fit",
                        payload: {
                          jobDescription: jd,
                          jobId: args.job_id ?? args.jobId,
                          jobTitle: args.job_title ?? args.jobTitle,
                          company: args.company,
                          profileSnapshot: args.profile_snapshot ?? args.profileSnapshot,
                          resumeText: args.resume_text ?? args.resumeText,
                        },
                      });
                    }
                  } else {
                    result = await invokeEdgeFunctionByName({
                      authHeader: authHeader!,
                      name: fn.name.replace(/_/g, "-"),
                      payload: args,
                    });
                  }
                } catch (e: any) {
                  result = { success: false, error: e?.message || "Tool execution failed" };
                }

                toolResults.push({ functionResponse: { name: fn.name, response: result } });
                enqueueEvent("tool_call", { name: fn.name, args: fn.args, result });
              }
              response = await withGeminiRetry(() =>
                chat.sendMessage({
                  message: { role: "user", parts: toolResults },
                }),
              );
            }

            if (
              toolRounds > 0 &&
              !streamedAnyAssistantText &&
              !agentStoppedForBilling
            ) {
              enqueueEvent("message", {
                delta:
                  "\n\nI ran the tools above. **What should I do next?** For example: confirm auto-apply, draft a follow-up email, or summarize status.",
              });
            }
          } else {
            const chat = genAI.chats.create({
              model: modelName,
              config: chatConfig,
              history,
            });
            const stream = await withGeminiRetry(() =>
              chat.sendMessageStream({ message: lastUserParts }),
            );
            for await (const chunk of stream) {
              const text = streamChunkText(chunk);
              if (text) enqueueEvent("message", { delta: text });
            }
          }
          enqueueEvent("done", "[DONE]");
          controller.close();
        } catch (e: any) {
          console.error("Agent Loop Error:", e);
          const userMessage = isGeminiRateLimitError(e)
            ? "Our AI service is temporarily busy. Please try again in a moment."
            : e.message;
          enqueueEvent("error", { error: userMessage });
          controller.close();
        }
      },
    });

    return new Response(streamBody, {
      headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" }
    });

  } catch (error: any) {
    console.error("Outer Error:", error);
    return subscriptionErrorResponse(error, cors);
  }
});
