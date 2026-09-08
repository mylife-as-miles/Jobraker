import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  SubscriptionAccessError,
  requireSubscriptionTier,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";
import {
  agentCreateJobRelatedDraft,
  agentSendJobRelatedEmail,
} from "../_shared/gmail-job-agent-tools.ts";
import {
  confirmGmailDraftResult,
  createColdMailSpecialistCapabilityToken,
  createColdMailPreparationToken,
  selectColdMailRecipient,
  verifyColdMailPreparationToken,
  type ColdMailPreparation,
} from "../_shared/cold-mail-contract.ts";
import { getComposioGmailConnection } from "../_shared/composio-gmail.ts";
import {
  fingerprintColdMailPreparationToken,
  resolveColdMailDraftAttempt,
  type ColdMailDraftAttemptRow,
} from "../_shared/cold-mail-draft-idempotency.ts";

type PrepareRequest = {
  action: "prepare";
  presetId?: string;
  clientRunId?: string;
  jobId?: string;
  companyName?: string;
  jobTitle?: string;
  applyUrl?: string;
  instructions?: string;
};

type DiscoverRequest = {
  action: "discover";
  searchQuery?: string;
  location?: string;
  limit?: number;
};

type QuotaStatusRequest = {
  action: "quota_status";
};

type CreateDraftRequest = {
  action: "create_gmail_draft";
  preparationToken?: string;
  to?: string;
  subject?: string;
  body?: string;
};

type SendEmailRequest = {
  action: "send_gmail_email";
  preparationToken?: string;
  to?: string;
  subject?: string;
  body?: string;
};

type ColdMailRequest =
  | QuotaStatusRequest
  | DiscoverRequest
  | PrepareRequest
  | CreateDraftRequest
  | SendEmailRequest;

class RequestError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "RequestError";
  }
}

const asString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const boundedString = (
  value: unknown,
  field: string,
  maxLength: number,
) => {
  const parsed = asString(value);
  if (parsed.length > maxLength) {
    throw new RequestError(400, `${field} is too long.`);
  }
  return parsed;
};

const jsonResponse = (
  payload: Record<string, unknown>,
  status: number,
  headers: Record<string, string>,
) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });

const signingSecret = () => {
  const secret =
    asString(Deno.env.get("COLD_MAIL_SIGNING_SECRET")) ||
    asString(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  if (!secret) throw new Error("Cold Mail signing is not configured.");
  return secret;
};

async function invokeSpecialist(
  req: Request,
  functionName: string,
  payload: Record<string, unknown>,
  capabilityToken?: string,
) {
  const supabaseUrl = asString(Deno.env.get("SUPABASE_URL")).replace(/\/$/, "");
  const apiKey = asString(Deno.env.get("SUPABASE_ANON_KEY"));
  const authorization = asString(req.headers.get("Authorization"));
  if (!supabaseUrl || !apiKey || !authorization) {
    throw new Error("Cold Mail specialist invocation is not configured.");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      apikey: apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(capabilityToken
        ? { "X-Cold-Mail-Capability": capabilityToken }
        : {}),
    },
    body: JSON.stringify(payload),
  });
  const raw = await response.text();
  let data: unknown = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }
  if (!response.ok) {
    const message =
      data && typeof data === "object"
        ? asString((data as Record<string, unknown>).error)
        : asString(data);
    throw new RequestError(
      response.status,
      message || `${functionName} failed (${response.status}).`,
    );
  }
  return data;
}

async function transitionStarterRun(
  serviceClient: any,
  userId: string,
  agentRunId: string,
  status: string,
  lastStage: string,
  externalWorkStarted = false,
  failureClass?: string,
) {
  const { data, error } = await serviceClient.rpc(
    "transition_starter_cold_mail_run",
    {
      p_user_id: userId,
      p_agent_run_id: agentRunId,
      p_status: status,
      p_last_stage: lastStage,
      p_external_work_started: externalWorkStarted,
      p_failure_class: failureClass || null,
    },
  );
  if (error || data?.success === false) {
    console.warn("cold-mail run transition failed", {
      agentRunId,
      status,
      code: error?.code || data?.code,
      message: error?.message,
    });
  }
  return data;
}

async function getStarterQuotaStatus(serviceClient: any, userId: string) {
  const { data, error } = await serviceClient.rpc(
    "get_starter_cold_mail_quota_status",
    { p_user_id: userId },
  );
  if (error) {
    console.error("cold-mail quota status failed", {
      code: error.code,
      message: error.message,
    });
    throw new RequestError(
      500,
      "Cold Mail could not verify the Starter run limit.",
      "cold_mail_quota_unavailable",
    );
  }
  return data as Record<string, unknown>;
}

