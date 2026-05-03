import { create } from "zustand";

// --- Reactive Resume Types ---

export interface ResumeProfile {
  network: string;
  username: string;
  url: string;
  icon?: string;
}

export interface ResumeBasics {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  website: { url: string; label: string };
  customFields: { id: string; icon: string; text: string; link?: string }[];
  picture?: {
    url: string;
    size: number;
    aspectRatio: number;
    borderRadius: number;
    effects: {
      hidden: boolean;
      border: boolean;
      grayscale: boolean;
    };
  };
  profiles?: ResumeProfile[];
}

export interface ResumeSectionItem {
  id: string;
  hidden: boolean;
  // Common fields
  name?: string;
  title?: string;
  company?: string;
  school?: string;
  degree?: string;
  date?: string;
  period?: string;
  location?: string;
  website?: { url: string; label: string };
  description?: string;

  // Skills specific
  level?: number;
  keywords?: string[];

  // Other specific fields can be added as needed
  [key: string]: any;
}

export interface ResumeSection {
  id: string;
  title: string;
  columns: number;
  hidden: boolean;
  items: ResumeSectionItem[];
  content?: string; // For summary
  type?: "basic" | "list" | "custom";
}

export interface ResumeData {
  title: string;
  basics: ResumeBasics;
  summary: ResumeSection; // Summary is treated as a section with content
  sections: {
    experience: ResumeSection;
    education: ResumeSection;
    skills: ResumeSection;
    projects: ResumeSection;
    languages: ResumeSection;
    interests: ResumeSection;
    awards: ResumeSection;
    certifications: ResumeSection;
    publications: ResumeSection;
    volunteer: ResumeSection;
    references: ResumeSection;
    // Add others as needed
    [key: string]: ResumeSection;
  };
  slug: string;
  tags: string[];
  metadata: {
    template: string;
    layout: {
      sidebarWidth: number;
      pages: {
        fullWidth: boolean;
        main: string[];
        sidebar: string[];
      }[];
    };
    page: {
      format: "a4" | "letter";
      margin: number;
      options?: {
        pageNumbers: boolean;
        breakLine: boolean;
      };
    };
    typography: {
      font: {
        family: string;
        size: number;
        lineHeight: number;
        paragraphSpacing: number;
      };
    };
    css?: {
      value: string;
      visible: boolean;
    };
    theme?: {
      primary: string;
      text: string;
      background: string;
    };
  };
}

export interface ResumeState {
  id: string; // Database ID
  is_public?: boolean;
  views?: number;
  downloads?: number;
  data: ResumeData;
}

// --- Cover Letter Types (Unchanged) ---
export interface CoverLetterState {
  id: string; // Database ID
  title: string;
  slug: string;
  tags: string[];
  role: string;
  company: string;
  jobDescription: string;
  tone: "professional" | "friendly" | "enthusiastic";
  lengthPref: "short" | "medium" | "long";
  // Sender
  sender: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  // Recipient
  recipient: {
    name: string;
    title: string;
    company: string;
    address: string;
  };
  // Content
  content: {
    date: string;
    subject: string;
    salutation: string;
    paragraphs: string[];
    closing: string;
    signature: string;
    rawBody: string;
  };
  // Visuals
  typography: {
    fontSize: number;
  };
}

