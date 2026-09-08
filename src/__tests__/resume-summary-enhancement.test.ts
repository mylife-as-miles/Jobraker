import { describe, expect, it } from "vitest";
import { initialResumeState } from "@/store/artboard";
import { buildSummaryEnhancementSource } from "@/lib/resumeSummaryEnhancement";

describe("resume summary enhancement", () => {
  it("uses the current summary as the enhancement source", () => {
    const resume = structuredClone(initialResumeState.data);
    resume.summary.content = "Product leader with eight years of experience.";

    expect(buildSummaryEnhancementSource(resume)).toBe(
      "Product leader with eight years of experience.",
    );
  });

  it("builds a truthful source from existing resume evidence when summary is empty", () => {
    const resume = structuredClone(initialResumeState.data);
    resume.summary.content = "";
    resume.basics.name = "Ada Lovelace";
    resume.basics.headline = "Platform Engineer";
    resume.sections.experience.items[0].position = "Staff Engineer";
    resume.sections.skills.items = [
      { id: "1", hidden: false, name: "TypeScript" },
      { id: "2", hidden: false, name: "PostgreSQL" },
    ];

    const source = buildSummaryEnhancementSource(resume);

    expect(source).toContain("Role: Platform Engineer");
    expect(source).toContain("Experience as Staff Engineer");
    expect(source).toContain("Core skills: TypeScript, PostgreSQL");
    expect(source).toContain("Candidate: Ada Lovelace");
  });
});
