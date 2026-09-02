export interface AnalyzedSection {
  heading: string;
  canonical?: "summary" | "experience" | "education" | "skills" | "projects" | "certifications" | "awards" | "languages" | "other";
  content: string;
}

export interface AnalyzedResume {
  emails: string[];
  phones: string[];
  urls: string[];
  skills: string[];
  sections: AnalyzedSection[];
  structured: Record<string, any>;
  entities: {
    companies: string[];
    titles: string[];
  };
}

const COMMON_SKILLS = [
  "javascript", "typescript", "react", "react native", "next.js", "vue", "angular", "node", "nodejs",
  "python", "java", "c++", "c#", ".net", "go", "golang", "rust", "ruby", "rails", "php",
  "sql", "postgres", "postgresql", "mysql", "mongodb", "redis", "elasticsearch",
  "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "ci/cd", "git", "linux",
  "graphql", "rest api", "tailwind", "css", "html", "html5", "css3", "sass", "webpack", "vite",
  "agile", "scrum", "jira", "unit testing", "playwright", "cypress", "jest",
];

const SECTION_PATTERNS: Array<{
  canonical: AnalyzedSection["canonical"];
  regex: RegExp;
}> = [
  {
    canonical: "summary",
    regex: /^(?:#{1,3}\s*)?(?:professional\s+|career\s+|executive\s+)?(?:summary|profile|about(?:\s+me)?|objective|overview|statement|biography)\b/i,
  },
  {
    canonical: "experience",
    regex: /^(?:#{1,3}\s*)?(?:work|professional|career|employment|relevant)?\s*(?:experience|history|background|employment|positions? held)\b/i,
  },
  {
    canonical: "education",
    regex: /^(?:#{1,3}\s*)?(?:education|academic(?:\s+background|\s+history|\s+qualifications)?|degrees?|qualifications|academic credentials)\b/i,
  },
  {
    canonical: "skills",
    regex: /^(?:#{1,3}\s*)?(?:technical\s+|core\s+|key\s+|professional\s+)?(?:skills|competencies|technologies|proficiencies|tools|areas of expertise|tech stack|technical strengths)\b/i,
  },
  {
    canonical: "projects",
    regex: /^(?:#{1,3}\s*)?(?:selected\s+|key\s+|personal\s+|academic\s+|recent\s+)?projects?\b/i,
  },
  {
    canonical: "certifications",
    regex: /^(?:#{1,3}\s*)?(?:certifications?|certificates?|licenses?(?:\s+and\s+certifications)?|accreditations?|courses?)\b/i,
  },
  {
    canonical: "awards",
    regex: /^(?:#{1,3}\s*)?(?:awards?|honors?|achievements?|accomplishments?|recognition)\b/i,
  },
  {
    canonical: "languages",
    regex: /^(?:#{1,3}\s*)?(?:languages?|language skills?)\b/i,
  },
];

function matchSectionHeading(line: string): { canonical: AnalyzedSection["canonical"]; raw: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 60) return null;

  // Strip markdown hashes, list bullets, and trailing punctuation
  const clean = trimmed
    .replace(/^#{1,3}\s*/, "")
    .replace(/^[•*\-\d.]+\s*/, "")
    .replace(/[:\-—|]+$/, "")
    .trim();

  if (!clean || clean.length < 2) return null;

  for (const { canonical, regex } of SECTION_PATTERNS) {
    if (regex.test(trimmed) || regex.test(clean)) {
      return { canonical, raw: trimmed };
    }
  }

  return null;
}

export function analyzeResumeText(text: string): AnalyzedResume {
  const emails = Array.from(new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []));
  const phones = Array.from(new Set(text.match(/\+?\d[\d()\-\s]{6,}\d/g) || []));
  const urls = Array.from(new Set(text.match(/(?:https?:\/\/|www\.)[^\s,;()]+/gi) || []));

  // Section splitting by robust heading matcher
  const sections: AnalyzedSection[] = [];
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  let current: { heading: string; canonical: AnalyzedSection["canonical"]; content: string[] } | null = null;

  for (const line of lines) {
    const matched = matchSectionHeading(line);
    if (matched) {
      if (current) {
        sections.push({
          heading: current.heading,
          canonical: current.canonical,
          content: current.content.join("\n"),
        });
      }
      current = { heading: matched.raw, canonical: matched.canonical, content: [] };
    } else if (current) {
      current.content.push(line);
    }
  }
  if (current) {
    sections.push({
      heading: current.heading,
      canonical: current.canonical,
      content: current.content.join("\n"),
    });
  }

  // Extract skills from both the dedicated Skills section and common keywords
  const skillsSet = new Set<string>();
  const skillSections = sections.filter((s) => s.canonical === "skills");
  for (const sec of skillSections) {
    const tokens = sec.content
      .split(/[,•|/;\n]+/)
      .map((t) => t.replace(/^[*\-•\d.]+\s*/, "").trim())
      .filter((t) => t.length > 1 && t.length < 40);
    for (const t of tokens) {
      skillsSet.add(t);
    }
  }

  const lowerText = text.toLowerCase();
  for (const kw of COMMON_SKILLS) {
    const regex = new RegExp(`\\b${kw.replace(/[.+*?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (regex.test(lowerText)) {
      skillsSet.add(kw);
    }
  }

  const structured: Record<string, any> = {
    summary: sections.find((s) => s.canonical === "summary")?.content,
    education: sections.filter((s) => s.canonical === "education"),
    experience: sections.filter((s) => s.canonical === "experience"),
    projects: sections.filter((s) => s.canonical === "projects"),
    certifications: sections.filter((s) => s.canonical === "certifications"),
    skills: Array.from(skillsSet),
  };

  const companyRegex = /\b([A-Z][A-Za-z&]+(?:\s+[A-Z][A-Za-z&]+)*\s+(?:Inc|LLC|Ltd|Corporation|Corp|Group|Technologies|Systems|Labs))\b/g;
  const companies = Array.from(new Set((text.match(companyRegex) || []).slice(0, 50)));

  const titleRegex = /\b(Senior|Lead|Principal|Staff|Junior)?\s*(Engineer|Developer|Manager|Director|Designer|Analyst|Consultant|Architect|Specialist|Scientist|Coordinator)\b/gi;
  const titles = Array.from(new Set((text.match(titleRegex) || []).map((t) => t.trim())));

  return {
    emails,
    phones,
    urls,
    skills: Array.from(skillsSet),
    sections,
    structured,
    entities: { companies, titles },
  };
}
