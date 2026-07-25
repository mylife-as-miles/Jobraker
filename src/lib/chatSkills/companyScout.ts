import { invokeProtectedFunction } from "@/services/supabase/invokeProtectedFunction";
import { supabase } from "@/lib/supabaseClient";
import { resolveTargetCompanies } from "./directApply";
import type {
  JobrakerChatSkill,
  SkillExecutionInput,
  SkillExecutionResult,
} from "./types";

const SCOUT_PROGRESS = [
  "Reading the job and company context",
  "Extracting team and department keywords",
  "Searching public LinkedIn profile results",
  "Ranking recruiters and hiring-team members",
  "Checking source-backed work emails",
  "Preparing contacts for review",
];

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const asString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

type RecruiterContact = {
  fullName: string;
  title: string;
  roleKind:
    | "recruiter"
    | "hiring_manager"
    | "team_lead"
    | "director"
    | "employee"
    | "unknown";
  linkedinUrl: string;
  workEmail: string;
  emailStatus:
    | "source_verified"
    | "provider_verified"
    | "domain_valid"
    | "pattern_only"
    | "unverified"
    | "not_found";
  emailConfidence: number;
  emailSourceUrl: string;
  relevanceScore: number;
  safeToContact: boolean;
};

type CompanyScoutResponse = {
  domain: string;
  careersPageUrl: string;
  contactEmail: string;
  publicContactChannels: string[];
  confidence: "high" | "medium" | "low";
  foundSource: string;
  teamKeywords?: string[];
  recruiterContacts?: RecruiterContact[];
  verificationPolicy?: Record<string, unknown>;
  discoveryRunId?: string | null;
};

type CompanyScoutResult = CompanyScoutResponse & {
  companyName: string;
  error?: string;
};

const confidenceLabel = (confidence: CompanyScoutResult["confidence"]) => {
  if (confidence === "high") return "High";
  if (confidence === "medium") return "Medium";
  return "Low";
};

const formatCompanyScoutToMarkdown = (results: CompanyScoutResult[]) => {
  let markdown = `### Recruiter and Hiring-Team Discovery\n`;
  markdown += `I investigated **${results.length}** target ${results.length === 1 ? "company" : "companies"} using public, evidence-backed sources.\n\n`;

  markdown += `| Company | Careers page | Best verified email | Confidence |\n`;
  markdown += `| :--- | :--- | :--- | :--- |\n`;
  for (const result of results) {
    const pageLink = result.careersPageUrl
      ? `[Open careers page](${result.careersPageUrl})`
      : "Not found";
    const emailText = result.contactEmail || "Not verified";
    markdown += `| **${result.companyName}** | ${pageLink} | ${emailText} | ${confidenceLabel(result.confidence)} |\n`;
  }

  for (const result of results) {
    markdown += `\n#### ${result.companyName}\n`;
    if (result.teamKeywords?.length) {
      markdown += `**Job/team keywords:** ${result.teamKeywords.join(", ")}\n\n`;
    }

    const contacts = Array.isArray(result.recruiterContacts)
      ? result.recruiterContacts
      : [];
    if (!contacts.length) {
      markdown += `No evidence-backed individual recruiter or hiring-team profile was found.\n`;
    } else {
      contacts.forEach((contact, index) => {
        const title = contact.title || contact.roleKind.replace(/_/g, " ");
        markdown += `${index + 1}. **${contact.fullName}** — ${title}`;
        if (contact.linkedinUrl) {
          markdown += ` — [LinkedIn](${contact.linkedinUrl})`;
        }
        markdown += ` — relevance ${contact.relevanceScore}/100`;
        if (contact.safeToContact && contact.workEmail) {
          markdown += `\n   Verified work email: **${contact.workEmail}** (${contact.emailStatus.replace(/_/g, " ")})`;
        } else {
          markdown += `\n   Work email: not verified. JobRaker will not invent or expose a pattern guess.`;
        }
        markdown += `\n`;
      });
    }

    if (result.error) {
      markdown += `\nLookup note: ${result.error}\n`;
    } else if (result.foundSource) {
      markdown += `\nSource policy: ${result.foundSource}\n`;
    }
  }

  markdown += `\n**Sending rule:** review the exact recipient and message before JobRaker uses a connected inbox. LinkedIn profile links are provided for manual review because the current LinkedIn integration does not support employee search or direct messages.\n`;
  return markdown;
};

