import { getCorsHeaders } from "../_shared/types.ts";
import {
  SubscriptionAccessError,
  requireSubscriptionTier,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";
import {
  firecrawlFetch,
  resolveFirecrawlApiKey,
  withRetry,
} from "../_shared/firecrawl.ts";
import {
  createGeminiClient,
  createGeminiConfig,
  extractGeminiText,
  GEMINI_MODEL,
  withModelFallback,
} from "../_shared/gemini.ts";
import {
  evaluateAndPersistJobFit,
  type JobEvaluationResult,
} from "../_shared/job-evaluation.ts";
import {
  attachExistingJobIdsBySourceId,
  formatJobTitleAndDescriptionWithAi,
} from "../_shared/jobs.ts";
import {
  enforceFeatureRateLimit,
  recordFeatureUsage,
} from "../_shared/feature-limits.ts";
import { isLikelyAggregateJobPage } from "../_shared/discovery-hybrid.ts";

interface IntakeJobUrlRequest {
  url?: string;
  profileSnapshot?: string;
  resumeText?: string;
}

interface ExtractedJobPosting {
  title: string;
  company: string;
  location: string | null;
  remote_type: string | null;
  employment_type: string | null;
  experience_level: string | null;
  description: string;
  posted_at: string | null;
  company_logo: string | null;
}

const JOB_TITLE_HINTS = [
  "engineer",
  "developer",
  "manager",
  "designer",
  "product",
  "marketing",
  "analyst",
  "scientist",
  "recruiter",
  "sales",
  "consultant",
  "director",
  "lead",
  "specialist",
  "architect",
  "operations",
  "customer",
  "support",
  "program",
  "partnerships",
];

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseJsonObject = (raw: string): Record<string, unknown> => {
  const cleaned = raw
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned) as Record<string, unknown>;
};

const safeUrl = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const normalizeUrl = (value: string): string | null => {
  const parsed = safeUrl(value);
  return parsed?.toString() ?? null;
};

const isProfileUrl = (url: string): boolean => {
  const lower = url.toLowerCase();
  if (lower.includes("upwork.com")) {
    if (
      /upwork\.com\/(freelancers|fl|agencies|o|search\/profiles)/i.test(lower)
    )
      return true;
    if (!lower.includes("/jobs/") && !lower.includes("/freelance-jobs/"))
      return true;
  }
  if (lower.includes("linkedin.com")) {
    if (/linkedin\.com\/in\//i.test(lower)) return true;
    if (
      /linkedin\.com\/company\/[^/]+\/?$/i.test(lower) &&
      !lower.includes("/jobs")
    )
      return true;
  }
  if (
    /\/(freelancers?|profiles?|users?|people|team|about-us)(\/|$)/i.test(lower)
  )
    return true;
  return false;
};

const isSearchUrl = (url: string): boolean => {
  const lower = url.toLowerCase();
  if (
    lower.includes("indeed.com") &&
    !lower.includes("/viewjob") &&
    !lower.includes("/rc/clk") &&
    lower.includes("/jobs")
  ) {
    return true;
  }
  if (
    lower.includes("linkedin.com") &&
    (lower.includes("/jobs/search") || lower.includes("/search"))
  ) {
    return true;
  }
  return false;
};

const hostFromUrl = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const parsed = safeUrl(value);
  return parsed?.hostname.replace(/^www\./, "") ?? null;
};

const sourceKindFromUrl = (
  url: string,
): "greenhouse" | "lever" | "ashby" | "workable" | "direct" => {
  if (/greenhouse/i.test(url)) return "greenhouse";
  if (/lever/i.test(url)) return "lever";
  if (/ashby/i.test(url)) return "ashby";
  if (/workable/i.test(url)) return "workable";
  return "direct";
};

