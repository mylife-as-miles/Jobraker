import { events } from '@/lib/analytics';

export interface CoverLetterPromptOptions {
  tone?: 'neutral' | 'enthusiastic' | 'confident';
  maxWords?: number;
}

export function buildCoverLetterPrompt(resumeData: any, jobDescription: string, opts: CoverLetterPromptOptions = {}) {
  const tone = opts.tone || 'neutral';
  const max = opts.maxWords || 350;
  const skills = Array.isArray(resumeData?.skills) ? resumeData.skills.slice(0,15).join(', ') : '';
  return `Write a ${tone} professional cover letter (<=${max} words) referencing these skills: ${skills}. Job Description: ${jobDescription.slice(0,2000)}`;
}

export async function generateCoverLetter(resumeData: any, jobDescription: string, opts: CoverLetterPromptOptions = {}) {
  const prompt = buildCoverLetterPrompt(resumeData, jobDescription, opts);
  const draft = `Dear Hiring Manager,\n\n(This is a placeholder letter generated from prompt)\n\nPrompt: ${prompt}\n\nSincerely,\nCandidate`;
  const removedUnsupportedCount = 0;
  events.coverLetterGenerated(removedUnsupportedCount);
  return { draft, removedUnsupportedCount };
}