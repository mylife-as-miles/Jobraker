import {
  Briefcase,
  Search,
  MapPin,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
  Check,
  ShieldCheck,
  Clock3,
  FileText,
  AlertTriangle,
  UserCheck,
  UserX,
  FileCheck2,
  FileWarning,
  User,
  Trash2,
  Target,
  TrendingUp,
  Lock,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Switch } from "../../../components/ui/switch";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "../../../components/ui/button";
import Modal from "../../../components/ui/modal";
import { ConfirmDialog } from "../../../components/ui/confirm-dialog";
import { MarkdownContent } from "../../../components/ui/MarkdownContent";
import {
  getJobsQueueQueryOptions,
  jobsQueueKeys,
  useJobsQueue,
  type JobsQueueScope,
} from "../../../hooks/useJobsQueue";
import { useResumes } from "../../../hooks/useResumes";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { motion } from "framer-motion";
import useMediaQuery from "../../../hooks/use-media-query";
import { createClient } from "../../../lib/supabaseClient";
import {
  useProfileSettings,
  type Profile,
} from "../../../hooks/useProfileSettings";
import { events } from "../../../lib/analytics";
import { useToast } from "../../../components/ui/toast";
import { SimpleDropdown } from "../../../components/SimpleDropdown";
import { applyToJobs } from "../../../services/applications/applyToJobs";
import {
  evaluateJobFit,
  type EvaluateJobFitResponse,
} from "../../../services/ai/evaluateJobFit";
import { tailorResumeViaEdge } from "../../../services/ai/tailorResume";
import { generateCoverLetterViaEdge } from "../../../services/ai/generateCoverLetter";
import {
  fetchJobEvaluationReport,
  type JobEvaluationReport as JobEvaluationReportData,
} from "../../../services/jobs/jobEvaluation";
import { isTrustedSource } from "../../../utils/trustedSources";
import { useGamification } from "../../../hooks/useGamification";
import { cn, getProxiedLogoUrl } from "../../../lib/utils";
import { useRegisterCoachMarks } from "../../../providers/TourProvider";
import { MatchScorePieChart } from "../../../components/MatchScorePieChart";
import { UpgradePrompt } from "../../../components/UpgradePrompt";
import { JobEvaluationTeaser } from "../../../components/JobEvaluationTeaser";
import { AnimatedSVGBackground } from "../../../components/AnimatedSVGBackground";
import { JobEvaluationReport } from "../components/JobEvaluationReport";
import { invokeProtectedFunction } from "../../../services/supabase/invokeProtectedFunction";
import { loadParsedResumeText } from "../../../lib/parsedResume";
import { useSubscriptionTier } from "@/hooks/useSubscriptionTier";
import { hasSubscriptionAccess } from "@/lib/subscriptionAccess";
import { type JobCanonicalStatus } from "@/lib/applicationState";

// The Job interface now represents a row from our personal 'jobs' table.
interface Job {
  id: string; // This will be the DB UUID
  title: string;
  company: string;
  company_logo?: string | null;
  description: string | null;
  location: string | null;
  remote_type: string | null;
  employment_type?: string | null;
  experience_level?: string | null;
  apply_url: string | null;
  posted_at: string | null;
  expires_at: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  raw_data?: any;
  logoUrl?: string;
  logo: string;
  status?: string;
  canonical_status?: JobCanonicalStatus | null;
  verification_status?: "unverified" | "verified" | "stale" | "failed" | null;
  source_type?: string | null;
  source_id?: string | null;
  source_kind?: string | null;
  source_confidence?: number | null;
  is_tracked_company?: boolean;
  evaluation_summary?: {
    evaluation_id?: string | null;
    archetype?: string;
    canonical_decision?: "strong_yes" | "draft_first" | "risky" | "no_go";
    confidence_score?: number;
    blockers?: string[];
    exact_fit_evidence?: string[];
    matched_keywords?: string[];
  } | null;
  matchScore?: number;
  matchBreakdown?: MatchScoreBreakdown[];
  matchSummary?: string;
}

type MatchScoreBreakdown = {
  label: string;
  componentScore: number;
  contribution: number;
  weight: number;
  detail: string;
  matches?: string[];
};

type MatchContext = {
  searchQuery: string;
  selectedLocation: string;
  profile?: Profile | null;
};

type MatchScoreRequestJob = {
  id: string;
  title: string;
  description?: string;
  location?: string;
  remote_type?: string;
  raw_data?: {
    location?: string;
    scraped_data?: {
      location?: string;
      description?: string;
      tags?: string[];
      skills?: string[];
    };
  };
};

const MATCH_SCORE_BATCH_SIZE = 10;
const MATCH_SCORE_TEXT_LIMIT = 6_000;
const MATCH_SCORE_META_LIMIT = 500;
const MATCH_SCORE_LIST_LIMIT = 25;
const AUTO_APPLY_RATE_LIMIT_WAIT_MS = 65_000;

const sleep = (ms: number) =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

const isApplyRateLimitError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  return /rate limit exceeded/i.test(error.message);
};

const compactText = (value: unknown, maxLength: number): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
};

const compactStringList = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;

  const cleaned = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, MATCH_SCORE_LIST_LIMIT);

  return cleaned.length > 0 ? cleaned : undefined;
};

const buildMatchScoreRequestJob = (job: Job): MatchScoreRequestJob => {
  const raw =
    job.raw_data && typeof job.raw_data === "object"
      ? (job.raw_data as Record<string, unknown>)
      : undefined;
  const scraped =
    raw?.scraped_data && typeof raw.scraped_data === "object"
      ? (raw.scraped_data as Record<string, unknown>)
      : undefined;

  const compactRawData: MatchScoreRequestJob["raw_data"] = {};
  const rawLocation = compactText(raw?.location, MATCH_SCORE_META_LIMIT);
  if (rawLocation) {
    compactRawData.location = rawLocation;
  }

  const compactScrapedData: NonNullable<
    MatchScoreRequestJob["raw_data"]
  >["scraped_data"] = {};
  const scrapedLocation = compactText(
    scraped?.location,
    MATCH_SCORE_META_LIMIT,
  );
  const scrapedDescription = compactText(
    scraped?.description,
    MATCH_SCORE_TEXT_LIMIT,
  );
  const scrapedTags = compactStringList(scraped?.tags);
  const scrapedSkills = compactStringList(scraped?.skills);

  if (scrapedLocation) {
    compactScrapedData.location = scrapedLocation;
  }
  if (scrapedDescription) {
    compactScrapedData.description = scrapedDescription;
  }
  if (scrapedTags) {
    compactScrapedData.tags = scrapedTags;
  }
  if (scrapedSkills) {
    compactScrapedData.skills = scrapedSkills;
  }

  if (Object.keys(compactScrapedData).length > 0) {
    compactRawData.scraped_data = compactScrapedData;
  }

  return {
    id: job.id,
    title: compactText(job.title, MATCH_SCORE_META_LIMIT) || "Untitled role",
    ...(compactText(job.description, MATCH_SCORE_TEXT_LIMIT)
      ? { description: compactText(job.description, MATCH_SCORE_TEXT_LIMIT) }
      : {}),
    ...(compactText(job.location, MATCH_SCORE_META_LIMIT)
      ? { location: compactText(job.location, MATCH_SCORE_META_LIMIT) }
      : {}),
    ...(compactText(job.remote_type, MATCH_SCORE_META_LIMIT)
      ? { remote_type: compactText(job.remote_type, MATCH_SCORE_META_LIMIT) }
      : {}),
    ...(Object.keys(compactRawData).length > 0
      ? { raw_data: compactRawData }
      : {}),
  };
};

const buildMatchScoreContext = (
  context: MatchContext,
): Omit<MatchContext, "profile"> & {
  profile?: {
    job_title?: string;
    location?: string;
    goals?: string[];
  } | null;
} => ({
  searchQuery: compactText(context.searchQuery, MATCH_SCORE_META_LIMIT) || "",
  selectedLocation:
    compactText(context.selectedLocation, MATCH_SCORE_META_LIMIT) || "",
  profile: context.profile
    ? {
        ...(compactText(context.profile.job_title, MATCH_SCORE_META_LIMIT)
          ? {
              job_title: compactText(
                context.profile.job_title,
                MATCH_SCORE_META_LIMIT,
              ),
            }
          : {}),
        ...(compactText(context.profile.location, MATCH_SCORE_META_LIMIT)
          ? {
              location: compactText(
                context.profile.location,
                MATCH_SCORE_META_LIMIT,
              ),
            }
          : {}),
        ...(Array.isArray(context.profile.goals)
          ? {
              goals:
                compactStringList(context.profile.goals)?.slice(0, 10) ?? [],
            }
          : {}),
      }
    : null,
});

const fetchJobMatchInsights = async (
  jobs: Job[],
  context: MatchContext,
  enabled: boolean,
  onError?: (err: any) => void,
): Promise<Job[]> => {
  if (jobs.length === 0) return jobs;
  if (!enabled) {
    return jobs.map((job) => ({
      ...job,
      matchScore: undefined,
      matchBreakdown: undefined,
      matchSummary: undefined,
    }));
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return jobs;

    const compactJobs = jobs.map(buildMatchScoreRequestJob);
    const compactContext = buildMatchScoreContext(context);
    const results: Array<{
      id?: string;
      score?: number;
      breakdown?: MatchScoreBreakdown[];
      summary?: string;
    }> = [];

    for (
      let index = 0;
      index < compactJobs.length;
      index += MATCH_SCORE_BATCH_SIZE
    ) {
      const batch = compactJobs.slice(index, index + MATCH_SCORE_BATCH_SIZE);
      const data = await invokeProtectedFunction<{
        results?: Array<{
          id?: string;
          score?: number;
          breakdown?: MatchScoreBreakdown[];
          summary?: string;
        }>;
      }>("calculate-match-score", {
        body: {
          jobs: batch,
          context: compactContext,
        },
      });

      if (Array.isArray(data?.results)) {
        results.push(...data.results);
      }
    }

    if (!results.length) return jobs;

    // Map insights back to jobs
    const scoreMap = new Map();
    results.forEach((r: any) => {
      if (r.id) scoreMap.set(r.id, r);
    });

    return jobs.map((j) => {
      const insight = scoreMap.get(j.id);
      if (insight) {
        return {
          ...j,
          matchScore: insight.score,
          matchBreakdown: insight.breakdown,
          matchSummary: insight.summary,
        };
      }
      return j;
    });
  } catch (err) {
    console.error("fetchJobMatchInsights error:", err);
    if (onError) onError(err);
    return jobs; // Fallback to raw jobs if scoring fails
  }
};

type CoverLetterDraftData = {
  role?: string;
  company?: string;
  content?: string;
  paragraphs?: string[];
  salutation?: string;
  closing?: string;
  signatureName?: string;
  senderName?: string;
  senderEmail?: string;
  senderPhone?: string;
  senderAddress?: string;
  recipient?: string;
  recipientTitle?: string;
  recipientAddress?: string;
  date?: string;
  subject?: string;
};

type CoverLetterLibraryEntry = {
  id: string;
  name: string;
  updatedAt?: string;
  data?: CoverLetterDraftData & Record<string, unknown>;
  draft?: boolean;
};

type ApplicationDraftData = {
  resumeText: string;
  coverLetterText: string;
  sourceResumeId?: string | null;
  sourceResumeName?: string | null;
  sourceResumeUpdatedAt?: string | null;
  sourceCandidateName?: string | null;
  savedAt?: string | null;
};

const COVER_LETTER_LIBRARY_KEY = "jr.coverLetters.library.v1";
const COVER_LETTER_DEFAULT_KEY = "jr.coverLetters.defaultId";
const COVER_LETTER_DRAFT_KEY = "jr.coverLetter.draft.v2";

const supabase = createClient();

const pickString = (
  source: Record<string, unknown> | undefined,
  key: string,
): string | undefined => {
  if (!source) return undefined;
  const value = source[key];
  return typeof value === "string" ? value : undefined;
};

const normalizeIdentityText = (value?: string | null): string =>
  (value || "").trim().toLowerCase().replace(/\s+/g, " ");

const getPreferredResumeId = (
  resumes: Array<{ id: string; is_favorite?: boolean | null }> | null | undefined,
  currentSelectedResumeId?: string | null,
): string | null => {
  if (!Array.isArray(resumes) || resumes.length === 0) {
    return currentSelectedResumeId ?? null;
  }
  if (
    currentSelectedResumeId &&
    resumes.some((resume) => resume.id === currentSelectedResumeId)
  ) {
    return currentSelectedResumeId;
  }
  const favorite = resumes.find((resume) => resume.is_favorite);
  return favorite?.id ?? resumes[0]?.id ?? null;
};

const extractCandidateNameFromResumeText = (
  resumeText?: string | null,
): string | null => {
  if (!resumeText) return null;
  const blockedTerms = new Set([
    "dear hiring",
    "hiring manager",
    "curriculum vitae",
    "software engineer",
    "professional summary",
    "work experience",
  ]);
  const lines = resumeText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);

  for (const line of lines) {
    const match = line.match(/\b([A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,4})\b/);
    const candidate = match?.[1]?.trim();
    if (!candidate) continue;
    const normalized = normalizeIdentityText(candidate);
    if (
      normalized.length < 5 ||
      blockedTerms.has(normalized) ||
      /resume|summary|experience|manager|engineer/i.test(candidate)
    ) {
      continue;
    }
    return candidate;
  }

  return null;
};

const getJobApplyTarget = (job: Job): string | null => {
  const raw =
    job.raw_data && typeof job.raw_data === "object"
      ? (job.raw_data as Record<string, unknown>)
      : undefined;
  const scraped =
    raw && typeof raw.scraped_data === "object"
      ? (raw.scraped_data as Record<string, unknown>)
      : undefined;
  const candidates = [
    job.apply_url,
    pickString(raw, "sourceUrl"),
    pickString(raw, "applyUrl"),
    pickString(raw, "jobPostingUrl"),
    pickString(raw, "applicationLink"),
    pickString(raw, "job_url"),
    job.source_id,
    pickString(scraped, "apply_url"),
    pickString(scraped, "applyUrl"),
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
};

const composeCoverLetterPayload = (
  entry?: CoverLetterLibraryEntry | null,
): string | undefined => {
  if (!entry?.data) return undefined;
  const data = entry.data as Record<string, unknown>;
  const read = (key: string): string | undefined => {
    const value = data[key];
    return typeof value === "string" ? value : undefined;
  };

  const lines: string[] = [];
  const pushLine = (value?: string) => {
    if (!value) return;
    const trimmed = value.trim();
    if (trimmed.length > 0) lines.push(trimmed);
  };
  const pushSeparator = () => {
    if (lines.length > 0 && lines[lines.length - 1] !== "") lines.push("");
  };

  const senderKeys = [
    "senderName",
    "senderPhone",
    "senderEmail",
    "senderAddress",
  ];
  const senderLines: string[] = [];
  senderKeys.forEach((key) => {
    const val = read(key);
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed.length > 0) senderLines.push(trimmed);
    }
  });
  if (senderLines.length) {
    lines.push(...senderLines);
    pushSeparator();
  }

  const dateValue = read("date");
  if (dateValue) {
    const parsed = new Date(dateValue);
    const formatted = Number.isNaN(parsed.valueOf())
      ? dateValue
      : parsed.toLocaleDateString();
    pushLine(formatted);
    pushSeparator();
  }

  const recipientLines: string[] = [];
  [
    read("recipient"),
    read("recipientTitle"),
    read("company") ?? entry.data?.company,
    read("recipientAddress"),
  ].forEach((val) => {
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed.length > 0) recipientLines.push(trimmed);
    }
  });
  if (recipientLines.length) {
    lines.push(...recipientLines);
    pushSeparator();
  }

  const subject = read("subject");
  if (typeof subject === "string") {
    const trimmedSubject = subject.trim();
    if (trimmedSubject.length > 0) {
      pushLine(`Subject: ${trimmedSubject}`);
      pushSeparator();
    }
  }

  const salutation = read("salutation");
  if (typeof salutation === "string") {
    const trimmedSalutation = salutation.trim();
    if (trimmedSalutation.length > 0) {
      pushLine(trimmedSalutation);
      pushSeparator();
    }
  }

  const paragraphs = Array.isArray(data.paragraphs)
    ? (data.paragraphs as unknown[])
        .filter((p): p is string => typeof p === "string")
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
    : [];
  const body = read("content");
  if (typeof body === "string") {
    const trimmedBody = body.trim();
    if (trimmedBody.length > 0) {
      pushLine(trimmedBody);
    }
  } else if (paragraphs.length) {
    pushLine(paragraphs.join("\n\n"));
  }

  const closing = read("closing");
  if (typeof closing === "string") {
    const trimmedClosing = closing.trim();
    if (trimmedClosing.length > 0) {
      pushSeparator();
      pushLine(trimmedClosing);
    }
  }

  const signature = read("signatureName") || read("senderName");
  if (typeof signature === "string") {
    const trimmedSignature = signature.trim();
    if (trimmedSignature.length > 0) {
      pushLine(trimmedSignature);
    }
  }

  const finalText = lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return finalText || undefined;
};

const composeProfileSnapshot = (
  profile?: Profile | null,
): string | undefined => {
  if (!profile) return undefined;
  const lines: string[] = [];
  const fullName = [profile.first_name, profile.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fullName) lines.push(`Name: ${fullName}`);
  if (profile.job_title) lines.push(`Current Title: ${profile.job_title}`);
  if (profile.experience_years != null)
    lines.push(`Experience: ${profile.experience_years} years`);
  if (profile.location) lines.push(`Location: ${profile.location}`);
  if (Array.isArray(profile.goals) && profile.goals.length)
    lines.push(`Goals: ${profile.goals.join(", ")}`);
  return lines.length ? lines.join("\n") : undefined;
};

const getStoredDraftData = (
  job?: Job | null,
  sourceResumeId?: string | null,
): ApplicationDraftData | null => {
  const raw =
    job?.raw_data && typeof job.raw_data === "object"
      ? (job.raw_data as Record<string, unknown>)
      : undefined;
  const draft =
    raw?.application_draft && typeof raw.application_draft === "object"
      ? (raw.application_draft as Record<string, unknown>)
      : undefined;
  const resumeText =
    typeof draft?.resumeText === "string" ? draft.resumeText : null;
  const coverLetterText =
    typeof draft?.coverLetterText === "string" ? draft.coverLetterText : null;
  if (!resumeText || !coverLetterText) return null;
  const draftSourceResumeId =
    typeof draft?.sourceResumeId === "string" && draft.sourceResumeId.trim()
      ? draft.sourceResumeId
      : null;
  if (sourceResumeId && draftSourceResumeId !== sourceResumeId) return null;
  return {
    resumeText,
    coverLetterText,
    sourceResumeId: draftSourceResumeId,
    sourceResumeName:
      typeof draft?.sourceResumeName === "string" ? draft.sourceResumeName : null,
    sourceResumeUpdatedAt:
      typeof draft?.sourceResumeUpdatedAt === "string"
        ? draft.sourceResumeUpdatedAt
        : null,
    sourceCandidateName:
      typeof draft?.sourceCandidateName === "string"
        ? draft.sourceCandidateName
        : null,
    savedAt: typeof draft?.savedAt === "string" ? draft.savedAt : null,
  };
};

const formatSalaryRange = (job: Job): string | null => {
  const { salary_min: min, salary_max: max, salary_currency: currency } = job;
  if (!min && !max && !currency) return null;

  const symbol = (() => {
    if (!currency) return "$";
    switch (currency.toUpperCase()) {
      case "USD":
        return "$";
      case "GBP":
        return "£";
      case "EUR":
        return "€";
      default:
        return currency;
    }
  })();

  const formatValue = (value: number | null | undefined) => {
    if (value == null) return null;
    if (value >= 1000) return `${Math.round(value / 1000)}k`;
    if (value > 0 && value < 1000) return value.toString();
    return null;
  };

  const minLabel = formatValue(min ?? null);
  const maxLabel = formatValue(max ?? null);

  if (minLabel && maxLabel) return `${symbol}${minLabel}-${maxLabel}`;
  if (minLabel) return `${symbol}${minLabel}+`;
  if (maxLabel) return `Up to ${symbol}${maxLabel}`;
  return null;
};

const extractAutomationMetadata = (
  result: Awaited<ReturnType<typeof applyToJobs>> | null,
) => {
  if (!result) {
    return {
      runId: null,
      workflowId: null,
      providerStatus: null,
      recordingUrl: null,
    } as const;
  }
  const skyvern = result.skyvern ?? null;
  const runId =
    skyvern?.run?.id ??
    skyvern?.id ??
    skyvern?.run_id ??
    skyvern?.data?.id ??
    skyvern?.runId ??
    null;
  const workflowId =
    result.submitted?.workflow_id ??
    skyvern?.run?.workflow_id ??
    skyvern?.workflow_id ??
    null;
  const providerStatus =
    skyvern?.run?.status ?? skyvern?.status ?? skyvern?.state ?? null;
  const recordingUrl =
    skyvern?.run?.recording_url ??
    skyvern?.recording_url ??
    skyvern?.artifacts?.recording ??
    null;
  return {
    runId: runId ?? null,
    workflowId: workflowId ?? null,
    providerStatus: providerStatus ?? null,
    recordingUrl: recordingUrl ?? null,
  } as const;
};



const getCompanyLogoUrl = (
  companyName?: string,
  sourceUrl?: string,
): string | undefined => {
  if (!companyName) return undefined;
  try {
    const domain = new URL(
      sourceUrl ||
        `https://www.${companyName.toLowerCase().replace(/\s/g, "")}.com`,
    ).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  } catch {
    return undefined;
  }
};

// Helper to map a DB row from the `jobs` table to the frontend `Job` interface
const mapDbJobToUiJob = (dbJob: any): Job => {
  const raw = dbJob.raw_data || {};
  const insights = raw?.match_insights;
  return {
    ...dbJob,
    id: dbJob.id,
    description: dbJob.description || raw?.fullJobDescription || "",
    // Prioritize: 1) company_logo from DB, 2) raw data logo, 3) generate from Clearbit
    logoUrl: getProxiedLogoUrl(
      dbJob.company_logo ||
        raw?.companyLogoUrl ||
        getCompanyLogoUrl(dbJob.company, dbJob.apply_url),
    ),
    logo: dbJob.company?.[0]?.toUpperCase() || "?",
    status: dbJob.status,
    canonical_status: dbJob.canonical_status ?? "discovered",
    verification_status: dbJob.verification_status ?? "unverified",
    source_type: dbJob.source_type ?? null,
    source_id: dbJob.source_id ?? null,
    source_kind: dbJob.source_kind ?? null,
    source_confidence:
      typeof dbJob.source_confidence === "number"
        ? dbJob.source_confidence
        : dbJob.source_confidence != null
          ? Number(dbJob.source_confidence)
          : null,
    is_tracked_company: Boolean(dbJob.is_tracked_company),
    evaluation_summary:
      dbJob.evaluation_summary && typeof dbJob.evaluation_summary === "object"
        ? dbJob.evaluation_summary
        : null,
    matchScore:
      typeof insights?.score === "number" ? insights.score : undefined,
    matchBreakdown: Array.isArray(insights?.breakdown)
      ? insights.breakdown
      : undefined,
    matchSummary:
      typeof insights?.summary === "string" ? insights.summary : undefined,
  };
};

