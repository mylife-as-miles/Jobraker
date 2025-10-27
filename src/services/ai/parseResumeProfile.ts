/**
 * AI-powered resume parser that extracts structured profile data
 * Uses OpenAI to parse resume content into profile fields
 */

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
  apiKey: string;
  model?: string | null;
  baseURL?: string | null;
}

const DEFAULT_MODEL = "gpt-4o-mini";

const PARSING_SCHEMA = {
  type: "object",
  properties: {
    firstName: { type: "string" },
    lastName: { type: "string" },
    email: { type: "string", format: "email" },
    phone: { type: "string" },
    location: { type: "string" },
    jobTitle: { type: "string" },
    experienceYears: { type: "number", nullable: true },
    about: { type: "string" },
    skills: {
      type: "array",
      items: { type: "string" }
    },
    education: {
      type: "array",
      items: {
        type: "object",
        properties: {
          school: { type: "string" },
          degree: { type: "string" },
          start: { type: "string" },
          end: { type: "string" }
        },
        required: ["school", "degree"]
      }
    },
    experience: {
      type: "array",
      items: {
        type: "object",
        properties: {
          company: { type: "string" },
          title: { type: "string" },
          location: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
          description: { type: "string" }
        },
        required: ["company", "title"]
      }
    }
  },
  required: ["firstName", "email", "skills"],
  additionalProperties: false
};

function buildPrompt(resumeText: string): string {
  return `You are an expert resume parser for JobRaker. Extract structured profile data from the resume below.

CRITICAL INSTRUCTIONS:
- Extract the candidate's first name and last name separately
- Find email address and phone number (with country code if present)
- Extract current or most recent job title
- Calculate total years of professional experience (estimate if not explicit)
- Create a concise professional summary (2-3 sentences) for the "about" field
- Extract all technical and professional skills mentioned
- Parse education entries with school name, degree, and dates (YYYY format for start/end)
- Parse work experience with company, job title, location, dates, and brief description
- Use null for missing numeric values, empty string for missing text, empty arrays for missing lists
- Ensure all dates are in YYYY or YYYY-MM format
- Make intelligent inferences when data is implicit (e.g., if someone worked from 2018-2023 and 2023-present, that's ~5-7 years)

Return ONLY valid JSON matching this exact schema:
${JSON.stringify(PARSING_SCHEMA, null, 2)}

<resume>
${resumeText}
</resume>

Output the parsed data as JSON now:`;
}

const FAILSAFE_RESULT: ParsedProfileData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  location: "",
  jobTitle: "",
  experienceYears: null,
  about: "",
  skills: [],
  education: [],
  experience: []
};

function validateAndNormalize(raw: any): ParsedProfileData {
  if (!raw || typeof raw !== "object") return FAILSAFE_RESULT;

  const str = (val: any, fallback = "") => 
    typeof val === "string" ? val.trim() : fallback;
  
  const num = (val: any) => {
    const parsed = Number(val);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
  };

  const arr = (val: any) =>
    Array.isArray(val) ? val.filter(item => typeof item === "string" && item.trim()).map(item => item.trim()) : [];

  const education = Array.isArray(raw.education)
    ? raw.education
        .map((item: any) => ({
          school: str(item?.school),
          degree: str(item?.degree),
          start: str(item?.start || item?.startDate),
          end: str(item?.end || item?.endDate)
        }))
        .filter((item: any) => item.school || item.degree)
    : [];

  const experience = Array.isArray(raw.experience)
    ? raw.experience
        .map((item: any) => ({
          company: str(item?.company),
          title: str(item?.title || item?.jobTitle || item?.position),
          location: str(item?.location),
          startDate: str(item?.startDate || item?.start),
          endDate: str(item?.endDate || item?.end),
          description: str(item?.description || item?.summary)
        }))
        .filter((item: any) => item.company || item.title)
    : [];

  return {
    firstName: str(raw.firstName || raw.first_name),
    lastName: str(raw.lastName || raw.last_name),
    email: str(raw.email),
    phone: str(raw.phone || raw.phoneNumber || raw.phone_number),
    location: str(raw.location || raw.city),
    jobTitle: str(raw.jobTitle || raw.job_title || raw.currentTitle || raw.title),
    experienceYears: num(raw.experienceYears || raw.experience_years || raw.yearsOfExperience),
    about: str(raw.about || raw.summary || raw.professionalSummary || raw.bio),
    skills: arr(raw.skills),
    education,
    experience
  };
}

export async function parseResumeWithAI({
  resumeText,
  apiKey,
  model,
  baseURL
}: ParseResumeRequest): Promise<ParsedProfileData> {
  if (!resumeText || !resumeText.trim()) {
    throw new Error("Resume text is required");
  }

  if (!apiKey || !apiKey.trim()) {
    throw new Error("OpenAI API key is required");
  }

  const endpoint = (baseURL || "https://api.openai.com/v1") + "/chat/completions";
  
  const payload = {
    model: model || DEFAULT_MODEL,
    temperature: 0.1, // Low temperature for consistent extraction
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You are an expert resume parser. Extract structured data accurately and return only valid JSON."
      },
      {
        role: "user",
        content: buildPrompt(resumeText)
      }
    ]
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    let errorDetail = res.statusText;
    try {
      const errJson = await res.json();
      errorDetail = errJson?.error?.message || JSON.stringify(errJson);
    } catch {
      try {
        errorDetail = await res.text();
      } catch {
        // use statusText
      }
    }
    throw new Error(`OpenAI API request failed: ${errorDetail}`);
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  
  if (!content || typeof content !== "string") {
    throw new Error("Invalid response from OpenAI API");
  }

  try {
    const parsed = JSON.parse(content);
    return validateAndNormalize(parsed);
  } catch (err: any) {
    throw new Error(`Failed to parse AI response: ${err?.message || err}`);
  }
}
