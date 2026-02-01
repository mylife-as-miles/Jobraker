import { create } from 'zustand';

export type ArtboardStore = {
  resume: {
    metadata: {
      page: {
        format: 'a4' | 'letter';
        options?: {
          pageNumbers?: boolean;
          breakLine?: boolean;
        };
      };
      typography: {
        font: {
          family: string;
        };
      };
    };
  } | null;
  setResume: (resume: any) => void;
};

export const useArtboardStore = create<ArtboardStore>((set) => ({
  resume: {
    metadata: {
      page: {
        format: 'a4',
      },
      typography: {
        font: {
          family: 'Inter',
        },
      },
    },
  },
  setResume: (resume) => set({ resume }),
}));
