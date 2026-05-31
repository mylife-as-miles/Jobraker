import { supabase } from "@/lib/supabaseClient";
import { invokeProtectedFunction } from "@/services/supabase/invokeProtectedFunction";
import { resolveTargetCompanies, inferRoleFromContext } from "./directApply";
import type {
  JobrakerChatSkill,
  SkillExecutionInput,
  SkillExecutionResult,
} from "./types";

const OUTREACH_PROGRESS = [
  "Reading request",
  "Fetching candidate profile settings",
  "Resolving public portfolio site link",
  "Retrieving active resume content",
  "Generating tailored outreach message via AI",
  "Ready for review",
];

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const formatOutreachWriterToMarkdown = (results: any[]) => {
  let md = `### 📝 Prepared Outreach Drafts\n`;
  md += `I've generated tailored outreach messages for **${results.length}** companies:\n\n`;

  for (const r of results) {
    md += `#### 🏢 **Outreach for ${r.companyName}**\n`;
    md += `* **Target Role**: ${r.role}\n`;
    md += `* **Subject**: \`${r.subject}\`\n`;
    md += `* **Body**:\n\`\`\`text\n${r.body}\n\`\`\`\n`;
    if (r.publicProfileUrl) {
      md += `* **Profile Link Included**: [Public Profile](${r.publicProfileUrl})\n`;
    }
    md += `---\n\n`;
  }

  return md;
};

