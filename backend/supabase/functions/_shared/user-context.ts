
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface UserContext {
  userId: string;
  name: string;
  email: string;
  resumeSummary: string | null;
  recentChatTitles: string[];
  subscriptionTier: string;
  credits: number;
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

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, job_title")
    .eq("id", userId)
    .single();

  // Fetch latest parsed resume structured data
  const { data: resume } = await supabase
    .from("parsed_resumes")
    .select("json")
    .eq("user_id", userId)
    .order("extracted_at", { ascending: false })
    .limit(1)
    .single();

  // Fetch recent chat titles
  const { data: chats } = await supabase
    .from("chat_sessions")
    .select("title")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(5);

  // Fetch user credits
  const { data: credits } = await supabase
    .from("user_credits")
    .select("balance")
    .eq("user_id", userId)
    .single();

  // Build resume summary string from JSON blob
  let resumeSummary = null;
  if (resume?.json) {
    const data = resume.json;
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

  const name = profile 
    ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "User"
    : "User";

  return {
    userId,
    name: profile?.full_name || "User",
    email: profile?.email || "",
    resumeSummary,
    recentChatTitles: chats?.map(c => c.title) || [],
    subscriptionTier: profile?.subscription_tier || "Free",
    credits: credits?.balance || 0,
  };
}

/**
 * Formats user context into a system prompt injection string.
 */
export function formatUserContextForPrompt(context: UserContext): string {
  const lines = [
    `## User Information`,
    `- Name: ${context.name}`,
    `- Subscription: ${context.subscriptionTier}`,
    `- Credits: ${context.credits}`,
  ];

  if (context.resumeSummary) {
    lines.push(`\n## Resume Summary`);
    lines.push(context.resumeSummary);
  }

  if (context.recentChatTitles.length > 0) {
    lines.push(`\n## Recent Conversations`);
    context.recentChatTitles.forEach((title, i) => {
      lines.push(`${i + 1}. ${title}`);
    });
  }

  return lines.join("\n");
}
