import type { ResumeData } from "../store/artboard";

const SIDEBAR_SECTION_IDS = new Set(["skills", "languages", "interests"]);

const uniqueOrderedSections = (sectionIds: string[] = []) => {
  const seen = new Set<string>();

  return sectionIds.filter((sectionId) => {
    if (!sectionId || seen.has(sectionId)) return false;
    seen.add(sectionId);
    return true;
  });
};

export const resolveResumePageLayout = (
  resumeData: ResumeData,
  pageIndex = 0,
) => {
  const storedPage = resumeData.metadata.layout.pages[pageIndex];
  const main = uniqueOrderedSections(storedPage?.main ?? []);
  const sidebar = uniqueOrderedSections(storedPage?.sidebar ?? []);
  const seen = new Set([...main, ...sidebar]);

  if (!resumeData.summary.hidden && !seen.has("summary")) {
    main.unshift("summary");
    seen.add("summary");
  }

  Object.values(resumeData.sections).forEach((section) => {
    if (!section || section.hidden || seen.has(section.id)) return;

    const targetBucket =
      section.type === "list" || SIDEBAR_SECTION_IDS.has(section.id)
        ? sidebar
        : main;

    targetBucket.push(section.id);
    seen.add(section.id);
  });

  const fullWidth = storedPage?.fullWidth ?? false;

  if (fullWidth) {
    return {
      fullWidth,
      main: uniqueOrderedSections([...main, ...sidebar]),
      sidebar: [],
    };
  }

  return {
    fullWidth,
    main,
    sidebar,
  };
};
