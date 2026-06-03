import { directApplySkill } from "./directApply";
import { outreachWriterSkill } from "./outreachWriter";
import { companyScoutSkill } from "./companyScout";
import { heartbeatCheckupSkill } from "./heartbeatCheckup";
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
  outreachWriterSkill,
  heartbeatCheckupSkill,
  createPlaceholderSkill({
    id: "resume_tailor",
    name: "Resume Tailor",
    aliases: ["@ResumeTailor", "/resume-tailor", "/tailor-resume"],
    description: "Tailor CV, resume, and profile evidence to a selected role.",
    icon: "file-text",
    category: "profile",
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
      ...skill.aliases.filter((alias) => alias.startsWith(prefix)),
    ]
      .join(" ")
      .toLowerCase();

    return searchable.includes(normalizedQuery);
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