// --- Store Interface ---
export type ArtboardStore = {
  resume: ResumeState;
  coverLetter: CoverLetterState;

  // Resume Actions
  setResume: (resume: Partial<ResumeState>) => void;
  setResumeId: (id: string) => void;
  resetResume: () => void;

  // Helper to update deep nested resume data
  setResumeData: (data: Partial<ResumeData>) => void;
  setResumeTitle: (title: string) => void;
  setResumeSlug: (slug: string) => void;
  setResumeTags: (tags: string[]) => void;

  // Metadata Actions
  updateTheme: (theme: Partial<ResumeData["metadata"]["theme"]>) => void;
  updateTypography: (
    typography: Partial<ResumeData["metadata"]["typography"]["font"]>,
  ) => void;
  updatePage: (page: Partial<ResumeData["metadata"]["page"]>) => void;
  updateLayout: (layout: Partial<ResumeData["metadata"]["layout"]>) => void;

  // Section Actions
  addSectionItem: (sectionId: string, item: ResumeSectionItem) => void;
  updateSectionItem: (
    sectionId: string,
    itemId: string,
    item: Partial<ResumeSectionItem>,
  ) => void;
  removeSectionItem: (sectionId: string, itemId: string) => void;

  addSection: (section: ResumeSection) => void;
  removeSection: (sectionId: string) => void;
  toggleSectionVisibility: (sectionId: string) => void;
  reorderSection: (sectionId: string, direction: "up" | "down") => void;
  togglePublicSharing: (enabled: boolean) => void;

  // Basics Actions
  updateBasics: (basics: Partial<ResumeBasics>) => void;

  // Cover Letter Actions
  setCoverLetter: (coverLetter: Partial<CoverLetterState>) => void;
  setCoverLetterId: (id: string) => void;
  setCoverLetterTitle: (title: string) => void;
  setCoverLetterSlug: (slug: string) => void;
  setCoverLetterTags: (tags: string[]) => void;
  resetCoverLetter: () => void;

  setCoverLetterField: <K extends keyof CoverLetterState>(
    field: K,
    data: CoverLetterState[K],
  ) => void;
  setCoverLetterNested: <
    K extends "sender" | "recipient" | "content" | "typography",
    F extends keyof CoverLetterState[K],
  >(
    section: K,
    field: F,
    value: CoverLetterState[K][F],
  ) => void;
};

// --- Initial State ---
export const initialResumeState: ResumeState = {
  id: "",
  is_public: false,
  views: 0,
  downloads: 0,
  data: {
    title: "Untitled Resume",
    slug: "untitled-resume",
    tags: [],
    basics: {
      name: "John Doe",
      headline: "Senior Software Engineer",
      email: "john@example.com",
      phone: "+1 (555) 123-4567",
      location: "San Francisco, CA",
      website: { url: "johndoe.dev", label: "Portfolio" },
      customFields: [],
      profiles: [],
    },
    summary: {
      id: "summary",
      title: "Summary",
      columns: 1,
      hidden: false,
      content:
        "Experienced software engineer with a focus on building scalable web applications.",
      items: [],
      type: "basic",
    },
    sections: {
      experience: {
        id: "experience",
        title: "Experience",
        columns: 1,
        hidden: false,
        items: [
          {
            id: "1",
            hidden: false,
            company: "TechCorp Inc.",
            position: "Senior Developer",
            period: "2020 - Present",
            description:
              "Led a team of 5 engineers to rebuild the core payment infrastructure.",
          },
          {
            id: "2",
            hidden: false,
            company: "StartupXY",
            position: "Software Engineer",
            period: "2018 - 2020",
            description: "Developed and maintained RESTful APIs.",
          },
        ],
        type: "basic",
      },
      education: {
        id: "education",
        title: "Education",
        columns: 1,
        hidden: false,
        items: [
          {
            id: "1",
            hidden: false,
            school: "Stanford University",
            degree: "B.S. Computer Science",
            period: "2014 - 2018",
          },
        ],
        type: "basic",
      },
      skills: {
        id: "skills",
        title: "Skills",
        columns: 1,
        hidden: false,
        items: [
          { id: "1", hidden: false, name: "JavaScript", level: 5 },
          { id: "2", hidden: false, name: "React", level: 5 },
          { id: "3", hidden: false, name: "Node.js", level: 4 },
        ],
        type: "list",
      },
      projects: {
        id: "projects",
        title: "Projects",
        columns: 1,
        hidden: true,
        items: [],
        type: "basic",
      },
      languages: {
        id: "languages",
        title: "Languages",
        columns: 1,
        hidden: true,
        items: [],
        type: "list",
      },
      interests: {
        id: "interests",
        title: "Interests",
        columns: 1,
        hidden: true,
        items: [],
        type: "list",
      },
      awards: {
        id: "awards",
        title: "Awards",
        columns: 1,
        hidden: true,
        items: [],
        type: "basic",
      },
      certifications: {
        id: "certifications",
        title: "Certifications",
        columns: 1,
        hidden: true,
        items: [],
        type: "basic",
      },
      publications: {
        id: "publications",
        title: "Publications",
        columns: 1,
        hidden: true,
        items: [],
        type: "basic",
      },
      volunteer: {
        id: "volunteer",
        title: "Volunteering",
        columns: 1,
        hidden: true,
        items: [],
        type: "basic",
      },
      references: {
        id: "references",
        title: "References",
        columns: 1,
        hidden: true,
        items: [],
        type: "basic",
      },
    },
    metadata: {
      template: "azurill",
      layout: {
        sidebarWidth: 30,
        pages: [
          {
            fullWidth: false,
            main: [
              "summary",
              "experience",
              "education",
              "projects",
              "certifications",
              "publications",
              "volunteer",
              "references",
              "awards",
            ],
            sidebar: ["skills", "languages", "interests"],
          },
        ],
      },
      page: {
        format: "a4",
        margin: 18,
        options: {
          pageNumbers: false,
          breakLine: false,
        },
      },
      typography: {
        font: {
          family: "IBM Plex Serif",
          size: 14,
          lineHeight: 1.5,
          paragraphSpacing: 8,
        },
      },
      theme: {
        primary: "rgba(79, 57, 246, 1)",
        text: "rgba(0, 0, 0, 1)",
        background: "rgba(255, 255, 255, 1)",
      },
    },
  },
};