export const companyScoutSkill: JobrakerChatSkill = {
  id: "company_scout",
  name: "Recruiter Scout",
  aliases: [
    "@RecruiterScout",
    "@CompanyScout",
    "/recruiter-scout",
    "/company-scout",
    "/find-company-emails",
    "/find-hiring-manager",
  ],
  description:
    "Find evidence-backed recruiter and hiring-team LinkedIn profiles, careers pages, and verified work emails for a target job.",
  icon: "search",
  category: "research",
  triggerType: "both",
  inputSchema: {
    type: "object",
    properties: {
      roleQuery: { type: "string" },
      jobId: { type: "string" },
      applicationId: { type: "string" },
      jobDescription: { type: "string" },
    },
  },
  statusStates: ["queued", "running", "completed", "failed"],
  execute: async (
    input: SkillExecutionInput,
  ): Promise<SkillExecutionResult<Record<string, unknown>>> => {
    const completedProgress: string[] = [];

    for (const step of SCOUT_PROGRESS) {
      completedProgress.push(step);
      input.progress?.(step);
      await delay(160);
    }

    const targetCompanies = await resolveTargetCompanies(input);
    if (!targetCompanies.length) {
      return {
        status: "completed",
        content: `### 🔍 Recruiter Scout
Recruiter Scout needs a company or an application context.

**Try one of these:**
- \`@RecruiterScout find the hiring manager for Google Trust and Safety\`
- \`/recruiter-scout find verified contacts for my latest application\``,
        output: {
          needsClarification: {
            reason: "Could not identify a target company from chat or application context.",
            suggestedPrompts: [
              "@RecruiterScout find the hiring manager for Google Trust and Safety",
              "/recruiter-scout find verified contacts for my latest application",
            ],
          },
          results: [],
        },
      };
    }

    const primaryCompany = targetCompanies[0] || "Target Company";
    const roleQuery =
      asString(input.args.roleQuery) ||
      asString(input.args.jobTitle) ||
      asString(input.args.job_title);
    const jobId = asString(input.args.jobId) || asString(input.args.job_id);
    const applicationId =
      asString(input.args.applicationId) || asString(input.args.application_id);
    const jobDescription =
      asString(input.args.jobDescription) ||
      asString(input.args.job_description);
    const applyUrl = asString(input.args.applyUrl) || asString(input.args.apply_url);

    // Track task in job_intelligence_tasks for Live Run display
    let createdTaskId: string | null = null;
    try {
      const { data: userAuth } = await supabase.auth.getUser();
      if (userAuth?.user?.id) {
        const { data: inserted } = await (supabase as any)
          .from("job_intelligence_tasks")
          .insert({
            user_id: userAuth.user.id,
            type: "scout_search",
            title: `Recruiter Scout: ${primaryCompany}`,
            message: `Scanning for verified contacts and recruiter profiles for ${primaryCompany}${roleQuery ? ` (${roleQuery})` : ""}.`,
            status: "running",
            progress_current: 1,
            progress_total: SCOUT_PROGRESS.length,
            params: { company: primaryCompany, role: roleQuery },
            result: {},
          })
          .select("id")
          .single();
        if (inserted?.id) {
          createdTaskId = inserted.id;
        }
      }
    } catch (err) {
      console.warn("Could not insert scout_search task", err);
    }

    const results: CompanyScoutResult[] = [];
    const liveTargets = targetCompanies.slice(0, 3);

    for (const companyName of liveTargets) {
      try {
        const response = await invokeProtectedFunction<CompanyScoutResponse>(
          "scout-company",
          {
            body: {
              companyName,
              jobId: jobId || undefined,
              applicationId: applicationId || undefined,
              jobTitle: roleQuery || undefined,
              jobDescription: jobDescription || undefined,
              applyUrl: applyUrl || undefined,
              limit: 6,
            },
          },
        );

        results.push({
          companyName,
          domain: response?.domain || "",
          careersPageUrl: response?.careersPageUrl || "",
          contactEmail: response?.contactEmail || "",
          publicContactChannels: response?.publicContactChannels || [],
          confidence: response?.confidence || "low",
          foundSource:
            response?.foundSource ||
            "No evidence-backed contact source was returned.",
          teamKeywords: response?.teamKeywords || [],
          recruiterContacts: response?.recruiterContacts || [],
          verificationPolicy: response?.verificationPolicy || {},
          discoveryRunId: response?.discoveryRunId || null,
        });
      } catch (error) {
        console.error(`Recruiter scouting failed for ${companyName}`, error);
        results.push({
          companyName,
          domain: "",
          careersPageUrl: "",
          contactEmail: "",
          publicContactChannels: [],
          confidence: "low",
          foundSource:
            "The live evidence lookup failed. No domain or email fallback was generated.",
          teamKeywords: [],
          recruiterContacts: [],
          verificationPolicy: {
            guessedEmailsReturned: false,
          },
          discoveryRunId: null,
          error: error instanceof Error ? error.message : "Live lookup failed.",
        });
      }
    }

    for (const companyName of targetCompanies.slice(3)) {
      results.push({
        companyName,
        domain: "",
        careersPageUrl: "",
        contactEmail: "",
        publicContactChannels: [],
        confidence: "low",
        foundSource:
          "Skipped in this run because Recruiter Scout limits live verification to three companies per request. Run a separate scout for this company.",
        teamKeywords: [],
        recruiterContacts: [],
        verificationPolicy: { guessedEmailsReturned: false },
        discoveryRunId: null,
      });
    }

    const verifiedEmails = results.reduce(
      (sum, result) =>
        sum +
        (result.recruiterContacts || []).filter(
          (contact) => contact.safeToContact && contact.workEmail,
        ).length,
      0,
    );
    const linkedinProfiles = results.reduce(
      (sum, result) => sum + (result.recruiterContacts || []).length,
      0,
    );

    if (createdTaskId) {
      try {
        await (supabase as any)
          .from("job_intelligence_tasks")
          .update({
            status: "completed",
            progress_current: SCOUT_PROGRESS.length,
            message: `Scout search completed for ${primaryCompany}. Found ${verifiedEmails} verified emails.`,
            result: { count: results.length, verifiedEmails },
            completed_at: new Date().toISOString(),
          })
          .eq("id", createdTaskId);
      } catch (err) {
        console.warn("Could not update scout_search task", err);
      }
    }

    return {
      status: "completed",
      content: formatCompanyScoutToMarkdown(results),
      output: {
        taskId: createdTaskId ? createdTaskId.slice(0, 8) : undefined,
        results,
        summary: {
          total: results.length,
          linkedinProfiles,
          verifiedEmails,
          companiesWithEvidence: results.filter(
            (result) =>
              result.confidence !== "low" ||
              Boolean(result.careersPageUrl) ||
              Boolean(result.recruiterContacts?.length),
          ).length,
        },
        progress: completedProgress,
        guardrails: {
          guessedEmailsReturned: false,
          automaticSending: false,
          requiresUserReview: true,
        },
      },
    };
  },
};
