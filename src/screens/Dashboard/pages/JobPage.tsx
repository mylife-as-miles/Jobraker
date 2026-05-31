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
  Zap,
  Crown,
  X,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Switch } from "../../../components/ui/switch";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "../../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../../../components/ui/dropdown-menu";
import Modal from "../../../components/ui/modal";
import { ConfirmDialog } from "../../../components/ui/confirm-dialog";
import { MarkdownContent } from "../../../components/ui/MarkdownContent";
import {
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
import {
  JOB_FEEDBACK_COPY,
  type JobFeedbackLabel,
  saveApplicationPackage,
  submitJobFeedback,
} from "@/lib/jobIntelligence";
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

import { applyMicro1ReferralToUrl } from "../../../utils/micro1Referral";
import { useGamification } from "../../../hooks/useGamification";
import { cn, getProxiedLogoUrl } from "../../../lib/utils";
import { useRegisterCoachMarks } from "../../../providers/TourProvider";
import { MatchScorePieChart } from "../../../components/MatchScorePieChart";
import { UpgradePrompt } from "../../../components/UpgradePrompt";
import { JobEvaluationTeaser } from "../../../components/JobEvaluationTeaser";
import { AnimatedSVGBackground } from "../../../components/AnimatedSVGBackground";
import { JobEvaluationReport } from "../components/JobEvaluationReport";
import { OpportunityScoreSummary } from "../../../components/jobs/OpportunityScoreSummary";
import { JobTaskMonitor } from "../components/JobTaskMonitor";
import { invokeProtectedFunction } from "../../../services/supabase/invokeProtectedFunction";
import { loadParsedResumeText } from "../../../lib/parsedResume";
import { useSubscriptionTier } from "@/hooks/useSubscriptionTier";
import {
  useJobIntelligenceTasks,
  type JobIntelligenceTask,
} from "@/hooks/useJobIntelligenceTasks";
import {
  hasFeatureAccess,
  hasSubscriptionAccess,
} from "@/lib/subscriptionAccess";
import {
  VISIBLE_JOB_QUEUE_STATES,
  type JobCanonicalStatus,
} from "@/lib/applicationState";
import {
  buildExplainableJobOpportunities,
} from "@/services/intelligence/opportunityScoreEngine";
import type {
  CandidateProfileInput,
  ExplainableJobOpportunity,
} from "@/services/intelligence/types";
import { ConcurrencyLimitModal } from "../../../components/ConcurrencyLimitModal";
import { BILLING_PLAN_DEFINITIONS } from "@/lib/billingCatalog";

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
  discovered_at?: string | null;
  created_at?: string | null;
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
  lead_quality_score?: number | null;
  lead_quality_reason?: string | null;
  lead_quality_tags?: string[] | null;
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
  explainableOpportunity?: ExplainableJobOpportunity;
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

const MATCH_SCORE_BATCH_SIZE = 50;
const MATCH_SCORE_TEXT_LIMIT = 6_000;
const MATCH_SCORE_META_LIMIT = 500;
const MATCH_SCORE_LIST_LIMIT = 25;
const MATCH_SCORE_CACHE_TTL_MS = 5 * 60_000;
const AUTO_APPLY_RATE_LIMIT_WAIT_MS = 65_000;

const matchInsightResultCache = new Map<
  string,
  { expiresAt: number; jobs: Job[] }
>();
const matchInsightInFlight = new Map<string, Promise<Job[]>>();

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

const buildMatchInsightCacheKey = (
  jobs: Job[],
  context: MatchContext,
  enabled: boolean,
) =>
  JSON.stringify({
    enabled,
    context: buildMatchScoreContext(context),
    jobs: jobs.map((job) => ({
      id: job.id,
      title: compactText(job.title, MATCH_SCORE_META_LIMIT),
      company: compactText(job.company, MATCH_SCORE_META_LIMIT),
      updated_at: (job as any).updated_at ?? null,
    })),
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

  const jobsNeedingScore = jobs.filter(
    (job) => typeof job.matchScore !== "number",
  );
  if (jobsNeedingScore.length === 0) return jobs;

  const jobsToScore = jobsNeedingScore.slice(0, MATCH_SCORE_BATCH_SIZE);
  const cacheKey = buildMatchInsightCacheKey(jobs, context, enabled);
  const cached = matchInsightResultCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.jobs;
  }

  const inFlight = matchInsightInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  const request = (async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return jobs;

    // The edge function accepts up to 50 jobs per request. Keeping this to a
    // single request prevents repeated page decoration from tripping rate limits.
    const compactJobs = jobsToScore.map(buildMatchScoreRequestJob);
    const compactContext = buildMatchScoreContext(context);
    const data = await invokeProtectedFunction<{
      results?: Array<{
        id?: string;
        score?: number;
        breakdown?: MatchScoreBreakdown[];
        summary?: string;
      }>;
    }>("calculate-match-score", {
      body: {
        jobs: compactJobs,
        context: compactContext,
      },
    });

    const results = Array.isArray(data?.results) ? data.results : [];
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
  })();

  matchInsightInFlight.set(cacheKey, request);

  try {
    const decorated = await request;
    matchInsightResultCache.set(cacheKey, {
      expiresAt: Date.now() + MATCH_SCORE_CACHE_TTL_MS,
      jobs: decorated,
    });
    return decorated;
  } catch (err) {
    console.error("fetchJobMatchInsights error:", err);
    if (onError) onError(err);
    return jobs; // Fallback to raw jobs if scoring fails
  } finally {
    matchInsightInFlight.delete(cacheKey);
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
  resumes:
    | Array<{ id: string; is_favorite?: boolean | null }>
    | null
    | undefined,
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
    const match = line.match(
      /\b([A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,4})\b/,
    );
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
      if (trimmed) return applyMicro1ReferralToUrl(trimmed);
    }
  }
  return null;
};

