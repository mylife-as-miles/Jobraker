
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchCandidateMemory } from "./candidate-memory.ts";

export interface UserContext {
  userId: string;
  name: string;
  email: string;
  headline: string | null;
  resumeSummary: string | null;
  candidateMemorySummary: string | null;
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
  credits: number;
  applicationCount: number;
  jobCount: number;
  resumeCount: number;
  recentApplications: { job_title: string; company: string; status: string }[];
  recentJobs: { title: string; company: string; created_at?: string | null }[];
  recentCoverLetters: { name: string; role: string | null; company: string | null; content: string | null }[];
  resumes: { name: string; status: string }[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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
  const [
    profileRes,
    resumeRes,
    chatsRes,
    creditsRes,
    appsRes,
    jobsRes,
    coversRes,
    resumesRes,
    applicationCountRes,
    jobCountRes,
    resumeCountRes,
    tierRes,
    subscriptionRes,
    candidateMemory,
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
        .maybeSingle(),
      { data: null } as any,
    ),
    candidateMemoryPromise,
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
      const projected = projectNextRenewalDate(periodEnd, subscriptionBillingCycle);
      subscriptionNextRenewalOrEndIso = projected
        ? projected.toISOString()
        : periodEnd;
    }
    subscriptionDaysRemaining = wholeDaysUntil(subscriptionNextRenewalOrEndIso);
  }

  return {
    userId,
    name,
    email: "", // Not strictly needed for context
    headline: profileRes.data?.job_title || null,
    resumeSummary,
    candidateMemorySummary: candidateMemory?.summaryText || null,
    recentChatTitles: chatsRes.data?.map(c => c.title) || [],
    subscriptionTier: rawTier,
    subscriptionStatus,
    subscriptionCurrentPeriodStart,
    subscriptionCurrentPeriodEnd,
    subscriptionCancelAtPeriodEnd,
    subscriptionBillingCycle,
    subscriptionNextRenewalOrEndIso,
    subscriptionDaysRemaining,
    credits: creditsRes.data?.balance || 0,
    applicationCount: applicationCountRes.count || 0,
    jobCount: jobCountRes.count || 0,
    resumeCount: resumeCountRes.count || 0,
    recentApplications: appsRes.data || [],
    recentJobs: jobsRes.data || [],
    recentCoverLetters: coversRes.data || [],
    resumes: resumesRes.data || [],
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
    `- Credits: ${context.credits}`,
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

  if (context.candidateMemorySummary) {
    lines.push(`\n## Candidate Memory`);
    lines.push(context.candidateMemorySummary);
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

  if (context.recentChatTitles.length > 0) {
    lines.push(`\n## Recent Conversations`);
    context.recentChatTitles.forEach((title, i) => {
      lines.push(`${i + 1}. ${title}`);
    });
  }

  return lines.join("\n");
}
