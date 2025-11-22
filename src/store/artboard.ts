import type { ResumeData } from "@reactive-resume/schema";
import { create } from "zustand";

export type ArtboardStore = {
  resume: ResumeData | null;
  setResume: (resume: ResumeData) => void;
};

export const useArtboardStore = create<ArtboardStore>()((set) => ({
  resume: null,
  setResume: (resume) => {
    set({ resume });
  },
}));
