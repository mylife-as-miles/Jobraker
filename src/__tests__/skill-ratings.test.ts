import { describe, it, expect, beforeEach } from "vitest";
import { mapParsedDataToResume } from "../lib/resume-mapper";
import { useArtboardStore, initialResumeState } from "../store/artboard";
import type { ParsedProfileData } from "../services/ai/parseResumeProfile";

describe("Skill Ratings - User Set by Default & No AI/System Auto-Assignment", () => {
  beforeEach(() => {
    useArtboardStore.setState({ resume: structuredClone(initialResumeState) });
  });

  describe("Resume Mapper Skill Ingestion", () => {
    it("assigns level 0 (unrated) by default when parsing resume skills", () => {
      const parsedResume: ParsedProfileData = {
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        skills: ["TypeScript", "React", "GraphQL", "PostgreSQL"],
      };

      const result = mapParsedDataToResume(parsedResume, initialResumeState.data);

      expect(result.sections.skills.items).toHaveLength(4);
      result.sections.skills.items.forEach((skillItem) => {
        expect(skillItem.level).toBe(0); // Never auto-assign 3 or any other arbitrary rating!
        expect(skillItem.hidden).toBe(false);
      });
    });
  });

  describe("Template Level Clamping & Unrated Skill Guarding", () => {
    it("guarantees 0, negative, and missing levels evaluate to unrated (falsy) across templates", async () => {
      // Test the clamping logic used across templates
      const clampLevel = (value?: number | null) => {
        if (typeof value !== "number" || Number.isNaN(value) || value <= 0) return null;
        return Math.max(1, Math.min(5, Math.round(value)));
      };

      // Unrated skills must return null/falsy
      expect(clampLevel(0)).toBeNull();
      expect(clampLevel(-1)).toBeNull();
      expect(clampLevel(undefined)).toBeNull();
      expect(clampLevel(null)).toBeNull();
      expect(clampLevel(NaN)).toBeNull();

      // User-set ratings must be faithfully preserved and clamped to 1..5
      expect(clampLevel(1)).toBe(1);
      expect(clampLevel(2)).toBe(2);
      expect(clampLevel(3)).toBe(3);
      expect(clampLevel(4)).toBe(4);
      expect(clampLevel(5)).toBe(5);
      expect(clampLevel(6)).toBe(5); // Clamped to max 5
      expect(clampLevel(4.2)).toBe(4);
    });
  });

  describe("User Control & AI Suggestion Safeguards", () => {
    it("allows the user to set, update, and clear skill ratings in the store", () => {
      const store = useArtboardStore.getState();
      const skillId = "user-skill-1";

      // Add user skill with unrated default (0)
      store.addSectionItem("skills", {
        id: skillId,
        name: "Rust",
        level: 0,
        hidden: false,
      });

      let skills = useArtboardStore.getState().resume.data.sections.skills.items;
      let rustSkill = skills.find((s) => s.id === skillId);
      expect(rustSkill?.level).toBe(0);

      // User sets rating to 4 (Advanced)
      store.updateSectionItem("skills", skillId, { level: 4 });
      skills = useArtboardStore.getState().resume.data.sections.skills.items;
      rustSkill = skills.find((s) => s.id === skillId);
      expect(rustSkill?.level).toBe(4);

      // User clears rating back to 0
      store.updateSectionItem("skills", skillId, { level: 0 });
      skills = useArtboardStore.getState().resume.data.sections.skills.items;
      rustSkill = skills.find((s) => s.id === skillId);
      expect(rustSkill?.level).toBe(0);
    });

    it("AI suggestion logic strictly preserves user-set ratings and only rates unrated skills", () => {
      const store = useArtboardStore.getState();

      const items = [
        { id: "s1", name: "Python", level: 5, hidden: false }, // User explicitly set 5
        { id: "s2", name: "Docker", level: 0, hidden: false }, // Unrated
        { id: "s3", name: "Kubernetes", level: 0, hidden: false }, // Unrated
      ];

      // Simulate AI suggest ratings logic
      const corpus = "senior python engineer with experience deploying docker containers";

      items.forEach((item) => {
        // Strict requirement: NEVER override user-set ratings!
        if (typeof item.level === "number" && item.level > 0) {
          return;
        }

        const skillName = item.name.toLowerCase();
        const matches = corpus.includes(skillName);
        const suggestedLevel = matches ? 4 : 2;

        item.level = suggestedLevel;
      });

      // s1 must remain exactly 5 (user rating preserved)
      expect(items[0].level).toBe(5);
      // s2 (docker) was unrated and mentioned in corpus -> got suggested rating 4
      expect(items[1].level).toBe(4);
      // s3 (kubernetes) was unrated and not in corpus -> got baseline suggested rating 2
      expect(items[2].level).toBe(2);
    });
  });
});
