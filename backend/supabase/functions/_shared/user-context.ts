
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  fetchAnswerBankEntries,
  formatAnswerBankForPrompt,
} from "./answer-bank.ts";
import { fetchCandidateMemory } from "./candidate-memory.ts";

export interface UserContext {
  userId: string;
  name: string;
  email: string;
  headline: string | null;
  resumeSummary: string | null;
  candidateMemorySummary: string | null;
  answerBankSummary: string | null;
  publicProfileSite: {
    slug: string;
    is_public: boolean;
    theme: string;
    headline: string | null;
    intro: string | null;
    public_url: string | null;
    views: number;
  } | null;
  recentChatTitles: string[];
  /** Canonical tier from get_user_tier (may be overridden in ai-chat by gate). */
  subscriptionTier: string;
  /** Active subscription row status, e.g. active. */
  subscriptionStatus: string | null;
  subscriptionCurrentPeriodStart: string | null;
  subscriptionCurrentPeriodEnd: string | null;
  subscriptionCancelAtPeriodEnd: boolean;
  /** Inferred from period length (monthly / quarterly / yearly). */
  subscriptionBillingCycle: "monthly" | "quarterly" | "yearly" | null;
  /**
   * Next important date: if cancel_at_period_end, when access ends; otherwise projected next renewal
   * when current_period_end was stale (matches Billing page logic).
   */
  subscriptionNextRenewalOrEndIso: string | null;
  /** Whole days until subscriptionNextRenewalOrEnd (can be negative if the date is in the past). */
  subscriptionDaysRemaining: number | null;
  /** Paid AI credit balance from user_credits. Does not include subscription chat quota. */
  credits: number;
  chatFreeRemaining: number;
  chatFreeTotal: number;
  chatPaidCreditBalance: number;
  chatPlanName: string | null;
  applicationCount: number;
  jobCount: number;
  resumeCount: number;
  recentApplications: { job_title: string; company: string; status: string }[];
  recentJobs: { title: string; company: string; created_at?: string | null }[];
  recentCoverLetters: { name: string; role: string | null; company: string | null; content: string | null }[];
  resumes: { name: string; status: string }[];
  profileExperiences: Array<{
    id: string;
    title: string;
    company: string;
    location: string | null;
    start_date: string;
    end_date: string | null;
    is_current: boolean;
    description: string | null;
  }>;
  profileEducation: Array<{
    id: string;
    degree: string;
    school: string;
    location: string | null;
    start_date: string;
    end_date: string | null;
    gpa: string | null;
  }>;
  activeResumeExperiences?: Array<{
    company: string;
    title: string;
    location: string | null;
    startDate: string | null;
    endDate: string | null;
    description: string | null;
  }>;
  activeResumeEducation?: Array<{
    school: string;
    degree: string;
    startDate: string | null;
    endDate: string | null;
  }>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asNumber = (value: unknown): number | null => {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item));
};

const asRecordArray = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item),
  );
};

const uniqueStrings = (values: Array<string | null | undefined>) =>
  [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))];

const PUBLIC_PROFILE_BASE_URL =
  Deno.env.get("PUBLIC_APP_URL") ||
  Deno.env.get("APP_BASE_URL") ||
  "https://app.jobraker.io";

/** Match Billing page: period length → billing interval. */
function inferBillingCycleFromSubscriptionPeriod(
  start: string | null | undefined,
  end: string | null | undefined,
): "monthly" | "quarterly" | "yearly" | null {
  if (!start || !end) return null;
  const t0 = new Date(start).getTime();
  const t1 = new Date(end).getTime();
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) return null;
  const days = (t1 - t0) / (1000 * 60 * 60 * 24);
  if (days >= 200) return "yearly";
  if (days >= 75) return "quarterly";
  if (days >= 18) return "monthly";
  return null;
}

function addCalendarMonths(d: Date, months: number): Date {
  const out = new Date(d.getTime());
  out.setMonth(out.getMonth() + months);
  return out;
}

