
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

// Helper to ensure data matches the interface (sanitize nulls etc)
function sanitizeData(raw: any): ParsedProfileData {
    const str = (v: any) => (typeof v === 'string' && v.trim) ? v.trim() : "";
    const num = (v: any) => (typeof v === 'number' && !isNaN(v)) ? v : null;
    
    // Handle new ResumeData structure (nested) vs old flat structure
    // The Edge Function returns { basics, sections, ... }
    const basics = raw.basics || {};
    const sections = raw.sections || {};
    
    // Name splitting logic
    let firstName = str(basics.firstName || raw.firstName || raw.first_name);
    let lastName = str(basics.lastName || raw.lastName || raw.last_name);
    
    if (!firstName && !lastName) {
        const fullName = str(basics.name || raw.name);
        if (fullName) {
            const parts = fullName.split(' ');
            firstName = parts[0];
            lastName = parts.slice(1).join(' ');
        }
    }

    // Skills mapping
    // New schema: sections.skills.items: [{name: "React"}]
    // Old schema: skills: ["React"]
    let skills: string[] = [];
    if (sections.skills?.items && Array.isArray(sections.skills.items)) {
        skills = sections.skills.items.map((i: any) => str(i.name)).filter(Boolean);
    } else if (Array.isArray(raw.skills)) {
        skills = raw.skills.map((s: any) => typeof s === 'string' ? s : str(s.name)).filter(Boolean);
    }

    // Experience mapping
    let experience: any[] = [];
    if (sections.experience?.items && Array.isArray(sections.experience.items)) {
        experience = sections.experience.items.map((i: any) => {
            const { start, end } = parseDateRange(i.date || i.period || '');
            return {
                company: str(i.company || i.name),
                title: str(i.position || i.title),
                location: str(i.location),
                startDate: start,
                endDate: end,
                description: str(i.summary || i.description)
            };
        });
    } else if (Array.isArray(raw.experience)) {
        experience = raw.experience.map((i: any) => ({
             company: str(i.company),
             title: str(i.title),
             location: str(i.location),
             startDate: str(i.startDate),
             endDate: str(i.endDate),
             description: str(i.description)
        }));
    }

    // Education mapping
    let education: any[] = [];
    if (sections.education?.items && Array.isArray(sections.education.items)) {
        education = sections.education.items.map((i: any) => {
            const { start, end } = parseDateRange(i.date || i.period || '');
            return {
                school: str(i.school || i.institution),
                degree: str(i.degree || i.area || i.studyType),
                start: start,
                end: end
            };
        });
    } else if (Array.isArray(raw.education)) {
        education = raw.education.map((i: any) => ({
            school: str(i.school),
            degree: str(i.degree),
            start: str(i.start),
            end: str(i.end)
        }));
    }

    // Experience years estimation
    // If we have experience items but no explicit count, calculate it
    let experienceYears = num(raw.experienceYears || raw.experience_years);
    if (experienceYears === null && experience.length > 0) {
        // Calculate based on start/end dates
         try {
            const now = new Date();
            let totalMonths = 0;
            experience.forEach(exp => {
                if (exp.startDate) {
                    const start = new Date(exp.startDate);
                    let end = now;
                    if (exp.endDate && exp.endDate.toLowerCase() !== 'present') {
                        end = new Date(exp.endDate);
                    }
                    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                        const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
                        if (months > 0) totalMonths += months;
                    }
                }
            });
            if (totalMonths > 0) {
                experienceYears = Math.floor(totalMonths / 12);
            }
         } catch {}
    }

    return {
        firstName: firstName,
        lastName: lastName,
        email: str(basics.email || raw.email),
        phone: str(basics.phone || raw.phone),
        location: str(basics.location || raw.location),
        jobTitle: str(basics.headline || basics.label || raw.jobTitle || raw.job_title),
        experienceYears: experienceYears,
        about: str(basics.summary || raw.about || raw.summary), 
        skills: skills,
        education: education,
        experience: experience
    };
}
