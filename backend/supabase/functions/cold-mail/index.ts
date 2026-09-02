import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  SubscriptionAccessError,
  requireSubscriptionTier,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";
import { agentCreateJobRelatedDraft } from "../_shared/gmail-job-agent-tools.ts";
import {
  confirmGmailDraftResult,
  createColdMailPreparationToken,
  selectColdMailRecipient,
  verifyColdMailPreparationToken,
  type ColdMailPreparation,
} from "../_shared/cold-mail-contract.ts";

type PrepareRequest = {
  action: "prepare";
  jobId?: string;
  companyName?: string;
  jobTitle?: string;
  instructions?: string;
};

type CreateDraftRequest = {
  action: "create_gmail_draft";
  preparationToken?: string;
};

type ColdMailRequest = PrepareRequest | CreateDraftRequest;

class RequestError extends Error {
  constructor(public status: number, message: string) {
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

async function resolveJob(
  serviceClient: any,
  userId: string,
  request: PrepareRequest,
) {
  const jobId = asString(request.jobId);
  const companyName = asString(request.companyName);
  const requestedTitle = asString(request.jobTitle);

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
  request: PrepareRequest,
) {
  const safeRequest: PrepareRequest = {
    action: "prepare",
    jobId: boundedString(request.jobId, "jobId", 100) || undefined,
    companyName:
      boundedString(request.companyName, "companyName", 200) || undefined,
    jobTitle: boundedString(request.jobTitle, "jobTitle", 200) || undefined,
    instructions:
      boundedString(request.instructions, "instructions", 2_000) || undefined,
  };
  const job = await resolveJob(serviceClient, userId, safeRequest);
  const companyName = asString(job.company);
  const jobTitle = asString(job.title) || asString(request.jobTitle);
  const jobDescription = asString(job.description);
  if (!companyName || !jobTitle) {
    throw new RequestError(422, "The selected job is missing its company or title.");
  }

  const scout = await invokeSpecialist(req, "scout-company", {
    companyName,
    jobId: asString(job.id) || undefined,
    jobTitle,
    jobDescription,
    applyUrl: asString(job.apply_url) || undefined,
    limit: 5,
  });
  const recipient = selectColdMailRecipient(scout);
  if (!recipient) {
    throw new RequestError(
      422,
      "No evidence-backed recruiter or public recruitment email was found for this job. No Gmail draft was created.",
    );
  }

  const [resumeText, publicProfileUrl] = await Promise.all([
    loadCandidateEvidence(serviceClient, userId),
    loadPublicProfileUrl(serviceClient, userId),
  ]);
  const generated = await invokeSpecialist(req, "generate-outreach", {
    companyName,
    role: jobTitle,
    resumeText,
    publicProfileUrl: publicProfileUrl || undefined,
    jobDescription: jobDescription || undefined,
    instructions: safeRequest.instructions,
  });
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

  return {
    success: true,
    status: "needs_approval",
    preparation: {
      jobId: preparation.jobId,
      companyName,
      jobTitle,
      recipient,
      subject,
      body,
    },
    preparationToken,
    agents: [
      { id: "job_context", status: "completed" },
      { id: "recruiter_scout", status: "completed" },
      { id: "candidate_evidence", status: "completed" },
      { id: "outreach_writer", status: "completed" },
      { id: "gmail_draft", status: "awaiting_approval" },
    ],
  };
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
    const { user, serviceClient } = await requireSubscriptionTier(
      req,
      "Basics",
      "Cold Mail",
    );
    const parsedRequest = await req.json();
    if (!parsedRequest || typeof parsedRequest !== "object" || Array.isArray(parsedRequest)) {
      throw new RequestError(400, "Cold Mail request is invalid.");
    }
    const request = parsedRequest as ColdMailRequest;

    if (request.action === "prepare") {
      const result = await prepareColdMail(
        req,
        serviceClient,
        user.id,
        request,
      );
      return jsonResponse(result, 200, corsHeaders);
    }

    if (request.action === "create_gmail_draft") {
      const token = boundedString(
        request.preparationToken,
        "preparationToken",
        60_000,
      );
      if (!token) throw new RequestError(400, "A reviewed Cold Mail draft is required.");
      const preparation = await verifyColdMailPreparationToken(
        token,
        signingSecret(),
      );
      if (preparation.userId !== user.id) {
        throw new RequestError(403, "This Cold Mail preparation belongs to another user.");
      }

      const providerResult = await agentCreateJobRelatedDraft(
        serviceClient,
        user.id,
        {
          to: preparation.recipient.email,
          subject: preparation.subject,
          body: preparation.body,
        },
      );
      const confirmed = confirmGmailDraftResult(providerResult);
      return jsonResponse(
        confirmed,
        confirmed.success ? 200 : 502,
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
    return jsonResponse({ success: false, error: message }, status, corsHeaders);
  }
});
