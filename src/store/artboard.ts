import type { ResumeData } from "@reactive-resume/schema";
import { create } from "zustand";

import { buildDefaultResumeData } from "@/client/utils/normalize-resume";

export type ArtboardStore = {
  resume: ResumeData;
  setResume: (resume: ResumeData) => void;
};

export const useArtboardStore = create<ArtboardStore>()((set) => ({
  resume: buildDefaultResumeData(),
  setResume: (resume) => {
    set({ resume });
  },
}));
