import type { ResumeData } from "@/store/artboard";

type SectionKey = keyof ResumeData["sections"];

export type TemplateProps = {
  columns: SectionKey[][];
  isFirstPage?: boolean;
};
