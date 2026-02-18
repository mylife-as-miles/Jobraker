
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
// Helper to parse date ranges (e.g. "2020 - 2022" or "Jan 2020 - Present")
function parseDateRange(dateStr: string) {
    if (!dateStr) return { start: '', end: '' };
    const parts = dateStr.split(/\s+-\s+|\s+to\s+/i);
    return {
        start: parts[0] || '',
        end: parts[1] || ''
    };
}

function sanitizeData(raw: any): ParsedProfileData {
    const str = (v: any) => typeof v === 'string' ? v.trim() : "";
    const num = (v: any) => typeof v === 'number' ? v : null;
    
    // Handle new ResumeData structure (nested) vs old flat structure
    const basics = raw.basics || {};
    const sections = raw.sections || {};
    const summary = raw.summary || {};

    // Name splitting
    const fullName = str(basics.name || raw.firstName + ' ' + raw.lastName);
    const [firstName, ...lastNameParts] = fullName.split(' ');
    const lastName = lastNameParts.join(' ');

    // Skills mapping
    let skills: string[] = [];
    if (sections.skills?.items && Array.isArray(sections.skills.items)) {
        skills = sections.skills.items.map((i: any) => str(i.name)).filter(Boolean);
    } else if (Array.isArray(raw.skills)) {
        skills = raw.skills.filter((s: any) => typeof s === 'string');
    }

    // Experience mapping
    let experience: any[] = [];
    if (sections.experience?.items && Array.isArray(sections.experience.items)) {
        experience = sections.experience.items.map((i: any) => {
            const { start, end } = parseDateRange(i.date || i.period || '');
            return {
                company: str(i.company),
                title: str(i.position || i.title),
                location: str(i.location),
                startDate: start,
                endDate: end,
                description: str(i.summary || i.description)
            };
        });
    } else if (Array.isArray(raw.experience)) {
        experience = raw.experience; // format assumed compatible or old schema
    }

    // Education mapping
    let education: any[] = [];
    if (sections.education?.items && Array.isArray(sections.education.items)) {
        education = sections.education.items.map((i: any) => {
            const { start, end } = parseDateRange(i.date || i.period || '');
            return {
                school: str(i.school || i.institution),
                degree: str(i.degree || i.area),
                start: start,
                end: end
            };
        });
    } else if (Array.isArray(raw.education)) {
        education = raw.education;
    }

    // Experience years estimation (if not present)
    let experienceYears = num(raw.experienceYears || raw.experience_years);
    if (experienceYears === null && experience.length > 0) {
        // Simple heuristic: 1 year per job? Or just leave null.
        // Let's leave null to prompt user or default logic elsewhere
    }

    return {
        firstName: firstName || str(raw.firstName || raw.first_name),
        lastName: lastName || str(raw.lastName || raw.last_name),
        email: str(basics.email || raw.email),
        phone: str(basics.phone || raw.phone),
        location: str(basics.location || raw.location),
        jobTitle: str(basics.headline || raw.jobTitle || raw.job_title),
        experienceYears: experienceYears,
        about: str(summary.content || raw.about || raw.summary),
        skills: skills,
        education: education,
        experience: experience
    };
}