const stripMarkdownNoise = (value: string): string =>
  value
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]+]\(([^)]+)\)/g, "$1")
    .replace(/[`#>*_~\-]{1,3}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

const clipText = (value: string, max = 18_000): string =>
  value.length > max ? value.slice(0, max) : value;

const segmentLooksLikeJobTitle = (segment: string): boolean => {
  const lower = segment.toLowerCase();
  return JOB_TITLE_HINTS.some((hint) => lower.includes(hint));
};

const deriveTitleAndCompany = (
  url: string,
  rawTitle?: string | null,
): { title: string; company: string } => {
  const fallbackCompany = (() => {
    const host = hostFromUrl(url);
    if (!host) return "Unknown company";
    const label = host.split(".")[0] || host;
    return label
      .split(/[-_]/)
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(" ");
  })();

  const title = asString(rawTitle);
  if (!title) {
    return {
      title: "Untitled role",
      company: fallbackCompany,
    };
  }

  const cleaned = title
    .replace(/\s+\|\s+Careers?$/i, "")
    .replace(/\s+\-\s+Careers?$/i, "")
    .trim();

  if (/\sat\s/i.test(cleaned)) {
    const [jobTitle, company] = cleaned.split(/\sat\s/i);
    return {
      title: jobTitle.trim() || "Untitled role",
      company: company?.trim() || fallbackCompany,
    };
  }

  const segments = cleaned
    .split(/\s+[|:\-–—]\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length >= 2) {
    const first = segments[0];
    const last = segments[segments.length - 1];
    if (segmentLooksLikeJobTitle(first) && !segmentLooksLikeJobTitle(last)) {
      return { title: first, company: last };
    }
    if (!segmentLooksLikeJobTitle(first) && segmentLooksLikeJobTitle(last)) {
      return { title: last, company: first };
    }
    return { title: first, company: last || fallbackCompany };
  }

  return {
    title: cleaned,
    company: fallbackCompany,
  };
};

const normalizeExtractedPosting = (
  parsed: Record<string, unknown>,
  fallback: ExtractedJobPosting,
): ExtractedJobPosting => {
  const description =
    asString(parsed.description) || asString(parsed.summary) || fallback.description;

  return {
    title: asString(parsed.title) || fallback.title,
    company: asString(parsed.company) || fallback.company,
    location: asString(parsed.location) || fallback.location,
    remote_type: asString(parsed.remote_type) || fallback.remote_type,
    employment_type:
      asString(parsed.employment_type) || fallback.employment_type,
    experience_level:
      asString(parsed.experience_level) || fallback.experience_level,
    description: description || fallback.description,
    posted_at: asString(parsed.posted_at) || fallback.posted_at,
    company_logo: asString(parsed.company_logo) || fallback.company_logo,
  };
};

const extractStructuredPosting = async (
  url: string,
  metadata: Record<string, unknown>,
  markdown: string,
): Promise<ExtractedJobPosting> => {
  const { title: fallbackTitle, company: fallbackCompany } = deriveTitleAndCompany(
    url,
    asString(metadata.title) ||
      asString(metadata.ogTitle) ||
      asString(metadata.pageTitle),
  );
  const fallbackDescription =
    stripMarkdownNoise(markdown).slice(0, 12_000) ||
    asString(metadata.description) ||
    "Job description unavailable.";

  const fallback: ExtractedJobPosting = {
    title: fallbackTitle,
    company: fallbackCompany,
    location:
      asString(metadata.location) ||
      asString(metadata["jobLocation"]) ||
      null,
    remote_type: null,
    employment_type: null,
    experience_level: null,
    description: fallbackDescription,
    posted_at:
      asString(metadata.publishedTime) ||
      asString(metadata.datePublished) ||
      null,
    company_logo:
      asString(metadata.ogImage) ||
      asString(metadata.logo) ||
      null,
  };

  const ai = createGeminiClient();
  const prompt = `
You extract structured job posting data for Jobraker.
Return only valid JSON with this schema:
{
  "title": "string",
  "company": "string",
  "location": "string | null",
  "remote_type": "Remote | Hybrid | On-site | null",
  "employment_type": "Full-time | Part-time | Contract | Internship | Temporary | Freelance | null",
  "experience_level": "string | null",
  "description": "string",
  "posted_at": "ISO date string | null",
  "company_logo": "https url | null"
}

Prefer the real company name and role title from the posting itself.
Keep the description detailed and recruiter-ready, but plain text only.

URL:
${url}

Metadata:
${JSON.stringify(metadata, null, 2)}

Posting content:
${clipText(markdown, 18_000)}
`;

  try {
    const { result: response } = await withModelFallback((model) =>
      ai.models.generateContent({
        model,
        config: createGeminiConfig({
          systemInstruction:
            "You are a structured extraction engine for job postings. Respond with JSON only.",
          includeTools: false,
          thinkingLevel: "LOW",
        }, model),
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      })
    );

    const raw = extractGeminiText(response);
    const parsed = parseJsonObject(raw);
    return normalizeExtractedPosting(parsed, fallback);
  } catch (error) {
    console.warn("intake-job-url.extract-fallback", error);
    return fallback;
  }
};

const verifyJobUrl = async (
  url: string,
): Promise<"verified" | "stale" | "failed"> => {
  const tryFetch = async (method: "HEAD" | "GET") => {
    const response = await fetch(url, {
      method,
      redirect: "follow",
      headers: {
        "user-agent": "JobrakerBot/1.0 (+https://jobraker.com)",
      },
    });
    return response.status;
  };

  try {
    const headStatus = await tryFetch("HEAD");
    if (headStatus >= 200 && headStatus < 400) return "verified";
    if (headStatus === 404 || headStatus === 410) return "stale";
  } catch {
    // Fall back to GET.
  }

  try {
    const getStatus = await tryFetch("GET");
    if (getStatus >= 200 && getStatus < 400) return "verified";
    if (getStatus === 404 || getStatus === 410) return "stale";
    return "failed";
  } catch {
    return "failed";
  }
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin || undefined);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user, serviceClient, subscriptionTier } = await requireSubscriptionTier(
      req,
      "Basics",
      "Job evaluations",
    );
    await enforceFeatureRateLimit({
      userId: user.id,
      featureKey: "intake_job_url",
      serviceClient,
      subscriptionTier,
    });

    const body: IntakeJobUrlRequest = await req.json().catch(() => ({}));
    const normalizedUrl = normalizeUrl(body.url || "");

    if (!normalizedUrl) {
      return new Response(
        JSON.stringify({ error: "A valid job posting URL is required." }),
        {
          status: 400,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    if (isProfileUrl(normalizedUrl)) {
      return new Response(
        JSON.stringify({
          error:
            "That URL looks like a freelancer or personal profile, not a job posting. Please paste the link to the actual job listing.",
        }),
        {
          status: 422,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    if (isSearchUrl(normalizedUrl) || isLikelyAggregateJobPage(normalizedUrl)) {
      return new Response(
        JSON.stringify({
          error:
            "That URL looks like a search results list, not an individual job posting. Please click on a specific job to open it, then copy and paste its unique link.",
        }),
        {
          status: 422,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    const firecrawlApiKey = await resolveFirecrawlApiKey();
    const verificationStatus = await verifyJobUrl(normalizedUrl);

    if (verificationStatus === "stale") {
      return new Response(
        JSON.stringify({
          error: "That posting appears to be expired or unavailable.",
          verification_status: verificationStatus,
        }),
        {
          status: 410,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    const scrape = await withRetry(
      () =>
        firecrawlFetch(
          "/scrape",
          firecrawlApiKey,
          {
            url: normalizedUrl,
            formats: ["markdown"],
            onlyMainContent: true,
          },
          user.id,
        ),
      2,
      1000,
    );

    const scrapeData =
      scrape?.data && typeof scrape.data === "object"
        ? (scrape.data as Record<string, unknown>)
        : {};
    const markdown =
      asString(scrapeData.markdown) ||
      asString(scrapeData.content) ||
      asString(scrapeData.extract) ||
      "";
    const metadata =
      scrapeData.metadata && typeof scrapeData.metadata === "object"
        ? (scrapeData.metadata as Record<string, unknown>)
        : {};

    const extracted = await extractStructuredPosting(
      normalizedUrl,
      metadata,
      markdown,
    );

    if (!extracted.description || extracted.description.length < 250) {
      return new Response(
        JSON.stringify({
          error:
            "Jobraker could not extract enough detail from that posting to evaluate it. This often happens if the link points to a search page, requires a login, or is blocked by bot protection.",
        }),
        {
          status: 422,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    const nowIso = new Date().toISOString();
    const sourceKind = sourceKindFromUrl(normalizedUrl);
    const sourceId = `direct-url:${normalizedUrl}`;

    const formatted = await formatJobTitleAndDescriptionWithAi(extracted.title, extracted.description || "");
    extracted.title = formatted.title;
    extracted.description = formatted.description;

    const [jobRow] = await attachExistingJobIdsBySourceId(serviceClient, user.id, [
      {
        user_id: user.id,
        source_type: "adapter",
        source_id: sourceId,
        source_kind: sourceKind,
        source_confidence: sourceKind === "direct" ? 0.84 : 0.93,
        verification_status: verificationStatus,
        is_tracked_company: false,
        status: "active",
        canonical_status: "discovered",
        discovered_at: nowIso,
        last_verified_at: nowIso,
        title: extracted.title,
        company: extracted.company,
        company_logo: extracted.company_logo,
        location: extracted.location,
        remote_type: extracted.remote_type,
        employment_type: extracted.employment_type,
        experience_level: extracted.experience_level,
        apply_url: normalizedUrl,
        description: extracted.description,
        posted_at: extracted.posted_at,
        raw_data: {
          sourceUrl: normalizedUrl,
          screenshot: scrapeData.screenshot ?? null,
          scraped_data: {
            title: extracted.title,
            company: extracted.company,
            location: extracted.location,
            remote_type: extracted.remote_type,
            employment_type: extracted.employment_type,
            experience_level: extracted.experience_level,
            description: extracted.description,
          },
          intake: {
            mode: "direct_url",
            source_kind: sourceKind,
            verification_status: verificationStatus,
            ingested_at: nowIso,
          },
          metadata,
        },
      },
    ]);

    const { data: upsertedJob, error: jobUpsertError } = await serviceClient
      .from("jobs")
      .upsert(jobRow, { onConflict: "id" })
      .select("*")
      .single();

    if (jobUpsertError || !upsertedJob) {
      console.error("intake-job-url.job-upsert-error", jobUpsertError);
      throw new Error(jobUpsertError?.message || "Failed to save job posting.");
    }

    const evaluation: JobEvaluationResult = await evaluateAndPersistJobFit({
      serviceClient,
      userId: user.id,
      jobId: upsertedJob.id,
      jobTitle: extracted.title,
      company: extracted.company,
      jobDescription: extracted.description,
      profileSnapshot: body.profileSnapshot || null,
      resumeText: body.resumeText || null,
    });

    const { data: finalJob, error: finalJobError } = await serviceClient
      .from("jobs")
      .select("*")
      .eq("id", upsertedJob.id)
      .eq("user_id", user.id)
      .single();

    if (finalJobError || !finalJob) {
      console.error("intake-job-url.final-job-error", finalJobError);
      throw new Error(
        finalJobError?.message || "The job was saved but could not be reloaded.",
      );
    }

    await recordFeatureUsage({
      userId: user.id,
      featureKey: "intake_job_url",
      serviceClient,
      subscriptionTier,
      metadata: {
        verification_status: verificationStatus,
        job_id: finalJob.id,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        verification_status: verificationStatus,
        job: finalJob,
        evaluation,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  } catch (error: unknown) {
    if (error instanceof SubscriptionAccessError) {
      return subscriptionErrorResponse(error, corsHeaders);
    }
    const message =
      error instanceof Error ? error.message : "Unexpected error occurred.";
    console.error("intake-job-url.error", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
