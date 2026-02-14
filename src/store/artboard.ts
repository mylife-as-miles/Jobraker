import { create } from 'zustand';

// --- Resume Types ---
export interface WorkExperience {
    id: string;
    title: string;
    company: string;
    period: string;
    description: string[];
}

export interface Education {
    id: string;
    degree: string;
    school: string;
    period: string;
}

export interface ResumeState {
    personalInfo: {
        fullName: string;
        jobTitle: string;
        email: string;
        phone: string;
        location: string;
        website: string;
    };
    experience: WorkExperience[];
    education: Education[];
    skills: string[];
    metadata: {
        page: {
            format: 'a4' | 'letter';
        };
        typography: {
            font: {
                family: string;
            };
        };
    };
}

// --- Cover Letter Types ---
export interface CoverLetterState {
    // Meta / Context
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
    setResumeSection: <K extends keyof ResumeState>(section: K, data: ResumeState[K]) => void;

    // Cover Letter Actions
    setCoverLetter: (coverLetter: Partial<CoverLetterState>) => void;
    setCoverLetterField: <K extends keyof CoverLetterState>(field: K, data: CoverLetterState[K]) => void;
    // Helper to update nested fields like 'sender.name' or 'content.paragraphs'
    // Helper to update nested fields like 'sender.name' or 'content.paragraphs'
    setCoverLetterNested: <K extends 'sender' | 'recipient' | 'content' | 'typography', F extends keyof CoverLetterState[K]>(
        section: K,
        field: F,
        value: CoverLetterState[K][F]
    ) => void;
};

export const useArtboardStore = create<ArtboardStore>((set) => ({
    resume: {
        personalInfo: {
            fullName: 'John Doe',
            jobTitle: 'Senior Software Engineer',
            email: 'john@example.com',
            phone: '+1 (555) 123-4567',
            location: 'San Francisco, CA',
            website: 'johndoe.dev'
        },
        experience: [
            {
                id: '1',
                title: 'Senior Developer',
                company: 'TechCorp Inc.',
                period: '2020 - Present',
                description: [
                    'Led a team of 5 engineers to rebuild the core payment infrastructure, increasing transaction speed by 200%.',
                    'Improved system latency by 40% through optimized caching strategies and database indexing.',
                    'Mentored junior developers and conducted code reviews to ensure high code quality standards.'
                ]
            },
            {
                id: '2',
                title: 'Software Engineer',
                company: 'StartupXY',
                period: '2018 - 2020',
                description: [
                    'Developed and maintained RESTful APIs for the mobile application backend using Node.js.',
                    'Collaborated with product managers to define feature requirements and project timelines.'
                ]
            }
        ],
        education: [
            {
                id: '1',
                degree: 'B.S. Computer Science',
                school: 'Stanford University',
                period: '2014 - 2018'
            }
        ],
        skills: ['JavaScript', 'React', 'Node.js', 'Python', 'AWS', 'Docker', 'GraphQL'],
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
    coverLetter: {
        title: '',
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

    setResumeSection: (section, data) =>
        set((state) => ({ resume: { ...state.resume, [section]: data } })),

    setCoverLetter: (coverLetter) =>
        set((state) => ({ coverLetter: { ...state.coverLetter, ...coverLetter } })),

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
