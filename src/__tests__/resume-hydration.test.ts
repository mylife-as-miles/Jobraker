import { describe, expect, it } from "vitest";
import { initialResumeState } from "@/store/artboard";
import {
  needsResumeRepair,
  normalizeResumeDataForEditor,
} from "@/lib/resumeHydration";

describe("resume hydration", () => {
  it("fills missing nested document fields without discarding content", () => {
    const normalized = normalizeResumeDataForEditor({
      title: "Backend Resume",
      basics: { name: "Ada Lovelace" },
      sections: {
        experience: {
          items: [{ id: "role-1", company: "Analytical Engines" }],
        },
      },
    });

    expect(normalized.title).toBe("Backend Resume");
    expect(normalized.basics.name).toBe("Ada Lovelace");
    expect(normalized.basics.website).toBeDefined();
    expect(normalized.sections.experience.items[0].company).toBe(
      "Analytical Engines",
    );
    expect(normalized.metadata.schemaVersion).toBeGreaterThan(0);
  });

  it("only repairs legacy or template placeholder documents", () => {
    const placeholder = structuredClone(initialResumeState.data);
    placeholder.metadata.sourceType = "edited";

    expect(needsResumeRepair(placeholder)).toBe(false);

    placeholder.metadata.sourceType = "legacy";
    expect(needsResumeRepair(placeholder)).toBe(true);
  });
});
