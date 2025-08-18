import { z } from "zod";

export type Award = any;
export type Certification = any;
export type CustomSection = any;
export type CustomSectionGroup = any;
export type Education = any;
export type Experience = any;
export type Interest = any;
export type Language = any;
export type Profile = any;
export type Project = any;
export type Publication = any;
export type Reference = any;
export type SectionKey = any;
export type SectionWithItem<T = any> = { items: T[] } & Record<string, any>;
export type SectionItem = { id?: string } & Record<string, any>;
export type Skill = any;
export type URL = any;
export type Volunteer = any;

// Minimal mocks used by client store
export const defaultSection: any = {
	id: "",
	name: "",
	items: [],
};

// Minimal defaults and zod-like schema stubs for builder dialogs
// Use a real Zod schema so callers can chain .optional(), .nullable(), etc.
export const idSchema = z.string().min(1);
export const basicsSchema = { safeParse: (_v: any) => ({ success: true }) } as any;
export const educationSchema = { safeParse: (_v: any) => ({ success: true }) } as any;
export const experienceSchema = { safeParse: (_v: any) => ({ success: true }) } as any;
export const languageSchema = { safeParse: (_v: any) => ({ success: true }) } as any;
export const profileSchema = { safeParse: (_v: any) => ({ success: true }) } as any;
export const projectSchema = { safeParse: (_v: any) => ({ success: true }) } as any;
export const publicationSchema = { safeParse: (_v: any) => ({ success: true }) } as any;
export const referenceSchema = { safeParse: (_v: any) => ({ success: true }) } as any;
export const skillSchema = { safeParse: (_v: any) => ({ success: true }) } as any;
export const awardSchema = { safeParse: (_v: any) => ({ success: true }) } as any;
export const certificationSchema = { safeParse: (_v: any) => ({ success: true }) } as any;
export const volunteerSchema = { safeParse: (_v: any) => ({ success: true }) } as any;
export const customSectionSchema = { safeParse: (_v: any) => ({ success: true }) } as any;

export const defaultAward = {} as any;
export const defaultCertification = {} as any;
export const defaultEducation = {} as any;
export const defaultExperience = {} as any;
export const defaultInterest = {} as any;
export const interestSchema = { safeParse: (_v: any) => ({ success: true }) } as any;
export const defaultLanguage = {} as any;
export const defaultProfile = {} as any;
export const defaultProject = {} as any;
export const defaultPublication = {} as any;
export const defaultReference = {} as any;
export const defaultSkill = {} as any;
export const defaultVolunteer = {} as any;
export const defaultCustomSection = {} as any;

export type ResumeData = any;
export const defaultMetadata = { layout: [[["profiles"]]] } as any;
export const sampleResume = {} as any;

// Minimal default sections used by builder UI (only what's accessed)
export const defaultSections: Record<string, any> = {
	summary: {
		name: "Summary",
		visible: true,
		content: "",
		columns: 1,
	},
};

// Minimal URL schema/type for builder URLInput
export const urlSchema = {
	safeParse: (value: { href?: string }) => ({ success: !!value?.href && /^https?:\/\//.test(value.href) }),
};