const PREPARATION_AGENTS = [
  { id: "job_context", status: "completed" },
  { id: "recruiter_scout", status: "completed" },
  { id: "candidate_evidence", status: "completed" },
  { id: "outreach_writer", status: "completed" },
  { id: "gmail_draft", status: "awaiting_approval" },
] as const;

function asStoredPreparation(
  value: unknown,
  userId: string,
  runId: string,
): ColdMailPreparation | null {
  if (!value || typeof value !== "object") return null;
  const preparation = value as ColdMailPreparation;
  if (
    preparation.userId !== userId ||
    preparation.runId !== runId ||
    preparation.presetId !== "recruiter_cold_outreach" ||
    preparation.allowedAction !== "create_gmail_draft" ||
    !preparation.jobId ||
    !preparation.recipient?.email ||
    !preparation.subject ||
    !preparation.body
  ) return null;
  return preparation;
}

async function loadStoredPreparation(
  serviceClient: any,
  userId: string,
  runId: string,
) {
  const { data, error } = await serviceClient
    .from("agent_runs")
    .select("receipt")
    .eq("id", runId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new RequestError(
      500,
      "Cold Mail could not restore this run.",
      "cold_mail_run_restore_failed",
    );
  }
  const receipt = data?.receipt && typeof data.receipt === "object"
    ? data.receipt as Record<string, unknown>
    : {};
  return asStoredPreparation(receipt.cold_mail_preparation, userId, runId);
}

async function storePreparation(
  serviceClient: any,
  userId: string,
  preparation: ColdMailPreparation,
) {
  const { data, error: loadError } = await serviceClient
    .from("agent_runs")
    .select("receipt")
    .eq("id", preparation.runId)
    .eq("user_id", userId)
    .maybeSingle();
  if (loadError) {
    throw new RequestError(
      500,
      "Cold Mail could not persist this preparation.",
      "cold_mail_preparation_persist_failed",
    );
  }
  const currentReceipt = data?.receipt && typeof data.receipt === "object"
    ? data.receipt as Record<string, unknown>
    : {};
  const { error } = await serviceClient
    .from("agent_runs")
    .update({
      receipt: {
        ...currentReceipt,
        cold_mail_preparation: preparation,
      },
    })
    .eq("id", preparation.runId)
    .eq("user_id", userId);
  if (error) {
    throw new RequestError(
      500,
      "Cold Mail could not persist this preparation.",
      "cold_mail_preparation_persist_failed",
    );
  }
}

async function resolveJob(
  serviceClient: any,
  userId: string,
  request: PrepareRequest,
) {
  const jobId = asString(request.jobId);
  const companyName = asString(request.companyName);
  const requestedTitle = asString(request.jobTitle);
  const applyUrl = asString(request.applyUrl);

  if (jobId) {
    const { data, error } = await serviceClient
      .from("jobs")
      .select("id, title, company, description, apply_url")
      .eq("id", jobId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.error("cold-mail job lookup failed", {
        code: error.code,
        message: error.message,
      });
      throw new RequestError(
        500,
        "Cold Mail could not load the selected job. Please try again.",
      );
    }
    if (!data) throw new RequestError(404, "The selected job could not be found.");
    return data as Record<string, unknown>;
  }

  if (applyUrl) {
    const { data, error } = await serviceClient
      .from("jobs")
      .select("id, title, company, description, apply_url")
      .eq("user_id", userId)
      .eq("apply_url", applyUrl)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("cold-mail job URL lookup failed", {
        code: error.code,
        message: error.message,
      });
      throw new RequestError(
        500,
        "Cold Mail could not load the selected job. Please try again.",
      );
    }
    if (data) return data as Record<string, unknown>;
  }

  if (!companyName) {
    throw new RequestError(
      400,
      "Cold Mail needs one job or company from the current job-search context.",
    );
  }

  const { data, error } = await serviceClient
    .from("jobs")
    .select("id, title, company, description, apply_url, created_at")
    .eq("user_id", userId)
    .ilike("company", companyName)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) {
    console.error("cold-mail job lookup failed", {
      code: error.code,
      message: error.message,
    });
    throw new RequestError(
      500,
      "Cold Mail could not load the selected job. Please try again.",
    );
  }

  const jobs = Array.isArray(data) ? data : [];
  const requestedTitleLower = requestedTitle.toLowerCase();
  const exactJob = requestedTitleLower
    ? jobs.find((job: Record<string, unknown>) => {
        const title = asString(job.title).toLowerCase();
        return (
          title === requestedTitleLower ||
          title.includes(requestedTitleLower) ||
          requestedTitleLower.includes(title)
        );
      })
    : jobs[0];

  if (!exactJob) {
    throw new RequestError(
      404,
      "That individual job was not found in the current saved job search.",
    );
  }
  return exactJob as Record<string, unknown>;
}

