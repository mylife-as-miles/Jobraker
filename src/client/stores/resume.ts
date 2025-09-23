import { t } from "@lingui/macro";
import { createId } from "@paralleldrive/cuid2";
import type { ResumeDto } from "@reactive-resume/dto";
import type { CustomSectionGroup, SectionKey } from "@reactive-resume/schema";
import { defaultSection } from "@reactive-resume/schema";
import { removeItemInLayout } from "@reactive-resume/utils";
import _set from "lodash.set";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import { debouncedUpdateResume } from "../services/resume";

const defaultResume: any = {
  id: "local:placeholder",
  title: "Builder",
  slug: "builder",
  visibility: "private",
  data: {
    sections: {
      basics: {},
      summary: { name: "Summary", visible: true, content: "" },
      experience: { name: "Experience", visible: true, items: [] },
      education: { name: "Education", visible: true, items: [] },
      skills: { name: "Skills", visible: true, items: [] },
      languages: { name: "Languages", visible: true, items: [] },
      awards: { name: "Awards", visible: true, items: [] },
      certifications: { name: "Certifications", visible: true, items: [] },
      interests: { name: "Interests", visible: true, items: [] },
      projects: { name: "Projects", visible: true, items: [] },
      publications: { name: "Publications", visible: true, items: [] },
      volunteer: { name: "Volunteer", visible: true, items: [] },
      references: { name: "References", visible: true, items: [] },
      custom: {},
    },
    metadata: {
      template: "classic",
      theme: { primary: "#4f46e5", background: "#ffffff", text: "#0f172a" },
      typography: {},
      css: "",
      page: { options: { breakLine: true, pageNumbers: true } },
      layout: [[["summary", "experience"], ["skills"]]],
      ui: { kickstartDismissed: false },
    },
  },
};

type ResumeStore = {
  resume: ResumeDto;
  setValue: (path: string, value: unknown) => void;
  addSection: () => void;
  removeSection: (sectionId: SectionKey) => void;
};

export const useResumeStore = create<ResumeStore>()(
  devtools(
    immer((set) => ({
      resume: defaultResume as ResumeDto,
      setValue: (path, value) => {
        set((state) => {
          if (path === "visibility") {
            state.resume.visibility = value as "public" | "private";
          } else {
            state.resume.data = _set(state.resume.data, path, value);
          }
          // Skip network update for local/offline drafts
          const id = state.resume?.id as unknown as string | undefined;
          const isLocal = !id || (typeof id === "string" && id.startsWith("local:"));
          if (!isLocal) {
            void debouncedUpdateResume(JSON.parse(JSON.stringify(state.resume)));
          }
        });
      },
      addSection: () => {
        const section: CustomSectionGroup = {
          ...defaultSection,
          id: createId(),
          name: t`Custom Section`,
          items: [],
        };
        set((state) => {
          const lastPageIndex = state.resume.data.metadata.layout.length - 1;
          state.resume.data.metadata.layout[lastPageIndex][0].push(`custom.${section.id}`);
          state.resume.data = _set(state.resume.data, `sections.custom.${section.id}`, section);
          void debouncedUpdateResume(JSON.parse(JSON.stringify(state.resume)));
        });
      },
      removeSection: (sectionId: SectionKey) => {
        if (sectionId.startsWith("custom.")) {
          const id = sectionId.split("custom.")[1];
          set((state) => {
            removeItemInLayout(sectionId, state.resume.data.metadata.layout);
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete state.resume.data.sections.custom[id];
            void debouncedUpdateResume(JSON.parse(JSON.stringify(state.resume)));
          });
        }
      },
    }))
  )
);

// Minimal stub: UI may call undo/redo; no-op implementations provided
export const useTemporalResumeStore = <T>(
  selector: (state: { undo: () => void; redo: () => void }) => T,
  _equality?: (a: T, b: T) => boolean,
) => selector({ undo: () => {}, redo: () => {} });
