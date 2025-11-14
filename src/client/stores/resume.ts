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

type ResumeStore = {
  resume: ResumeDto;
  setValue: (path: string, value: unknown) => void;
  addSection: () => void;
  removeSection: (sectionId: SectionKey) => void;
};

export const useResumeStore = create<ResumeStore>()(
  devtools(
    immer((set) => ({
      resume: {} as ResumeDto,
      setValue: (path, value) => {
        set((state) => {
          if (path === "visibility") {
            state.resume.visibility = value as "public" | "private";
          } else {
            state.resume.data = _set(state.resume.data, path, value);
          }
          void debouncedUpdateResume(JSON.parse(JSON.stringify(state.resume)));
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
          if (!state.resume?.data?.metadata?.layout) return;
          const lastPageIndex = state.resume.data.metadata.layout.length - 1;
          if (lastPageIndex >= 0 && state.resume.data.metadata.layout[lastPageIndex]?.[0]) {
            state.resume.data.metadata.layout[lastPageIndex][0].push(`custom.${section.id}`);
          }
          state.resume.data = _set(state.resume.data, `sections.custom.${section.id}`, section);
          void debouncedUpdateResume(JSON.parse(JSON.stringify(state.resume)));
        });
      },
      removeSection: (sectionId: SectionKey) => {
        if (sectionId.startsWith("custom.")) {
          const id = sectionId.split("custom.")[1];
          set((state) => {
            if (!state.resume?.data?.metadata?.layout) return;
            removeItemInLayout(sectionId, state.resume.data.metadata.layout);
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            if (state.resume.data.sections?.custom) {
              delete state.resume.data.sections.custom[id];
            }
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
