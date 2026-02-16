import { create } from 'zustand';

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
           format: 'a4' | 'letter';
           margin: number;
        };
        typography: {
            font: {
                family: string;
                size: number;
            };
        };
        css?: {
            value: string;
            visible: boolean;
        }
    };
}

export interface ResumeState {
    data: ResumeData;
}

// --- Cover Letter Types (Unchanged) ---
export interface CoverLetterState {
    id: string;
    title: string;
    role: string;
    company: string;
    jobDescription: string;
    tone: 'professional' | 'friendly' | 'enthusiastic';
    lengthPref: 'short' | 'medium' | 'long';
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
    resetResume: () => void;
    
    // Helper to update deep nested resume data
    setResumeData: (data: Partial<ResumeData>) => void;
    setResumeTitle: (title: string) => void;
    setResumeSlug: (slug: string) => void;
    setResumeTags: (tags: string[]) => void;
    
    // Section Actions
    addSectionItem: (sectionId: string, item: ResumeSectionItem) => void;
    updateSectionItem: (sectionId: string, itemId: string, item: Partial<ResumeSectionItem>) => void;
    removeSectionItem: (sectionId: string, itemId: string) => void;
    
    // Basics Actions
    updateBasics: (basics: Partial<ResumeBasics>) => void;
    
    // Cover Letter Actions
    setCoverLetter: (coverLetter: Partial<CoverLetterState>) => void;
    setCoverLetterTitle: (title: string) => void;
    setCoverLetterField: <K extends keyof CoverLetterState>(field: K, data: CoverLetterState[K]) => void;
    setCoverLetterNested: <K extends 'sender' | 'recipient' | 'content' | 'typography', F extends keyof CoverLetterState[K]>(
        section: K,
        field: F,
        value: CoverLetterState[K][F]
    ) => void;
};

// --- Initial State ---
const initialResumeState: ResumeState = {
    data: {
        title: 'Untitled Resume',
        slug: 'untitled-resume',
        tags: [],
        basics: {
            name: 'John Doe',
            headline: 'Senior Software Engineer',
            email: 'john@example.com',
            phone: '+1 (555) 123-4567',
            location: 'San Francisco, CA',
            website: { url: 'johndoe.dev', label: 'Portfolio' },
            customFields: []
        },
        summary: {
            id: 'summary',
            title: 'Summary',
            columns: 1,
            hidden: false,
            content: 'Experienced software engineer with a focus on building scalable web applications.',
            items: []
        },
        sections: {
            experience: {
                id: 'experience',
                title: 'Experience',
                columns: 1,
                hidden: false,
                items: [
                    {
                        id: '1',
                        hidden: false,
                        company: 'TechCorp Inc.',
                        position: 'Senior Developer',
                        period: '2020 - Present',
                        description: 'Led a team of 5 engineers to rebuild the core payment infrastructure.'
                    },
                    {
                         id: '2',
                        hidden: false,
                        company: 'StartupXY',
                        position: 'Software Engineer',
                        period: '2018 - 2020',
                        description: 'Developed and maintained RESTful APIs.'
                    }
                ]
            },
            education: {
                id: 'education',
                title: 'Education',
                columns: 1,
                hidden: false,
                items: [
                    {
                        id: '1',
                        hidden: false,
                        school: 'Stanford University',
                        degree: 'B.S. Computer Science',
                        period: '2014 - 2018'
                    }
                ]
            },
            skills: {
                id: 'skills',
                title: 'Skills',
                columns: 1,
                hidden: false,
                items: [
                   { id: '1', hidden: false, name: 'JavaScript', level: 5 },
                   { id: '2', hidden: false, name: 'React', level: 5 },
                   { id: '3', hidden: false, name: 'Node.js', level: 4 }
                ]
            },
            projects: {
                id: 'projects',
                title: 'Projects',
                columns: 1,
                hidden: false,
                items: []
            }
        },
        metadata: {
            template: 'azurill',
            layout: {
                sidebarWidth: 30,
                pages: [
                    {
                        fullWidth: false,
                        main: ['summary', 'experience', 'education', 'projects'],
                        sidebar: ['skills']
                    }
                ]
            },
            page: {
                format: 'a4',
                margin: 18
            },
            typography: {
                font: {
                    family: 'IBM Plex Serif',
                    size: 14
                }
            }
        }
    }
};

export const useArtboardStore = create<ArtboardStore>((set) => ({
    resume: initialResumeState,
    coverLetter: {
        id: crypto.randomUUID(),
        title: 'Untitled Cover Letter',
        role: '',
        company: '',
        jobDescription: '',
        tone: 'professional',
        lengthPref: 'medium',
        sender: {
            name: '',
            email: '',
            phone: '',
            address: ''
        },
        recipient: {
            name: '',
            title: '',
            company: '',
            address: ''
        },
        content: {
            date: new Date().toISOString().slice(0, 10),
            subject: '',
            salutation: 'Dear Hiring Manager,',
            paragraphs: [],
            closing: 'Best regards,',
            signature: '',
            rawBody: ''
        },
        typography: {
            fontSize: 16
        }
    },

    setResume: (resume) =>
        set((state) => ({ resume: { ...state.resume, ...resume } })),

    resetResume: () =>
        set(() => ({ resume: structuredClone(initialResumeState) })),

    setResumeData: (data) =>
        set((state) => ({ resume: { ...state.resume, data: { ...state.resume.data, ...data } } })),

    setResumeTitle: (title) =>
        set((state) => ({ resume: { ...state.resume, data: { ...state.resume.data, title } } })),

    setResumeSlug: (slug) =>
        set((state) => ({ resume: { ...state.resume, data: { ...state.resume.data, slug } } })),

    setResumeTags: (tags) =>
        set((state) => ({ resume: { ...state.resume, data: { ...state.resume.data, tags } } })),

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
                            items: [item, ...state.resume.data.sections[sectionId].items]
                        }
                    }
                }
            }
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
                                i.id === itemId ? { ...i, ...item } : i
                            )
                        }
                    }
                }
            }
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
                            items: state.resume.data.sections[sectionId].items.filter((i) => i.id !== itemId)
                        }
                    }
                }
            }
        })),

    updateBasics: (basics) =>
        set((state) => ({
            resume: {
                ...state.resume,
                data: {
                    ...state.resume.data,
                    basics: { ...state.resume.data.basics, ...basics }
                }
            }
        })),

    // Cover Letter Actions (Unchanged)
    setCoverLetter: (coverLetter) =>
        set((state) => ({ coverLetter: { ...state.coverLetter, ...coverLetter } })),

    setCoverLetterTitle: (title) =>
        set((state) => ({ coverLetter: { ...state.coverLetter, title } })),

    setCoverLetterField: (field, data) =>
        set((state) => ({ coverLetter: { ...state.coverLetter, [field]: data } })),

    setCoverLetterNested: (section, field, value) =>
        set((state) => ({
            coverLetter: {
                ...state.coverLetter,
                [section]: {
                    ...state.coverLetter[section],
                    [field]: value
                }
            }
        })),
}));
