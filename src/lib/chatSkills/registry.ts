import { directApplySkill } from "./directApply";
import { outreachWriterSkill } from "./outreachWriter";
import { companyScoutSkill } from "./companyScout";
import { heartbeatCheckupSkill } from "./heartbeatCheckup";
import { coldMailSkill } from "./coldMail";
import {
  addPortalSkill,
  htmlReportSkill,
  interviewPrepSkill,
  outcomeSkill,
  upskillSkill,
} from "./careerCommands";
import type {
  JobrakerChatSkill,
  SkillExecutionInput,
  SkillExecutionResult,
  SkillTrigger,
} from "./types";

const createPlaceholderSkill = (
  skill: Omit<JobrakerChatSkill, "execute" | "statusStates" | "inputSchema">,
): JobrakerChatSkill => ({
  ...skill,
  inputSchema: {
    type: "object",
    properties: {
      instruction: { type: "string" },
    },
  },
  statusStates: ["queued", "running", "completed", "failed"],
  execute: async (
    input: SkillExecutionInput,
  ): Promise<SkillExecutionResult<Record<string, unknown>>> => ({
    status: "completed",
    content: `${skill.name} is registered in the chat skill system. Its live workflow can now be connected behind this handler.`,
    output: {
      skillId: skill.id,
      instruction: input.userInstruction,
      scaffold: true,
    },
  }),
});

export const jobrakerChatSkills: JobrakerChatSkill[] = [
  directApplySkill,
  companyScoutSkill,
  coldMailSkill,
  outreachWriterSkill,
  heartbeatCheckupSkill,
  interviewPrepSkill,
  outcomeSkill,
  addPortalSkill,
  upskillSkill,
  htmlReportSkill,
  createPlaceholderSkill({
    id: "rtrvr_job_hunter",
    name: "RTRVR Job Hunter",
    aliases: ["@RTRVR", "@JobHunter", "/rtrvr", "/job-hunter", "/scrape-jobs", "/live-jobs"],
    description: "Search and extract live job openings across LinkedIn, Indeed, Glassdoor, and Y Combinator.",
    icon: "search",
    category: "discovery",
    triggerType: "both",
  }),
  createPlaceholderSkill({
    id: "auto_apply",
    name: "Auto Apply",
    aliases: ["@AutoApply", "/auto-apply", "/apply-url"],
    description: "Automatically parse job posting and execute automated application submission.",
    icon: "send",
    category: "apply",
    triggerType: "both",
  }),
  createPlaceholderSkill({
    id: "email_outreach",
    name: "Email Outreach & Drafts",
    aliases: ["@Email", "@EmailComposer", "/write-email", "/draft-email", "/send-email", "/email"],
    description: "Compose, draft, and send recruiter emails via your connected Composio Gmail.",
    icon: "mail",
    category: "writing",
    triggerType: "both",
  }),
  createPlaceholderSkill({
    id: "resume_tailor",
    name: "Resume Tailor",
    aliases: ["@ResumeTailor", "@Resume", "/resume", "/resume-tailor", "/tailor-resume"],
    description: "Tailor CV, resume, and profile evidence to a selected role.",
    icon: "file-text",
    category: "profile",
    triggerType: "both",
  }),
  createPlaceholderSkill({
    id: "jobs_summary",
    name: "Jobs Summary",
    aliases: ["@Jobs", "@JobSearch", "/jobs", "/search-jobs", "/find-jobs"],
    description: "Search and summarize recent active job openings matching your profile.",
    icon: "search",
    category: "discovery",
    triggerType: "both",
  }),
  createPlaceholderSkill({
    id: "application_insights",
    name: "Application Insights",
    aliases: ["@Applications", "@Pipeline", "/applications", "/pipeline", "/app-insights"],
    description: "Analyze your active application pipeline, stages, and response rates.",
    icon: "file-text",
    category: "tracking",
    triggerType: "both",
  }),
  createPlaceholderSkill({
    id: "follow_up",
    name: "Follow Up",
    aliases: ["@FollowUp", "/follow-up"],
    description: "Prepare follow-up messages for previous applications.",
    icon: "clock",
    category: "tracking",
    triggerType: "both",
  }),
  createPlaceholderSkill({
    id: "help_menu",
    name: "Help & Commands",
    aliases: ["@Help", "/help", "/commands"],
    description: "Show available skills and career assistant commands.",
    icon: "clock",
    category: "system",
    triggerType: "both",
  }),
];

export const getSkillById = (skillId: string) =>
  jobrakerChatSkills.find((skill) => skill.id === skillId);

export const getPrimarySkillAlias = (
  skill: JobrakerChatSkill,
  trigger: SkillTrigger,
) => {
  const prefix = trigger === "mention" ? "@" : "/";
  return skill.aliases.find((alias) => alias.startsWith(prefix)) || skill.name;
};

export const getSkillSuggestions = (
  query: string,
  trigger: SkillTrigger,
): JobrakerChatSkill[] => {
  const normalizedQuery = query.trim().toLowerCase();
  const prefix = trigger === "mention" ? "@" : "/";

  return jobrakerChatSkills.filter((skill) => {
    if (skill.triggerType !== "both" && skill.triggerType !== trigger) {
      return false;
    }

    if (!normalizedQuery) return true;

    const searchable = [
      skill.name,
      skill.description,
      skill.category,
      ...skill.aliases,
    ]
      .join(" ")
      .toLowerCase();

    return (
      searchable.includes(normalizedQuery) ||
      skill.aliases.some((alias) =>
        alias.toLowerCase().includes(`${prefix}${normalizedQuery}`),
      )
    );
  });
};

export const executeChatSkill = async (
  input: SkillExecutionInput,
): Promise<SkillExecutionResult<Record<string, unknown>>> => {
  const skill = getSkillById(input.skillId);
  if (!skill) {
    return {
      status: "failed",
      content: "That JobRaker skill is not registered yet.",
      output: { error: "skill_not_found", skillId: input.skillId },
    };
  }

  return skill.execute(input);
};
