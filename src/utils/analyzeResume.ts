// Lightweight resume text analyzer (heuristic)
// NOTE: Pure client-side heuristic extraction; replace with server/LangChain for advanced parsing.

export interface AnalyzedResume {
  emails: string[];
  phones: string[];
  urls: string[];
  skills: string[];
  sections: { heading: string; content: string }[];
  structured: Record<string, any>;
}

const SKILL_WORDS = [
  'javascript','typescript','react','node','python','java','go','sql','postgres','aws','docker','kubernetes','graphql','css','html','tailwind','deno','git','linux','redis','mongodb','ci','cd'
];

const SECTION_HEADINGS = [
  'experience','work experience','professional experience','education','projects','skills','certifications','summary','profile','achievements'
];

export function analyzeResumeText(text: string): AnalyzedResume {
  const lower = text.toLowerCase();
  const emails = Array.from(new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []));
  const phones = Array.from(new Set(text.match(/\+?\d[\d()\-\s]{6,}\d/g) || []));
  const urls = Array.from(new Set(text.match(/https?:\/\/[\w./#?=&%-]+/gi) || []));

  const foundSkills = Array.from(new Set(SKILL_WORDS.filter(w => lower.includes(w))));

  // Section splitting by headings
  const sections: { heading: string; content: string }[] = [];
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  let current: { heading: string; content: string[] } | null = null;
  for (const line of lines) {
    const l = line.toLowerCase();
    if (SECTION_HEADINGS.includes(l)) {
      if (current) sections.push({ heading: current.heading, content: current.content.join('\n') });
      current = { heading: line, content: [] };
    } else if (current) {
      current.content.push(line);
    }
  }
  if (current) sections.push({ heading: current.heading, content: current.content.join('\n') });

  const structured: Record<string, any> = {
    summary: sections.find(s => s.heading.toLowerCase().includes('summary'))?.content,
    education: sections.filter(s => s.heading.toLowerCase().includes('education')),
    experience: sections.filter(s => s.heading.toLowerCase().includes('experience')),
    projects: sections.filter(s => s.heading.toLowerCase().includes('project')),
  };

  return { emails, phones, urls, skills: foundSkills, sections, structured };
}
