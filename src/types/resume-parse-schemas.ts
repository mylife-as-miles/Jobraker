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
  emails: z.array(z.string().regex(emailRegex)).max(20),
  phones: z.array(z.string()).max(20),
  urls: z.array(z.string().url()).max(50),
  skills: z.array(z.string().min(1)).max(500),
  sections: z.array(ResumeSectionSchema).max(200),
  structured: StructuredResumeSchema,
  entities: AnalyzedEntitiesSchema,
});

export type ParsedResumeValidated = z.infer<typeof ParsedResumeSchema>;

export function validateParsedResume(data: unknown): ParsedResumeValidated | null {
  const res = ParsedResumeSchema.safeParse(data);
  return res.success ? res.data : null;
}
