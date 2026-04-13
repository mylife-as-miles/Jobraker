
import { createClient } from "@/lib/supabaseClient";
import { analyzeResumeText } from "@/utils/analyzeResume";

export interface ParsedProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location: string;
  jobTitle: string;
  experienceYears: number | null;
  about: string;
  skills: string[];
  education: Array<{
    school: string;
    degree: string;
    start?: string;
    end?: string;
  }>;
  experience: Array<{
    company: string;
    title: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }>;
}

export interface ParseResumeRequest {
  resumeText: string;
  apiKey?: string; // Deprecated/Unused but kept for signature compatibility if needed
  model?: string | null;
  baseURL?: string | null;
}

const supabase = createClient();

export async function parseResumeWithAI({
  resumeText,
}: ParseResumeRequest): Promise<ParsedProfileData> {
  if (!resumeText || !resumeText.trim()) {
    throw new Error("Resume text is required");
  }

  try {
    const { data, error } = await supabase.functions.invoke('parse-resume', {
      body: { resumeText }
    });

    if (error) {
       console.error("Parse function error:", error);
       throw new Error(error.message || "Failed to parse resume");
    }

    if (!data) throw new Error("No data returned from AI");

    return sanitizeParsedProfileData(data);
  } catch (err: any) {
    throw new Error(`Failed to parse resume: ${err.message || err}`);
  }
}

function inferNameParts(fallbackName?: string, resumeText?: string) {
  const normalizedFallback = String(fallbackName || "")
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const fallbackTokens = normalizedFallback
    .split(" ")
    .filter(Boolean)
    .filter(
      (token) => !/^(resume|cv|cover|letter|draft|final|copy)$/i.test(token),
    );

  if (fallbackTokens.length >= 2) {
    return {
      firstName: fallbackTokens[0],
      lastName: fallbackTokens.slice(1).join(" "),
    };
  }

  const textTokens = String(resumeText || "")
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}'-]/gu, "").trim())
    .filter((token) => /^[A-Z][\p{L}'-]+$/u.test(token))
    .slice(0, 3);

  return {
    firstName: textTokens[0] || "Imported",
    lastName: textTokens.slice(1).join(" ") || "Resume",
  };
}

export function buildFallbackParsedProfileData(
  resumeText: string,
  fallbackName?: string,
): ParsedProfileData {
  const analyzed = analyzeResumeText(resumeText);
  const nameParts = inferNameParts(fallbackName, resumeText);
  const summary =
    typeof analyzed.structured?.summary === "string" &&
    analyzed.structured.summary.trim()
      ? analyzed.structured.summary.trim()
      : resumeText.slice(0, 260).trim();

  const education = Array.isArray(analyzed.structured?.education)
    ? analyzed.structured.education
        .map((entry: any) => {
          const lines = String(entry?.content || "")
            .split(/\n+/)
            .map((line) => line.trim())
            .filter(Boolean);

          return {
            school: lines[0] || "",
            degree: lines[1] || "",
            start: "",
            end: "",
          };
        })
        .filter((entry) => entry.school || entry.degree)
        .slice(0, 4)
    : [];

  const experience = Array.isArray(analyzed.structured?.experience)
    ? analyzed.structured.experience
        .map((entry: any) => {
          const lines = String(entry?.content || "")
            .split(/\n+/)
            .map((line) => line.trim())
            .filter(Boolean);

          return {
            company: lines[0] || analyzed.entities.companies[0] || "",
            title: analyzed.entities.titles[0] || "",
            location: "",
            startDate: "",
            endDate: "",
            description: lines.slice(1).join(" ").slice(0, 280),
          };
        })
        .filter((entry) => entry.company || entry.title || entry.description)
        .slice(0, 4)
    : [];

  return {
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,
    email: analyzed.emails[0] || "",
    phone: analyzed.phones[0] || "",
    location: "",
    jobTitle: analyzed.entities.titles[0] || "",
    experienceYears: null,
    about: summary,
    skills: analyzed.skills.slice(0, 20),
    education,
    experience,
  };
}

// Helper to ensure data matches the interface (sanitize nulls etc)
export function sanitizeParsedProfileData(raw: any): ParsedProfileData {
    const str = (v: any) => typeof v === 'string' ? v.trim() : "";
    const num = (v: any) => typeof v === 'number' ? v : null;
    const arr = (v: any) => Array.isArray(v) ? v.filter(i => typeof i === 'string') : [];
    
    return {
        firstName: str(raw.firstName || raw.first_name),
        lastName: str(raw.lastName || raw.last_name),
        email: str(raw.email),
        phone: str(raw.phone),
        location: str(raw.location),
        jobTitle: str(raw.jobTitle || raw.job_title),
        experienceYears: num(raw.experienceYears || raw.experience_years),
        about: str(raw.about),
        skills: arr(raw.skills),
        education: Array.isArray(raw.education) ? raw.education.map((e: any) => ({
            school: str(e.school),
            degree: str(e.degree),
            start: str(e.start || e.start_date),
            end: str(e.end || e.end_date)
        })) : [],
        experience: Array.isArray(raw.experience) ? raw.experience.map((e: any) => ({
            company: str(e.company),
            title: str(e.title),
            location: str(e.location),
            startDate: str(e.startDate || e.start_date),
            endDate: str(e.endDate || e.end_date),
            description: str(e.description)
        })) : []
    };
}