/** If period end is in the past, step forward by billing months until in the future (stale DB row). */
function projectNextRenewalDate(
  periodEnd: string | null,
  cycle: "monthly" | "quarterly" | "yearly" | null,
): Date | null {
  if (!periodEnd) return null;
  const d = new Date(periodEnd);
  if (!Number.isFinite(d.getTime())) return null;
  const now = new Date();
  if (d > now) return d;
  if (!cycle) return d;
  const stepMonths = cycle === "yearly" ? 12 : cycle === "quarterly" ? 3 : 1;
  let projected = new Date(d);
  let i = 0;
  while (projected <= now && i < 120) {
    projected = addCalendarMonths(projected, stepMonths);
    i++;
  }
  return projected;
}

function wholeDaysUntil(targetIso: string | null): number | null {
  if (!targetIso) return null;
  const t = new Date(targetIso);
  if (!Number.isFinite(t.getTime())) return null;
  const now = new Date();
  return Math.ceil((t.getTime() - now.getTime()) / (86400 * 1000));
}

const safeQuery = async <T>(promise: Promise<T>, fallback: T): Promise<T> => {
  try {
    return await promise;
  } catch (error) {
    console.warn("user context query failed", error);
    return fallback;
  }
};

type ParsedResumeSnapshot = {
  summary: string | null;
  skills: string[];
  recentRole: string | null;
};

const extractParsedResumeSnapshot = (row: any): ParsedResumeSnapshot => {
  const jsonRecord = isRecord(row?.json) ? row.json : null;
  const aiParsedData = isRecord(jsonRecord?.aiParsedData)
    ? jsonRecord.aiParsedData
    : null;
  const structuredRecord = isRecord(row?.structured) ? row.structured : null;
  const experienceList = [
    ...asRecordArray(aiParsedData?.experience),
    ...asRecordArray(jsonRecord?.experience),
  ];
  const recentExperience = experienceList.find(
    (item) => asString(item.title) || asString(item.company),
  );
  const recentRoleParts = uniqueStrings([
    asString(recentExperience?.title),
    asString(recentExperience?.company)
      ? `at ${asString(recentExperience?.company)}`
      : null,
  ]);

  const summary = uniqueStrings([
    asString(aiParsedData?.about),
    asString(aiParsedData?.summary),
    asString(structuredRecord?.summary),
    asString(jsonRecord?.summary),
  ])[0] ?? null;
  const skills = uniqueStrings([
    ...asStringArray(aiParsedData?.skills),
    ...asStringArray(jsonRecord?.skills),
    ...asStringArray(row?.skills),
  ]);

  return {
    summary,
    skills,
    recentRole: recentRoleParts.join(" ") || null,
  };
};

/**
 * Fetches user context from Supabase for Ask mode RAG.
 * Returns a formatted string ready to inject into system prompts.
 */
