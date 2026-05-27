import { createClient } from "npm:@supabase/supabase-js@2";
import {
  createGeminiClient,
  GEMINI_MODEL,
  isGeminiRateLimitError,
  withGeminiRetry,
} from "../_shared/gemini.ts";
import { getCorsHeaders } from "../_shared/types.ts";
import {
  fetchUserContext,
  formatUserContextForPrompt,
  type UserContext,
} from "../_shared/user-context.ts";
import { APP_INTERFACE_GUIDE } from "../_shared/app-map.ts";
import {
  normalizeSubscriptionTier,
  requireSubscriptionTier,
  resolveSubscriptionTier,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UIMessagePart { text?: string }
interface UIMessage { id?: string; role: string; content?: string; parts?: UIMessagePart[] }
interface ChatBody {
  model?: string;
  messages: UIMessage[];
  webSearch?: boolean;
  system?: string;
  mode?: "ask" | "agent";
  previous_response_id?: string;
}

// ---------------------------------------------------------------------------
// Supabase helper
// ---------------------------------------------------------------------------

const createAuthedSupabaseClient = (authHeader: string) =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });

const createServiceSupabaseClient = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const ACCOUNT_ACCESS_RULES = `
You are inside the authenticated user's JobRaker workspace with FULL read and write access.

## ABSOLUTE RULES — NEVER VIOLATE THESE

**RULE #1: EXECUTE, NEVER INSTRUCT.**
When the user asks you to change something, YOU MUST call the appropriate tool. NEVER tell the user to "go to" a page, "click" a button, or "open" anything. If you have a tool for it, USE IT.

**RULE #2: ALL RESUMES HAVE IDs.**
Every resume returned by list_resumes has an "id" field. This is the resume_id for update_resume. Draft, Active, Archived — ALL statuses can be updated. There is NO resume state that prevents you from calling update_resume. NEVER say "I don't have the ID" or "drafts can't be updated" — that is FALSE.

**RULE #3: EXECUTE WRITE TOOLS ON REQUEST.**
- "Change my resume name" → call list_resumes, then update_resume with full_name
- "Update my headline" → call update_profile with job_title
- "Add Python to my skills" → call add_skill
- "Save this cover letter" → call save_cover_letter
- "Bookmark that job" → call bookmark_job

**RULE #4: CONFIRMATION POLICY.**
Only ask for confirmation before: applying to jobs, deleting data. For ALL other writes (profile, resume, skills, experience, cover letters, bookmarks), just do it immediately.

**RULE #5: SCOPE OF MANUAL INSTRUCTIONS.**
Only give step-by-step instructions for things OUTSIDE JobRaker (LinkedIn, Indeed, external email). Everything inside JobRaker is actionable through your tools.
`;

// ---------------------------------------------------------------------------
// Agent function declarations (Gemini function-calling schema)
// ---------------------------------------------------------------------------

