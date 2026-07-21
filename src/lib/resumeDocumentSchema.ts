import type { ResumeData } from "@/store/artboard";

export const CURRENT_RESUME_SCHEMA_VERSION = 2;

export type ResumeSourceType =
  | "template"
  | "profile"
  | "imported"
  | "edited"
  | "legacy";

const VALID_SOURCE_TYPES = new Set<ResumeSourceType>([
  "template",
  "profile",
  "imported",
  "edited",
  "legacy",
]);

export function getResumeSourceType(data: ResumeData): ResumeSourceType {
  const source = data.metadata.sourceType;
  return source && VALID_SOURCE_TYPES.has(source) ? source : "legacy";
}

export function migrateResumeDocument(
  data: ResumeData,
  fallbackSource: ResumeSourceType = "legacy",
): ResumeData {
  const currentVersion = Number(data.metadata.schemaVersion) || 0;
  const sourceType = getResumeSourceType(data) === "legacy"
    ? fallbackSource
    : getResumeSourceType(data);

  if (
    currentVersion === CURRENT_RESUME_SCHEMA_VERSION &&
    data.metadata.sourceType === sourceType
  ) {
    return data;
  }

  return {
    ...data,
    metadata: {
      ...data.metadata,
      schemaVersion: CURRENT_RESUME_SCHEMA_VERSION,
      sourceType,
    },
  };
}

export function withResumeSource(
  data: ResumeData,
  sourceType: Exclude<ResumeSourceType, "legacy">,
): ResumeData {
  return {
    ...data,
    metadata: {
      ...data.metadata,
      schemaVersion: CURRENT_RESUME_SCHEMA_VERSION,
      sourceType,
    },
  };
}

export function resumeNeedsLegacyRepair(
  data: ResumeData,
  legacyPlaceholderCheck: (candidate: ResumeData) => boolean,
): boolean {
  const sourceType = getResumeSourceType(data);
  if (sourceType === "template") return true;
  if (sourceType !== "legacy") return false;
  return legacyPlaceholderCheck(data);
}
