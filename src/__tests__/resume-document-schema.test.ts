import { describe, expect, it } from "vitest";
import { initialResumeState } from "@/store/artboard";
import {
  CURRENT_RESUME_SCHEMA_VERSION,
  getResumeSourceType,
  migrateResumeDocument,
  resumeNeedsLegacyRepair,
  withResumeSource,
} from "@/lib/resumeDocumentSchema";

describe("resume document schema", () => {
  it("versions legacy documents without changing their content", () => {
    const legacy = structuredClone(initialResumeState.data);
    delete legacy.metadata.schemaVersion;
    delete legacy.metadata.sourceType;
    legacy.basics.name = "Real Candidate";

    const migrated = migrateResumeDocument(legacy);
    expect(migrated.basics.name).toBe("Real Candidate");
    expect(migrated.metadata.schemaVersion).toBe(CURRENT_RESUME_SCHEMA_VERSION);
    expect(migrated.metadata.sourceType).toBe("legacy");
  });

  it("does not apply placeholder heuristics to explicitly sourced documents", () => {
    const incomplete = withResumeSource(structuredClone(initialResumeState.data), "edited");
    incomplete.basics.name = "";
    const heuristic = () => true;

    expect(resumeNeedsLegacyRepair(incomplete, heuristic)).toBe(false);
    expect(getResumeSourceType(incomplete)).toBe("edited");
  });

  it("repairs explicit templates and legacy placeholders only", () => {
    const template = structuredClone(initialResumeState.data);
    const legacy = structuredClone(initialResumeState.data);
    delete legacy.metadata.sourceType;

    expect(resumeNeedsLegacyRepair(template, () => false)).toBe(true);
    expect(resumeNeedsLegacyRepair(legacy, () => true)).toBe(true);
    expect(resumeNeedsLegacyRepair(legacy, () => false)).toBe(false);
  });
});
