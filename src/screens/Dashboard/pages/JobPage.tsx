import { Briefcase, Search, MapPin, Loader2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Sparkles, Check, ShieldCheck, Clock3, FileText, AlertTriangle, UserCheck, UserX, FileCheck2, FileWarning } from "lucide-react";
import { Link } from "react-router-dom";
import { Switch } from "../../../components/ui/switch";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "../../../components/ui/button";
import Modal from "../../../components/ui/modal";
import { useResumes } from "../../../hooks/useResumes";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { motion } from "framer-motion";
import useMediaQuery from "../../../hooks/use-media-query";
import { createClient } from "../../../lib/supabaseClient";
import { useProfileSettings, type Profile } from "../../../hooks/useProfileSettings";
import { events } from "../../../lib/analytics";
import { useToast } from "../../../components/ui/toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { applyToJobs } from "../../../services/applications/applyToJobs";
import { cn } from "../../../lib/utils";
import { useRegisterCoachMarks } from "../../../providers/TourProvider";
import { MatchScorePieChart } from "../../../components/MatchScorePieChart";

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
  source_type?: string | null;
  source_id?: string | null;
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

const tokenize = (input?: string | null): string[] => {
  if (!input) return [];
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
};

const uniqueTokens = (tokens: string[]): string[] => Array.from(new Set(tokens));

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

const toPlainText = (value?: string | null): string => {
  if (!value) return "";
  return value.replace(/<[^>]+>/g, " ");
};

const buildTokenSet = (...segments: Array<string | undefined | null>): Set<string> => {
  const tokens = segments.flatMap((segment) => uniqueTokens(tokenize(segment)));
  return new Set(tokens);
};

const measureOverlap = (needles: Set<string>, haystack: Set<string>) => {
  if (!needles.size) return { score: 0, matches: [] as string[] };
  const matches: string[] = [];
  needles.forEach((token) => {
    if (haystack.has(token)) matches.push(token);
  });
  const score = clamp((matches.length / needles.size) * 100);
  return { score, matches };
};

const evaluateLocationFit = (job: Job, context: MatchContext): { score: number; detail: string } => {
  const preferredLocationRaw = context.selectedLocation?.trim();
  const profileLocationRaw = context.profile?.location?.trim();
  const preference = preferredLocationRaw || profileLocationRaw || "";
  const preferenceTokens = buildTokenSet(preference);
  const jobLocationPieces: string[] = [];
  if (job.location) jobLocationPieces.push(job.location);
  if (job.remote_type) jobLocationPieces.push(job.remote_type);
  const rawData = job.raw_data as Record<string, any> | undefined;
  if (rawData?.location) jobLocationPieces.push(String(rawData.location));
  if (rawData?.scraped_data?.location) jobLocationPieces.push(String(rawData.scraped_data.location));
  const jobLocationString = jobLocationPieces.join(" ").toLowerCase();
  const wantsRemote = preference.toLowerCase().includes("remote");
  const jobIsRemote = /remote|anywhere/i.test(jobLocationString) || /remote/i.test(job.remote_type || "");

  if (!preferenceTokens.size) {
    if (jobIsRemote) {
      return { score: 85, detail: "Remote-friendly role suits broad location preferences." };
    }
    if (!jobLocationString) {
      return { score: 60, detail: "Location unspecified; monitor posting for details." };
    }
    return { score: 65, detail: "No location preference set; defaulting to neutral fit." };
  }

  if (jobIsRemote && wantsRemote) {
    return { score: 95, detail: "Remote flexibility aligns with your preference." };
  }

  const matchedTokens: string[] = [];
  preferenceTokens.forEach((token) => {
    if (token && jobLocationString.includes(token)) matchedTokens.push(token);
  });

  if (matchedTokens.length) {
    return {
      score: 100,
      detail: `Job location highlights ${matchedTokens.join(", ")}, matching your preference.`,
    };
  }

  if (jobIsRemote) {
    return {
      score: 80,
      detail: "Role is remote-friendly, partially offsetting location mismatch.",
    };
  }

  if (!jobLocationString) {
    return {
      score: 45,
      detail: "Job location not specified; unable to confirm alignment.",
    };
  }

  return {
    score: 30,
    detail: "Location does not mention your preferred region.",
  };
};

const computeJobMatchInsights = (job: Job, context: MatchContext) => {
  const breakdown: MatchScoreBreakdown[] = [];
  const totalWeights = {
    role: 0.35,
    keywords: 0.3,
    goals: 0.2,
    location: 0.15,
  } as const;

  const profileTitleTokens = buildTokenSet(context.profile?.job_title, context.profile?.goals?.join(" ") || "");
  const searchTokens = buildTokenSet(context.searchQuery);
  const roleTargetTokens = new Set<string>([...profileTitleTokens, ...searchTokens]);
  const jobTitleTokens = buildTokenSet(job.title);
  const roleOverlap = measureOverlap(roleTargetTokens, jobTitleTokens);
  const roleScore = roleTargetTokens.size ? roleOverlap.score : clamp(jobTitleTokens.size ? 55 : 40);
  breakdown.push({
    label: "Role focus",
    componentScore: roleScore,
    contribution: roleScore * totalWeights.role,
    weight: totalWeights.role,
    detail: roleTargetTokens.size
      ? roleOverlap.matches.length
        ? `Matches ${roleOverlap.matches.length}/${roleTargetTokens.size} target role keywords.`
        : "Job title only loosely overlaps with your role focus."
      : "No role keywords provided; using neutral baseline.",
    matches: roleOverlap.matches,
  });

  const jobDescriptionText = [job.description, (job.raw_data as any)?.scraped_data?.description, toPlainText(job.description || "")]
    .filter(Boolean)
    .join(" ");
  const jobTagTokens = buildTokenSet(
    Array.isArray((job.raw_data as any)?.scraped_data?.tags)
      ? ((job.raw_data as any)?.scraped_data?.tags as string[]).join(" ")
      : undefined,
    Array.isArray((job.raw_data as any)?.scraped_data?.skills)
      ? ((job.raw_data as any)?.scraped_data?.skills as string[]).join(" ")
      : undefined,
  );
  const jobTextTokens = new Set<string>([...buildTokenSet(jobDescriptionText), ...jobTagTokens, ...jobTitleTokens]);
  const keywordOverlap = measureOverlap(searchTokens, jobTextTokens);
  const keywordScore = searchTokens.size ? keywordOverlap.score : clamp(jobTextTokens.size ? 60 : 40);
  breakdown.push({
    label: "Keyword match",
    componentScore: keywordScore,
    contribution: keywordScore * totalWeights.keywords,
    weight: totalWeights.keywords,
    detail: searchTokens.size
      ? (keywordOverlap.matches.length
          ? `Job content covers ${keywordOverlap.matches.join(", ")}.`
          : "Posting lacks your search keywords.")
      : "No search keywords supplied; treated as neutral.",
    matches: keywordOverlap.matches,
  });

  const goalTokens = buildTokenSet(context.profile?.goals?.join(" ") || "");
  const goalOverlap = measureOverlap(goalTokens, jobTextTokens);
  const goalScore = goalTokens.size ? goalOverlap.score : clamp(jobTextTokens.size ? 55 : 40);
  breakdown.push({
    label: "Profile goals",
    componentScore: goalScore,
    contribution: goalScore * totalWeights.goals,
    weight: totalWeights.goals,
    detail: goalTokens.size
      ? (goalOverlap.matches.length
          ? `Mentions your goals: ${goalOverlap.matches.join(", ")}.`
          : "Job description does not reference your stated goals.")
      : "Add goals to your profile for deeper matching.",
    matches: goalOverlap.matches,
  });

  const locationFit = evaluateLocationFit(job, context);
  breakdown.push({
    label: "Location alignment",
    componentScore: locationFit.score,
    contribution: locationFit.score * totalWeights.location,
    weight: totalWeights.location,
    detail: locationFit.detail,
  });

  const totalScore = clamp(
    Math.round(breakdown.reduce((acc, item) => acc + item.contribution, 0)),
  );

  const positiveHighlights = breakdown
    .filter((item) => item.componentScore >= 70)
    .map((item) => item.label.toLowerCase());
  const opportunityAreas = breakdown
    .filter((item) => item.componentScore < 50)
    .map((item) => item.label.toLowerCase());

  let summary = "";
  if (positiveHighlights.length) {
    summary = `Strong alignment on ${positiveHighlights.join(", ")}.`;
  }
  if (opportunityAreas.length) {
    summary = summary
      ? `${summary} Needs attention on ${opportunityAreas.join(", ")}.`
      : `Needs attention on ${opportunityAreas.join(", ")}.`;
  }
  if (!summary) {
    summary = "Limited signals detected — consider refining your search or profile.";
  }

  return {
    score: totalScore,
    breakdown,
    summary,
  };
};

