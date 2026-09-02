import {
  initialResumeState,
  type ResumeData,
  type ResumeState,
} from "@/store/artboard";
import {
  migrateResumeDocument,
  resumeNeedsLegacyRepair,
} from "@/lib/resumeDocumentSchema";

export function buildHydratedResumeState(
  remoteResume: any,
  data = initialResumeState.data,
): ResumeState {
  return {
    id: remoteResume.id,
    is_public: remoteResume.public_share_enabled,
    share_token: remoteResume.share_token || null,
    views: remoteResume.views || 0,
    downloads: remoteResume.downloads || 0,
    data,
  };
}

function fallbackSection(sectionId: string, section?: Record<string, any>) {
  return {
    id: section?.id || sectionId,
    title:
      section?.title ||
      sectionId.charAt(0).toUpperCase() + sectionId.slice(1).replace(/-/g, " "),
    columns: 1,
    hidden: false,
    items: [],
    type: "basic" as const,
  };
}

function mergeResumeSection(
  baseSection: any,
  sectionId: string,
  section?: Record<string, any>,
) {
  const fallback = baseSection ?? fallbackSection(sectionId, section);

  return {
    ...fallback,
    ...section,
    id: section?.id || fallback.id,
    title: section?.title || fallback.title,
    columns: section?.columns ?? fallback.columns,
    hidden: section?.hidden ?? fallback.hidden,
    items: Array.isArray(section?.items) ? section.items : fallback.items,
    type: section?.type ?? fallback.type,
  };
}

export function normalizeResumeDataForEditor(
  data: unknown,
  fallbackTitle?: string,
): ResumeData {
  const base = structuredClone(initialResumeState.data);

  if (!data || typeof data !== "object") {
    return { ...base, title: fallbackTitle || base.title };
  }

  const source = data as Record<string, any>;
  const mergedSections = { ...base.sections } as typeof base.sections;

  for (const [sectionId, section] of Object.entries(
    (source.sections as Record<string, Record<string, any>>) ?? {},
  )) {
    mergedSections[sectionId] = mergeResumeSection(
      mergedSections[sectionId],
      sectionId,
      section,
    );
  }

  const sourceBasics = source.basics as Record<string, any> | undefined;
  const sourceSummary = source.summary as Record<string, any> | undefined;
  const sourceMetadata = source.metadata as Record<string, any> | undefined;

  const normalized = {
    ...base,
    ...source,
    title:
      typeof source.title === "string" && source.title.trim()
        ? source.title
        : fallbackTitle || base.title,
    basics: {
      ...base.basics,
      ...sourceBasics,
      website: { ...base.basics.website, ...(sourceBasics?.website ?? {}) },
      customFields: Array.isArray(sourceBasics?.customFields)
        ? sourceBasics.customFields
        : base.basics.customFields,
      profiles: Array.isArray(sourceBasics?.profiles)
        ? sourceBasics.profiles
        : base.basics.profiles,
      picture: sourceBasics?.picture ?? base.basics.picture,
    },
    summary: {
      ...base.summary,
      ...sourceSummary,
      items: Array.isArray(sourceSummary?.items)
        ? sourceSummary.items
        : base.summary.items,
    },
    sections: mergedSections,
    metadata: {
      ...base.metadata,
      ...sourceMetadata,
      schemaVersion: sourceMetadata?.schemaVersion,
      sourceType: sourceMetadata?.sourceType ?? "legacy",
      layout: {
        ...base.metadata.layout,
        ...(sourceMetadata?.layout ?? {}),
        pages: Array.isArray(sourceMetadata?.layout?.pages)
          ? sourceMetadata.layout.pages
          : base.metadata.layout.pages,
      },
      page: {
        ...base.metadata.page,
        ...(sourceMetadata?.page ?? {}),
        options: {
          ...base.metadata.page.options,
          ...(sourceMetadata?.page?.options ?? {}),
        },
      },
      typography: {
        ...base.metadata.typography,
        ...(sourceMetadata?.typography ?? {}),
        font: {
          ...base.metadata.typography.font,
          ...(sourceMetadata?.typography?.font ?? {}),
          paragraphSpacing:
            typeof sourceMetadata?.typography?.font?.paragraphSpacing ===
            "number"
              ? sourceMetadata.typography.font.paragraphSpacing
              : base.metadata.typography.font.paragraphSpacing,
        },
      },
      theme: {
        ...base.metadata.theme,
        ...(sourceMetadata?.theme ?? {}),
      },
    },
  } as ResumeData;

  return migrateResumeDocument(normalized);
}

function normalizedValue(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isPlaceholderField(value: unknown, fallback: string) {
  const valueNormalized = normalizedValue(value);
  return !valueNormalized || valueNormalized === normalizedValue(fallback);
}

function matchesTemplateFields(
  item: Record<string, unknown> | undefined,
  template: Record<string, unknown> | undefined,
  fields: string[],
) {
  if (!item || !template) return false;
  return fields.every(
    (field) => normalizedValue(item[field]) === normalizedValue(template[field]),
  );
}

export function looksLikePlaceholderResumeData(
  data: ResumeData | null | undefined,
) {
  if (!data || typeof data !== "object") return true;

  const defaultData = initialResumeState.data;
  const basics = data.basics ?? {};
  const summary = data.summary ?? {};
  const experienceItems = data.sections?.experience?.items ?? [];
  const educationItems = data.sections?.education?.items ?? [];
  const skillItems = data.sections?.skills?.items ?? [];
  const placeholderBasicsCount = [
    isPlaceholderField(basics.name, defaultData.basics.name),
    isPlaceholderField(basics.headline, defaultData.basics.headline),
    isPlaceholderField(basics.email, defaultData.basics.email),
    isPlaceholderField(basics.phone, defaultData.basics.phone),
    isPlaceholderField(basics.location, defaultData.basics.location),
  ].filter(Boolean).length;
  const structuralPlaceholderCount = [
    isPlaceholderField(data.title, defaultData.title),
    isPlaceholderField(summary.content, defaultData.summary.content || ""),
    experienceItems.some((item: any, index: number) =>
      matchesTemplateFields(item, defaultData.sections.experience.items[index], [
        "company",
        "position",
      ]),
    ),
    educationItems.some((item: any, index: number) =>
      matchesTemplateFields(item, defaultData.sections.education.items[index], [
        "school",
        "degree",
      ]),
    ),
    skillItems.length > 0 &&
      skillItems.every((item: any, index: number) =>
        matchesTemplateFields(item, defaultData.sections.skills.items[index], [
          "name",
        ]),
      ),
    isPlaceholderField(basics.website?.url, defaultData.basics.website.url) &&
      isPlaceholderField(
        basics.website?.label,
        defaultData.basics.website.label,
      ),
  ].filter(Boolean).length;

  return (
    (placeholderBasicsCount >= 4 && structuralPlaceholderCount >= 1) ||
    structuralPlaceholderCount >= 2
  );
}

export function needsResumeRepair(data: ResumeData | null | undefined) {
  return Boolean(
    data && resumeNeedsLegacyRepair(data, looksLikePlaceholderResumeData),
  );
}
