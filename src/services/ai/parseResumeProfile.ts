
import { analyzeResumeText } from "@/utils/analyzeResume";
import { invokeProtectedFunction } from "../supabase/invokeProtectedFunction";

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
  projects: Array<{
    name: string;
    organization?: string;
    date?: string;
    description?: string;
  }>;
  certifications: Array<{
    name: string;
    issuer?: string;
    date?: string;
    description?: string;
  }>;
}

function splitFullName(fullName: string) {
  const tokens = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    firstName: tokens[0] || "",
    lastName: tokens.slice(1).join(" "),
  };
}

function parseLegacyRange(range: string) {
  const cleaned = range.trim();
  if (!cleaned) return { start: "", end: "" };

  const parts = cleaned
    .split(/\s+[—-]\s+|\s+to\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return { start: parts[0], end: parts.slice(1).join(" - ") };
  }

  return { start: cleaned, end: "" };
}

export interface ParseResumeRequest {
  resumeText?: string;
  pdfBase64?: string;
  apiKey?: string; // Deprecated/Unused but kept for signature compatibility if needed
  model?: string | null;
  baseURL?: string | null;
}

export async function parseResumeWithAI({
  resumeText,
  pdfBase64,
}: ParseResumeRequest): Promise<ParsedProfileData> {
  if ((!resumeText || !resumeText.trim()) && (!pdfBase64 || !pdfBase64.trim())) {
    throw new Error("Either resume text or PDF base64 is required");
  }

  try {
    const data = await invokeProtectedFunction<unknown>('parse-resume', {
      body: { resumeText, pdfBase64 }
    });

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
      : resumeText
          .split(/\n+/)
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 8)
          .join("\n")
          .slice(0, 1200)
          .trim();

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
            description: lines.slice(1).join("\n"),
          };
        })
        .filter((entry) => entry.company || entry.title || entry.description)
    : [];

  const projects = Array.isArray(analyzed.structured?.projects)
    ? analyzed.structured.projects
        .map((entry: any) => {
          const lines = String(entry?.content || "")
            .split(/\n+/)
            .map((line) => line.trim())
            .filter(Boolean);

          return {
            name: lines[0] || "",
            organization: "",
            date: "",
            description: lines.slice(1).join("\n"),
          };
        })
        .filter((entry) => entry.name || entry.description)
    : [];

  const certifications = Array.isArray(analyzed.structured?.certifications)
    ? analyzed.structured.certifications
        .flatMap((entry: any) =>
          String(entry?.content || "")
            .split(/\n+/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => ({
              name: line,
              issuer: "",
              date: "",
              description: "",
            })),
        )
        .filter((entry) => entry.name)
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
    skills: analyzed.skills,
    education,
    experience,
    projects,
    certifications,
  };
}

// Helper to ensure data matches the interface (sanitize nulls etc)
export function sanitizeParsedProfileData(raw: any): ParsedProfileData {
    const record = raw && typeof raw === "object" ? raw : {};
    const str = (v: any) => typeof v === 'string' ? v.trim() : "";
    const num = (v: any) => typeof v === 'number' ? v : null;
    const arr = (v: any) => Array.isArray(v) ? v.filter(i => typeof i === 'string') : [];

    const legacyBasics =
      record.basics && typeof record.basics === "object" ? record.basics : null;
    const legacySummary =
      record.summary && typeof record.summary === "object" ? record.summary : null;
    const legacySections =
      record.sections && typeof record.sections === "object" ? record.sections : null;

    if (legacyBasics || legacySections || legacySummary) {
        const { firstName, lastName } = splitFullName(str(legacyBasics?.name));
        const legacyExperience = Array.isArray(legacySections?.experience?.items)
          ? legacySections.experience.items
          : [];
        const legacyEducation = Array.isArray(legacySections?.education?.items)
          ? legacySections.education.items
          : [];
        const legacySkills = Array.isArray(legacySections?.skills?.items)
          ? legacySections.skills.items
          : [];

        return {
            firstName,
            lastName,
            email: str(legacyBasics?.email),
            phone: str(legacyBasics?.phone),
            location: str(legacyBasics?.location),
            jobTitle: str(legacyBasics?.headline),
            experienceYears: null,
            about: str(legacySummary?.content),
            skills: legacySkills
              .map((item: any) => str(item?.name))
              .filter(Boolean),
            education: legacyEducation.map((item: any) => {
              const { start, end } = parseLegacyRange(
                str(item?.date || item?.period),
              );
              return {
                school: str(item?.school || item?.company || item?.institution),
                degree: str(item?.degree || item?.title || item?.name),
                start,
                end,
              };
            }).filter((item) => item.school || item.degree),
            experience: legacyExperience.map((item: any) => {
              const { start, end } = parseLegacyRange(
                str(item?.date || item?.period),
              );
              return {
                company: str(item?.company),
                title: str(item?.position || item?.title || item?.name),
                location: str(item?.location),
                startDate: start,
                endDate: end,
                description: str(item?.summary || item?.description),
              };
            }).filter((item) => item.company || item.title || item.description),
            projects: Array.isArray(legacySections?.projects?.items)
              ? legacySections.projects.items.map((item: any) => ({
                  name: str(item?.name || item?.title),
                  organization: str(item?.company || item?.organization),
                  date: str(item?.date || item?.period),
                  description: str(item?.description),
                })).filter((item: any) => item.name || item.description)
              : [],
            certifications: Array.isArray(legacySections?.certifications?.items)
              ? legacySections.certifications.items.map((item: any) => ({
                  name: str(item?.name || item?.title),
                  issuer: str(item?.issuer || item?.company || item?.organization),
                  date: str(item?.date || item?.period),
                  description: str(item?.description),
                })).filter((item: any) => item.name)
              : [],
        };
    }

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
        })) : [],
        projects: Array.isArray(raw.projects) ? raw.projects.map((p: any) => ({
            name: str(p.name || p.title),
            organization: str(p.organization || p.company),
            date: str(p.date || p.period),
            description: str(p.description)
        })).filter((p: any) => p.name || p.description) : [],
        certifications: Array.isArray(raw.certifications) ? raw.certifications.map((c: any) => ({
            name: str(c.name || c.title),
            issuer: str(c.issuer || c.organization || c.company),
            date: str(c.date || c.period),
            description: str(c.description)
        })).filter((c: any) => c.name) : []
    };
}