const composeCoverLetterPayload = (
  entry?: CoverLetterLibraryEntry | null,
): string | undefined => {
  if (!entry?.data) return undefined;
  const data = entry.data as Record<string, unknown>;

  // Helper to read nested or flat string values
  const getVal = (nestedObjKey: string, flatKey: string, nestedSubKey: string): string | undefined => {
    const obj = data[nestedObjKey];
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      const val = (obj as Record<string, unknown>)[nestedSubKey];
      if (typeof val === "string") return val;
    }
    const flatVal = data[flatKey];
    if (typeof flatVal === "string") return flatVal;
    // Fallback: try nestedObjKey.nestedSubKey in case it was stored/flattened differently
    const altObj = data[nestedObjKey];
    if (altObj && typeof altObj === "object" && !Array.isArray(altObj)) {
      const val = (altObj as Record<string, unknown>)[flatKey];
      if (typeof val === "string") return val;
    }
    return undefined;
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

  // 1. Sender Section
  const senderName = getVal("sender", "senderName", "name");
  const senderPhone = getVal("sender", "senderPhone", "phone");
  const senderEmail = getVal("sender", "senderEmail", "email");
  const senderAddress = getVal("sender", "senderAddress", "address");

  const senderLines: string[] = [];
  [senderName, senderPhone, senderEmail, senderAddress].forEach((val) => {
    if (val) {
      const trimmed = val.trim();
      if (trimmed.length > 0) senderLines.push(trimmed);
    }
  });
  if (senderLines.length) {
    lines.push(...senderLines);
    pushSeparator();
  }

  // 2. Date Section
  const dateValue = getVal("content", "date", "date");
  if (dateValue) {
    const parsed = new Date(dateValue);
    const formatted = Number.isNaN(parsed.valueOf())
      ? dateValue
      : parsed.toLocaleDateString();
    pushLine(formatted);
    pushSeparator();
  }

  // 3. Recipient Section
  const recipientName = getVal("recipient", "recipient", "name");
  const recipientTitle = getVal("recipient", "recipientTitle", "title");
  const recipientCompany = getVal("recipient", "company", "company") || (typeof data.company === "string" ? data.company : undefined);
  const recipientAddress = getVal("recipient", "recipientAddress", "address");

  const recipientLines: string[] = [];
  [recipientName, recipientTitle, recipientCompany, recipientAddress].forEach((val) => {
    if (val) {
      const trimmed = val.trim();
      if (trimmed.length > 0) recipientLines.push(trimmed);
    }
  });
  if (recipientLines.length) {
    lines.push(...recipientLines);
    pushSeparator();
  }

  // 4. Subject Section
  const subject = getVal("content", "subject", "subject");
  if (subject) {
    const trimmedSubject = subject.trim();
    if (trimmedSubject.length > 0) {
      pushLine(`Subject: ${trimmedSubject}`);
      pushSeparator();
    }
  }

  // 5. Salutation Section
  const salutation = getVal("content", "salutation", "salutation");
  if (salutation) {
    const trimmedSalutation = salutation.trim();
    if (trimmedSalutation.length > 0) {
      pushLine(trimmedSalutation);
      pushSeparator();
    }
  }

  // 6. Body Paragraphs Section
  let paragraphs: string[] = [];
  const contentObj = data.content;
  if (contentObj && typeof contentObj === "object" && !Array.isArray(contentObj)) {
    const nestedParagraphs = (contentObj as Record<string, unknown>).paragraphs;
    if (Array.isArray(nestedParagraphs)) {
      paragraphs = nestedParagraphs
        .filter((p): p is string => typeof p === "string")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
    }
  }
  if (!paragraphs.length && Array.isArray(data.paragraphs)) {
    paragraphs = (data.paragraphs as unknown[])
      .filter((p): p is string => typeof p === "string")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  let body: string | undefined;
  if (contentObj && typeof contentObj === "object" && !Array.isArray(contentObj)) {
    const nestedRawBody = (contentObj as Record<string, unknown>).rawBody;
    if (typeof nestedRawBody === "string") {
      body = nestedRawBody;
    }
  }
  if (!body) {
    const flatContent = data.content;
    if (typeof flatContent === "string") {
      body = flatContent;
    }
  }
  if (!body) {
    const rawBodyVal = data.rawBody;
    if (typeof rawBodyVal === "string") {
      body = rawBodyVal;
    }
  }

  if (body && body.trim().length > 0) {
    pushLine(body.trim());
  } else if (paragraphs.length) {
    pushLine(paragraphs.join("\n\n"));
  }

  // 7. Closing Section
  const closing = getVal("content", "closing", "closing");
  if (closing) {
    const trimmedClosing = closing.trim();
    if (trimmedClosing.length > 0) {
      pushSeparator();
      pushLine(trimmedClosing);
    }
  }

  // 8. Signature Section
  const signature = getVal("content", "signature", "signature") || getVal("content", "signatureName", "signature") || getVal("sender", "senderName", "name");
  if (signature) {
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
      typeof draft?.sourceResumeName === "string"
        ? draft.sourceResumeName
        : null,
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
  const skyvern = result.skyvern ?? result.automation ?? result.provider ?? null;
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

const isGenericJobPortal = (domain: string): boolean => {
  const lower = domain.toLowerCase();
  const genericPortals = [
    "lever.co",
    "greenhouse.io",
    "ashbyhq.com",
    "workable.com",
    "indeed.com",
    "linkedin.com",
    "careers-page.com",
    "ziprecruiter.com",
    "glassdoor.com",
    "monster.com",
    "careerbuilder.com",
    "simplyhired.com",
    "weworkremotely.com",
    "remote.co",
    "remotive.com",
    "remoteok.com",
    "jobicy.com",
    "wellfound.com",
    "builtin.com",
    "otta.com",
  ];
  return genericPortals.some(
    (portal) => lower === portal || lower.endsWith(`.${portal}`),
  );
};

const getCompanyLogoUrl = (
  companyName: string,
  sourceUrl?: string,
): string | undefined => {
  try {
    let domain: string | undefined;
    if (sourceUrl) {
      const parsedUrl = new URL(sourceUrl);
      const host = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
      if (!isGenericJobPortal(host)) {
        domain = parsedUrl.hostname;
      }
    }

    if (!domain) {
      const cleanCompany = companyName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ""); // strip non-alphanumeric
      domain = `www.${cleanCompany}.com`;
    }

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
    discovered_at: dbJob.discovered_at ?? null,
    created_at: dbJob.created_at ?? null,
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
    lead_quality_score:
      typeof dbJob.lead_quality_score === "number"
        ? dbJob.lead_quality_score
        : dbJob.lead_quality_score != null
          ? Number(dbJob.lead_quality_score)
          : null,
    lead_quality_reason:
      typeof dbJob.lead_quality_reason === "string"
        ? dbJob.lead_quality_reason
        : null,
    lead_quality_tags: Array.isArray(dbJob.lead_quality_tags)
      ? dbJob.lead_quality_tags
      : null,
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

const jobFeedbackLabels: JobFeedbackLabel[] = [
  "relevant",
  "not_relevant",
  "low_quality",
  "duplicate",
  "already_applied",
  "good_fit",
];

function JobQualityAndFeedback({
  job,
  compact = false,
  onFeedback,
  fullAccess = true,
}: {
  job: Job;
  compact?: boolean;
  onFeedback: (job: Job, label: JobFeedbackLabel) => void;
  fullAccess?: boolean;
}) {
  if (!fullAccess) {
    return (
      <UpgradePrompt
        title='Job quality gate'
        description='See whether a role looks trustworthy before you spend time on it.'
        features={[
          {
            icon: <ShieldCheck className='h-5 w-5' />,
            title: "Lead trust checks",
            description: "Spot thin, vague, stale, or suspicious postings faster.",
          },
          {
            icon: <Target className='h-5 w-5' />,
            title: "Quality filtering",
            description: "Prioritize cleaner leads before you tailor or apply.",
          },
        ]}
        requiredTier='Basics'
        icon={<ShieldCheck className='h-12 w-12 text-brand' />}
        compact
      />
    );
  }

  const qualityScore =
    typeof job.lead_quality_score === "number" ? job.lead_quality_score : null;
  const qualityTone =
    qualityScore == null
      ? "border-foreground/10 text-foreground/60"
      : qualityScore >= 75
        ? "border-brand/30 text-brand"
        : qualityScore >= 50
          ? "border-foreground/15 text-foreground/70"
          : "border-brand/30 text-brand";

  return (
    <Card
      className={`border border-foreground/10 bg-card/80 ${compact ? "p-4" : "p-5"} space-y-4`}
    >
      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div className='space-y-1'>
          <div className='inline-flex items-center gap-2 text-sm font-medium text-foreground/80'>
            <ShieldCheck className='h-4 w-4 text-brand' />
            Job quality gate
          </div>
          <p className='text-sm text-foreground/55'>
            {job.lead_quality_reason ||
              "No quality gate score has been recorded for this job yet."}
          </p>
        </div>
        {qualityScore != null ? (
          <span
            className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold ${qualityTone}`}
          >
            {qualityScore}/100
          </span>
        ) : null}
      </div>
      {Array.isArray(job.lead_quality_tags) && job.lead_quality_tags.length > 0 ? (
        <div className='flex flex-wrap gap-1.5'>
          {job.lead_quality_tags.slice(0, 8).map((tag) => (
            <span
              key={tag}
              className='rounded-full border border-foreground/10 bg-foreground/5 px-2 py-1 text-[11px] text-foreground/55'
            >
              {tag.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      ) : null}
      <div className='space-y-2'>
        <div className='text-[11px] uppercase tracking-[0.28em] text-foreground/40'>
          Tune ranking
        </div>
        <div className='flex flex-wrap gap-2'>
          {jobFeedbackLabels.map((label) => (
            <Button
              key={label}
              type='button'
              size='sm'
              variant='outline'
              className='h-8 rounded-full border-foreground/15 bg-foreground/5 px-3 text-xs text-foreground/70 hover:border-brand/40 hover:text-brand'
              onClick={() => onFeedback(job, label)}
            >
              {JOB_FEEDBACK_COPY[label]}
            </Button>
          ))}
        </div>
      </div>
    </Card>
  );
}

export const JobPage = (): JSX.Element => {
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const gamificationHook = useGamification();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("Remote");
  const [locationScope, setLocationScope] = useState<
    "city" | "country" | "global"
  >("city");
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
  const [sortBy, setSortBy] = useState<
    "opportunity" | "recent" | "company" | "deadline"
  >(
    "opportunity",
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
  const [concurrencyModalOpen, setConcurrencyModalOpen] = useState(false);
  const [concurrencyInfo, setConcurrencyInfo] = useState<{
    activeRuns: number;
    totalLimit: number;
  }>({ activeRuns: 0, totalLimit: 1 });

  const fetchConcurrencyInfo = useCallback(async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) return;

      const nowIso = new Date().toISOString();
      const threeHoursAgoIso = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      const [{ data: quotaRows }, { count: queuedRunsCount }] = await Promise.all([
        supabase
          .from("user_feature_quotas")
          .select("included_quantity")
          .eq("user_id", userId)
          .eq("feature_key", "auto_apply_concurrency")
          .eq("source", "addon")
          .lte("period_start", nowIso)
          .gt("period_end", nowIso),
        supabase
          .from("applications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("canonical_stage", "queued")
          .neq("provider_status", "waiting")
          .gt("updated_at", threeHoursAgoIso),
      ]);

      const boostSlots = Array.isArray(quotaRows)
        ? quotaRows.reduce((sum, row) => sum + Math.max(0, Number(row.included_quantity || 0)), 0)
        : 0;

      const plan = BILLING_PLAN_DEFINITIONS.find((p) => p.name === subscriptionTier);
      const baseLimit = plan ? plan.autoApplyConcurrency : 1;
      const totalLimit = baseLimit + boostSlots;
      const activeRuns = typeof queuedRunsCount === "number" ? queuedRunsCount : 0;

      const info = { activeRuns, totalLimit };
      setConcurrencyInfo(info);
      return { activeRuns, totalLimit, availableSlots: Math.max(0, totalLimit - activeRuns) };
    } catch (err) {
      console.warn("Failed to fetch concurrency info:", err);
      return null;
    }
  }, [subscriptionTier]);

  useEffect(() => {
    if (subscriptionTier) {
      fetchConcurrencyInfo();
    }
  }, [subscriptionTier, fetchConcurrencyInfo]);

  const {
    tasks: jobTasks,
    createTask,
    updateTask,
    cancelTask,
  } = useJobIntelligenceTasks();
  const hasPaidInsightsAccess = hasSubscriptionAccess(
    subscriptionTier,
    "Basics",
  );
  const hasMatchScoreAccess = hasPaidInsightsAccess;
  const hasJobQualityAccess = hasFeatureAccess(
    subscriptionTier,
    "basic_job_quality_filter",
  );
  const hasOpportunityBreakdownAccess = hasFeatureAccess(
    subscriptionTier,
    "explainable_score_breakdown",
  );
  const hasJobEvaluationAccess = hasOpportunityBreakdownAccess;
  const hasAutoApplyAccess = hasSubscriptionAccess(subscriptionTier, "Free");
  const hasBulkPipelineAccess = hasFeatureAccess(
    subscriptionTier,
    "bulk_pipeline_tools",
  );
  const hasPipelineCleanupAccess = hasFeatureAccess(
    subscriptionTier,
    "pipeline_cleanup",
  );

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
  const activeTaskIdRef = useRef<string | null>(null);
  const canceledTaskIdsRef = useRef<Set<string>>(new Set());
  const jobsRef = useRef<Job[]>([]);

  const {
    profile,
    updateProfile,
    loading: profileLoading,
    experiences: profileExperiences,
    skills: profileSkills,
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
    <Card className='relative overflow-hidden bg-gradient-to-br from-foreground/10 via-foreground/5 to-foreground/0  border border-brand/30 p-4 sm:p-5 mb-4'>
      <motion.div
        className='pointer-events-none absolute -inset-24 opacity-30'
        style={{
          background:
            "radial-gradient(600px 200px at 20% -10%, rgba(29,255,0,0.25), rgba(29,255,0,0) 60%)",
        }}
        initial={{ opacity: 0.15 }}
        animate={{ opacity: [0.15, 0.3, 0.15] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className='flex items-center gap-3'>
        <div className='relative w-6 h-6'>
          <span className='absolute inset-0 rounded-full bg-brand opacity-70' />
          <motion.span
            className='absolute inset-0 rounded-full bg-brand'
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
                className='text-[11px] px-2 py-0.5 rounded-full border border-brand/40 text-brand bg-foreground/10'
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
                  ? "border-brand bg-brand/10 shadow-[0_0_15px_rgba(29,255,0,0.2)]"
                  : isCompleted
                    ? "border-brand/50 bg-brand/5"
                    : "border-foreground/10 bg-foreground/5"
              }`}
            >
              <div className='relative flex-shrink-0'>
                {isCompleted ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    className='w-4 h-4 rounded-full bg-brand flex items-center justify-center'
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
                    className='w-4 h-4 rounded-full bg-brand'
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
                className={`text-[11px] sm:text-xs truncate font-medium ${isActive ? "text-brand" : isCompleted ? "text-brand/80" : "text-foreground/60"}`}
              >
                {label}
              </div>
              {isActive && (
                <motion.span
                  layoutId='activeStepGlow'
                  className='absolute inset-0 rounded-lg pointer-events-none'
                  style={{ boxShadow: "0 0 20px rgba(29,255,0,0.25) inset" }}
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
        <div className='h-2 bg-foreground/10 rounded-full overflow-hidden border border-brand/20 relative'>
          <motion.div
            className='absolute inset-0 opacity-20'
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(29,255,0,0.4) 50%, transparent 100%)",
            }}
            animate={{ x: ["-100%", "200%"] }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          />
          <motion.div
            className='h-full bg-gradient-to-r from-brand/60 via-brand to-brand/60 relative'
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
    <Card className='relative overflow-hidden bg-gradient-to-br from-brand/5 via-background to-background  border border-brand/20 p-5 mb-6 rounded-2xl'>
      <motion.div
        className='absolute inset-0 opacity-20'
        animate={{
          background: [
            "radial-gradient(400px at 0% 0%, rgba(29,255,0,0.15) 0%, transparent 100%)",
            "radial-gradient(400px at 100% 100%, rgba(29,255,0,0.15) 0%, transparent 100%)",
            "radial-gradient(400px at 0% 0%, rgba(29,255,0,0.15) 0%, transparent 100%)",
          ],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
      />
      <div className='relative z-10 flex flex-col sm:flex-row items-center gap-4'>
        <div className='flex-shrink-0 w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center border border-brand/20'>
          {isSearching ? (
            <Loader2 className='w-6 h-6 text-brand animate-spin' />
          ) : (
            <Sparkles className='w-6 h-6 text-brand' />
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
          <div className='flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/10 border border-brand/20 text-[10px] font-bold uppercase tracking-wider text-brand animate-pulse'>
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
  const handleJobFeedback = useCallback(
    async (job: Job, label: JobFeedbackLabel) => {
      try {
        await submitJobFeedback(job.id, label);
        safeInfo(
          "Feedback saved",
          `${JOB_FEEDBACK_COPY[label]} feedback will tune future job ranking.`,
        );
      } catch (feedbackError) {
        const message =
          feedbackError instanceof Error
            ? feedbackError.message
            : "Failed to save feedback.";
        toastError("Feedback failed", message);
      }
    },
    [safeInfo, toastError],
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
  const explainableCandidateProfile = useMemo<CandidateProfileInput>(
    () => ({
      targetTitle: profile?.job_title ?? searchQuery,
      searchQuery,
      location: profile?.location ?? selectedLocation,
      locationScope: profile?.location_scope ?? "city",
      experienceYears: profile?.experience_years ?? null,
      goals: Array.isArray(profile?.goals) ? profile.goals : [],
      proofPoints: profile?.proof_points ?? [],
      skills: (profileSkills.data ?? []).map((skill) => ({
        name: skill.name,
        level: skill.level,
        category: skill.category,
      })),
      experiences: (profileExperiences.data ?? []).map((experience) => ({
        title: experience.title,
        company: experience.company,
        description: experience.description,
        start_date: experience.start_date,
        end_date: experience.end_date,
        is_current: experience.is_current,
      })),
      resumeText: activeResumeText,
    }),
    [
      activeResumeText,
      profile?.experience_years,
      profile?.goals,
      profile?.job_title,
      profile?.location,
      profile?.location_scope,
      profile?.proof_points,
      profileExperiences.data,
      profileSkills.data,
      searchQuery,
      selectedLocation,
    ],
  );

  const opportunityCacheRef = useRef<Map<string, ExplainableJobOpportunity[]>>(new Map());

  const decorateJobsRef = useRef<(list: Job[]) => Promise<Job[]>>(
    async (list) => list,
  );
  const activeSearchScopeRef = useRef<JobsQueueScope>(null);

  const decorateJobs = useCallback(
    async (list: Job[]) => {
      const withMatchInsights = await fetchJobMatchInsights(
        list,
        matchContext,
        hasMatchScoreAccess && !applyingAll,
        () => {
          toastError(
            "Match Insights Failed",
            "Could not fetch AI match scores. Showing basic results.",
          );
        },
      );

      const feedbackEvents = profile?.id
        ? (
            await supabase
              .from("candidate_feedback_events")
              .select("*")
              .eq("user_id", profile.id)
          ).data || []
        : [];

      const cacheKey = `${profile?.id || "anonymous"}_${profile?.updated_at || ""}_${withMatchInsights.map((job) => job.id).join("|")}_${feedbackEvents.length}`;
      let finalOpportunities = opportunityCacheRef.current.get(cacheKey);

      if (!finalOpportunities) {
        finalOpportunities = buildExplainableJobOpportunities(
          withMatchInsights,
          explainableCandidateProfile,
          { feedbackEvents },
        );
        opportunityCacheRef.current.clear();
        opportunityCacheRef.current.set(cacheKey, finalOpportunities);
      }

      const opportunityByJobId = new Map(
        finalOpportunities.map((opportunity) => [opportunity.jobId, opportunity]),
      );

      return withMatchInsights.map((job) => ({
        ...job,
        explainableOpportunity: opportunityByJobId.get(job.id),
      }));
    },
    [
      applyingAll,
      explainableCandidateProfile,
      hasMatchScoreAccess,
      matchContext,
      profile?.id,
      profile?.updated_at,
      toastError,
    ],
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

  const loadCoverLetterLibrary = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      let entries: CoverLetterLibraryEntry[] = [];

      // 1. Fetch from Supabase
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase
            .from("cover_letters")
            .select("*")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false });

          if (!error && data) {
            entries = data.map((record) => {
              const payload = record.data;
              if (
                payload &&
                typeof payload === "object" &&
                !Array.isArray(payload) &&
                Object.keys(payload).length > 2
              ) {
                return {
                  id: record.id,
                  name: record.name || (payload as any).title || "Untitled Cover Letter",
                  updatedAt: record.updated_at || record.created_at,
                  data: payload,
                };
              }
              const contentStr = record.content || "";
              const paragraphs =
                typeof contentStr === "string" && contentStr.trim()
                  ? contentStr
                      .split(/\n\s*\n+/)
                      .map((p: any) => p.trim())
                      .filter(Boolean)
                  : [];
              return {
                id: record.id,
                name: record.name || "Untitled Cover Letter",
                updatedAt: record.updated_at || record.created_at,
                data: {
                  role: record.role || "",
                  company: record.company || "",
                  sender: {
                    name: record.sender_name || "",
                    email: record.sender_email || "",
                    phone: record.sender_phone || "",
                    address: record.sender_address || "",
                  },
                  recipient: {
                    name: record.recipient || "",
                    title: record.recipient_title || "",
                    company: record.company || "",
                    address: record.recipient_address || "",
                  },
                  content: {
                    date: record.date || new Date(record.created_at || Date.now()).toISOString().slice(0, 10),
                    subject: record.subject || (record.role ? `Application for ${record.role}` : ""),
                    salutation: record.salutation || "Dear Hiring Manager,",
                    paragraphs: paragraphs,
                    closing: record.closing || "Best regards,",
                    signature: record.signature_name || "",
                    rawBody: contentStr,
                  },
                  typography: {
                    fontSize: record.font_size || 16,
                  },
                },
              };
            });
          }
        }
      } catch (dbErr) {
        console.error("Error loading cover letters from database", dbErr);
      }

      // 2. Append/fallback to local storage draft
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

          if (!entries.some((e) => e.id === "__draft__")) {
            const paragraphs = Array.isArray(parsedDraft?.content?.paragraphs)
              ? parsedDraft.content.paragraphs
              : typeof parsedDraft?.content?.rawBody === "string" && parsedDraft.content.rawBody.trim()
                ? parsedDraft.content.rawBody.split(/\n\s*\n+/).map((p: any) => p.trim()).filter(Boolean)
                : [];
            entries.push({
              id: "__draft__",
              name: draftName + " (Local Draft)",
              updatedAt: draftUpdatedAt,
              data: {
                role: parsedDraft?.role || "",
                company: parsedDraft?.company || "",
                sender: parsedDraft?.sender || {
                  name: parsedDraft?.senderName || "",
                  email: parsedDraft?.senderEmail || "",
                  phone: parsedDraft?.senderPhone || "",
                  address: parsedDraft?.senderAddress || "",
                },
                recipient: parsedDraft?.recipient || {
                  name: parsedDraft?.recipientName || "",
                  title: parsedDraft?.recipientTitle || "",
                  company: parsedDraft?.company || "",
                  address: parsedDraft?.recipientAddress || "",
                },
                content: parsedDraft?.content || {
                  date: parsedDraft?.date || new Date().toISOString().slice(0, 10),
                  subject: parsedDraft?.subject || "",
                  salutation: parsedDraft?.salutation || "Dear Hiring Manager,",
                  paragraphs: paragraphs,
                  closing: parsedDraft?.closing || "Best regards,",
                  signature: parsedDraft?.signatureName || "",
                  rawBody: parsedDraft?.contentString || "",
                },
                typography: parsedDraft?.typography || {
                  fontSize: parsedDraft?.fontSize || 16,
                },
              },
              draft: true,
            });
          }
        } catch {
          // ignore malformed drafts
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
  }, [setCoverLetterLibrary, setSelectedCoverLetterId]);

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
      scope: JobsQueueScope = activeSearchScopeRef.current,
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
          .in("canonical_status", VISIBLE_JOB_QUEUE_STATES);

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

          if (scope?.startedAt) {
            queryBuilder = queryBuilder.gte("discovered_at", scope.startedAt);
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
    },
    [incrementalMode, isMobile],
  );


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
    async (query: string, _location?: string, customLimit?: number) => {
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
        // Determine max results per search based on subscription tier or customLimit
        let maxResultsPerSearch = customLimit || 10; // Free tier default

        if (!customLimit) {
          if (subscriptionTier === "Ultimate") {
            maxResultsPerSearch = 100;
          } else if (subscriptionTier === "Pro") {
            maxResultsPerSearch = 50;
          } else if (subscriptionTier === "Basics") {
            maxResultsPerSearch = 20;
          }
        }

        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id;

        if (!userId) {
          setError({ message: "User not authenticated. Please login again." });
          setQueueStatus("idle");
          setIncrementalMode(false);
          return;
        }

        const currentSearchScope: JobsQueueScope = {
          searchQuery: query.trim(),
          location: (_location || selectedLocation || "Remote").trim() || "Remote",
          limit: maxResultsPerSearch,
          startedAt: new Date(Date.now() - 30 * 1000).toISOString(),
        };

        const searchPayload = {
          searchQuery: query.trim(),
          location: currentSearchScope.location,
          locationScope,
          limit: maxResultsPerSearch,
          async: true,
        };

        if (debugMode) {
          console.log("[debug] jobs-search async request", searchPayload);
          setDbgSearchReq(searchPayload);
        }

        const { data: searchData, error: invokeErr } = await supabase.functions.invoke("jobs-search", {
          body: searchPayload,
        });

        if (invokeErr) {
          throw new Error(invokeErr.message || "Job search invocation failed.");
        }

        if (debugMode) {
          console.log("[debug] jobs-search async response", searchData);
          setDbgSearchRes(searchData);
        }

        if (searchData?.error) {
          throw new Error(searchData.detail || searchData.error);
        }

        if (searchData?.taskId) {
          activeTaskIdRef.current = searchData.taskId;
          activeSearchScopeRef.current = currentSearchScope;
          setActiveSearchScope(currentSearchScope);

          safeInfo(
            "Search started",
            "Searching the web and analyzing matches in the background.",
          );
        } else {
          throw new Error("No task ID returned from background search.");
        }
      } catch (e: any) {
        activeSearchScopeRef.current = null;
        setActiveSearchScope(null);
        const fallbackJobs = await fetchJobQueue(null);
        setError({ message: `Failed to search jobs: ${e.message}` });
        if (fallbackJobs.length === 0) {
          setQueueStatus("idle");
        }
        setIncrementalMode(false);
      }
    },
    [
      supabase,
      debugMode,
      incrementalMode,
      fetchJobQueue,
      safeInfo,
      selectedLocation,
      locationScope,
      subscriptionTier,
    ],
  );

  // Listen for background task changes via real-time subscription
  useEffect(() => {
    const activeTaskId = activeTaskIdRef.current;
    if (!activeTaskId) return;

    const activeTask = jobTasks.find((t) => t.id === activeTaskId);
    if (!activeTask) return;

    // 1. Scout Search task progress handling
    if (activeTask.type === "scout_search") {
      if (activeTask.status === "running") {
        setIncrementalMode(true);
        setQueueStatus("populating");
        setStepIndex(activeTask.progress_current);
        const currentCount = typeof activeTask.result?.count === "number"
          ? activeTask.result.count
          : activeTask.progress_current;
        setInsertedThisRun(currentCount);
        if (activeTask.message) {
          setCurrentSource(activeTask.message);
        }
      } else if (activeTask.status === "completed") {
        const finalCount = typeof activeTask.result?.count === "number"
          ? activeTask.result.count
          : insertedThisRun;
        setInsertedThisRun(finalCount);
        setStepIndex(2);

        void fetchJobQueue().then((currentJobs) => {
          if (currentJobs.length > 0) {
            setQueueStatus("ready");
            setSelectedJob((prev) => {
              if (prev && currentJobs.some((j) => j.id === prev)) return prev;
              return isMobile ? null : currentJobs[0].id;
            });
          } else {
            setQueueStatus("empty");
          }
        });

        safeInfo(
          "Job search complete!",
          finalCount > 0
            ? `Found and saved ${finalCount} jobs.`
            : "No jobs found for this search.",
        );

        setTimeout(() => {
          setIncrementalMode(false);
          setCurrentSource(null);
          if (activeTaskIdRef.current === activeTaskId) {
            activeTaskIdRef.current = null;
          }
        }, 800);
      } else if (["failed", "canceled"].includes(activeTask.status)) {
        setIncrementalMode(false);
        setQueueStatus(jobs.length > 0 ? "ready" : "empty");
        setCurrentSource(null);
        if (activeTask.status === "failed") {
          setError({ message: activeTask.message || "Search task failed." });
        }
        if (activeTaskIdRef.current === activeTaskId) {
          activeTaskIdRef.current = null;
        }
      }
    }

    // 2. Job Reevaluation task progress handling
    if (activeTask.type === "job_reevaluation") {
      if (activeTask.status === "running") {
        if (activeTask.message) {
          safeInfo("Re-evaluating jobs", activeTask.message);
        }
      } else if (activeTask.status === "completed") {
        void fetchJobQueue();
        safeInfo("Re-evaluation complete", activeTask.message || "All visible jobs re-evaluated.");
        if (activeTaskIdRef.current === activeTaskId) {
          activeTaskIdRef.current = null;
        }
      } else if (["failed", "canceled"].includes(activeTask.status)) {
        if (activeTask.status === "failed") {
          toastError("Re-evaluation failed", activeTask.message || "AI Fit evaluation failed.");
        }
        if (activeTaskIdRef.current === activeTaskId) {
          activeTaskIdRef.current = null;
        }
      }
    }

    // 3. Pipeline Cleanup task progress handling
    if (activeTask.type === "pipeline_cleanup") {
      if (activeTask.status === "completed") {
        const cleanedIds = (activeTask.result?.cleaned_job_ids || activeTask.params?.job_ids || []) as string[];
        if (cleanedIds.length > 0) {
          setJobs((prev) => prev.filter((job) => !cleanedIds.includes(job.id)));
          void queryClient.invalidateQueries({ queryKey: jobsQueueKeys.all });
          safeInfo(
            "Pipeline cleaned",
            `Hid ${cleanedIds.length} low-quality job${cleanedIds.length === 1 ? "" : "s"}.`,
          );
        }
        if (activeTaskIdRef.current === activeTaskId) {
          activeTaskIdRef.current = null;
        }
      } else if (["failed", "canceled"].includes(activeTask.status)) {
        if (activeTask.status === "failed") {
          toastError("Cleanup failed", activeTask.message || "Pipeline cleanup failed.");
        }
        if (activeTaskIdRef.current === activeTaskId) {
          activeTaskIdRef.current = null;
        }
      }
    }
  }, [jobTasks, fetchJobQueue, insertedThisRun, safeInfo, toastError, queryClient, jobs.length]);

  // Removed old process-and-match and polling logic - jobs are now saved directly

  const cancelPopulation = useCallback(() => {
    setIncrementalMode(false);
    setQueueStatus(jobs.length > 0 ? "ready" : "empty");
    setCurrentSource(null);
  }, [jobs.length]);

  const handleCancelPopulation = useCallback(() => {
    const activeTaskId = activeTaskIdRef.current;
    if (activeTaskId) {
      canceledTaskIdsRef.current.add(activeTaskId);
      void cancelTask(activeTaskId).catch((error) => {
        console.warn("Failed to cancel active scout task", error);
      });
    }
    cancelPopulation();
  }, [cancelPopulation, cancelTask]);

  const loadAutoApplyTargetJob = useCallback(async (jobId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("user_id", user.id)
      .eq("hidden", false)
      .eq("id", jobId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? mapDbJobToUiJob(data) : null;
  }, []);

  const openAutoApplyFlow = useCallback(
    async (targetJob: Job | null = jobToAutoApply ?? null) => {
      setAiEvaluation(null);
      setForceSubmit(false);
      setJobToAutoApply(targetJob);
      
      const res = await fetchConcurrencyInfo();
      if (res && res.availableSlots <= 0) {
        setConcurrencyModalOpen(true);
        return;
      }

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
    },
    [
      fetchConcurrencyInfo,
      hasAutoApplyAccess,
      jobToAutoApply,
      loadCoverLetterLibrary,
      resumes,
      safeInfo,
      selectedResumeId,
    ],
  );

  /** Deep link from Applications: `/dashboard/jobs?autoApplyJobId=<uuid>` reopens auto-apply for a saved job. */
  const autoApplyDeepLinkConsumed = useRef<string | null>(null);
  useEffect(() => {
    const jobId = searchParams.get("autoApplyJobId");
    if (!jobId) {
      autoApplyDeepLinkConsumed.current = null;
      return;
    }
    if (autoApplyDeepLinkConsumed.current === jobId) return;
    if (queueStatus === "loading" || queueStatus === "populating") return;

    if (queueStatus === "ready" || queueStatus === "empty") {
      const targetInQueue = jobs.find((j) => j.id === jobId);
      if (!targetInQueue) {
        let cancelled = false;
        autoApplyDeepLinkConsumed.current = jobId;

        const clearAutoApplyDeepLink = () =>
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.delete("autoApplyJobId");
              return next;
            },
            { replace: true },
          );

        const resolveHiddenTarget = async () => {
          try {
            const hiddenTarget = await loadAutoApplyTargetJob(jobId);
            if (cancelled) return;

            if (hiddenTarget) {
              openAutoApplyFlow(hiddenTarget);
            } else {
              safeInfo(
                "Job unavailable",
                "That role has already moved out of your Jobs queue and could not be reopened from saved jobs.",
              );
            }
          } catch (error) {
            if (cancelled) return;
            console.warn(
              "[jobs] failed to resolve auto-apply deep link",
              error,
            );
            safeInfo(
              "Unable to open saved job",
              "We couldn't load that auto-apply target just now. Please try again from Applications.",
            );
          } finally {
            if (!cancelled) {
              clearAutoApplyDeepLink();
            }
          }
        };

        void resolveHiddenTarget();

        return () => {
          cancelled = true;
        };
      }
    }

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
    loadAutoApplyTargetJob,
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
  }, [autoApplyStep, draftData, resumeDialogOpen, safeInfo, selectedResumeId]);

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
        const identityInstructions = [
          "Use only the selected resume text as the candidate source of truth.",
          "Do not use account-owner profile details, saved candidate memory, previous cover letters, or other workspace data unless they appear in the selected resume text.",
        ];
        if (selectedResumeCandidateName) {
          identityInstructions.push(
            `The selected resume candidate name is "${selectedResumeCandidateName}". Preserve that identity in every generated material.`,
          );
        }
        if (resumeIdentityMismatch) {
          identityInstructions.push(
            "The selected resume appears to belong to a different person than the account profile. Do not replace the resume candidate's name or contact details with the account profile's details.",
          );
        }
        const draftInstructions = [identityInstructions.join("\n"), instructions]
          .filter(Boolean)
          .join("\n\n");
        const [tailoredResume, tailoredCoverLetter] = await Promise.all([
          tailorResumeViaEdge({
            jobDescription: targetJob.description || "",
            resumeText,
            instructions: draftInstructions,
            includeCandidateMemory: false,
          }),
          generateCoverLetterViaEdge({
            jobDescription: targetJob.description || "",
            resumeText,
            instructions: draftInstructions,
            includeCandidateMemory: false,
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
      resumeIdentityMismatch,
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
        `The account profile name is "${profileFullName}", but the selected resume appears to belong to "${selectedResumeCandidateName || "a different candidate"}". Do not merge account profile details into this draft; preserve the selected resume candidate's identity and contact details.`,
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
    selectedResumeCandidateName,
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

      if (!saveAsDraftOnly) {
        setApplyingAll(true);
        try {
          const res = await fetchConcurrencyInfo();
          if (res && res.availableSlots <= 0) {
            setConcurrencyModalOpen(true);
            setApplyingAll(false);
            return;
          }
        } catch (concurrencyErr) {
          console.warn("Failed to verify concurrency prior to launch:", concurrencyErr);
        } finally {
          setApplyingAll(false);
        }
      }

      const targetJobs = jobToAutoApply ? [jobToAutoApply] : jobs;
      if (!targetJobs.length) return;

      if (saveAsDraftOnly) {
        setApplyingAll(true);
        try {
          const savedAt = new Date().toISOString();
          let savedCount = 0;

          for (const job of targetJobs) {
            const existingRawData =
              job.raw_data && typeof job.raw_data === "object"
                ? (job.raw_data as Record<string, unknown>)
                : {};
            const evaluation =
              jobToAutoApply?.id === job.id ? aiEvaluation || undefined : undefined;
            const matchedKeywords =
              evaluation?.matched_keywords ||
              job.evaluation_summary?.matched_keywords ||
              [];
            const nextDraftPayload =
              draftData && targetJobs.length === 1
                ? {
                    ...draftData,
                    savedAt,
                  }
                : existingRawData.application_draft &&
                    typeof existingRawData.application_draft === "object"
                  ? {
                      ...(existingRawData.application_draft as Record<
                        string,
                        unknown
                      >),
                      savedAt,
                    }
                  : { savedAt };

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

            if (draftUpdateError) throw draftUpdateError;
            if (
              typeof (nextDraftPayload as any)?.resumeText === "string" ||
              typeof (nextDraftPayload as any)?.coverLetterText === "string"
            ) {
              try {
                await saveApplicationPackage({
                  jobId: job.id,
                  tailoredResume:
                    typeof (nextDraftPayload as any)?.resumeText === "string"
                      ? ((nextDraftPayload as any).resumeText as string)
                      : null,
                  coverLetter:
                    typeof (nextDraftPayload as any)?.coverLetterText === "string"
                      ? ((nextDraftPayload as any).coverLetterText as string)
                      : null,
                  fitBullets: [
                    ...(job.evaluation_summary?.exact_fit_evidence ?? []),
                    ...matchedKeywords.map((keyword) => `Keyword fit: ${keyword}`),
                  ].slice(0, 8),
                  metadata: {
                    source: "auto_apply_draft",
                    source_resume_id: (nextDraftPayload as any)?.sourceResumeId ?? null,
                    saved_at: savedAt,
                  },
                });
              } catch (packageError) {
                console.warn("Failed to save application package", packageError);
              }
            }
            savedCount += 1;
          }

          setJobs((prev) =>
            prev.map((row) =>
              targetJobs.some((job) => job.id === row.id)
                ? { ...row, canonical_status: "draft_ready" }
                : row,
            ),
          );
          setJobToAutoApply((prev) =>
            prev && targetJobs.some((job) => job.id === prev.id)
              ? { ...prev, canonical_status: "draft_ready" }
              : prev,
          );
          safeInfo(
            "Draft saved",
            `Saved ${savedCount} job${savedCount === 1 ? "" : "s"} as draft-ready for review.`,
          );
          await fetchJobQueue();
        } catch (draftSaveError) {
          const message =
            draftSaveError instanceof Error
              ? draftSaveError.message
              : "Unknown error";
          setError({ message: `Failed to save draft: ${message}` });
        } finally {
          setApplyingAll(false);
        }
        return;
      }

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
        setApplyingAll(true);
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
                const hardBlockers = evaluation.blockers?.length ?? 0;

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
                  const reason =
                    hardBlockers > 0
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

            const evalDecision =
              evaluation?.canonical_decision ??
              job.evaluation_summary?.canonical_decision;
            const evalConfidence =
              evaluation?.confidence_score ??
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
                  pushLog(
                    `Generating tailored cover letter for ${job.title}...`,
                  );
                  const generated = await generateCoverLetterViaEdge({
                    jobDescription: job.description,
                    resumeText: activeResumeText || "",
                    includeCandidateMemory: false,
                    instructions:
                      "Use only the selected resume text as candidate source material. Do not use account-owner profile details, saved candidate memory, previous cover letters, or other workspace data unless they appear in the selected resume text.",
                  });
                  if (generated) {
                    jobCoverLetter = generated;
                    pushLog(`Cover letter ready for ${job.title}`, "success");
                  }
                } catch (clErr) {
                  console.warn(
                    "Per-job cover letter generation failed, using default",
                    clErr,
                  );
                }
              }

              pushLog(
                `Dispatching automation to ${new URL(target).hostname}...`,
              );
              const automationPayload = {
                jobs: [
                  {
                    sourceUrl: target,
                    url: applyMicro1ReferralToUrl(job.apply_url ?? target),
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
      fetchConcurrencyInfo,
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
    const toRecentTs = (job: Job) => {
      const value = job.discovered_at || job.posted_at || job.created_at;
      if (!value) return 0;
      const timestamp = Date.parse(value);
      return Number.isNaN(timestamp) ? 0 : timestamp;
    };
    if (sortBy === "opportunity") {
      return arr.sort(
        (a, b) =>
          (b.explainableOpportunity?.opportunityScore ?? -1) -
            (a.explainableOpportunity?.opportunityScore ?? -1) ||
          toRecentTs(b) - toRecentTs(a),
      );
    }
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
    return arr.sort((a, b) => toRecentTs(b) - toRecentTs(a));
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

  const exportVisibleJobsCSV = useCallback(() => {
    if (!hasBulkPipelineAccess) {
      toastError("Upgrade Required", "Bulk export is available on Basics and above.");
      return;
    }
    if (!sortedJobs.length) return;
    const headers = [
      "title",
      "company",
      "location",
      "apply_url",
      "status",
      "lead_quality_score",
      "match_score",
      "canonical_decision",
    ];
    const rows = sortedJobs.map((job) => [
      job.title,
      job.company,
      job.location ?? "",
      job.apply_url ?? "",
      job.canonical_status ?? "",
      job.lead_quality_score ?? "",
      job.matchScore ?? "",
      job.evaluation_summary?.canonical_decision ?? "",
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `jobraker-jobs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    safeInfo("Export started", `${sortedJobs.length} visible jobs exported.`);
  }, [hasBulkPipelineAccess, safeInfo, sortedJobs, toastError]);

  const cleanLowQualityJobs = useCallback(async () => {
    if (!hasPipelineCleanupAccess) {
      toastError(
        "Upgrade Required",
        "Pipeline cleanup is available on Pro and above.",
      );
      return;
    }

    const lowQualityJobIds = jobs
      .filter(
        (job) =>
          (job.lead_quality_score ?? 100) < 45 ||
          (job.lead_quality_tags ?? []).some((tag) =>
            ["spam_signal", "invalid_url", "missing_company"].includes(tag),
          ),
      )
      .map((job) => job.id);

    if (!lowQualityJobIds.length) {
      safeInfo("Pipeline clean", "No low-quality jobs need cleanup right now.");
      return;
    }

    try {
      const task = await createTask({
        type: "pipeline_cleanup",
        title: "Clean low-quality jobs",
        message: `Preparing to hide ${lowQualityJobIds.length} low-quality jobs.`,
        progressTotal: lowQualityJobIds.length,
        params: { job_ids: lowQualityJobIds },
      });
      activeTaskIdRef.current = task.id;
    } catch (cleanupError) {
      const message =
        cleanupError instanceof Error ? cleanupError.message : "Cleanup failed.";
      toastError("Cleanup failed", message);
    }
  }, [
    createTask,
    hasPipelineCleanupAccess,
    jobs,
    safeInfo,
    toastError,
  ]);

  const handleStopJobTask = useCallback(
    (task: JobIntelligenceTask) => {
      canceledTaskIdsRef.current.add(task.id);
      if (activeTaskIdRef.current === task.id) {
        cancelPopulation();
      }
      void cancelTask(task.id).catch((error) => {
        console.warn("Failed to cancel job task", error);
        toastError("Cancel failed", error.message || "Could not stop task.");
      });
    },
    [cancelPopulation, cancelTask, toastError],
  );

  const handleRetryJobTask = useCallback(
    (task: JobIntelligenceTask) => {
      canceledTaskIdsRef.current.delete(task.id);
      const params = task.params ?? {};
      if (task.type === "scout_search") {
        const query =
          typeof params.search_query === "string"
            ? params.search_query
            : searchQuery;
        const location =
          typeof params.location === "string" ? params.location : selectedLocation;
        const limit =
          typeof params.limit === "number" ? params.limit : undefined;
        void populateQueue(query, location, limit);
        return;
      }
      if (task.type === "pipeline_cleanup") {
        void cleanLowQualityJobs();
        return;
      }
    },
    [
      cleanLowQualityJobs,
      populateQueue,
      searchQuery,
      selectedLocation,
    ],
  );

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
    <div className='relative min-h-full' role='main' aria-label='Job search'>
      {/* Animated SVG Background */}
      <AnimatedSVGBackground />

      {/* Ambient Background Glow */}

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
              <div className='border border-foreground/10 p-3 relative flex w-full flex-col gap-3 rounded-2xl px-4 py-3 shadow-sm sm:w-auto sm:flex-row sm:items-center sm:gap-4'>
                <div className='relative z-10 space-y-1'>
                  <div className='text-[10px] uppercase tracking-[0.35em] text-brand/80 font-semibold'>
                    Automation readiness
                  </div>
                  <div className='flex items-center gap-2 text-sm font-medium'>
                    {profileReady && resumeLibraryReady ? (
                      <>
                        <ShieldCheck className='h-4 w-4 text-brand' />
                        <span className='text-foreground'>Ready to launch</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className='h-4 w-4 text-brand' />
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
                          ? "border-brand/60 bg-gradient-to-br from-brand/20 to-brand/10 text-brand shadow-[0_0_10px_rgba(29,255,0,0.15)] hover:shadow-[0_0_15px_rgba(29,255,0,0.25)]"
                          : "border-brand/50 bg-gradient-to-br from-brand/15 to-brand/5 text-brand shadow-[0_0_10px_rgba(29,255,0,0.15)] hover:shadow-[0_0_15px_rgba(29,255,0,0.25)]",
                      )}
                      title={
                        profileReady
                          ? "Profile details detected"
                          : "Complete your profile"
                      }
                    >
                      {profileReady ? (
                        <UserCheck className='h-3.5 w-3.5 text-brand' />
                      ) : (
                        <UserX className='h-3.5 w-3.5 text-brand' />
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
                          ? "border-brand/60 bg-gradient-to-br from-brand/20 to-brand/10 text-brand shadow-[0_0_10px_rgba(29,255,0,0.15)] hover:shadow-[0_0_15px_rgba(29,255,0,0.25)]"
                          : "border-brand/50 bg-gradient-to-br from-brand/15 to-brand/5 text-brand shadow-[0_0_10px_rgba(29,255,0,0.15)] hover:shadow-[0_0_15px_rgba(29,255,0,0.25)]",
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
                        <FileCheck2 className='h-3.5 w-3.5 text-brand' />
                      ) : (
                        <FileWarning className='h-3.5 w-3.5 text-brand' />
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
                      className='px-1 py-0.5 rounded hover:text-foreground focus:outline-none focus:ring-1 focus:ring-brand/50'
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

                <div className='grid grid-cols-3 sm:flex sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto'>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        className={`group relative flex-1 sm:flex-none overflow-hidden rounded-xl px-3 py-2 sm:px-4 sm:py-2 md:px-5 text-xs sm:text-sm font-medium tracking-wide transition-all duration-300 border backdrop-blur-md disabled:cursor-not-allowed disabled:opacity-60 sm:whitespace-nowrap ${
                          queueStatus === "populating" || queueStatus === "loading"
                            ? "border-foreground/60 text-foreground bg-foreground/15"
                            : "border-foreground/20 text-foreground bg-foreground/5 hover:text-brand hover:border-brand/60 hover:bg-brand/10"
                        }`}
                        title='Find a fresh batch of jobs'
                        disabled={
                          queueStatus === "populating" || queueStatus === "loading"
                        }
                      >
                        <span className='relative inline-flex items-center justify-center gap-1.5 sm:gap-2'>
                          {queueStatus === "populating" ? (
                            <Loader2 className='w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin' />
                          ) : (
                            <Search className='w-3.5 h-3.5 sm:w-4 sm:h-4 ' />
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
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 bg-background/95 backdrop-blur-md border border-foreground/10 text-foreground rounded-xl p-1.5 shadow-xl">
                      {[
                        { limit: 10, tier: "Free" as const, label: "10 Jobs (Free)" },
                        { limit: 20, tier: "Basics" as const, label: "20 Jobs (Basics)" },
                        { limit: 50, tier: "Pro" as const, label: "50 Jobs (Pro)" },
                        { limit: 100, tier: "Ultimate" as const, label: "100 Jobs (Ultimate)" },
                      ].map((opt) => {
                        const isLocked = !hasSubscriptionAccess(subscriptionTier, opt.tier);
                        return (
                          <DropdownMenuItem
                            key={opt.limit}
                            onClick={() => {
                              if (isLocked) {
                                toastError(
                                  "Upgrade Required",
                                  `Searching ${opt.limit} jobs requires the ${opt.tier} plan.`
                                );
                              } else {
                                populateQueue(searchQuery, selectedLocation, opt.limit);
                              }
                            }}
                            className="flex items-center justify-between cursor-pointer px-3 py-2 rounded-lg text-left text-xs sm:text-sm font-medium transition-colors hover:bg-foreground/5 focus:bg-foreground/5"
                          >
                            <span className="flex items-center gap-2">
                              {opt.tier === "Free" ? (
                                <Search className="h-4 w-4 text-foreground/50" />
                              ) : opt.tier === "Basics" ? (
                                <Sparkles className="h-4 w-4 text-brand" />
                              ) : opt.tier === "Pro" ? (
                                <Zap className="h-4 w-4 text-cyan-400" />
                              ) : (
                                <Crown className="h-4 w-4 text-yellow-400" />
                              )}
                              <span>{opt.label}</span>
                            </span>
                            {isLocked && <Lock className="h-3.5 w-3.5 text-foreground/45" />}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant='ghost'
                    onClick={() => {
                      openAutoApplyFlow(null);
                    }}
                    className={`relative flex-1 sm:flex-none overflow-hidden border border-brand/40 text-foreground px-3 py-2 sm:px-4 sm:py-2 md:px-5 rounded-xl transition-all duration-300 text-xs sm:text-sm sm:whitespace-nowrap ${applyingAll ? "bg-brand/20 text-brand" : "bg-brand/5 text-brand"}`}
                    title='Auto apply all visible jobs'
                    disabled={
                      applyingAll ||
                      loadingTier ||
                      queueStatus !== "ready" ||
                      jobs.length === 0
                    }
                  >
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
                    onClick={exportVisibleJobsCSV}
                    className='relative flex-1 sm:flex-none overflow-hidden border border-foreground/20 text-foreground/75 bg-foreground/5 px-3 py-2 sm:px-4 sm:py-2 rounded-xl transition-all duration-300 text-xs sm:text-sm sm:whitespace-nowrap hover:border-brand/40 hover:text-brand'
                    title='Export visible jobs to CSV'
                    disabled={jobs.length === 0}
                  >
                    Export
                  </Button>
                  <Button
                    variant='ghost'
                    onClick={cleanLowQualityJobs}
                    className='relative flex-1 sm:flex-none overflow-hidden border border-foreground/20 text-foreground/75 bg-foreground/5 px-3 py-2 sm:px-4 sm:py-2 rounded-xl transition-all duration-300 text-xs sm:text-sm sm:whitespace-nowrap hover:border-brand/40 hover:text-brand'
                    title='Hide jobs with poor quality-gate signals'
                    disabled={jobs.length === 0}
                  >
                    Clean
                  </Button>
                  <Button
                    variant='ghost'
                    onClick={() => setConfirmDeleteOpen(true)}
                    className={`group relative flex-none overflow-hidden rounded-xl px-3 py-2 sm:px-4 sm:py-2 md:px-5 text-xs sm:text-sm font-medium tracking-wide transition-all duration-300 border backdrop-blur-md sm:whitespace-nowrap ${
                      clearingJobs
                        ? "border-red-600/60 text-red-600 bg-red-600/15 cursor-not-allowed opacity-60"
                        : jobs.length === 0
                          ? "border-red-600/20 text-red-600/40 bg-red-600/5 cursor-not-allowed opacity-40"
                          : "border-red-600/40 text-red-600 bg-red-600/10 hover:text-red-600 hover:border-red-600/60 hover:bg-red-600/20"
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
                          "linear-gradient(120deg, transparent 0%, rgba(29,255,0,0.25) 45%, transparent 90%)",
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
            onCancel={handleCancelPopulation}
            foundCount={insertedThisRun}
          />
        )}

        <JobTaskMonitor
          tasks={jobTasks}
          onStop={handleStopJobTask}
          onRetry={handleRetryJobTask}
        />

        {/* Patience Indicator: Show if results are very few (< 10) but we might be finding more, or if we are still in incremental mode */}
        {((total < 10 && queueStatus === "ready") ||
          (incrementalMode && total === 0)) && (
          <PatienceBanner
            count={total}
            isSearching={incrementalMode || queueStatus === "populating"}
          />
        )}

        <Card
          className='relative overflow-hidden border-none mb-6 sm:mb-8 rounded-2xl transition-colors duration-300 '
          id='jobs-search-filters'
          data-tour='jobs-search-filters'
        >
          <div className='relative z-10 flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-stretch'>
            <div className='relative min-w-0 flex-1'>
              <div
                id='jobs-search'
                data-tour='jobs-search'
                aria-label={`Search query ${searchQuery || "No query"}`}
                role='status'
                className='flex h-12 w-full items-center rounded-xl border border-foreground/10 pl-4 pr-[8.25rem] sm:pr-36 text-base font-medium text-foreground'
              >
                <span className={`min-w-0 truncate ${!searchQuery ? "text-foreground/40" : ""}`}>
                  {searchQuery || "Search jobs, companies, keywords..."}
                </span>
              </div>
              <div className='pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 xl:-translate-y-full h-10 items-center justify-center gap-2'>
                <span className='text-[10px] font-medium text-brand/90 bg-gradient-to-br from-brand/15 to-brand/5 px-2.5 py-1 rounded-lg border border-brand/30 whitespace-nowrap shadow-sm'>
                  {subscriptionTier === "Ultimate"
                    ? "100"
                    : subscriptionTier === "Pro"
                      ? "50"
                      : subscriptionTier === "Basics"
                        ? "20"
                        : "10"}{" "}
                  results
                </span>
                <Search className='h-5 w-5 shrink-0 text-brand/70' />
              </div>
            </div>
            <div className='flex w-full flex-col gap-2 lg:w-72 lg:shrink-0 xl:w-80'>
              <div className='relative'>
                <MapPin className='pointer-events-none absolute right-3 top-1/2 z-[1] w-5 -translate-y-1/2 text-brand/60' />
                <div
                  id='jobs-location'
                  data-tour='jobs-location'
                  aria-label={`Selected location ${selectedLocation || "Remote"}`}
                  role='status'
                  className='flex h-12 w-full items-center rounded-xl border border-foreground/10 pl-4 pr-11 text-base font-medium text-foreground'
                >
                  <span className='min-w-0 truncate'>
                    {selectedLocation || "Remote"}
                  </span>
                </div>
              </div>
              <div className='flex w-full gap-0.5 rounded-lg border border-foreground/10 p-0.5'>
                {(["city", "country", "global"] as const).map((scope) => (
                  <button
                    key={scope}
                    type='button'
                    onClick={() => setLocationScope(scope)}
                    className={`min-h-[2rem] flex-1 px-1.5 py-1.5 text-[10px] font-semibold leading-tight rounded-md transition-all duration-200 sm:px-2.5 ${
                      locationScope === scope
                        ? "bg-brand/15 text-brand border border-brand/30"
                        : "text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5 border border-transparent"
                    }`}
                  >
                    {scope === "city"
                      ? "City"
                      : scope === "country"
                        ? "Country"
                        : "Global"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8'>
          <div className='space-y-4'>
            <div className='flex items-center justify-between mb-3 sticky top-0 z-10 backdrop-blur-xl rounded-xl px-4 py-3 border-foreground/10 lg:static  lg:bg-transparent lg:border-0 lg:backdrop-blur-none'>
              <h2 className='text-lg sm:text-xl font-bold text-foreground flex items-center gap-2'>
                {queueStatus === "loading" &&
                  !incrementalMode &&
                  "Loading results..."}
                {(queueStatus === "populating" || incrementalMode) &&
                  "Building your results..."}
                {(queueStatus === "ready" || queueStatus === "empty") &&
                  !incrementalMode && (
                    <>
                      <span className='flex items-center gap-2'>
                        {" "}
                        <Briefcase className='h-4 w-4' />
                        {total} Jobs Found
                      </span>
                      {total > 0 && (
                        <span className='ml-2 text-xs font-normal px-2 py-1 rounded-lg bg-brand/10 text-brand border border-brand/30'>
                          AI Matched
                        </span>
                      )}
                      {activeSearchScope && (
                        <Button
                          onClick={async () => {
                            setActiveSearchScope(null);
                            activeSearchScopeRef.current = null;
                            await queryClient.invalidateQueries({ queryKey: jobsQueueKeys.all });
                          }}
                          variant="ghost"
                          size="sm"
                          className="ml-2 h-7 px-2.5 rounded-lg text-xs font-semibold bg-brand/10 hover:bg-brand/20 text-brand border border-brand/30 flex items-center gap-1 transition-all duration-200"
                        >
                          <X className="h-3 w-3" />
                          <span>Clear Search</span>
                        </Button>
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
                        { value: "opportunity", label: "Best opportunity" },
                        { value: "recent", label: "Most recent" },
                        { value: "company", label: "Company" },
                        { value: "deadline", label: "Deadline" },
                      ]}
                      placeholder='Sort by'
                      triggerClassName='h-8 w-[160px] text-sm '
                    />
                  </div>
                )}
            </div>

            {queueStatus === "ready" && total > 0 && !incrementalMode && (
              <div className='hidden lg:grid grid-cols-[auto,1fr,auto] items-center gap-3 px-3 py-2 text-xs tracking-wider text-muted-foreground font-semibold border border-foreground/10 rounded-lg'>
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
                      className='relative overflow-hidden border border-foreground/10 bg-background p-5 sm:p-6'
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
                <Card className='relative overflow-hidden border border-brand/20 bg-gradient-to-br from-background via-background/98 to-background/95 p-6 sm:p-7'>
                  <motion.div
                    className='pointer-events-none absolute inset-[-40%] bg-[radial-gradient(circle_at_top,rgba(29,255,0,0.28),rgba(29,255,0,0)_60%)] opacity-60'
                    animate={{ rotate: [0, 360] }}
                    transition={{
                      duration: 14,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                  <div className='relative flex flex-col gap-5'>
                    <div className='flex items-center gap-3 text-xs uppercase tracking-[0.4em] text-brand/70'>
                      <span className='inline-flex h-6 w-6 items-center justify-center rounded-full border border-brand/40 bg-brand/10'>
                        <span className='h-2 w-2 rounded-full bg-brand animate-ping' />
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
                              <span className='text-[9px] font-mono text-brand/80'>
                                {String(idx + 1).padStart(2, "0")}
                              </span>
                            </div>
                            <div className='mt-3 h-2 rounded-full bg-foreground/10 overflow-hidden'>
                              <motion.div
                                className='h-full bg-gradient-to-r from-background via-brand to-brand'
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
                      className='relative overflow-hidden border border-brand/25 bg-gradient-to-br from-background via-background/98 to-background/95 p-5 sm:p-6'
                    >
                      <motion.div
                        className='absolute inset-0 bg-[linear-gradient(120deg,rgba(29,255,0,0.12)_0%,rgba(29,255,0,0.02)_38%,rgba(29,255,0,0.15)_72%,rgba(29,255,0,0.02)_100%)]'
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
                          <div className='relative flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border  border-foreground/10'>
                            <motion.span
                              className='absolute h-10 w-10 rounded-full bg-brand/20'
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
                            <span className='relative h-8 w-8 rounded-full border border-brand/40' />
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
              <Card className='border-brand/30 bg-brand/10 text-brand p-4 flex items-center justify-between'>
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
              <Card className='relative overflow-hidden border border-brand/30 bg-gradient-to-br from-background via-background/98 to-background/95 text-foreground p-4 sm:p-5'>
                <div className='pointer-events-none absolute -inset-32 bg-brand/10 blur-3xl opacity-40' />
                <div className='relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
                  <div className='flex items-center gap-3'>
                    <Loader2 className='w-5 h-5 animate-spin text-brand' />
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
                        "linear-gradient(90deg, transparent 0%, rgba(29,255,0,0.6) 50%, transparent 100%)",
                    }}
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{
                      repeat: Infinity,
                      duration: 1.4,
                      ease: "linear",
                    }}
                  />
                  <motion.div
                    className='relative h-full bg-gradient-to-r from-brand via-brand to-brand'
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
                  <div className='absolute top-1/4 left-1/4 w-96 h-96 bg-brand/5 rounded-full blur-3xl animate-pulse' />
                  <div className='absolute bottom-1/4 right-1/4 w-80 h-80 bg-background/5 rounded-full blur-3xl animate-pulse delay-1000' />
                </div>

                {/* Main Content */}
                <Card className='relative z-10 max-w-2xl mx-auto bg-gradient-to-br from-background via-background/95 to-background/90 border border-brand/20 backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,0.8),0_0_0_1px_rgba(29,255,0,0.1)]'>
                  <div className='p-8 sm:p-12 text-center space-y-8'>
                    {/* Icon Container with Animation */}
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className='relative mx-auto w-32 h-32'
                    >
                      {/* Glowing Ring */}
                      <div className='absolute inset-0 rounded-full bg-gradient-to-br from-brand/20 to-background/10 blur-xl animate-pulse' />

                      {/* Icon Background */}
                      <div className='relative w-full h-full rounded-full bg-gradient-to-br from-brand/10 to-background/5 border border-brand/30 flex items-center justify-center shadow-[0_0_40px_rgba(29,255,0,0.15)]'>
                        <Briefcase
                          className='w-16 h-16 text-brand drop-shadow-[0_0_20px_rgba(29,255,0,0.6)]'
                          strokeWidth={1.5}
                        />
                      </div>

                      {/* Floating Particles */}
                      <div className='absolute -top-2 -right-2 w-3 h-3 rounded-full bg-brand animate-ping opacity-40' />
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
                          className='inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand/10 border border-brand/20 text-brand text-sm'
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
                        className='group relative overflow-hidden px-8 py-6 rounded-xl bg-gradient-to-r from-brand to-background text- font-semibold text-base shadow-[0_0_0_1px_#1dff00,0_8px_32px_rgba(29,255,0,0.4)] hover:shadow-[0_0_0_1px_#1dff00,0_12px_48px_rgba(29,255,0,0.6)] transition-all duration-300 hover:scale-105 active:scale-95'
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
                        className='px-6 py-6 rounded-xl border border-foreground/10 text-foreground hover:bg-foreground/5 hover:border-brand/40 transition-all duration-300'
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
                          className='flex flex-col items-center gap-2 p-4 rounded-lg bg-foreground/5 border border-foreground/5 hover:border-brand/20 transition-colors'
                        >
                          <feature.icon className='w-5 h-5 text-brand' />
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
                    className={`relative overflow-hidden rounded-2xl border transition-all bg-background duration-100 p-5 sm:p-6 ${
                      selectedJob === job.id
                        ? "border-brand"
                        : "border-foreground/10"
                    }`}
                  >
                    {/* Selection Indicator Line */}
                    <div
                      className={`absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 ${
                        selectedJob === job.id
                          ? "bg-brand"
                          : "bg-transparent group-hover:bg-brand/50"
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
                          <div className='w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-brand to-background flex items-center justify-center text- font-bold text-xl shadow-[0_0_15px_rgba(29,255,0,0.2)]'>
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
                                  ? "text-brand"
                                  : "text-foreground group-hover:text-brand"
                              }`}
                              title={job.title}
                            >
                              {job.title}
                            </h3>
                            <div className='flex items-center gap-2 text-sm text-foreground font-medium'>
                              <span className='truncate max-w-[200px]'>
                                {job.company}
                              </span>
                              {job.posted_at && (
                                <>
                                  <span className='w-1 h-1 rounded-full' />
                                  <span className='text-muted-foreground text-xs'>
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
                                  <span className='inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-brand/10 text-brand border border-foreground/10 '>
                                    New
                                  </span>
                                );
                              }
                              return null;
                            })()}
                            {job.matchScore && job.matchScore >= 80 && (
                              <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-gradient-to-r from-brand/20 to-brand/5 text-brand border border-brand/20'>
                                <Sparkles className='w-3 h-3' />
                                {job.matchScore}% Match
                              </span>
                            )}
                            {hasJobQualityAccess &&
                              typeof job.lead_quality_score === "number" && (
                              <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-foreground/5 text-foreground/55 border border-foreground/10'>
                                <ShieldCheck className='w-3 h-3' />
                                {job.lead_quality_score}% Quality
                              </span>
                            )}
                            {job.status && (
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                                  job.status === "applied"
                                    ? "bg-brand/10 text-brand border-brand/20"
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
                            <div className='inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-foreground/10 text-xs text-muted-foreground'>
                              <MapPin className='w-3.5 h-3.5 text-muted-foreground' />
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
                                  <span className='inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md    border border-foreground/10 text-xs text-muted-foreground'>
                                    {salaryText}
                                  </span>
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
                                <div className='inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-foreground/5 border border-foreground/10 text-xs text-muted-foreground'>
                                  <span className='text-xs text-muted-foreground'>
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
                                <div className='inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-foreground/10 text-xs text-muted-foreground opacity-80 hover:opacity-100 transition-opacity'>
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
                              className={`h-8 min-w-8 px-2 rounded-md border text-[12px] ${p === clampedPage ? "border-brand/50 text-brand bg-brand/10" : "border-foreground/20 text-foreground/70 hover:text-foreground hover:border-foreground/40 hover:bg-foreground/10"}`}
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
                        const primaryHrefRaw =
                          job.apply_url ||
                          (job as any)?.raw_data?.sourceUrl ||
                          job.source_id;
                        const primaryHref = primaryHrefRaw
                          ? applyMicro1ReferralToUrl(String(primaryHrefRaw))
                          : "";
                        const siteHost = primaryHrefRaw
                          ? getHost(String(primaryHrefRaw))
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
                            className='relative overflow-hidden border border-brand/20 bg-gradient-to-br from-background via-background to-background p-0 flex flex-row items-stretch'
                          >
                            <span className='pointer-events-none absolute -top-24 -right-12 h-56 w-56 rounded-full bg-brand/20 blur-3xl opacity-60' />
                            
                            {/* Logo: full height on the left, width proportional */}
                            <div className='relative w-24 sm:w-auto sm:h-full sm:aspect-square flex-shrink-0 bg-foreground/5 flex items-center justify-center overflow-hidden border-r border-brand/10'>
                              {job.logoUrl && !logoError[job.id] ? (
                                <img
                                  src={job.logoUrl}
                                  alt={job.company}
                                  className='w-full h-full object-cover'
                                  onError={() =>
                                    setLogoError((e) => ({
                                      ...e,
                                      [job.id]: true,
                                    }))
                                  }
                                />
                              ) : (
                                <div className='w-full h-full bg-gradient-to-r from-brand to-background flex items-center justify-center font-bold text-xl sm:text-2xl md:text-3xl'>
                                  {job.logo}
                                </div>
                              )}
                            </div>

                            {/* Content & tiles */}
                            <div className='relative flex-1 min-w-0 p-5 sm:p-6 flex flex-col justify-between gap-5'>
                              {/* Header row: title & details */}
                              <div className='flex-1 min-w-0'>
                                <div className='flex flex-col gap-4'>
                                  {/* Title & meta */}
                                  <div className='flex-1 min-w-0 space-y-2'>
                                    <div className='inline-flex items-center gap-2 flex-wrap text-[11px] uppercase tracking-[0.3em] text-brand/80'>
                                      <Sparkles className='w-3 h-3' />
                                      Featured Job
                                    </div>
                                    <h1
                                      className='max-w-3xl text-lg sm:text-xl md:text-2xl font-semibold text-foreground leading-tight line-clamp-3'
                                      title={job.title}
                                    >
                                      {job.title}
                                    </h1>
                                    <div className='flex flex-wrap items-center gap-2 text-sm text-foreground/70'>
                                      <span className='font-medium text-foreground/90'>
                                        {job.company}
                                      </span>
                                      {siteHost && (
                                        <span
                                          className='inline-flex max-w-full items-center gap-1 text-[11px] px-2 py-1 rounded-full border border-foreground/10 bg-foreground/5 text-foreground/60'
                                          title={primaryHref || undefined}
                                        >
                                          {ico && (
                                            <img
                                              src={ico}
                                              alt=''
                                              className='w-3 h-3 rounded flex-shrink-0'
                                              onError={(e) =>
                                                ((
                                                  e.target as HTMLImageElement
                                                ).style.display = "none")
                                              }
                                            />
                                          )}
                                          <span className='truncate'>
                                            {siteHost}
                                          </span>
                                        </span>
                                      )}
                                      {job.posted_at && (
                                        <span className='text-[11px] px-2 py-1 rounded-full border border-foreground/10 text-foreground/50 bg-foreground/5 whitespace-nowrap flex-shrink-0'>
                                          Posted{" "}
                                          {formatRelative(job.posted_at)}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Action buttons stay below the title until the card has enough width. */}
                                  <div className='flex w-full flex-col sm:flex-row items-stretch sm:items-center gap-2'>
                                    {primaryHref && (
                                      <a
                                        href={primaryHref}
                                        target='_blank'
                                        rel='noopener noreferrer'
                                        className='inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-foreground/10  px-4 py-2 text-sm font-medium text-foreground transition '
                                      >
                                        View Posting
                                      </a>
                                    )}
                                    <Button
                                      onClick={() => openAutoApplyFlow(job)}
                                      className='inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-brand/40 bg-brand/5 px-4 py-2 text-sm font-medium text-brand '
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

                              {metaTiles.length > 0 && (
                                <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3'>
                                  {metaTiles.map((tile) => (
                                    <div
                                      key={`${tile.label}-${tile.value}`}
                                      className='rounded-xl border border-foreground/10 bg-foreground/5 px-3 py-2.5 min-w-0'
                                    >
                                      <div className='text-[11px] uppercase tracking-wide text-foreground/40'>
                                        {tile.label}
                                      </div>
                                      <div
                                        className={`truncate text-sm font-medium ${tile.tone === "urgent" ? "text-brand" : tile.tone === "soon" ? "text-brand" : tile.tone === "future" ? "text-[#8bffb1]" : "text-foreground/85"}`}
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
                            <FileText className='w-4 h-4 text-brand' />
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

                      <OpportunityScoreSummary
                        opportunity={job.explainableOpportunity}
                        fullAccess={hasOpportunityBreakdownAccess}
                        requiredTier='Pro'
                      />

                      <JobQualityAndFeedback
                        job={job}
                        onFeedback={handleJobFeedback}
                        fullAccess={hasJobQualityAccess}
                      />

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
                          icon={<Sparkles className='h-12 w-12 text-brand' />}
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
                          requiredTier='Pro'
                          jobTitle={job.title || "Role"}
                          company={job.company}
                          descriptionPreview={job.description || undefined}
                          title='Evaluation report'
                          ctaLabel='Upgrade for full evaluation report'
                        />
                      )}

                      {(() => {
                        const screenshot = (job as any)?.raw_data?.screenshot;
                        if (!screenshot) return null;
                        return (
                          <Card className='relative overflow-hidden border border-foreground/12 bg-background p-0'>
                            <div className='flex items-center justify-between px-4 py-3 border-b border-foreground/10 bg-foreground/5'>
                              <div className='inline-flex items-center gap-2 text-sm font-medium text-foreground/75'>
                                <Sparkles className='w-4 h-4 text-brand' />
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
                                <ShieldCheck className='w-4 h-4 text-brand' />
                                Source Intelligence
                              </div>
                              <span className='text-[11px] uppercase tracking-wide text-foreground/35'>
                                Captured links
                              </span>
                            </div>
                            <ul className='space-y-2'>
                              {items.map((s, i) => {
                                const hrefRaw =
                                  typeof s === "string"
                                    ? s
                                    : s?.url || s?.source || "";
                                if (!hrefRaw) return null;
                                const href = applyMicro1ReferralToUrl(hrefRaw);
                                const host = getHost(hrefRaw);
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
                                        className='text-sm text-brand hover:underline'
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
          <div className='relative overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-br from-background via-background to-background text-foreground'>
            <div className='pointer-events-none absolute -top-32 right-0 h-72 w-72 rounded-full bg-brand/20 blur-3xl opacity-40' />
            <div className='relative p-6 sm:p-8 space-y-6'>
              <div className='flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6'>
                <div className='space-y-3 max-w-xl'>
                  <div className='inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.35em] text-brand/80'>
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
                        <span className='text-brand font-medium'>
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
                  <div className='text-2xl font-semibold text-brand'>
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
                  <div className='mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-brand' />
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
                          ? "border-brand/60 bg-brand/10 shadow-[0_0_18px_rgba(29,255,0,0.25)]"
                          : status === "done"
                            ? "border-brand/30 bg-brand/12 text-foreground/80"
                            : "border-foreground/12 bg-foreground/[0.02] text-foreground/60"
                      }`}
                    >
                      <div className='flex items-center gap-2 text-sm font-medium'>
                        {status === "done" ? (
                          <span className='inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand text-'>
                            <Check className='w-3.5 h-3.5' />
                          </span>
                        ) : (
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] ${
                              status === "active"
                                ? "border-brand/70 text-brand"
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
                      className='text-xs inline-flex items-center gap-1 text-brand hover:text-[#a3ffb5]'
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
                                  ? "border-brand/60 bg-brand/12 shadow-[0_0_16px_rgba(29,255,0,0.25)]"
                                  : "border-foreground/12 bg-foreground/[0.02] hover:border-brand/45 hover:bg-brand/8"
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
                                    <span className='text-[10px] px-1.5 py-0.5 rounded-full border border-brand/40 text-brand bg-brand/10'>
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
                                    ? "border-brand/70 bg-brand text-"
                                    : "border-foreground/20 text-foreground/40 group-hover:border-brand/50 group-hover:text-brand"
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
                          className='inline-flex items-center gap-2 text-[13px] px-4 py-2 rounded-lg border border-brand/40 text-brand bg-brand/10 hover:bg-brand/20 transition'
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
                        className='text-xs inline-flex items-center gap-1 text-brand hover:text-[#a3ffb5]'
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
                                ? "border-brand/60 bg-brand/12 shadow-[0_0_16px_rgba(29,255,0,0.25)]"
                                : "border-foreground/12 bg-foreground/[0.02] hover:border-brand/45 hover:bg-brand/8"
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
                                  ? "border-brand/70 bg-brand text-"
                                  : "border-foreground/20 text-foreground/40 group-hover:border-brand/50 group-hover:text-brand"
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
                                    ? "border-brand/60 bg-brand/12 shadow-[0_0_16px_rgba(29,255,0,0.25)]"
                                    : "border-foreground/12 bg-foreground/[0.02] hover:border-brand/45 hover:bg-brand/8"
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
                                      ? "border-brand/70 bg-brand text-"
                                      : "border-foreground/20 text-foreground/40 group-hover:border-brand/50 group-hover:text-brand"
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
                            className='inline-flex items-center gap-2 text-[13px] px-4 py-2 rounded-lg border border-brand/40 text-brand bg-brand/10 hover:bg-brand/20 transition'
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
                    <div className='rounded-xl border border-brand/35 bg-brand/12 p-4 sm:p-5'>
                      <div className='flex items-center gap-2 text-sm font-medium text-brand'>
                        <ShieldCheck className='w-4 h-4' />
                        Execution summary
                      </div>
                      <div className='mt-4 flex items-baseline gap-2'>
                        <span className='text-3xl font-semibold text-brand'>
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
                        <FileText className='w-4 h-4 text-brand' />
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
                          <FileText className='w-4 h-4 text-brand' />
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
                      <Clock3 className='w-4 h-4 text-brand' />
                      Runbook
                    </div>
                    <ul className='mt-3 space-y-2 text-sm text-foreground/70'>
                      <li className='flex items-start gap-2'>
                        <span className='mt-1 inline-flex h-1.5 w-1.5 rounded-full bg-brand' />
                        <span>
                          Sequential automation with intelligent retries; cancel
                          anytime from Diagnostics.
                        </span>
                      </li>
                      <li className='flex items-start gap-2'>
                        <span className='mt-1 inline-flex h-1.5 w-1.5 rounded-full bg-brand' />
                        <span>
                          Each job updates status to{" "}
                          <span className='text-brand'>applied</span> and emits
                          success or failure analytics.
                        </span>
                      </li>
                      <li className='flex items-start gap-2'>
                        <span className='mt-1 inline-flex h-1.5 w-1.5 rounded-full bg-brand' />
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
                      <div className='flex items-center gap-2 text-sm font-medium text-brand'>
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
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${trueAutonomyEnabled ? "bg-brand" : "bg-foreground/20"}`}
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
                    className={`rounded-xl border p-5 ${aiEvaluation.missing_requirements.length > 0 ? "border-brand/35 bg-brand/10" : "border-brand/35 bg-brand/10"}`}
                  >
                    <div
                      className={`flex items-center gap-2 text-sm font-medium ${aiEvaluation.missing_requirements.length > 0 ? "text-brand" : "text-brand"}`}
                    >
                      <AlertTriangle className='w-5 h-5' />
                      AI Decision Boundary Alert
                    </div>

                    <div className='mt-4 flex flex-col sm:flex-row items-baseline gap-4'>
                      <div className='flex items-baseline gap-2'>
                        <span
                          className={`text-3xl font-semibold ${aiEvaluation.confidence_score >= 70 ? "text-brand" : "text-brand"}`}
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
                        <h4 className='text-sm font-medium text-brand mb-2'>
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
                        <h4 className='text-sm font-medium text-brand mb-2'>
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
                              ? String(
                                  (selectedResume as any).file_ext,
                                ).toUpperCase()
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
                            <User className='w-3.5 h-3.5 text-brand' />
                            Detected candidate: {selectedResumeCandidateName}
                          </p>
                        )}
                        {profileFullName && (
                          <p className='text-xs text-foreground/55'>
                            Profile name: {profileFullName}
                          </p>
                        )}
                        {resumeIdentityMismatch && (
                          <p className='text-xs text-brand'>
                            This resume appears to belong to a different person
                            than the current profile. Review the selection
                            before generating a new cover letter.
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
                  <div className='rounded-xl border border-brand/30 bg-brand/5 p-5'>
                    <div className='flex items-center gap-2 text-sm font-medium text-brand'>
                      <Sparkles className='w-5 h-5' />
                      Draft Mode Review
                    </div>
                    <p className='mt-2 text-sm text-foreground/70'>
                      AI has tailored your materials for this specific job.
                      Review and edit the drafts below before launching the
                      automation, or save them for later.
                    </p>
                    <div className='mt-4 rounded-lg border border-brand/20 bg-black/20 p-3 space-y-1'>
                      <p className='text-xs uppercase tracking-wider text-brand/75'>
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
                          className='w-full mt-1 h-32 p-3 text-sm bg-background border border-foreground/10 rounded-lg focus:outline-none focus:border-brand/50 resize-y'
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
                          className='w-full mt-1 h-48 p-3 text-sm bg-background border border-foreground/10 rounded-lg focus:outline-none focus:border-brand/50 resize-y'
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
                  <div className='rounded-xl border border-brand/30 bg-brand/5 p-5'>
                    <div className='flex items-center justify-between mb-3'>
                      <div className='flex items-center gap-2 text-sm font-medium text-brand'>
                        {!automationFinished ? (
                          <Loader2 className='w-4 h-4 animate-spin' />
                        ) : applyProgress.fail === 0 ? (
                          <Check className='w-4 h-4' />
                        ) : (
                          <AlertTriangle className='w-4 h-4 text-brand' />
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
                        className='h-full rounded-full bg-gradient-to-r from-brand to-[#00ff88]'
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
                    <div className='rounded-xl border border-brand/25 bg-brand/5 p-3 text-center'>
                      <div className='text-2xl font-semibold text-brand'>
                        {applyProgress.success}
                      </div>
                      <div className='text-[10px] uppercase tracking-wider text-brand/70 mt-1'>
                        Success
                      </div>
                    </div>
                    <div
                      className={`rounded-xl border p-3 text-center ${applyProgress.fail > 0 ? "border-brand/25 bg-brand/5" : "border-foreground/12 bg-foreground/[0.02]"}`}
                    >
                      <div
                        className={`text-2xl font-semibold ${applyProgress.fail > 0 ? "text-brand" : "text-foreground/30"}`}
                      >
                        {applyProgress.fail}
                      </div>
                      <div
                        className={`text-[10px] uppercase tracking-wider mt-1 ${applyProgress.fail > 0 ? "text-brand/70" : "text-foreground/30"}`}
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
                          className={`inline-block h-1.5 w-1.5 rounded-full ${!automationFinished ? "bg-brand animate-pulse" : "bg-foreground/30"}`}
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
                            className={`${log.status === "success" ? "text-brand" : log.status === "error" ? "text-brand" : "text-foreground/60"}`}
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
                            <span className='inline-block h-1 w-1 rounded-full bg-brand animate-pulse' />
                            <span className='inline-block h-1 w-1 rounded-full bg-brand animate-pulse [animation-delay:150ms]' />
                            <span className='inline-block h-1 w-1 rounded-full bg-brand animate-pulse [animation-delay:300ms]' />
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
                    <ShieldCheck className='w-3.5 h-3.5 text-brand shrink-0' />
                    <span>
                      Automation respects existing filters and logs telemetry
                      for audit trails.
                    </span>
                  </p>
                </div>
                <div className='flex flex-wrap items-center justify-end gap-4'>
                  {autoApplyStep === 3 ? (
                    <Button
                      className={cn(
                        "whitespace-nowrap shrink-0",
                        automationFinished
                          ? "border border-brand/50 text-brand bg-brand/15 hover:bg-brand/25"
                          : "border border-foreground/20 text-foreground/40 cursor-not-allowed opacity-50",
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
                      {(autoApplyStep === 2 || autoApplyStep === 4) && (
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
                            className='border border-brand/50 text-brand bg-brand/15 hover:bg-brand/25 whitespace-nowrap shrink-0'
                            onClick={handleDecisionBoundaryAutoFix}
                            disabled={
                              generatingDraft ||
                              evaluatingJob ||
                              !canAutoFixDecisionBoundary
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
                            className='border border-brand/50 text-brand bg-brand/15 hover:bg-brand/25 whitespace-nowrap shrink-0'
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
                            className='border-brand/50 text-brand bg-brand/15 hover:bg-brand/25 whitespace-nowrap shrink-0'
                            onClick={() => applyAllJobs(false)}
                            disabled={applyingAll}
                          >
                            {applyingAll ? (
                              <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                            ) : jobToAutoApply ? (
                              "Launch suite"
                            ) : (
                              "Launch automation"
                            )}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          className={cn(
                            "border whitespace-nowrap shrink-0",
                            evaluatingJob || generatingDraft || applyingAll
                              ? "border-brand/50"
                              : aiEvaluation
                                ? "border-brand/50 text-brand bg-brand/15 hover:bg-brand/25"
                                : "border-brand/50 text-brand bg-brand/15 hover:bg-brand/25",
                            (autoApplyPrimaryDisabled ||
                              evaluatingJob ||
                              generatingDraft ||
                              applyingAll) &&
                              "opacity-50 cursor-not-allowed",
                          )}
                          disabled={
                            autoApplyPrimaryDisabled ||
                            evaluatingJob ||
                            generatingDraft ||
                            applyingAll
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
                          {evaluatingJob || generatingDraft || applyingAll ? (
                            <>
                              <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                              {evaluatingJob
                                ? "Evaluating job fit..."
                                : generatingDraft
                                  ? "Drafting materials..."
                                  : "Preparing automation..."}
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
                  const primaryHrefRaw =
                    j.apply_url ||
                    (j as any)?.raw_data?.sourceUrl ||
                    j.source_id;
                  const primaryHref = primaryHrefRaw
                    ? applyMicro1ReferralToUrl(String(primaryHrefRaw))
                    : "";
                  const siteHost = primaryHrefRaw
                    ? getHost(String(primaryHrefRaw))
                    : "";
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
                    <Card className='relative overflow-hidden border border-brand/25 bg-gradient-to-br from-background via-background to-background p-0 flex flex-row items-stretch'>
                      <span className='pointer-events-none absolute -top-20 -right-10 h-40 w-40 rounded-full bg-brand/20 blur-3xl opacity-50' />
                      
                      {/* Logo Column */}
                      <div className='relative self-stretch w-24 sm:w-32 md:w-36 flex-shrink-0 bg-foreground/5 flex items-stretch justify-center overflow-hidden border-r border-brand/10'>
                        {j.logoUrl && !logoError[j.id] ? (
                          <img
                            src={j.logoUrl}
                            alt={j.company}
                            className='w-full h-full object-cover'
                            onError={() =>
                              setLogoError((e) => ({ ...e, [j.id]: true }))
                            }
                          />
                        ) : (
                          <div className='w-full h-full bg-gradient-to-r from-brand to-background flex items-center justify-center font-bold text-lg sm:text-xl md:text-2xl'>
                            {j.logo}
                          </div>
                        )}
                      </div>

                      {/* Content Column */}
                      <div className='relative flex-1 min-w-0 p-4 sm:p-5 flex flex-col justify-between gap-4'>
                        <div className='space-y-3'>
                          <div className='flex-1 min-w-0 space-y-1'>
                            <div className='inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-brand/70'>
                              <Sparkles className='w-3 h-3' />
                              Featured Job
                            </div>
                            <div className='text-lg font-semibold text-foreground leading-tight line-clamp-3'>
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
                                  className={`text-xs font-medium ${tile.tone === "urgent" ? "text-brand" : tile.tone === "soon" ? "text-brand" : tile.tone === "future" ? "text-[#8bffb1]" : "text-foreground/85"}`}
                                >
                                  {tile.value}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className='flex flex-col sm:flex-row items-stretch sm:items-center gap-2'>
                          {primaryHref && (
                            <a
                              href={primaryHref}
                              target='_blank'
                              rel='noopener noreferrer'
                              className='inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-brand/50 bg-brand/15 px-3 py-2 text-[13px] font-medium text-brand transition hover:bg-brand/25'
                            >
                              View Posting
                            </a>
                          )}
                          <Button
                            variant='ghost'
                            onClick={() => openAutoApplyFlow(j)}
                            className='inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-brand/40 bg-gradient-to-r from-brand/10 via-transparent to-brand/10 px-3 py-2 text-[13px] font-medium text-foreground transition hover:from-brand/20 hover:to-brand/5'
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
                      <FileText className='w-4 h-4 text-brand' />
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

                <OpportunityScoreSummary
                  opportunity={j.explainableOpportunity}
                  compact
                  fullAccess={hasOpportunityBreakdownAccess}
                  requiredTier='Pro'
                />

                <JobQualityAndFeedback
                  job={j}
                  compact
                  onFeedback={handleJobFeedback}
                  fullAccess={hasJobQualityAccess}
                />

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
                    icon={<Sparkles className='h-12 w-12 text-brand' />}
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
                    requiredTier='Pro'
                    jobTitle={j.title || "Role"}
                    company={j.company}
                    descriptionPreview={j.description || undefined}
                    title='Evaluation report'
                    ctaLabel='Upgrade for full evaluation report'
                  />
                )}

                {(() => {
                  const screenshot = (j as any)?.raw_data?.screenshot;
                  if (!screenshot) return null;
                  return (
                    <Card className='border border-foreground/12 bg-background p-0 overflow-hidden'>
                      <div className='flex items-center justify-between px-3 py-2 border-b border-foreground/10 bg-foreground/5'>
                        <div className='inline-flex items-center gap-2 text-xs font-medium text-foreground/70'>
                          <Sparkles className='w-3 h-3 text-brand' />
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
                          <ShieldCheck className='w-3 h-3 text-brand' />
                          Source Intelligence
                        </div>
                        <span className='text-[10px] uppercase tracking-wide text-foreground/30'>
                          Captured links
                        </span>
                      </div>
                      <ul className='space-y-2'>
                        {items.map((s, i) => {
                          const hrefRaw =
                            typeof s === "string"
                              ? s
                              : s?.url || s?.source || "";
                          if (!hrefRaw) return null;
                          const href = applyMicro1ReferralToUrl(hrefRaw);
                          const host = getHost(hrefRaw);
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
                                  className='text-sm text-brand hover:underline'
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
      <ConcurrencyLimitModal
        open={concurrencyModalOpen}
        onOpenChange={setConcurrencyModalOpen}
        activeRuns={concurrencyInfo.activeRuns}
        totalLimit={concurrencyInfo.totalLimit}
        currentTier={subscriptionTier}
        onUpgrade={(tab) => {
          navigate(`/dashboard/billing${tab ? `?tab=${tab}` : ""}`);
        }}
      />
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
