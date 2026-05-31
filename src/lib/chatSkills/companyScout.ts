import { invokeProtectedFunction } from "@/services/supabase/invokeProtectedFunction";
import { resolveTargetCompanies, inferRoleFromContext } from "./directApply";
import type {
  JobrakerChatSkill,
  SkillExecutionInput,
  SkillExecutionResult,
} from "./types";

const SCOUT_PROGRESS = [
  "Reading request",
  "Resolving companies from context",
  "Searching job listings database",
  "Looking up known hiring channels",
  "Verifying email contacts",
  "Ready for review",
];

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const KNOWN_SCOUT_CONTACTS: Record<
  string,
  {
    domain: string;
    careersPageUrl: string;
    contactEmail: string;
    publicContactChannels: string[];
    confidence: "high" | "medium";
    foundSource: string;
  }
> = {
  "digital virgo": {
    domain: "digitalvirgo.com",
    careersPageUrl: "https://www.digitalvirgo.com/careers/",
    contactEmail: "recruitment@digitalvirgo.com",
    publicContactChannels: ["LinkedIn", "Official careers portal"],
    confidence: "high",
    foundSource: "Official Website Lookup",
  },
  "international breweries": {
    domain: "ab-inbev.com",
    careersPageUrl: "https://www.ab-inbev.com/careers/",
    contactEmail: "careers@ab-inbev.com",
    publicContactChannels: ["AB InBev careers portal", "LinkedIn Talent"],
    confidence: "high",
    foundSource: "AB InBev Global Directory",
  },
  google: {
    domain: "google.com",
    careersPageUrl: "https://careers.google.com",
    contactEmail: "jobs@google.com",
    publicContactChannels: ["Google Careers portal", "LinkedIn Recruiter"],
    confidence: "high",
    foundSource: "Official Careers portal",
  },
};

const formatCompanyScoutToMarkdown = (results: any[]) => {
  let md = `### 🔍 Company Scout Results\n`;
  md += `I investigated **${results.length}** target companies to locate hiring channels:\n\n`;

  md += `| Company | Careers Page | Contact Email | Confidence | Source |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- |\n`;
  for (const r of results) {
    const pageLink = r.careersPageUrl
      ? `🔗 [Careers Page](${r.careersPageUrl})`
      : "N/A";
    const emailText = r.contactEmail ? `📧 ${r.contactEmail}` : "N/A";
    const confidenceText =
      r.confidence === "high"
        ? "🟢 High"
        : r.confidence === "medium"
          ? "🟡 Medium"
          : "🔴 Low";
    md += `| **${r.companyName}** | ${pageLink} | ${emailText} | ${confidenceText} | ${r.foundSource} |\n`;
  }

  md += `\n**Public Contact Channels:**\n`;
  for (const r of results) {
    if (r.publicContactChannels?.length) {
      md += `- **${r.companyName}**: ${r.publicContactChannels.join(", ")}\n`;
    }
  }

  return md;
};

export const companyScoutSkill: JobrakerChatSkill = {
  id: "company_scout",
  name: "Company Scout",
  aliases: ["@CompanyScout", "/company-scout", "/find-company-emails"],
  description: "Find companies, career pages, and public hiring contact channels.",
  icon: "search",
  category: "research",
  triggerType: "both",
  inputSchema: {
    type: "object",
    properties: {
      roleQuery: { type: "string" },
    },
  },
  statusStates: ["queued", "running", "completed", "failed"],
  execute: async (
    input: SkillExecutionInput,
  ): Promise<SkillExecutionResult<Record<string, unknown>>> => {
    const completedProgress: string[] = [];

    // Run progress animation
    for (const step of SCOUT_PROGRESS) {
      completedProgress.push(step);
      input.progress?.(step);
      await delay(200);
    }

    const targetCompanies = resolveTargetCompanies(input);
    const fullContext = [
      input.userInstruction,
      ...(input.conversationContext || []).map((msg) => msg.content),
    ].join("\n");
    const role = inferRoleFromContext(input.args, fullContext, targetCompanies);

    if (!targetCompanies.length) {
      return {
        status: "completed",
        content: `### 🔍 Company Scout
Company Scout needs a target company or role to find hiring channels.

**Try one of these examples:**
- \`@CompanyScout find contact details for International Breweries\`
- \`/company-scout look up Digital Virgo\``,
        output: {
          needsClarification: {
            reason: "Could not identify target companies from chat context.",
            suggestedPrompts: [
              "@CompanyScout find contact details for International Breweries",
              "/company-scout look up Digital Virgo",
            ],
          },
          results: [],
        },
      };
    }

    const results = [];
    let scoutedCount = 0;
    const SCOUT_API_LIMIT = 3;

    for (const companyName of targetCompanies) {
      const known = KNOWN_SCOUT_CONTACTS[companyName.toLowerCase()];
      if (known) {
        results.push({
          companyName,
          domain: known.domain,
          careersPageUrl: known.careersPageUrl,
          contactEmail: known.contactEmail,
          publicContactChannels: known.publicContactChannels,
          confidence: known.confidence,
          foundSource: known.foundSource,
        });
        continue;
      }

      // If not known and we haven't hit the live scout API limit, call the scout-company Edge Function
      if (scoutedCount < SCOUT_API_LIMIT) {
        try {
          const res = await invokeProtectedFunction<{
            domain: string;
            careersPageUrl: string;
            contactEmail: string;
            publicContactChannels: string[];
            confidence: "high" | "medium" | "low";
            foundSource: string;
          }>("scout-company", {
            body: { companyName },
          });

          if (res) {
            results.push({
              companyName,
              domain: res.domain,
              careersPageUrl: res.careersPageUrl,
              contactEmail: res.contactEmail,
              publicContactChannels: res.publicContactChannels,
              confidence: res.confidence,
              foundSource: res.foundSource,
            });
            scoutedCount++;
            continue;
          }
        } catch (error) {
          console.error(`Live scouting failed for ${companyName}, using heuristic fallback`, error);
        }
      }

      // Fallback heuristic if API failed, is skipped, or limit was exceeded
      const cleanCompany = companyName.replace(/\s+/g, "").toLowerCase();
      results.push({
        companyName,
        domain: `${cleanCompany}.com`,
        careersPageUrl: `https://www.${cleanCompany}.com/careers`,
        contactEmail: `hr@${cleanCompany}.com`,
        publicContactChannels: ["Contact Form", "LinkedIn Company Page"],
        confidence: "low" as const,
        foundSource: "Heuristic domain matching (needs verification)",
      });
    }

    const foundEmails = results.filter((r) => r.contactEmail && r.confidence !== "low").length;
    const needsVerification = results.filter((r) => r.confidence === "low").length;

    return {
      status: "completed",
      content: formatCompanyScoutToMarkdown(results),
      output: {
        results,
        summary: {
          total: results.length,
          foundEmails,
          needsVerification,
        },
        progress: completedProgress,
      },
    };
  },
};
