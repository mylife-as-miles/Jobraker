import { describe, it, expect } from "vitest";
import {
  detectSkillPaletteTrigger,
  replaceSkillPaletteTrigger,
} from "@/lib/chatSkills/parser";
import {
  getSkillSuggestions,
  getPrimarySkillAlias,
  jobrakerChatSkills,
} from "@/lib/chatSkills/registry";

describe("Chat Skills Palette Triggers & Suggestions", () => {
  it("detects slash trigger when typing '/' at the beginning of chat", () => {
    const trigger = detectSkillPaletteTrigger("/");
    expect(trigger).not.toBeNull();
    expect(trigger?.mode).toBe("slash");
    expect(trigger?.query).toBe("");
    expect(trigger?.token).toBe("/");
  });

  it("detects mention trigger when typing '@' at the beginning of chat", () => {
    const trigger = detectSkillPaletteTrigger("@");
    expect(trigger).not.toBeNull();
    expect(trigger?.mode).toBe("mention");
    expect(trigger?.query).toBe("");
    expect(trigger?.token).toBe("@");
  });

  it("detects mention trigger in middle of sentence after a space", () => {
    const text = "Can you help me with @scout";
    const trigger = detectSkillPaletteTrigger(text, text.length);
    expect(trigger).not.toBeNull();
    expect(trigger?.mode).toBe("mention");
    expect(trigger?.query).toBe("scout");
    expect(trigger?.token).toBe("@scout");
  });

  it("detects slash trigger in middle of sentence after a space", () => {
    const text = "Please run /apply";
    const trigger = detectSkillPaletteTrigger(text, text.length);
    expect(trigger).not.toBeNull();
    expect(trigger?.mode).toBe("slash");
    expect(trigger?.query).toBe("apply");
    expect(trigger?.token).toBe("/apply");
  });

  it("returns full list of skills on empty query for '/' and '@'", () => {
    const slashSkills = getSkillSuggestions("", "slash");
    expect(slashSkills.length).toBeGreaterThan(5);

    const mentionSkills = getSkillSuggestions("", "mention");
    expect(mentionSkills.length).toBeGreaterThan(5);
  });

  it("matches skills by alias or query", () => {
    const scoutSkills = getSkillSuggestions("scout", "mention");
    expect(scoutSkills.some((s) => s.id === "company_scout")).toBe(true);

    const applySkills = getSkillSuggestions("apply", "slash");
    expect(applySkills.some((s) => s.id === "direct_apply")).toBe(true);

    const resumeSkills = getSkillSuggestions("resume", "slash");
    expect(resumeSkills.some((s) => s.id === "resume_tailor")).toBe(true);
  });

  it("correctly replaces the trigger token with selected skill alias", () => {
    const text = "Please use /";
    const trigger = detectSkillPaletteTrigger(text, text.length)!;
    const skill = jobrakerChatSkills.find((s) => s.id === "direct_apply")!;
    const alias = getPrimarySkillAlias(skill, trigger.mode);

    const result = replaceSkillPaletteTrigger(text, trigger, alias);
    expect(result).toBe(`Please use ${alias} `);
  });
});
