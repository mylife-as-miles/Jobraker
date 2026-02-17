
import { createClient } from "@/lib/supabaseClient";

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

    return sanitizeData(data);
  } catch (err: any) {
    throw new Error(`Failed to parse resume: ${err.message || err}`);
  }
}

// Helper to ensure data matches the interface (sanitize nulls etc)
function sanitizeData(raw: any): ParsedProfileData {
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