const decorateJobWithMatchInsights = (job: Job, context: MatchContext): Job => {
  try {
    const insights = computeJobMatchInsights(job, context);
    return {
      ...job,
      matchScore: insights.score,
      matchBreakdown: insights.breakdown,
      matchSummary: insights.summary,
    };
  } catch (err) {
    console.error('match insight computation failed', err);
    return job;
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
  data?: (CoverLetterDraftData & Record<string, unknown>);
  draft?: boolean;
};

const COVER_LETTER_LIBRARY_KEY = "jr.coverLetters.library.v1";
const COVER_LETTER_DEFAULT_KEY = "jr.coverLetters.defaultId";
const COVER_LETTER_DRAFT_KEY = "jr.coverLetter.draft.v2";

const supabase = createClient();

const pickString = (source: Record<string, unknown> | undefined, key: string): string | undefined => {
  if (!source) return undefined;
  const value = source[key];
  return typeof value === "string" ? value : undefined;
};

const getJobApplyTarget = (job: Job): string | null => {
  const raw = (job.raw_data && typeof job.raw_data === "object") ? (job.raw_data as Record<string, unknown>) : undefined;
  const scraped = (raw && typeof raw.scraped_data === "object") ? (raw.scraped_data as Record<string, unknown>) : undefined;
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

const composeCoverLetterPayload = (entry?: CoverLetterLibraryEntry | null): string | undefined => {
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

  const senderKeys = ["senderName", "senderPhone", "senderEmail", "senderAddress"];
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
    const formatted = Number.isNaN(parsed.valueOf()) ? dateValue : parsed.toLocaleDateString();
    pushLine(formatted);
    pushSeparator();
  }

  const recipientLines: string[] = [];
  [read("recipient"), read("recipientTitle"), read("company") ?? entry.data?.company, read("recipientAddress")]
    .forEach((val) => {
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

  const finalText = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return finalText || undefined;
};

const composeProfileSnapshot = (profile?: Profile | null): string | undefined => {
  if (!profile) return undefined;
  const lines: string[] = [];
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  if (fullName) lines.push(`Name: ${fullName}`);
  if (profile.job_title) lines.push(`Current Title: ${profile.job_title}`);
  if (profile.experience_years != null) lines.push(`Experience: ${profile.experience_years} years`);
  if (profile.location) lines.push(`Location: ${profile.location}`);
  if (Array.isArray(profile.goals) && profile.goals.length) lines.push(`Goals: ${profile.goals.join(", ")}`);
  return lines.length ? lines.join("\n") : undefined;
};

const formatSalaryRange = (job: Job): string | null => {
  const { salary_min: min, salary_max: max, salary_currency: currency } = job;
  if (!min && !max && !currency) return null;

  const symbol = (() => {
    if (!currency) return '$';
    switch (currency.toUpperCase()) {
      case 'USD':
        return '$';
      case 'GBP':
        return '£';
      case 'EUR':
        return '€';
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

const extractAutomationMetadata = (result: Awaited<ReturnType<typeof applyToJobs>> | null) => {
  if (!result) {
    return {
      runId: null,
      workflowId: null,
      providerStatus: null,
      recordingUrl: null,
    } as const;
  }
  const skyvern = result.skyvern ?? null;
  const runId = skyvern?.run?.id
    ?? skyvern?.id
    ?? skyvern?.run_id
    ?? skyvern?.data?.id
    ?? skyvern?.runId
    ?? null;
  const workflowId = result.submitted?.workflow_id
    ?? skyvern?.run?.workflow_id
    ?? skyvern?.workflow_id
    ?? null;
  const providerStatus = skyvern?.run?.status
    ?? skyvern?.status
    ?? skyvern?.state
    ?? null;
  const recordingUrl = skyvern?.run?.recording_url
    ?? skyvern?.recording_url
    ?? skyvern?.artifacts?.recording
    ?? null;
  return {
    runId: runId ?? null,
    workflowId: workflowId ?? null,
    providerStatus: providerStatus ?? null,
    recordingUrl: recordingUrl ?? null,
  } as const;
};

const getCompanyLogoUrl = (companyName?: string, sourceUrl?: string): string | undefined => {
    if (!companyName) return undefined;
    try {
        const domain = new URL(sourceUrl || `https://www.${companyName.toLowerCase().replace(/\s/g, '')}.com`).hostname;
        return `https://logo.clearbit.com/${domain}`;
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
      description: dbJob.description || raw?.fullJobDescription || '',
      // Prioritize: 1) company_logo from DB, 2) raw data logo, 3) generate from Clearbit
      logoUrl: dbJob.company_logo || raw?.companyLogoUrl || getCompanyLogoUrl(dbJob.company, dbJob.apply_url),
      logo: dbJob.company?.[0]?.toUpperCase() || '?',
      status: dbJob.status,
      source_type: dbJob.source_type ?? null,
      source_id: dbJob.source_id ?? null,
      matchScore: typeof insights?.score === 'number' ? insights.score : undefined,
      matchBreakdown: Array.isArray(insights?.breakdown) ? insights.breakdown : undefined,
      matchSummary: typeof insights?.summary === 'string' ? insights.summary : undefined,
    };
  };

const sanitizeHtml = (html: string) => {
    if (!html) return "";
    let out = String(html);
    out = out.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
    out = out.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");
    out = out.replace(/href\s*=\s*(["'])javascript:[^"']*\1/gi, 'href="#"');
    out = out.replace(/ on[a-z]+\s*=\s*(["']).*?\1/gi, "");
    return out;
};

export const JobPage = (): JSX.Element => {
  const isMobile = useMediaQuery("(max-width: 1023px)");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedLocation, setSelectedLocation] = useState("Remote");
    const [selectedJob, setSelectedJob] = useState<string | null>(null);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [queueStatus, setQueueStatus] = useState<'idle' | 'loading' | 'populating' | 'ready' | 'empty'>('loading');
    const [error, setError] = useState<{ message: string, link?: string } | null>(null);
  // Incremental run state
  const [incrementalMode, setIncrementalMode] = useState(false);
  const [insertedThisRun, setInsertedThisRun] = useState(0);
  const [currentSource, setCurrentSource] = useState<string | null>(null);
  const [lastReason, setLastReason] = useState<string | null>(null);
    const [debugMode, setDebugMode] = useState(false);
  const [logoError, setLogoError] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [applyingAll, setApplyingAll] = useState(false);
    const [applyProgress, setApplyProgress] = useState({ done: 0, total: 0, success: 0, fail: 0 });
    const [sortBy, setSortBy] = useState<"recent" | "company" | "deadline">("recent");
  // Resume attach dialog state
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [autoApplyStep, setAutoApplyStep] = useState<1 | 2>(1);
  const [coverLetterLibrary, setCoverLetterLibrary] = useState<CoverLetterLibraryEntry[]>([]);
  const [selectedCoverLetterId, setSelectedCoverLetterId] = useState<string | null>(null);

  // Debug payload capture for in-app panel
  const [dbgSearchReq, setDbgSearchReq] = useState<any>(null);
  const [dbgSearchRes, setDbgSearchRes] = useState<any>(null);
  

  const { profile, loading: profileLoading } = useProfileSettings();
  // Load user resumes for selection (used by the Auto Apply -> "Choose a resume" dialog)
  const { resumes, loading: resumesLoading } = useResumes();
  const { info } = useToast();

  // Register walkthrough for Jobs page
  useRegisterCoachMarks({
    page: 'jobs',
    marks: [
      {
        id: 'jobs-search',
        selector: '#jobs-search',
        title: 'Search Jobs',
        body: 'Search across thousands of job postings by title, company, keywords, or skills.'
      },
      {
        id: 'jobs-location',
        selector: '#jobs-location',
        title: 'Filter by Location',
        body: 'Specify your preferred location or use "Remote" to find remote opportunities.'
      },
      {
        id: 'jobs-card',
        selector: '[data-tour="jobs-card"]',
        title: 'Job Listings',
        body: 'Browse AI-matched jobs. Click any card to see full details, company info, and apply directly.'
      },
      {
        id: 'jobs-ai-match',
        selector: '#jobs-ai-match',
        title: 'AI Match Score',
        body: 'Our AI analyzes each job against your profile and resume to show compatibility and fit.'
      }
    ]
  });

  // Toast dedupe/throttle: avoid spamming repeated toasts
  const lastToastRef = useRef<{ msg: string; ts: number } | null>(null);
  const safeInfo = useCallback((msg: string, desc?: string, cooldownMs: number = 20000) => {
    const now = Date.now();
    const last = lastToastRef.current;
    if (last && last.msg === (desc ? `${msg}::${desc}` : msg) && now - last.ts < cooldownMs) {
      return; // suppress duplicate within cooldown window
    }
    info(msg, desc);
    lastToastRef.current = { msg: desc ? `${msg}::${desc}` : msg, ts: now };
  }, [info]);
  // Error dedupe to avoid flicker and repeated inline banners
  const lastErrorRef = useRef<{ msg: string; ts: number } | null>(null);
  const setErrorDedup = useCallback((payload: { message: string, link?: string } | null, cooldownMs: number = 15000) => {
    if (!payload) { setError(null); return; }
    const now = Date.now();
    const last = lastErrorRef.current;
    const key = payload.link ? `${payload.message}::${payload.link}` : payload.message;
    if (last && last.msg === key && now - last.ts < cooldownMs) return;
    setError(payload);
    lastErrorRef.current = { msg: key, ts: now };
  }, []);

  // Guard flags to prevent overlapping runs/requests
  const autoPopulatedRef = useRef(false);
  const matchInsightSignaturesRef = useRef<Map<string, string>>(new Map());
  // Removed per-URL incremental loop; keep a simple flag if needed in future
  // const startInFlightRef = useRef(false);

    // Step-by-step loading banner
    const LoadingBanner = ({ subtitle, steps, activeStep, onCancel, foundCount }: { subtitle?: string; steps: string[]; activeStep: number; onCancel?: () => void; foundCount?: number }) => (
      <Card className="relative overflow-hidden bg-gradient-to-br from-[#0b0b0b] via-[#0f0f0f] to-[#0b0b0b] border border-[#1dff00]/30 p-4 sm:p-5 mb-4">
        <motion.div
          className="pointer-events-none absolute -inset-24 opacity-30"
          style={{ background: 'radial-gradient(600px 200px at 20% -10%, rgba(29,255,0,0.25), rgba(29,255,0,0) 60%)' }}
          initial={{ opacity: 0.15 }}
          animate={{ opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="flex items-center gap-3">
          <div className="relative w-6 h-6">
            <span className="absolute inset-0 rounded-full bg-[#1dff00] opacity-70" />
            <motion.span
              className="absolute inset-0 rounded-full bg-[#1dff00]"
              initial={{ scale: 0.9, opacity: 0.75 }}
              animate={{ scale: [0.9, 1.25, 0.9], opacity: [0.75, 0.15, 0.75] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-medium flex items-center gap-2">
              <span>Building your results…</span>
              {typeof foundCount === 'number' && foundCount > 0 && (
                <motion.span
                  key={foundCount}
                  initial={{ scale: 0.9, opacity: 0.6 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                  className="text-[11px] px-2 py-0.5 rounded-full border border-[#1dff00]/40 text-[#1dff00] bg-[#1dff00]/10"
                >
                  Found {foundCount}
                </motion.span>
              )}
            </div>
            <div className="text-xs text-[#ffffff90]">{subtitle || 'This may take a few minutes depending on sources.'}</div>
          </div>
          {onCancel && (
            <Button variant="ghost" className="text-[#ffffffb3] hover:bg-[#ffffff12] border border-[#ffffff1e] h-8 px-3" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 relative">
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
                    ? 'border-[#1dff00] bg-[#1dff00]/10 shadow-[0_0_15px_rgba(29,255,0,0.2)]'
                    : isCompleted
                    ? 'border-[#1dff00]/50 bg-[#1dff00]/5'
                    : 'border-[#ffffff18] bg-[#ffffff08]'
                }`}
              >
                <div className="relative flex-shrink-0">
                  {isCompleted ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      className="w-4 h-4 rounded-full bg-[#1dff00] flex items-center justify-center"
                    >
                      <svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </motion.div>
                  ) : isActive ? (
                    <motion.div
                      className="w-4 h-4 rounded-full bg-[#1dff00]"
                      animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-[#ffffff40]" />
                  )}
                </div>
                <div className={`text-[11px] sm:text-xs truncate font-medium ${isActive ? 'text-[#eaffea]' : isCompleted ? 'text-[#1dff00]/80' : 'text-[#ffffff90]'}`}>
                  {label}
                </div>
                {isActive && (
                  <motion.span
                    layoutId="activeStepGlow"
                    className="absolute inset-0 rounded-lg pointer-events-none"
                    style={{ boxShadow: '0 0 20px rgba(29,255,0,0.25) inset' }}
                  />
                )}
              </motion.div>
            );
          })}
        </div>

        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-[#ffffff70]">
            <span>Progress</span>
            <span>{Math.round(((activeStep) / (steps.length - 1)) * 100)}%</span>
          </div>
          <div className="h-2 bg-[#0f0f0f] rounded-full overflow-hidden border border-[#1dff00]/20 relative">
            <motion.div
              className="absolute inset-0 opacity-20"
              style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(29,255,0,0.4) 50%, transparent 100%)' }}
              animate={{ x: ['-100%', '200%'] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
            />
            <motion.div
              className="h-full bg-gradient-to-r from-[#1dff00]/60 via-[#1dff00] to-[#1dff00]/60 relative"
              initial={{ width: '0%' }}
              animate={{ width: `${((activeStep) / (steps.length - 1)) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              <motion.div
                className="absolute inset-0 opacity-50"
                style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)' }}
                animate={{ x: ['-100%', '200%'] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
              />
            </motion.div>
          </div>
        </div>
      </Card>
    );

  const [stepIndex, setStepIndex] = useState(0);
    const steps = useMemo(() => [
      'Searching Web',
      'Saving Results'
    ], []);
    const autoApplySteps = useMemo(() => ([
      { id: 1 as const, label: 'Select resume', description: 'Choose the profile we attach to each submission.' },
      { id: 2 as const, label: 'Review & launch', description: 'Confirm scope, safeguards, and telemetry before automation.' },
    ]), []);
    const selectedResume = useMemo(() => {
      if (!Array.isArray(resumes)) return null;
      return resumes.find((r: any) => r.id === selectedResumeId) ?? null;
    }, [resumes, selectedResumeId]);
    const selectedCoverLetter = useMemo(() => {
      if (!Array.isArray(coverLetterLibrary) || !coverLetterLibrary.length) return null;
      return coverLetterLibrary.find((entry) => entry.id === selectedCoverLetterId) ?? null;
    }, [coverLetterLibrary, selectedCoverLetterId]);
    const matchContext = useMemo<MatchContext>(() => ({
      searchQuery,
      selectedLocation,
      profile,
    }), [searchQuery, selectedLocation, profile]);
    const decorateJobsRef = useRef<(list: Job[]) => Job[]>((list) => list);
    const decorateJobs = useCallback((list: Job[]) => list.map((job) => decorateJobWithMatchInsights(job, matchContext)), [matchContext]);
    useEffect(() => {
      decorateJobsRef.current = decorateJobs;
      setJobs((prev) => (prev.length ? decorateJobs(prev) : prev));
    }, [decorateJobs]);
    const profileSnapshot = useMemo(() => composeProfileSnapshot(profile), [profile]);
    const profileReady = Boolean(profileSnapshot);
    const resumeLibraryReady = useMemo(
      () => Array.isArray(resumes) && resumes.some((rec: any) => Boolean(rec?.file_path)),
      [resumes],
    );
    const getHost = (url?: string | null) => {
      if (!url) return '';
      try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
    };


    const loadCoverLetterLibrary = useCallback(() => {
      if (typeof window === 'undefined') return;
      try {
        const raw = window.localStorage.getItem(COVER_LETTER_LIBRARY_KEY);
        let entries: CoverLetterLibraryEntry[] = [];
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            entries = parsed.filter((item): item is CoverLetterLibraryEntry => Boolean(item && typeof item.id === 'string'));
          }
        }
        if (!entries.length) {
          const draftRaw =
            window.localStorage.getItem(COVER_LETTER_DRAFT_KEY) ||
            window.localStorage.getItem('jr.coverLetter.draft.v1');
          if (draftRaw) {
            try {
              const parsedDraft = JSON.parse(draftRaw);
              const draftName =
                String(parsedDraft?.subject || parsedDraft?.role || 'Latest cover letter').trim() ||
                'Latest cover letter';
              const draftUpdatedAt = parsedDraft?.savedAt || new Date().toISOString();
              entries = [
                {
                  id: '__draft__',
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
          if (defaultId && entries.some((entry) => entry.id === defaultId)) return defaultId;
          return entries.length ? entries[0].id : null;
        });
      } catch {
        setCoverLetterLibrary([]);
        setSelectedCoverLetterId(null);
      }
    }, []);


    // Real step updates occur at key phases of the flow; no cycling needed now.

    // Steps reflect phases; no cancel/try-different actions per request

    const fetchJobQueue = useCallback(async (): Promise<Job[]> => {
        setQueueStatus('loading');
        setError(null);
        try {
          const { data, error: fetchError } = await supabase.functions.invoke('get-jobs');
          if (fetchError) throw new Error(fetchError.message);

          const jobList = (data.jobs || []).map(mapDbJobToUiJob);
          const decorated = decorateJobsRef.current(jobList);
          setJobs(decorated);

          if (decorated.length > 0) {
            setQueueStatus('ready');
            setSelectedJob(decorated[0].id);
          } else {
            setQueueStatus('empty');
          }
          return decorated; // Return the list for chaining
        } catch (e: any) {
          setError({ message: e.message });
          setQueueStatus('idle');
          return []; // Return empty array on error
        }
    }, [supabase]);

    const populateQueue = useCallback(async (query: string, _location?: string) => {
      // Prevent re-entry if a run is active
      if (incrementalMode) return;
      if (!query || !query.trim()) {
        setError({ message: 'Please enter a job title or keywords to search.' });
        return;
      }
      setQueueStatus('populating');
      setError(null);
      setLastReason(null);
      setStepIndex(0); // Step 0: Searching Web
      setIncrementalMode(true);
      setInsertedThisRun(0);

      try {
        // Use backend jobs-search to discover and save jobs directly
        safeInfo("Searching the web for jobs…");
        const attemptInvoke = async (): Promise<any> => {
          const searchPayload = {
            searchQuery: query,
            location: 'Remote',  // Always search for remote jobs for broader results
            limit: 50,
          };
          if (debugMode) console.log('[debug] jobs-search request', searchPayload);
          setDbgSearchReq(searchPayload);
          const { data, error: invokeErr } = await supabase.functions.invoke('jobs-search', {
            body: searchPayload,
          });
          if (invokeErr) throw new Error(invokeErr.message);
          if (debugMode) console.log('[debug] jobs-search response', data);
          setDbgSearchRes(data);
          return data;
        };

        let searchData = await attemptInvoke();
        if (searchData?.error === 'rate_limited') {
          const retrySec = Math.max(10, Math.min(120, Number(searchData?.retryAfterSeconds || 55)));
          setErrorDedup({ message: `Rate limited by Firecrawl. Retrying in ${retrySec}s…` });
          await new Promise((r) => setTimeout(r, retrySec * 1000));
          searchData = await attemptInvoke();
        }

        if (searchData?.error) {
          if (searchData.error === 'missing_api_key') {
            setErrorDedup({ message: 'Firecrawl is not configured. Ask your admin to set FIRECRAWL_API_KEY in Supabase Function Secrets.' });
          } else if (searchData.error === 'rate_limited') {
            setErrorDedup({ message: 'Rate limited by Firecrawl. Please try again shortly.' });
          } else {
            const detail = searchData.detail || 'An unknown error occurred.';
            setErrorDedup({ message: `Failed to search: ${detail}` });
          }
          setQueueStatus('ready');
          setIncrementalMode(false);
          return;
        }

        // Jobs are now saved directly by jobs-search function
        const inserted = searchData?.jobsInserted || 0;

        setStepIndex(1); // Complete: Saving Results
        setInsertedThisRun(inserted);
        
        // Refresh job list
        await fetchJobQueue();
        
        setIncrementalMode(false);
        safeInfo("Job search complete!", inserted > 0 ? `Found and saved ${inserted} jobs.` : "No jobs found for this search.");
        setCurrentSource(null);

      } catch (e: any) {
        setError({ message: `Failed to search jobs: ${e.message}` });
        setQueueStatus('idle');
        setIncrementalMode(false);
      }
  }, [supabase, debugMode, incrementalMode, fetchJobQueue, safeInfo, setErrorDedup]);

    // Removed old process-and-match and polling logic - jobs are now saved directly

    const cancelPopulation = useCallback(() => {
      setIncrementalMode(false);
      setQueueStatus('ready');
      setCurrentSource(null);
    }, []);

    const openAutoApplyFlow = useCallback(() => {
      setAutoApplyStep(1);
      setResumeDialogOpen(true);
      loadCoverLetterLibrary();
      setSelectedResumeId((prev) => {
        if (prev && resumes?.some((r: any) => r.id === prev)) return prev;
        if (Array.isArray(resumes) && resumes.length > 0) {
          const favorite = resumes.find((r: any) => r.is_favorite);
          return favorite?.id ?? resumes[0].id ?? null;
        }
        return null;
      });
    }, [resumes, loadCoverLetterLibrary]);

    useEffect(() => {
      if (!resumeDialogOpen) return;
      loadCoverLetterLibrary();
    }, [resumeDialogOpen, loadCoverLetterLibrary]);

    // Apply all jobs by delegating to automation workflow, then prune applied rows
    const applyAllJobs = useCallback(async () => {
      if (applyingAll || !jobs.length) return;

      const jobsWithTargets = jobs
        .map((job) => ({ job, target: getJobApplyTarget(job) }))
        .filter((item): item is { job: Job; target: string } => Boolean(item.target));

      if (!jobsWithTargets.length) {
        safeInfo('No automation targets', 'These jobs are missing apply links. Refresh your queue or open the job detail to locate one manually.');
        return;
      }

      const skipped = jobs.length - jobsWithTargets.length;
      if (skipped > 0) {
        jobs
          .filter((job) => !jobsWithTargets.some((entry) => entry.job.id === job.id))
          .forEach((job) => {
            events.autoApplyJobFailed(job.id, job.status || job.remote_type || 'unknown', 'missing_apply_url');
          });
      }

      setApplyingAll(true);
      setApplyProgress({ done: 0, total: jobsWithTargets.length, success: 0, fail: 0 });

      try {
        const coverLetterPayload = composeCoverLetterPayload(selectedCoverLetter);
        events.autoApplyStarted(jobsWithTargets.length, selectedResumeId || undefined, selectedCoverLetterId || undefined);

        const payloadJobs = jobsWithTargets.map(({ job, target }) => ({
          sourceUrl: target,
          url: job.apply_url ?? target,
          source_url: job.source_id ?? target,
        }));

        const launchedAt = new Date();
        let resumeSignedUrl: string | undefined;
        if (selectedResume?.file_path) {
          try {
            const { data: signed, error: signErr } = await supabase.storage
              .from('resumes')
              .createSignedUrl(selectedResume.file_path, 60 * 60);
            if (!signErr && signed?.signedUrl) {
              resumeSignedUrl = signed.signedUrl;
            } else if (signErr) {
              console.error('auto-apply resume signing failed', signErr.message);
            }
          } catch (signErr) {
            console.error('auto-apply resume signing threw', signErr);
          }
        }


        const automationResult = await applyToJobs({
          jobs: payloadJobs,
          title: `Jobraker Auto Apply • ${launchedAt.toLocaleString()}`,
          cover_letter: coverLetterPayload,
          ...(profileSnapshot ? { additional_information: profileSnapshot } : {}),
          ...(resumeSignedUrl ? { resume: resumeSignedUrl } : {}),
        });

        const { runId, workflowId, providerStatus, recordingUrl } = extractAutomationMetadata(automationResult);
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id ?? null;
        const applicationsToInsert: any[] = [];
        const appliedTimestamp = new Date().toISOString();

        safeInfo(
          'Automation launched',
          `Dispatched ${jobsWithTargets.length} job${jobsWithTargets.length === 1 ? '' : 's'} to the automation runner${skipped > 0 ? `; skipped ${skipped}.` : '.'}`,
        );

        let success = 0;
        let fail = 0;
        let done = 0;
        const appliedIds: string[] = [];

        for (const { job, target } of jobsWithTargets) {
          try {
            const { error } = await supabase.from('jobs').delete().eq('id', job.id);
            done += 1;
            if (error) {
              fail += 1;
              setApplyProgress((prev) => ({ ...prev, done, fail }));
              events.autoApplyJobFailed(job.id, job.status || 'unknown', 'delete_failed');
            } else {
              success += 1;
              appliedIds.push(job.id);
              setApplyProgress((prev) => ({ ...prev, done, success }));
              events.autoApplyJobSuccess(job.id, job.status || 'unknown', 0);
              if (userId) {
                const matchScore = typeof job.matchScore === 'number' ? Math.round(job.matchScore) : null;
                const matchNote = matchScore != null
                  ? `match:${matchScore}${job.matchSummary ? ` | ${job.matchSummary}` : ''}`
                  : null;
                applicationsToInsert.push({
                  user_id: userId,
                  job_title: job.title,
                  company: job.company,
                  location: job.location ?? '',
                  applied_date: appliedTimestamp,
                  status: 'Applied',
                  salary: formatSalaryRange(job),
                  notes: matchNote,
                  next_step: null,
                  interview_date: null,
                  logo: job.logoUrl ?? null,
                  run_id: runId,
                  workflow_id: workflowId,
                  app_url: job.apply_url ?? target ?? null,
                  provider_status: providerStatus ?? 'Automation launched',
                  recording_url: recordingUrl,
                  failure_reason: null,
                });
              }
            }
          } catch (inner) {
            done += 1;
            fail += 1;
            setApplyProgress((prev) => ({ ...prev, done, fail }));
            events.autoApplyJobFailed(job.id, job.status || 'unknown', 'exception_delete');
          }
        }

        if (applicationsToInsert.length) {
          try {
            await supabase.from('applications').insert(applicationsToInsert);
          } catch (appErr) {
            console.error('Failed to insert application records', appErr);
          }
        } else if (!userId) {
          console.warn('Skipping application inserts because user id is unavailable');
        }

        events.autoApplyFinished(success, fail);

        if (appliedIds.length) {
          const appliedSet = new Set(appliedIds);
          const remaining = jobs.filter((job) => !appliedSet.has(job.id));
          setJobs(remaining);
          if (remaining.length === 0) {
            setQueueStatus('empty');
            setSelectedJob(null);
          } else {
            setQueueStatus('ready');
            if (selectedJob && !remaining.some((job) => job.id === selectedJob)) {
              setSelectedJob(remaining[0].id);
            }
          }
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setError({ message: `Failed to launch automation: ${message}` });
        events.autoApplyFinished(0, jobsWithTargets.length);
      } finally {
        setApplyingAll(false);
        setAutoApplyStep(1);
      }
  }, [applyingAll, jobs, profileSnapshot, selectedCoverLetter, selectedCoverLetterId, selectedJob, selectedResume, selectedResumeId, safeInfo, setError]);

    // Unified effect for initial load and real-time updates
  useEffect(() => {
        if (profileLoading) {
            setQueueStatus('loading');
            return;
        }

        // Define the initial loading sequence
        const initialLoad = async () => {
            const initialJobs = await fetchJobQueue();
            // If the queue is empty AND we have a profile with a job title, auto-populate it.
      if (!autoPopulatedRef.current && initialJobs.length === 0 && profile?.job_title) {
        autoPopulatedRef.current = true;
        safeInfo("No results yet. Building a personalized job feed...", "This may take a moment.");
        await populateQueue(profile.job_title, profile.location || undefined);
            }
        };

        initialLoad();

        // Set up the real-time subscription
        const channel = supabase
            .channel('jobs-queue-changes')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'jobs' }, () => {
              // During an active search/extraction run, avoid thrashing the UI
              if (incrementalMode) return;
              fetchJobQueue();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
  }, [profileLoading, profile, fetchJobQueue, populateQueue, supabase, info, incrementalMode]);

    // Effect to pre-fill search query from profile
    useEffect(() => {
        if (profile && !searchQuery) {
            setSearchQuery(profile.job_title || '');
            setSelectedLocation(profile.location || 'Remote');
        }
    }, [profile, searchQuery]);

    const visibleJobs = useMemo(() => jobs, [jobs]);

    const sortedJobs = useMemo(() => {
      const arr = [...visibleJobs];
      if (sortBy === 'company') {
        return arr.sort((a, b) => (a.company || '').localeCompare(b.company || ''));
      }
      if (sortBy === 'deadline') {
        const toTs = (v?: string | null) => {
          if (!v) return Number.POSITIVE_INFINITY;
          const t = Date.parse(v);
          return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
        };
        return arr.sort((a, b) => toTs(a.expires_at) - toTs(b.expires_at));
      }
      return arr.sort((a, b) => new Date(b.posted_at || 0).getTime() - new Date(a.posted_at || 0).getTime());
    }, [visibleJobs, sortBy]);

    const total = sortedJobs.length;
  const visibleJobCount = total;
  const canAdvanceFromStepOne = !resumesLoading && (!Array.isArray(resumes) || resumes.length === 0 || Boolean(selectedResumeId));
  const canLaunchAutoApply = visibleJobCount > 0 && (!Array.isArray(resumes) || resumes.length === 0 || Boolean(selectedResumeId));
  const autoApplyPrimaryDisabled = autoApplyStep === 1 ? !canAdvanceFromStepOne : !canLaunchAutoApply;
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
            if (typeof job.matchScore !== 'number') return null;
            const signature = `${Math.round(job.matchScore)}|${job.matchSummary ?? ''}|${JSON.stringify(job.matchBreakdown ?? null)}|${matchContext.searchQuery || ''}|${matchContext.selectedLocation || ''}`;
            if (matchInsightSignaturesRef.current.get(job.id) === signature) {
              return null;
            }
            const rawData = (job as any)?.raw_data && typeof (job as any).raw_data === 'object'
              ? { ...(job as any).raw_data }
              : {} as Record<string, any>;
            const existing = rawData?.match_insights;
            const nextInsights = {
              score: job.matchScore,
              summary: job.matchSummary ?? null,
              breakdown: job.matchBreakdown ?? null,
              search_query: matchContext.searchQuery || null,
              location_preference: matchContext.selectedLocation || null,
              computed_at: new Date().toISOString(),
            };
            const unchanged = existing
              && existing.score === nextInsights.score
              && existing.summary === nextInsights.summary
              && JSON.stringify(existing.breakdown ?? null) === JSON.stringify(nextInsights.breakdown ?? null)
              && (existing.search_query || null) === nextInsights.search_query
              && (existing.location_preference || null) === nextInsights.location_preference;
            if (unchanged) {
              matchInsightSignaturesRef.current.set(job.id, signature);
              return null;
            }
            rawData.match_insights = nextInsights;
            return { id: job.id, raw_data: rawData, signature };
          })
          .filter(Boolean) as Array<{ id: string; raw_data: Record<string, any>; signature: string }>;
        if (!updates.length) return;
        try {
          await Promise.all(updates.map(({ id, raw_data }) => supabase.from('jobs').update({ raw_data }).eq('id', id)));
          updates.forEach(({ id, signature }) => {
            matchInsightSignaturesRef.current.set(id, signature);
          });
        } catch (err) {
          console.error('persist match insights failed', err);
        }
      };
      persist();
    }, [jobs, supabase, matchContext.searchQuery, matchContext.selectedLocation]);

    useEffect(() => {
      if (currentPage !== clampedPage) setCurrentPage(clampedPage);
    }, [clampedPage, currentPage]);

    useEffect(() => {
      if (selectedJob && !paginatedJobs.some(j => j.id === selectedJob)) {
        setSelectedJob(paginatedJobs[0]?.id ?? null);
      }
    }, [clampedPage, pageSize, selectedJob, paginatedJobs]);

    useEffect(() => {
      setCurrentPage(1);
    }, [searchQuery, sortBy]);

    useEffect(() => {
      if (!resumeDialogOpen) return;
      if (!Array.isArray(resumes) || resumes.length === 0) return;
      setSelectedResumeId(prev => {
        if (prev && resumes.some((r: any) => r.id === prev)) return prev;
        const favorite = resumes.find((r: any) => r.is_favorite);
        return favorite?.id ?? resumes[0].id ?? null;
      });
    }, [resumeDialogOpen, resumes]);

    // Small helper for relative timestamps
    const formatRelative = (iso?: string | null) => {
      if (!iso) return '';
      const d = new Date(iso);
      const now = new Date();
      const diff = Math.max(0, now.getTime() - d.getTime());
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      const days = Math.floor(hrs / 24);
      return `${days}d ago`;
    };

    // Deadline formatting helper
    const formatDeadlineMeta = (value?: string): { label: string; level: 'overdue' | 'soon' | 'future' } | null => {
      if (!value) return null;
      const ts = Date.parse(value);
      if (Number.isNaN(ts)) return { label: value, level: 'future' };
      const d = new Date(ts);
      const now = new Date();
      const ms = d.getTime() - now.getTime();
      const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
      if (days < 0) return { label: `Closed ${Math.abs(days)}d ago`, level: 'overdue' };
      if (days === 0) return { label: 'Closes today', level: 'soon' };
      if (days === 1) return { label: 'Closes tomorrow', level: 'soon' };
      const level: 'soon' | 'future' = days <= 7 ? 'soon' : 'future';
      return { label: `Closes in ${days}d`, level };
    };

    return (
      <div className="min-h-screen bg-black" role="main" aria-label="Job search">
        <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">Job Search</h1>
                <p className="text-[#ffffff80] text-sm sm:text-base">A personalized list of jobs waiting for you.</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3 sm:justify-end">
                  <div className="relative flex min-w-[240px] flex-col gap-3 rounded-2xl border border-[#1dff00]/30 bg-[#1dff00]/10 px-4 py-3 text-white shadow-[0_12px_32px_rgba(29,255,0,0.18)] sm:flex-row sm:items-center sm:gap-4">
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase tracking-[0.35em] text-[#1dff00]/80">Automation readiness</div>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {profileReady && resumeLibraryReady ? (
                          <>
                            <ShieldCheck className="h-4 w-4 text-[#1dff00]" />
                            <span>Ready to launch</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-4 w-4 text-[#ffb347]" />
                            <span>Action required</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      {profileLoading ? (
                        <span className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] text-white/70">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Syncing profile…
                        </span>
                      ) : (
                        <Link
                          to="/dashboard/profile"
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] transition-all",
                            profileReady
                              ? "border-[#1dff00]/60 bg-[#1dff00]/15 text-[#e6ffe6] hover:border-[#1dff00]/80 hover:bg-[#1dff00]/25"
                              : "border-[#ffb347]/50 bg-[#ffb347]/10 text-[#ffd9a8] hover:border-[#ffb347]/70 hover:bg-[#ffb347]/20",
                          )}
                          title={profileReady ? "Profile details detected" : "Complete your profile"}
                        >
                          {profileReady ? (
                            <UserCheck className="h-3.5 w-3.5 text-[#1dff00]" />
                          ) : (
                            <UserX className="h-3.5 w-3.5 text-[#ffb347]" />
                          )}
                          <span className="font-medium">
                            {profileReady ? 'Profile verified' : 'Complete profile'}
                          </span>
                        </Link>
                      )}
                      {resumesLoading ? (
                        <span className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] text-white/70">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Loading resumes…
                        </span>
                      ) : (
                        <Link
                          to="/dashboard/resumes"
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] transition-all",
                            resumeLibraryReady
                              ? "border-[#1dff00]/60 bg-[#1dff00]/15 text-[#e6ffe6] hover:border-[#1dff00]/80 hover:bg-[#1dff00]/25"
                              : "border-[#ffb347]/50 bg-[#ffb347]/10 text-[#ffd9a8] hover:border-[#ffb347]/70 hover:bg-[#ffb347]/20",
                          )}
                          title={resumeLibraryReady ? (selectedResume?.name ? `Selected resume: ${selectedResume.name}` : 'Resume library ready') : 'Upload a resume to unlock automation'}
                        >
                          {resumeLibraryReady ? (
                            <FileCheck2 className="h-3.5 w-3.5 text-[#1dff00]" />
                          ) : (
                            <FileWarning className="h-3.5 w-3.5 text-[#ffb347]" />
                          )}
                          <span className="max-w-[140px] truncate font-medium">
                            {resumeLibraryReady
                              ? selectedResume?.name
                                ? `Resume: ${selectedResume.name}`
                                : 'Resume library ready'
                              : 'Upload resume'}
                          </span>
                        </Link>
                      )}
                    </div>
                  </div>
                  {/* Target selector removed: fixed to 10 to minimize API usage and keep runs bounded */}
                  <div className="flex items-center gap-2 text-xs text-[#ffffff70] select-none">
                    <button
                      type="button"
                      onClick={() => setDebugMode(v => !v)}
                      className="px-1 py-0.5 rounded hover:text-white focus:outline-none focus:ring-1 focus:ring-[#1dff00]/50"
                      aria-pressed={debugMode}
                      title="Toggle Diagnostics"
                    >
                      Diagnostics
                    </button>
                    <Switch checked={debugMode} onCheckedChange={setDebugMode} />
                  </div>
                  <Button
                    variant="ghost"
                    onClick={openAutoApplyFlow}
                    className={`relative overflow-hidden border border-[#1dff00]/40 text-white px-4 sm:px-5 py-2 rounded-xl transition-all duration-300 ${applyingAll ? 'bg-[#1dff00]/20 text-[#1dff00]' : 'bg-gradient-to-r from-[#1dff00]/10 via-transparent to-[#1dff00]/10 hover:from-[#1dff00]/20 hover:to-[#1dff00]/5'}`}
                    title="Auto apply all visible jobs"
                    disabled={applyingAll || queueStatus !== 'ready' || jobs.length === 0}
                  >
                    <span className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'radial-gradient(180px at 0% 0%, rgba(29,255,0,0.45), transparent 65%)' }} />
                    <span className="relative inline-flex items-center gap-2 text-sm font-medium tracking-wide">
                      {applyingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Briefcase className="w-4 h-4" />}
                      {applyingAll ? `Applying ${applyProgress.done}/${applyProgress.total}` : 'Auto Apply Suite'}
                    </span>
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => populateQueue(searchQuery, selectedLocation)}
                    className={`group relative overflow-hidden rounded-xl px-4 sm:px-5 py-2 text-sm font-medium tracking-wide transition-all duration-300 border backdrop-blur-md disabled:cursor-not-allowed disabled:opacity-60 ${
                      queueStatus === 'populating' || queueStatus === 'loading'
                        ? 'border-[#1dff00]/60 text-[#1dff00] bg-[#1dff00]/15'
                        : 'border-white/20 text-white bg-white/5 hover:text-[#1dff00] hover:border-[#1dff00]/60 hover:bg-[#1dff00]/10 shadow-[0_12px_32px_rgba(8,122,52,0.35)]'
                    }`}
                    title="Find a fresh batch of jobs"
                    disabled={queueStatus === 'populating' || queueStatus === 'loading'}
                  >
                    <span
                      className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ background: 'linear-gradient(120deg, transparent 0%, rgba(29,255,0,0.35) 45%, transparent 90%)' }}
                    />
                    <span className="relative inline-flex items-center gap-2">
                      {queueStatus === 'populating'
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Search className="w-4 h-4 text-[#1dff00]" />}
                      {queueStatus === 'populating' ? 'Building results…' : 'Find Jobs Suite'}
                    </span>
                  </Button>
                </div>
            </div>
          </div>

          {queueStatus === 'populating' && (
            <LoadingBanner
              subtitle={`Streaming results… ${currentSource ? `Source: ${currentSource}` : ''}`}
              steps={steps}
              activeStep={stepIndex}
              onCancel={cancelPopulation}
              foundCount={insertedThisRun}
            />
          )}

          <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] p-4 sm:p-6 mb-6 sm:mb-8" id="jobs-search-filters" data-tour="jobs-search-filters">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="lg:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#ffffff60]" />
                <Input
                  id="jobs-search"
                  data-tour="jobs-search"
                  placeholder="Search jobs, companies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); populateQueue(searchQuery, selectedLocation); } }}
                  className="pl-10 bg-[#ffffff1a] border-[#ffffff33] text-white"
                />
              </div>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#ffffff60]" />
                <Input
                  id="jobs-location"
                  data-tour="jobs-location"
                  placeholder="Location..."
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); populateQueue(searchQuery, selectedLocation); } }}
                  className="pl-10 bg-[#ffffff1a] border-[#ffffff33] text-white"
                />
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-3 sticky top-0 z-10 bg-transparent backdrop-blur supports-[backdrop-filter]:bg-black/20 rounded-lg px-1 py-2 lg:static lg:px-0 lg:py-0">
                <h2 className="text-lg sm:text-xl font-semibold text-white">
                  {queueStatus === 'loading' && "Loading results..."}
                  {queueStatus === 'populating' && "Building your results..."}
                  {(queueStatus === 'ready' || queueStatus === 'empty') && `${total} Jobs Found`}
                </h2>
                {(queueStatus === 'ready' || queueStatus === 'empty') && (
                  <div className="hidden sm:flex items-center gap-2">
                    <span className="text-[11px] text-white/50">Sort</span>
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                      <SelectTrigger className="h-8 w-[160px]">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="recent">Most recent</SelectItem>
                        <SelectItem value="company">Company</SelectItem>
                        <SelectItem value="deadline">Deadline</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {queueStatus === 'ready' && total > 0 && (
                <div className="hidden lg:grid grid-cols-[auto,1fr,auto] items-center gap-3 px-2 text-[11px] uppercase tracking-wide text-white/40">
                  <span className="pl-2">Role</span>
                  <div className="grid grid-cols-3 gap-2">
                    <span>Company</span>
                    <span>Meta</span>
                    <span>Posting</span>
                  </div>
                </div>
              )}

              { (queueStatus === 'loading' || queueStatus === 'populating') && (
                <div className="space-y-5">
                  <Card className="relative overflow-hidden border border-[#1dff00]/20 bg-gradient-to-br from-[#041206] via-[#050a08] to-[#020403] p-6 sm:p-7">
                    <motion.div
                      className="pointer-events-none absolute inset-[-40%] bg-[radial-gradient(circle_at_top,rgba(29,255,0,0.28),rgba(29,255,0,0)_60%)] opacity-60"
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
                    />
                    <div className="relative flex flex-col gap-5">
                      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.4em] text-[#1dff00]/70">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#1dff00]/40 bg-[#1dff00]/10">
                          <span className="h-2 w-2 rounded-full bg-[#1dff00] animate-ping" />
                        </span>
                        Scanning networks for roles
                      </div>
                      <div className="grid gap-4 sm:grid-cols-3">
                        {['Signals', 'Compliance', 'Enrichment'].map((label, idx) => (
                          <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                            <div className="flex items-center justify-between text-xs text-white/60">
                              <span>{label}</span>
                              <span className="text-[9px] font-mono text-[#1dff00]/80">{String(idx + 1).padStart(2, '0')}</span>
                            </div>
                            <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                              <motion.div
                                className="h-full bg-gradient-to-r from-[#0aff7b] via-[#1dff00] to-[#7bffb2]"
                                animate={{ width: ['15%', '85%', '35%', '70%'] }}
                                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: idx * 0.2 }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-white/10 bg-[#0c0c0c] p-4">
                          <div className="h-3 w-20 rounded bg-white/12" />
                          <div className="mt-3 space-y-2">
                            <div className="h-4 rounded bg-white/10" />
                            <div className="h-4 w-5/6 rounded bg-white/8" />
                            <div className="h-4 w-2/3 rounded bg-white/6" />
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-[#0c0c0c] p-4">
                          <div className="h-3 w-24 rounded bg-white/12" />
                          <div className="mt-3 grid grid-cols-3 gap-3 text-[10px] text-white/50">
                            {Array.from({ length: 3 }).map((_, metricIdx) => (
                              <div key={metricIdx} className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
                                <div className="h-3 rounded bg-[#ffffff1a]" />
                                <div className="h-4 rounded bg-[#ffffff14]" />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>

                  <div className="grid gap-4">
                    {Array.from({ length: pageSize }).map((_, i) => (
                      <Card
                        key={i}
                        className="relative overflow-hidden border border-[#1dff00]/25 bg-gradient-to-br from-[#020202] via-[#050708] to-[#090b0c] p-5 sm:p-6"
                      >
                        <motion.div
                          className="absolute inset-0 bg-[linear-gradient(120deg,rgba(29,255,0,0.12)_0%,rgba(29,255,0,0.02)_38%,rgba(29,255,0,0.15)_72%,rgba(29,255,0,0.02)_100%)]"
                          animate={{ backgroundPosition: ['0% 0%', '120% 0%', '0% 0%'] }}
                          transition={{ duration: 6.5, repeat: Infinity, ease: 'linear', delay: i * 0.05 }}
                        />
                        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex flex-1 items-start gap-4">
                            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-[#1dff00]/25 bg-[#0a1a0f]">
                              <motion.span
                                className="absolute h-10 w-10 rounded-full bg-[#1dff00]/20"
                                animate={{ scale: [0.85, 1.05, 0.85], opacity: [0.4, 0.15, 0.4] }}
                                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                              />
                              <span className="relative h-8 w-8 rounded-full border border-[#1dff00]/40" />
                            </div>
                            <div className="flex-1 space-y-3">
                              <div className="h-4 w-3/5 rounded bg-[#ffffff24]" />
                              <div className="h-3 w-1/2 rounded bg-[#ffffff1a]" />
                              <div className="flex flex-wrap items-center gap-2">
                                {Array.from({ length: 4 }).map((__, chipIdx) => (
                                  <span key={chipIdx} className="inline-flex h-5 w-16 rounded-full border border-white/12 bg-[#ffffff14]" />
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="grid w-full max-w-[240px] grid-cols-2 gap-2 text-[10px] text-white/60 sm:w-auto">
                            {Array.from({ length: 4 }).map((__, metricIdx) => (
                              <div key={metricIdx} className="rounded-lg border border-white/10 bg-white/5 p-3">
                                <div className="h-3 rounded bg-[#ffffff1a]" />
                                <div className="mt-2 h-4 rounded bg-[#ffffff14]" />
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
                <Card className="border-red-500/30 bg-red-500/10 text-red-200 p-4 flex items-center justify-between">
                  <span>{error.message}</span>
                  {error.link && (
                    <Link to={error.link} className="underline font-bold ml-4 whitespace-nowrap">
                      Go to Settings
                    </Link>
                  )}
                </Card>
              )}
              {applyingAll && (
                <Card className="relative overflow-hidden border border-[#1dff00]/30 bg-gradient-to-br from-[#082514] via-[#04140b] to-[#010503] text-white p-4 sm:p-5">
                  <div className="pointer-events-none absolute -inset-32 bg-[#1dff00]/10 blur-3xl opacity-40" />
                  <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin text-[#1dff00]" />
                      <div>
                        <div className="text-sm font-medium">Automation in progress</div>
                        <div className="text-xs text-white/70">{applyProgress.total} roles • {applyProgress.success} successful / {applyProgress.fail} flagged</div>
                      </div>
                    </div>
                    <div className="text-xs text-white/50">
                      {applyProgress.done}/{applyProgress.total} completed
                    </div>
                  </div>
                  <div className="relative mt-4 h-2 rounded-full bg-white/12 overflow-hidden">
                    <motion.div
                      className="absolute inset-0 opacity-30"
                      style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(29,255,0,0.6) 50%, transparent 100%)' }}
                      animate={{ x: ['-100%', '200%'] }}
                      transition={{ repeat: Infinity, duration: 1.4, ease: 'linear' }}
                    />
                    <motion.div
                      className="relative h-full bg-gradient-to-r from-[#1dff00] via-[#52ff4b] to-[#1dff00]"
                      initial={{ width: '0%' }}
                      animate={{ width: `${Math.min(100, Math.round((applyProgress.done / Math.max(1, applyProgress.total)) * 100))}%` }}
                      transition={{ type: 'spring', stiffness: 160, damping: 25 }}
                    />
                  </div>
                </Card>
              )}

              {queueStatus === 'empty' && (
                <Card className="bg-gradient-to-br from-[#ffffff08] to-[#ffffff05] border border-[#ffffff15] p-8 text-center">
                  <Briefcase className="w-14 h-14 text-[#ffffff40] mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-white mb-2">Your Queue is Empty</h3>
                  <p className="text-[#ffffff80] mb-2">Click "Find New Jobs" to build your personalized job feed.</p>
                  {lastReason && (
                    <p className="text-[#ffffff60] text-sm">
                      {lastReason === 'no_sources' && 'No sources found. Broaden your search (e.g., remove seniority or location).'}
                      {lastReason === 'no_structured_results' && 'Sources were found but could not be parsed.'}
                    </p>
                  )}
                </Card>
              )}

              {queueStatus === 'ready' && paginatedJobs.map((job, index) => (
                <motion.div
                  key={job.id}
                  role="button"
                  aria-selected={selectedJob === job.id}
                  tabIndex={0}
                  data-tour={index === 0 ? "jobs-card" : undefined}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedJob(job.id); }
                    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      const idx = paginatedJobs.findIndex(j => j.id === job.id);
                      if (idx !== -1) {
                        const nextIdx = e.key === 'ArrowDown' ? Math.min(paginatedJobs.length - 1, idx + 1) : Math.max(0, idx - 1);
                        const nextId = paginatedJobs[nextIdx]?.id;
                        if (nextId) setSelectedJob(nextId);
                      }
                    }
                  }}
                  onClick={() => setSelectedJob(job.id)}
                  className={`cursor-pointer transition-all duration-300 ${selectedJob === job.id ? 'transform scale-[1.01]' : 'hover:transform hover:scale-[1.005]'} focus:outline-none focus:ring-2 focus:ring-[#1dff00]/40 rounded-xl`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.04 }}
                >
                  <Card className={`relative overflow-hidden group bg-gradient-to-br from-[#ffffff08] to-[#ffffff05] border p-5 sm:p-6 transition-all duration-300 ${selectedJob === job.id ? 'border-[#1dff00] shadow-[0_0_20px_rgba(29,255,0,0.25)]' : 'border-[#ffffff15] hover:border-[#1dff00]/40'}`}>
                    <span className={`pointer-events-none absolute left-0 top-0 h-full w-[3px] ${selectedJob === job.id ? 'bg-[#1dff00]' : 'bg-transparent group-hover:bg-[#1dff00]/70'} transition-colors`} />
                    <div className="flex items-start justify-between gap-3 sm:gap-4">
                      <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                        {job.logoUrl && !logoError[job.id]
                          ? (
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-white">
                              <img
                                src={job.logoUrl}
                                alt={job.company}
                                className="w-full h-full rounded-xl object-contain"
                                onError={() => setLogoError(e => ({...e, [job.id]: true}))}
                              />
                            </div>
                          ) : (
                            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-xl flex items-center justify-center text-black font-bold text-lg sm:text-2xl">{job.logo}</div>
                          )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <h3 className="text-white font-semibold truncate text-sm sm:text-base" title={job.title}>{job.title}</h3>
                            {(() => {
                              if (!job.posted_at) return null;
                              const postedTs = Date.parse(job.posted_at);
                              if (Number.isNaN(postedTs)) return null;
                              const isNew = (Date.now() - postedTs) <= (48 * 60 * 60 * 1000);
                              if (!isNew) return null;
                              return (
                                <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full border border-[#1dff00]/40 text-[#1dff00] bg-[#1dff00]/10">New</span>
                              );
                            })()}
                            {job.status && (
                              <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border ${job.status === 'applied' ? 'border-[#14b8a6]/40 text-[#14b8a6] bg-[#14b8a6]/10' : 'border-[#ffffff24] text-[#ffffffb3] bg-[#ffffff0a]'}`}>{job.status}</span>
                            )}
                          </div>
                          <div className="mt-2 space-y-1.5">
                            {/* Line 1: company + location + remote + salary + host (right) */}
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="text-[#ffffffb3] text-[11px] sm:text-sm truncate" title={job.company || ''}>{job.company}</span>
                              {job.location && (
                                <span className="text-[10px] px-1 sm:px-1.5 py-0.5 rounded-full border border-[#ffffff20] text-[#ffffffa6] bg-[#ffffff0d] whitespace-nowrap" title={job.location}>
                                  {job.location}
                                </span>
                              )}
                              {job.remote_type && (
                                <span className="text-[10px] px-1 sm:px-1.5 py-0.5 rounded-full border border-[#1dff00]/30 text-[#1dff00] bg-[#1dff00]/10 whitespace-nowrap" title={job.remote_type}>
                                  {job.remote_type}
                                </span>
                              )}
                              {(() => {
                                if (job.salary_min || job.salary_max || job.salary_currency) {
                                  const currency = job.salary_currency || 'USD';
                                  const currencySymbol = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency;
                                  let salaryText = '';
                                  if (job.salary_min && job.salary_max) {
                                    const min = job.salary_min >= 1000 ? `${Math.round(job.salary_min / 1000)}k` : job.salary_min;
                                    const max = job.salary_max >= 1000 ? `${Math.round(job.salary_max / 1000)}k` : job.salary_max;
                                    salaryText = `${currencySymbol}${min}-${max}`;
                                  } else if (job.salary_min) {
                                    const min = job.salary_min >= 1000 ? `${Math.round(job.salary_min / 1000)}k` : job.salary_min;
                                    salaryText = `${currencySymbol}${min}+`;
                                  } else if (job.salary_max) {
                                    const max = job.salary_max >= 1000 ? `${Math.round(job.salary_max / 1000)}k` : job.salary_max;
                                    salaryText = `Up to ${currencySymbol}${max}`;
                                  }
                                  if (salaryText) {
                                    return (
                                      <span className="text-[10px] px-1 sm:px-1.5 py-0.5 rounded-full border border-[#1dff00]/30 text-[#1dff00] bg-[#1dff00]/10 whitespace-nowrap" title={`Salary: ${salaryText}`}> 
                                        💰 {salaryText}
                                      </span>
                                    );
                                  }
                                }
                                const raw = (job as any)?.raw_data;
                                const salary = (raw?.scraped_data?.salary || raw?.salaryRange || raw?.salary) as string | undefined;
                                if (!salary) return null;
                                const short = salary.length > 28 ? salary.slice(0, 25) + '…' : salary;
                                return (
                                  <span className="text-[10px] px-1 sm:px-1.5 py-0.5 rounded-full border border-[#ffffff20] text-[#ffffffc0] bg-[#ffffff0d] whitespace-nowrap" title={salary}>
                                    {short}
                                  </span>
                                );
                              })()}
                              <span className="ml-auto inline-flex items-center gap-1 max-w-[140px] sm:max-w-[180px] overflow-hidden">
                                {(job.apply_url || (job as any)?.raw_data?.sourceUrl || job.source_id) && (() => {
                                  const href = job.apply_url || (job as any)?.raw_data?.sourceUrl || job.source_id || '';
                                  const host = getHost(href);
                                  const ico = host ? `https://icons.duckduckgo.com/ip3/${host}.ico` : '';
                                  return (
                                    <span className="inline-flex items-center gap-1 text-[10px] px-1 sm:px-1.5 py-0.5 rounded-full border border-[#ffffff1e] text-[#ffffffa6] bg-[#ffffff08] max-w-full overflow-hidden">
                                      {host && <img src={ico} alt="" className="w-3 h-3 rounded-sm" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />}
                                      <span className="truncate">{host}</span>
                                    </span>
                                  );
                                })()}
                              </span>
                            </div>

                            {/* Line 2: Tags + Posted (right) */}
                            <div className="flex flex-wrap items-center gap-1">
                              {(() => {
                                const tags: string[] | undefined = (job as any)?.tags || (job as any)?.raw_data?.scraped_data?.tags;
                                if (!tags || !Array.isArray(tags) || tags.length === 0) return null;
                                // Show up to 2 on mobile, up to 3 on sm+ screens
                                const firstTwo = tags.slice(0, 2);
                                const third = tags[2];
                                return (
                                  <>
                                    {firstTwo.map((t, i) => (
                                      <span key={`t-${i}`} className="text-[10px] px-1 sm:px-1.5 py-0.5 rounded-full border border-[#ffffff1e] text-[#ffffffa6] bg-[#ffffff08] whitespace-nowrap" title={t}>
                                        {t}
                                      </span>
                                    ))}
                                    {third && (
                                      <span key="t-2" className="hidden sm:inline-block text-[10px] px-1 sm:px-1.5 py-0.5 rounded-full border border-[#ffffff1e] text-[#ffffffa6] bg-[#ffffff08] whitespace-nowrap" title={third}>
                                        {third}
                                      </span>
                                    )}
                                  </>
                                );
                              })()}
                              <span className="ml-auto text-[10px] text-[#ffffff80] whitespace-nowrap">
                                {job.posted_at ? formatRelative(job.posted_at) : ''}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
              {queueStatus === 'ready' && total > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4">
                  <div className="text-[12px] text-white/60">
                    Showing <span className="text-white/80">{total === 0 ? 0 : startIdx + 1}</span>–<span className="text-white/80">{endIdx}</span> of <span className="text-white/80">{total}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-white/50">Rows</span>
                      <Select value={String(pageSize)} onValueChange={(v) => { const n = parseInt(v); if (!Number.isNaN(n)) { setPageSize(n); setCurrentPage(1); } }}>
                        <SelectTrigger className="h-8 w-[90px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="First page"
                        disabled={clampedPage === 1}
                        onClick={() => setCurrentPage(1)}
                        className={`h-8 w-8 grid place-items-center rounded-md border ${clampedPage===1 ? 'border-white/10 text-white/30' : 'border-white/20 text-white/70 hover:text-white hover:border-white/40 hover:bg-white/10'}`}
                      >
                        <ChevronsLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Previous page"
                        disabled={clampedPage === 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className={`h-8 w-8 grid place-items-center rounded-md border ${clampedPage===1 ? 'border-white/10 text-white/30' : 'border-white/20 text-white/70 hover:text-white hover:border-white/40 hover:bg-white/10'}`}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <div className="hidden md:flex items-center gap-1">
                        {(() => {
                          const pages: (number | '…')[] = [];
                          const maxToShow = 5;
                          let start = Math.max(1, clampedPage - 2);
                          let end = Math.min(totalPages, start + maxToShow - 1);
                          start = Math.max(1, end - maxToShow + 1);
                          if (start > 1) pages.push(1, '…');
                          for (let i = start; i <= end; i++) pages.push(i);
                          if (end < totalPages) pages.push('…', totalPages);
                          return pages.map((p, idx) => (
                            typeof p === 'number' ? (
                              <button
                                key={idx}
                                onClick={() => setCurrentPage(p)}
                                className={`h-8 min-w-8 px-2 rounded-md border text-[12px] ${p===clampedPage ? 'border-[#1dff00]/50 text-[#1dff00] bg-[#1dff00]/10' : 'border-white/20 text-white/70 hover:text-white hover:border-white/40 hover:bg-white/10'}`}
                              >{p}</button>
                            ) : (
                              <span key={idx} className="px-2 text-white/40">…</span>
                            )
                          ));
                        })()}
                      </div>
                      <button
                        type="button"
                        aria-label="Next page"
                        disabled={clampedPage === totalPages}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        className={`h-8 w-8 grid place-items-center rounded-md border ${clampedPage===totalPages ? 'border-white/10 text-white/30' : 'border-white/20 text-white/70 hover:text-white hover:border-white/40 hover:bg-white/10'}`}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Last page"
                        disabled={clampedPage === totalPages}
                        onClick={() => setCurrentPage(totalPages)}
                        className={`h-8 w-8 grid place-items-center rounded-md border ${clampedPage===totalPages ? 'border-white/10 text-white/30' : 'border-white/20 text-white/70 hover:text-white hover:border-white/40 hover:bg-white/10'}`}
                      >
                        <ChevronsRight className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="md:hidden text-[12px] text-white/60 text-right">
                      Page {clampedPage} of {totalPages}
                    </div>
                  </div>
                </div>
              )}

              {debugMode && (
                <Card className="bg-[#0b0b0b] border border-[#ffffff20] p-4">
                  <div className="text-xs text-[#ffffff90] mb-2">Debug Panel - Simplified Flow</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-[#d1d5db]">
                    <div>
                      <div className="text-[#9ca3af] mb-1">jobs-search request</div>
                      <pre className="bg-[#111] p-2 rounded overflow-auto max-h-48">{JSON.stringify(dbgSearchReq, null, 2) || '—'}</pre>
                    </div>
                    <div>
                      <div className="text-[#9ca3af] mb-1">jobs-search response</div>
                      <pre className="bg-[#111] p-2 rounded overflow-auto max-h-48">{JSON.stringify(dbgSearchRes, null, 2) || '—'}</pre>
                    </div>
                  </div>
                  <div className="mt-3 text-[10px] text-[#666] italic">
                    Note: Jobs are now saved directly by jobs-search. No extraction phase needed.
                  </div>
                </Card>
              )}
            </div>

      <div className="hidden lg:block lg:sticky lg:top-6 lg:h-fit">
        {selectedJob && (() => {
                  const job = jobs.find(j => j.id === selectedJob);
                  if (!job) return null;
          return (
                      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45 }}>
                        <div className="space-y-4">
                          {(() => {
                            const primaryHref = job.apply_url || (job as any)?.raw_data?.sourceUrl || job.source_id;
                            const siteHost = primaryHref ? getHost(primaryHref) : '';
                            const ico = siteHost ? `https://icons.duckduckgo.com/ip3/${siteHost}.ico` : '';
                            const employmentType = (job as any)?.employment_type ?? (job as any)?.raw_data?.scraped_data?.employment_type;
                            const experienceLevel = (job as any)?.experience_level ?? (job as any)?.raw_data?.scraped_data?.experience_level;
                            const deadline = job.expires_at || (job as any)?.raw_data?.deadline || (job as any)?.raw_data?.applicationDeadline;
                            const deadlineMeta = deadline ? formatDeadlineMeta(deadline) : null;

                            let salaryText: string | null = null;
                            if (job.salary_min || job.salary_max || job.salary_currency) {
                              const currency = job.salary_currency || 'USD';
                              const currencySymbol = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency;
                              if (job.salary_min && job.salary_max) salaryText = `${currencySymbol}${job.salary_min.toLocaleString()} - ${currencySymbol}${job.salary_max.toLocaleString()}`;
                              else if (job.salary_min) salaryText = `${currencySymbol}${job.salary_min.toLocaleString()}+`;
                              else if (job.salary_max) salaryText = `Up to ${currencySymbol}${job.salary_max.toLocaleString()}`;
                            }
                            if (!salaryText) {
                              const raw = (job as any)?.raw_data;
                              const salary = (raw?.scraped_data?.salary || raw?.salaryRange || raw?.salary) as string | undefined;
                              if (salary) salaryText = salary;
                            }

                            const metaTiles = [
                              job.location ? { label: 'Location', value: job.location } : null,
                              job.remote_type ? { label: 'Remote', value: job.remote_type } : null,
                              employmentType ? { label: 'Type', value: employmentType } : null,
                              experienceLevel ? { label: 'Level', value: experienceLevel } : null,
                              deadlineMeta ? { label: 'Deadline', value: deadlineMeta.label, tone: deadlineMeta.level } : null,
                              salaryText ? { label: 'Compensation', value: salaryText } : null,
                            ].filter(Boolean) as { label: string; value: string; tone?: 'urgent' | 'soon' | 'future' }[];

                            return (
                              <Card id="jobs-ai-match" data-tour="jobs-ai-match" className="relative overflow-hidden border border-[#1dff00]/20 bg-gradient-to-br from-[#030303] via-[#050505] to-[#0a160a] p-6">
                                <span className="pointer-events-none absolute -top-24 -right-12 h-56 w-56 rounded-full bg-[#1dff00]/20 blur-3xl opacity-60" />
                                <div className="relative flex flex-col gap-6">
                                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
                                    <div className="flex items-start gap-4 flex-1 min-w-0">
                                      {job.logoUrl && !logoError[job.id] ? (
                                        <img
                                          src={job.logoUrl}
                                          alt={job.company}
                                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-contain bg-white"
                                          onError={() => setLogoError(e => ({ ...e, [job.id]: true }))}
                                        />
                                      ) : (
                                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-2xl flex items-center justify-center text-black font-bold text-2xl">
                                          {job.logo}
                                        </div>
                                      )}
                                      <div className="flex-1 min-w-0 space-y-2">
                                        <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-[#1dff00]/80">
                                          <Sparkles className="w-3 h-3" />
                                          Featured Job
                                        </div>
                                        <h1 className="text-xl sm:text-2xl font-semibold text-white leading-tight">{job.title}</h1>
                                        <div className="flex flex-wrap items-center gap-2 text-sm text-[#ffffffc0]">
                                          <span className="font-medium text-white/90">{job.company}</span>
                                          {siteHost && (
                                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/60" title={primaryHref || undefined}>
                                              {ico && <img src={ico} alt="" className="w-3 h-3 rounded" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />}
                                              {siteHost}
                                            </span>
                                          )}
                                          {job.posted_at && (
                                            <span className="text-[11px] px-2 py-1 rounded-full border border-white/10 text-white/50 bg-white/5">
                                              Posted {formatRelative(job.posted_at)}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    {primaryHref && (
                                      <a
                                        href={primaryHref}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 rounded-lg border border-[#1dff00]/50 bg-[#1dff00]/15 px-4 py-2 text-sm font-medium text-[#1dff00] transition hover:bg-[#1dff00]/25 hover:shadow-[0_10px_30px_rgba(29,255,0,0.2)]"
                                      >
                                        View Posting
                                      </a>
                                    )}
                                  </div>

                                  {metaTiles.length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      {metaTiles.map((tile) => (
                                        <div
                                          key={`${tile.label}-${tile.value}`}
                                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-3"
                                        >
                                          <div className="text-[11px] uppercase tracking-wide text-white/40">{tile.label}</div>
                                          <div className={`text-sm font-medium ${tile.tone === 'urgent' ? 'text-[#ff8b8b]' : tile.tone === 'soon' ? 'text-[#ffd78b]' : tile.tone === 'future' ? 'text-[#8bffb1]' : 'text-white/85'}`}>{tile.value}</div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </Card>
                            );
                          })()}

                          <Card className="border border-white/12 bg-gradient-to-b from-[#0c0c0c] via-[#060606] to-[#020202] p-6">
                            <div className="flex items-center justify-between mb-4">
                              <div className="inline-flex items-center gap-2 text-sm font-medium text-white/80">
                                <FileText className="w-4 h-4 text-[#1dff00]" />
                                Job Description
                              </div>
                              <span className="text-[11px] uppercase tracking-wide text-white/35">Full brief</span>
                            </div>
                            <div className="prose prose-invert max-w-none text-[#ffffffcc] leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHtml(job.description || '') }} />
                          </Card>

                          {/* AI Match Score Card - Always show for testing */}
                          <MatchScorePieChart
                            score={typeof job.matchScore === 'number' ? job.matchScore : 75}
                            summary={job.matchSummary || "Match score analysis"}
                            breakdown={job.matchBreakdown}
                          />

                          {(() => {
                            const screenshot = (job as any)?.raw_data?.screenshot;
                            if (!screenshot) return null;
                            return (
                              <Card className="relative overflow-hidden border border-white/12 bg-[#020202] p-0">
                                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
                                  <div className="inline-flex items-center gap-2 text-sm font-medium text-white/75">
                                    <Sparkles className="w-4 h-4 text-[#1dff00]" />
                                    Screenshot
                                  </div>
                                  <span className="text-[11px] uppercase tracking-wide text-white/35">Visual preview</span>
                                </div>
                                <div className="relative bg-[#050505]">
                                  <img
                                    src={screenshot}
                                    alt="Job page screenshot"
                                    className="w-full h-auto"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                      const parent = target.parentElement;
                                      if (parent) {
                                        parent.innerHTML = '<div class="p-6 text-center text-[#ffffff60] text-sm">Screenshot unavailable</div>';
                                      }
                                    }}
                                  />
                                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/50" />
                                </div>
                              </Card>
                            );
                          })()}

                          {(() => {
                            const sources = (job as any)?.raw_data?._sources;
                            if (!sources || (Array.isArray(sources) && sources.length === 0)) return null;
                            const items: any[] = Array.isArray(sources) ? sources : [sources];
                            return (
                              <Card className="border border-white/12 bg-gradient-to-br from-[#050505] via-[#040404] to-[#010101] p-6">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="inline-flex items-center gap-2 text-sm font-medium text-white/75">
                                    <ShieldCheck className="w-4 h-4 text-[#1dff00]" />
                                    Source Intelligence
                                  </div>
                                  <span className="text-[11px] uppercase tracking-wide text-white/35">Captured links</span>
                                </div>
                                <ul className="space-y-2">
                                  {items.map((s, i) => {
                                    const href = typeof s === 'string' ? s : (s?.url || s?.source || '');
                                    if (!href) return null;
                                    const host = getHost(href);
                                    const ico = host ? `https://icons.duckduckgo.com/ip3/${host}.ico` : '';
                                    return (
                                      <li key={i} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                                        <div className="flex items-center gap-2">
                                          {host && <img src={ico} alt="" className="w-4 h-4 rounded" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />}
                                          <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm text-[#1dff00] hover:underline">
                                            {host || href}
                                          </a>
                                        </div>
                                        <span className="text-[11px] uppercase tracking-wide text-white/30">Open</span>
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
              {queueStatus === 'populating' && !selectedJob && (
                <div className="animate-pulse">
                  <Card className="relative overflow-hidden bg-gradient-to-br from-[#ffffff08] to-[#ffffff05] border border-[#ffffff15] p-6 mb-6">
                    <div className="flex items-start gap-4 mb-6">
                      <div className="w-16 h-16 bg-[#ffffff1a] rounded-xl" />
                      <div className="flex-1 min-w-0">
                        <div className="h-5 bg-[#ffffff1a] rounded w-1/2 mb-2" />
                        <div className="h-4 bg-[#ffffff12] rounded w-1/3 mb-3" />
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-4 w-20 rounded-full bg-[#ffffff12]" />
                          <span className="inline-block h-4 w-16 rounded-full bg-[#ffffff12]" />
                          <span className="inline-block h-4 w-24 rounded-full bg-[#ffffff12]" />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 bg-[#ffffff12] rounded w-full" />
                      <div className="h-4 bg-[#ffffff0f] rounded w-11/12" />
                      <div className="h-4 bg-[#ffffff0a] rounded w-10/12" />
                      <div className="h-4 bg-[#ffffff08] rounded w-9/12" />
                    </div>
                  </Card>
                </div>
              )}
              {!selectedJob && queueStatus === 'ready' && (
                   <Card className="bg-gradient-to-br from-[#ffffff08] to-[#ffffff05] border border-[#ffffff15] p-8 text-center">
                      <Briefcase className="w-16 h-16 text-[#ffffff40] mx-auto mb-4" />
                      <h3 className="text-xl font-medium text-white mb-2">Select a job</h3>
                      <p className="text-[#ffffff60]">Choose a job from the list to view details</p>
                  </Card>
              )}
            </div>
          </div>
          {/* Auto Apply orchestration dialog */}
          <Modal
            open={resumeDialogOpen}
            onClose={() => { setResumeDialogOpen(false); setAutoApplyStep(1); }}
            title=""
            size="lg"
            side="center"
          >
            <div className="relative overflow-hidden rounded-2xl border border-[#1dff00]/20 bg-gradient-to-br from-[#040404] via-[#060606] to-[#0a0a0a] text-white">
              <div
                className="pointer-events-none absolute -top-32 right-0 h-72 w-72 rounded-full bg-[#1dff00]/20 blur-3xl opacity-40"
              />
              <div className="relative p-6 sm:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
                  <div className="space-y-3 max-w-xl">
                    <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.35em] text-[#1dff00]/80">
                      <Sparkles className="w-3 h-3" />
                      Auto Apply
                    </div>
                    <h3 className="text-xl sm:text-2xl font-semibold">Launch enterprise-grade automation</h3>
                    <p className="text-sm text-white/60">
                      Deploy applications across <span className="text-[#1dff00] font-medium">{visibleJobCount}</span> curated roles with governed pacing, telemetry, and resume intelligence.
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 text-right min-w-[150px]">
                    <div className="text-[11px] uppercase tracking-wide text-white/40">Jobs queued</div>
                    <div className="text-2xl font-semibold text-[#1dff00]">{visibleJobCount}</div>
                    {selectedResume && (
                      <div className="text-[11px] text-white/50 truncate max-w-[180px]">Resume • {selectedResume.name}</div>
                    )}
                    {selectedCoverLetter && (
                      <div className="text-[11px] text-white/50 truncate max-w-[180px]">Cover letter • {selectedCoverLetter.name}</div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  {autoApplySteps.map((step) => {
                    const status = step.id === autoApplyStep ? 'active' : step.id < autoApplyStep ? 'done' : 'pending';
                    return (
                      <div
                        key={step.id}
                        className={`flex-1 rounded-xl border p-3 sm:p-4 transition-all duration-300 ${
                              status === 'active'
                                ? 'border-[#1dff00]/60 bg-[#1dff00]/10 shadow-[0_0_18px_rgba(29,255,0,0.25)]'
                                : status === 'done'
                                ? 'border-[#1dff00]/30 bg-[#1dff00]/12 text-white/80'
                                : 'border-white/12 bg-white/[0.02] text-white/60'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {status === 'done' ? (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#1dff00] text-black">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] ${
                                status === 'active'
                                  ? 'border-[#1dff00]/70 text-[#1dff00]'
                                  : 'border-white/25 text-white/35'
                              }`}
                            >
                              0{step.id}
                            </span>
                          )}
                          <span>{step.label}</span>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-white/60">{step.description}</p>
                      </div>
                    );
                  })}
                </div>

                {autoApplyStep === 1 && (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <p className="text-sm text-white/60">Select the resume we attach to each submission. Align the resume with this search persona for the strongest signal.</p>
                      <a
                        href="/dashboard/resumes"
                        className="text-xs inline-flex items-center gap-1 text-[#1dff00] hover:text-[#a3ffb5]"
                      >
                        Manage resumes
                      </a>
                    </div>
                    <div className="max-h-72 overflow-y-auto pr-1 space-y-3">
                      {resumesLoading ? (
                        <div className="grid gap-3">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="rounded-xl border border-white/12 bg-white/[0.03] p-4 animate-pulse" />
                          ))}
                        </div>
                      ) : (Array.isArray(resumes) && resumes.length > 0 ? (
                        <div className="grid gap-3">
                          {resumes.map((r: any) => {
                            const selected = selectedResumeId === r.id;
                            return (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => setSelectedResumeId(r.id)}
                                className={`group relative flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition-all duration-300 ${
                                  selected
                                    ? 'border-[#1dff00]/60 bg-[#1dff00]/12 shadow-[0_0_16px_rgba(29,255,0,0.25)]'
                                    : 'border-white/12 bg-white/[0.02] hover:border-[#1dff00]/45 hover:bg-[#1dff00]/8'
                                }`}
                              >
                                <div className="min-w-0 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate text-sm font-medium text-white" title={r.name}>{r.name}</span>
                                    {r.is_favorite && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-[#1dff00]/40 text-[#1dff00] bg-[#1dff00]/10">Preferred</span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-white/60 truncate">
                                    {(r.file_ext || 'pdf').toUpperCase()} • {r.size ? `${Math.round(r.size/1024)} KB` : 'Size unknown'} • Updated {new Date(r.updated_at).toLocaleDateString()}
                                  </div>
                                </div>
                                <span
                                  className={`flex-shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full border ${
                                    selected
                                      ? 'border-[#1dff00]/70 bg-[#1dff00] text-black'
                                      : 'border-white/20 text-white/40 group-hover:border-[#1dff00]/50 group-hover:text-[#1dff00]'
                                  }`}
                                >
                                  {selected ? <Check className="w-4 h-4" /> : <FileText className="w-3.5 h-3.5" />}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center space-y-2">
                          <p className="text-sm text-white/70">No resumes found.</p>
                          <p className="text-xs text-white/50">Import a resume to personalise each application or proceed without an attachment.</p>
                          <a
                            href="/dashboard/resumes"
                            className="inline-flex items-center gap-2 text-[13px] px-4 py-2 rounded-lg border border-[#1dff00]/40 text-[#1dff00] bg-[#1dff00]/10 hover:bg-[#1dff00]/20 transition"
                          >
                            Manage resumes
                          </a>
                        </div>
                      ))}
                    </div>
                    <div className="pt-5 border-t border-white/12 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <p className="text-sm text-white/60">Optionally attach a cover letter from your library. We’ll pair it with each submission when available.</p>
                        <a
                          href="/dashboard/cover-letter"
                          className="text-xs inline-flex items-center gap-1 text-[#1dff00] hover:text-[#a3ffb5]"
                        >
                          Manage cover letters
                        </a>
                      </div>
                      <div className="max-h-60 overflow-y-auto pr-1 space-y-3">
                        {Array.isArray(coverLetterLibrary) && coverLetterLibrary.length > 0 ? (
                          <div className="grid gap-3">
                            <button
                              type="button"
                              onClick={() => setSelectedCoverLetterId(null)}
                              className={`group relative flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition-all duration-300 ${
                                !selectedCoverLetterId
                                  ? 'border-[#1dff00]/60 bg-[#1dff00]/12 shadow-[0_0_16px_rgba(29,255,0,0.25)]'
                                  : 'border-white/12 bg-white/[0.02] hover:border-[#1dff00]/45 hover:bg-[#1dff00]/8'
                              }`}
                            >
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="truncate text-sm font-medium text-white">No cover letter</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-white/15 text-white/60">Optional</span>
                                </div>
                                <div className="text-[11px] text-white/50">Proceed without attaching a letter.</div>
                              </div>
                              <span
                                className={`flex-shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full border ${
                                  !selectedCoverLetterId
                                    ? 'border-[#1dff00]/70 bg-[#1dff00] text-black'
                                    : 'border-white/20 text-white/40 group-hover:border-[#1dff00]/50 group-hover:text-[#1dff00]'
                                }`}
                              >
                                {!selectedCoverLetterId ? <Check className="w-4 h-4" /> : <FileText className="w-3.5 h-3.5" />}
                              </span>
                            </button>
                            {coverLetterLibrary.map((entry) => {
                              const selected = selectedCoverLetterId === entry.id;
                              const persona = [entry.data?.role, entry.data?.company].filter(Boolean).join(' • ');
                              let updatedLabel = '';
                              if (entry.updatedAt) {
                                try {
                                  updatedLabel = new Date(entry.updatedAt).toLocaleDateString();
                                } catch {
                                  updatedLabel = entry.updatedAt;
                                }
                              }
                              return (
                                <button
                                  key={entry.id}
                                  type="button"
                                  onClick={() => setSelectedCoverLetterId(entry.id)}
                                  className={`group relative flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition-all duration-300 ${
                                    selected
                                      ? 'border-[#1dff00]/60 bg-[#1dff00]/12 shadow-[0_0_16px_rgba(29,255,0,0.25)]'
                                      : 'border-white/12 bg-white/[0.02] hover:border-[#1dff00]/45 hover:bg-[#1dff00]/8'
                                  }`}
                                >
                                  <div className="min-w-0 space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="truncate text-sm font-medium text-white" title={entry.name}>{entry.name}</span>
                                      {entry.draft && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-white/20 text-white/60">Draft</span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-white/60 truncate">
                                      {persona ? persona : entry.draft ? 'Autosaved draft from builder' : 'Reusable cover letter template'}
                                    </div>
                                    {updatedLabel && (
                                      <div className="text-[10px] uppercase tracking-wide text-white/35">Updated {updatedLabel}</div>
                                    )}
                                  </div>
                                  <span
                                    className={`flex-shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full border ${
                                      selected
                                        ? 'border-[#1dff00]/70 bg-[#1dff00] text-black'
                                        : 'border-white/20 text-white/40 group-hover:border-[#1dff00]/50 group-hover:text-[#1dff00]'
                                    }`}
                                  >
                                    {selected ? <Check className="w-4 h-4" /> : <FileText className="w-3.5 h-3.5" />}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center space-y-2">
                            <p className="text-sm text-white/70">No cover letters found.</p>
                            <p className="text-xs text-white/50">Build a cover letter in the workspace to reuse it here or continue without one.</p>
                            <a
                              href="/dashboard/cover-letter"
                              className="inline-flex items-center gap-2 text-[13px] px-4 py-2 rounded-lg border border-[#1dff00]/40 text-[#1dff00] bg-[#1dff00]/10 hover:bg-[#1dff00]/20 transition"
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
                  <div className="grid gap-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="rounded-xl border border-[#1dff00]/35 bg-[#1dff00]/12 p-4 sm:p-5">
                        <div className="flex items-center gap-2 text-sm font-medium text-[#eaffea]">
                          <ShieldCheck className="w-4 h-4" />
                          Execution summary
                        </div>
                        <div className="mt-4 flex items-baseline gap-2">
                          <span className="text-3xl font-semibold text-[#1dff00]">{visibleJobCount}</span>
                          <span className="text-sm text-white/75">jobs targeted</span>
                        </div>
                        <p className="mt-3 text-xs text-white/70">Applications are sequenced with rate-limit awareness, logging telemetry to Diagnostics as each job is processed.</p>
                      </div>
                      <div className="rounded-xl border border-white/12 bg-white/[0.03] p-4 sm:p-5 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                          <FileText className="w-4 h-4 text-[#1dff00]" />
                          Resume payload
                        </div>
                        {selectedResume ? (
                          <div className="space-y-1 text-sm text-white/70">
                            <div className="text-white font-medium">{selectedResume.name}</div>
                            <div className="text-xs text-white/45 uppercase tracking-wide">
                              {(selectedResume.file_ext || 'pdf').toUpperCase()} • Updated {new Date(selectedResume.updated_at).toLocaleDateString()}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-white/60">No resume selected. Applications will submit without an attachment.</p>
                        )}
                        <div className="text-xs text-white/40">Analytics events record resume identifiers for downstream auditing.</div>
                        <div className="pt-4 border-t border-white/10 space-y-3">
                          <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                            <FileText className="w-4 h-4 text-[#1dff00]" />
                            Cover letter payload
                          </div>
                          {selectedCoverLetter ? (
                            <div className="space-y-1 text-sm text-white/70">
                              <div className="flex items-center gap-2">
                                <span className="text-white font-medium">{selectedCoverLetter.name}</span>
                                {selectedCoverLetter.draft && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-white/20 text-white/60">Draft</span>
                                )}
                              </div>
                              <div className="text-xs text-white/45 uppercase tracking-wide">
                                {[selectedCoverLetter.data?.role, selectedCoverLetter.data?.company].filter(Boolean).join(' • ') || 'Reusable letter asset'}
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-white/60">No cover letter selected. Automation proceeds without an attachment here.</p>
                          )}
                          <div className="text-xs text-white/40">We log cover letter selection for observability but keep attachments optional.</div>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/12 bg-white/[0.02] p-4 sm:p-5">
                      <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                        <Clock3 className="w-4 h-4 text-[#1dff00]" />
                        Runbook
                      </div>
                      <ul className="mt-3 space-y-2 text-sm text-white/70">
                        <li className="flex items-start gap-2">
                          <span className="mt-1 inline-flex h-1.5 w-1.5 rounded-full bg-[#1dff00]" />
                          <span>Sequential automation with intelligent retries; cancel anytime from Diagnostics.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="mt-1 inline-flex h-1.5 w-1.5 rounded-full bg-[#1dff00]" />
                          <span>Each job updates status to <span className="text-[#1dff00]">applied</span> and emits success or failure analytics.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="mt-1 inline-flex h-1.5 w-1.5 rounded-full bg-[#1dff00]" />
                          <span>We honour custom apply URLs and respect rate limits to avoid vendor throttling.</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-white/12">
                  <p className="text-xs text-white/50 flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#1dff00]" />
                    Automation respects existing filters and logs telemetry for audit trails.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      className="border border-transparent text-white/60 hover:text-white"
                      onClick={() => { setResumeDialogOpen(false); setAutoApplyStep(1); }}
                    >
                      Close
                    </Button>
                    {autoApplyStep === 2 && (
                      <Button
                        variant="outline"
                        className="border-white/20 text-white hover:border-white/40 hover:bg-white/10"
                        onClick={() => setAutoApplyStep(1)}
                      >
                        Back
                      </Button>
                    )}
                    <Button
                      className={`border border-[#1dff00]/50 text-[#1dff00] bg-[#1dff00]/15 hover:bg-[#1dff00]/25 ${autoApplyPrimaryDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={autoApplyPrimaryDisabled}
                      onClick={() => {
                        if (autoApplyStep === 1) {
                          if (canAdvanceFromStepOne) setAutoApplyStep(2);
                        } else if (canLaunchAutoApply) {
                          setResumeDialogOpen(false);
                          applyAllJobs();
                        }
                      }}
                    >
                      {autoApplyStep === 1 ? 'Continue' : 'Launch automation'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Modal>
        </div>
        {/* Mobile drawer */}
        {isMobile && selectedJob && (() => {
          const j = jobs.find(x => x.id === selectedJob);
          if (!j) return null;
          return (
            <Modal
              open={true}
              onClose={() => setSelectedJob(null)}
              title={j.title}
              size="xl"
              side="right"
            >
              <div className="-mx-1 space-y-3 pb-2">
                {(() => {
                  const primaryHref = j.apply_url || (j as any)?.raw_data?.sourceUrl || j.source_id;
                  const siteHost = primaryHref ? getHost(primaryHref) : '';
                  const ico = siteHost ? `https://icons.duckduckgo.com/ip3/${siteHost}.ico` : '';
                  const employmentType = (j as any)?.employment_type ?? (j as any)?.raw_data?.scraped_data?.employment_type;
                  const experienceLevel = (j as any)?.experience_level ?? (j as any)?.raw_data?.scraped_data?.experience_level;
                  const deadline = j.expires_at || (j as any)?.raw_data?.deadline || (j as any)?.raw_data?.applicationDeadline;
                  const deadlineMeta = deadline ? formatDeadlineMeta(deadline) : null;

                  let salaryText: string | null = null;
                  if (j.salary_min || j.salary_max || j.salary_currency) {
                    const currency = j.salary_currency || 'USD';
                    const currencySymbol = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency;
                    if (j.salary_min && j.salary_max) salaryText = `${currencySymbol}${j.salary_min.toLocaleString()} - ${currencySymbol}${j.salary_max.toLocaleString()}`;
                    else if (j.salary_min) salaryText = `${currencySymbol}${j.salary_min.toLocaleString()}+`;
                    else if (j.salary_max) salaryText = `Up to ${currencySymbol}${j.salary_max.toLocaleString()}`;
                  }
                  if (!salaryText) {
                    const raw = (j as any)?.raw_data;
                    const salary = (raw?.scraped_data?.salary || raw?.salaryRange || raw?.salary) as string | undefined;
                    if (salary) salaryText = salary;
                  }

                  const metaTiles = [
                    j.location ? { label: 'Location', value: j.location } : null,
                    j.remote_type ? { label: 'Remote', value: j.remote_type } : null,
                    employmentType ? { label: 'Type', value: employmentType } : null,
                    experienceLevel ? { label: 'Level', value: experienceLevel } : null,
                    deadlineMeta ? { label: 'Deadline', value: deadlineMeta.label, tone: deadlineMeta.level } : null,
                    salaryText ? { label: 'Comp', value: salaryText } : null,
                  ].filter(Boolean) as { label: string; value: string; tone?: 'urgent' | 'soon' | 'future' }[];

                  return (
                    <Card className="relative overflow-hidden border border-[#1dff00]/25 bg-gradient-to-br from-[#020202] via-[#040404] to-[#0a0a0a] p-5">
                      <span className="pointer-events-none absolute -top-20 -right-10 h-40 w-40 rounded-full bg-[#1dff00]/20 blur-3xl opacity-50" />
                      <div className="relative space-y-4">
                        <div className="flex items-start gap-3">
                          {j.logoUrl && !logoError[j.id] ? (
                            <img
                              src={j.logoUrl}
                              alt={j.company}
                              className="w-12 h-12 rounded-xl object-contain bg-white"
                              onError={() => setLogoError(e => ({ ...e, [j.id]: true }))}
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-xl flex items-center justify-center text-black font-bold text-lg">
                              {j.logo}
                            </div>
                          )}
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-[#1dff00]/70">
                              <Sparkles className="w-3 h-3" />
                              Featured Job
                            </div>
                            <div className="text-lg font-semibold text-white leading-tight">{j.title}</div>
                            <div className="flex flex-wrap items-center gap-2 text-[12px] text-white/70">
                              <span className="font-medium text-white/90">{j.company}</span>
                              {siteHost && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/50" title={primaryHref || undefined}>
                                  {ico && <img src={ico} alt="" className="w-3 h-3 rounded-sm" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />}
                                  {siteHost}
                                </span>
                              )}
                              {j.posted_at && (
                                <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-white/40">
                                  Posted {formatRelative(j.posted_at)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {metaTiles.length > 0 && (
                          <div className="grid grid-cols-2 gap-2">
                            {metaTiles.map((tile) => (
                              <div key={`${tile.label}-${tile.value}`} className="rounded-lg border border-white/10 bg-white/5 px-2 py-2">
                                <div className="text-[10px] uppercase tracking-wide text-white/40">{tile.label}</div>
                                <div className={`text-xs font-medium ${tile.tone === 'urgent' ? 'text-[#ff8b8b]' : tile.tone === 'soon' ? 'text-[#ffd78b]' : tile.tone === 'future' ? 'text-[#8bffb1]' : 'text-white/85'}`}>{tile.value}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        {primaryHref && (
                          <a
                            href={primaryHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#1dff00]/50 bg-[#1dff00]/15 px-3 py-2 text-[13px] font-medium text-[#1dff00] transition hover:bg-[#1dff00]/25"
                          >
                            View Posting
                          </a>
                        )}
                      </div>
                    </Card>
                  );
                })()}

                <Card className="border border-white/12 bg-gradient-to-b from-[#0c0c0c] via-[#050505] to-[#020202] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="inline-flex items-center gap-2 text-sm font-medium text-white/80">
                      <FileText className="w-4 h-4 text-[#1dff00]" />
                      Job Description
                    </div>
                    <span className="text-[10px] uppercase tracking-wide text-white/35">Full brief</span>
                  </div>
                  <div className="prose prose-invert max-w-none text-[#ffffffcc] leading-relaxed text-[13px]" dangerouslySetInnerHTML={{ __html: sanitizeHtml(j.description || '') }} />
                </Card>

                {/* AI Match Score Card - Mobile - Always show for testing */}
                <MatchScorePieChart
                  score={typeof j.matchScore === 'number' ? j.matchScore : 75}
                  summary={j.matchSummary || "Match score analysis"}
                  breakdown={j.matchBreakdown}
                />

                {(() => {
                  const screenshot = (j as any)?.raw_data?.screenshot;
                  if (!screenshot) return null;
                  return (
                    <Card className="border border-white/12 bg-[#020202] p-0 overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/5">
                        <div className="inline-flex items-center gap-2 text-xs font-medium text-white/70">
                          <Sparkles className="w-3 h-3 text-[#1dff00]" />
                          Screenshot
                        </div>
                        <span className="text-[10px] uppercase tracking-wide text-white/35">Preview</span>
                      </div>
                      <div className="relative bg-[#050505]">
                        <img
                          src={screenshot}
                          alt="Job page screenshot"
                          className="w-full h-auto"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) parent.innerHTML = '<div class="p-4 text-center text-[#ffffff60] text-sm">Screenshot unavailable</div>';
                          }}
                        />
                        <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/50" />
                      </div>
                    </Card>
                  );
                })()}

                {(() => {
                  const sources = (j as any)?.raw_data?._sources;
                  if (!sources || (Array.isArray(sources) && sources.length === 0)) return null;
                  const items: any[] = Array.isArray(sources) ? sources : [sources];
                  return (
                    <Card className="border border-white/12 bg-gradient-to-br from-[#040404] via-[#030303] to-[#010101] p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="inline-flex items-center gap-2 text-xs font-medium text-white/70">
                          <ShieldCheck className="w-3 h-3 text-[#1dff00]" />
                          Source Intelligence
                        </div>
                        <span className="text-[10px] uppercase tracking-wide text-white/30">Captured links</span>
                      </div>
                      <ul className="space-y-2">
                        {items.map((s, i) => {
                          const href = typeof s === 'string' ? s : (s?.url || s?.source || '');
                          if (!href) return null;
                          const host = getHost(href);
                          const ico = host ? `https://icons.duckduckgo.com/ip3/${host}.ico` : '';
                          return (
                            <li key={i} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                              <div className="flex items-center gap-2">
                                {host && <img src={ico} alt="" className="w-4 h-4 rounded" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />}
                                <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm text-[#1dff00] hover:underline">
                                  {host || href}
                                </a>
                              </div>
                              <span className="text-[10px] uppercase tracking-wide text-white/30">Open</span>
                            </li>
                          );
                        })}
                      </ul>
                    </Card>
                  );
                })()}
                <div className="px-1 pt-1">
                  <Button
                    variant="ghost"
                    className="w-full rounded-lg border border-white/15 bg-white/5 text-white/70 hover:text-white hover:bg-white/10"
                    onClick={() => setSelectedJob(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </Modal>
          );
        })()}
      </div>
    );
  };