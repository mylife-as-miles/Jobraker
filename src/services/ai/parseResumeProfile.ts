/**
 * Enterprise-grade AI-powered resume parser with advanced analysis
 * Uses OpenAI GPT-4o for sophisticated profile extraction and career insights
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

const DEFAULT_MODEL = "gpt-4o"; // Using latest GPT-4o for enterprise-level analysis

const PARSING_SCHEMA = {
  type: "object",
  properties: {
    firstName: { 
      type: "string",
      description: "Candidate's first/given name"
    },
    lastName: { 
      type: "string",
      description: "Candidate's last/family name"
    },
    email: { 
      type: "string", 
      format: "email",
      description: "Primary professional email address"
    },
    phone: { 
      type: "string",
      description: "Phone number with country code if available"
    },
    location: { 
      type: "string",
      description: "Current city, state/region, and country (e.g., 'San Francisco, CA, USA')"
    },
    jobTitle: { 
      type: "string",
      description: "Most recent or current professional job title"
    },
    experienceYears: { 
      type: "number", 
      nullable: true,
      description: "Total years of professional experience (calculate from work history)"
    },
    about: { 
      type: "string",
      description: "Compelling 3-4 sentence professional summary highlighting expertise, achievements, and career focus. Write in first person, showcase unique value proposition."
    },
    skills: {
      type: "array",
      description: "Comprehensive list of technical skills, tools, frameworks, methodologies, and professional competencies. Include both explicitly mentioned and implicit skills demonstrated through work experience.",
      items: { type: "string" }
    },
    education: {
      type: "array",
      description: "All educational credentials in reverse chronological order",
      items: {
        type: "object",
        properties: {
          school: { 
            type: "string",
            description: "Full institution name"
          },
          degree: { 
            type: "string",
            description: "Degree type and major (e.g., 'Bachelor of Science in Computer Science')"
          },
          start: { 
            type: "string",
            description: "Start year (YYYY format)"
          },
          end: { 
            type: "string",
            description: "Graduation year or 'Present' (YYYY format)"
          }
        },
        required: ["school", "degree"]
      }
    },
    experience: {
      type: "array",
      description: "Professional work history in reverse chronological order with rich context",
      items: {
        type: "object",
        properties: {
          company: { 
            type: "string",
            description: "Company/organization name"
          },
          title: { 
            type: "string",
            description: "Job title/position held"
          },
          location: { 
            type: "string",
            description: "Work location (city, state/country)"
          },
          startDate: { 
            type: "string",
            description: "Start date (YYYY-MM format)"
          },
          endDate: { 
            type: "string",
            description: "End date (YYYY-MM format) or 'Present'"
          },
          description: { 
            type: "string",
            description: "Concise 2-3 sentence summary of key responsibilities, achievements, and impact. Focus on quantifiable results where available."
          }
        },
        required: ["company", "title"]
      }
    }
  },
  required: ["firstName", "email", "skills"],
  additionalProperties: false
};

function buildPrompt(resumeText: string): string {
  return `You are an elite AI career analyst and resume parser for JobRaker, an enterprise-grade career management platform. Your task is to perform deep, sophisticated analysis of the resume and extract structured profile data with professional insights.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 ENTERPRISE-LEVEL PARSING REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 CONTACT & IDENTITY EXTRACTION:
   • Parse first name and last name with cultural awareness (handle compound names, prefixes, suffixes)
   • Extract primary professional email (prioritize .edu, company domains over generic gmail)
   • Extract phone with international format recognition (+1, +44, etc.)
   • Determine complete location: City, State/Province, Country (infer from context if needed)

💼 PROFESSIONAL PROFILE ANALYSIS:
   • Identify CURRENT or MOST RECENT job title (not just any title mentioned)
   • Calculate TOTAL years of professional experience by:
     - Summing all employment periods (handle overlaps intelligently)
     - Excluding academic internships unless significant (6+ months)
     - Account for career gaps and part-time roles proportionally
     - Round to nearest 0.5 years for precision

✍️ PROFESSIONAL SUMMARY GENERATION:
   Create a compelling "about" section (3-4 sentences) that:
   • Opens with their professional identity and core expertise
   • Highlights 2-3 most impressive achievements or unique strengths
   • Mentions key technical domains or industry specializations
   • Conveys their career trajectory and current focus
   • Uses first-person voice, active language
   • Reads like a LinkedIn "About" section written by an executive coach
   
   Example quality bar:
   "I'm a seasoned full-stack engineer with 8+ years building scalable cloud infrastructure and leading cross-functional teams. I specialize in architecting microservices platforms that handle millions of daily transactions, with deep expertise in AWS, Kubernetes, and modern CI/CD pipelines. At TechCorp, I led the migration to serverless architecture that reduced costs by 40% while improving performance. I'm passionate about DevOps culture, mentoring junior engineers, and solving complex distributed systems challenges."

🔧 COMPREHENSIVE SKILL EXTRACTION:
   Extract ALL skills including:
   • **Programming Languages**: JavaScript, Python, Java, C++, Go, Rust, TypeScript, etc.
   • **Frameworks & Libraries**: React, Vue, Angular, Node.js, Django, Flask, Spring Boot, etc.
   • **Databases**: PostgreSQL, MongoDB, MySQL, Redis, DynamoDB, Cassandra, etc.
   • **Cloud & Infrastructure**: AWS, Azure, GCP, Docker, Kubernetes, Terraform, Jenkins, etc.
   • **Tools & Platforms**: Git, JIRA, Confluence, Figma, Tableau, Salesforce, etc.
   • **Methodologies**: Agile, Scrum, TDD, CI/CD, Microservices, RESTful APIs, GraphQL, etc.
   • **Soft Skills**: Leadership, Project Management, Stakeholder Communication, Mentoring, etc.
   • **Domain Expertise**: FinTech, Healthcare, E-commerce, Machine Learning, Cybersecurity, etc.
   
   Apply INFERENCE:
   - If resume mentions "built React apps" → add "React", "JavaScript", "HTML", "CSS", "npm"
   - If "deployed to AWS" → add "AWS", "Cloud Computing", "DevOps"
   - If "led team of 5 engineers" → add "Team Leadership", "Mentoring", "Agile"
   - Extract implicit skills from project descriptions and achievements
   
   Return 15-40 skills (quality > quantity, but be comprehensive)

🎓 EDUCATION PARSING:
   • List in reverse chronological order (most recent first)
   • Extract full institution name (expand abbreviations: "MIT" → "Massachusetts Institute of Technology")
   • Parse complete degree: type + major + minor if present
     Examples: "Bachelor of Science in Computer Science", "MBA in Finance", "Ph.D. in Artificial Intelligence"
   • Extract start/end years in YYYY format
   • Handle ongoing education (use "Present" for end date)

💻 WORK EXPERIENCE ENRICHMENT:
   For each role, provide:
   • **Company**: Full legal name or well-known brand name
   • **Title**: Exact job title as written
   • **Location**: City, State/Country format
   • **Dates**: YYYY-MM format for precision (or YYYY if month unavailable)
   • **Description**: Synthesize a concise 2-3 sentence summary that:
     - Leads with scope/team size/tech stack if mentioned
     - Highlights 1-2 key achievements with metrics (revenue impact, performance gains, user growth)
     - Mentions technologies used and problems solved
     - Focuses on IMPACT, not just responsibilities
   
   Example:
   "Led a team of 8 engineers to rebuild the company's legacy monolith into a cloud-native microservices architecture using Kubernetes and AWS. Reduced deployment time from hours to minutes and improved system uptime to 99.99%. Technologies: Python, Docker, Terraform, PostgreSQL, React."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 DATA QUALITY STANDARDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• Use null for genuinely missing numeric values
• Use empty string "" for missing text fields (NOT null)
• Use empty arrays [] for missing lists (NOT null)
• Standardize date formats: YYYY or YYYY-MM
• Validate email format before returning
• Ensure phone numbers are properly formatted
• NO placeholders like "Not specified" or "N/A" - use empty string
• Be intelligent: make reasonable inferences from context

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 RESUME CONTENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${resumeText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 OUTPUT SCHEMA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return ONLY valid JSON matching this exact schema:

${JSON.stringify(PARSING_SCHEMA, null, 2)}

Begin your analysis now. Return the parsed profile as a JSON object:`;
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
    temperature: 0.3, // Slightly higher for creative professional summaries while maintaining accuracy
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are an elite AI career analyst with expertise in resume parsing, professional branding, and talent assessment. You work for JobRaker, an enterprise-grade career management platform.

Your responsibilities:
• Extract structured data with exceptional accuracy
• Generate compelling professional narratives that showcase candidate value
• Infer skills and expertise from context and project descriptions
• Apply industry knowledge to enrich profile data
• Maintain consistency with enterprise hiring standards

Output Requirements:
• Return ONLY valid, properly formatted JSON
• Follow the exact schema provided
• Apply sophisticated analysis and intelligent inference
• Ensure all text is professional, polished, and compelling
• Focus on quantifiable achievements and business impact`
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