export async function fetchUserContext(userId: string, authHeader: string): Promise<UserContext> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    },
  );

  // Parallel fetches for speed
  const candidateMemoryPromise = fetchCandidateMemory(supabase, userId).catch(() => null);
  const answerBankPromise = fetchAnswerBankEntries(supabase, userId, {
    limit: 12,
  }).catch(() => []);
  const [
    profileRes,
    resumeRes,
    chatsRes,
    creditsRes,
    chatQuotaRes,
    appsRes,
    jobsRes,
    coversRes,
    resumesRes,
    applicationCountRes,
    jobCountRes,
    resumeCountRes,
    tierRes,
    subscriptionRes,
    publicProfileSiteRes,
    profileExperiencesRes,
    profileEducationRes,
    candidateMemory,
    answerBankEntries,
  ] = await Promise.all([
    safeQuery(
      supabase
        .from("profiles")
        .select("first_name, last_name, job_title")
        .eq("id", userId)
        .maybeSingle(),
      { data: null } as any,
    ),
    safeQuery(
      supabase
        .from("parsed_resumes")
        .select("json, structured, skills")
        .eq("user_id", userId)
        .order("extracted_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      { data: null } as any,
    ),
    safeQuery(
      supabase
        .from("chat_sessions")
        .select("title")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(5),
      { data: [] } as any,
    ),
    safeQuery(
      supabase
        .from("user_credits")
        .select("balance")
        .eq("user_id", userId)
        .maybeSingle(),
      { data: null } as any,
    ),
    safeQuery(
      supabase.rpc("get_chat_quota_status", { p_user_id: userId }),
      { data: null } as any,
    ),
    safeQuery(
      supabase
        .from("applications")
        .select("job_title, company, status")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(5),
      { data: [] } as any,
    ),
    safeQuery(
      supabase
        .from("jobs")
        .select("title, company, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
      { data: [] } as any,
    ),
    safeQuery(
      supabase
        .from("cover_letters")
        .select("name, role, company, content")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(3),
      { data: [] } as any,
    ),
    safeQuery(
      supabase
        .from("resumes")
        .select("name, status")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(3),
      { data: [] } as any,
    ),
    safeQuery(
      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      { count: 0 } as any,
    ),
    safeQuery(
      supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      { count: 0 } as any,
    ),
    safeQuery(
      supabase
        .from("resumes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      { count: 0 } as any,
    ),
    safeQuery(
      supabase.rpc("get_user_tier", { p_user_id: userId }),
      { data: null } as any,
    ),
    safeQuery(
      supabase
        .from("user_subscriptions")
        .select(
          "status, current_period_start, current_period_end, cancel_at_period_end, subscription_plans(name)",
        )
        .eq("user_id", userId)
        .eq("status", "active")
        .gt("current_period_end", new Date().toISOString())
        .maybeSingle(),
      { data: null } as any,
    ),
    safeQuery(
      supabase
        .from("public_profile_sites")
        .select("slug, is_public, theme, headline, intro, views")
        .eq("user_id", userId)
        .maybeSingle(),
      { data: null } as any,
    ),
    safeQuery(
      supabase
        .from("profile_experiences")
        .select("id, title, company, location, start_date, end_date, is_current, description")
        .eq("user_id", userId)
        .order("start_date", { ascending: false }),
      { data: [] } as any,
    ),
    safeQuery(
      supabase
        .from("profile_education")
        .select("id, degree, school, location, start_date, end_date, gpa")
        .eq("user_id", userId)
        .order("start_date", { ascending: false }),
      { data: [] } as any,
    ),
    candidateMemoryPromise,
    answerBankPromise,
  ]);

  const parsedResume = extractParsedResumeSnapshot(resumeRes.data);
  const resumeSummaryParts = uniqueStrings([
    parsedResume.summary,
    parsedResume.skills.length > 0
      ? `Skills: ${parsedResume.skills.slice(0, 12).join(", ")}`
      : null,
    parsedResume.recentRole ? `Most recent role: ${parsedResume.recentRole}` : null,
  ]);
  const resumeSummary = resumeSummaryParts.join(". ") || null;

  const name = profileRes.data 
    ? `${profileRes.data.first_name || ""} ${profileRes.data.last_name || ""}`.trim() || "User"
    : "User";

  const rawTier =
    typeof (tierRes as { data?: unknown })?.data === "string"
      ? String((tierRes as { data: string }).data)
      : "Free";

  const sub = subscriptionRes.data as
    | {
        status?: string;
        current_period_start?: string;
        current_period_end?: string;
        cancel_at_period_end?: boolean;
        subscription_plans?: { name?: string } | { name?: string }[] | null;
      }
    | null
    | undefined;

  let subscriptionStatus: string | null = null;
  let subscriptionCurrentPeriodStart: string | null = null;
  let subscriptionCurrentPeriodEnd: string | null = null;
  let subscriptionCancelAtPeriodEnd = false;
  let subscriptionBillingCycle: "monthly" | "quarterly" | "yearly" | null = null;
  let subscriptionNextRenewalOrEndIso: string | null = null;
  let subscriptionDaysRemaining: number | null = null;
  const chatQuota = isRecord(chatQuotaRes.data) ? chatQuotaRes.data : {};
  const chatPaidCreditBalance =
    asNumber(chatQuota.credit_balance) ??
    asNumber(creditsRes.data?.balance) ??
    0;
  const chatFreeRemaining = asNumber(chatQuota.free_remaining) ?? 0;
  const chatFreeTotal = asNumber(chatQuota.free_total) ?? 0;
  const chatPlanName = asString(chatQuota.plan_name);
  const publicProfileSiteRow = isRecord(publicProfileSiteRes.data)
    ? publicProfileSiteRes.data
    : null;
  const publicProfileSlug = asString(publicProfileSiteRow?.slug);
  const publicProfileSite = publicProfileSlug
    ? {
        slug: publicProfileSlug,
        is_public: publicProfileSiteRow?.is_public === true,
        theme: asString(publicProfileSiteRow?.theme) || "obsidian",
        headline: asString(publicProfileSiteRow?.headline),
        intro: asString(publicProfileSiteRow?.intro),
        public_url: `${PUBLIC_PROFILE_BASE_URL.replace(/\/$/, "")}/u/${publicProfileSlug}`,
        views: asNumber(publicProfileSiteRow?.views) ?? 0,
      }
    : null;

  const periodEnd = asString(sub?.current_period_end);
  if (sub && periodEnd) {
    subscriptionStatus = asString(sub.status) || null;
    subscriptionCurrentPeriodStart = asString(sub.current_period_start);
    subscriptionCurrentPeriodEnd = periodEnd;
    subscriptionCancelAtPeriodEnd = sub.cancel_at_period_end === true;
    subscriptionBillingCycle = inferBillingCycleFromSubscriptionPeriod(
      subscriptionCurrentPeriodStart || undefined,
      subscriptionCurrentPeriodEnd || undefined,
    );
    if (subscriptionCancelAtPeriodEnd) {
      subscriptionNextRenewalOrEndIso = periodEnd;
    } else {
      subscriptionNextRenewalOrEndIso = periodEnd;
    }
    subscriptionDaysRemaining = wholeDaysUntil(subscriptionNextRenewalOrEndIso);
  }

  // Extract detailed experience and education lists from the active resume
  const jsonRecord = isRecord(resumeRes.data?.json) ? resumeRes.data.json : null;
  const aiParsedData = isRecord(jsonRecord?.aiParsedData)
    ? jsonRecord.aiParsedData
    : null;
  const structuredRecord = isRecord(resumeRes.data?.structured)
    ? resumeRes.data.structured
    : null;

  const activeResumeExperiences: Array<{
    company: string;
    title: string;
    location: string | null;
    startDate: string | null;
    endDate: string | null;
    description: string | null;
  }> = [];

  const rawExperiences = [
    ...asRecordArray(aiParsedData?.experience),
    ...asRecordArray(jsonRecord?.experience),
    ...asRecordArray(jsonRecord?.sections?.experience?.items),
    ...asRecordArray(structuredRecord?.experience),
  ];

  const seenExp = new Set<string>();
  for (const item of rawExperiences) {
    const company = asString(item.company || item.organization) || "";
    const title = asString(item.position || item.title || item.name) || "";
    const location = asString(item.location) || null;
    const startDate = asString(item.startDate || item.start_date || item.start || item.date || item.period) || null;
    const endDate = asString(item.endDate || item.end_date || item.end) || null;
    const description = asString(item.description || item.summary || item.content) || null;

    if (company || title) {
      const key = `${company.toLowerCase()}|${title.toLowerCase()}`;
      if (!seenExp.has(key)) {
        seenExp.add(key);
        activeResumeExperiences.push({ company, title, location, startDate, endDate, description });
      }
    }
  }

  const activeResumeEducation: Array<{
    school: string;
    degree: string;
    startDate: string | null;
    endDate: string | null;
  }> = [];

  const rawEducation = [
    ...asRecordArray(aiParsedData?.education),
    ...asRecordArray(jsonRecord?.education),
    ...asRecordArray(jsonRecord?.sections?.education?.items),
    ...asRecordArray(structuredRecord?.education),
  ];

  const seenEdu = new Set<string>();
  for (const item of rawEducation) {
    const school = asString(item.school || item.company || item.institution || item.university) || "";
    const degree = asString(item.degree || item.title || item.name || item.course) || "";
    const startDate = asString(item.startDate || item.start_date || item.start || item.date || item.period) || null;
    const endDate = asString(item.endDate || item.end_date || item.end) || null;

    if (school || degree) {
      const key = `${school.toLowerCase()}|${degree.toLowerCase()}`;
      if (!seenEdu.has(key)) {
        seenEdu.add(key);
        activeResumeEducation.push({ school, degree, startDate, endDate });
      }
    }
  }

  return {
    userId,
    name,
    email: "", // Not strictly needed for context
    headline: profileRes.data?.job_title || null,
    resumeSummary,
    candidateMemorySummary: candidateMemory?.summaryText || null,
    answerBankSummary: formatAnswerBankForPrompt(answerBankEntries, 12),
    publicProfileSite,
    recentChatTitles: chatsRes.data?.map(c => c.title) || [],
    subscriptionTier: rawTier,
    subscriptionStatus,
    subscriptionCurrentPeriodStart,
    subscriptionCurrentPeriodEnd,
    subscriptionCancelAtPeriodEnd,
    subscriptionBillingCycle,
    subscriptionNextRenewalOrEndIso,
    subscriptionDaysRemaining,
    credits: chatPaidCreditBalance,
    chatFreeRemaining,
    chatFreeTotal,
    chatPaidCreditBalance,
    chatPlanName,
    applicationCount: applicationCountRes.count || 0,
    jobCount: jobCountRes.count || 0,
    resumeCount: resumeCountRes.count || 0,
    recentApplications: appsRes.data || [],
    recentJobs: jobsRes.data || [],
    recentCoverLetters: coversRes.data || [],
    resumes: resumesRes.data || [],
    profileExperiences: profileExperiencesRes.data || [],
    profileEducation: profileEducationRes.data || [],
    activeResumeExperiences,
    activeResumeEducation,
  };
}

/**
 * Formats user context into a system prompt injection string.
 */
export function formatUserContextForPrompt(context: UserContext): string {
  const lines = [
    `## User Information`,
    `- Name: ${context.name}`,
    `- Headline: ${context.headline || "Not set"}`,
    `- Plan / tier: ${context.subscriptionTier}`,
    `- Paid AI credits: ${context.chatPaidCreditBalance}`,
    `- Included AI chat messages remaining this period: ${context.chatFreeRemaining} / ${context.chatFreeTotal}`,
    `- Total available AI chat turns before purchase: ${
      context.chatFreeRemaining + context.chatPaidCreditBalance
    }`,
    `- Total applications: ${context.applicationCount}`,
    `- Total tracked jobs: ${context.jobCount}`,
    `- Total resumes: ${context.resumeCount}`,
  ];

  lines.push(`\n## Subscription & billing (from JobRaker database — use for renewal / days-left questions)`);
  if (context.subscriptionCurrentPeriodEnd) {
    lines.push(
      `- Status: ${context.subscriptionStatus || "active"}${
        context.subscriptionCancelAtPeriodEnd
          ? " (cancels at end of current period; no next charge unless you re-subscribe)"
          : " (renews automatically)"
      }`,
    );
    if (context.subscriptionCurrentPeriodStart) {
      lines.push(
        `- Current period: ${context.subscriptionCurrentPeriodStart} → ${context.subscriptionCurrentPeriodEnd}`,
      );
    } else {
      lines.push(`- Current period end: ${context.subscriptionCurrentPeriodEnd}`);
    }
    if (context.subscriptionBillingCycle) {
      lines.push(`- Inferred billing cycle from period length: ${context.subscriptionBillingCycle}`);
    }
    if (context.subscriptionNextRenewalOrEndIso) {
      const label = context.subscriptionCancelAtPeriodEnd
        ? "Access ends (or already ended) on"
        : "Next renewal or period boundary (approx.)";
      lines.push(`- ${label}: ${context.subscriptionNextRenewalOrEndIso}`);
    }
    if (context.subscriptionDaysRemaining != null) {
      lines.push(
        `- Calendar days until that date: ${context.subscriptionDaysRemaining} (0 = today, negative = past)`,
      );
    }
  } else {
    lines.push(
      `- No active subscription row with a period end in the database (tier may still be ${context.subscriptionTier} from your account record). For exact payment method or invoices, the Billing page may add detail.`,
    );
  }

  if (context.resumeSummary) {
    lines.push(`\n## Resume Summary`);
    lines.push(context.resumeSummary);
  }

  if (context.activeResumeExperiences && context.activeResumeExperiences.length > 0) {
    lines.push(`\n## Active Resume Experiences (Parsed from latest uploaded PDF resume)`);
    context.activeResumeExperiences.forEach(exp => {
      lines.push(`- Title: ${exp.title} at ${exp.company}`);
      if (exp.location) lines.push(`  Location: ${exp.location}`);
      if (exp.startDate || exp.endDate) {
        lines.push(`  Period: ${exp.startDate || "Unknown"} to ${exp.endDate || "Present"}`);
      }
      if (exp.description) lines.push(`  Description: ${exp.description}`);
    });
  }

  if (context.activeResumeEducation && context.activeResumeEducation.length > 0) {
    lines.push(`\n## Active Resume Education (Parsed from latest uploaded PDF resume)`);
    context.activeResumeEducation.forEach(edu => {
      lines.push(`- Degree: ${edu.degree} at ${edu.school}`);
      if (edu.startDate || edu.endDate) {
        lines.push(`  Period: ${edu.startDate || "Unknown"} to ${edu.endDate || "Present"}`);
      }
    });
  }

  if (context.candidateMemorySummary) {
    lines.push(`\n## Candidate Memory`);
    lines.push(context.candidateMemorySummary);
  }

  if (context.answerBankSummary) {
    lines.push(`\n## Answer Bank`);
    lines.push(context.answerBankSummary);
  }

  if (context.publicProfileSite) {
    lines.push(`\n## Public Profile Portfolio`);
    lines.push(
      `- Status: ${context.publicProfileSite.is_public ? "published" : "draft"}`,
    );
    lines.push(`- Theme: ${context.publicProfileSite.theme}`);
    lines.push(`- Share URL: ${context.publicProfileSite.public_url}`);
    if (context.publicProfileSite.headline) {
      lines.push(`- Headline: ${context.publicProfileSite.headline}`);
    }
    if (context.publicProfileSite.intro) {
      lines.push(`- Intro: ${context.publicProfileSite.intro}`);
    }
    lines.push(`- Views: ${context.publicProfileSite.views}`);
  }

  if (context.recentApplications.length > 0) {
    lines.push(`\n## Recent Job Applications`);
    context.recentApplications.forEach(app => {
      lines.push(`- ${app.job_title} at ${app.company} (${app.status})`);
    });
  }

  if (context.recentJobs.length > 0) {
    lines.push(`\n## Recent Tracked Jobs`);
    context.recentJobs.forEach((job) => {
      lines.push(`- ${job.title} at ${job.company}`);
    });
  }

  if (context.recentCoverLetters.length > 0) {
    lines.push(`\n## Recent Cover Letters`);
    context.recentCoverLetters.forEach(cl => {
      lines.push(`### ${cl.name}`);
      lines.push(`Target: ${cl.role || 'General'} at ${cl.company || 'Unknown'}`);
      if (cl.content) {
        lines.push(`Content:\n${cl.content.slice(0, 1500)}`); // Include up to 1500 chars of content
        if (cl.content.length > 1500) lines.push("...(truncated)");
      } else {
        lines.push(`Content: (Empty)`);
      }
      lines.push(``);
    });
  }

  if (context.resumes.length > 0) {
    lines.push(`\n## Available Resumes`);
    context.resumes.forEach(r => {
      lines.push(`- ${r.name} (${r.status})`);
    });
  }

  if (context.profileExperiences && context.profileExperiences.length > 0) {
    lines.push(`\n## Profile Experiences`);
    context.profileExperiences.forEach(exp => {
      lines.push(`- ID: ${exp.id} | ${exp.title} at ${exp.company} (${exp.start_date} to ${exp.is_current ? 'Present' : exp.end_date})`);
      if (exp.description) lines.push(`  Description: ${exp.description}`);
    });
  }

  if (context.profileEducation && context.profileEducation.length > 0) {
    lines.push(`\n## Profile Education`);
    context.profileEducation.forEach(edu => {
      lines.push(`- ID: ${edu.id} | ${edu.degree} at ${edu.school} (${edu.start_date} to ${edu.end_date || 'Present'})`);
    });
  }

  if (context.recentChatTitles.length > 0) {
    lines.push(`\n## Recent Conversations`);
    context.recentChatTitles.forEach((title, i) => {
      lines.push(`${i + 1}. ${title}`);
    });
  }

  return lines.join("\n");
}
