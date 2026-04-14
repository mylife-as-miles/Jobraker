import { createClient } from "npm:@supabase/supabase-js@2";
import { fetchCandidateMemory } from "./candidate-memory.ts";

export interface UserContext {
  userId: string;
  name: string;
  email: string;
  headline: string | null;
  resumeSummary: string | null;
  candidateMemorySummary: string | null;
  recentChatTitles: string[];
  subscriptionTier: string;
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
  const aiParsedData = isRecord(jsonRecord?.aiParsedData) ? jsonRecord.aiParsedData : null;
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
    asString(recentExperience?.company) ? `at ${asString(recentExperience?.company)}` : null,
  ]);

  const summary =
    uniqueStrings([
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

  return { summary, skills, recentRole: recentRoleParts.join(" ") || null };
};

export async function fetchUserContext(userId: string, authHeader: string): Promise<UserContext> {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });

  const candidateMemoryPromise = Promise.race([
    fetchCandidateMemory(supabase, userId).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
  ]);
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
    candidateMemory,
  ] = await Promise.all([
    safeQuery(
      supabase.from("profiles").select("first_name, last_name, job_title").eq("id", userId).maybeSingle(),
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
      supabase.from("chat_sessions").select("title").eq("user_id", userId).order("updated_at", { ascending: false }).limit(5),
      { data: [] } as any,
    ),
    safeQuery(
      supabase.from("user_credits").select("balance").eq("user_id", userId).maybeSingle(),
      { data: null } as any,
    ),
    safeQuery(
      supabase.from("applications").select("job_title, company, status").eq("user_id", userId).order("updated_at", { ascending: false }).limit(5),
      { data: [] } as any,
    ),
    safeQuery(
      supabase.from("jobs").select("title, company, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
      { data: [] } as any,
    ),
    safeQuery(
      supabase.from("cover_letters").select("name, role, company, content").eq("user_id", userId).order("updated_at", { ascending: false }).limit(3),
      { data: [] } as any,
    ),
    safeQuery(
      supabase.from("resumes").select("name, status").eq("user_id", userId).order("updated_at", { ascending: false }).limit(3),
      { data: [] } as any,
    ),
    safeQuery(
      supabase.from("applications").select("id", { count: "exact", head: true }).eq("user_id", userId),
      { count: 0 } as any,
    ),
    safeQuery(
      supabase.from("jobs").select("id", { count: "exact", head: true }).eq("user_id", userId),
      { count: 0 } as any,
    ),
    safeQuery(
      supabase.from("resumes").select("id", { count: "exact", head: true }).eq("user_id", userId),
      { count: 0 } as any,
    ),
    candidateMemoryPromise,
  ]);

  const parsedResume = extractParsedResumeSnapshot(resumeRes.data);
  const resumeSummaryParts = uniqueStrings([
    parsedResume.summary,
    parsedResume.skills.length > 0 ? `Skills: ${parsedResume.skills.slice(0, 12).join(", ")}` : null,
    parsedResume.recentRole ? `Most recent role: ${parsedResume.recentRole}` : null,
  ]);
  const resumeSummary = resumeSummaryParts.join(". ") || null;

  const name = profileRes.data
    ? `${profileRes.data.first_name || ""} ${profileRes.data.last_name || ""}`.trim() || "User"
    : "User";

  return {
    userId,
    name,
    email: "",
    headline: profileRes.data?.job_title || null,
    resumeSummary,
    candidateMemorySummary: candidateMemory?.summaryText || null,
    recentChatTitles: chatsRes.data?.map((c: any) => c.title) || [],
    subscriptionTier: "Free",
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

export function formatUserContextForPrompt(context: UserContext): string {
  const lines = [
    `## User Information`,
    `- Name: ${context.name}`,
    `- Headline: ${context.headline || "Not set"}`,
    `- Subscription tier: ${context.subscriptionTier}`,
    `- Credits: ${context.credits}`,
    `- Total applications: ${context.applicationCount}`,
    `- Total tracked jobs: ${context.jobCount}`,
    `- Total resumes: ${context.resumeCount}`,
  ];

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
    context.recentApplications.forEach((app) => {
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
    context.recentCoverLetters.forEach((cl) => {
      lines.push(`### ${cl.name}`);
      lines.push(`Target: ${cl.role || "General"} at ${cl.company || "Unknown"}`);
      if (cl.content) {
        lines.push(`Content:\n${cl.content.slice(0, 1500)}`);
        if (cl.content.length > 1500) lines.push("...(truncated)");
      } else {
        lines.push(`Content: (Empty)`);
      }
      lines.push(``);
    });
  }

  if (context.resumes.length > 0) {
    lines.push(`\n## Available Resumes`);
    context.resumes.forEach((r) => {
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