async function inferSearchPreference(
  serviceClient: any,
  userId: string,
  request: DiscoverRequest,
) {
  const requestedQuery = boundedString(
    request.searchQuery,
    "searchQuery",
    200,
  );
  const requestedLocation = boundedString(
    request.location,
    "location",
    120,
  );
  if (requestedQuery) {
    return {
      searchQuery: requestedQuery,
      location: requestedLocation || "Remote",
    };
  }

  const [profileResult, experienceResult] = await Promise.all([
    serviceClient
      .from("profiles")
      .select("job_title, location")
      .eq("id", userId)
      .maybeSingle(),
    serviceClient
      .from("profile_experiences")
      .select("title")
      .eq("user_id", userId)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const searchQuery =
    asString(profileResult.data?.job_title) ||
    asString(experienceResult.data?.title);
  if (!searchQuery) {
    throw new RequestError(
      422,
      "Cold Mail needs a target role. Add one to your profile or include it with the skill.",
    );
  }
  return {
    searchQuery,
    location:
      requestedLocation || asString(profileResult.data?.location) || "Remote",
  };
}

async function discoverColdMailTargets(
  req: Request,
  serviceClient: any,
  userId: string,
  request: DiscoverRequest,
) {
  const preference = await inferSearchPreference(serviceClient, userId, request);
  const limit = Number.isFinite(Number(request.limit))
    ? Math.max(1, Math.min(10, Math.floor(Number(request.limit))))
    : 10;
  const result = await invokeSpecialist(req, "jobs-search", {
    searchQuery: preference.searchQuery,
    location: preference.location,
    limit,
    async: false,
  });
  const resultRecord =
    result && typeof result === "object" && !Array.isArray(result)
      ? (result as Record<string, unknown>)
      : {};
  if (resultRecord.success !== true) {
    throw new RequestError(502, "Cold Mail opportunity search did not complete.");
  }

  const discovered = Array.isArray(resultRecord.jobs)
    ? resultRecord.jobs
        .filter(
          (job): job is Record<string, unknown> =>
            Boolean(job) && typeof job === "object" && !Array.isArray(job),
        )
        .slice(0, limit)
    : [];
  const applyUrls = Array.from(
    new Set(discovered.map((job) => asString(job.url)).filter(Boolean)),
  );
  if (!applyUrls.length) {
    return {
      success: true,
      status: "awaiting_target_selection",
      searchQuery: preference.searchQuery,
      location: preference.location,
      targets: [],
      agentRunId: asString(resultRecord.agent_run_id) || undefined,
    };
  }

  const { data: savedJobs, error: savedJobsError } = await serviceClient
    .from("jobs")
    .select("id, title, company, location, apply_url, source_kind")
    .eq("user_id", userId)
    .in("apply_url", applyUrls);
  if (savedJobsError) {
    console.error("cold-mail discovered job lookup failed", {
      code: savedJobsError.code,
      message: savedJobsError.message,
    });
    throw new RequestError(500, "Cold Mail could not load discovered targets.");
  }

  const agentRunId = asString(resultRecord.agent_run_id);
  let resultIdByJobId = new Map<string, string>();
  if (agentRunId) {
    const { data: searchResults, error: searchResultsError } =
      await serviceClient
        .from("job_search_results")
        .select("id, job_id")
        .eq("user_id", userId)
        .eq("agent_run_id", agentRunId);
    if (searchResultsError) {
      console.warn("cold-mail search result ID lookup failed", {
        code: searchResultsError.code,
        message: searchResultsError.message,
      });
    } else {
      resultIdByJobId = new Map(
        (Array.isArray(searchResults) ? searchResults : []).map(
          (row: Record<string, unknown>) => [asString(row.job_id), asString(row.id)],
        ),
      );
    }
  }

  const savedByUrl = new Map(
    (Array.isArray(savedJobs) ? savedJobs : []).map(
      (job: Record<string, unknown>) => [asString(job.apply_url), job],
    ),
  );
  const targets = discovered.flatMap((job) => {
    const saved = savedByUrl.get(asString(job.url));
    const jobId = asString(saved?.id);
    const jobTitle = asString(saved?.title) || asString(job.title);
    const companyName = asString(saved?.company) || asString(job.company);
    const applyUrl = asString(saved?.apply_url) || asString(job.url);
    if (!jobId || !jobTitle || !companyName || !applyUrl) return [];
    const searchResultId = resultIdByJobId.get(jobId);
    return [
      {
        jobId,
        ...(searchResultId ? { searchResultId } : {}),
        jobTitle,
        companyName,
        applyUrl,
        location: asString(saved?.location) || asString(job.location),
        source: asString(saved?.source_kind) || asString(job.source_kind),
      },
    ];
  });

  return {
    success: true,
    status: "awaiting_target_selection",
    searchQuery: preference.searchQuery,
    location: preference.location,
    targets,
    agentRunId: agentRunId || undefined,
  };
}

async function loadCandidateEvidence(serviceClient: any, userId: string) {
  const { data: favoriteResume } = await serviceClient
    .from("resumes")
    .select("id")
    .eq("user_id", userId)
    .eq("is_favorite", true)
    .maybeSingle();

  let resume = favoriteResume;
  if (!resume) {
    const { data } = await serviceClient
      .from("resumes")
      .select("id")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    resume = data;
  }

  if (resume?.id) {
    const { data } = await serviceClient
      .from("parsed_resumes")
      .select("raw_text")
      .eq("resume_id", resume.id)
      .order("extracted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const rawText = asString(data?.raw_text);
    if (rawText) return rawText;
  }

  const [profileResult, experienceResult, educationResult, skillsResult] =
    await Promise.all([
      serviceClient.from("profiles").select("*").eq("id", userId).maybeSingle(),
      serviceClient
        .from("profile_experiences")
        .select("title, company, start_date, end_date, description")
        .eq("user_id", userId)
        .order("start_date", { ascending: false }),
      serviceClient
        .from("profile_education")
        .select("degree, school")
        .eq("user_id", userId)
        .order("start_date", { ascending: false }),
      serviceClient
        .from("profile_skills")
        .select("name")
        .eq("user_id", userId),
    ]);

  const profile = profileResult.data || {};
  const experiences = Array.isArray(experienceResult.data)
    ? experienceResult.data
    : [];
  const education = Array.isArray(educationResult.data)
    ? educationResult.data
    : [];
  const skills = Array.isArray(skillsResult.data) ? skillsResult.data : [];
  const evidence = [
    `Name: ${asString(profile.first_name)} ${asString(profile.last_name)}`.trim(),
    `Title: ${asString(profile.job_title)}`,
    `Location: ${asString(profile.location)}`,
    "Experience:",
    ...experiences.map(
      (item: Record<string, unknown>) =>
        `- ${asString(item.title)} at ${asString(item.company)}: ${asString(item.description)}`,
    ),
    "Education:",
    ...education.map(
      (item: Record<string, unknown>) =>
        `- ${asString(item.degree)} from ${asString(item.school)}`,
    ),
    `Skills: ${skills.map((item: Record<string, unknown>) => asString(item.name)).filter(Boolean).join(", ")}`,
  ]
    .filter((line) => !/:\s*$/.test(line) || line === "Experience:" || line === "Education:")
    .join("\n")
    .trim();

  if (!experiences.length && !skills.length && !asString(profile.job_title)) {
    throw new RequestError(
      422,
      "Cold Mail needs resume or profile evidence before it can write a trustworthy draft.",
    );
  }
  return evidence;
}

async function loadPublicProfileUrl(serviceClient: any, userId: string) {
  const { data } = await serviceClient
    .from("public_profile_sites")
    .select("slug")
    .eq("user_id", userId)
    .maybeSingle();
  const slug = asString(data?.slug);
  if (!slug) return "";
  return `https://app.jobraker.io/u/${encodeURIComponent(slug)}`;
}

async function prepareColdMail(
  req: Request,
  serviceClient: any,
  userId: string,
  subscriptionTier: string,
  request: PrepareRequest,
) {
  const isStarter = subscriptionTier === "Starter";
  const safeRequest: PrepareRequest = {
    action: "prepare",
    presetId: boundedString(request.presetId, "presetId", 100) || undefined,
    clientRunId:
      boundedString(request.clientRunId, "clientRunId", 200) || undefined,
    jobId: boundedString(request.jobId, "jobId", 100) || undefined,
    companyName:
      boundedString(request.companyName, "companyName", 200) || undefined,
    jobTitle: boundedString(request.jobTitle, "jobTitle", 200) || undefined,
    applyUrl: boundedString(request.applyUrl, "applyUrl", 2_048) || undefined,
    instructions:
      boundedString(request.instructions, "instructions", 2_000) || undefined,
  };
  if (isStarter) {
    if (safeRequest.presetId !== "recruiter_cold_outreach") {
      throw new RequestError(
        403,
        "Starter Cold Mail is available only through the 1-Click Recruiter Cold Mail preset.",
        "cold_mail_preset_required",
      );
    }
    if (!safeRequest.jobId) {
      throw new RequestError(
        400,
        "Select exactly one saved job before starting Cold Mail.",
        "cold_mail_job_required",
      );
    }
    if (!safeRequest.clientRunId) {
      throw new RequestError(
        400,
        "A Cold Mail run key is required.",
        "cold_mail_run_key_required",
      );
    }
  }
  const job = await resolveJob(serviceClient, userId, safeRequest);
  const companyName = asString(job.company);
  const jobTitle = asString(job.title) || asString(request.jobTitle);
  const jobDescription = asString(job.description);
  if (!companyName || !jobTitle) {
    throw new RequestError(422, "The selected job is missing its company or title.");
  }

  let runId: string = crypto.randomUUID();
  let quota: Record<string, unknown> | undefined;
  if (isStarter) {
    const gmailConnection = await getComposioGmailConnection(userId);
    if (!gmailConnection.connected) {
      throw new RequestError(
        409,
        "Connect Gmail before starting a Starter Cold Mail run.",
        "gmail_not_connected",
      );
    }
    const { data, error } = await serviceClient.rpc(
      "reserve_starter_cold_mail_run",
      {
        p_user_id: userId,
        p_job_id: asString(job.id),
        p_idempotency_key: safeRequest.clientRunId,
      },
    );
    if (error) {
      console.error("cold-mail run reservation failed", {
        code: error.code,
        message: error.message,
      });
      throw new RequestError(
        500,
        "Cold Mail could not reserve this run.",
        "cold_mail_run_reservation_failed",
      );
    }
    const reservation = data as Record<string, unknown>;
    if (reservation?.success !== true) {
      const code = asString(reservation?.code) ||
        "cold_mail_run_reservation_failed";
      throw new RequestError(
        code === "cold_mail_daily_limit_reached" ? 429 : 400,
        asString(reservation?.error) || "Cold Mail could not reserve this run.",
        code,
        reservation?.quota && typeof reservation.quota === "object"
          ? { quota: reservation.quota as Record<string, unknown> }
          : undefined,
      );
    }
    runId = asString(reservation.agentRunId);
    quota = reservation.quota && typeof reservation.quota === "object"
      ? reservation.quota as Record<string, unknown>
      : undefined;
    if (!runId) {
      throw new RequestError(
        500,
        "Cold Mail did not receive a valid run ID.",
        "cold_mail_run_reservation_failed",
      );
    }
    if (reservation.idempotentReplay === true) {
      const storedPreparation = await loadStoredPreparation(
        serviceClient,
        userId,
        runId,
      );
      if (!storedPreparation) {
        throw new RequestError(
          409,
          "This Cold Mail run is already in progress. Wait for it to finish before retrying.",
          "cold_mail_run_in_progress",
          quota ? { quota } : undefined,
        );
      }
      return {
        success: true,
        status: "needs_approval",
        runId,
        quota,
        preparation: {
          jobId: storedPreparation.jobId,
          companyName: storedPreparation.companyName,
          jobTitle: storedPreparation.jobTitle,
          recipient: storedPreparation.recipient,
          subject: storedPreparation.subject,
          body: storedPreparation.body,
        },
        preparationToken: await createColdMailPreparationToken(
          storedPreparation,
          signingSecret(),
        ),
        agents: PREPARATION_AGENTS,
      };
    }
  }

  try {
    if (isStarter) {
      await transitionStarterRun(
        serviceClient,
        userId,
        runId,
        "researching",
        "recruiter_scout",
        true,
      );
    }
    const scoutCapability = isStarter
      ? await createColdMailSpecialistCapabilityToken(
          {
            userId,
            runId,
            jobId: asString(job.id),
            presetId: "recruiter_cold_outreach",
            operation: "scout_company",
          },
          signingSecret(),
        )
      : undefined;
    const scout = await invokeSpecialist(req, "scout-company", {
      companyName,
      jobId: asString(job.id) || undefined,
      jobTitle,
      jobDescription,
      applyUrl: asString(job.apply_url) || undefined,
      limit: 5,
    }, scoutCapability);
    const recipient = selectColdMailRecipient(scout);
    if (!recipient) {
      throw new RequestError(
        422,
        "No evidence-backed recruiter or public recruitment email was found for this job. No Gmail draft was created.",
        "cold_mail_recipient_not_found",
      );
    }

    const [resumeText, publicProfileUrl] = await Promise.all([
      loadCandidateEvidence(serviceClient, userId),
      loadPublicProfileUrl(serviceClient, userId),
    ]);
    if (isStarter) {
      await transitionStarterRun(
        serviceClient,
        userId,
        runId,
        "generating",
        "outreach_writer",
      );
    }
    const outreachCapability = isStarter
      ? await createColdMailSpecialistCapabilityToken(
          {
            userId,
            runId,
            jobId: asString(job.id),
            presetId: "recruiter_cold_outreach",
            operation: "generate_outreach",
          },
          signingSecret(),
        )
      : undefined;
    const generated = await invokeSpecialist(req, "generate-outreach", {
      jobId: asString(job.id),
      companyName,
      role: jobTitle,
      resumeText,
      publicProfileUrl: publicProfileUrl || undefined,
      jobDescription: jobDescription || undefined,
      instructions: safeRequest.instructions,
    }, outreachCapability);
    const generatedRecord =
      generated && typeof generated === "object"
        ? (generated as Record<string, unknown>)
        : {};
    const subject = asString(generatedRecord.subject);
    const body = asString(generatedRecord.body);
    if (!subject || subject.length > 250 || body.length < 5 || body.length > 25_000) {
      throw new RequestError(502, "The outreach writer did not return a complete draft.");
    }

    const preparation: ColdMailPreparation = {
      userId,
      runId,
      presetId: "recruiter_cold_outreach",
      allowedAction: "create_gmail_draft",
      jobId: asString(job.id) || null,
      companyName,
      jobTitle,
      recipient,
      subject,
      body,
    };
    const preparationToken = await createColdMailPreparationToken(
      preparation,
      signingSecret(),
    );
    if (isStarter) {
      await storePreparation(serviceClient, userId, preparation);
      const transition = await transitionStarterRun(
        serviceClient,
        userId,
        runId,
        "needs_approval",
        "gmail_draft_approval",
      );
      if (transition?.quota && typeof transition.quota === "object") {
        quota = transition.quota as Record<string, unknown>;
      }
    }

    return {
      success: true,
      status: "needs_approval",
      runId,
      quota,
      preparation: {
        jobId: preparation.jobId,
        companyName,
        jobTitle,
        recipient,
        subject,
        body,
      },
      preparationToken,
      agents: PREPARATION_AGENTS,
    };
  } catch (error) {
    if (isStarter && runId) {
      await transitionStarterRun(
        serviceClient,
        userId,
        runId,
        "failed_consumed",
        "preparation_failed",
        false,
        error instanceof Error ? error.name : "unknown_error",
      );
    }
    throw error;
  }
}

const COLD_MAIL_DRAFT_ATTEMPT_COLUMNS =
  "id, status, provider_draft_id, provider_message_id, provider_thread_id, draft_from, recipient_email";

async function loadColdMailDraftAttempt(
  serviceClient: any,
  userId: string,
  requestFingerprint: string,
) {
  const { data, error } = await serviceClient
    .from("cold_mail_drafts")
    .select(COLD_MAIL_DRAFT_ATTEMPT_COLUMNS)
    .eq("user_id", userId)
    .eq("request_fingerprint", requestFingerprint)
    .maybeSingle();
  if (error) {
    console.error("cold-mail draft attempt lookup failed", {
      code: error.code,
      message: error.message,
    });
    throw new RequestError(500, "Cold Mail could not verify draft idempotency.");
  }
  return (data as ColdMailDraftAttemptRow | null) || null;
}

async function reserveColdMailDraftAttempt(
  serviceClient: any,
  userId: string,
  token: string,
  preparation: ColdMailPreparation,
  coldMailRunId?: string,
) {
  const requestFingerprint = await fingerprintColdMailPreparationToken(token);
  const existing = await loadColdMailDraftAttempt(
    serviceClient,
    userId,
    requestFingerprint,
  );
  const existingDecision = resolveColdMailDraftAttempt(existing);
  if (existingDecision.action !== "create") {
    return { decision: existingDecision, row: existing };
  }

  const { data, error } = await serviceClient
    .from("cold_mail_drafts")
    .insert({
      user_id: userId,
      job_id: preparation.jobId,
      cold_mail_run_id: coldMailRunId || null,
      request_fingerprint: requestFingerprint,
      recipient_email: preparation.recipient.email,
      subject: preparation.subject,
      status: "creating",
    })
    .select(COLD_MAIL_DRAFT_ATTEMPT_COLUMNS)
    .single();
  if (!error && data) {
    return {
      decision: { action: "create" as const },
      row: data as ColdMailDraftAttemptRow,
    };
  }

  if (error?.code === "23505") {
    const concurrent = await loadColdMailDraftAttempt(
      serviceClient,
      userId,
      requestFingerprint,
    );
    return {
      decision: resolveColdMailDraftAttempt(concurrent),
      row: concurrent,
    };
  }

  console.error("cold-mail draft attempt reservation failed", {
    code: error?.code,
    message: error?.message,
  });
  throw new RequestError(500, "Cold Mail could not reserve the Gmail draft write.");
}

async function persistColdMailDraftAttempt(
  serviceClient: any,
  attemptId: string,
  values: Record<string, unknown>,
) {
  const { error } = await serviceClient
    .from("cold_mail_drafts")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", attemptId);
  if (error) {
    console.error("cold-mail draft attempt persistence failed", {
      attemptId,
      code: error.code,
      message: error.message,
    });
    throw new RequestError(
      500,
      "The Gmail draft was processed but its confirmation could not be persisted. Check Gmail drafts before retrying.",
    );
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed." }, 405, corsHeaders);
  }

  try {
    const { user, serviceClient, subscriptionTier } = await requireSubscriptionTier(
      req,
      "Starter",
      "Cold Mail",
    );
    const parsedRequest = await req.json();
    if (!parsedRequest || typeof parsedRequest !== "object" || Array.isArray(parsedRequest)) {
      throw new RequestError(400, "Cold Mail request is invalid.");
    }
    const request = parsedRequest as ColdMailRequest;

    if (request.action === "quota_status") {
      if (subscriptionTier !== "Starter") {
        return jsonResponse({
          success: true,
          quota: null,
          plan: subscriptionTier,
        }, 200, corsHeaders);
      }
      return jsonResponse({
        success: true,
        quota: await getStarterQuotaStatus(serviceClient, user.id),
        plan: subscriptionTier,
      }, 200, corsHeaders);
    }

    if (request.action === "discover") {
      const result = await discoverColdMailTargets(
        req,
        serviceClient,
        user.id,
        request,
      );
      return jsonResponse(result, 200, corsHeaders);
    }

    if (request.action === "prepare") {
      const result = await prepareColdMail(
        req,
        serviceClient,
        user.id,
        subscriptionTier,
        request,
      );
      return jsonResponse(result, 200, corsHeaders);
    }

    if (request.action === "create_gmail_draft") {
      let to = "";
      let subject = "";
      let body = "";
      let preparation: ColdMailPreparation | null = null;
      let responseQuota: Record<string, unknown> | undefined;

      const token = boundedString(
        request.preparationToken,
        "preparationToken",
        60_000,
      );
      if (token) {
        preparation = await verifyColdMailPreparationToken(
          token,
          signingSecret(),
        );
        if (preparation.userId !== user.id) {
          throw new RequestError(403, "This Cold Mail preparation belongs to another user.");
        }
        to = preparation.recipient.email;
        subject = preparation.subject;
        body = preparation.body;
      } else if (
        subscriptionTier !== "Starter" &&
        request.to &&
        request.subject &&
        request.body
      ) {
        to = boundedString(request.to, "to", 320);
        subject = boundedString(request.subject, "subject", 500);
        body = boundedString(request.body, "body", 50000);
      } else {
        throw new RequestError(400, "A reviewed Cold Mail draft or preparation token is required.");
      }

      let reserved: Awaited<ReturnType<typeof reserveColdMailDraftAttempt>> | null = null;
      if (token && preparation) {
        reserved = await reserveColdMailDraftAttempt(
          serviceClient,
          user.id,
          token,
          preparation,
          subscriptionTier === "Starter" ? preparation.runId : undefined,
        );
        if (reserved.decision.action === "replay") {
          return jsonResponse({
            ...reserved.decision.response,
            runId: preparation.runId,
          }, 200, corsHeaders);
        }
        if (reserved.decision.action === "block" || !reserved.row) {
          return jsonResponse(
            reserved.decision.action === "block"
              ? reserved.decision.response
              : {
                  success: false,
                  code: "gmail_draft_reservation_failed",
                  error: "Cold Mail could not reserve the Gmail draft write.",
                },
            409,
            corsHeaders,
          );
        }
        if (subscriptionTier === "Starter") {
          const transition = await transitionStarterRun(
            serviceClient,
            user.id,
            preparation.runId,
            "creating_draft",
            "gmail_draft",
          );
          if (transition?.quota && typeof transition.quota === "object") {
            responseQuota = transition.quota as Record<string, unknown>;
          }
        }
      }

      let providerResult: Record<string, unknown>;
      try {
        providerResult = await agentCreateJobRelatedDraft(
          serviceClient,
          user.id,
          {
            to,
            subject,
            body,
          },
        );
      } catch (error) {
        const errorCode = "gmail_draft_provider_error";
        if (reserved?.row) {
          await persistColdMailDraftAttempt(serviceClient, reserved.row.id, {
            status: "uncertain",
            error_code: errorCode,
          });
        }
        if (subscriptionTier === "Starter" && preparation) {
          await transitionStarterRun(
            serviceClient,
            user.id,
            preparation.runId,
            "uncertain",
            "gmail_draft_uncertain",
            false,
            errorCode,
          );
        }
        console.error("Cold Mail Gmail draft provider failure", error);
        throw new RequestError(
          502,
          "Gmail draft creation could not be confirmed. Check Gmail before retrying.",
          errorCode,
        );
      }
      const confirmed = confirmGmailDraftResult(providerResult);
      if (confirmed.success && reserved?.row) {
        await persistColdMailDraftAttempt(serviceClient, reserved.row.id, {
          status: "created",
          provider_draft_id: confirmed.draftId,
          provider_message_id: confirmed.messageId,
          provider_thread_id: confirmed.threadId,
          draft_from: confirmed.draftFrom || null,
          error_code: null,
        });
      } else if (!confirmed.success && reserved?.row) {
        await persistColdMailDraftAttempt(serviceClient, reserved.row.id, {
          status: "uncertain",
          error_code: confirmed.code,
        });
      }
      if (subscriptionTier === "Starter" && preparation) {
        const transition = await transitionStarterRun(
          serviceClient,
          user.id,
          preparation.runId,
          confirmed.success ? "drafted" : "uncertain",
          confirmed.success ? "gmail_draft_created" : "gmail_draft_uncertain",
          false,
          confirmed.success ? undefined : confirmed.code,
        );
        if (transition?.quota && typeof transition.quota === "object") {
          responseQuota = transition.quota as Record<string, unknown>;
        }
      }
      return jsonResponse(
        {
          ...confirmed,
          ...(preparation ? { runId: preparation.runId } : {}),
          ...(responseQuota ? { quota: responseQuota } : {}),
        },
        confirmed.success ? 200 : 502,
        corsHeaders,
      );
    }

    if (request.action === "send_gmail_email") {
      if (subscriptionTier === "Starter") {
        throw new RequestError(
          403,
          "Starter Cold Mail creates Gmail drafts for review; direct sending is not available.",
          "cold_mail_send_not_available",
        );
      }
      let to = "";
      let subject = "";
      let body = "";

      const token = boundedString(
        request.preparationToken,
        "preparationToken",
        60_000,
      );
      if (token) {
        const preparation = await verifyColdMailPreparationToken(
          token,
          signingSecret(),
        );
        if (preparation.userId !== user.id) {
          throw new RequestError(403, "This Cold Mail preparation belongs to another user.");
        }
        to = preparation.recipient.email;
        subject = preparation.subject;
        body = preparation.body;
      } else if (request.to && request.subject && request.body) {
        to = boundedString(request.to, "to", 320);
        subject = boundedString(request.subject, "subject", 500);
        body = boundedString(request.body, "body", 50000);
      } else {
        throw new RequestError(400, "A reviewed Cold Mail email or preparation token is required.");
      }

      const providerResult = await agentSendJobRelatedEmail(
        serviceClient,
        user.id,
        {
          to,
          subject,
          body,
        },
      );
      return jsonResponse(
        providerResult,
        providerResult.success ? 200 : 502,
        corsHeaders,
      );
    }

    throw new RequestError(400, "Unknown Cold Mail action.");
  } catch (error) {
    if (error instanceof SubscriptionAccessError) {
      return subscriptionErrorResponse(error, corsHeaders);
    }
    const status = error instanceof RequestError ? error.status : 500;
    const message =
      error instanceof RequestError
        ? error.message
        : "Cold Mail failed. Please try again.";
    console.error("cold-mail failed", error);
    return jsonResponse({
      success: false,
      error: message,
      ...(error instanceof RequestError && error.code
        ? { code: error.code }
        : {}),
      ...(error instanceof RequestError && error.details
        ? error.details
        : {}),
    }, status, corsHeaders);
  }
});
