import { invokeProtectedFunction } from "@/services/supabase/invokeProtectedFunction";
import { inferRoleFromContext, resolveTargetCompanies } from "./directApply";
import type {
  ColdMailDiscoveryOutput,
  ColdMailOutput,
  ColdMailTarget,
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

type ColdMailDiscoverResponse = ColdMailDiscoveryOutput;

const asString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export type ColdMailJobReference = {
  jobTitle: string;
  companyName: string;
  applyUrl?: string;
};

export const extractColdMailJobReferences = (
  content: string,
): ColdMailJobReference[] => {
  const references: ColdMailJobReference[] = [];
  const lines = content.split(/\r?\n/);
  const pattern = /^\s*\d+\.\s+(.+?)\s+at\s+(.+?)(?:\s+\([^)]*\))?\s*$/i;
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(pattern);
    if (!match) continue;
    const jobTitle = asString(match[1]);
    const companyName = asString(match[2]);
    const applyUrl = asString(lines[index + 1]).match(/^https?:\/\/\S+$/i)?.[0];
    if (jobTitle && companyName) {
      references.push({
        jobTitle,
        companyName,
        ...(applyUrl ? { applyUrl } : {}),
      });
    }
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

export const selectColdMailTarget = (
  targets: ColdMailTarget[],
  instruction: string,
) => {
  const selected = selectColdMailJobReference(targets, instruction);
  return selected as ColdMailTarget | null;
};

const parseColdMailTargets = (value: unknown): ColdMailTarget[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (target): target is Record<string, unknown> =>
        Boolean(target) && typeof target === "object" && !Array.isArray(target),
    )
    .map((target) => ({
      jobId: asString(target.jobId),
      searchResultId: asString(target.searchResultId) || undefined,
      jobTitle: asString(target.jobTitle),
      companyName: asString(target.companyName),
      applyUrl: asString(target.applyUrl),
      location: asString(target.location) || undefined,
      source: asString(target.source) || undefined,
    }))
    .filter(
      (target) =>
        Boolean(
          target.jobId &&
            target.jobTitle &&
            target.companyName &&
            target.applyUrl,
        ),
    );
};

const discoveryMarkdown = (response: ColdMailDiscoverResponse) => {
  if (!response.targets.length) {
    return `### Cold Mail\nNo new opportunities were found for **${response.searchQuery}** in **${response.location}**. Add a role or location to refine the search.`;
  }
  const rows = response.targets.map(
    (target, index) =>
      `${index + 1}. ${target.jobTitle} at ${target.companyName}${
        target.location ? ` (${target.location})` : ""
      }\n   ${target.applyUrl}`,
  );
  return `### Choose one company target\nI found ${response.targets.length} opportunities for **${response.searchQuery}**. Select one job before recruiter research and email drafting continue.\n\n${rows.join("\n")}`;
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
      applyUrl: { type: "string" },
      instructions: { type: "string" },
    },
  },
  statusStates: ["queued", "running", "needs_approval", "completed", "failed"],
  execute: async (input) => {
    const explicitCompany =
      asString(input.args.companyName) || asString(input.args.company);
    const structuredTargets = parseColdMailTargets(input.args.coldMailTargets);
    const selectedStructuredTarget = selectColdMailTarget(
      structuredTargets,
      input.userInstruction,
    );
    const recentSearchReferences = (() => {
      for (const message of [...(input.conversationContext || [])].reverse()) {
        const references = extractColdMailJobReferences(message.content);
        if (references.length) return references;
      }
      return [] as ColdMailJobReference[];
    })();
    const selectedSearchJob =
      selectedStructuredTarget ||
      selectColdMailJobReference(recentSearchReferences, input.userInstruction);
    if (
      !explicitCompany &&
      Math.max(structuredTargets.length, recentSearchReferences.length) > 1 &&
      !selectedSearchJob
    ) {
      return clarificationResult(
        "Several jobs are in the current search. Choose one by company, role, or position number.",
      );
    }

    if (
      !explicitCompany &&
      !selectedSearchJob &&
      !structuredTargets.length &&
      !recentSearchReferences.length
    ) {
      input.progress?.("Searching configured opportunity sources");
      const response = await invokeProtectedFunction<ColdMailDiscoverResponse>(
        "cold-mail",
        {
          body: {
            action: "discover",
            searchQuery: asString(input.args.roleQuery) || undefined,
            location: asString(input.args.location) || undefined,
            limit: Math.min(
              10,
              Math.max(1, Number(input.args.limit) || 10),
            ),
          },
        },
      );
      if (!response?.success || !Array.isArray(response.targets)) {
        return {
          status: "failed",
          content: "Cold Mail could not search for opportunity targets.",
          output: { error: "cold_mail_discovery_failed" },
        };
      }
      return {
        status: "completed",
        content: discoveryMarkdown(response),
        output: response as unknown as Record<string, unknown>,
      };
    }

    input.progress?.(COLD_MAIL_PROGRESS[0]);
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
          jobId:
            asString(input.args.jobId) ||
            asString(input.args.job_id) ||
            selectedStructuredTarget?.jobId ||
            undefined,
          companyName: targetCompanies[0],
          jobTitle,
          applyUrl:
            asString(input.args.applyUrl) || selectedSearchJob?.applyUrl || undefined,
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

    COLD_MAIL_PROGRESS.slice(1).forEach((step) => input.progress?.(step));

    return {
      status: "needs_approval",
      content: `### Cold Mail ready for review\nA verified draft for **${response.preparation.jobTitle}** at **${response.preparation.companyName}** is ready. Review it before creating it in Gmail.`,
      output: response as unknown as Record<string, unknown>,
    };
  },
};
