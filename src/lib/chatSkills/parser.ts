import {
  getPrimarySkillAlias,
  getSkillById,
  jobrakerChatSkills,
} from "./registry";
import type {
  JobrakerChatSkill,
  ParsedSkillCall,
  SkillPaletteTrigger,
  SkillTrigger,
} from "./types";

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const emptySkillCall = (): ParsedSkillCall => ({
  detected: false,
  skillId: "",
  trigger: "mention",
  rawCommand: "",
  userInstruction: "",
  args: {},
});

const aliasTrigger = (alias: string): SkillTrigger | null => {
  if (alias.startsWith("@")) return "mention";
  if (alias.startsWith("/")) return "slash";
  return null;
};

const findAliasMatch = (
  message: string,
  skill: JobrakerChatSkill,
  alias: string,
) => {
  const trigger = aliasTrigger(alias);
  if (!trigger) return null;

  const command = alias.slice(1);
  const commandPattern =
    trigger === "slash"
      ? `\\/\\s*${escapeRegExp(command)}`
      : escapeRegExp(alias);
  const regex = new RegExp(`(^|\\s)(${commandPattern})(?=\\s|$)`, "i");
  const match = regex.exec(message);

  if (!match) return null;

  return {
    skill,
    trigger,
    index: match.index + match[1].length,
    end: match.index + match[0].length,
    rawCommand: match[2].replace(/\/\s+/, "/"),
  };
};

const extractArgs = (instruction: string): Record<string, unknown> => {
  const args: Record<string, unknown> = {};
  const limitMatch = instruction.match(/\b(\d{1,2})\b/);
  const locationMatch = instruction.match(
    /\b(?:in|near|around)\s+([a-z][a-z\s-]{1,40})(?=\s|$|,|\.)/i,
  );

  if (limitMatch) {
    args.limit = Math.min(Number(limitMatch[1]), 25);
  }

  if (/\bremote\b/i.test(instruction)) {
    args.location = "Remote";
  } else if (locationMatch) {
    args.location = locationMatch[1]
      .replace(/\b(roles?|jobs?|companies|hiring|developers?)\b.*$/i, "")
      .trim();
  } else if (/\blagos\b/i.test(instruction)) {
    args.location = "Lagos";
  }

  if (/\bfintech\b/i.test(instruction)) {
    args.industry = "fintech";
  }

  const roleQuery = instruction
    .replace(/\b\d{1,2}\b/g, " ")
    .replace(/\b(apply|direct|directly|to|for|find|official|verified)\b/gi, " ")
    .replace(/\b(companies?|company|channels?|emails?|recruitment)\b/gi, " ")
    .replace(/\b(hiring|roles?|jobs?|openings?|vacancies?)\b/gi, " ")
    .replace(/\b(these|those|this|that|public|safe|possible)\b/gi, " ")
    .replace(/\b(in|near|around)\s+[a-z][a-z\s-]{1,40}$/i, " ")
    .replace(/\b(lagos|nigeria|remote|fintech)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (roleQuery) {
    args.roleQuery = roleQuery;
  }

  return args;
};

export const parseSkillCall = (message: string): ParsedSkillCall => {
  const trimmed = message.trim();
  if (!trimmed) return emptySkillCall();

  const matches = jobrakerChatSkills.flatMap((skill) =>
    skill.aliases
      .map((alias) => findAliasMatch(trimmed, skill, alias))
      .filter((match): match is NonNullable<typeof match> => Boolean(match)),
  );

  if (!matches.length) return emptySkillCall();

  const match = matches.sort((a, b) => a.index - b.index)[0];
  const userInstruction = `${trimmed.slice(0, match.index)} ${trimmed.slice(
    match.end,
  )}`
    .replace(/\s+/g, " ")
    .trim();

  return {
    detected: true,
    skillId: match.skill.id,
    trigger: match.trigger,
    rawCommand: match.rawCommand,
    userInstruction,
    args: extractArgs(userInstruction),
  };
};

export const detectSkillPaletteTrigger = (
  value: string,
  caretPosition = value.length,
): SkillPaletteTrigger | null => {
  const beforeCaret = value.slice(0, caretPosition);
  const match = /(^|\s)([@/][\w-]*)$/.exec(beforeCaret);
  if (!match) return null;

  const token = match[2];
  const mode: SkillTrigger = token.startsWith("@") ? "mention" : "slash";

  return {
    mode,
    query: token.slice(1),
    token,
    start: match.index + match[1].length,
    end: caretPosition,
  };
};

export const replaceSkillPaletteTrigger = (
  value: string,
  trigger: SkillPaletteTrigger,
  replacement: string,
) => `${value.slice(0, trigger.start)}${replacement} ${value.slice(trigger.end)}`;

export const getDisplayCommandForSkill = (
  skillId: string,
  trigger: SkillTrigger,
) => {
  const skill = getSkillById(skillId);
  return skill ? getPrimarySkillAlias(skill, trigger) : "";
};
