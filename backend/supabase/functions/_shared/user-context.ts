
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface UserContext {
  userId: string;
  name: string;
  email: string;
  resumeSummary: string | null;
  recentChatTitles: string[];
  subscriptionTier: string;
  credits: number;
  recentApplications: { job_title: string; company: string; status: string }[];
  recentCoverLetters: { name: string; role: string | null; company: string | null }[];
  resumes: { name: string; status: string }[];
}

/**
 * Fetches user context from Supabase for Ask mode RAG.
 * Returns a formatted string ready to inject into system prompts.
 */
export async function fetchUserContext(userId: string, authHeader: string): Promise<UserContext> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Parallel fetches for speed
  const [
    profileRes,
    resumeRes,
    chatsRes,
    creditsRes,
    appsRes,
    coversRes,
    resumesRes
  ] = await Promise.all([
    supabase.from("profiles").select("first_name, last_name, job_title").eq("id", userId).single(),
    supabase.from("parsed_resumes").select("json").eq("user_id", userId).order("extracted_at", { ascending: false }).limit(1).single(),
    supabase.from("chat_sessions").select("title").eq("user_id", userId).order("updated_at", { ascending: false }).limit(5),
    supabase.from("user_credits").select("balance").eq("user_id", userId).single(),
    supabase.from("applications").select("job_title, company, status").eq("user_id", userId).order("updated_at", { ascending: false }).limit(5),
    supabase.from("cover_letters").select("name, role, company").eq("user_id", userId).order("updated_at", { ascending: false }).limit(3),
    supabase.from("resumes").select("name, status").eq("user_id", userId).order("updated_at", { ascending: false }).limit(3)
  ]);

  // Build resume summary string from JSON blob
  let resumeSummary = null;
  if (resumeRes.data?.json) {
    const data = resumeRes.data.json;
    const parts = [];
    
    if (data.summary) parts.push(data.summary);
    if (data.skills?.length) parts.push(`Skills: ${data.skills.slice(0, 10).join(", ")}`);
    
    // Handle experience array from JSON
    if (Array.isArray(data.experience) && data.experience.length > 0) {
      const recentJob = data.experience[0];
      if (recentJob?.title && recentJob?.company) {
        parts.push(`Most recent role: ${recentJob.title} at ${recentJob.company}`);
      }
    }
    
    resumeSummary = parts.join(". ");
  }

  const name = profileRes.data 
    ? `${profileRes.data.first_name || ""} ${profileRes.data.last_name || ""}`.trim() || "User"
    : "User";

  return {
    userId,
    name,
    email: "", // Not strictly needed for context
    resumeSummary,
    recentChatTitles: chatsRes.data?.map(c => c.title) || [],
    subscriptionTier: "Free", // Default if not found
    credits: creditsRes.data?.balance || 0,
    recentApplications: appsRes.data || [],
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
    `- Credits: ${context.credits}`,
  ];

  if (context.resumeSummary) {
    lines.push(`\n## Resume Summary`);
    lines.push(context.resumeSummary);
  }

  if (context.recentApplications.length > 0) {
    lines.push(`\n## Recent Job Applications`);
    context.recentApplications.forEach(app => {
      lines.push(`- ${app.job_title} at ${app.company} (${app.status})`);
    });
  }

  if (context.recentCoverLetters.length > 0) {
    lines.push(`\n## Recent Cover Letters`);
    context.recentCoverLetters.forEach(cl => {
      lines.push(`- ${cl.name} (For: ${cl.role || 'General'} at ${cl.company || 'Unknown'})`);
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