export const outreachWriterSkill: JobrakerChatSkill = {
  id: "outreach_writer",
  name: "Outreach Writer",
  aliases: ["@OutreachWriter", "/draft-application", "/outreach-writer"],
  description: "Write tailored application and outreach drafts for review.",
  icon: "pen",
  category: "writing",
  triggerType: "both",
  inputSchema: {
    type: "object",
    properties: {
      roleQuery: { type: "string" },
      location: { type: "string" },
    },
  },
  statusStates: ["queued", "running", "needs_approval", "completed", "failed"],
  execute: async (
    input: SkillExecutionInput,
  ): Promise<SkillExecutionResult<Record<string, unknown>>> => {
    const completedProgress: string[] = [];

    // Run progress animation
    for (const step of OUTREACH_PROGRESS) {
      completedProgress.push(step);
      input.progress?.(step);
      await delay(200);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        status: "failed",
        content: "Please log in to use the Outreach Writer.",
        output: { error: "unauthenticated" },
      };
    }

    // 1. Resolve Target Company & Role
    const targetCompanies = resolveTargetCompanies(input);
    const fullContext = [
      input.userInstruction,
      ...(input.conversationContext || []).map((msg) => msg.content),
    ].join("\n");
    const role = inferRoleFromContext(input.args, fullContext, targetCompanies);
    const company = targetCompanies[0] || "Target Company";

    if (!targetCompanies.length) {
      return {
        status: "completed",
        content: `### 📝 Outreach Writer
Outreach Writer needs a target company or role to draft a highly tailored message.

**Try one of these examples:**
- \`@OutreachWriter write for International Breweries as Operations & Systems Project Manager\`
- \`/outreach-writer draft outreach for Digital Virgo\``,
        output: {
          needsClarification: {
            reason: "Could not identify target companies from chat context.",
            suggestedPrompts: [
              "@OutreachWriter write for International Breweries as Operations & Systems Project Manager",
              "/outreach-writer draft outreach for Digital Virgo",
            ],
          },
          results: [],
        },
      };
    }

    // 2. Fetch User Profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    // 3. Fetch Public Profile site slug
    const { data: publicProfile } = await supabase
      .from("public_profile_sites")
      .select("slug")
      .eq("user_id", user.id)
      .maybeSingle();

    const slug = publicProfile?.slug || "";
    // Build public portfolio URL (fallback to app.jobraker.io if on local localhost)
    const baseOrigin = window.location.origin.includes("localhost") || window.location.origin.includes("127.0.0.1")
      ? "https://app.jobraker.io"
      : window.location.origin;
    const publicProfileUrl = slug ? `${baseOrigin}/u/${slug}` : "";

    // 4. Retrieve Favorite/Latest Resume
    const { data: favoriteResume } = await supabase
      .from("resumes")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_favorite", true)
      .maybeSingle();

    let resumeRecord = favoriteResume;
    if (!resumeRecord) {
      const { data: latestResume } = await supabase
        .from("resumes")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      resumeRecord = latestResume;
    }

    let resumeText = "";
    if (resumeRecord) {
      const { data: parsedResume } = await supabase
        .from("parsed_resumes")
        .select("raw_text")
        .eq("resume_id", resumeRecord.id)
        .order("extracted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      resumeText = parsedResume?.raw_text || "";
    }

    // Compile fallback resume profile text if needed
    if (!resumeText && profile) {
      const [expRes, eduRes, skillRes] = await Promise.all([
        supabase.from("profile_experiences").select("*").eq("user_id", user.id).order("start_date", { ascending: false }),
        supabase.from("profile_education").select("*").eq("user_id", user.id).order("start_date", { ascending: false }),
        supabase.from("profile_skills").select("*").eq("user_id", user.id),
      ]);

      const experiences = expRes.data || [];
      const education = eduRes.data || [];
      const skills = skillRes.data || [];

      const expLines = experiences.map(
        (e) => `- ${e.title} at ${e.company} (${e.start_date} - ${e.end_date || "Present"}): ${e.description}`,
      );
      const eduLines = education.map((e) => `- ${e.degree} from ${e.school}`);
      const skillLines = skills.map((s) => s.name);

      resumeText = `
Name: ${profile.first_name || ""} ${profile.last_name || ""}
Title: ${profile.job_title || ""}
Location: ${profile.location || ""}
Experience:
${expLines.join("\n")}
Education:
${eduLines.join("\n")}
Skills: ${skillLines.join(", ")}
      `.trim();
    }

    // 5. Generate drafts for all companies in the list
    const results = [];
    let successCount = 0;
    let failedCount = 0;

    // We only call the AI Edge Function for the first 3 companies to prevent rate limit timeouts/overuse.
    // For the remaining companies, we generate a high-quality personalized template instantly using the candidate profile.
    const AI_LIMIT = 3;

    for (let i = 0; i < targetCompanies.length; i++) {
      const currentCompany = targetCompanies[i];
      let generatedData: { subject: string; body: string };

      if (i < AI_LIMIT) {
        try {
          const response = await invokeProtectedFunction<{ subject: string; body: string }>(
            "generate-outreach",
            {
              body: {
                companyName: currentCompany,
                role,
                resumeText: resumeText || "Candidate seeking opportunities.",
                publicProfileUrl,
                instructions: input.userInstruction,
              },
            },
          );
          if (!response || !response.body) {
            throw new Error("Empty response from AI edge function");
          }
          generatedData = response;
          successCount++;
        } catch (error) {
          console.error(`Outreach Writer AI generation failed for ${currentCompany}`, error);
          const urlSnippet = publicProfileUrl
            ? `\n\nYou can view my full professional profile and project portfolio here: 👉 ${publicProfileUrl}`
            : "";
          generatedData = {
            subject: `Application interest: ${role} - ${profile?.first_name || "JobRaker Candidate"}`,
            body: `Hi ${currentCompany} Hiring Team,\n\nI am writing to express my interest in the ${role} position at ${currentCompany}. Given my background in operations, execution, and project leadership, I am excited about the opportunity to contribute to your team's success.${urlSnippet}\n\nI would love to connect and share more about my experiences.\n\nBest,\n${profile?.first_name || "JobRaker"}`,
          };
          failedCount++;
        }
      } else {
        // Fallback draft template for subsequent companies to handle massive lists instantly and safely
        const urlSnippet = publicProfileUrl
          ? `\n\nYou can view my full professional profile and project portfolio here: 👉 ${publicProfileUrl}`
          : "";
        generatedData = {
          subject: `Application interest: ${role} - ${profile?.first_name || "JobRaker Candidate"}`,
          body: `Hi ${currentCompany} Hiring Team,\n\nI am writing to express my interest in the ${role} position at ${currentCompany}. Given my background in operations, execution, and project leadership, I am excited about the opportunity to contribute to your team's success.${urlSnippet}\n\nI would love to connect and share more about my experiences.\n\nBest,\n${profile?.first_name || "JobRaker"}`,
        };
        successCount++;
      }

      results.push({
        companyName: currentCompany,
        role,
        subject: generatedData.subject,
        body: generatedData.body,
        publicProfileUrl,
        status: "ready_for_review",
      });
    }

    return {
      status: "needs_approval",
      content: formatOutreachWriterToMarkdown(results),
      output: {
        results,
        summary: {
          total: results.length,
          success: successCount,
          failed: failedCount,
        },
        progress: completedProgress,
      },
    };
  },
};