const AGENT_FUNCTION_DECLARATIONS = [
  {
    name: "get_account_snapshot",
    description: "Get a summary of the user's JobRaker account, including counts for applications, tracked jobs, resumes, credits, and recent activity.",
    parameters: { type: "OBJECT" as const, properties: {} },
  },
  {
    name: "run_job_search",
    description: "Search for job listings based on a query and location.",
    parameters: {
      type: "OBJECT" as const,
      properties: {
        query: { type: "STRING" as const, description: "Job search query, e.g. 'software engineer'" },
        location: { type: "STRING" as const, description: "Location, e.g. 'Remote' or 'New York'" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_user_profile",
    description: "Get the user's career profile (skills, experience, headline).",
    parameters: { type: "OBJECT" as const, properties: {} },
  },
  {
    name: "list_applications",
    description: "List the user's job applications and their statuses.",
    parameters: { type: "OBJECT" as const, properties: {} },
  },
  {
    name: "list_resumes",
    description: "List all resumes uploaded by the user.",
    parameters: { type: "OBJECT" as const, properties: {} },
  },
  {
    name: "get_credits_balance",
    description: "Check remaining AI credits.",
    parameters: { type: "OBJECT" as const, properties: {} },
  },
  {
    name: "list_recent_jobs",
    description: "Get the latest discovered job listings.",
    parameters: {
      type: "OBJECT" as const,
      properties: {
        limit: { type: "NUMBER" as const, description: "Default 10" },
      },
    },
  },
  {
    name: "apply_to_job",
    description: "Apply to a job using a job URL or job ID. Requires confirmation from the user first.",
    parameters: {
      type: "OBJECT" as const,
      properties: {
        job_id: { type: "STRING" as const, description: "The job UUID" },
        cover_letter: { type: "STRING" as const, description: "Optional cover letter text" },
      },
      required: ["job_id"],
    },
  },
  {
    name: "analyze_resume",
    description: "Analyze a resume for improvements.",
    parameters: {
      type: "OBJECT" as const,
      properties: {
        target_role: { type: "STRING" as const, description: "Target role for resume optimization" },
      },
    },
  },
  {
    name: "generate_cover_letter",
    description: "Generate a tailored cover letter.",
    parameters: {
      type: "OBJECT" as const,
      properties: {
        job_description: { type: "STRING" as const, description: "The job description to tailor to" },
        instructions: { type: "STRING" as const, description: "Additional instructions for tone or content" },
      },
      required: ["job_description"],
    },
  },
  {
    name: "evaluate_job_fit",
    description: "Evaluate how well the user matches a job.",
    parameters: {
      type: "OBJECT" as const,
      properties: {
        job_description: { type: "STRING" as const, description: "The job description to evaluate against" },
      },
      required: ["job_description"],
    },
  },
  {
    name: "intake_job_url",
    description: "Import a job from a URL into the user's tracked jobs.",
    parameters: {
      type: "OBJECT" as const,
      properties: {
        url: { type: "STRING" as const, description: "The job posting URL" },
      },
      required: ["url"],
    },
  },
  {
    name: "update_profile",
    description: "Update the user's profile fields such as headline (job_title), location, about, goals, first_name, last_name, or experience_years. Use this when the user asks you to change their profile info.",
    parameters: {
      type: "OBJECT" as const,
      properties: {
        job_title: { type: "STRING" as const, description: "Professional headline, e.g. 'Senior AI & Backend Developer'" },
        location: { type: "STRING" as const, description: "Location, e.g. 'San Francisco, CA'" },
        about: { type: "STRING" as const, description: "Professional summary / bio" },
        goals: { type: "STRING" as const, description: "Career goals" },
        first_name: { type: "STRING" as const, description: "First name" },
        last_name: { type: "STRING" as const, description: "Last name" },
        experience_years: { type: "NUMBER" as const, description: "Years of experience" },
      },
    },
  },
  {
    name: "add_skill",
    description: "Add a skill to the user's profile. Use when the user asks to add or update their skills.",
    parameters: {
      type: "OBJECT" as const,
      properties: {
        name: { type: "STRING" as const, description: "Skill name, e.g. 'Python' or 'Project Management'" },
        level: { type: "STRING" as const, description: "Proficiency: Beginner, Intermediate, Advanced, or Expert" },
        category: { type: "STRING" as const, description: "Category, e.g. 'Programming', 'Soft Skills', 'Tools'" },
      },
      required: ["name"],
    },
  },
  {
    name: "remove_skill",
    description: "Remove a skill from the user's profile by name.",
    parameters: {
      type: "OBJECT" as const,
      properties: {
        name: { type: "STRING" as const, description: "Exact skill name to remove" },
      },
      required: ["name"],
    },
  },
  {
    name: "add_experience",
    description: "Add a work experience entry to the user's profile.",
    parameters: {
      type: "OBJECT" as const,
      properties: {
        title: { type: "STRING" as const, description: "Job title, e.g. 'Software Engineer'" },
        company: { type: "STRING" as const, description: "Company name" },
        location: { type: "STRING" as const, description: "Work location" },
        start_date: { type: "STRING" as const, description: "Start date in YYYY-MM-DD format" },
        end_date: { type: "STRING" as const, description: "End date in YYYY-MM-DD format, omit if current" },
        is_current: { type: "BOOLEAN" as const, description: "Whether this is the current role" },
        description: { type: "STRING" as const, description: "Role description and achievements" },
      },
      required: ["title", "company", "start_date"],
    },
  },
  {
    name: "save_cover_letter",
    description: "Save a cover letter to the user's account so they can access it later from the Cover Letters page.",
    parameters: {
      type: "OBJECT" as const,
      properties: {
        name: { type: "STRING" as const, description: "Name for the cover letter, e.g. 'Cover Letter - Google SWE'" },
        content: { type: "STRING" as const, description: "The full cover letter text" },
        role: { type: "STRING" as const, description: "Target role" },
        company: { type: "STRING" as const, description: "Target company" },
      },
      required: ["name", "content"],
    },
  },
  {
    name: "update_resume",
    description: "Update one or all resumes. Can change the person's name, headline, summary, contact info, or the display name. Pass resume_id to update one specific resume, OR set update_all=true to update ALL resumes at once. No need to call list_resumes first.",
    parameters: {
      type: "OBJECT" as const,
      properties: {
        resume_id: { type: "STRING" as const, description: "Optional: specific resume UUID. If omitted and update_all is true, all resumes are updated." },
        update_all: { type: "BOOLEAN" as const, description: "If true, apply changes to ALL of the user's resumes." },
        display_name: { type: "STRING" as const, description: "Rename the resume in the list, e.g. 'Osita Miles - Senior AI Developer'" },
        full_name: { type: "STRING" as const, description: "The person's full name shown on the resume" },
        headline: { type: "STRING" as const, description: "Professional headline on the resume" },
        email: { type: "STRING" as const, description: "Contact email on the resume" },
        phone: { type: "STRING" as const, description: "Contact phone on the resume" },
        location: { type: "STRING" as const, description: "Location shown on the resume" },
        summary: { type: "STRING" as const, description: "Professional summary paragraph on the resume" },
      },
    },
  },
  {
    name: "update_application_status",
    description: "Update the status of a job application (e.g. Applied, Interview, Offer, Rejected).",
    parameters: {
      type: "OBJECT" as const,
      properties: {
        application_id: { type: "STRING" as const, description: "The application UUID" },
        status: { type: "STRING" as const, description: "New status: Applied, Interview, Offer, Rejected, Withdrawn" },
      },
      required: ["application_id", "status"],
    },
  },
  {
    name: "bookmark_job",
    description: "Bookmark or unbookmark a tracked job.",
    parameters: {
      type: "OBJECT" as const,
      properties: {
        job_id: { type: "STRING" as const, description: "The job UUID" },
        bookmarked: { type: "BOOLEAN" as const, description: "true to bookmark, false to unbookmark" },
      },
      required: ["job_id", "bookmarked"],
    },
  },
  {
    name: "hide_job",
    description: "Hide a job from the job queue (dismiss/archive it).",
    parameters: {
      type: "OBJECT" as const,
      properties: {
        job_id: { type: "STRING" as const, description: "The job UUID" },
      },
      required: ["job_id"],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool executor
// ---------------------------------------------------------------------------

async function executeTool(
  name: string,
  args: Record<string, any>,
  authHeader: string,
  userId: string,
  userContext: UserContext | null,
): Promise<any> {
  const sb = createAuthedSupabaseClient(authHeader);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  const callEdgeFunction = async (fnName: string, body: Record<string, any>) => {
    const res = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  switch (name) {
    case "get_account_snapshot":
      return {
        success: true,
        snapshot: {
          name: userContext?.name || "User",
          email: userContext?.email || "",
          headline: userContext?.headline || null,
          credits: userContext?.credits || 0,
          subscriptionTier: userContext?.subscriptionTier || "Free",
          applicationCount: userContext?.applicationCount || 0,
          jobCount: userContext?.jobCount || 0,
          resumeCount: userContext?.resumeCount || 0,
          recentApplications: userContext?.recentApplications || [],
          recentJobs: userContext?.recentJobs || [],
          resumes: userContext?.resumes || [],
        },
      };

    case "run_job_search":
      return callEdgeFunction("jobs-search", {
        searchQuery: args.query,
        location: args.location,
      });

    case "get_user_profile":
      return { success: true, profile: userContext };

    case "list_applications": {
      const { data } = await sb
        .from("applications")
        .select("id, job_title, company, status, applied_date, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(20);
      return { success: true, applications: data || [] };
    }

    case "list_resumes": {
      const { data, error } = await sb
        .from("resumes")
        .select("id, name, status, updated_at, is_favorite")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      if (error) {
        console.error("list_resumes:", error.message);
        return { success: false, error: error.message, resumes: [] };
      }
      return { success: true, resumes: data || [] };
    }

    case "get_credits_balance": {
      const { data } = await sb
        .from("user_credits")
        .select("balance")
        .eq("user_id", userId)
        .maybeSingle();
      return { success: true, balance: data?.balance || 0 };
    }

    case "list_recent_jobs": {
      const limit = args.limit || 10;
      const { data } = await sb
        .from("jobs")
        .select("id, title, company, location, apply_url, created_at, canonical_status, bookmarked, salary_min, salary_max, salary_currency")
        .order("created_at", { ascending: false })
        .limit(limit);
      return { success: true, jobs: data || [] };
    }

    case "apply_to_job": {
      const { data: job } = await sb
        .from("jobs")
        .select("id, title, company, apply_url, source_id")
        .eq("id", args.job_id)
        .maybeSingle();
      if (!job) return { success: false, error: "Job not found" };
      return callEdgeFunction("apply-to-jobs", {
        jobs: [{
          job_id: job.id,
          job_title: job.title,
          company: job.company,
          url: job.apply_url || job.source_id,
          sourceUrl: job.apply_url || job.source_id,
        }],
        ...(args.cover_letter ? { cover_letter: args.cover_letter } : {}),
      });
    }

    case "analyze_resume":
      return callEdgeFunction("analyze-resume", {
        targetRole: args.target_role,
      });

    case "generate_cover_letter":
      return callEdgeFunction("generate-cover-letter", {
        jobDescription: args.job_description ?? args.jobDescription,
        instructions: args.instructions,
      });

    case "evaluate_job_fit": {
      const tier = normalizeSubscriptionTier(userContext?.subscriptionTier);
      if (tier === "Free") {
        return {
          success: false,
          error:
            "AI job fit reports require Basics or higher. Upgrade at Billing to unlock full evaluation (blockers, confidence, interview angles).",
          upgrade_required: true,
          required_tier: "Basics",
          billing_path: "/dashboard/billing",
        };
      }
      return callEdgeFunction("evaluate-job-fit", {
        jobDescription: args.job_description ?? args.jobDescription,
        jobId: args.job_id ?? args.jobId,
        jobTitle: args.job_title ?? args.jobTitle,
        company: args.company,
        profileSnapshot: args.profile_snapshot ?? args.profileSnapshot,
        resumeText: args.resume_text ?? args.resumeText,
      });
    }

    case "intake_job_url":
      return callEdgeFunction("intake-job-url", {
        url: args.url,
      });

    case "update_profile": {
      const patch: Record<string, any> = {};
      const allowed = ["job_title", "location", "about", "goals", "first_name", "last_name", "experience_years"];
      for (const key of allowed) {
        if (args[key] !== undefined && args[key] !== null) patch[key] = args[key];
      }
      if (patch.experience_years !== undefined && patch.experience_years !== null) {
        patch.experience_years = Math.round(Number(patch.experience_years));
      }
      if (Object.keys(patch).length === 0) return { success: false, error: "No fields to update" };
      patch.updated_at = new Date().toISOString();
      const { error } = await sb.from("profiles").update(patch).eq("id", userId);
      if (error) return { success: false, error: error.message };
      return { success: true, updated_fields: Object.keys(patch).filter(k => k !== "updated_at") };
    }

    case "add_skill": {
      const { data: existing } = await sb
        .from("profile_skills")
        .select("id")
        .ilike("name", args.name)
        .maybeSingle();
      if (existing) {
        const updatePatch: Record<string, any> = { updated_at: new Date().toISOString() };
        if (args.level) updatePatch.level = args.level;
        if (args.category) updatePatch.category = args.category;
        await sb.from("profile_skills").update(updatePatch).eq("id", existing.id);
        return { success: true, action: "updated", skill: args.name };
      }
      const { error } = await sb.from("profile_skills").insert({
        user_id: userId,
        name: args.name,
        level: args.level || "Intermediate",
        category: args.category || "",
      });
      if (error) return { success: false, error: error.message };
      return { success: true, action: "added", skill: args.name };
    }

    case "remove_skill": {
      const { data: skill } = await sb
        .from("profile_skills")
        .select("id")
        .ilike("name", args.name)
        .maybeSingle();
      if (!skill) return { success: false, error: `Skill "${args.name}" not found` };
      const { error } = await sb.from("profile_skills").delete().eq("id", skill.id);
      if (error) return { success: false, error: error.message };
      return { success: true, removed: args.name };
    }

    case "add_experience": {
      const row: Record<string, any> = {
        user_id: userId,
        title: args.title,
        company: args.company,
        start_date: args.start_date,
        location: args.location || "",
        description: args.description || "",
        is_current: args.is_current || false,
      };
      if (args.end_date) row.end_date = args.end_date;
      const { error } = await sb.from("profile_experiences").insert(row);
      if (error) return { success: false, error: error.message };
      return { success: true, action: "added", title: args.title, company: args.company };
    }

    case "save_cover_letter": {
      const { error } = await sb.from("cover_letters").insert({
        user_id: userId,
        name: args.name,
        content: args.content,
        role: args.role || null,
        company: args.company || null,
      });
      if (error) return { success: false, error: error.message };
      return { success: true, action: "saved", name: args.name };
    }

    case "update_resume": {
      let resumes: any[] = [];
      if (args.resume_id) {
        const { data, error } = await sb.from("resumes").select("id, name, data").eq("id", args.resume_id);
        if (error) return { success: false, error: error.message };
        resumes = data || [];
      } else {
        const { data, error } = await sb.from("resumes").select("id, name, data").order("updated_at", { ascending: false });
        if (error) return { success: false, error: error.message };
        resumes = data || [];
        if (!args.update_all && resumes.length > 1) {
          resumes = [resumes[0]];
        }
      }
      if (resumes.length === 0) return { success: false, error: "No resumes found" };

      const results: string[] = [];
      for (const resume of resumes) {
        const currentData = (resume.data && typeof resume.data === "object" ? resume.data : {}) as Record<string, any>;
        const basics = { ...(currentData.basics || {}) };
        const summary = { ...(currentData.summary || {}) };
        const changed: string[] = [];

        if (args.full_name) { basics.name = args.full_name; changed.push("name"); }
        if (args.headline) { basics.headline = args.headline; changed.push("headline"); }
        if (args.email) { basics.email = args.email; changed.push("email"); }
        if (args.phone) { basics.phone = args.phone; changed.push("phone"); }
        if (args.location) { basics.location = args.location; changed.push("location"); }
        if (args.summary) { summary.content = args.summary; summary.hidden = false; changed.push("summary"); }

        const newData = { ...currentData, basics, summary };
        const patch: Record<string, any> = { data: newData, updated_at: new Date().toISOString() };
        if (args.display_name) { patch.name = args.display_name; changed.push("display name"); }

        if (changed.length === 0) continue;

        const { error: updateErr } = await sb.from("resumes").update(patch).eq("id", resume.id);
        if (updateErr) {
          results.push(`Failed to update "${resume.name}": ${updateErr.message}`);
        } else {
          results.push(`Updated "${resume.name}" (${changed.join(", ")})`);
        }
      }
      return { success: true, results, updated_count: results.length };
    }

    case "update_application_status": {
      const { error } = await sb
        .from("applications")
        .update({ status: args.status, updated_at: new Date().toISOString() })
        .eq("id", args.application_id);
      if (error) return { success: false, error: error.message };
      return { success: true, application_id: args.application_id, new_status: args.status };
    }

    case "bookmark_job": {
      const { error } = await sb
        .from("jobs")
        .update({ bookmarked: args.bookmarked })
        .eq("id", args.job_id);
      if (error) return { success: false, error: error.message };
      return { success: true, job_id: args.job_id, bookmarked: args.bookmarked };
    }

    case "hide_job": {
      const { error } = await sb
        .from("jobs")
        .update({ hidden: true })
        .eq("id", args.job_id);
      if (error) return { success: false, error: error.message };
      return { success: true, job_id: args.job_id, hidden: true };
    }

    default:
      return callEdgeFunction(name.replace(/_/g, "-"), args);
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin || undefined);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const body: ChatBody = await req.json();
    const {
      messages,
      system,
      mode = "ask",
      webSearch = false,
    } = body;

    const { authHeader, user, subscriptionTier } = await requireSubscriptionTier(req, "Pro", "AI chat");
    const userId = user.id;

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages are required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createServiceSupabaseClient();

    const { data: rateLimitResult, error: rlError } = await serviceClient.rpc(
      "check_chat_rate_limit",
      { p_user_id: userId, p_tier: subscriptionTier },
    );
    if (!rlError && rateLimitResult && rateLimitResult.allowed === false) {
      return new Response(
        JSON.stringify({
          error: rateLimitResult.message,
          code: rateLimitResult.reason,
          retry_after: rateLimitResult.retry_after_seconds,
        }),
        {
          status: 429,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    const { data: consumeResult, error: consumeError } = await serviceClient.rpc(
      "consume_chat_message",
      { p_user_id: userId },
    );
    if (consumeError) {
      console.error("consume_chat_message RPC error:", consumeError);
    } else if (consumeResult && consumeResult.success === false) {
      return new Response(
        JSON.stringify({
          error: consumeResult.message,
          code: consumeResult.reason,
          balance: consumeResult.balance,
          free_remaining: consumeResult.free_remaining,
        }),
        {
          status: 402,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    const ai = createGeminiClient();

    // Fetch user context with timeout
    let userContext: UserContext | null = null;
    let contextError: string | null = null;
    try {
      const contextPromise = fetchUserContext(userId, authHeader);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Context fetch timed out after 8s")), 8000),
      );
      userContext = await Promise.race([contextPromise, timeoutPromise]);
      if (userContext) {
        userContext.email = user.email ?? "";
        userContext.subscriptionTier = subscriptionTier;
      }
    } catch (e: any) {
      contextError = e?.message || "Unknown error";
      console.error("Failed to fetch user context:", contextError);
    }

    // If rich context failed, try a minimal direct query
    if (!userContext) {
      try {
        const sb = createAuthedSupabaseClient(authHeader);
        const [profileRes, jobCountRes, appCountRes] = await Promise.all([
          sb.from("profiles").select("first_name, last_name, job_title, location, skills").single(),
          sb.from("jobs").select("id", { count: "exact", head: true }),
          sb.from("applications").select("id", { count: "exact", head: true }),
        ]);
        const p = profileRes.data;
        const name = p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() || "User" : "User";
        userContext = {
          userId,
          name,
          email: user.email ?? "",
          headline: p?.job_title || null,
          resumeSummary: null,
          candidateMemorySummary: null,
          recentChatTitles: [],
          subscriptionTier,
          credits: 0,
          applicationCount: appCountRes.count || 0,
          jobCount: jobCountRes.count || 0,
          resumeCount: 0,
          recentApplications: [],
          recentJobs: [],
          recentCoverLetters: [],
          resumes: [],
        };
        console.log("Used fallback context:", { jobCount: userContext.jobCount, appCount: userContext.applicationCount });
      } catch (fallbackErr: any) {
        console.error("Fallback context also failed:", fallbackErr?.message);
      }
    }

    // Build system instruction
    let systemInstruction = [ACCOUNT_ACCESS_RULES.trim(), APP_INTERFACE_GUIDE.trim()]
      .filter(Boolean)
      .join("\n\n");

    if (system) {
      systemInstruction = `${systemInstruction}\n\n${system}`;
    }

    if (userContext) {
      const contextStr = formatUserContextForPrompt(userContext);
      systemInstruction = `User Info:\n${contextStr}\n\n${systemInstruction}`;
    } else {
      systemInstruction = `NOTE: The user's account data could not be loaded due to a temporary error (${contextError || "unknown"}). Inform the user that you're having trouble accessing their data and suggest they try again in a moment. Do NOT say they have zero jobs or applications — the data simply couldn't be retrieved.\n\n${systemInstruction}`;
    }

    if (mode === "agent") {
      systemInstruction = `You are JobRaker Agent — you EXECUTE actions using tools. You NEVER give manual step-by-step instructions for things you can do with tools.

YOUR WRITE TOOLS (use them!):
- update_profile: Change headline, name, about, location, goals
- update_resume: Change name/headline/summary/contact on ANY resume (Draft or Active — ALL have IDs from list_resumes)
- add_skill / remove_skill: Manage profile skills
- add_experience: Add work history
- save_cover_letter: Persist a cover letter
- bookmark_job / hide_job: Manage job queue
- update_application_status: Change application status
- apply_to_job: Submit application (confirm first)
- run_job_search: Find new jobs
- intake_job_url: Import a job from URL
- generate_cover_letter / analyze_resume / evaluate_job_fit: AI analysis

Job search and career page guidelines:
- NEVER run multiple run_job_search tool calls in parallel or in a single turn. It is extremely expensive and wastes user credits. If the user provides multiple company names or career page URLs, combine them into a single search query using the Google search site: operator and OR (e.g. "Operations Project Manager" (site:gitlab.com OR site:automattic.com)). Do not execute a separate search call for each company.
- Only use intake_job_url if the URL represents a single specific job posting. For index career pages, use run_job_search with a combined site query.

When the user says "change the name on my resume" you MUST: 1) call list_resumes to get IDs, 2) call update_resume with the resume_id and full_name. NEVER tell the user to do it themselves.

\n\n${systemInstruction}`;
    } else {
      systemInstruction = `You are JobRaker AI, a helpful and concise career assistant. Answer from the user's JobRaker data when possible.\n\n${systemInstruction}`;
    }

    // Build message history
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content || m.parts?.map((p) => p.text).join("\n") || "" }],
    })).filter((m) => m.parts[0].text.trim() !== "");
    const userPrompt = messages[messages.length - 1].content ||
      messages[messages.length - 1].parts?.map((p) => p.text).join("\n") || "";

    // SSE stream response
    const bodyStream = new ReadableStream({
      start(controller) {
        (async () => {
        const encoder = new TextEncoder();
        const send = (event: string, data: any) => {
          const payload = typeof data === "string" ? data : JSON.stringify(data);
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${payload}\n\n`));
        };

        try {
          if (mode === "agent") {
            // --- AGENT MODE: non-streaming with function-calling loop ---
            const contents = [
              ...history,
              { role: "user", parts: [{ text: userPrompt }] },
            ];

            let turnCount = 0;
            while (turnCount < 5) {
              turnCount++;

              const response = await withGeminiRetry(() =>
                ai.models.generateContent({
                  model: GEMINI_MODEL,
                  config: {
                    tools: [{ functionDeclarations: AGENT_FUNCTION_DECLARATIONS }],
                    systemInstruction,
                  },
                  contents,
                }),
              );

              const parts = response.candidates?.[0]?.content?.parts || [];
              const textParts = parts.filter((p: any) => p.text);
              const functionCalls = parts.filter((p: any) => p.functionCall);

              // Emit any text from this turn
              for (const part of textParts) {
                if (part.text) {
                  send("message", { delta: part.text });
                }
              }

              if (functionCalls.length === 0) break;

              const { data: surchargeResult, error: surchargeError } = await serviceClient.rpc(
                "consume_ai_chat_tool_surcharge",
                { p_user_id: userId, p_credits: 1 },
              );
              const sur = surchargeResult as Record<string, unknown> | null;
              const surchargeOk =
                sur &&
                (sur.success === true || sur.success === "true" || sur.success === "t");
              if (surchargeError) {
                console.error("consume_ai_chat_tool_surcharge RPC error:", surchargeError);
              }
              if (surchargeError || !surchargeOk) {
                send("error", {
                  error: surchargeError
                    ? `Could not charge credits for agent tools. ${(surchargeError as { message?: string }).message || "Please try again."}`
                    : (typeof sur?.message === "string" ? sur.message : null) ||
                      "Not enough credits to run agent tools this step. Add credits or switch to Ask mode.",
                  code: surchargeError ? "billing_error" : "agent_tool_surcharge",
                  balance: sur?.balance,
                  reason: sur?.reason,
                });
                break;
              }
              if (surchargeOk) {
                send("agent_surcharge", {
                  credits_charged: sur?.credits_charged,
                  balance: sur?.balance,
                });
              }

              // Execute each function call
              const functionResponses: any[] = [];
              for (const fc of functionCalls) {
                const fn = fc.functionCall;
                console.log(`[Agent] Executing tool: ${fn.name}`, fn.args);

                let result: any;
                try {
                  result = await executeTool(fn.name, fn.args || {}, authHeader, userId, userContext);
                } catch (e: any) {
                  result = { error: e.message };
                }

                send("tool_call", { name: fn.name, args: fn.args, result });
                functionResponses.push({
                  functionResponse: { name: fn.name, response: result },
                });
              }

              // Append model response + function results to conversation
              contents.push({ role: "model", parts });
              contents.push({ role: "user", parts: functionResponses });
            }
          } else {
            // --- ASK MODE: streaming with pre-loaded context ---
            const config: Record<string, any> = {
              systemInstruction,
              ...(webSearch ? { tools: [{ googleSearch: {} }] } : {}),
            };

            const stream = await withGeminiRetry(() =>
              ai.models.generateContentStream({
                model: GEMINI_MODEL,
                config,
                contents: [
                  ...history,
                  { role: "user", parts: [{ text: userPrompt }] },
                ],
              }),
            );

            let sentAny = false;
            for await (const chunk of stream) {
              const text = typeof chunk.text === "function" ? chunk.text() : chunk.text;
              if (text) {
                send("message", { delta: text });
                sentAny = true;
              }
            }

            if (!sentAny) {
              send("message", { delta: "I wasn't able to generate a response. Please try rephrasing your question." });
            }
          }

          send("done", "[DONE]");
          controller.close();
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("ai-chat stream/agent error:", msg);
          const userMessage = isGeminiRateLimitError(e)
            ? "Our AI service is temporarily busy. Please try again in a moment."
            : msg;
          send("error", { error: userMessage });
          controller.close();
        }
        })();
      },
    });

    return new Response(bodyStream, {
      headers: {
        ...cors,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error: unknown) {
    console.error("Outer error:", error);
    return subscriptionErrorResponse(error, cors);
  }
});
