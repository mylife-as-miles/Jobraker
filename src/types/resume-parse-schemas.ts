import { z } from 'zod';

// Basic email / url / phone validators (loose)
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ResumeSectionSchema = z.object({
  heading: z.string().min(1).max(120),
  content: z.string().max(20_000).optional().default(''),
});

export const AnalyzedEntitiesSchema = z.object({
  companies: z.array(z.string().min(1)).max(200),
  titles: z.array(z.string().min(1)).max(200),
});

export const StructuredResumeSchema = z.object({
  summary: z.string().nullable().optional(),
  education: z.array(z.any()).optional().default([]),
  experience: z.array(z.any()).optional().default([]),
  projects: z.array(z.any()).optional().default([]),
}).passthrough();

export const ParsedResumeSchema = z.object({
  emails: z.array(z.string().min(3).max(120)).max(50).default([]),
  phones: z.array(z.string().min(3).max(50)).max(50).default([]),
  urls: z.array(z.string().min(1).max(500)).max(100).default([]),
  skills: z.array(z.string().min(1).max(100)).max(500).default([]),
  sections: z.array(ResumeSectionSchema).max(200).default([]),
  structured: StructuredResumeSchema.default({}),
  entities: AnalyzedEntitiesSchema.default({ companies: [], titles: [] }),
});

export type ParsedResumeValidated = z.infer<typeof ParsedResumeSchema>;

export function validateParsedResume(data: unknown): ParsedResumeValidated | null {
  if (!data || typeof data !== "object") return null;

  const raw = data as Record<string, any>;
  const cleanData = {
    emails: Array.isArray(raw.emails) ? raw.emails.filter((e) => typeof e === "string" && e.includes("@")) : [],
    phones: Array.isArray(raw.phones) ? raw.phones.filter((p) => typeof p === "string" && p.trim().length > 3) : [],
    urls: Array.isArray(raw.urls) ? raw.urls.filter((u) => typeof u === "string" && u.trim().length > 3) : [],
    skills: Array.isArray(raw.skills) ? raw.skills.filter((s) => typeof s === "string" && s.trim().length > 0) : [],
    sections: Array.isArray(raw.sections) ? raw.sections : [],
    structured: raw.structured && typeof raw.structured === "object" ? raw.structured : {},
    entities: {
      companies: Array.isArray(raw.entities?.companies) ? raw.entities.companies : [],
      titles: Array.isArray(raw.entities?.titles) ? raw.entities.titles : [],
    },
  };

  const res = ParsedResumeSchema.safeParse(cleanData);
  return res.success ? res.data : null;
}
