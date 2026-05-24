import type {
  DirectApplyOutput,
  DirectApplyResult,
  JobrakerChatSkill,
  SkillExecutionInput,
  SkillExecutionResult,
} from "./types";

const DIRECT_APPLY_PROGRESS = [
  "Reading request",
  "Searching official company channels",
  "Verifying application paths",
  "Preparing tailored drafts",
  "Ready for review",
];

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const textArg = (
  args: Record<string, unknown>,
  key: string,
  fallback: string,
) => {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
};

const numberArg = (
  args: Record<string, unknown>,
  key: string,
  fallback: number,
) => {
  const value = args[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
};

const titleCase = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const buildDraft = (companyName: string, role: string, location: string) => ({
  subject: `Application for ${role} at ${companyName}`,
  body: `Hi ${companyName} hiring team,\n\nI am interested in the ${role} opportunity${location ? ` for ${location}` : ""}. I can bring relevant execution, product, and technical experience, and I would like to share a tailored resume and short note for your review.\n\nBest,\nJobRaker Candidate`,
});

const buildMockResults = (
  args: Record<string, unknown>,
  instruction: string,
): DirectApplyResult[] => {
  const roleQuery = textArg(args, "roleQuery", "frontend developer");
  const role = titleCase(roleQuery.replace(/\broles?\b|\bjobs?\b/gi, "").trim());
  const location = textArg(args, "location", "");
  const industry = textArg(args, "industry", "");
  const limit = Math.min(numberArg(args, "limit", 5), 8);
  const lowerInstruction = instruction.toLowerCase();

  const companies =
    industry === "fintech" || lowerInstruction.includes("fintech")
      ? [
          {
            companyName: "Paystack",
            channelType: "careers_page" as const,
            channelValue: "https://paystack.com/careers",
            confidence: "high" as const,
            confidenceScore: 94,
            recommendedAction: "Apply through official careers page",
          },
          {
            companyName: "Flutterwave",
            channelType: "careers_page" as const,
            channelValue: "https://flutterwave.com/us/careers",
            confidence: "high" as const,
            confidenceScore: 91,
            recommendedAction: "Apply through official careers page",
          },
          {
            companyName: "Moniepoint",
            channelType: "careers_page" as const,
            channelValue: "https://moniepoint.com/careers",
            confidence: "high" as const,
            confidenceScore: 89,
            recommendedAction: "Apply through official careers page",
          },
          {
            companyName: "Kuda",
            channelType: "careers_page" as const,
            channelValue: "https://kuda.com/careers",
            confidence: "medium" as const,
            confidenceScore: 76,
            recommendedAction: "Review live openings before drafting",
          },
        ]
      : [
          {
            companyName: "Canonical",
            channelType: "careers_page" as const,
            channelValue: "https://canonical.com/careers",
            confidence: "high" as const,
            confidenceScore: 90,
            recommendedAction: "Apply through official careers page",
          },
          {
            companyName: "Andela",
            channelType: "careers_page" as const,
            channelValue: "https://www.andela.com/careers",
            confidence: "high" as const,
            confidenceScore: 88,
            recommendedAction: "Apply through official careers page",
          },
          {
            companyName: "SeamlessHR",
            channelType: "careers_page" as const,
            channelValue: "https://seamlesshr.com/careers",
            confidence: "medium" as const,
            confidenceScore: 73,
            recommendedAction: "Review role match before submitting",
          },
          {
            companyName: "Example Startup",
            channelType: "recruitment_email" as const,
            channelValue: "careers@example.com",
            confidence: "low" as const,
            confidenceScore: 48,
            recommendedAction: "Verify on official website before use",
          },
        ];

  return companies.slice(0, limit).map((company) => ({
    ...company,
    role,
    draftStatus:
      company.confidence === "low" ? "needs_review" : "ready_for_review",
    approvalStatus: "pending_user_review",
    draftPreview: buildDraft(company.companyName, role, location),
  }));
};

export const directApplySkill: JobrakerChatSkill = {
  id: "direct_apply",
  name: "Direct Apply",
  aliases: [
    "@DirectApply",
    "@CompanyOutreach",
    "/direct-apply",
    "/apply-direct",
    "/company-outreach",
  ],
  description:
    "Find verified company application channels and prepare direct application drafts.",
  icon: "send",
  category: "apply",
  triggerType: "both",
  inputSchema: {
    type: "object",
    properties: {
      roleQuery: { type: "string" },
      location: { type: "string" },
      limit: { type: "number" },
      industry: { type: "string" },
    },
  },
  statusStates: [
    "queued",
    "running",
    "needs_approval",
    "completed",
    "failed",
  ],
  execute: async (
    input: SkillExecutionInput,
  ): Promise<SkillExecutionResult<Record<string, unknown>>> => {
    // Guardrails for V1 and future live integrations:
    // - Only use official company websites, career pages, or public recruitment/contact emails.
    // - Do not scrape personal emails from LinkedIn or private profiles.
    // - Do not bypass CAPTCHAs, logins, or access controls.
    // - Do not send mass emails without user approval.
    // - Do not send applications automatically in V1.
    // - Prefer creating drafts for review.
    // - Mark uncertain emails as low confidence.
    // - Always show the user what will be sent before sending.
    // - Rate-limit future sending functionality.
    const completedProgress: string[] = [];

    for (const step of DIRECT_APPLY_PROGRESS) {
      completedProgress.push(step);
      input.progress?.(step);
      await delay(260);
    }

    const results = buildMockResults(input.args, input.userInstruction);
    const highConfidence = results.filter(
      (result) => result.confidence === "high",
    ).length;
    const lowConfidence = results.filter(
      (result) => result.confidence === "low",
    ).length;
    const output: DirectApplyOutput = {
      results,
      summary: {
        total: results.length,
        highConfidence,
        needsReview: results.length - highConfidence,
        lowConfidence,
      },
      progress: completedProgress,
      approvalStatus: "pending_user_review",
    };

    return {
      status: "needs_approval",
      content: `Direct Apply found ${results.length} possible direct application channels. Review the drafts before any application is sent.`,
      output: output as unknown as Record<string, unknown>,
    };
  },
};
