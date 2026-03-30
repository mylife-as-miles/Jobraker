type ResumeDisplaySource = {
  name?: string | null;
  data?: {
    title?: string | null;
    basics?: {
      name?: string | null;
    } | null;
  } | null;
};

const COVER_LETTER_NAME_PATTERN = /^cover(?:[_\s-]*letter)(?:[_\s-]|$)/i;

function cleanLabel(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function looksLikeCoverLetterLabel(value: unknown): boolean {
  return COVER_LETTER_NAME_PATTERN.test(cleanLabel(value));
}

export function getResumeDisplayName(resume: ResumeDisplaySource): string {
  const storedName = cleanLabel(resume?.name);
  if (storedName && !looksLikeCoverLetterLabel(storedName)) {
    return storedName;
  }

  const dataTitle = cleanLabel(resume?.data?.title);
  if (dataTitle && !looksLikeCoverLetterLabel(dataTitle)) {
    return dataTitle;
  }

  const basicsName = cleanLabel(resume?.data?.basics?.name);
  if (basicsName) {
    return `${basicsName}'s Resume`;
  }

  return storedName || dataTitle || "Untitled Resume";
}

export function normalizeResumeRecordName<T extends ResumeDisplaySource>(
  resume: T,
): T {
  const displayName = getResumeDisplayName(resume);
  if (resume.name === displayName) {
    return resume;
  }

  return {
    ...resume,
    name: displayName,
  };
}