export const JobPage = (): JSX.Element => {
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const gamificationHook = useGamification();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("Remote");
  const [locationScope, setLocationScope] = useState<"city" | "country" | "global">("city");
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [evaluationReports, setEvaluationReports] = useState<
    Record<string, JobEvaluationReportData>
  >({});
  const [evaluationLoadingByJob, setEvaluationLoadingByJob] = useState<
    Record<string, boolean>
  >({});
  const [queueStatus, setQueueStatus] = useState<
    "idle" | "loading" | "populating" | "ready" | "empty"
  >("loading");
  const [error, setError] = useState<{ message: string; link?: string } | null>(
    null,
  );
  // Incremental run state
  const [incrementalMode, setIncrementalMode] = useState(false);
  const [insertedThisRun, setInsertedThisRun] = useState(0);
  const [currentSource, setCurrentSource] = useState<string | null>(null);
  const [lastReason, setLastReason] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [logoError, setLogoError] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [applyingAll, setApplyingAll] = useState(false);
  const [applyProgress, setApplyProgress] = useState({
    done: 0,
    total: 0,
    success: 0,
    fail: 0,
  });
  const [automationLogs, setAutomationLogs] = useState<
    Array<{
      time: string;
      message: string;
      status: "info" | "success" | "error";
    }>
  >([]);
  const [automationFinished, setAutomationFinished] = useState(false);
  const [sortBy, setSortBy] = useState<"recent" | "company" | "deadline">(
    "recent",
  );
  const [clearingJobs, setClearingJobs] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  // Resume attach dialog state
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [selectedResumeRawText, setSelectedResumeRawText] = useState("");
  const [loadingSelectedResumeText, setLoadingSelectedResumeText] =
    useState(false);
  const [autoApplyStep, setAutoApplyStep] = useState<1 | 2 | 3 | 4>(1);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [draftData, setDraftData] = useState<ApplicationDraftData | null>(null);
  const [trueAutonomyEnabled, setTrueAutonomyEnabled] = useState(true);
  const [coverLetterLibrary, setCoverLetterLibrary] = useState<
    CoverLetterLibraryEntry[]
  >([]);
  const [selectedCoverLetterId, setSelectedCoverLetterId] = useState<
    string | null
  >(null);
  const [jobToAutoApply, setJobToAutoApply] = useState<Job | null>(null);
  const [activeSearchScope, setActiveSearchScope] =
    useState<JobsQueueScope>(null);
  const { subscriptionTier, loadingTier } = useSubscriptionTier();
  const hasPaidInsightsAccess = hasSubscriptionAccess(
    subscriptionTier,
    "Basics",
  );
  const hasMatchScoreAccess = hasPaidInsightsAccess;
  const hasJobEvaluationAccess = hasPaidInsightsAccess;
  const hasAutoApplyAccess = hasSubscriptionAccess(subscriptionTier, "Free");

  // AI Decision Boundary states
  const [evaluatingJob, setEvaluatingJob] = useState(false);
  const [aiEvaluation, setAiEvaluation] =
    useState<EvaluateJobFitResponse | null>(null);
  const [forceSubmit, setForceSubmit] = useState(false);

  // Debug payload capture for in-app panel
  const [dbgSearchReq, setDbgSearchReq] = useState<any>(null);
  const [dbgSearchRes, setDbgSearchRes] = useState<any>(null);
  const backgroundEvaluationRunnerRef = useRef(false);
  const backgroundEvaluationInFlightRef = useRef<Set<string>>(new Set());
  const backgroundEvaluationFailedRef = useRef<Set<string>>(new Set());
  const jobsRef = useRef<Job[]>([]);

  const {
    profile,
    updateProfile,
    loading: profileLoading,
  } = useProfileSettings();
  // Load user resumes for selection (used by the Auto Apply -> "Choose a resume" dialog)
  const { resumes, loading: resumesLoading } = useResumes();
  const { info, error: toastError } = useToast();

  // Register walkthrough for Jobs page
  useRegisterCoachMarks({
    page: "jobs",
    marks: [
      {
        id: "jobs-search",
        selector: "#jobs-search",
        title: "Search Jobs",
        body: "Search across thousands of job postings by title, company, keywords, or skills. Results are automatically saved to your job queue.",
      },
      {
        id: "jobs-location",
        selector: "#jobs-location",
        title: "Filter by Location",
        body: 'Specify your preferred location or use "Remote" to find remote opportunities. Location filters help narrow down your search results.',
      },
      {
        id: "jobs-card",
        selector: '[data-tour="jobs-card"]',
        title: "Job Listings",
        body: "Browse AI-matched jobs with match scores. Click any card to see full details, company info, salary range, and apply directly. Use the resume checker dropdown to analyze job compatibility.",
      },
      {
        id: "jobs-ai-match",
        selector: "#jobs-ai-match",
        title: "AI Match Score",
        body: "Our AI analyzes each job against your profile and resume to show compatibility and fit. View detailed breakdowns of match factors including skills, experience, and location preferences.",
      },
    ],
  });

  // Toast dedupe/throttle: avoid spamming repeated toasts
  const lastToastRef = useRef<{ msg: string; ts: number } | null>(null);
  const safeInfo = useCallback(
    (msg: string, desc?: string, cooldownMs: number = 20000) => {
      const now = Date.now();
      const last = lastToastRef.current;
      if (
        last &&
        last.msg === (desc ? `${msg}::${desc}` : msg) &&
        now - last.ts < cooldownMs
      ) {
        return; // suppress duplicate within cooldown window
      }
      info(msg, desc);
      lastToastRef.current = { msg: desc ? `${msg}::${desc}` : msg, ts: now };
    },
    [info],
  );
  // Error dedupe to avoid flicker and repeated inline banners
  const lastErrorRef = useRef<{ msg: string; ts: number } | null>(null);
  const setErrorDedup = useCallback(
    (
      payload: { message: string; link?: string } | null,
      cooldownMs: number = 15000,
    ) => {
      if (!payload) {
        setError(null);
        return;
      }
      const now = Date.now();
      const last = lastErrorRef.current;
      const key = payload.link
        ? `${payload.message}::${payload.link}`
        : payload.message;
      if (last && last.msg === key && now - last.ts < cooldownMs) return;
      setError(payload);
      lastErrorRef.current = { msg: key, ts: now };
    },
    [],
  );

  // Guard flags to prevent overlapping runs/requests
  const matchInsightSignaturesRef = useRef<Map<string, string>>(new Map());
  // Removed per-URL incremental loop; keep a simple flag if needed in future
  // const startInFlightRef = useRef(false);

  // Step-by-step loading banner
  const LoadingBanner = ({
    subtitle,
    steps,
    activeStep,
    onCancel,
    foundCount,
  }: {
    subtitle?: string;
    steps: string[];
    activeStep: number;
    onCancel?: () => void;
    foundCount?: number;
  }) => (
    <Card className='relative overflow-hidden bg-gradient-to-br from-foreground/10 via-foreground/5 to-foreground/0  border border-[#2dd4bf]/30 p-4 sm:p-5 mb-4'>
      <motion.div
        className='pointer-events-none absolute -inset-24 opacity-30'
        style={{
          background:
            "radial-gradient(600px 200px at 20% -10%, rgba(45,212,191,0.25), rgba(45,212,191,0) 60%)",
        }}
        initial={{ opacity: 0.15 }}
        animate={{ opacity: [0.15, 0.3, 0.15] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className='flex items-center gap-3'>
        <div className='relative w-6 h-6'>
          <span className='absolute inset-0 rounded-full bg-[#2dd4bf] opacity-70' />
          <motion.span
            className='absolute inset-0 rounded-full bg-[#2dd4bf]'
            initial={{ scale: 0.9, opacity: 0.75 }}
            animate={{ scale: [0.9, 1.25, 0.9], opacity: [0.75, 0.15, 0.75] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <div className='flex-1 min-w-0'>
          <div className='text-foreground font-medium flex items-center gap-2'>
            <span>Building your results…</span>
            {typeof foundCount === "number" && foundCount > 0 && (
              <motion.span
                key={foundCount}
                initial={{ scale: 0.9, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                className='text-[11px] px-2 py-0.5 rounded-full border border-[#2dd4bf]/40 text-[#2dd4bf] bg-foreground/10'
              >
                Found {foundCount}
              </motion.span>
            )}
          </div>
          <div className='text-xs text-foreground/70'>
            {subtitle || "This may take a few minutes depending on sources."}
          </div>
        </div>
        {onCancel && (
          <Button
            variant='ghost'
            className='text-foreground/70 hover:bg-foreground/12 border border-foreground/1e h-8 px-3'
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
      </div>

      <div className='mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 relative'>
        {steps.map((label, idx) => {
          const isActive = idx === activeStep;
          const isCompleted = idx < activeStep;
          return (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`relative flex items-center gap-2 rounded-lg border p-2.5 transition-all duration-300 ${
                isActive
                  ? "border-[#2dd4bf] bg-[#2dd4bf]/10 shadow-[0_0_15px_rgba(45,212,191,0.2)]"
                  : isCompleted
                    ? "border-[#2dd4bf]/50 bg-[#2dd4bf]/5"
                    : "border-foreground/10 bg-foreground/5"
              }`}
            >
              <div className='relative flex-shrink-0'>
                {isCompleted ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    className='w-4 h-4 rounded-full bg-[#2dd4bf] flex items-center justify-center'
                  >
                    <svg
                      className='w-2.5 h-2.5 text-black'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        d='M5 13l4 4L19 7'
                      />
                    </svg>
                  </motion.div>
                ) : isActive ? (
                  <motion.div
                    className='w-4 h-4 rounded-full bg-[#2dd4bf]'
                    animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                ) : (
                  <div className='w-4 h-4 rounded-full border-2 border-foreground/20' />
                )}
              </div>
              <div
                className={`text-[11px] sm:text-xs truncate font-medium ${isActive ? "text-[#ccfbf1]" : isCompleted ? "text-[#2dd4bf]/80" : "text-foreground/60"}`}
              >
                {label}
              </div>
              {isActive && (
                <motion.span
                  layoutId='activeStepGlow'
                  className='absolute inset-0 rounded-lg pointer-events-none'
                  style={{ boxShadow: "0 0 20px rgba(45,212,191,0.25) inset" }}
                />
              )}
            </motion.div>
          );
        })}
      </div>

      <div className='mt-4 space-y-1.5'>
        <div className='flex items-center justify-between text-[10px] text-foreground/70'>
          <span>Progress</span>
          <span>{Math.round((activeStep / (steps.length - 1)) * 100)}%</span>
        </div>
        <div className='h-2 bg-foreground/10 rounded-full overflow-hidden border border-[#2dd4bf]/20 relative'>
          <motion.div
            className='absolute inset-0 opacity-20'
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(45,212,191,0.4) 50%, transparent 100%)",
            }}
            animate={{ x: ["-100%", "200%"] }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          />
          <motion.div
            className='h-full bg-gradient-to-r from-[#22d3ee]/60 via-[#2dd4bf] to-[#0d9488]/60 relative'
            initial={{ width: "0%" }}
            animate={{ width: `${(activeStep / (steps.length - 1)) * 100}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <motion.div
              className='absolute inset-0 opacity-50'
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)",
              }}
              animate={{ x: ["-100%", "200%"] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            />
          </motion.div>
        </div>
      </div>
    </Card>
  );

  // Patience Banner for low result scenarios
  const PatienceBanner = ({
    count,
    isSearching,
  }: {
    count: number;
    isSearching: boolean;
  }) => (
    <Card className='relative overflow-hidden bg-gradient-to-br from-[#22d3ee]/5 via-background to-background  border border-[#2dd4bf]/20 p-5 mb-6 rounded-2xl'>
      <motion.div
        className='absolute inset-0 opacity-20'
        animate={{
          background: [
            "radial-gradient(400px at 0% 0%, rgba(45,212,191,0.15) 0%, transparent 100%)",
            "radial-gradient(400px at 100% 100%, rgba(45,212,191,0.15) 0%, transparent 100%)",
            "radial-gradient(400px at 0% 0%, rgba(45,212,191,0.15) 0%, transparent 100%)",
          ],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
      />
      <div className='relative z-10 flex flex-col sm:flex-row items-center gap-4'>
        <div className='flex-shrink-0 w-12 h-12 rounded-full bg-[#2dd4bf]/10 flex items-center justify-center border border-[#2dd4bf]/20'>
          {isSearching ? (
            <Loader2 className='w-6 h-6 text-[#2dd4bf] animate-spin' />
          ) : (
            <Sparkles className='w-6 h-6 text-[#2dd4bf]' />
          )}
        </div>
        <div className='flex-1 text-center sm:text-left'>
          <h3 className='text-lg font-bold text-foreground'>
            {count === 0
              ? "Scouring the web for matches..."
              : "Gathering even more roles for you..."}
          </h3>
          <p className='text-sm text-foreground/60 max-w-lg'>
            Our AI is currently exploring premium job boards and verified
            sources. Stay patient—we're enriching your feed with the highest
            quality matches in the background.
          </p>
        </div>
        {isSearching && (
          <div className='flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#2dd4bf]/10 border border-[#2dd4bf]/20 text-[10px] font-bold uppercase tracking-wider text-[#2dd4bf] animate-pulse'>
            Deep Search Active
          </div>
        )}
      </div>
    </Card>
  );

  const [stepIndex, setStepIndex] = useState(0);
  const steps = useMemo(
    () => ["Searching Web", "Saving Results", "Finalizing List"],
    [],
  );
  const autoApplySteps = useMemo(
    () => [
      {
        id: 1 as const,
        label: "Select resume",
        description: "Choose the target profile.",
      },
      {
        id: 2 as const,
        label: "Review & launch",
        description: "Confirm scope and safeguards.",
      },
      {
        id: 3 as const,
        label: "Execution",
        description: "Monitor live telemetry.",
      },
    ],
    [],
  );
  const selectedResume = useMemo(() => {
    if (!Array.isArray(resumes)) return null;
    return resumes.find((r: any) => r.id === selectedResumeId) ?? null;
  }, [resumes, selectedResumeId]);
  const selectedResumeName = useMemo(() => {
    const name =
      typeof (selectedResume as any)?.name === "string"
        ? (selectedResume as any).name.trim()
        : "";
    return name || "Selected resume";
  }, [selectedResume]);
  const profileFullName = useMemo(() => {
    const fullName = [profile?.first_name, profile?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    return fullName || null;
  }, [profile]);
  const selectedCoverLetter = useMemo(() => {
    if (!Array.isArray(coverLetterLibrary) || !coverLetterLibrary.length)
      return null;
    return (
      coverLetterLibrary.find((entry) => entry.id === selectedCoverLetterId) ??
      null
    );
  }, [coverLetterLibrary, selectedCoverLetterId]);
  const activeResumeText = useMemo(
    () => selectedResumeRawText || (selectedResume as any)?.raw_text || "",
    [selectedResume, selectedResumeRawText],
  );
  const selectedResumeCandidateName = useMemo(() => {
    const basicsName =
      typeof (selectedResume as any)?.data?.basics?.name === "string"
        ? (selectedResume as any).data.basics.name.trim()
        : "";
    if (basicsName) return basicsName;
    return extractCandidateNameFromResumeText(activeResumeText);
  }, [activeResumeText, selectedResume]);
  const resumeIdentityMismatch = useMemo(() => {
    if (!selectedResumeCandidateName || !profileFullName) return false;
    return (
      normalizeIdentityText(selectedResumeCandidateName) !==
      normalizeIdentityText(profileFullName)
    );
  }, [profileFullName, selectedResumeCandidateName]);
  const selectedJobRecord = useMemo(
    () => jobs.find((job) => job.id === selectedJob) ?? null,
    [jobs, selectedJob],
  );
  const savedStoryTitles = useMemo(
    () =>
      Array.isArray(profile?.story_bank)
        ? profile.story_bank
            .map((story) => story?.title?.trim())
            .filter((title): title is string => Boolean(title))
        : [],
    [profile?.story_bank],
  );
  const matchContext = useMemo<MatchContext>(
    () => ({
      searchQuery,
      selectedLocation,
      profile,
    }),
    [searchQuery, selectedLocation, profile],
  );

  const decorateJobsRef = useRef<(list: Job[]) => Promise<Job[]>>(
    async (list) => list,
  );
  const activeSearchScopeRef = useRef<JobQueueScope>(null);

  const decorateJobs = useCallback(
    async (list: Job[]) =>
      await fetchJobMatchInsights(
        list,
        matchContext,
        hasMatchScoreAccess && !applyingAll,
        () => {
          toastError(
            "Match Insights Failed",
            "Could not fetch AI match scores. Showing basic results.",
          );
        },
      ),
    [applyingAll, hasMatchScoreAccess, matchContext, toastError],
  );

  useEffect(() => {
    decorateJobsRef.current = decorateJobs;
  }, [decorateJobs]);

  useEffect(() => {
    activeSearchScopeRef.current = activeSearchScope;
  }, [activeSearchScope]);

  const {
    data: queriedJobs = [],
    error: jobsQueryError,
    isPending: jobsQueryPending,
    isFetched: jobsQueryFetched,
  } = useJobsQueue<Job>({
    scope: activeSearchScope,
    enabled: !profileLoading && !incrementalMode,
    mapJob: mapDbJobToUiJob,
    decorateJobs,
  });

  useEffect(() => {
    if (profileLoading) {
      setQueueStatus("loading");
      return;
    }

    if (incrementalMode) {
      return;
    }

    if (jobsQueryPending && !jobsQueryFetched) {
      setQueueStatus("loading");
      return;
    }

    if (jobsQueryError) {
      setJobs([]);
      setSelectedJob(null);
      setErrorDedup({
        message: (jobsQueryError as any)?.message || "Failed to load jobs.",
      });
      setQueueStatus("idle");
      return;
    }

    if (!jobsQueryFetched) {
      return;
    }

    setError(null);
    setJobs(queriedJobs);

    if (queriedJobs.length > 0) {
      setQueueStatus("ready");
      setSelectedJob((prev) => {
        if (prev && queriedJobs.some((job) => job.id === prev)) return prev;
        if (isMobile) return null;
        return queriedJobs[0].id;
      });
    } else {
      setSelectedJob(null);
      setQueueStatus("empty");
    }
  }, [
    incrementalMode,
    isMobile,
    jobsQueryError,
    jobsQueryFetched,
    jobsQueryPending,
    profileLoading,
    queriedJobs,
    setErrorDedup,
  ]);

  // Re-decorate jobs when context changes
  useEffect(() => {
    let active = true;
    const redecorate = async () => {
      if (jobs.length === 0) return;
      const decorated = await decorateJobs(jobs);
      if (active) setJobs(decorated);
    };
    redecorate();
    return () => {
      active = false;
    };
  }, [decorateJobs]); // Note: jobs is intentionally omitted to avoid infinite loop

  // Check admin status
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { isCurrentUserAdmin } = await import("@/lib/adminUtils");
        const admin = await isCurrentUserAdmin();
        setIsAdmin(admin);
      } catch (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, []);

  const profileSnapshot = useMemo(
    () => composeProfileSnapshot(profile),
    [profile],
  );
  const profileReady = Boolean(profileSnapshot);
  useEffect(() => {
    if (selectedResumeId) return;
    if (!Array.isArray(resumes) || resumes.length === 0) return;
    setSelectedResumeId(getPreferredResumeId(resumes, null));
  }, [resumes, selectedResumeId]);

  useEffect(() => {
    let active = true;

    const loadResumeText = async () => {
      if (!selectedResumeId) {
        if (active) setSelectedResumeRawText("");
        if (active) setLoadingSelectedResumeText(false);
        return;
      }

      if (typeof (selectedResume as any)?.raw_text === "string") {
        if (active) {
          setSelectedResumeRawText((selectedResume as any).raw_text);
          setLoadingSelectedResumeText(false);
        }
        return;
      }

      try {
        if (active) setLoadingSelectedResumeText(true);
        const rawText = await loadParsedResumeText({
          supabase,
          resumeId: selectedResumeId,
          filePath: (selectedResume as any)?.file_path,
          fileExt: (selectedResume as any)?.file_ext,
        });

        if (active) {
          setSelectedResumeRawText(rawText);
        }
      } catch (error) {
        console.error("load parsed resume text failed", error);
        if (active) setSelectedResumeRawText("");
      } finally {
        if (active) setLoadingSelectedResumeText(false);
      }
    };

    loadResumeText();
    return () => {
      active = false;
    };
  }, [selectedResume, selectedResumeId]);

  const resumeLibraryReady = useMemo(
    () =>
      Array.isArray(resumes) &&
      resumes.some((rec: any) => Boolean(rec?.file_path)),
    [resumes],
  );
  const getHost = (url?: string | null) => {
    if (!url) return "";
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  };

  const loadCoverLetterLibrary = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(COVER_LETTER_LIBRARY_KEY);
      let entries: CoverLetterLibraryEntry[] = [];
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          entries = parsed.filter((item): item is CoverLetterLibraryEntry =>
            Boolean(item && typeof item.id === "string"),
          );
        }
      }
      if (!entries.length) {
        const draftRaw =
          window.localStorage.getItem(COVER_LETTER_DRAFT_KEY) ||
          window.localStorage.getItem("jr.coverLetter.draft.v1");
        if (draftRaw) {
          try {
            const parsedDraft = JSON.parse(draftRaw);
            const draftName =
              String(
                parsedDraft?.subject ||
                  parsedDraft?.role ||
                  "Latest cover letter",
              ).trim() || "Latest cover letter";
            const draftUpdatedAt =
              parsedDraft?.savedAt || new Date().toISOString();
            entries = [
              {
                id: "__draft__",
                name: draftName,
                updatedAt: draftUpdatedAt,
                data: {
                  role: parsedDraft?.role,
                  company: parsedDraft?.company,
                },
                draft: true,
              },
            ];
          } catch {
            // ignore malformed drafts
          }
        }
      }
      setCoverLetterLibrary(entries);
      setSelectedCoverLetterId((prev) => {
        if (prev && entries.some((entry) => entry.id === prev)) return prev;
        const defaultId = window.localStorage.getItem(COVER_LETTER_DEFAULT_KEY);
        if (defaultId && entries.some((entry) => entry.id === defaultId))
          return defaultId;
        return entries.length ? entries[0].id : null;
      });
    } catch {
      setCoverLetterLibrary([]);
      setSelectedCoverLetterId(null);
    }
  }, []);

  // Real step updates occur at key phases of the flow; no cycling needed now.

  // Steps reflect phases; no cancel/try-different actions per request

  const loadJobEvaluationReport = useCallback(
    async (jobId: string, force = false) => {
      if (!jobId) return null;
      if (!hasJobEvaluationAccess) return null;
      if (!force && evaluationReports[jobId]) return evaluationReports[jobId];
      if (!force && evaluationLoadingByJob[jobId]) return null;

      setEvaluationLoadingByJob((prev) => ({ ...prev, [jobId]: true }));
      try {
        const report = await fetchJobEvaluationReport(jobId);
        if (report) {
          setEvaluationReports((prev) => ({ ...prev, [jobId]: report }));
        }
        return report;
      } catch (error) {
        console.error("loadJobEvaluationReport failed", error);
        return null;
      } finally {
        setEvaluationLoadingByJob((prev) => ({ ...prev, [jobId]: false }));
      }
    },
    [evaluationLoadingByJob, evaluationReports, hasJobEvaluationAccess],
  );

  const buildEvaluationSummary = useCallback(
    (evaluation: EvaluateJobFitResponse) => ({
      evaluation_id: evaluation.evaluation_id ?? null,
      archetype: evaluation.archetype,
      canonical_decision: evaluation.canonical_decision,
      confidence_score: evaluation.confidence_score,
      blockers: evaluation.blockers,
      exact_fit_evidence: evaluation.exact_fit_evidence,
      matched_keywords: evaluation.matched_keywords,
    }),
    [],
  );

  const mergeEvaluationIntoState = useCallback(
    (jobId: string, evaluation: EvaluateJobFitResponse) => {
      const summary = buildEvaluationSummary(evaluation);

      setEvaluationReports((prev) => ({
        ...prev,
        [jobId]: {
          ...evaluation,
          candidate_memory: prev[jobId]?.candidate_memory ?? null,
        },
      }));

      setJobs((prev) =>
        prev.map((row) =>
          row.id === jobId
            ? {
                ...row,
                canonical_status:
                  row.canonical_status === "draft_ready"
                    ? "draft_ready"
                    : "evaluated",
                evaluation_summary: summary,
              }
            : row,
        ),
      );

      setJobToAutoApply((prev) =>
        prev && prev.id === jobId
          ? {
              ...prev,
              canonical_status:
                prev.canonical_status === "draft_ready"
                  ? "draft_ready"
                  : "evaluated",
              evaluation_summary: summary,
            }
          : prev,
      );
    },
    [buildEvaluationSummary],
  );

  useEffect(() => {
    if (!hasJobEvaluationAccess) return;
    if (!selectedJobRecord?.id) return;
    const status = selectedJobRecord.canonical_status;
    const shouldLoad =
      status === "evaluated" ||
      status === "draft_ready" ||
      status === "queued" ||
      status === "submitted" ||
      Boolean(selectedJobRecord.evaluation_summary?.evaluation_id);

    if (!shouldLoad) return;
    void loadJobEvaluationReport(selectedJobRecord.id);
  }, [hasJobEvaluationAccess, loadJobEvaluationReport, selectedJobRecord]);

  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  const saveInterviewStoryToMemory = useCallback(
    async (story: JobEvaluationReportData["interview_stories"][number]) => {
      const existingStories = Array.isArray(profile?.story_bank)
        ? profile.story_bank
        : [];
      const alreadySaved = existingStories.some(
        (item) =>
          item?.title?.trim().toLowerCase() ===
          story.title.trim().toLowerCase(),
      );

      if (alreadySaved) {
        safeInfo("Story already saved", story.title);
        return;
      }

      const nextStories = [
        ...existingStories,
        {
          title: story.title,
          situation:
            story.talking_points.length > 0
              ? `${story.reason}\n- ${story.talking_points.join("\n- ")}`
              : story.reason,
          outcome: story.talking_points[story.talking_points.length - 1] || "",
          relevance: story.reason,
        },
      ];

      await updateProfile({
        story_bank: nextStories,
      } as any);
      safeInfo("Story saved to memory", story.title);
    },
    [profile?.story_bank, safeInfo, updateProfile],
  );

  const fetchJobQueue = useCallback(
    async (
      scope: JobQueueScope = activeSearchScopeRef.current,
    ): Promise<Job[]> => {
      const nextScope = scope ?? null;
      activeSearchScopeRef.current = nextScope;
      setActiveSearchScope(nextScope);
      setError(null);

      if (!incrementalMode) {
        setQueueStatus("loading");
      }
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setJobs([]);
        setSelectedJob(null);
        setQueueStatus("empty");
        return [];
      }

      let queryBuilder = supabase
        .from("jobs")
        .select("*")
        .eq("user_id", user.id)
        .eq("hidden", false)
        .in("canonical_status", [
          "discovered",
          "evaluated",
          "draft_ready",
          "failed",
        ]);

      const scopedSearchQuery = scope?.searchQuery?.trim();
      const scopedLocation = scope?.location?.trim();
      if (scopedSearchQuery) {
        const discoveryScope: Record<string, string> = {
          search_query: scopedSearchQuery,
        };
        if (scopedLocation) {
          discoveryScope.location = scopedLocation;
        }

        queryBuilder = queryBuilder
          .contains("raw_data", { discovery: discoveryScope })
          .order("discovered_at", { ascending: false })
          .order("created_at", { ascending: false });

        if (typeof scope?.limit === "number" && scope.limit > 0) {
          queryBuilder = queryBuilder.limit(scope.limit);
        }
      } else {
        queryBuilder = queryBuilder.order("created_at", { ascending: false });
      }

      const { data, error: fetchError } = await queryBuilder;

      if (fetchError) throw fetchError;

      const jobList = (data || []).map(mapDbJobToUiJob);
      const decorated = await decorateJobsRef.current(jobList);
      setJobs(decorated);

      if (decorated.length > 0) {
        setQueueStatus("ready");
        setSelectedJob((prev) => {
          if (prev && decorated.some((job) => job.id === prev)) return prev;
          // On mobile the detail view is a full-screen sheet — don't auto-open it
          // after a search/load action. Users tap a card to open it intentionally.
          if (isMobile) return null;
          return decorated[0].id;
        });
      } else {
        setSelectedJob(null);
        setQueueStatus("empty");
      }

      return decorated;
    } catch (e: any) {
      setJobs([]);
      setSelectedJob(null);
      setError({ message: e.message || "Failed to load jobs." });
      setQueueStatus("idle");
      return [];
    }
  }, [incrementalMode, isMobile]);

  const runBackgroundEvaluations = useCallback(async () => {
    if (backgroundEvaluationRunnerRef.current || !hasJobEvaluationAccess) return;

    backgroundEvaluationRunnerRef.current = true;
    try {
      while (true) {
        const nextJob = jobsRef.current.find((job) => {
          const needsEvaluation =
            job.canonical_status === "discovered" &&
            !job.evaluation_summary?.evaluation_id;
          const hasDescription =
            typeof job.description === "string" &&
            job.description.trim().length > 0;

          return (
            needsEvaluation &&
            hasDescription &&
            !backgroundEvaluationInFlightRef.current.has(job.id) &&
            !backgroundEvaluationFailedRef.current.has(job.id)
          );
        });

        if (!nextJob) {
          break;
        }

        backgroundEvaluationInFlightRef.current.add(nextJob.id);
        setEvaluationLoadingByJob((prev) => ({ ...prev, [nextJob.id]: true }));

        try {
          const evaluation = await evaluateJobFit(
            nextJob.id,
            nextJob.title,
            nextJob.company,
            nextJob.description || "",
            profileSnapshot || "No profile provided.",
            activeResumeText || "No resume content provided.",
          );

          backgroundEvaluationFailedRef.current.delete(nextJob.id);
          mergeEvaluationIntoState(nextJob.id, evaluation);
        } catch (error) {
          backgroundEvaluationFailedRef.current.add(nextJob.id);
          console.error("background job evaluation failed", {
            jobId: nextJob.id,
            error,
          });
        } finally {
          backgroundEvaluationInFlightRef.current.delete(nextJob.id);
          setEvaluationLoadingByJob((prev) => {
            if (!(nextJob.id in prev)) return prev;
            const next = { ...prev };
            delete next[nextJob.id];
            return next;
          });
        }
      }
    } finally {
      backgroundEvaluationRunnerRef.current = false;
    }
  }, [
    activeResumeText,
    hasJobEvaluationAccess,
    mergeEvaluationIntoState,
    profileSnapshot,
  ]);

  useEffect(() => {
    void runBackgroundEvaluations();
  }, [jobs, runBackgroundEvaluations]);

  const executeClearAllJobs = useCallback(async () => {
    setConfirmDeleteOpen(false);
    setClearingJobs(true);
    setError(null);
    activeSearchScopeRef.current = null;
    setActiveSearchScope(null);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      if (!userId) {
        throw new Error("User not authenticated");
      }

      // Delete all jobs for the current user
      const { error: deleteError } = await supabase
        .from("jobs")
        .delete()
        .eq("user_id", userId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      // Clear the UI state
      setJobs([]);
      setSelectedJob(null);
      setQueueStatus("empty");
      setCurrentPage(1);
      await queryClient.invalidateQueries({ queryKey: jobsQueueKeys.all });

      safeInfo(
        "All jobs cleared",
        "Successfully deleted all jobs from your list.",
      );
    } catch (e: any) {
      setErrorDedup({ message: `Failed to clear jobs: ${e.message}` });
    } finally {
      setClearingJobs(false);
    }
  }, [queryClient, safeInfo, setErrorDedup, supabase]);

  const populateQueue = useCallback(
    async (query: string, _location?: string) => {
      // Prevent re-entry if a run is active
      if (incrementalMode) return;
      if (!query || !query.trim()) {
        setError({
          message: "Please enter a job title or keywords to search.",
        });
        return;
      }
      setQueueStatus("populating");
      setError(null);
      setLastReason(null);
      setStepIndex(0); // Step 0: Searching Web
      setIncrementalMode(true);
      setInsertedThisRun(0);
      backgroundEvaluationFailedRef.current.clear();

      try {
        // Determine max results per search based on subscription tier
        // No monthly limits - users can search as many times as they want
        let maxResultsPerSearch = 10; // Free tier

        if (subscriptionTier === "Ultimate") {
          maxResultsPerSearch = 100;
        } else if (subscriptionTier === "Pro") {
          maxResultsPerSearch = 50;
        } else if (subscriptionTier === "Basics") {
          maxResultsPerSearch = 20;
        }

        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id;

        if (userId) {
          const { data: creditCheck, error: checkError } = await supabase.rpc(
            "check_credits_available",
            {
              p_user_id: userId,
              p_feature_type: "job_search",
              p_quantity: maxResultsPerSearch,
            },
          );

          if (checkError) {
            setError({
              message: "Failed to verify credits. Please try again.",
              link: "/dashboard/billing",
            });
            setQueueStatus("idle");
            setIncrementalMode(false);
            return;
          }

          if (!creditCheck?.available) {
            setError({
              message: `Insufficient credits. Job search requires ${creditCheck?.required} credits but you only have ${creditCheck?.current_balance}.`,
              link: "/dashboard/billing",
            });
            safeInfo(
              "Not enough credits",
              "Upgrade or purchase credits to use job search.",
            );
            setQueueStatus("idle");
            setIncrementalMode(false);
            return;
          }
        } else {
          setError({ message: "User not authenticated. Please login again." });
          setQueueStatus("idle");
          setIncrementalMode(false);
          return;
        }

        // Use backend jobs-search to discover and save jobs directly
        safeInfo("Searching the web for jobs...");
        const currentSearchScope: JobQueueScope = {
          searchQuery: query.trim(),
          location: (selectedLocation || "Remote").trim() || "Remote",
          limit: maxResultsPerSearch,
        };
        const searchPayload = {
          searchQuery: query,
          location: currentSearchScope.location,
          locationScope,
          limit: maxResultsPerSearch, // Use tier-based result limit per search
        };
        const attemptInvoke = async (): Promise<any> => {
          if (debugMode)
            console.log("[debug] jobs-search request", searchPayload);
          setDbgSearchReq(searchPayload);

          const result = (await Promise.race([
            supabase.functions.invoke("jobs-search", {
              body: searchPayload,
            }),
            new Promise<never>((_, reject) =>
              setTimeout(
                () =>
                  reject(new Error("Job search timed out. Please try again.")),
                120000,
                ),
              ),
            ])) as {
            data: any;
            error?: { message?: string } | null;
          };

          const { data, error: invokeErr } = result;
          if (invokeErr)
            throw new Error(invokeErr.message || "Job search failed.");
          if (debugMode) console.log("[debug] jobs-search response", data);
          setDbgSearchRes(data);
          return data;
        };

        // Start background polling to show incremental results
        let isSearchActive = true;
        const pollInterval = window.setInterval(async () => {
          if (!isSearchActive) {
            window.clearInterval(pollInterval);
            return;
          }
          try {
            const currentJobs = await fetchJobQueue(currentSearchScope);
            if (currentJobs.length > 0) {
              setInsertedThisRun(currentJobs.length);
            }
          } catch (err) {
            console.warn("[poll] incremental fetch failed", err);
          }
        }, 3000);

        let searchData;
        try {
          searchData = await attemptInvoke();
        } finally {
          isSearchActive = false;
          window.clearInterval(pollInterval);
        }
        if (searchData?.error === "rate_limited") {
          const retrySec = Math.max(
            10,
            Math.min(120, Number(searchData?.retryAfterSeconds || 55)),
          );
          setErrorDedup({
            message: `Rate limited by Firecrawl. Retrying in ${retrySec}s…`,
          });
          await new Promise((r) => setTimeout(r, retrySec * 1000));
          searchData = await attemptInvoke();
        }

        if (searchData?.error) {
          activeSearchScopeRef.current = null;
          setActiveSearchScope(null);
          if (searchData.error === "missing_api_key") {
            setErrorDedup({
              message:
                "Firecrawl is not configured. Ask your admin to set FIRECRAWL_API_KEY in Supabase Function Secrets.",
            });
          } else if (searchData.error === "rate_limited") {
            setErrorDedup({
              message: "Rate limited by Firecrawl. Please try again shortly.",
            });
          } else {
            const detail = searchData.detail || "An unknown error occurred.";
            setErrorDedup({ message: `Failed to search: ${detail}` });
          }

          const cachedJobs = await fetchJobQueue(null);
          safeInfo(
            "Search fallback",
            cachedJobs.length > 0
              ? "Showing your recently saved jobs instead due to search failure."
              : "Search failed and no saved jobs were available.",
          );
          setIncrementalMode(false);
          setCurrentSource(null);
          return;
        }

        // Jobs are now saved directly by jobs-search function
        // Try different possible response structures
        const inserted =
          searchData?.jobsInserted ||
          searchData?.inserted ||
          searchData?.count ||
          searchData?.jobs?.length ||
          0;

        if (userId && inserted > 0) {
          const { data: deductResult, error: deductError } = await supabase.rpc(
            "deduct_job_search_credits",
            {
              p_user_id: userId,
              p_jobs_count: inserted,
            },
          );

          if (deductError) {
            console.error("Failed to deduct job search credits:", deductError);
            toastError("Credit Deduction Failed", deductError.message);
            toastError("Credit Deduction Failed", deductError.message);
            safeInfo(
              "Credit deduction failed",
              "There was an issue processing your credits.",
            );
          } else if (deductResult && !deductResult.success) {
            console.warn("Credit deduction failed:", deductResult.message);
            safeInfo("Credit deduction failed", deductResult.message);
          } else if (deductResult?.success) {
            safeInfo(
              "Credits deducted",
              `Used ${deductResult.credits_deducted} credits. ${deductResult.remaining_balance} remaining.`,
            );
          }
        }

        setStepIndex(1); // Stage 1: Saving Results
        setInsertedThisRun(inserted);
        activeSearchScopeRef.current = currentSearchScope;
        setActiveSearchScope(currentSearchScope);

        // Transition to Finalizing
        if (inserted > 0) {
          // Poll for results if we know we inserted some, but fetch returns empty
          let currentJobs = await fetchJobQueue(currentSearchScope);
          if (currentJobs.length === 0) {
            // Wait 1.5s and retry once
            await new Promise((r) => setTimeout(r, 1500));
            currentJobs = await fetchJobQueue(currentSearchScope);
          }
        } else {
          setJobs([]);
          setSelectedJob(null);
          setCurrentPage(1);
          setQueueStatus("empty");
        }

        setStepIndex(2); // Stage 2: Finalizing List
        // Brief pause for visual closure
        await new Promise((r) => setTimeout(r, 800));

        setIncrementalMode(false);
        safeInfo(
          "Job search complete!",
          inserted > 0
            ? `Found and saved ${inserted} jobs. Evaluations are running in the background.`
            : "No jobs found for this search.",
        );

        // Display any warnings from the search (e.g. broadened location, searched beyond sources)
        const searchWarnings: string[] = searchData?.warnings || [];
        for (const warning of searchWarnings) {
          safeInfo("Search note", warning, 2000);
        }

        setCurrentSource(null);
      } catch (e: any) {
        activeSearchScopeRef.current = null;
        setActiveSearchScope(null);
        const fallbackJobs = await fetchJobQueue(null);
        setError({ message: `Failed to search jobs: ${e.message}` });
        if (fallbackJobs.length === 0) {
          setQueueStatus("idle");
        }
        setCurrentSource(null);
        setIncrementalMode(false);
      }
    },
    [
      supabase,
      debugMode,
      incrementalMode,
      fetchJobQueue,
      safeInfo,
      setErrorDedup,
      selectedLocation,
      subscriptionTier,
      info,
    ],
  );

  // Removed old process-and-match and polling logic - jobs are now saved directly

  const cancelPopulation = useCallback(() => {
    setIncrementalMode(false);
    setQueueStatus(jobs.length > 0 ? "ready" : "empty");
    setCurrentSource(null);
  }, [jobs.length]);

  const openAutoApplyFlow = useCallback((targetJob: Job | null = jobToAutoApply ?? null) => {
    setAiEvaluation(null);
    setForceSubmit(false);
    setJobToAutoApply(targetJob);
    const preferredResumeId = getPreferredResumeId(
      Array.isArray(resumes) ? resumes : [],
      selectedResumeId,
    );
    const existingDraft = getStoredDraftData(targetJob, preferredResumeId);
    const hasStoredDraft = Boolean(getStoredDraftData(targetJob));
    if (hasStoredDraft && !existingDraft && preferredResumeId) {
      safeInfo(
        "Draft reset",
        "Saved draft belongs to a different resume, so a fresh draft will be generated.",
      );
    }
    setSelectedResumeId(preferredResumeId);
    setDraftData(existingDraft);
    setAutoApplyStep(existingDraft ? 4 : 1);
    if (!hasAutoApplyAccess) {
      setResumeDialogOpen(true);
      return;
    }
    setResumeDialogOpen(true);
    loadCoverLetterLibrary();
  }, [
    hasAutoApplyAccess,
    jobToAutoApply,
    loadCoverLetterLibrary,
    resumes,
    safeInfo,
    selectedResumeId,
  ]);

  /** Deep link from Applications: `/dashboard/jobs?autoApplyJobId=<uuid>` opens auto-apply for that queued job. */
  const autoApplyDeepLinkConsumed = useRef<string | null>(null);
  useEffect(() => {
    const jobId = searchParams.get("autoApplyJobId");
    if (!jobId) {
      autoApplyDeepLinkConsumed.current = null;
      return;
    }
    if (autoApplyDeepLinkConsumed.current === jobId) return;
    if (queueStatus === "loading" || queueStatus === "populating") return;

    const target = jobs.find((j) => j.id === jobId);
    if (!target) {
      if (queueStatus === "ready" || queueStatus === "empty") {
        autoApplyDeepLinkConsumed.current = jobId;
        safeInfo(
          "Job not in your queue",
          "That role isn’t in your Jobs list. Add it from Job Search, then try Continue auto-apply again.",
        );
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete("autoApplyJobId");
            return next;
          },
          { replace: true },
        );
      }
      return;
    }

    autoApplyDeepLinkConsumed.current = jobId;
    openAutoApplyFlow(target);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("autoApplyJobId");
        return next;
      },
      { replace: true },
    );
  }, [
    jobs,
    openAutoApplyFlow,
    queueStatus,
    safeInfo,
    searchParams,
    setSearchParams,
  ]);

  useEffect(() => {
    if (!resumeDialogOpen) return;
    loadCoverLetterLibrary();
  }, [resumeDialogOpen, loadCoverLetterLibrary]);

  useEffect(() => {
    if (!resumeDialogOpen || !jobToAutoApply || draftData) return;
    const existingDraft = getStoredDraftData(jobToAutoApply, selectedResumeId);
    if (!existingDraft) return;
    setDraftData(existingDraft);
    setAutoApplyStep(4);
  }, [draftData, jobToAutoApply, resumeDialogOpen, selectedResumeId]);

  useEffect(() => {
    if (!resumeDialogOpen || !draftData || autoApplyStep !== 4) return;
    if (!selectedResumeId) return;
    if (draftData.sourceResumeId === selectedResumeId) return;
    setDraftData(null);
    setAutoApplyStep(1);
    setAiEvaluation(null);
    setForceSubmit(false);
    safeInfo(
      "Draft cleared",
      "You changed the resume selection, so we'll generate a fresh draft for that resume.",
    );
  }, [
    autoApplyStep,
    draftData,
    resumeDialogOpen,
    safeInfo,
    selectedResumeId,
  ]);

  const generateAutoApplyDraft = useCallback(
    async (targetJob: Job | null | undefined, instructions?: string) => {
      if (!targetJob) {
        safeInfo(
          "No target job",
          "Choose a job first so we can build a tailored draft for it.",
        );
        return false;
      }

      const resumeText = activeResumeText.trim();
      if (!resumeText) {
        safeInfo(
          "Resume required",
          "Select a resume with readable text before generating an AI draft.",
        );
        return false;
      }

      setGeneratingDraft(true);
      try {
        const [tailoredResume, tailoredCoverLetter] = await Promise.all([
          tailorResumeViaEdge({
            jobDescription: targetJob.description || "",
            resumeText,
            instructions,
          }),
          generateCoverLetterViaEdge({
            jobDescription: targetJob.description || "",
            resumeText,
          }),
        ]);

        setDraftData({
          resumeText: tailoredResume,
          coverLetterText: tailoredCoverLetter,
          sourceResumeId: selectedResumeId,
          sourceResumeName: selectedResumeName,
          sourceResumeUpdatedAt:
            typeof (selectedResume as any)?.updated_at === "string"
              ? (selectedResume as any).updated_at
              : null,
          sourceCandidateName: selectedResumeCandidateName,
        });
        setAutoApplyStep(4);
        return true;
      } catch (draftErr) {
        console.error("Draft generation failed", draftErr);
        toastError(
          "Draft Generation Failed",
          "Failed to generate a custom resume and cover letter draft.",
        );
        return false;
      } finally {
        setGeneratingDraft(false);
      }
    },
    [
      activeResumeText,
      safeInfo,
      selectedResume,
      selectedResumeCandidateName,
      selectedResumeId,
      selectedResumeName,
    ],
  );

  const handleDecisionBoundaryAutoFix = useCallback(async () => {
    if (!aiEvaluation) return;

    const guidance = [
      "Revise the resume for this specific job while staying fully truthful to the candidate's existing experience.",
      "Do not invent or exaggerate employers, projects, dates, tools, certifications, metrics, or hard requirements that are not supported by the source resume.",
    ];

    if (resumeIdentityMismatch && profileFullName) {
      guidance.push(
        `The candidate's correct name is "${profileFullName}". If the resume uses a different name, correct it everywhere in the draft.`,
      );
    }

    if ((aiEvaluation.missing_requirements?.length ?? 0) > 0) {
      guidance.push(
        `Address these flagged requirements only when the source resume already supports them: ${aiEvaluation.missing_requirements.join("; ")}.`,
      );
    }

    if ((aiEvaluation.tailoring_suggestions?.length ?? 0) > 0) {
      guidance.push(
        `Apply these tailoring suggestions where truthful and supported: ${aiEvaluation.tailoring_suggestions.join(" ")}`,
      );
    }

    const created = await generateAutoApplyDraft(
      jobToAutoApply,
      guidance.join("\n\n"),
    );
    if (!created) return;

    setAiEvaluation(null);
    setForceSubmit(false);
    safeInfo(
      "AI draft ready",
      "We turned the validation feedback into a reviewable draft for this job.",
    );
  }, [
    aiEvaluation,
    generateAutoApplyDraft,
    jobToAutoApply,
    profileFullName,
    resumeIdentityMismatch,
    safeInfo,
  ]);


  const applyAllJobs = useCallback(
    async (saveAsDraftOnly: boolean = false) => {
      if (applyingAll) return;
      if (!hasAutoApplyAccess) {
        setError({
          message: "Sign in to use auto apply.",
          link: "/dashboard/billing",
        });
        return;
      }

      const targetJobs = jobToAutoApply ? [jobToAutoApply] : jobs;
      if (!targetJobs.length) return;

      const jobsWithTargets = targetJobs
        .map((job) => ({ job, target: getJobApplyTarget(job) }))
        .filter((item): item is { job: Job; target: string } =>
          Boolean(item.target),
        );

      if (!jobsWithTargets.length) {
        safeInfo(
          "No automation targets",
          "This job is missing an apply link. Refresh your queue or open the job detail to locate one manually.",
        );
        return;
      }

      const pushLog = (
        message: string,
        status: "info" | "success" | "error" = "info",
      ) => {
        const time = new Date().toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        setAutomationLogs((prev) => [...prev, { time, message, status }]);
      };

      let success = 0;
      let fail = 0;
      let done = 0;
      let executionStarted = false;

      try {
        const { data: authData } = await supabase.auth.getUser();
        const userEmail = authData?.user?.email;

        const evaluationCache = new Map<string, EvaluateJobFitResponse>();
        const getEvaluationForJob = async (job: Job) => {
          const cached = evaluationCache.get(job.id);
          if (cached) return cached;
          if (!hasJobEvaluationAccess) {
            throw new Error("Job evaluation requires Basics or higher");
          }

          const evaluation = await evaluateJobFit(
            job.id,
            job.title,
            job.company,
            job.description || "",
            profileSnapshot || "No profile provided.",
            activeResumeText || "No resume content provided.",
          );

          evaluationCache.set(job.id, evaluation);
          setEvaluationReports((prev) => ({
            ...prev,
            [job.id]: {
              ...evaluation,
              candidate_memory: prev[job.id]?.candidate_memory ?? null,
            },
          }));
          const summary = {
            evaluation_id: evaluation.evaluation_id ?? null,
            archetype: evaluation.archetype,
            canonical_decision: evaluation.canonical_decision,
            confidence_score: evaluation.confidence_score,
            blockers: evaluation.blockers,
            exact_fit_evidence: evaluation.exact_fit_evidence,
            matched_keywords: evaluation.matched_keywords,
          };

          setJobs((prev) =>
            prev.map((row) =>
              row.id === job.id
                ? {
                    ...row,
                    canonical_status:
                      row.canonical_status === "draft_ready"
                        ? "draft_ready"
                        : "evaluated",
                    evaluation_summary: summary,
                  }
                : row,
            ),
          );

          if (jobToAutoApply?.id === job.id) {
            setJobToAutoApply((prev) =>
              prev && prev.id === job.id
                ? {
                    ...prev,
                    canonical_status:
                      prev.canonical_status === "draft_ready"
                        ? "draft_ready"
                        : "evaluated",
                    evaluation_summary: summary,
                  }
                : prev,
            );
          }

          return evaluation;
        };

        if (
          hasJobEvaluationAccess &&
          jobsWithTargets.length === 1 &&
          !forceSubmit &&
          !draftData
        ) {
          const targetJob = jobsWithTargets[0].job;
          setEvaluatingJob(true);
          try {
            const evaluation = await getEvaluationForJob(targetJob);
            setAiEvaluation(evaluation);

            const hasHardBlockers =
              (evaluation.blockers?.length ?? 0) > 0 ||
              (evaluation.missing_requirements?.length ?? 0) > 0 ||
              evaluation.canonical_decision === "risky" ||
              evaluation.canonical_decision === "no_go" ||
              evaluation.confidence_score < 70;

            if (hasHardBlockers) {
              setAutoApplyStep(2);
              return;
            }
          } catch (evalErr) {
            console.error("Failed to evaluate job fit", evalErr);
            toastError(
              "Job Evaluation Failed",
              "The AI model encountered an error evaluating this job.",
            );
            safeInfo(
              "AI Evaluation Failed",
              "Could not complete confidence check, proceeding to draft review instead.",
            );
          } finally {
            setEvaluatingJob(false);
          }
        }

        const targetJob = jobsWithTargets[0]?.job;
        if (jobsWithTargets.length === 1 && !draftData) {
          const draftCreated = await generateAutoApplyDraft(targetJob);
          if (draftCreated) {
            return;
          }
          safeInfo(
            "Draft Generation Failed",
            "Skipping draft mode and falling back to base materials.",
          );
        }

        let jobsToAutoApply = jobsWithTargets;
        let jobsToDraft: typeof jobsWithTargets = [];

        if (saveAsDraftOnly) {
          jobsToAutoApply = [];
          jobsToDraft = jobsWithTargets;
        } else if (trueAutonomyEnabled && jobsWithTargets.length > 1) {
          if (!hasJobEvaluationAccess) {
            jobsToAutoApply = [...jobsWithTargets];
            jobsToDraft = [];
            pushLog(
              "AI fit evaluation is a Basics+ feature — skipping and launching all jobs with valid apply links.",
              "info",
            );
          } else {
            jobsToAutoApply = [];
            jobsToDraft = [];

            for (const item of jobsWithTargets) {
              try {
                const evaluation = await getEvaluationForJob(item.job);
                const decision = evaluation.canonical_decision;
                const confidence = evaluation.confidence_score ?? 0;
                const hardBlockers = (evaluation.blockers?.length ?? 0);

                const safeToLaunch =
                  (decision === "strong_yes" || decision === "draft_first") &&
                  confidence >= 65 &&
                  hardBlockers === 0;

                if (safeToLaunch) {
                  jobsToAutoApply.push(item);
                  pushLog(
                    `Evaluated: ${item.job.title} — ${decision} (${Math.round(confidence)}% confidence) → auto-apply`,
                    "info",
                  );
                } else {
                  jobsToDraft.push(item);
                  const reason = hardBlockers > 0
                    ? `${hardBlockers} blocker(s)`
                    : confidence < 65
                      ? `low confidence (${Math.round(confidence)}%)`
                      : `decision: ${decision}`;
                  pushLog(
                    `Evaluated: ${item.job.title} — ${decision} (${Math.round(confidence)}% confidence) → draft (${reason})`,
                    "info",
                  );
                }
              } catch (evaluationError) {
                console.error("Batch evaluation failed", evaluationError);
                jobsToDraft.push(item);
                pushLog(
                  `${item.job.title} — evaluation failed, moved to drafts`,
                  "info",
                );
              }
            }
          }
        }

        // Temporarily skip client-side quota RPC checks until the remote quota
        // functions are repaired. We still require paid access before launch.

        setApplyingAll(true);
        setAutomationLogs([]);
        setAutomationFinished(false);
        setAutoApplyStep(3);
        executionStarted = true;
        pushLog(
          `Initializing automation for ${jobsWithTargets.length} job(s)...`,
        );
        setApplyProgress({
          done: 0,
          total: jobsWithTargets.length,
          success: 0,
          fail: 0,
        });

        events.autoApplyStarted(
          jobsToAutoApply.length,
          selectedResumeId || undefined,
          selectedCoverLetterId || undefined,
        );

        const launchedAt = new Date();
        let resumeSignedUrl: string | undefined;
        if (jobsToAutoApply.length > 0 && selectedResume?.file_path) {
          try {
            const { data: signed, error: signErr } = await supabase.storage
              .from("resumes")
              .createSignedUrl(selectedResume.file_path, 60 * 60 * 48);
            if (!signErr && signed?.signedUrl) {
              resumeSignedUrl = signed.signedUrl;
            }
          } catch (signErr) {
            console.error("auto-apply resume signing threw", signErr);
          }
        }

        const finalCoverLetterPayload = draftData
          ? draftData.coverLetterText
          : composeCoverLetterPayload(selectedCoverLetter);

        if (jobsToAutoApply.length > 0) {
          safeInfo(
            "Automation launching",
            `Dispatching ${jobsToAutoApply.length} job(s) individually to the automation runner.`,
          );
        }
        if (jobsToDraft.length > 0) {
          safeInfo(
            "Draft queue updated",
            `Saved ${jobsToDraft.length} job(s) as draft-ready for review.`,
          );
        }

        for (const { job, target } of jobsWithTargets) {
          try {
            const isDraft = jobsToDraft.some(
              (entry) => entry.job.id === job.id,
            );
            const isLaunch = jobsToAutoApply.some(
              (entry) => entry.job.id === job.id,
            );
            const evaluation =
              evaluationCache.get(job.id) ||
              (jobToAutoApply?.id === job.id
                ? aiEvaluation || undefined
                : undefined);
            const matchedKeywords =
              evaluation?.matched_keywords ||
              job.evaluation_summary?.matched_keywords ||
              [];

            const evalDecision = evaluation?.canonical_decision ??
              job.evaluation_summary?.canonical_decision;
            const evalConfidence = evaluation?.confidence_score ??
              job.evaluation_summary?.confidence_score;
            const evalSuffix = evalDecision
              ? ` [${evalDecision}, ${Math.round(evalConfidence ?? 0)}% confidence]`
              : "";
            pushLog(
              `Processing: ${job.title || "Untitled"} @ ${job.company || "Unknown"}${evalSuffix}`,
            );

            if (isLaunch) {
              let jobCoverLetter = finalCoverLetterPayload;
              if (job.description && jobsWithTargets.length > 1) {
                try {
                  pushLog(`Generating tailored cover letter for ${job.title}...`);
                  const generated = await generateCoverLetterViaEdge({
                    jobDescription: job.description,
                    resumeText: activeResumeText || "",
                  });
                  if (generated) {
                    jobCoverLetter = generated;
                    pushLog(`Cover letter ready for ${job.title}`, "success");
                  }
                } catch (clErr) {
                  console.warn("Per-job cover letter generation failed, using default", clErr);
                }
              }

              pushLog(
                `Dispatching automation to ${new URL(target).hostname}...`,
              );
              const automationPayload = {
                jobs: [
                  {
                    sourceUrl: target,
                    url: job.apply_url ?? target,
                    source_url: job.source_id ?? target,
                    job_id: job.id,
                    job_title: job.title,
                    company: job.company,
                    location: job.location ?? null,
                    salary: formatSalaryRange(job),
                    match_score:
                      typeof job.matchScore === "number"
                        ? Math.round(job.matchScore)
                        : null,
                    match_reasons:
                      matchedKeywords.length > 0 ? matchedKeywords : null,
                    ai_confidence_score:
                      evaluation?.confidence_score ??
                      job.evaluation_summary?.confidence_score ??
                      null,
                    evaluation_id:
                      evaluation?.evaluation_id ??
                      job.evaluation_summary?.evaluation_id ??
                      null,
                  },
                ],
                job_id: job.id,
                job_title: job.title,
                company: job.company,
                location: job.location ?? null,
                salary: formatSalaryRange(job),
                match_score:
                  typeof job.matchScore === "number"
                    ? Math.round(job.matchScore)
                    : null,
                match_reasons:
                  matchedKeywords.length > 0 ? matchedKeywords : null,
                ai_confidence_score:
                  evaluation?.confidence_score ??
                  job.evaluation_summary?.confidence_score ??
                  null,
                evaluation_id:
                  evaluation?.evaluation_id ??
                  job.evaluation_summary?.evaluation_id ??
                  null,
                title: `Jobraker Auto Apply • ${launchedAt.toLocaleString()}`,
                cover_letter: jobCoverLetter,
                ...(profileSnapshot
                  ? { additional_information: profileSnapshot }
                  : {}),
                ...(resumeSignedUrl ? { resume: resumeSignedUrl } : {}),
                ...(draftData
                  ? { resume_text: draftData.resumeText }
                  : activeResumeText
                    ? { resume_text: activeResumeText }
                    : {}),
                ...(userEmail ? { email: userEmail } : {}),
              };

              let automationResult:
                | Awaited<ReturnType<typeof applyToJobs>>
                | undefined;
              for (let attempt = 0; attempt < 2; attempt += 1) {
                try {
                  automationResult = await applyToJobs(automationPayload);
                  break;
                } catch (automationError) {
                  if (
                    !isApplyRateLimitError(automationError) ||
                    attempt === 1
                  ) {
                    throw automationError;
                  }
                  pushLog(
                    `Rate limit reached while launching ${job.title}. Pausing for 65 seconds before retrying...`,
                    "info",
                  );
                  await sleep(AUTO_APPLY_RATE_LIMIT_WAIT_MS);
                }
              }

              if (!automationResult) {
                throw new Error(
                  "Automation launch failed before a result was returned.",
                );
              }

              const metadata = extractAutomationMetadata(automationResult);
              done += 1;
              success += 1;
              setApplyProgress((prev) => ({ ...prev, done, success }));
              events.autoApplyJobSuccess(job.id, job.status || "unknown", 0);
              pushLog(
                `✓ ${job.title} — queued for automation (${metadata.providerStatus ?? "pending"})`,
                "success",
              );
              try {
                gamificationHook.recordEvent("job_applied", {
                  jobId: job.id,
                  title: job.title,
                });
              } catch {
                // Best effort only.
              }
              continue;
            }

            if (!isDraft) continue;

            const existingRawData =
              job.raw_data && typeof job.raw_data === "object"
                ? (job.raw_data as Record<string, unknown>)
                : {};
            const nextDraftPayload =
              draftData && jobsWithTargets.length === 1
                ? {
                    ...draftData,
                    savedAt: new Date().toISOString(),
                  }
                : existingRawData.application_draft &&
                    typeof existingRawData.application_draft === "object"
                  ? existingRawData.application_draft
                  : { savedAt: new Date().toISOString() };

            const { error: draftUpdateError } = await supabase
              .from("jobs")
              .update({
                canonical_status: "draft_ready",
                evaluation_summary: {
                  evaluation_id:
                    evaluation?.evaluation_id ??
                    job.evaluation_summary?.evaluation_id ??
                    null,
                  archetype:
                    evaluation?.archetype ?? job.evaluation_summary?.archetype,
                  canonical_decision:
                    evaluation?.canonical_decision ??
                    job.evaluation_summary?.canonical_decision,
                  confidence_score:
                    evaluation?.confidence_score ??
                    job.evaluation_summary?.confidence_score,
                  blockers:
                    evaluation?.blockers ??
                    job.evaluation_summary?.blockers ??
                    [],
                  exact_fit_evidence:
                    evaluation?.exact_fit_evidence ??
                    job.evaluation_summary?.exact_fit_evidence ??
                    [],
                  matched_keywords: matchedKeywords,
                },
                raw_data: {
                  ...existingRawData,
                  application_draft: nextDraftPayload,
                },
              })
              .eq("id", job.id);

            if (draftUpdateError) {
              throw draftUpdateError;
            }

            done += 1;
            success += 1;
            setApplyProgress((prev) => ({ ...prev, done, success }));
            pushLog(
              evalDecision
                ? `✓ ${job.title} — saved as draft (${evalDecision}, ${Math.round(evalConfidence ?? 0)}%)`
                : `✓ ${job.title} — saved as draft-ready`,
              "success",
            );
          } catch (inner) {
            done += 1;
            fail += 1;
            setApplyProgress((prev) => ({ ...prev, done, fail }));
            pushLog(
              `✗ ${job.title} — Failed: ${inner instanceof Error ? inner.message : "Unknown error"}`,
              "error",
            );
            events.autoApplyJobFailed(
              job.id,
              job.status || "unknown",
              "exception_queue",
            );

            try {
              await supabase
                .from("jobs")
                .update({ canonical_status: "failed" })
                .eq("id", job.id);
            } catch {
              // Best effort only.
            }
          }
        }

        // Temporarily skip client-side quota consumption until the remote quota
        // functions are repaired.

        events.autoApplyFinished(success, fail);
        await fetchJobQueue();
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        setError({ message: `Failed to launch automation: ${message}` });
        events.autoApplyFinished(0, jobsWithTargets.length);
      } finally {
        setApplyingAll(false);
        if (executionStarted) {
          setApplyProgress((prev) => ({ ...prev, done, success, fail }));
          setAutomationFinished(true);
          pushLog(
            `Automation complete. ${success} succeeded, ${fail} failed.`,
            success > 0 ? "success" : "error",
          );
        }
      }
    },
    [
      applyingAll,
      generateAutoApplyDraft,
      hasAutoApplyAccess,
      hasJobEvaluationAccess,
      jobs,
      profileSnapshot,
      selectedCoverLetter,
      selectedCoverLetterId,
      selectedResume,
      selectedResumeId,
      jobToAutoApply,
      fetchJobQueue,
      safeInfo,
      setError,
      forceSubmit,
      aiEvaluation,
      draftData,
      trueAutonomyEnabled,
      gamificationHook,
    ],
  );

  // Unified effect for initial load and real-time updates
  useEffect(() => {
    if (profileLoading) {
      setQueueStatus("loading");
      return;
    }

    // Set up the real-time subscription
    const channel = supabase
      .channel("jobs-queue-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs" },
        () => {
          // During an active search/extraction run, avoid thrashing the UI
          if (incrementalMode) return;
          void queryClient.invalidateQueries({ queryKey: jobsQueueKeys.all });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [incrementalMode, profileLoading, queryClient, supabase]);

  // Effect to pre-fill search query from profile
  useEffect(() => {
    if (profile && !searchQuery) {
      setSearchQuery(profile.job_title || "");
      setSelectedLocation(profile.location || "Remote");
      setLocationScope((profile as any)?.location_scope || "city");
    }
  }, [profile, searchQuery]);

  const visibleJobs = useMemo(() => jobs, [jobs]);

  const sortedJobs = useMemo(() => {
    const arr = [...visibleJobs];
    if (sortBy === "company") {
      return arr.sort((a, b) =>
        (a.company || "").localeCompare(b.company || ""),
      );
    }
    if (sortBy === "deadline") {
      const toTs = (v?: string | null) => {
        if (!v) return Number.POSITIVE_INFINITY;
        const t = Date.parse(v);
        return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
      };
      return arr.sort((a, b) => toTs(a.expires_at) - toTs(b.expires_at));
    }
    return arr.sort(
      (a, b) =>
        new Date(b.posted_at || 0).getTime() -
        new Date(a.posted_at || 0).getTime(),
    );
  }, [visibleJobs, sortBy]);

  const total = sortedJobs.length;
  const visibleJobCount = total;
  const canAdvanceFromStepOne =
    !resumesLoading &&
    !loadingSelectedResumeText &&
    (!Array.isArray(resumes) ||
      resumes.length === 0 ||
      Boolean(selectedResumeId));
  const autoApplyTargetCount = jobToAutoApply ? 1 : visibleJobCount;
  const canLaunchAutoApply =
    autoApplyTargetCount > 0 &&
    (!Array.isArray(resumes) ||
      resumes.length === 0 ||
      Boolean(selectedResumeId));
  const canAutoFixDecisionBoundary = Boolean(
    jobToAutoApply && activeResumeText.trim(),
  );
  const autoApplyPrimaryDisabled =
    loadingTier ||
    !hasAutoApplyAccess ||
    (autoApplyStep === 1 ? !canAdvanceFromStepOne : !canLaunchAutoApply);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIdx = (clampedPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, total);
  const paginatedJobs = sortedJobs.slice(startIdx, endIdx);

  useEffect(() => {
    if (!jobs.length) return;
    const persist = async () => {
      const currentIds = new Set(jobs.map((job) => job.id));
      matchInsightSignaturesRef.current.forEach((_, key) => {
        if (!currentIds.has(key)) matchInsightSignaturesRef.current.delete(key);
      });
      const updates = jobs
        .map((job) => {
          if (typeof job.matchScore !== "number") return null;
          const signature = `${Math.round(job.matchScore)}|${job.matchSummary ?? ""}|${JSON.stringify(job.matchBreakdown ?? null)}|${matchContext.searchQuery || ""}|${matchContext.selectedLocation || ""}`;
          if (matchInsightSignaturesRef.current.get(job.id) === signature) {
            return null;
          }
          const rawData =
            (job as any)?.raw_data && typeof (job as any).raw_data === "object"
              ? { ...(job as any).raw_data }
              : ({} as Record<string, any>);
          const existing = rawData?.match_insights;
          const nextInsights = {
            score: job.matchScore,
            summary: job.matchSummary ?? null,
            breakdown: job.matchBreakdown ?? null,
            search_query: matchContext.searchQuery || null,
            location_preference: matchContext.selectedLocation || null,
            computed_at: new Date().toISOString(),
          };
          const unchanged =
            existing &&
            existing.score === nextInsights.score &&
            existing.summary === nextInsights.summary &&
            JSON.stringify(existing.breakdown ?? null) ===
              JSON.stringify(nextInsights.breakdown ?? null) &&
            (existing.search_query || null) === nextInsights.search_query &&
            (existing.location_preference || null) ===
              nextInsights.location_preference;
          if (unchanged) {
            matchInsightSignaturesRef.current.set(job.id, signature);
            return null;
          }
          rawData.match_insights = nextInsights;
          return { id: job.id, raw_data: rawData, signature };
        })
        .filter(Boolean) as Array<{
        id: string;
        raw_data: Record<string, any>;
        signature: string;
      }>;
      if (!updates.length) return;
      try {
        await Promise.all(
          updates.map(({ id, raw_data }) =>
            supabase.from("jobs").update({ raw_data }).eq("id", id),
          ),
        );
        updates.forEach(({ id, signature }) => {
          matchInsightSignaturesRef.current.set(id, signature);
        });
      } catch (err) {
        console.error("persist match insights failed", err);
      }
    };
    persist();
  }, [jobs, supabase, matchContext.searchQuery, matchContext.selectedLocation]);

  useEffect(() => {
    if (currentPage !== clampedPage) setCurrentPage(clampedPage);
  }, [clampedPage, currentPage]);

  useEffect(() => {
    if (selectedJob && !paginatedJobs.some((j) => j.id === selectedJob)) {
      // On mobile, don't auto-select a new job when the page changes — it would
      // immediately pop open the detail sheet without user intent.
      setSelectedJob(isMobile ? null : (paginatedJobs[0]?.id ?? null));
    }
  }, [clampedPage, isMobile, pageSize, selectedJob, paginatedJobs]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy]);

  useEffect(() => {
    if (!resumeDialogOpen) return;
    if (!Array.isArray(resumes) || resumes.length === 0) return;
    setSelectedResumeId((prev) => getPreferredResumeId(resumes, prev));
  }, [resumeDialogOpen, resumes]);

  // Small helper for relative timestamps
  const formatRelative = (iso?: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.max(0, now.getTime() - d.getTime());
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  // Deadline formatting helper
  const formatDeadlineMeta = (
    value?: string,
  ): { label: string; level: "overdue" | "soon" | "future" } | null => {
    if (!value) return null;
    const ts = Date.parse(value);
    if (Number.isNaN(ts)) return { label: value, level: "future" };
    const d = new Date(ts);
    const now = new Date();
    const ms = d.getTime() - now.getTime();
    const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
    if (days < 0)
      return { label: `Closed ${Math.abs(days)}d ago`, level: "overdue" };
    if (days === 0) return { label: "Closes today", level: "soon" };
    if (days === 1) return { label: "Closes tomorrow", level: "soon" };
    const level: "soon" | "future" = days <= 7 ? "soon" : "future";
    return { label: `Closes in ${days}d`, level };
  };

  return (
    <div className='relative min-h-screen' role='main' aria-label='Job search'>
      {/* Animated SVG Background */}
      <AnimatedSVGBackground />

      {/* Ambient Background Glow */}
      <div className='fixed top-20 left-0 h-96 w-96 bg-foreground/5 rounded-full blur-3xl opacity-30 pointer-events-none -z-10'></div>
      <div className='fixed bottom-0 right-0 h-96 w-96 bg-foreground/5 rounded-full blur-3xl opacity-20 pointer-events-none -z-10'></div>

      <div className='relative w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8'>
        <div className='mb-6 sm:mb-8'>
          <div className='flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6'>
            <div className='space-y-1 mt-2'>
              <h1 className='product-page-title text-3xl font-bold sm:text-4xl'>
                Job Search
              </h1>
              <p className='product-page-subtitle text-sm sm:text-base'>
                Discover opportunities matched to your profile and goals
              </p>
            </div>

            <div className='flex flex-col items-start lg:items-end gap-4 w-full lg:w-auto'>
              <div className='product-section-card-muted relative flex w-full flex-col gap-3 rounded-2xl px-4 py-3 shadow-sm sm:w-auto sm:flex-row sm:items-center sm:gap-4'>
                {/* Subtle gradient overlay */}
                <div className='absolute inset-0 rounded-2xl bg-gradient-to-br from-foreground/5 via-transparent to-transparent pointer-events-none'></div>

                <div className='relative z-10 space-y-1'>
                  <div className='text-[10px] uppercase tracking-[0.35em] text-[#2dd4bf]/80 font-semibold'>
                    Automation readiness
                  </div>
                  <div className='flex items-center gap-2 text-sm font-medium'>
                    {profileReady && resumeLibraryReady ? (
                      <>
                        <ShieldCheck className='h-4 w-4 text-[#2dd4bf]' />
                        <span className='text-foreground'>Ready to launch</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className='h-4 w-4 text-[#ffb347]' />
                        <span className='text-foreground/90'>
                          Action required
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className='relative z-10 flex flex-wrap items-center gap-2'>
                  {profileLoading ? (
                    <span className='inline-flex items-center gap-2 rounded-lg border border-foreground/20 bg-foreground/10 px-3 py-1.5 text-xs text-foreground/70'>
                      <Loader2 className='h-3.5 w-3.5 animate-spin' />
                      Syncing…
                    </span>
                  ) : (
                    <Link
                      to='/dashboard/profile'
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-all hover:scale-105",
                        profileReady
                          ? "border-[#2dd4bf]/60 bg-gradient-to-br from-[#22d3ee]/20 to-[#0d9488]/10 text-[#2dd4bf] shadow-[0_0_10px_rgba(45,212,191,0.15)] hover:shadow-[0_0_15px_rgba(45,212,191,0.25)]"
                          : "border-[#ffb347]/50 bg-gradient-to-br from-[#ffb347]/15 to-[#ffb347]/5 text-[#ffb347] shadow-[0_0_10px_rgba(255,179,71,0.15)] hover:shadow-[0_0_15px_rgba(255,179,71,0.25)]",
                      )}
                      title={
                        profileReady
                          ? "Profile details detected"
                          : "Complete your profile"
                      }
                    >
                      {profileReady ? (
                        <UserCheck className='h-3.5 w-3.5 text-[#2dd4bf]' />
                      ) : (
                        <UserX className='h-3.5 w-3.5 text-[#ffb347]' />
                      )}
                      <span className='font-medium'>
                        {profileReady ? "Profile verified" : "Complete profile"}
                      </span>
                    </Link>
                  )}
                  {resumesLoading ? (
                    <span className='inline-flex items-center gap-2 rounded-lg border border-foreground/20 bg-foreground/10 px-3 py-1.5 text-xs text-foreground/70'>
                      <Loader2 className='h-3.5 w-3.5 animate-spin' />
                      <span className='hidden sm:inline'>Loading resumes…</span>
                      <span className='sm:hidden'>Loading…</span>
                    </span>
                  ) : (
                    <Link
                      to='/dashboard/resumes'
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-all hover:scale-105",
                        resumeLibraryReady
                          ? "border-[#2dd4bf]/60 bg-gradient-to-br from-[#22d3ee]/20 to-[#0d9488]/10 text-[#2dd4bf] shadow-[0_0_10px_rgba(45,212,191,0.15)] hover:shadow-[0_0_15px_rgba(45,212,191,0.25)]"
                          : "border-[#ffb347]/50 bg-gradient-to-br from-[#ffb347]/15 to-[#ffb347]/5 text-[#ffb347] shadow-[0_0_10px_rgba(255,179,71,0.15)] hover:shadow-[0_0_15px_rgba(255,179,71,0.25)]",
                      )}
                      title={
                        resumeLibraryReady
                          ? selectedResume?.name
                            ? `Selected resume: ${selectedResume.name}`
                            : "Resume library ready"
                          : "Upload a resume to unlock automation"
                      }
                    >
                      {resumeLibraryReady ? (
                        <FileCheck2 className='h-3.5 w-3.5 text-[#2dd4bf]' />
                      ) : (
                        <FileWarning className='h-3.5 w-3.5 text-[#ffb347]' />
                      )}
                      <span className='max-w-[140px] truncate font-medium'>
                        {resumeLibraryReady
                          ? selectedResume?.name
                            ? `Resume: ${selectedResume.name}`
                            : "Resume library ready"
                          : "Upload resume"}
                      </span>
                    </Link>
                  )}
                </div>
              </div>

              {/* Target selector removed: fixed to 10 to minimize API usage and keep runs bounded */}
              <div className='w-full sm:w-auto flex flex-wrap items-center gap-2 sm:gap-3'>
                {isAdmin && (
                  <div className='flex items-center gap-2 text-xs text-foreground/40 select-none'>
                    <button
                      type='button'
                      onClick={() => setDebugMode((v) => !v)}
                      className='px-1 py-0.5 rounded hover:text-foreground focus:outline-none focus:ring-1 focus:ring-[#2dd4bf]/50'
                      aria-pressed={debugMode}
                      title='Toggle Diagnostics'
                    >
                      Diagnostics
                    </button>
                    <Switch
                      checked={debugMode}
                      onCheckedChange={setDebugMode}
                    />
                  </div>
                )}

                <div className='flex flex-row flex-wrap sm:flex-nowrap items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto'>
                  <Button
                    variant='ghost'
                    onClick={() => {
                      openAutoApplyFlow(null);
                    }}
                    className={`relative flex-1 sm:flex-none overflow-hidden border border-[#2dd4bf]/40 text-foreground px-3 py-2 sm:px-4 sm:py-2 md:px-5 rounded-xl transition-all duration-300 text-xs sm:text-sm ${applyingAll ? "bg-[#2dd4bf]/20 text-[#2dd4bf]" : "bg-gradient-to-r from-[#22d3ee]/10 via-transparent to-[#0d9488]/10 hover:from-[#22d3ee]/20 hover:to-[#0d9488]/5"}`}
                    title='Auto apply all visible jobs'
                    disabled={
                      applyingAll ||
                      loadingTier ||
                      queueStatus !== "ready" ||
                      jobs.length === 0
                    }
                  >
                    <span
                      className='absolute inset-0 opacity-20 pointer-events-none'
                      style={{
                        background:
                          "radial-gradient(180px at 0% 0%, rgba(45,212,191,0.45), transparent 65%)",
                      }}
                    />
                    <span className='relative inline-flex items-center justify-center gap-1.5 sm:gap-2 font-medium tracking-wide'>
                      {applyingAll ? (
                        <Loader2 className='w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin' />
                      ) : (
                        <Briefcase className='w-3.5 h-3.5 sm:w-4 sm:h-4' />
                      )}
                      {!hasAutoApplyAccess && !applyingAll && (
                        <Lock className='w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-60' />
                      )}
                      <span className='hidden sm:inline'>
                        {applyingAll
                          ? `Applying ${applyProgress.done}/${applyProgress.total}`
                          : "Auto Apply Suite"}
                      </span>
                      <span className='sm:hidden'>
                        {applyingAll
                          ? `${applyProgress.done}/${applyProgress.total}`
                          : "Auto Apply"}
                      </span>
                    </span>
                  </Button>
                  <Button
                    variant='ghost'
                    onClick={() => populateQueue(searchQuery, selectedLocation)}
                    className={`group relative flex-1 sm:flex-none overflow-hidden rounded-xl px-3 py-2 sm:px-4 sm:py-2 md:px-5 text-xs sm:text-sm font-medium tracking-wide transition-all duration-300 border backdrop-blur-md disabled:cursor-not-allowed disabled:opacity-60 ${
                      queueStatus === "populating" || queueStatus === "loading"
                        ? "border-[#2dd4bf]/60 text-[#2dd4bf] bg-[#2dd4bf]/15"
                        : "border-foreground/20 text-foreground bg-foreground/5 hover:text-[#2dd4bf] hover:border-[#2dd4bf]/60 hover:bg-[#2dd4bf]/10 shadow-[0_12px_32px_rgba(8,122,52,0.35)]"
                    }`}
                    title='Find a fresh batch of jobs'
                    disabled={
                      queueStatus === "populating" || queueStatus === "loading"
                    }
                  >
                    <span
                      className='pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300'
                      style={{
                        background:
                          "linear-gradient(120deg, transparent 0%, rgba(45,212,191,0.35) 45%, transparent 90%)",
                      }}
                    />
                    <span className='relative inline-flex items-center justify-center gap-1.5 sm:gap-2'>
                      {queueStatus === "populating" ? (
                        <Loader2 className='w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin' />
                      ) : (
                        <Search className='w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#2dd4bf]' />
                      )}
                      <span className='hidden sm:inline'>
                        {queueStatus === "populating"
                          ? "Building results…"
                          : "Find Jobs Suite"}
                      </span>
                      <span className='sm:hidden'>
                        {queueStatus === "populating"
                          ? "Building…"
                          : "Find Jobs"}
                      </span>
                    </span>
                  </Button>
                  <Button
                    variant='ghost'
                    onClick={() => setConfirmDeleteOpen(true)}
                    className={`group relative flex-none overflow-hidden rounded-xl px-3 py-2 sm:px-4 sm:py-2 md:px-5 text-xs sm:text-sm font-medium tracking-wide transition-all duration-300 border backdrop-blur-md ${
                      clearingJobs
                        ? "border-red-500/60 text-red-400 bg-red-500/15 cursor-not-allowed opacity-60"
                        : jobs.length === 0
                          ? "border-red-500/20 text-red-400/40 bg-red-500/5 cursor-not-allowed opacity-40"
                          : "border-red-500/40 text-red-400 bg-red-500/10 hover:text-red-300 hover:border-red-500/60 hover:bg-red-500/20"
                    }`}
                    title={
                      jobs.length === 0
                        ? "No jobs to clear"
                        : "Clear all jobs from your list"
                    }
                    disabled={clearingJobs || jobs.length === 0}
                  >
                    <span
                      className='pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300'
                      style={{
                        background:
                          "linear-gradient(120deg, transparent 0%, rgba(239,68,68,0.25) 45%, transparent 90%)",
                      }}
                    />
                    <span className='relative inline-flex items-center justify-center gap-1.5 sm:gap-2'>
                      {clearingJobs ? (
                        <Loader2 className='w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin' />
                      ) : (
                        <Trash2 className='w-3.5 h-3.5 sm:w-4 sm:h-4' />
                      )}
                      <span className='hidden sm:inline'>
                        {clearingJobs ? "Clearing…" : "Clear All Jobs"}
                      </span>
                      <span className='sm:hidden'>
                        {clearingJobs ? "Clearing…" : "Clear All"}
                      </span>
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {(queueStatus === "populating" || incrementalMode) && (
          <LoadingBanner
            subtitle={`Streaming results… ${currentSource ? `Source: ${currentSource}` : ""}`}
            steps={steps}
            activeStep={stepIndex}
            onCancel={cancelPopulation}
            foundCount={insertedThisRun}
          />
        )}

        {/* Patience Indicator: Show if results are very few (< 10) but we might be finding more, or if we are still in incremental mode */}
        {((total < 10 && queueStatus === "ready") ||
          (incrementalMode && total === 0)) && (
          <PatienceBanner
            count={total}
            isSearching={incrementalMode || queueStatus === "populating"}
          />
        )}

        <Card
          className='relative overflow-hidden bg-gradient-to-br from-foreground/10 via-foreground/5 to-foreground/0  border border-[#2dd4bf]/20 p-5 sm:p-6 mb-6 sm:mb-8 rounded-2xl shadow-[0_0_30px_rgba(45,212,191,0.1)] backdrop-blur-xl transition-colors duration-300 hover:border-[#2dd4bf]/30 hover:shadow-[0_0_40px_rgba(45,212,191,0.15)]'
          id='jobs-search-filters'
          data-tour='jobs-search-filters'
        >
          {/* Subtle gradient overlay */}
          <div className='absolute inset-0 bg-gradient-to-br from-[#22d3ee]/5 via-transparent to-transparent pointer-events-none'></div>

          <div className='relative z-10 grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4'>
            <div className='md:col-span-2 relative group'>
              <Search className='w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-[#2dd4bf]/60 transition-colors group-focus-within:text-[#2dd4bf]' />
              <Input
                id='jobs-search'
                data-tour='jobs-search'
                placeholder='Search jobs, companies, keywords...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    populateQueue(searchQuery, selectedLocation);
                  }
                }}
                className='h-12 bg-gradient-to-br from-foreground/5 to-foreground/[0.02] border-[#2dd4bf]/20 text-foreground placeholder:text-foreground/40 transition-all duration-300 rounded-xl'
              />
              <div className='pointer-events-none select-none absolute right-10 top-1/2 transform -translate-y-1/2'>
                <span className='text-[10px] font-medium text-[#2dd4bf]/80 bg-gradient-to-br from-[#22d3ee]/15 to-[#0d9488]/5 px-2.5 py-1 rounded-lg border border-[#2dd4bf]/30 whitespace-nowrap'>
                  {subscriptionTier === "Ultimate"
                    ? "100"
                    : subscriptionTier === "Pro"
                      ? "50"
                      : subscriptionTier === "Basics"
                        ? "20"
                        : "10"}{" "}
                  results
                </span>
              </div>
            </div>
            <div className='md:col-span-1 space-y-2'>
              <div className='relative group bg-gradient-to-br from-foreground/5 to-foreground/[0.02] border-[#2dd4bf]/20 text-foreground transition-all duration-300 rounded-xl'>
                <MapPin className='pointer-events-none w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-[#2dd4bf]/60' />
                <div
                  id='jobs-location'
                  data-tour='jobs-location'
                  aria-label={`Selected location ${selectedLocation || "Remote"}`}
                  role='status'
                  className='flex h-12 items-center rounded-xl border border-[#2dd4bf]/20 bg-gradient-to-br from-foreground/5 to-foreground/[0.02] px-6 pr-12 text-base font-medium text-foreground sm:text-lg'
                >
                  <span className='truncate'>{selectedLocation || "Remote"}</span>
                </div>
              </div>
              <div className='flex items-center gap-1 rounded-lg border border-border/30 bg-background/40 p-0.5 w-fit'>
                {(["city", "country", "global"] as const).map((scope) => (
                  <button
                    key={scope}
                    type='button'
                    onClick={() => setLocationScope(scope)}
                    className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all duration-200 ${
                      locationScope === scope
                        ? "bg-[#2dd4bf]/15 text-[#2dd4bf] border border-[#2dd4bf]/30"
                        : "text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5 border border-transparent"
                    }`}
                  >
                    {scope === "city" ? "City" : scope === "country" ? "Country" : "Global"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8'>
          <div className='space-y-4'>
            <div className='flex items-center justify-between mb-3 sticky top-0 z-10 backdrop-blur-xl bg-gradient-to-br from-foreground/10 via-foreground/5 to-foreground/0  rounded-xl px-4 py-3 border border-[#2dd4bf]/10 lg:static  lg:bg-transparent lg:border-0 lg:backdrop-blur-none'>
              <h2 className='text-lg sm:text-xl font-bold text-foreground flex items-center gap-2'>
                <svg
                  className='w-5 h-5 text-[#2dd4bf]'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
                  />
                </svg>
                {queueStatus === "loading" &&
                  !incrementalMode &&
                  "Loading results..."}
                {(queueStatus === "populating" || incrementalMode) &&
                  "Building your results..."}
                {(queueStatus === "ready" || queueStatus === "empty") &&
                  !incrementalMode && (
                    <>
                      <span>{total} Jobs Found</span>
                      {total > 0 && (
                        <span className='ml-2 text-xs font-normal px-2 py-1 rounded-lg bg-[#2dd4bf]/10 text-[#2dd4bf] border border-[#2dd4bf]/30'>
                          AI Matched
                        </span>
                      )}
                    </>
                  )}
              </h2>
              {(queueStatus === "ready" || queueStatus === "empty") &&
                !incrementalMode && (
                  <div className='hidden sm:flex items-center gap-2'>
                    <span className='text-xs text-foreground/50 font-medium'>
                      Sort
                    </span>
                    <SimpleDropdown
                      value={sortBy}
                      onValueChange={(v) => setSortBy(v as any)}
                      options={[
                        { value: "recent", label: "Most recent" },
                        { value: "company", label: "Company" },
                        { value: "deadline", label: "Deadline" },
                      ]}
                      placeholder='Sort by'
                      triggerClassName='h-8 w-[160px] text-sm bg-foreground/5 border-foreground/20 hover:bg-foreground/10'
                    />
                  </div>
                )}
            </div>

            {queueStatus === "ready" && total > 0 && !incrementalMode && (
              <div className='hidden lg:grid grid-cols-[auto,1fr,auto] items-center gap-3 px-3 py-2 text-xs uppercase tracking-wider text-[#2dd4bf]/60 font-semibold bg-gradient-to-br from-foreground/5 to-foreground/[0.02] border border-[#2dd4bf]/10 rounded-xl'>
                <span className='pl-2'>Role</span>
                <div className='grid grid-cols-3 gap-2'>
                  <span>Company</span>
                  <span>Details</span>
                  <span>Posted</span>
                </div>
              </div>
            )}

            {queueStatus === "loading" && !incrementalMode && (
              <div className='space-y-4'>
                <div className='grid gap-4'>
                  {Array.from({ length: pageSize }).map((_, i) => (
                    <Card
                      key={i}
                      className='relative overflow-hidden border border-foreground/10 bg-gradient-to-br from-foreground/5 to-foreground/[0.02] p-5 sm:p-6'
                    >
                      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
                        <div className='flex flex-1 items-start gap-4'>
                          <div className='h-16 w-16 shrink-0 rounded-xl border border-foreground/10 bg-foreground/5' />
                          <div className='flex-1 space-y-3'>
                            <div className='h-4 w-3/5 rounded bg-foreground/10' />
                            <div className='h-3 w-1/2 rounded bg-foreground/8' />
                            <div className='flex flex-wrap items-center gap-2'>
                              {Array.from({ length: 3 }).map((__, chipIdx) => (
                                <span
                                  key={chipIdx}
                                  className='inline-flex h-5 w-16 rounded-full border border-foreground/10 bg-foreground/5'
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className='grid w-full max-w-[240px] grid-cols-2 gap-2 text-[10px] text-foreground/60 sm:w-auto'>
                          {Array.from({ length: 4 }).map((__, metricIdx) => (
                            <div
                              key={metricIdx}
                              className='rounded-lg border border-foreground/10 bg-foreground/5 p-3'
                            >
                              <div className='h-3 rounded bg-foreground/10' />
                              <div className='mt-2 h-4 rounded bg-foreground/8' />
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
            {(queueStatus === "populating" || incrementalMode) && (
              <div className='space-y-5'>
                <Card className='relative overflow-hidden border border-[#2dd4bf]/20 bg-gradient-to-br from-background via-background/98 to-background/95 p-6 sm:p-7'>
                  <motion.div
                    className='pointer-events-none absolute inset-[-40%] bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.28),rgba(45,212,191,0)_60%)] opacity-60'
                    animate={{ rotate: [0, 360] }}
                    transition={{
                      duration: 14,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                  <div className='relative flex flex-col gap-5'>
                    <div className='flex items-center gap-3 text-xs uppercase tracking-[0.4em] text-[#2dd4bf]/70'>
                      <span className='inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#2dd4bf]/40 bg-[#2dd4bf]/10'>
                        <span className='h-2 w-2 rounded-full bg-[#2dd4bf] animate-ping' />
                      </span>
                      Scanning networks for roles
                    </div>
                    <div className='grid gap-4 sm:grid-cols-3'>
                      {["Signals", "Compliance", "Enrichment"].map(
                        (label, idx) => (
                          <div
                            key={label}
                            className='rounded-xl border border-foreground/10 bg-foreground/5 p-4 backdrop-blur'
                          >
                            <div className='flex items-center justify-between text-xs text-foreground/60'>
                              <span>{label}</span>
                              <span className='text-[9px] font-mono text-[#2dd4bf]/80'>
                                {String(idx + 1).padStart(2, "0")}
                              </span>
                            </div>
                            <div className='mt-3 h-2 rounded-full bg-foreground/10 overflow-hidden'>
                              <motion.div
                                className='h-full bg-gradient-to-r from-background via-[#2dd4bf] to-[#5eead4]'
                                animate={{
                                  width: ["15%", "85%", "35%", "70%"],
                                }}
                                transition={{
                                  duration: 4,
                                  repeat: Infinity,
                                  ease: "easeInOut",
                                  delay: idx * 0.2,
                                }}
                              />
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                    <div className='grid gap-3 sm:grid-cols-2'>
                      <div className='rounded-xl border border-foreground/10 bg-muted p-4'>
                        <div className='h-3 w-20 rounded bg-foreground/12' />
                        <div className='mt-3 space-y-2'>
                          <div className='h-4 rounded bg-foreground/10' />
                          <div className='h-4 w-5/6 rounded bg-foreground/8' />
                          <div className='h-4 w-2/3 rounded bg-foreground/6' />
                        </div>
                      </div>
                      <div className='rounded-xl border border-foreground/10 bg-muted p-4'>
                        <div className='h-3 w-24 rounded bg-foreground/12' />
                        <div className='mt-3 grid grid-cols-3 gap-3 text-[10px] text-foreground/50'>
                          {Array.from({ length: 3 }).map((_, metricIdx) => (
                            <div
                              key={metricIdx}
                              className='space-y-2 rounded-lg border border-foreground/10 bg-foreground/5 p-3'
                            >
                              <div className='h-3 rounded bg-foreground/10' />
                              <div className='h-4 rounded bg-foreground/10' />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                <div className='grid gap-4'>
                  {Array.from({ length: pageSize }).map((_, i) => (
                    <Card
                      key={i}
                      className='relative overflow-hidden border border-[#2dd4bf]/25 bg-gradient-to-br from-background via-background/98 to-background/95 p-5 sm:p-6'
                    >
                      <motion.div
                        className='absolute inset-0 bg-[linear-gradient(120deg,rgba(45,212,191,0.12)_0%,rgba(45,212,191,0.02)_38%,rgba(45,212,191,0.15)_72%,rgba(45,212,191,0.02)_100%)]'
                        animate={{
                          backgroundPosition: ["0% 0%", "120% 0%", "0% 0%"],
                        }}
                        transition={{
                          duration: 6.5,
                          repeat: Infinity,
                          ease: "linear",
                          delay: i * 0.05,
                        }}
                      />
                      <div className='relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
                        <div className='flex flex-1 items-start gap-4'>
                          <div className='relative flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-[#2dd4bf]/25 bg-card border border-foreground/10'>
                            <motion.span
                              className='absolute h-10 w-10 rounded-full bg-[#2dd4bf]/20'
                              animate={{
                                scale: [0.85, 1.05, 0.85],
                                opacity: [0.4, 0.15, 0.4],
                              }}
                              transition={{
                                duration: 2.6,
                                repeat: Infinity,
                                ease: "easeInOut",
                              }}
                            />
                            <span className='relative h-8 w-8 rounded-full border border-[#2dd4bf]/40' />
                          </div>
                          <div className='flex-1 space-y-3'>
                            <div className='h-4 w-3/5 rounded bg-foreground/10' />
                            <div className='h-3 w-1/2 rounded bg-foreground/10' />
                            <div className='flex flex-wrap items-center gap-2'>
                              {Array.from({ length: 4 }).map((__, chipIdx) => (
                                <span
                                  key={chipIdx}
                                  className='inline-flex h-5 w-16 rounded-full border border-foreground/12 bg-foreground/10'
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className='grid w-full max-w-[240px] grid-cols-2 gap-2 text-[10px] text-foreground/60 sm:w-auto'>
                          {Array.from({ length: 4 }).map((__, metricIdx) => (
                            <div
                              key={metricIdx}
                              className='rounded-lg border border-foreground/10 bg-foreground/5 p-3'
                            >
                              <div className='h-3 rounded bg-foreground/10' />
                              <div className='mt-2 h-4 rounded bg-foreground/10' />
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <Card className='border-red-500/30 bg-red-500/10 text-red-200 p-4 flex items-center justify-between'>
                <span>{error.message}</span>
                {error.link && (
                  <Link
                    to={error.link}
                    className='underline font-bold ml-4 whitespace-nowrap'
                  >
                    Go to Settings
                  </Link>
                )}
              </Card>
            )}
            {applyingAll && (
              <Card className='relative overflow-hidden border border-[#2dd4bf]/30 bg-gradient-to-br from-background via-background/98 to-background/95 text-foreground p-4 sm:p-5'>
                <div className='pointer-events-none absolute -inset-32 bg-[#2dd4bf]/10 blur-3xl opacity-40' />
                <div className='relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
                  <div className='flex items-center gap-3'>
                    <Loader2 className='w-5 h-5 animate-spin text-[#2dd4bf]' />
                    <div>
                      <div className='text-sm font-medium'>
                        Automation in progress
                      </div>
                      <div className='text-xs text-foreground/70'>
                        {applyProgress.total} roles • {applyProgress.success}{" "}
                        successful / {applyProgress.fail} flagged
                      </div>
                    </div>
                  </div>
                  <div className='text-xs text-foreground/50'>
                    {applyProgress.done}/{applyProgress.total} completed
                  </div>
                </div>
                <div className='relative mt-4 h-2 rounded-full bg-foreground/12 overflow-hidden'>
                  <motion.div
                    className='absolute inset-0 opacity-30'
                    style={{
                      background:
                        "linear-gradient(90deg, transparent 0%, rgba(45,212,191,0.6) 50%, transparent 100%)",
                    }}
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{
                      repeat: Infinity,
                      duration: 1.4,
                      ease: "linear",
                    }}
                  />
                  <motion.div
                    className='relative h-full bg-gradient-to-r from-[#22d3ee] via-[#22d3ee] to-[#0d9488]'
                    initial={{ width: "0%" }}
                    animate={{
                      width: `${Math.min(100, Math.round((applyProgress.done / Math.max(1, applyProgress.total)) * 100))}%`,
                    }}
                    transition={{ type: "spring", stiffness: 160, damping: 25 }}
                  />
                </div>
              </Card>
            )}

            {queueStatus === "empty" && !incrementalMode && (
              <div className='relative min-h-[600px] flex items-center justify-center py-12'>
                {/* Ambient Background Effects */}
                <div className='absolute inset-0 overflow-hidden rounded-3xl'>
                  <div className='absolute top-1/4 left-1/4 w-96 h-96 bg-[#2dd4bf]/5 rounded-full blur-3xl animate-pulse' />
                  <div className='absolute bottom-1/4 right-1/4 w-80 h-80 bg-background/5 rounded-full blur-3xl animate-pulse delay-1000' />
                </div>

                {/* Main Content */}
                <Card className='relative z-10 max-w-2xl mx-auto bg-gradient-to-br from-background via-background/95 to-background/90 border border-[#2dd4bf]/20 backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,0.8),0_0_0_1px_rgba(45,212,191,0.1)]'>
                  <div className='p-8 sm:p-12 text-center space-y-8'>
                    {/* Icon Container with Animation */}
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className='relative mx-auto w-32 h-32'
                    >
                      {/* Glowing Ring */}
                      <div className='absolute inset-0 rounded-full bg-gradient-to-br from-[#22d3ee]/20 to-background/10 blur-xl animate-pulse' />

                      {/* Icon Background */}
                      <div className='relative w-full h-full rounded-full bg-gradient-to-br from-[#22d3ee]/10 to-background/5 border border-[#2dd4bf]/30 flex items-center justify-center shadow-[0_0_40px_rgba(45,212,191,0.15)]'>
                        <Briefcase
                          className='w-16 h-16 text-[#2dd4bf] drop-shadow-[0_0_20px_rgba(45,212,191,0.6)]'
                          strokeWidth={1.5}
                        />
                      </div>

                      {/* Floating Particles */}
                      <div className='absolute -top-2 -right-2 w-3 h-3 rounded-full bg-[#2dd4bf] animate-ping opacity-40' />
                      <div className='absolute -bottom-2 -left-2 w-2 h-2 rounded-full bg-background animate-ping opacity-40 delay-500' />
                    </motion.div>

                    {/* Text Content */}
                    <div className='space-y-4'>
                      <motion.h2
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        className='text-3xl sm:text-4xl font-bold bg-gradient-to-r from-foreground via-[#ffffff] to-foreground/60 bg-clip-text text-transparent'
                      >
                        No Jobs Yet
                      </motion.h2>

                      <motion.p
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3, duration: 0.5 }}
                        className='text-base sm:text-lg text-foreground/60 max-w-md mx-auto leading-relaxed'
                      >
                        Your personalized job feed is empty. Start discovering
                        opportunities tailored to your profile and career goals.
                      </motion.p>

                      {lastReason && (
                        <motion.div
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.4, duration: 0.5 }}
                          className='inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#ff8b8b]/10 border border-[#ff8b8b]/20 text-[#ff8b8b] text-sm'
                        >
                          <AlertTriangle className='w-4 h-4' />
                          <span>
                            {lastReason === "no_sources" &&
                              "Try broadening your search criteria"}
                            {lastReason === "no_structured_results" &&
                              "Unable to parse job sources"}
                          </span>
                        </motion.div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.5, duration: 0.5 }}
                      className='flex flex-col sm:flex-row items-center justify-center gap-4 pt-4'
                    >
                      <Button
                        onClick={() =>
                          populateQueue(
                            searchQuery || "software engineer",
                            selectedLocation,
                          )
                        }
                        disabled={incrementalMode}
                        className='group relative overflow-hidden px-8 py-6 rounded-xl bg-gradient-to-r from-[#22d3ee] to-background text- font-semibold text-base shadow-[0_0_0_1px_#2dd4bf,0_8px_32px_rgba(45,212,191,0.4)] hover:shadow-[0_0_0_1px_#2dd4bf,0_12px_48px_rgba(45,212,191,0.6)] transition-all duration-300 hover:scale-105 active:scale-95'
                      >
                        <span className='relative z-10 flex items-center gap-3'>
                          <Search className='w-5 h-5' />
                          Find New Jobs
                        </span>
                        <div className='absolute inset-0 bg-gradient-to-r from-foreground/0 via-foreground/20 to-foreground/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700' />
                      </Button>

                      <Button
                        onClick={() => navigate("/dashboard/profile")}
                        variant='ghost'
                        className='px-6 py-6 rounded-xl border border-foreground/10 text-foreground hover:bg-foreground/5 hover:border-[#2dd4bf]/40 transition-all duration-300'
                      >
                        <span className='flex items-center gap-2'>
                          <User className='w-4 h-4' />
                          Update Profile
                        </span>
                      </Button>
                    </motion.div>

                    {/* Feature Highlights */}
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.6, duration: 0.5 }}
                      className='grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8 border-t border-foreground/5'
                    >
                      {[
                        {
                          icon: Sparkles,
                          label: "AI-Powered",
                          desc: "Smart matching",
                        },
                        {
                          icon: Clock3,
                          label: "Real-time",
                          desc: "Latest openings",
                        },
                        {
                          icon: ShieldCheck,
                          label: "Verified",
                          desc: "Quality jobs",
                        },
                      ].map((feature) => (
                        <div
                          key={feature.label}
                          className='flex flex-col items-center gap-2 p-4 rounded-lg bg-foreground/5 border border-foreground/5 hover:border-[#2dd4bf]/20 transition-colors'
                        >
                          <feature.icon className='w-5 h-5 text-[#2dd4bf]' />
                          <div className='text-center'>
                            <div className='text-sm font-medium text-foreground'>
                              {feature.label}
                            </div>
                            <div className='text-xs text-foreground/40'>
                              {feature.desc}
                            </div>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  </div>
                </Card>
              </div>
            )}

            {queueStatus === "ready" &&
              paginatedJobs.map((job, index) => (
                <motion.div
                  key={job.id}
                  role='button'
                  aria-selected={selectedJob === job.id}
                  tabIndex={0}
                  data-tour={index === 0 ? "jobs-card" : undefined}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedJob(job.id);
                    }
                    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                      e.preventDefault();
                      const idx = paginatedJobs.findIndex(
                        (j) => j.id === job.id,
                      );
                      if (idx !== -1) {
                        const nextIdx =
                          e.key === "ArrowDown"
                            ? Math.min(paginatedJobs.length - 1, idx + 1)
                            : Math.max(0, idx - 1);
                        const nextId = paginatedJobs[nextIdx]?.id;
                        if (nextId) setSelectedJob(nextId);
                      }
                    }
                  }}
                  onClick={() => setSelectedJob(job.id)}
                  className={`cursor-pointer group focus:outline-none rounded-2xl transition-all duration-300 ${selectedJob === job.id ? "transform scale-[1.02]" : "hover:scale-[1.01]"}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.04 }}
                >
                  <div
                    className={`relative overflow-hidden rounded-2xl border transition-all duration-300 p-5 sm:p-6 ${
                      selectedJob === job.id
                        ? "bg-background border-[#2dd4bf] shadow-[0_0_30px_rgba(45,212,191,0.15)]"
                        : "bg-gradient-to-br from-background to-background/95 border-foreground/5 hover:border-[#2dd4bf]/30 hover:shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
                    }`}
                  >
                    {/* Selection Indicator Line */}
                    <div
                      className={`absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 ${
                        selectedJob === job.id
                          ? "bg-[#2dd4bf]"
                          : "bg-transparent group-hover:bg-[#2dd4bf]/50"
                      }`}
                    />

                    {/* Glass highlight effect on hover */}
                    <div className='absolute inset-0 bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 pointer-events-none' />

                    <div className='flex items-start gap-4 sm:gap-5'>
                      {/* Logo Section */}
                      <div className='flex-shrink-0'>
                        {job.logoUrl && !logoError[job.id] ? (
                          <div className='w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-foreground p-2 shadow-lg shadow-/20 ring-1 ring-/5'>
                            <img
                              src={job.logoUrl}
                              alt={job.company}
                              className='w-full h-full object-contain'
                              onError={() =>
                                setLogoError((e) => ({ ...e, [job.id]: true }))
                              }
                            />
                          </div>
                        ) : (
                          <div className='w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-[#22d3ee] to-background flex items-center justify-center text- font-bold text-xl shadow-[0_0_15px_rgba(45,212,191,0.2)]'>
                            {job.logo}
                          </div>
                        )}
                      </div>

                      {/* Content Section */}
                      <div className='flex-1 min-w-0 space-y-3'>
                        {/* Header: Title + Status Badges */}
                        <div className='flex flex-col sm:flex-row sm:items-start justify-between gap-2'>
                          <div className='space-y-1'>
                            <h3
                              className={`font-bold text-lg sm:text-xl leading-tight transition-colors ${
                                selectedJob === job.id
                                  ? "text-[#2dd4bf]"
                                  : "text-foreground group-hover:text-[#2dd4bf]"
                              }`}
                              title={job.title}
                            >
                              {job.title}
                            </h3>
                            <div className='flex items-center gap-2 text-sm text-gray-400 font-medium'>
                              <span className='truncate max-w-[200px]'>
                                {job.company}
                              </span>
                              {job.posted_at && (
                                <>
                                  <span className='w-1 h-1 rounded-full bg-gray-600' />
                                  <span className='text-gray-500 text-xs'>
                                    {formatRelative(job.posted_at)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Badges */}
                          <div className='flex flex-wrap items-center gap-2 flex-shrink-0'>
                            {(() => {
                              if (!job.posted_at) return null;
                              const postedTs = Date.parse(job.posted_at);
                              if (Number.isNaN(postedTs)) return null;
                              const isNew =
                                Date.now() - postedTs <= 48 * 60 * 60 * 1000;
                              if (isNew) {
                                return (
                                  <span className='inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-[#2dd4bf]/10 text-[#2dd4bf] border border-[#2dd4bf]/20 shadow-[0_0_10px_rgba(45,212,191,0.1)]'>
                                    New
                                  </span>
                                );
                              }
                              return null;
                            })()}
                            {job.matchScore && job.matchScore >= 80 && (
                              <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-gradient-to-r from-[#22d3ee]/20 to-[#0d9488]/5 text-[#2dd4bf] border border-[#2dd4bf]/20'>
                                <Sparkles className='w-3 h-3' />
                                {job.matchScore}% Match
                              </span>
                            )}
                            {job.status && (
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                                  job.status === "applied"
                                    ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                                    : "bg-foreground/5 text-gray-400 border-foreground/10"
                                }`}
                              >
                                {job.status}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Metadata Chips - Redesigned as clear pills */}
                        <div className='flex flex-wrap items-center gap-2'>
                          {/* Location */}
                          {(job.location || job.remote_type) && (
                            <div className='inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-foreground/5 border border-foreground/10 text-xs text-gray-300'>
                              <MapPin className='w-3.5 h-3.5 text-gray-500' />
                              <span className='truncate max-w-[150px]'>
                                {[job.location, job.remote_type]
                                  .filter(Boolean)
                                  .join(" • ")}
                              </span>
                            </div>
                          )}

                          {/* Salary */}
                          {(() => {
                            if (
                              job.salary_min ||
                              job.salary_max ||
                              job.salary_currency
                            ) {
                              const currency = job.salary_currency || "USD";
                              const currencySymbol =
                                currency === "USD"
                                  ? "$"
                                  : currency === "GBP"
                                    ? "£"
                                    : currency === "EUR"
                                      ? "€"
                                      : currency;
                              let salaryText = "";
                              if (job.salary_min && job.salary_max) {
                                const min =
                                  job.salary_min >= 1000
                                    ? `${Math.round(job.salary_min / 1000)}k`
                                    : job.salary_min;
                                const max =
                                  job.salary_max >= 1000
                                    ? `${Math.round(job.salary_max / 1000)}k`
                                    : job.salary_max;
                                salaryText = `${currencySymbol}${min}-${max}`;
                              } else if (job.salary_min) {
                                const min =
                                  job.salary_min >= 1000
                                    ? `${Math.round(job.salary_min / 1000)}k`
                                    : job.salary_min;
                                salaryText = `${currencySymbol}${min}+`;
                              } else if (job.salary_max) {
                                const max =
                                  job.salary_max >= 1000
                                    ? `${Math.round(job.salary_max / 1000)}k`
                                    : job.salary_max;
                                salaryText = `Up to ${currencySymbol}${max}`;
                              }
                              if (salaryText) {
                                return (
                                  <div className='inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#2dd4bf]/5 border border-[#2dd4bf]/10 text-xs text-gray-200'>
                                    <span className='text-base leading-none'>
                                      💰
                                    </span>
                                    <span className='font-medium text-[#2dd4bf]'>
                                      {salaryText}
                                    </span>
                                  </div>
                                );
                              }
                            }
                            // Fallback string salary
                            const raw = (job as any)?.raw_data;
                            const salary = (raw?.scraped_data?.salary ||
                              raw?.salaryRange ||
                              raw?.salary) as string | undefined;
                            if (salary) {
                              const short =
                                salary.length > 28
                                  ? salary.slice(0, 25) + "…"
                                  : salary;
                              return (
                                <div className='inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-foreground/5 border border-foreground/10 text-xs text-gray-300'>
                                  <span className='text-xs text-gray-500'>
                                    $
                                  </span>
                                  <span>{short}</span>
                                </div>
                              );
                            }
                            return null;
                          })()}

                          {/* Source Host */}
                          {(job.apply_url ||
                            (job as any)?.raw_data?.sourceUrl ||
                            job.source_id) &&
                            (() => {
                              const href =
                                job.apply_url ||
                                (job as any)?.raw_data?.sourceUrl ||
                                job.source_id ||
                                "";
                              const host = getHost(href);
                              const ico = host
                                ? `https://www.google.com/s2/favicons?domain=${host}&sz=64`
                                : "";
                              if (!host) return null;
                              return (
                                <div className='inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-foreground/5 border border-foreground/10 text-xs text-gray-300 opacity-80 hover:opacity-100 transition-opacity'>
                                  <img
                                    src={ico}
                                    alt=''
                                    className='w-3.5 h-3.5 rounded-sm opacity-70'
                                    onError={(e) =>
                                      ((
                                        e.target as HTMLImageElement
                                      ).style.display = "none")
                                    }
                                  />
                                  <span className='truncate max-w-[100px]'>
                                    {host}
                                  </span>
                                </div>
                              );
                            })()}
                        </div>

                        {/* Line 3: Tags / Skills */}
                        <div className='flex flex-wrap items-center gap-1.5 pt-1'>
                          {(() => {
                            const tags: string[] | undefined =
                              (job as any)?.tags ||
                              (job as any)?.raw_data?.scraped_data?.tags;
                            if (
                              !tags ||
                              !Array.isArray(tags) ||
                              tags.length === 0
                            )
                              return null;
                            return tags.slice(0, 4).map((t, i) => (
                              <span
                                key={`t-${i}`}
                                className='inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-foreground/[0.03] border border-foreground/[0.08] text-gray-400 hover:text-foreground transition-colors cursor-default'
                              >
                                {t}
                              </span>
                            ));
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            {queueStatus === "ready" && total > 0 && (
              <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 pt-3 sm:pt-4'>
                <div className='text-[11px] sm:text-[12px] text-foreground/60'>
                  Showing{" "}
                  <span className='text-foreground/80'>
                    {total === 0 ? 0 : startIdx + 1}
                  </span>
                  –<span className='text-foreground/80'>{endIdx}</span> of{" "}
                  <span className='text-foreground/80'>{total}</span>
                </div>
                <div className='flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 md:gap-4'>
                  <div className='flex items-center gap-1.5 sm:gap-2'>
                    <span className='text-[10px] sm:text-[11px] text-foreground/50'>
                      Rows
                    </span>
                    <SimpleDropdown
                      value={String(pageSize)}
                      onValueChange={(v) => {
                        const n = parseInt(v);
                        if (!Number.isNaN(n)) {
                          setPageSize(n);
                          setCurrentPage(1);
                        }
                      }}
                      options={[
                        { value: "10", label: "10" },
                        { value: "20", label: "20" },
                        { value: "50", label: "50" },
                      ]}
                      triggerClassName='h-7 w-[80px] sm:h-8 sm:w-[90px] text-xs sm:text-sm'
                    />
                  </div>
                  <div className='flex items-center gap-1'>
                    <button
                      type='button'
                      aria-label='First page'
                      disabled={clampedPage === 1}
                      onClick={() => setCurrentPage(1)}
                      className={`h-7 w-7 sm:h-8 sm:w-8 grid place-items-center rounded-md border text-xs sm:text-sm ${clampedPage === 1 ? "border-foreground/10 text-foreground/30" : "border-foreground/20 text-foreground/70 hover:text-foreground hover:border-foreground/40 hover:bg-foreground/10"}`}
                    >
                      <ChevronsLeft className='w-3.5 h-3.5 sm:w-4 sm:h-4' />
                    </button>
                    <button
                      type='button'
                      aria-label='Previous page'
                      disabled={clampedPage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className={`h-7 w-7 sm:h-8 sm:w-8 grid place-items-center rounded-md border text-xs sm:text-sm ${clampedPage === 1 ? "border-foreground/10 text-foreground/30" : "border-foreground/20 text-foreground/70 hover:text-foreground hover:border-foreground/40 hover:bg-foreground/10"}`}
                    >
                      <ChevronLeft className='w-3.5 h-3.5 sm:w-4 sm:h-4' />
                    </button>
                    <div className='hidden md:flex items-center gap-1'>
                      {(() => {
                        const pages: (number | "…")[] = [];
                        const maxToShow = 5;
                        let start = Math.max(1, clampedPage - 2);
                        let end = Math.min(totalPages, start + maxToShow - 1);
                        start = Math.max(1, end - maxToShow + 1);
                        if (start > 1) pages.push(1, "…");
                        for (let i = start; i <= end; i++) pages.push(i);
                        if (end < totalPages) pages.push("…", totalPages);
                        return pages.map((p, idx) =>
                          typeof p === "number" ? (
                            <button
                              key={idx}
                              onClick={() => setCurrentPage(p)}
                              className={`h-8 min-w-8 px-2 rounded-md border text-[12px] ${p === clampedPage ? "border-[#2dd4bf]/50 text-[#2dd4bf] bg-[#2dd4bf]/10" : "border-foreground/20 text-foreground/70 hover:text-foreground hover:border-foreground/40 hover:bg-foreground/10"}`}
                            >
                              {p}
                            </button>
                          ) : (
                            <span key={idx} className='px-2 text-foreground/40'>
                              …
                            </span>
                          ),
                        );
                      })()}
                    </div>
                    <button
                      type='button'
                      aria-label='Next page'
                      disabled={clampedPage === totalPages}
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      className={`h-8 w-8 grid place-items-center rounded-md border ${clampedPage === totalPages ? "border-foreground/10 text-foreground/30" : "border-foreground/20 text-foreground/70 hover:text-foreground hover:border-foreground/40 hover:bg-foreground/10"}`}
                    >
                      <ChevronRight className='w-4 h-4' />
                    </button>
                    <button
                      type='button'
                      aria-label='Last page'
                      disabled={clampedPage === totalPages}
                      onClick={() => setCurrentPage(totalPages)}
                      className={`h-8 w-8 grid place-items-center rounded-md border ${clampedPage === totalPages ? "border-foreground/10 text-foreground/30" : "border-foreground/20 text-foreground/70 hover:text-foreground hover:border-foreground/40 hover:bg-foreground/10"}`}
                    >
                      <ChevronsRight className='w-4 h-4' />
                    </button>
                  </div>
                  <div className='md:hidden text-[12px] text-foreground/60 text-right'>
                    Page {clampedPage} of {totalPages}
                  </div>
                </div>
              </div>
            )}

            {debugMode && (
              <Card className='bg-background border border-foreground/10 p-4'>
                <div className='text-xs text-foreground/60 mb-2'>
                  Debug Panel - Simplified Flow
                </div>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-[#d1d5db]'>
                  <div>
                    <div className='text-[#9ca3af] mb-1'>
                      jobs-search request
                    </div>
                    <pre className='bg-[#111] p-2 rounded overflow-auto max-h-48'>
                      {JSON.stringify(dbgSearchReq, null, 2) || "—"}
                    </pre>
                  </div>
                  <div>
                    <div className='text-[#9ca3af] mb-1'>
                      jobs-search response
                    </div>
                    <pre className='bg-[#111] p-2 rounded overflow-auto max-h-48'>
                      {JSON.stringify(dbgSearchRes, null, 2) || "—"}
                    </pre>
                  </div>
                </div>
                <div className='mt-3 text-[10px] text-[#666] italic'>
                  Note: Jobs are now saved directly by jobs-search. No
                  extraction phase needed.
                </div>
              </Card>
            )}
          </div>

          {/* Right Column: Job Details Panel */}
          <div className='hidden lg:block'>
            {selectedJob &&
              (() => {
                const job = jobs.find((j) => j.id === selectedJob);
                if (!job) return null;
                return (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.45 }}
                  >
                    <div className='space-y-4'>
                      {(() => {
                        const primaryHref =
                          job.apply_url ||
                          (job as any)?.raw_data?.sourceUrl ||
                          job.source_id;
                        const siteHost = primaryHref
                          ? getHost(primaryHref)
                          : "";
                        const ico = siteHost
                          ? `https://www.google.com/s2/favicons?domain=${siteHost}&sz=64`
                          : "";
                        const employmentType =
                          (job as any)?.employment_type ??
                          (job as any)?.raw_data?.scraped_data?.employment_type;
                        const experienceLevel =
                          (job as any)?.experience_level ??
                          (job as any)?.raw_data?.scraped_data
                            ?.experience_level;
                        const deadline =
                          job.expires_at ||
                          (job as any)?.raw_data?.deadline ||
                          (job as any)?.raw_data?.applicationDeadline;
                        const deadlineMeta = deadline
                          ? formatDeadlineMeta(deadline)
                          : null;

                        let salaryText: string | null = null;
                        if (
                          job.salary_min ||
                          job.salary_max ||
                          job.salary_currency
                        ) {
                          const currency = job.salary_currency || "USD";
                          const currencySymbol =
                            currency === "USD"
                              ? "$"
                              : currency === "GBP"
                                ? "£"
                                : currency === "EUR"
                                  ? "€"
                                  : currency;
                          if (job.salary_min && job.salary_max)
                            salaryText = `${currencySymbol}${job.salary_min.toLocaleString()} - ${currencySymbol}${job.salary_max.toLocaleString()}`;
                          else if (job.salary_min)
                            salaryText = `${currencySymbol}${job.salary_min.toLocaleString()}+`;
                          else if (job.salary_max)
                            salaryText = `Up to ${currencySymbol}${job.salary_max.toLocaleString()}`;
                        }
                        if (!salaryText) {
                          const raw = (job as any)?.raw_data;
                          const salary = (raw?.scraped_data?.salary ||
                            raw?.salaryRange ||
                            raw?.salary) as string | undefined;
                          if (salary) salaryText = salary;
                        }

                        const metaTiles = [
                          job.location
                            ? { label: "Location", value: job.location }
                            : null,
                          job.remote_type
                            ? { label: "Remote", value: job.remote_type }
                            : null,
                          employmentType
                            ? { label: "Type", value: employmentType }
                            : null,
                          experienceLevel
                            ? { label: "Level", value: experienceLevel }
                            : null,
                          deadlineMeta
                            ? {
                                label: "Deadline",
                                value: deadlineMeta.label,
                                tone: deadlineMeta.level,
                              }
                            : null,
                          salaryText
                            ? { label: "Compensation", value: salaryText }
                            : null,
                        ].filter(Boolean) as {
                          label: string;
                          value: string;
                          tone?: "urgent" | "soon" | "future";
                        }[];

                        return (
                          <Card
                            id='jobs-ai-match'
                            data-tour='jobs-ai-match'
                            className='relative overflow-hidden border border-[#2dd4bf]/20 bg-gradient-to-br from-background via-background to-background p-6'
                          >
                            <span className='pointer-events-none absolute -top-24 -right-12 h-56 w-56 rounded-full bg-[#2dd4bf]/20 blur-3xl opacity-60' />
                            <div className='relative flex flex-col gap-5'>
                              {/* Header row: logo + info + action buttons */}
                              <div className='flex items-start gap-3 sm:gap-4'>
                                  {/* Logo */}
                                  {job.logoUrl && !logoError[job.id] ? (
                                    <img
                                      src={job.logoUrl}
                                      alt={job.company}
                                      className='w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-xl object-contain bg-foreground flex-shrink-0'
                                      onError={() =>
                                        setLogoError((e) => ({
                                          ...e,
                                          [job.id]: true,
                                        }))
                                      }
                                    />
                                  ) : (
                                    <div className='w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-gradient-to-r from-[#22d3ee] to-background rounded-xl flex items-center justify-center font-bold text-lg sm:text-xl md:text-2xl flex-shrink-0'>
                                      {job.logo}
                                    </div>
                                  )}

                                  {/* Content + buttons */}
                                  <div className='flex-1 min-w-0'>
                                    <div className='flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3'>
                                      {/* Title & meta */}
                                      <div className='flex-1 min-w-0 space-y-1.5'>
                                    <div className='inline-flex items-center gap-2 flex-wrap text-[11px] uppercase tracking-[0.3em] text-[#2dd4bf]/80'>
                                      <Sparkles className='w-3 h-3' />
                                      Featured Job
                                    </div>
                                    <h1
                                      className='text-base sm:text-lg md:text-xl font-semibold text-foreground leading-tight line-clamp-3'
                                      title={job.title}
                                    >
                                      {job.title}
                                    </h1>
                                    <div className='flex flex-wrap items-center gap-2 text-sm text-foreground/70'>
                                      <span className='font-medium text-foreground/90 whitespace-nowrap'>
                                        {job.company}
                                      </span>
                                      {siteHost && (
                                        <span
                                          className='inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border border-foreground/10 bg-foreground/5 text-foreground/60 whitespace-nowrap flex-shrink-0'
                                          title={primaryHref || undefined}
                                        >
                                          {ico && (
                                            <img
                                              src={ico}
                                              alt=''
                                              className='w-3 h-3 rounded'
                                              onError={(e) =>
                                                ((
                                                  e.target as HTMLImageElement
                                                ).style.display = "none")
                                              }
                                            />
                                          )}
                                          {siteHost}
                                        </span>
                                      )}
                                      {job.posted_at && (
                                        <span className='text-[11px] px-2 py-1 rounded-full border border-foreground/10 text-foreground/50 bg-foreground/5 whitespace-nowrap flex-shrink-0'>
                                          Posted {formatRelative(job.posted_at)}
                                        </span>
                                      )}
                                    </div>
                                      </div>

                                      {/* Action buttons — inline on sm+ */}
                                      <div className='flex flex-shrink-0 items-center gap-2'>
                                  {primaryHref && (
                                    <a
                                      href={primaryHref}
                                      target='_blank'
                                      rel='noopener noreferrer'
                                      className='inline-flex items-center justify-center gap-2 rounded-lg border border-[#2dd4bf]/50 bg-[#2dd4bf]/15 px-3 py-1.5 text-sm font-medium text-[#2dd4bf] transition hover:bg-[#2dd4bf]/25 hover:shadow-[0_10px_30px_rgba(45,212,191,0.2)] whitespace-nowrap'
                                    >
                                      View Posting
                                    </a>
                                  )}
                                  <Button
                                    variant='ghost'
                                    onClick={() => openAutoApplyFlow(job)}
                                    className='inline-flex items-center justify-center gap-2 rounded-lg border border-[#2dd4bf]/40 bg-gradient-to-r from-[#22d3ee]/10 via-transparent to-[#0d9488]/10 px-3 py-1.5 text-sm font-medium text-foreground transition hover:from-[#22d3ee]/20 hover:to-[#0d9488]/5 whitespace-nowrap'
                                    title='Launch auto apply suite for this job'
                                  >
                                    <Briefcase className='w-4 h-4' />
                                    Auto Apply Suite
                                    {!hasAutoApplyAccess && (
                                      <Lock className='w-3 h-3 opacity-60' />
                                    )}
                                  </Button>
                                      </div>
                                    </div>
                                  </div>
                              </div>

                              {metaTiles.length > 0 && (
                                <div className='flex flex-wrap gap-3'>
                                  {metaTiles.map((tile) => (
                                    <div
                                      key={`${tile.label}-${tile.value}`}
                                      className='rounded-xl border border-foreground/10 bg-foreground/5 px-3 py-2.5 min-w-[120px]'
                                    >
                                      <div className='text-[11px] uppercase tracking-wide text-foreground/40'>
                                        {tile.label}
                                      </div>
                                      <div
                                        className={`text-sm font-medium ${tile.tone === "urgent" ? "text-[#ff8b8b]" : tile.tone === "soon" ? "text-[#ffd78b]" : tile.tone === "future" ? "text-[#8bffb1]" : "text-foreground/85"}`}
                                      >
                                        {tile.value}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </Card>
                        );
                      })()}

                      <Card className='border border-border bg-card/80 p-6'>
                        <div className='flex items-center justify-between mb-4'>
                          <div className='inline-flex items-center gap-2 text-sm font-medium text-foreground/80'>
                            <FileText className='w-4 h-4 text-[#2dd4bf]' />
                            Job Description
                          </div>
                          <span className='text-[11px] uppercase tracking-wide text-foreground/35'>
                            Full brief
                          </span>
                        </div>
                        <MarkdownContent
                          content={job.description}
                          className='max-h-[32rem] overflow-y-auto pr-2'
                        />
                      </Card>

                      {/* AI Match Score Card - Gated for Basics+ */}
                      {!hasMatchScoreAccess ? (
                        <UpgradePrompt
                          title='AI Match Score Analysis'
                          description='Get detailed compatibility insights powered by advanced AI to find your perfect job match.'
                          features={[
                            {
                              icon: <Target className='h-5 w-5' />,
                              title: "Skills Compatibility",
                              description:
                                "See how your skills align with job requirements",
                            },
                            {
                              icon: <TrendingUp className='h-5 w-5' />,
                              title: "Experience Match",
                              description:
                                "Understand if your experience level fits",
                            },
                            {
                              icon: <Sparkles className='h-5 w-5' />,
                              title: "AI-Powered Insights",
                              description:
                                "Get smart recommendations for improvement",
                            },
                          ]}
                          requiredTier='Basics'
                          icon={
                            <Sparkles className='h-12 w-12 text-[#2dd4bf]' />
                          }
                          compact={true}
                        />
                      ) : (
                        <MatchScorePieChart
                          score={
                            typeof job.matchScore === "number"
                              ? job.matchScore
                              : 75
                          }
                          summary={job.matchSummary || "Match score analysis"}
                          breakdown={job.matchBreakdown}
                        />
                      )}

                      {hasJobEvaluationAccess ? (
                        <JobEvaluationReport
                          evaluation={evaluationReports[job.id] ?? null}
                          loading={Boolean(evaluationLoadingByJob[job.id])}
                          savedStoryTitles={savedStoryTitles}
                          onSaveStory={saveInterviewStoryToMemory}
                        />
                      ) : (
                        <JobEvaluationTeaser
                          jobTitle={job.title || "Role"}
                          company={job.company}
                          descriptionPreview={job.description || undefined}
                        />
                      )}

                      {(() => {
                        const screenshot = (job as any)?.raw_data?.screenshot;
                        if (!screenshot) return null;
                        return (
                          <Card className='relative overflow-hidden border border-foreground/12 bg-background p-0'>
                            <div className='flex items-center justify-between px-4 py-3 border-b border-foreground/10 bg-foreground/5'>
                              <div className='inline-flex items-center gap-2 text-sm font-medium text-foreground/75'>
                                <Sparkles className='w-4 h-4 text-[#2dd4bf]' />
                                Screenshot
                              </div>
                              <span className='text-[11px] uppercase tracking-wide text-foreground/35'>
                                Visual preview
                              </span>
                            </div>
                            <div className='relative bg-background'>
                              <img
                                src={getProxiedLogoUrl(screenshot)}
                                alt='Job page screenshot'
                                className='w-full h-auto'
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = "none";
                                  const parent = target.parentElement;
                                  if (parent) {
                                    parent.innerHTML =
                                      '<div class="p-6 text-center text-foreground/40 text-sm">Screenshot unavailable</div>';
                                  }
                                }}
                              />
                              <span className='pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-/50' />
                            </div>
                          </Card>
                        );
                      })()}

                      {(() => {
                        const sources = (job as any)?.raw_data?._sources;
                        if (
                          !sources ||
                          (Array.isArray(sources) && sources.length === 0)
                        )
                          return null;
                        const items: any[] = Array.isArray(sources)
                          ? sources
                          : [sources];
                        return (
                          <Card className='border border-foreground/12 bg-gradient-to-br from-background via-background to-background p-6'>
                            <div className='flex items-center justify-between mb-3'>
                              <div className='inline-flex items-center gap-2 text-sm font-medium text-foreground/75'>
                                <ShieldCheck className='w-4 h-4 text-[#2dd4bf]' />
                                Source Intelligence
                              </div>
                              <span className='text-[11px] uppercase tracking-wide text-foreground/35'>
                                Captured links
                              </span>
                            </div>
                            <ul className='space-y-2'>
                              {items.map((s, i) => {
                                const href =
                                  typeof s === "string"
                                    ? s
                                    : s?.url || s?.source || "";
                                if (!href) return null;
                                const host = getHost(href);
                                const ico = host
                                  ? `https://www.google.com/s2/favicons?domain=${host}&sz=64`
                                  : "";
                                return (
                                  <li
                                    key={i}
                                    className='flex items-center justify-between gap-3 rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2'
                                  >
                                    <div className='flex items-center gap-2'>
                                      {host && (
                                        <img
                                          src={getProxiedLogoUrl(ico)}
                                          alt=''
                                          className='w-4 h-4 rounded'
                                          onError={(e) =>
                                            ((
                                              e.target as HTMLImageElement
                                            ).style.display = "none")
                                          }
                                        />
                                      )}
                                      <a
                                        href={href}
                                        target='_blank'
                                        rel='noopener noreferrer'
                                        className='text-sm text-[#2dd4bf] hover:underline'
                                      >
                                        {host || href}
                                      </a>
                                    </div>
                                    <span className='text-[11px] uppercase tracking-wide text-foreground/30'>
                                      Open
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          </Card>
                        );
                      })()}
                    </div>
                  </motion.div>
                );
              })()}
            {(queueStatus === "loading" || queueStatus === "populating") &&
              !selectedJob && (
                <div className='animate-pulse'>
                  <Card className='relative overflow-hidden bg-gradient-to-br from-foreground/5 to-foreground/5 border border-foreground/10 p-6 mb-6'>
                    <div className='flex items-start gap-4 mb-6'>
                      <div className='w-16 h-16 bg-foreground/10 rounded-xl' />
                      <div className='flex-1 min-w-0'>
                        <div className='h-5 bg-foreground/10 rounded w-1/2 mb-2' />
                        <div className='h-4 bg-foreground/5 rounded w-1/3 mb-3' />
                        <div className='flex items-center gap-2'>
                          <span className='inline-block h-4 w-20 rounded-full bg-foreground/5' />
                          <span className='inline-block h-4 w-16 rounded-full bg-foreground/5' />
                          <span className='inline-block h-4 w-24 rounded-full bg-foreground/5' />
                        </div>
                      </div>
                    </div>
                    <div className='space-y-2'>
                      <div className='h-4 bg-foreground/5 rounded w-full' />
                      <div className='h-4 bg-foreground/5 rounded w-11/12' />
                      <div className='h-4 bg-foreground/5 rounded w-10/12' />
                      <div className='h-4 bg-foreground/5 rounded w-9/12' />
                    </div>
                  </Card>
                </div>
              )}
            {!selectedJob && queueStatus === "ready" && (
              <Card className='bg-gradient-to-br from-foreground/5 to-foreground/5 border border-foreground/10 p-8 text-center'>
                <Briefcase className='w-16 h-16 text-foreground/20 mx-auto mb-4' />
                <h3 className='text-xl font-medium text-foreground mb-2'>
                  Select a job
                </h3>
                <p className='text-foreground/40'>
                  Choose a job from the list to view details
                </p>
              </Card>
            )}
          </div>
        </div>
        {/* Auto Apply orchestration dialog */}
        <Modal
          open={resumeDialogOpen}
          onClose={() => {
            setResumeDialogOpen(false);
            setAutoApplyStep(1);
          }}
          title=''
          size='lg'
          side='center'
        >
          <div className='relative overflow-hidden rounded-2xl border border-[#2dd4bf]/20 bg-gradient-to-br from-background via-background to-background text-foreground'>
            <div className='pointer-events-none absolute -top-32 right-0 h-72 w-72 rounded-full bg-[#2dd4bf]/20 blur-3xl opacity-40' />
            <div className='relative p-6 sm:p-8 space-y-6'>
              <div className='flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6'>
                <div className='space-y-3 max-w-xl'>
                  <div className='inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.35em] text-[#2dd4bf]/80'>
                    <Sparkles className='w-3 h-3' />
                    Auto Apply Suite
                  </div>
                  <h3 className='text-xl sm:text-2xl font-semibold'>
                    {jobToAutoApply
                      ? "Launch suite for selected job"
                      : "Launch enterprise-grade automation"}
                  </h3>
                  <p className='text-sm text-foreground/60'>
                    {jobToAutoApply ? (
                      <>
                        Run the same governed auto apply suite against{" "}
                        <strong>{jobToAutoApply.title}</strong>.
                      </>
                    ) : (
                      <>
                        Deploy applications across{" "}
                        <span className='text-[#2dd4bf] font-medium'>
                          {autoApplyTargetCount}
                        </span>{" "}
                        curated roles with governed pacing, telemetry, and
                        resume intelligence.
                      </>
                    )}
                  </p>
                </div>
                <div className='flex flex-col items-end gap-2 text-right min-w-[150px]'>
                  <div className='text-[11px] uppercase tracking-wide text-foreground/40'>
                    Jobs queued
                  </div>
                  <div className='text-2xl font-semibold text-[#2dd4bf]'>
                    {autoApplyTargetCount}
                  </div>
                  {selectedResume && (
                    <div className='text-[11px] text-foreground/50 truncate max-w-[180px]'>
                      Resume • {selectedResume.name}
                    </div>
                  )}
                  {selectedCoverLetter && (
                    <div className='text-[11px] text-foreground/50 truncate max-w-[180px]'>
                      Cover letter • {selectedCoverLetter.name}
                    </div>
                  )}
                </div>
              </div>

              {loadingTier ? (
                <div className='rounded-xl border border-foreground/12 bg-foreground/[0.02] p-8 text-center'>
                  <div className='mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-[#2dd4bf]' />
                  <p className='text-sm text-foreground/70'>
                    Checking auto apply access...
                  </p>
                </div>
              ) : !hasAutoApplyAccess ? (
                <UpgradePrompt
                  compact
                  requiredTier='Basics'
                  showPricing={false}
                  title='Auto Apply Suite'
                  description='Unlock governed auto apply, AI draft generation, and AI decision checks with Basics or above.'
                />
              ) : null}

              <div className='flex flex-col sm:flex-row gap-3'>
                {autoApplySteps.map((step) => {
                  const status =
                    step.id === autoApplyStep
                      ? "active"
                      : step.id < autoApplyStep
                        ? "done"
                        : "pending";
                  return (
                    <div
                      key={step.id}
                      className={`flex-1 rounded-xl border p-3 sm:p-4 transition-all duration-300 ${
                        status === "active"
                          ? "border-[#2dd4bf]/60 bg-[#2dd4bf]/10 shadow-[0_0_18px_rgba(45,212,191,0.25)]"
                          : status === "done"
                            ? "border-[#2dd4bf]/30 bg-[#2dd4bf]/12 text-foreground/80"
                            : "border-foreground/12 bg-foreground/[0.02] text-foreground/60"
                      }`}
                    >
                      <div className='flex items-center gap-2 text-sm font-medium'>
                        {status === "done" ? (
                          <span className='inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#2dd4bf] text-'>
                            <Check className='w-3.5 h-3.5' />
                          </span>
                        ) : (
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] ${
                              status === "active"
                                ? "border-[#2dd4bf]/70 text-[#2dd4bf]"
                                : "border-foreground/25 text-foreground/35"
                            }`}
                          >
                            0{step.id}
                          </span>
                        )}
                        <span>{step.label}</span>
                      </div>
                      <p className='mt-2 text-xs leading-relaxed text-foreground/60'>
                        {step.description}
                      </p>
                    </div>
                  );
                })}
              </div>

              {autoApplyStep === 1 && (
                <div className='space-y-6'>
                  <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
                    <p className='text-sm text-foreground/60'>
                      Select the resume we attach to each submission. Align the
                      resume with this search persona for the strongest signal.
                    </p>
                    <a
                      href='/dashboard/resumes'
                      className='text-xs inline-flex items-center gap-1 text-[#2dd4bf] hover:text-[#a3ffb5]'
                    >
                      Manage resumes
                    </a>
                  </div>
                  <div className='max-h-72 overflow-y-auto pr-1 space-y-3'>
                    {resumesLoading ? (
                      <div className='grid gap-3'>
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div
                            key={i}
                            className='rounded-xl border border-foreground/12 bg-foreground/[0.03] p-4 animate-pulse'
                          />
                        ))}
                      </div>
                    ) : Array.isArray(resumes) && resumes.length > 0 ? (
                      <div className='grid gap-3'>
                        {resumes.map((r: any) => {
                          const selected = selectedResumeId === r.id;
                          return (
                            <button
                              key={r.id}
                              type='button'
                              onClick={() => setSelectedResumeId(r.id)}
                              className={`group relative flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition-all duration-300 ${
                                selected
                                  ? "border-[#2dd4bf]/60 bg-[#2dd4bf]/12 shadow-[0_0_16px_rgba(45,212,191,0.25)]"
                                  : "border-foreground/12 bg-foreground/[0.02] hover:border-[#2dd4bf]/45 hover:bg-[#2dd4bf]/8"
                              }`}
                            >
                              <div className='min-w-0 space-y-1'>
                                <div className='flex items-center gap-2'>
                                  <span
                                    className='truncate text-sm font-medium text-foreground'
                                    title={r.name}
                                  >
                                    {r.name}
                                  </span>
                                  {r.is_favorite && (
                                    <span className='text-[10px] px-1.5 py-0.5 rounded-full border border-[#2dd4bf]/40 text-[#2dd4bf] bg-[#2dd4bf]/10'>
                                      Preferred
                                    </span>
                                  )}
                                </div>
                                <div className='text-[11px] text-foreground/60 truncate'>
                                  {(r.file_ext || "pdf").toUpperCase()} •{" "}
                                  {r.size
                                    ? `${Math.round(r.size / 1024)} KB`
                                    : "Size unknown"}{" "}
                                  • Updated{" "}
                                  {new Date(r.updated_at).toLocaleDateString()}
                                </div>
                              </div>
                              <span
                                className={`flex-shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full border ${
                                  selected
                                    ? "border-[#2dd4bf]/70 bg-[#2dd4bf] text-"
                                    : "border-foreground/20 text-foreground/40 group-hover:border-[#2dd4bf]/50 group-hover:text-[#2dd4bf]"
                                }`}
                              >
                                {selected ? (
                                  <Check className='w-4 h-4' />
                                ) : (
                                  <FileText className='w-3.5 h-3.5' />
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className='rounded-xl border border-dashed border-foreground/15 bg-foreground/[0.02] p-6 text-center space-y-2'>
                        <p className='text-sm text-foreground/70'>
                          No resumes found.
                        </p>
                        <p className='text-xs text-foreground/50'>
                          Import a resume to personalise each application or
                          proceed without an attachment.
                        </p>
                        <a
                          href='/dashboard/resumes'
                          className='inline-flex items-center gap-2 text-[13px] px-4 py-2 rounded-lg border border-[#2dd4bf]/40 text-[#2dd4bf] bg-[#2dd4bf]/10 hover:bg-[#2dd4bf]/20 transition'
                        >
                          Manage resumes
                        </a>
                      </div>
                    )}
                  </div>
                  <div className='pt-5 border-t border-foreground/12 space-y-4'>
                    <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
                      <p className='text-sm text-foreground/60'>
                        Optionally attach a cover letter from your library.
                        We’ll pair it with each submission when available.
                      </p>
                      <a
                        href='/dashboard/cover-letter'
                        className='text-xs inline-flex items-center gap-1 text-[#2dd4bf] hover:text-[#a3ffb5]'
                      >
                        Manage cover letters
                      </a>
                    </div>
                    <div className='max-h-60 overflow-y-auto pr-1 space-y-3'>
                      {Array.isArray(coverLetterLibrary) &&
                      coverLetterLibrary.length > 0 ? (
                        <div className='grid gap-3'>
                          <button
                            type='button'
                            onClick={() => setSelectedCoverLetterId(null)}
                            className={`group relative flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition-all duration-300 ${
                              !selectedCoverLetterId
                                ? "border-[#2dd4bf]/60 bg-[#2dd4bf]/12 shadow-[0_0_16px_rgba(45,212,191,0.25)]"
                                : "border-foreground/12 bg-foreground/[0.02] hover:border-[#2dd4bf]/45 hover:bg-[#2dd4bf]/8"
                            }`}
                          >
                            <div className='min-w-0 space-y-1'>
                              <div className='flex items-center gap-2'>
                                <span className='truncate text-sm font-medium text-foreground'>
                                  No cover letter
                                </span>
                                <span className='text-[10px] px-1.5 py-0.5 rounded-full border border-foreground/15 text-foreground/60'>
                                  Optional
                                </span>
                              </div>
                              <div className='text-[11px] text-foreground/50'>
                                Proceed without attaching a letter.
                              </div>
                            </div>
                            <span
                              className={`flex-shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full border ${
                                !selectedCoverLetterId
                                  ? "border-[#2dd4bf]/70 bg-[#2dd4bf] text-"
                                  : "border-foreground/20 text-foreground/40 group-hover:border-[#2dd4bf]/50 group-hover:text-[#2dd4bf]"
                              }`}
                            >
                              {!selectedCoverLetterId ? (
                                <Check className='w-4 h-4' />
                              ) : (
                                <FileText className='w-3.5 h-3.5' />
                              )}
                            </span>
                          </button>
                          {coverLetterLibrary.map((entry) => {
                            const selected = selectedCoverLetterId === entry.id;
                            const persona = [
                              entry.data?.role,
                              entry.data?.company,
                            ]
                              .filter(Boolean)
                              .join(" • ");
                            let updatedLabel = "";
                            if (entry.updatedAt) {
                              try {
                                updatedLabel = new Date(
                                  entry.updatedAt,
                                ).toLocaleDateString();
                              } catch {
                                updatedLabel = entry.updatedAt;
                              }
                            }
                            return (
                              <button
                                key={entry.id}
                                type='button'
                                onClick={() =>
                                  setSelectedCoverLetterId(entry.id)
                                }
                                className={`group relative flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition-all duration-300 ${
                                  selected
                                    ? "border-[#2dd4bf]/60 bg-[#2dd4bf]/12 shadow-[0_0_16px_rgba(45,212,191,0.25)]"
                                    : "border-foreground/12 bg-foreground/[0.02] hover:border-[#2dd4bf]/45 hover:bg-[#2dd4bf]/8"
                                }`}
                              >
                                <div className='min-w-0 space-y-1'>
                                  <div className='flex items-center gap-2'>
                                    <span
                                      className='truncate text-sm font-medium text-foreground'
                                      title={entry.name}
                                    >
                                      {entry.name}
                                    </span>
                                    {entry.draft && (
                                      <span className='text-[10px] px-1.5 py-0.5 rounded-full border border-foreground/20 text-foreground/60'>
                                        Draft
                                      </span>
                                    )}
                                  </div>
                                  <div className='text-[11px] text-foreground/60 truncate'>
                                    {persona
                                      ? persona
                                      : entry.draft
                                        ? "Autosaved draft from builder"
                                        : "Reusable cover letter template"}
                                  </div>
                                  {updatedLabel && (
                                    <div className='text-[10px] uppercase tracking-wide text-foreground/35'>
                                      Updated {updatedLabel}
                                    </div>
                                  )}
                                </div>
                                <span
                                  className={`flex-shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full border ${
                                    selected
                                      ? "border-[#2dd4bf]/70 bg-[#2dd4bf] text-"
                                      : "border-foreground/20 text-foreground/40 group-hover:border-[#2dd4bf]/50 group-hover:text-[#2dd4bf]"
                                  }`}
                                >
                                  {selected ? (
                                    <Check className='w-4 h-4' />
                                  ) : (
                                    <FileText className='w-3.5 h-3.5' />
                                  )}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className='rounded-xl border border-dashed border-foreground/15 bg-foreground/[0.02] p-6 text-center space-y-2'>
                          <p className='text-sm text-foreground/70'>
                            No cover letters found.
                          </p>
                          <p className='text-xs text-foreground/50'>
                            Build a cover letter in the workspace to reuse it
                            here or continue without one.
                          </p>
                          <a
                            href='/dashboard/cover-letter'
                            className='inline-flex items-center gap-2 text-[13px] px-4 py-2 rounded-lg border border-[#2dd4bf]/40 text-[#2dd4bf] bg-[#2dd4bf]/10 hover:bg-[#2dd4bf]/20 transition'
                          >
                            Manage cover letters
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {autoApplyStep === 2 && (
                <div className='grid gap-4'>
                  <div className='grid sm:grid-cols-2 gap-4'>
                    <div className='rounded-xl border border-[#2dd4bf]/35 bg-[#2dd4bf]/12 p-4 sm:p-5'>
                      <div className='flex items-center gap-2 text-sm font-medium text-[#ccfbf1]'>
                        <ShieldCheck className='w-4 h-4' />
                        Execution summary
                      </div>
                      <div className='mt-4 flex items-baseline gap-2'>
                        <span className='text-3xl font-semibold text-[#2dd4bf]'>
                          {autoApplyTargetCount}
                        </span>
                        <span className='text-sm text-foreground/75'>
                          {autoApplyTargetCount === 1
                            ? "job targeted"
                            : "jobs targeted"}
                        </span>
                      </div>
                      <p className='mt-3 text-xs text-foreground/70'>
                        Applications are sequenced with rate-limit awareness,
                        logging telemetry to Diagnostics as each job is
                        processed.
                      </p>
                    </div>
                    <div className='rounded-xl border border-foreground/12 bg-foreground/[0.03] p-4 sm:p-5 space-y-3'>
                      <div className='flex items-center gap-2 text-sm font-medium text-foreground/80'>
                        <FileText className='w-4 h-4 text-[#2dd4bf]' />
                        Resume payload
                      </div>
                      {selectedResume ? (
                        <div className='space-y-1 text-sm text-foreground/70'>
                          <div className='text-foreground font-medium'>
                            {selectedResume.name}
                          </div>
                          <div className='text-xs text-foreground/45 uppercase tracking-wide'>
                            {(selectedResume.file_ext || "pdf").toUpperCase()} •
                            Updated{" "}
                            {new Date(
                              selectedResume.updated_at,
                            ).toLocaleDateString()}
                          </div>
                        </div>
                      ) : (
                        <p className='text-xs text-foreground/60'>
                          No resume selected. Applications will submit without
                          an attachment.
                        </p>
                      )}
                      <div className='text-xs text-foreground/40'>
                        Analytics events record resume identifiers for
                        downstream auditing.
                      </div>
                      <div className='pt-4 border-t border-foreground/10 space-y-3'>
                        <div className='flex items-center gap-2 text-sm font-medium text-foreground/80'>
                          <FileText className='w-4 h-4 text-[#2dd4bf]' />
                          Cover letter payload
                        </div>
                        {selectedCoverLetter ? (
                          <div className='space-y-1 text-sm text-foreground/70'>
                            <div className='flex items-center gap-2'>
                              <span className='text-foreground font-medium'>
                                {selectedCoverLetter.name}
                              </span>
                              {selectedCoverLetter.draft && (
                                <span className='text-[10px] px-1.5 py-0.5 rounded-full border border-foreground/20 text-foreground/60'>
                                  Draft
                                </span>
                              )}
                            </div>
                            <div className='text-xs text-foreground/45 uppercase tracking-wide'>
                              {[
                                selectedCoverLetter.data?.role,
                                selectedCoverLetter.data?.company,
                              ]
                                .filter(Boolean)
                                .join(" • ") || "Reusable letter asset"}
                            </div>
                          </div>
                        ) : (
                          <p className='text-xs text-foreground/60'>
                            No cover letter selected. Automation proceeds
                            without an attachment here.
                          </p>
                        )}
                        <div className='text-xs text-foreground/40'>
                          We log cover letter selection for observability but
                          keep attachments optional.
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className='rounded-xl border border-foreground/12 bg-foreground/[0.02] p-4 sm:p-5'>
                    <div className='flex items-center gap-2 text-sm font-medium text-foreground/80'>
                      <Clock3 className='w-4 h-4 text-[#2dd4bf]' />
                      Runbook
                    </div>
                    <ul className='mt-3 space-y-2 text-sm text-foreground/70'>
                      <li className='flex items-start gap-2'>
                        <span className='mt-1 inline-flex h-1.5 w-1.5 rounded-full bg-[#2dd4bf]' />
                        <span>
                          Sequential automation with intelligent retries; cancel
                          anytime from Diagnostics.
                        </span>
                      </li>
                      <li className='flex items-start gap-2'>
                        <span className='mt-1 inline-flex h-1.5 w-1.5 rounded-full bg-[#2dd4bf]' />
                        <span>
                          Each job updates status to{" "}
                          <span className='text-[#2dd4bf]'>applied</span> and
                          emits success or failure analytics.
                        </span>
                      </li>
                      <li className='flex items-start gap-2'>
                        <span className='mt-1 inline-flex h-1.5 w-1.5 rounded-full bg-[#2dd4bf]' />
                        <span>
                          We honour custom apply URLs and respect rate limits to
                          avoid vendor throttling.
                        </span>
                      </li>
                    </ul>
                  </div>

                  {/* True Autonomy Toggle */}
                  <div className='rounded-xl border border-foreground/12 bg-foreground/[0.02] p-4 sm:p-5 flex items-center justify-between'>
                    <div>
                      <div className='flex items-center gap-2 text-sm font-medium text-[#2dd4bf]'>
                        <Sparkles className='w-4 h-4' />
                        True Autonomy
                      </div>
                      <p className='mt-1 text-xs text-foreground/60 max-w-[85%]'>
                        Restricts auto-submit to trusted sources (e.g.
                        Greenhouse, Lever) with &gt;90% match score. Other jobs
                        will safely fallback to Draft Mode.
                      </p>
                    </div>
                    <button
                      type='button'
                      onClick={() =>
                        setTrueAutonomyEnabled(!trueAutonomyEnabled)
                      }
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${trueAutonomyEnabled ? "bg-[#2dd4bf]" : "bg-foreground/20"}`}
                      role='switch'
                      aria-checked={trueAutonomyEnabled}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${trueAutonomyEnabled ? "translate-x-4" : "translate-x-0"}`}
                      />
                    </button>
                  </div>
                </div>
              )}

              {aiEvaluation && autoApplyStep === 2 && (
                <div className='grid gap-4 mt-4'>
                  <div
                    className={`rounded-xl border p-5 ${aiEvaluation.missing_requirements.length > 0 ? "border-[#ff4747]/35 bg-[#ff4747]/10" : "border-[#ffb347]/35 bg-[#ffb347]/10"}`}
                  >
                    <div
                      className={`flex items-center gap-2 text-sm font-medium ${aiEvaluation.missing_requirements.length > 0 ? "text-[#ff4747]" : "text-[#ffb347]"}`}
                    >
                      <AlertTriangle className='w-5 h-5' />
                      AI Decision Boundary Alert
                    </div>

                    <div className='mt-4 flex flex-col sm:flex-row items-baseline gap-4'>
                      <div className='flex items-baseline gap-2'>
                        <span
                          className={`text-3xl font-semibold ${aiEvaluation.confidence_score >= 70 ? "text-[#2dd4bf]" : "text-[#ffb347]"}`}
                        >
                          {aiEvaluation.confidence_score}%
                        </span>
                        <span className='text-sm text-foreground/75'>
                          Confidence Score
                        </span>
                      </div>
                    </div>

                    {aiEvaluation.missing_requirements.length > 0 && (
                      <div className='mt-5 pt-4 border-t border-foreground/10'>
                        <h4 className='text-sm font-medium text-[#ff4747] mb-2'>
                          Strict Missing Requirements:
                        </h4>
                        <ul className='list-disc pl-5 space-y-1 text-sm text-foreground/80'>
                          {aiEvaluation.missing_requirements.map((req, i) => (
                            <li key={i}>{req}</li>
                          ))}
                        </ul>
                        <p className='mt-3 text-xs text-foreground/60'>
                          The AI has determined your profile/resume explicitly
                          lacks these hard requirements. It is strongly
                          recommended to update your profile before applying.
                        </p>
                      </div>
                    )}

                    {aiEvaluation.tailoring_suggestions.length > 0 && (
                      <div className='mt-5 pt-4 border-t border-foreground/10'>
                        <h4 className='text-sm font-medium text-[#ffb347] mb-2'>
                          Tailoring Suggestions:
                        </h4>
                        <ul className='space-y-2 text-sm text-foreground/80'>
                          {aiEvaluation.tailoring_suggestions.map((sug, i) => (
                            <li
                              key={i}
                              className='bg-foreground/5 p-3 rounded-lg border border-foreground/10'
                            >
                              {sug}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className='rounded-xl border border-foreground/12 bg-foreground/[0.03] p-4 space-y-2'>
                    <div className='flex items-center gap-2 text-[11px] uppercase tracking-wider text-foreground/55'>
                      <FileText className='w-3.5 h-3.5' />
                      Resume In Use
                    </div>
                    {selectedResume ? (
                      <>
                        <p className='text-sm font-medium text-foreground'>
                          {selectedResumeName}
                        </p>
                        <div className='flex flex-wrap gap-2 text-xs text-foreground/60'>
                          <span>
                            {(selectedResume as any)?.file_ext
                              ? String((selectedResume as any).file_ext).toUpperCase()
                              : "FILE"}
                          </span>
                          <span>•</span>
                          <span>
                            Updated{" "}
                            {new Date(
                              (selectedResume as any)?.updated_at || Date.now(),
                            ).toLocaleDateString()}
                          </span>
                          {loadingSelectedResumeText && (
                            <>
                              <span>•</span>
                              <span>Reading resume text…</span>
                            </>
                          )}
                        </div>
                        {selectedResumeCandidateName && (
                          <p className='text-sm text-foreground/80 flex items-center gap-2'>
                            <User className='w-3.5 h-3.5 text-[#2dd4bf]' />
                            Detected candidate: {selectedResumeCandidateName}
                          </p>
                        )}
                        {profileFullName && (
                          <p className='text-xs text-foreground/55'>
                            Profile name: {profileFullName}
                          </p>
                        )}
                        {resumeIdentityMismatch && (
                          <p className='text-xs text-[#ffb347]'>
                            This resume appears to belong to a different person
                            than the current profile. Review the selection before
                            generating a new cover letter.
                          </p>
                        )}
                      </>
                    ) : (
                      <p className='text-sm text-foreground/60'>
                        No resume selected. Auto-apply will continue without a
                        resume attachment.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {draftData && autoApplyStep === 4 && (
                <div className='grid gap-4 mt-4'>
                  <div className='rounded-xl border border-[#2dd4bf]/30 bg-[#2dd4bf]/5 p-5'>
                    <div className='flex items-center gap-2 text-sm font-medium text-[#2dd4bf]'>
                      <Sparkles className='w-5 h-5' />
                      Draft Mode Review
                    </div>
                    <p className='mt-2 text-sm text-foreground/70'>
                      AI has tailored your materials for this specific job.
                      Review and edit the drafts below before launching the
                      automation, or save them for later.
                    </p>
                    <div className='mt-4 rounded-lg border border-[#2dd4bf]/20 bg-black/20 p-3 space-y-1'>
                      <p className='text-xs uppercase tracking-wider text-[#2dd4bf]/75'>
                        Draft Source
                      </p>
                      <p className='text-sm text-foreground'>
                        {draftData.sourceResumeName || selectedResumeName}
                      </p>
                      {draftData.sourceCandidateName && (
                        <p className='text-xs text-foreground/65'>
                          Detected candidate: {draftData.sourceCandidateName}
                        </p>
                      )}
                      {draftData.sourceResumeUpdatedAt && (
                        <p className='text-xs text-foreground/55'>
                          Resume last updated{" "}
                          {new Date(
                            draftData.sourceResumeUpdatedAt,
                          ).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    <div className='mt-5 space-y-4'>
                      <div>
                        <label className='text-xs font-medium text-foreground/60 uppercase tracking-wider'>
                          Tailored Cover Letter
                        </label>
                        <textarea
                          className='w-full mt-1 h-32 p-3 text-sm bg-background border border-foreground/10 rounded-lg focus:outline-none focus:border-[#2dd4bf]/50 resize-y'
                          value={draftData.coverLetterText}
                          onChange={(e) =>
                            setDraftData({
                              ...draftData,
                              coverLetterText: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className='text-xs font-medium text-foreground/60 uppercase tracking-wider'>
                          Tailored Resume Content
                        </label>
                        <textarea
                          className='w-full mt-1 h-48 p-3 text-sm bg-background border border-foreground/10 rounded-lg focus:outline-none focus:border-[#2dd4bf]/50 resize-y'
                          value={draftData.resumeText}
                          onChange={(e) =>
                            setDraftData({
                              ...draftData,
                              resumeText: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {autoApplyStep === 3 && (
                <div className='grid gap-4 mt-2'>
                  {/* Progress Bar */}
                  <div className='rounded-xl border border-[#2dd4bf]/30 bg-[#2dd4bf]/5 p-5'>
                    <div className='flex items-center justify-between mb-3'>
                      <div className='flex items-center gap-2 text-sm font-medium text-[#2dd4bf]'>
                        {!automationFinished ? (
                          <Loader2 className='w-4 h-4 animate-spin' />
                        ) : applyProgress.fail === 0 ? (
                          <Check className='w-4 h-4' />
                        ) : (
                          <AlertTriangle className='w-4 h-4 text-[#ffb347]' />
                        )}
                        {automationFinished
                          ? "Automation Complete"
                          : "Automation Running"}
                      </div>
                      <div className='text-sm font-mono text-foreground/70'>
                        {applyProgress.done}/{applyProgress.total}
                      </div>
                    </div>
                    <div className='w-full h-2 rounded-full bg-foreground/10 overflow-hidden'>
                      <motion.div
                        className='h-full rounded-full bg-gradient-to-r from-[#22d3ee] to-[#00ff88]'
                        initial={{ width: "0%" }}
                        animate={{
                          width: `${applyProgress.total > 0 ? Math.round((applyProgress.done / applyProgress.total) * 100) : 0}%`,
                        }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    </div>
                  </div>

                  {/* Summary Cards */}
                  <div className='grid grid-cols-3 gap-3'>
                    <div className='rounded-xl border border-foreground/12 bg-foreground/[0.02] p-3 text-center'>
                      <div className='text-2xl font-semibold text-foreground'>
                        {applyProgress.total}
                      </div>
                      <div className='text-[10px] uppercase tracking-wider text-foreground/50 mt-1'>
                        Queued
                      </div>
                    </div>
                    <div className='rounded-xl border border-[#2dd4bf]/25 bg-[#2dd4bf]/5 p-3 text-center'>
                      <div className='text-2xl font-semibold text-[#2dd4bf]'>
                        {applyProgress.success}
                      </div>
                      <div className='text-[10px] uppercase tracking-wider text-[#2dd4bf]/70 mt-1'>
                        Success
                      </div>
                    </div>
                    <div
                      className={`rounded-xl border p-3 text-center ${applyProgress.fail > 0 ? "border-[#ff4747]/25 bg-[#ff4747]/5" : "border-foreground/12 bg-foreground/[0.02]"}`}
                    >
                      <div
                        className={`text-2xl font-semibold ${applyProgress.fail > 0 ? "text-[#ff4747]" : "text-foreground/30"}`}
                      >
                        {applyProgress.fail}
                      </div>
                      <div
                        className={`text-[10px] uppercase tracking-wider mt-1 ${applyProgress.fail > 0 ? "text-[#ff4747]/70" : "text-foreground/30"}`}
                      >
                        Failed
                      </div>
                    </div>
                  </div>

                  {/* Live Telemetry Log */}
                  <div className='rounded-xl border border-foreground/12 bg-black/40 overflow-hidden'>
                    <div className='flex items-center justify-between px-4 py-2 border-b border-foreground/10'>
                      <div className='flex items-center gap-2 text-[11px] uppercase tracking-wider text-foreground/50'>
                        <span
                          className={`inline-block h-1.5 w-1.5 rounded-full ${!automationFinished ? "bg-[#2dd4bf] animate-pulse" : "bg-foreground/30"}`}
                        />
                        Live Telemetry
                      </div>
                      <span className='text-[10px] text-foreground/30 font-mono'>
                        {automationLogs.length} events
                      </span>
                    </div>
                    <div
                      className='max-h-48 overflow-y-auto p-3 space-y-1 font-mono text-xs'
                      ref={(el) => {
                        if (el) el.scrollTop = el.scrollHeight;
                      }}
                    >
                      {automationLogs.map((log, i) => (
                        <div key={i} className='flex gap-2'>
                          <span className='text-foreground/30 flex-shrink-0'>
                            {log.time}
                          </span>
                          <span
                            className={`${log.status === "success" ? "text-[#2dd4bf]" : log.status === "error" ? "text-[#ff4747]" : "text-foreground/60"}`}
                          >
                            {log.message}
                          </span>
                        </div>
                      ))}
                      {!automationFinished && (
                        <div className='flex gap-2 items-center'>
                          <span className='text-foreground/30 flex-shrink-0'>
                            {new Date().toLocaleTimeString("en-US", {
                              hour12: false,
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </span>
                          <span className='text-foreground/40 flex items-center gap-1'>
                            <span className='inline-block h-1 w-1 rounded-full bg-[#2dd4bf] animate-pulse' />
                            <span className='inline-block h-1 w-1 rounded-full bg-[#2dd4bf] animate-pulse [animation-delay:150ms]' />
                            <span className='inline-block h-1 w-1 rounded-full bg-[#2dd4bf] animate-pulse [animation-delay:300ms]' />
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-foreground/12'>
                <div className='flex items-center gap-3'>
                  <p className='text-[11px] leading-tight text-foreground/50 flex items-center gap-2 max-w-[280px]'>
                    <ShieldCheck className='w-3.5 h-3.5 text-[#2dd4bf] shrink-0' />
                    <span>Automation respects existing filters and logs telemetry for audit trails.</span>
                  </p>
                </div>
                <div className='flex flex-wrap items-center justify-end gap-4'>
                  {autoApplyStep === 3 ? (
                    <Button
                      className={cn(
                        "whitespace-nowrap shrink-0",
                        automationFinished
                          ? "border border-[#2dd4bf]/50 text-[#2dd4bf] bg-[#2dd4bf]/15 hover:bg-[#2dd4bf]/25"
                          : "border border-foreground/20 text-foreground/40 cursor-not-allowed opacity-50"
                      )}
                      disabled={!automationFinished}
                      onClick={() => {
                        setResumeDialogOpen(false);
                        setAutoApplyStep(1);
                        setDraftData(null);
                        setAutomationLogs([]);
                        setAutomationFinished(false);
                      }}
                    >
                      {automationFinished ? (
                        <>
                          <Check className='w-4 h-4 mr-1.5' /> Done
                        </>
                      ) : (
                        <>
                          <Loader2 className='w-4 h-4 mr-1.5 animate-spin' />{" "}
                          Running...
                        </>
                      )}
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant='ghost'
                        className='border border-transparent text-foreground/60 hover:text-foreground whitespace-nowrap shrink-0'
                        onClick={() => {
                          setResumeDialogOpen(false);
                          setAutoApplyStep(1);
                          setDraftData(null);
                        }}
                      >
                        Close
                      </Button>
                      {(autoApplyStep === 2 ||
                        autoApplyStep === 4) && (
                        <Button
                          variant='outline'
                          className='border-foreground/20 text-foreground hover:border-foreground/40 hover:bg-foreground/10 whitespace-nowrap shrink-0'
                          onClick={() => {
                            if (autoApplyStep === 4) {
                              setAutoApplyStep(1);
                              setDraftData(null);
                            } else {
                              setAutoApplyStep(1);
                              setAiEvaluation(null);
                              setForceSubmit(false);
                            }
                          }}
                        >
                          Back
                        </Button>
                      )}
                      {aiEvaluation &&
                      aiEvaluation.missing_requirements.length > 0 ? (
                        <div className='flex items-center gap-4'>
                          <Button
                            className='border border-[#2dd4bf]/50 text-[#2dd4bf] bg-[#2dd4bf]/15 hover:bg-[#2dd4bf]/25 whitespace-nowrap shrink-0'
                            onClick={handleDecisionBoundaryAutoFix}
                            disabled={
                              generatingDraft || evaluatingJob || !canAutoFixDecisionBoundary
                            }
                          >
                            {generatingDraft ? (
                              <>
                                <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                                Fixing draft...
                              </>
                            ) : (
                              "Fix with AI Draft"
                            )}
                          </Button>
                          <Button
                            className='border border-[#ff4747]/50 text-[#ff4747] bg-[#ff4747]/15 hover:bg-[#ff4747]/25 whitespace-nowrap shrink-0'
                            onClick={() => {
                              setResumeDialogOpen(false);
                            }}
                          >
                            Acknowledge & Edit Profile
                          </Button>
                        </div>
                      ) : autoApplyStep === 4 ? (
                        <div className='flex items-center gap-4'>
                          <Button
                            className='bg-foreground/10 hover:bg-foreground/20 text-foreground whitespace-nowrap shrink-0'
                            onClick={() => applyAllJobs(true)}
                            disabled={applyingAll}
                          >
                            {applyingAll ? (
                              <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                            ) : (
                              "Save as Draft"
                            )}
                          </Button>
                          <Button
                            className='border-[#2dd4bf]/50 text-[#2dd4bf] bg-[#2dd4bf]/15 hover:bg-[#2dd4bf]/25 whitespace-nowrap shrink-0'
                            onClick={() => applyAllJobs(false)}
                            disabled={applyingAll}
                          >
                            {applyingAll ? (
                              <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                            ) : (
                              jobToAutoApply ? "Launch suite" : "Launch automation"
                            )}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          className={cn(
                            "border whitespace-nowrap shrink-0",
                            evaluatingJob || generatingDraft 
                              ? "border-[#2dd4bf]/50" 
                              : aiEvaluation 
                                ? "border-[#ffb347]/50 text-[#ffb347] bg-[#ffb347]/15 hover:bg-[#ffb347]/25" 
                                : "border-[#2dd4bf]/50 text-[#2dd4bf] bg-[#2dd4bf]/15 hover:bg-[#2dd4bf]/25",
                            (autoApplyPrimaryDisabled || evaluatingJob || generatingDraft) && "opacity-50 cursor-not-allowed"
                          )}
                          disabled={
                            autoApplyPrimaryDisabled ||
                            evaluatingJob ||
                            generatingDraft
                          }
                          onClick={() => {
                            if (autoApplyStep === 1) {
                              if (canAdvanceFromStepOne) setAutoApplyStep(2);
                            } else if (canLaunchAutoApply) {
                              if (aiEvaluation) {
                                // User is forcing submit despite warnings
                                setForceSubmit(true);
                                setAiEvaluation(null);
                              } else {
                                applyAllJobs();
                              }
                            }
                          }}
                        >
                          {evaluatingJob || generatingDraft ? (
                            <>
                              <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                              {evaluatingJob
                                ? "Evaluating Job Fit..."
                                : "Drafting Materials..."}
                            </>
                          ) : autoApplyStep === 1 ? (
                            "Continue"
                          ) : aiEvaluation ? (
                            "Ignore & Proceed"
                          ) : (
                            "Launch automation"
                          )}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Modal>
      </div>
      {/* Mobile drawer */}
      {isMobile &&
        selectedJob &&
        (() => {
          const j = jobs.find((x) => x.id === selectedJob);
          if (!j) return null;
          return (
            <Modal
              open={true}
              onClose={() => setSelectedJob(null)}
              title={j.title}
              size='xl'
              side='right'
              footer={
                <Button
                  variant='ghost'
                  className='w-full rounded-lg border border-foreground/15 bg-foreground/5 text-foreground/70 hover:text-foreground hover:bg-foreground/10'
                  onClick={() => setSelectedJob(null)}
                >
                  Cancel
                </Button>
              }
            >
              <div className='-mx-1 space-y-3 pb-2'>
                {(() => {
                  const primaryHref =
                    j.apply_url ||
                    (j as any)?.raw_data?.sourceUrl ||
                    j.source_id;
                  const siteHost = primaryHref ? getHost(primaryHref) : "";
                  const ico = siteHost
                    ? `https://www.google.com/s2/favicons?domain=${siteHost}&sz=64`
                    : "";
                  const employmentType =
                    (j as any)?.employment_type ??
                    (j as any)?.raw_data?.scraped_data?.employment_type;
                  const experienceLevel =
                    (j as any)?.experience_level ??
                    (j as any)?.raw_data?.scraped_data?.experience_level;
                  const deadline =
                    j.expires_at ||
                    (j as any)?.raw_data?.deadline ||
                    (j as any)?.raw_data?.applicationDeadline;
                  const deadlineMeta = deadline
                    ? formatDeadlineMeta(deadline)
                    : null;

                  let salaryText: string | null = null;
                  if (j.salary_min || j.salary_max || j.salary_currency) {
                    const currency = j.salary_currency || "USD";
                    const currencySymbol =
                      currency === "USD"
                        ? "$"
                        : currency === "GBP"
                          ? "£"
                          : currency === "EUR"
                            ? "€"
                            : currency;
                    if (j.salary_min && j.salary_max)
                      salaryText = `${currencySymbol}${j.salary_min.toLocaleString()} - ${currencySymbol}${j.salary_max.toLocaleString()}`;
                    else if (j.salary_min)
                      salaryText = `${currencySymbol}${j.salary_min.toLocaleString()}+`;
                    else if (j.salary_max)
                      salaryText = `Up to ${currencySymbol}${j.salary_max.toLocaleString()}`;
                  }
                  if (!salaryText) {
                    const raw = (j as any)?.raw_data;
                    const salary = (raw?.scraped_data?.salary ||
                      raw?.salaryRange ||
                      raw?.salary) as string | undefined;
                    if (salary) salaryText = salary;
                  }

                  const metaTiles = [
                    j.location
                      ? { label: "Location", value: j.location }
                      : null,
                    j.remote_type
                      ? { label: "Remote", value: j.remote_type }
                      : null,
                    employmentType
                      ? { label: "Type", value: employmentType }
                      : null,
                    experienceLevel
                      ? { label: "Level", value: experienceLevel }
                      : null,
                    deadlineMeta
                      ? {
                          label: "Deadline",
                          value: deadlineMeta.label,
                          tone: deadlineMeta.level,
                        }
                      : null,
                    salaryText ? { label: "Comp", value: salaryText } : null,
                  ].filter(Boolean) as {
                    label: string;
                    value: string;
                    tone?: "urgent" | "soon" | "future";
                  }[];

                  return (
                    <Card className='relative overflow-hidden border border-[#2dd4bf]/25 bg-gradient-to-br from-background via-background to-background p-5'>
                      <span className='pointer-events-none absolute -top-20 -right-10 h-40 w-40 rounded-full bg-[#2dd4bf]/20 blur-3xl opacity-50' />
                      <div className='relative space-y-4'>
                        <div className='flex items-start gap-3'>
                          {j.logoUrl && !logoError[j.id] ? (
                            <img
                              src={j.logoUrl}
                              alt={j.company}
                              className='w-12 h-12 rounded-xl object-contain bg-foreground'
                              onError={() =>
                                setLogoError((e) => ({ ...e, [j.id]: true }))
                              }
                            />
                          ) : (
                            <div className='w-12 h-12 bg-gradient-to-r from-[#22d3ee] to-background rounded-xl flex items-center justify-center text- font-bold text-lg'>
                              {j.logo}
                            </div>
                          )}
                          <div className='flex-1 min-w-0 space-y-1'>
                            <div className='inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-[#2dd4bf]/70'>
                              <Sparkles className='w-3 h-3' />
                              Featured Job
                            </div>
                            <div className='text-lg font-semibold text-foreground leading-tight'>
                              {j.title}
                            </div>
                            <div className='flex flex-wrap items-center gap-2 text-[12px] text-foreground/70'>
                              <span className='font-medium text-foreground/90'>
                                {j.company}
                              </span>
                              {siteHost && (
                                <span
                                  className='inline-flex items-center gap-1 rounded-full border border-foreground/10 bg-foreground/5 px-2 py-1 text-[10px] text-foreground/50'
                                  title={primaryHref || undefined}
                                >
                                  {ico && (
                                    <img
                                      src={ico}
                                      alt=''
                                      className='w-3 h-3 rounded-sm'
                                      onError={(e) =>
                                        ((
                                          e.target as HTMLImageElement
                                        ).style.display = "none")
                                      }
                                    />
                                  )}
                                  {siteHost}
                                </span>
                              )}
                              {j.posted_at && (
                                <span className='rounded-full border border-foreground/10 px-2 py-1 text-[10px] text-foreground/40'>
                                  Posted {formatRelative(j.posted_at)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {metaTiles.length > 0 && (
                          <div className='grid grid-cols-2 gap-2'>
                            {metaTiles.map((tile) => (
                              <div
                                key={`${tile.label}-${tile.value}`}
                                className='rounded-lg border border-foreground/10 bg-foreground/5 px-2 py-2'
                              >
                                <div className='text-[10px] uppercase tracking-wide text-foreground/40'>
                                  {tile.label}
                                </div>
                                <div
                                  className={`text-xs font-medium ${tile.tone === "urgent" ? "text-[#ff8b8b]" : tile.tone === "soon" ? "text-[#ffd78b]" : tile.tone === "future" ? "text-[#8bffb1]" : "text-foreground/85"}`}
                                >
                                  {tile.value}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className='flex items-center gap-2'>
                          {primaryHref && (
                            <a
                              href={primaryHref}
                              target='_blank'
                              rel='noopener noreferrer'
                              className='inline-flex items-center justify-center gap-2 rounded-lg border border-[#2dd4bf]/50 bg-[#2dd4bf]/15 px-3 py-2 text-[13px] font-medium text-[#2dd4bf] transition hover:bg-[#2dd4bf]/25'
                            >
                              View Posting
                            </a>
                          )}
                          <Button
                            variant='ghost'
                            onClick={() => openAutoApplyFlow(j)}
                            className='inline-flex items-center justify-center gap-2 rounded-lg border border-[#2dd4bf]/40 bg-gradient-to-r from-[#22d3ee]/10 via-transparent to-[#0d9488]/10 px-3 py-2 text-[13px] font-medium text-foreground transition hover:from-[#22d3ee]/20 hover:to-[#0d9488]/5'
                            title='Launch auto apply suite for this job'
                          >
                            <Briefcase className='w-4 h-4' />
                            Auto Apply Suite
                            {!hasAutoApplyAccess && (
                              <Lock className='w-3 h-3 opacity-60' />
                            )}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })()}

                <Card className='border border-border bg-card/80 p-4'>
                  <div className='flex items-center justify-between mb-3'>
                    <div className='inline-flex items-center gap-2 text-sm font-medium text-foreground/80'>
                      <FileText className='w-4 h-4 text-[#2dd4bf]' />
                      Job Description
                    </div>
                    <span className='text-[10px] uppercase tracking-wide text-foreground/35'>
                      Full brief
                    </span>
                  </div>
                  <MarkdownContent
                    content={j.description}
                    className='max-h-[45dvh] overflow-y-auto pr-1 text-[13px]'
                  />
                </Card>

                {/* AI Match Score Card - Mobile - Gated for Basics+ */}
                {!hasMatchScoreAccess ? (
                  <UpgradePrompt
                    title='AI Match Score Analysis'
                    description='Get detailed compatibility insights powered by advanced AI to find your perfect job match.'
                    features={[
                      {
                        icon: <Target className='h-5 w-5' />,
                        title: "Skills Compatibility",
                        description:
                          "See how your skills align with job requirements",
                      },
                      {
                        icon: <TrendingUp className='h-5 w-5' />,
                        title: "Experience Match",
                        description: "Understand if your experience level fits",
                      },
                      {
                        icon: <Sparkles className='h-5 w-5' />,
                        title: "AI-Powered Insights",
                        description:
                          "Get smart recommendations for improvement",
                      },
                    ]}
                    requiredTier='Basics'
                    icon={<Sparkles className='h-12 w-12 text-[#2dd4bf]' />}
                    compact={true}
                  />
                ) : (
                  <MatchScorePieChart
                    score={typeof j.matchScore === "number" ? j.matchScore : 75}
                    summary={j.matchSummary || "Match score analysis"}
                    breakdown={j.matchBreakdown}
                  />
                )}

                {hasJobEvaluationAccess ? (
                  <JobEvaluationReport
                    evaluation={evaluationReports[j.id] ?? null}
                    loading={Boolean(evaluationLoadingByJob[j.id])}
                    savedStoryTitles={savedStoryTitles}
                    onSaveStory={saveInterviewStoryToMemory}
                  />
                ) : (
                  <JobEvaluationTeaser
                    compact
                    jobTitle={j.title || "Role"}
                    company={j.company}
                    descriptionPreview={j.description || undefined}
                  />
                )}

                {(() => {
                  const screenshot = (j as any)?.raw_data?.screenshot;
                  if (!screenshot) return null;
                  return (
                    <Card className='border border-foreground/12 bg-background p-0 overflow-hidden'>
                      <div className='flex items-center justify-between px-3 py-2 border-b border-foreground/10 bg-foreground/5'>
                        <div className='inline-flex items-center gap-2 text-xs font-medium text-foreground/70'>
                          <Sparkles className='w-3 h-3 text-[#2dd4bf]' />
                          Screenshot
                        </div>
                        <span className='text-[10px] uppercase tracking-wide text-foreground/35'>
                          Preview
                        </span>
                      </div>
                      <div className='relative bg-background'>
                        <img
                          src={getProxiedLogoUrl(screenshot)}
                          alt='Job page screenshot'
                          className='w-full h-auto'
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                            const parent = target.parentElement;
                            if (parent)
                              parent.innerHTML =
                                '<div class="p-4 text-center text-foreground/40 text-sm">Screenshot unavailable</div>';
                          }}
                        />
                        <span className='pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/50' />
                      </div>
                    </Card>
                  );
                })()}

                {(() => {
                  const sources = (j as any)?.raw_data?._sources;
                  if (
                    !sources ||
                    (Array.isArray(sources) && sources.length === 0)
                  )
                    return null;
                  const items: any[] = Array.isArray(sources)
                    ? sources
                    : [sources];
                  return (
                    <Card className='border border-foreground/12 bg-gradient-to-br from-background via-background to-background p-4'>
                      <div className='flex items-center justify-between mb-2'>
                        <div className='inline-flex items-center gap-2 text-xs font-medium text-foreground/70'>
                          <ShieldCheck className='w-3 h-3 text-[#2dd4bf]' />
                          Source Intelligence
                        </div>
                        <span className='text-[10px] uppercase tracking-wide text-foreground/30'>
                          Captured links
                        </span>
                      </div>
                      <ul className='space-y-2'>
                        {items.map((s, i) => {
                          const href =
                            typeof s === "string"
                              ? s
                              : s?.url || s?.source || "";
                          if (!href) return null;
                          const host = getHost(href);
                          const ico = host
                            ? `https://www.google.com/s2/favicons?domain=${host}&sz=64`
                            : "";
                          return (
                            <li
                              key={i}
                              className='flex items-center justify-between gap-2 rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2'
                            >
                              <div className='flex items-center gap-2'>
                                {host && (
                                  <img
                                    src={ico}
                                    alt=''
                                    className='w-4 h-4 rounded'
                                    onError={(e) =>
                                      ((
                                        e.target as HTMLImageElement
                                      ).style.display = "none")
                                    }
                                  />
                                )}
                                <a
                                  href={href}
                                  target='_blank'
                                  rel='noopener noreferrer'
                                  className='text-sm text-[#2dd4bf] hover:underline'
                                >
                                  {host || href}
                                </a>
                              </div>
                              <span className='text-[10px] uppercase tracking-wide text-foreground/30'>
                                Open
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </Card>
                  );
                })()}
              </div>
            </Modal>
          );
        })()}
      <ConfirmDialog
        open={confirmDeleteOpen}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={executeClearAllJobs}
        title='Delete All Jobs'
        message='Are you sure you want to delete ALL jobs? This action cannot be undone.'
        confirmText='Delete All'
        cancelText='Cancel'
      />
    </div>
  );
};
