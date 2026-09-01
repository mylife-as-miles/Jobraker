import { invokeProtectedFunction } from "@/services/supabase/invokeProtectedFunction";
import { inferRoleFromContext, resolveTargetCompanies } from "./directApply";
import type {
  ColdMailOutput,
  JobrakerChatSkill,
  SkillExecutionInput,
  SkillExecutionResult,
} from "./types";

const COLD_MAIL_PROGRESS = [
  "Resolving individual job context",
  "Finding an evidence-backed recruiter contact",
  "Matching candidate evidence to the role",
  "Writing the cold email",
  "Preparing Gmail draft approval",
];

type ColdMailPrepareResponse = ColdMailOutput & {
  success: boolean;
  status: "needs_approval";
};

const asString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export type ColdMailJobReference = {
  jobTitle: string;
  companyName: string;
};

export const extractColdMailJobReferences = (
  content: string,
): ColdMailJobReference[] => {
  const references: ColdMailJobReference[] = [];
  const pattern =
    /^\s*\d+\.\s+(.+?)\s+at\s+(.+?)(?:\s+\([^\n)]*\))?\s*$/gim;
  for (const match of content.matchAll(pattern)) {
    const jobTitle = asString(match[1]);
    const companyName = asString(match[2]);
    if (jobTitle && companyName) references.push({ jobTitle, companyName });
  }
  return references;
};

export const selectColdMailJobReference = (
  references: ColdMailJobReference[],
  instruction: string,
) => {
  if (references.length === 1) return references[0];
  if (!references.length) return null;

  const normalized = instruction.toLowerCase();
  const ordinals = [
    /\b(?:first|1st|number\s+1)\b/i,
    /\b(?:second|2nd|number\s+2)\b/i,
    /\b(?:third|3rd|number\s+3)\b/i,
    /\b(?:fourth|4th|number\s+4)\b/i,
    /\b(?:fifth|5th|number\s+5)\b/i,
  ];
  const ordinalIndex = ordinals.findIndex((pattern) => pattern.test(instruction));
  if (ordinalIndex >= 0) return references[ordinalIndex] || null;

  const namedMatches = references.filter(
    (reference) =>
      normalized.includes(reference.companyName.toLowerCase()) ||
      normalized.includes(reference.jobTitle.toLowerCase()),
  );
  return namedMatches.length === 1 ? namedMatches[0] : null;
};

const contextText = (input: SkillExecutionInput) =>
  [
    input.userInstruction,
    ...(input.conversationContext || []).map((message) => message.content),
  ].join("\n");

const clarificationResult = (
  reason: string,
): SkillExecutionResult<Record<string, unknown>> => ({
  status: "completed",
  content: `### Cold Mail\n${reason}\n\nTry: \`@ColdMail draft for Backend Engineer at Acme\``,
  output: {
    needsClarification: {
      reason,
      suggestedPrompt: "@ColdMail draft for Backend Engineer at Acme",
    },
  },
});

export const coldMailSkill: JobrakerChatSkill = {
  id: "cold_mail",
  name: "Cold Mail",
  aliases: ["@ColdMail", "/cold-mail", "/cold-email"],
  description:
    "Research one job, find a verified recruiter contact, and create an approved Gmail draft.",
  icon: "mail",
  category: "writing",
  triggerType: "both",
  inputSchema: {
    type: "object",
    properties: {
      jobId: { type: "string" },
      companyName: { type: "string" },
      jobTitle: { type: "string" },
      instructions: { type: "string" },
    },
  },
  statusStates: ["queued", "running", "needs_approval", "completed", "failed"],
  execute: async (input) => {
    COLD_MAIL_PROGRESS.forEach((step) => input.progress?.(step));

    const explicitCompany =
      asString(input.args.companyName) || asString(input.args.company);
    const recentSearchReferences = (() => {
      for (const message of [...(input.conversationContext || [])].reverse()) {
        const references = extractColdMailJobReferences(message.content);
        if (references.length) return references;
      }
      return [] as ColdMailJobReference[];
    })();
    const selectedSearchJob = selectColdMailJobReference(
      recentSearchReferences,
      input.userInstruction,
    );
    if (
      !explicitCompany &&
      recentSearchReferences.length > 1 &&
      !selectedSearchJob
    ) {
      return clarificationResult(
        "Several jobs are in the current search. Choose one by company, role, or position number.",
      );
    }
    const targetCompanies = explicitCompany
      ? [explicitCompany]
      : selectedSearchJob
        ? [selectedSearchJob.companyName]
        : await resolveTargetCompanies(input);
    if (!targetCompanies.length) {
      return clarificationResult(
        "Select or name one job from the current job search before creating a cold email.",
      );
    }
    if (targetCompanies.length > 1) {
      return clarificationResult(
        "Cold Mail works on one individual job at a time. Name the company and role you want to use.",
      );
    }

    const fullContext = contextText(input);
    const jobTitle =
      asString(input.args.jobTitle) ||
      selectedSearchJob?.jobTitle ||
      inferRoleFromContext(input.args, fullContext, targetCompanies);
    const response = await invokeProtectedFunction<ColdMailPrepareResponse>(
      "cold-mail",
      {
        body: {
          action: "prepare",
          jobId: asString(input.args.jobId) || asString(input.args.job_id) || undefined,
          companyName: targetCompanies[0],
          jobTitle,
          instructions: input.userInstruction || undefined,
        },
      },
    );

    if (
      !response?.success ||
      !response.preparationToken ||
      !response.preparation
    ) {
      return {
        status: "failed",
        content: "Cold Mail could not prepare a verified Gmail draft.",
        output: { error: "cold_mail_preparation_failed" },
      };
    }

    return {
      status: "needs_approval",
      content: `### Cold Mail ready for review\nA verified draft for **${response.preparation.jobTitle}** at **${response.preparation.companyName}** is ready. Review it before creating it in Gmail.`,
      output: response as unknown as Record<string, unknown>,
    };
  },
};