const SIDEBAR_SECTION_IDS = new Set(["skills", "languages", "interests"]);

const shouldUseSidebarLayout = (section: Pick<ResumeSection, "id" | "type">) =>
  section.type === "list" || SIDEBAR_SECTION_IDS.has(section.id);

export const useArtboardStore = create<ArtboardStore>((set) => ({
  resume: initialResumeState,
  coverLetter: {
    id: "",
    title: "Untitled Cover Letter",
    slug: "untitled-cover-letter",
    tags: [],
    role: "",
    company: "",
    jobDescription: "",
    tone: "professional",
    lengthPref: "medium",
    sender: {
      name: "",
      email: "",
      phone: "",
      address: "",
    },
    recipient: {
      name: "",
      title: "",
      company: "",
      address: "",
    },
    content: {
      date: new Date().toISOString().slice(0, 10),
      subject: "",
      salutation: "Dear Hiring Manager,",
      paragraphs: [],
      closing: "Best regards,",
      signature: "",
      rawBody: "",
    },
    typography: {
      fontSize: 16,
    },
  },

  // Resume Actions
  setResume: (resume) =>
    set((state) => ({ resume: { ...state.resume, ...resume } })),

  setResumeId: (id) => set((state) => ({ resume: { ...state.resume, id } })),

  resetResume: () =>
    set(() => ({ resume: structuredClone(initialResumeState) })),

  setResumeData: (data) =>
    set((state) => ({
      resume: { ...state.resume, data: { ...state.resume.data, ...data } },
    })),

  setResumeTitle: (title) =>
    set((state) => ({
      resume: { ...state.resume, data: { ...state.resume.data, title } },
    })),

  setResumeSlug: (slug) =>
    set((state) => ({
      resume: { ...state.resume, data: { ...state.resume.data, slug } },
    })),

  setResumeTags: (tags) =>
    set((state) => ({
      resume: { ...state.resume, data: { ...state.resume.data, tags } },
    })),

  updateTheme: (theme) =>
    set((state) => ({
      resume: {
        ...state.resume,
        data: {
          ...state.resume.data,
          metadata: {
            ...state.resume.data.metadata,
            theme: {
              ...state.resume.data.metadata.theme!,
              ...theme,
            },
          },
        },
      },
    })),

  updateTypography: (font) =>
    set((state) => ({
      resume: {
        ...state.resume,
        data: {
          ...state.resume.data,
          metadata: {
            ...state.resume.data.metadata,
            typography: {
              ...state.resume.data.metadata.typography,
              font: {
                ...state.resume.data.metadata.typography.font,
                ...font,
              },
            },
          },
        },
      },
    })),

  updatePage: (page) =>
    set((state) => ({
      resume: {
        ...state.resume,
        data: {
          ...state.resume.data,
          metadata: {
            ...state.resume.data.metadata,
            page: {
              ...state.resume.data.metadata.page,
              ...page,
            },
          },
        },
      },
    })),

  updateLayout: (layout) =>
    set((state) => ({
      resume: {
        ...state.resume,
        data: {
          ...state.resume.data,
          metadata: {
            ...state.resume.data.metadata,
            layout: {
              ...state.resume.data.metadata.layout,
              ...layout,
            },
          },
        },
      },
    })),

  addSectionItem: (sectionId, item) =>
    set((state) => ({
      resume: {
        ...state.resume,
        data: {
          ...state.resume.data,
          sections: {
            ...state.resume.data.sections,
            [sectionId]: {
              ...state.resume.data.sections[sectionId],
              items: [item, ...state.resume.data.sections[sectionId].items],
            },
          },
        },
      },
    })),

  updateSectionItem: (sectionId, itemId, item) =>
    set((state) => ({
      resume: {
        ...state.resume,
        data: {
          ...state.resume.data,
          sections: {
            ...state.resume.data.sections,
            [sectionId]: {
              ...state.resume.data.sections[sectionId],
              items: state.resume.data.sections[sectionId].items.map((i) =>
                i.id === itemId ? { ...i, ...item } : i,
              ),
            },
          },
        },
      },
    })),

  removeSectionItem: (sectionId, itemId) =>
    set((state) => ({
      resume: {
        ...state.resume,
        data: {
          ...state.resume.data,
          sections: {
            ...state.resume.data.sections,
            [sectionId]: {
              ...state.resume.data.sections[sectionId],
              items: state.resume.data.sections[sectionId].items.filter(
                (i) => i.id !== itemId,
              ),
            },
          },
        },
      },
    })),

  addSection: (section) =>
    set((state) => {
      const existingPages = state.resume.data.metadata.layout.pages;
      const page = existingPages[0] ?? {
        fullWidth: false,
        main: [],
        sidebar: [],
      };
      const existsInLayout =
        page.main.includes(section.id) || page.sidebar.includes(section.id);
      const nextFirstPage = existsInLayout
        ? page
        : shouldUseSidebarLayout(section)
          ? { ...page, sidebar: [...page.sidebar, section.id] }
          : { ...page, main: [...page.main, section.id] };
      const nextPages =
        existingPages.length > 0
          ? [nextFirstPage, ...existingPages.slice(1)]
          : [nextFirstPage];

      return {
        resume: {
          ...state.resume,
          data: {
            ...state.resume.data,
            sections: {
              ...state.resume.data.sections,
              [section.id]: { ...section, hidden: false },
            },
            metadata: {
              ...state.resume.data.metadata,
              layout: {
                ...state.resume.data.metadata.layout,
                pages: nextPages,
              },
            },
          },
        },
      };
    }),

  removeSection: (sectionId) =>
    set((state) => {
      // Check if it's a custom section (not in the default list)
      const isCustom = ![
        "experience",
        "education",
        "skills",
        "projects",
        "languages",
        "interests",
        "awards",
        "certifications",
        "publications",
        "volunteer",
        "references",
      ].includes(sectionId);

      if (isCustom) {
        // Remove from sections and layout
        const newSections = { ...state.resume.data.sections };
        delete newSections[sectionId];

        const page = state.resume.data.metadata.layout.pages[0];
        return {
          resume: {
            ...state.resume,
            data: {
              ...state.resume.data,
              sections: newSections,
              metadata: {
                ...state.resume.data.metadata,
                layout: {
                  ...state.resume.data.metadata.layout,
                  pages: [
                    {
                      ...page,
                      main: page.main.filter((id) => id !== sectionId),
                      sidebar: page.sidebar.filter((id) => id !== sectionId),
                    },
                  ],
                },
              },
            },
          },
        };
      }

      return {
        resume: {
          ...state.resume,
          data: {
            ...state.resume.data,
            sections: {
              ...state.resume.data.sections,
              [sectionId]: {
                ...state.resume.data.sections[sectionId],
                hidden: true,
              },
            },
          },
        },
      };
    }),

  toggleSectionVisibility: (sectionId) =>
    set((state) => {
      const section = state.resume.data.sections[sectionId];
      const nextHidden = !section.hidden;
      const existingPages = state.resume.data.metadata.layout.pages;
      const page = existingPages[0] ?? {
        fullWidth: false,
        main: [],
        sidebar: [],
      };
      const existsInLayout =
        page.main.includes(sectionId) || page.sidebar.includes(sectionId);
      const nextFirstPage =
        !nextHidden && !existsInLayout
          ? shouldUseSidebarLayout(section)
            ? { ...page, sidebar: [...page.sidebar, sectionId] }
            : { ...page, main: [...page.main, sectionId] }
          : page;
      const nextPages =
        existingPages.length > 0
          ? [nextFirstPage, ...existingPages.slice(1)]
          : [nextFirstPage];

      return {
        resume: {
          ...state.resume,
          data: {
            ...state.resume.data,
            sections: {
              ...state.resume.data.sections,
              [sectionId]: {
                ...section,
                hidden: nextHidden,
              },
            },
            metadata: {
              ...state.resume.data.metadata,
              layout: {
                ...state.resume.data.metadata.layout,
                pages: nextPages,
              },
            },
          },
        },
      };
    }),

  reorderSection: (sectionId, direction) =>
    set((state) => {
      // Simplified: only reorders within the first page main/sidebar
      // Finds where the section is and moves it
      const layout = state.resume.data.metadata.layout.pages[0];
      const newMain = [...layout.main];
      const newSidebar = [...layout.sidebar];

      const moveInArray = (arr: string[], id: string, dir: "up" | "down") => {
        const idx = arr.indexOf(id);
        if (idx === -1) return arr;
        if (dir === "up" && idx > 0) {
          [arr[idx], arr[idx - 1]] = [arr[idx - 1], arr[idx]];
        } else if (dir === "down" && idx < arr.length - 1) {
          [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
        }
        return arr;
      };

      return {
        resume: {
          ...state.resume,
          data: {
            ...state.resume.data,
            metadata: {
              ...state.resume.data.metadata,
              layout: {
                ...state.resume.data.metadata.layout,
                pages: [
                  {
                    ...layout,
                    main: moveInArray(newMain, sectionId, direction),
                    sidebar: moveInArray(newSidebar, sectionId, direction),
                  },
                  ...state.resume.data.metadata.layout.pages.slice(1),
                ],
              },
            },
          },
        },
      };
    }),

  togglePublicSharing: (enabled) =>
    set((state) => ({
      resume: {
        ...state.resume,
        is_public: enabled,
      },
    })),

  updateBasics: (basics) =>
    set((state) => ({
      resume: {
        ...state.resume,
        data: {
          ...state.resume.data,
          basics: { ...state.resume.data.basics, ...basics },
        },
      },
    })),

  // Cover Letter Actions
  setCoverLetter: (coverLetter) =>
    set((state) => ({ coverLetter: { ...state.coverLetter, ...coverLetter } })),

  setCoverLetterId: (id) =>
    set((state) => ({ coverLetter: { ...state.coverLetter, id } })),

  setCoverLetterTitle: (title) =>
    set((state) => ({ coverLetter: { ...state.coverLetter, title } })),

  setCoverLetterSlug: (slug) =>
    set((state) => ({ coverLetter: { ...state.coverLetter, slug } })),

  setCoverLetterTags: (tags) =>
    set((state) => ({ coverLetter: { ...state.coverLetter, tags } })),

  resetCoverLetter: () =>
    set((state) => ({
      coverLetter: {
        id: "",
        title: "Untitled Cover Letter",
        slug: "untitled-cover-letter",
        tags: [],
        role: "",
        company: "",
        jobDescription: "",
        tone: "professional",
        lengthPref: "medium",
        sender: { name: "", email: "", phone: "", address: "" },
        recipient: { name: "", title: "", company: "", address: "" },
        content: {
          date: new Date().toISOString().slice(0, 10),
          subject: "",
          salutation: "Dear Hiring Manager,",
          paragraphs: [],
          closing: "Best regards,",
          signature: "",
          rawBody: "",
        },
        typography: { fontSize: 16 },
      },
    })),

  setCoverLetterField: (field, data) =>
    set((state) => ({ coverLetter: { ...state.coverLetter, [field]: data } })),

  setCoverLetterNested: (section, field, value) =>
    set((state) => ({
      coverLetter: {
        ...state.coverLetter,
        [section]: {
          ...state.coverLetter[section],
          [field]: value,
        },
      },
    })),
}));
