import type { ResumeDto } from "@reactive-resume/dto";
import { defaultSections, defaultMetadata } from "@/lib/reactive-resume-schema";

export type NormalizationReport = {
  addedSections: string[];
  addedMetadata: boolean;
};

export function buildDefaultResumeData() {
  const sectionEntries = Object.keys(defaultSections).map(key => [key, { id: key, name: defaultSections[key].name, items: [] }]);
  const sections = Object.fromEntries(sectionEntries);
  return {
    basics: { name: "", email: "", phone: "", location: "", url: "", picture: { url: "", enabled: false } },
    sections,
    metadata: {
      template: "pikachu",
      layout: [[Object.keys(defaultSections)]],
      page: { format: "A4", margin: 24 },
      theme: { primary: "#1dff00", text: "#ffffff", background: "#000000" },
      typography: { font: { family: "Inter", variants: ["400"], subset: "latin", size: 14 }, lineHeight: 1.4, hideIcons: false, underlineLinks: false },
      css: { visible: false, value: "" },
      ...(defaultMetadata || {}),
    } as any,
  } as any;
}

export function normalizeResume(resume: ResumeDto): { resume: ResumeDto; report: NormalizationReport } {
  const report: NormalizationReport = { addedSections: [], addedMetadata: false };
  if (!resume.data) (resume as any).data = buildDefaultResumeData();
  const data: any = resume.data;
  if (!data.sections || typeof data.sections !== 'object') {
    data.sections = buildDefaultResumeData().sections;
    report.addedSections = Object.keys(defaultSections);
  }
  for (const key of Object.keys(defaultSections)) {
    if (!data.sections[key]) {
      data.sections[key] = { id: key, name: defaultSections[key].name, items: [] };
      report.addedSections.push(key);
    }
  }
  if (!data.metadata) {
    data.metadata = buildDefaultResumeData().metadata;
    report.addedMetadata = true;
  }
  if (!Array.isArray(data.metadata.layout)) {
    data.metadata.layout = [[Object.keys(defaultSections)]];
  }
  // Fire analytics if anything added
  if (typeof window !== 'undefined' && (report.addedMetadata || report.addedSections.length)) {
    try {
      window.dispatchEvent(new CustomEvent('analytics', { detail: { type: 'resume_normalized', ...report, id: (resume as any).id } }));
    } catch {}
  }
  return { resume, report };
}
