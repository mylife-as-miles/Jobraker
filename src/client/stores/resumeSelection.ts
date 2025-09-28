import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ResumeSelectionState {
  selected: string[];
  lastSelected: string | null;
}

interface ResumeSelectionActions {
  selectOnly: (id: string) => void;
  toggle: (id: string) => void;
  addMany: (ids: string[]) => void;
  clear: () => void;
  setLast: (id: string | null) => void;
  selectAll: (ids: string[]) => void;
}

export const useResumeSelection = create<ResumeSelectionState & ResumeSelectionActions>()(
  persist(
    (set, get) => ({
      selected: [],
      lastSelected: null,
      selectOnly: (id) => set({ selected: [id], lastSelected: id }),
      toggle: (id) => {
        const { selected } = get();
        if (selected.includes(id)) {
          set({ selected: selected.filter(s => s !== id), lastSelected: id });
        } else {
          set({ selected: [...selected, id], lastSelected: id });
        }
      },
      addMany: (ids) => {
        const uniq = new Set([...get().selected, ...ids]);
        set({ selected: Array.from(uniq) });
      },
      clear: () => set({ selected: [], lastSelected: null }),
      setLast: (id) => set({ lastSelected: id }),
      selectAll: (ids) => set({ selected: [...ids], lastSelected: ids[ids.length - 1] || null }),
    }),
    { name: 'resume-selection', partialize: (s) => ({ selected: s.selected }) }
  )
);
