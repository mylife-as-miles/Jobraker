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
      description: "Candidate's first/given name - MANDATORY, extract from resume header/contact section"
    },
    lastName: { 
      type: "string",
      description: "Candidate's last/family name - MANDATORY, extract from resume header/contact section"
    },
    email: { 
      type: "string", 
      format: "email",
      description: "Primary professional email address - MANDATORY, always present on resumes"
    },
    phone: { 
      type: "string",
      description: "Phone number with formatting from resume - MANDATORY if present (usually is)"
    },
    location: { 
      type: "string",
      description: "Current city, state/region, and country (e.g., 'San Francisco, CA, USA') - MANDATORY, minimum city or state"
    },
    jobTitle: { 
      type: "string",
      description: "Most recent or current professional job title - MANDATORY, get from first work experience entry"
    },
    experienceYears: { 
      type: "number", 
      nullable: true,
      description: "Total years of professional experience calculated from work history - MANDATORY, intelligently sum all employment periods"
    },
    about: { 
      type: "string",
      description: "Compelling 3-4 sentence professional summary in first person - MANDATORY, generate executive-quality narrative showcasing expertise and achievements"
    },
    skills: {
      type: "array",
      description: "Comprehensive list of 20-40 technical and professional skills - MANDATORY. Include programming languages, frameworks, tools, methodologies, soft skills, and domain expertise. Apply intelligent inference from projects and experience.",
      items: { type: "string" },
      minItems: 15
    },
    education: {
      type: "array",
      description: "ALL educational credentials in reverse chronological order - MANDATORY, extract every degree/certification mentioned",
      items: {
        type: "object",
        properties: {
          school: { 
            type: "string",
            description: "Full institution name - MANDATORY"
          },
          degree: { 
            type: "string",
            description: "Complete degree type and major - MANDATORY (e.g., 'Bachelor of Science in Computer Science')"
          },
          start: { 
            type: "string",
            description: "Start year in YYYY format"
          },
          end: { 
            type: "string",
            description: "Graduation year in YYYY format or 'Present' if ongoing"
          }
        },
        required: ["school", "degree"]
      },
      minItems: 1
    },
    experience: {
      type: "array",
      description: "ALL professional work history in reverse chronological order with impact-focused descriptions - MANDATORY, extract every job including internships",
      items: {
        type: "object",
        properties: {
          company: { 
            type: "string",
            description: "Company/organization name - MANDATORY"
          },
          title: { 
            type: "string",
            description: "Job title/position held - MANDATORY"
          },
          location: { 
            type: "string",
            description: "Work location (city, state/country) or 'Remote'"
          },
          startDate: { 
            type: "string",
            description: "Start date in YYYY-MM or YYYY format - MANDATORY"
          },
          endDate: { 
            type: "string",
            description: "End date in YYYY-MM or YYYY format, or 'Present' if current role"
          },
          description: { 
            type: "string",
            description: "2-3 sentence impact-focused summary with scope, achievements, and technologies used - MANDATORY, focus on quantifiable results"
          }
        },
        required: ["company", "title", "description"]
      },
      minItems: 1
    }
  },
  required: ["firstName", "lastName", "email", "jobTitle", "about", "skills", "education", "experience"],
  additionalProperties: false
};

function buildPrompt(resumeText: string): string {
  return `You are an elite AI career analyst and resume parser for JobRaker, an enterprise-grade career management platform. Your task is to perform deep, sophisticated analysis of the resume and extract ALL structured profile data with 100% completeness.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 CRITICAL: EXTRACT ALL DATA - NO MISSING FIELDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ MANDATORY EXTRACTION RULES:
• YOU MUST extract first name and last name - NEVER leave these empty
• YOU MUST extract email address - look in header, footer, contact section
• YOU MUST extract phone number - check all formats (555-1234, (555) 123-4567, +1-555-123-4567)
• YOU MUST extract location - even if just city or state
• YOU MUST identify current/recent job title - check first work experience entry
• YOU MUST calculate years of experience - sum all work periods
• YOU MUST extract ALL work experience entries - not just recent ones
• YOU MUST extract ALL education entries - include certifications if present
• YOU MUST extract comprehensive skills - aim for 20-40 skills minimum

📋 CONTACT & IDENTITY EXTRACTION (HIGHEST PRIORITY):
   
   ✅ FIRST NAME & LAST NAME:
   • Look at the very top of resume (usually in header)
   • Check for name in contact section
   • Handle formats: "John Smith", "Smith, John", "JOHN SMITH"
   • Separate compound names: "María José García" → first: "María José", last: "García"
   • Remove titles: "Dr. John Smith" → first: "John", last: "Smith"
   • NEVER return empty - if you see ANY name, extract it
   
   ✅ EMAIL:
   • Primary professional email (prioritize .edu, company domains over generic gmail)
   • Check header, contact section, footer
   • Formats: john.smith@company.com, jsmith@university.edu
   • NEVER return empty - there is ALWAYS an email on a resume
   
   ✅ PHONE:
   • Extract with international format if present (+1, +44, etc.)
   • Clean formats: (555) 123-4567 → extract as is
   • Alternative formats: 555-123-4567, 555.123.4567, +1-555-123-4567
   • MUST find - check everywhere in resume
   
   ✅ LOCATION:
   • Complete format: "City, State, Country" (e.g., "San Francisco, CA, USA")
   • If country not mentioned, infer from phone country code or assume USA
   • Check header, contact section, work location
   • Minimum: extract city or state if that's all that's available
   • NEVER leave empty

💼 PROFESSIONAL PROFILE ANALYSIS (CRITICAL):
   
   ✅ JOB TITLE:
   • MUST extract the CURRENT or MOST RECENT job title
   • Look at the FIRST entry in work experience section
   • If currently employed, get that title
   • If not, get the most recent one
   • Examples: "Senior Software Engineer", "Product Manager", "Data Scientist"
   • NEVER generic - must be specific title from resume
   
   ✅ YEARS OF EXPERIENCE:
   • Calculate TOTAL professional experience by:
     1. Find ALL employment entries with dates
     2. For each role, calculate: end_year - start_year (or current_year if ongoing)
     3. Sum all periods (handle overlaps by taking max end_date for overlapping ranges)
     4. Exclude internships < 6 months unless only experience
     5. Round to nearest 0.5 years
   • Examples:
     - 2020-2023 + 2023-Present (2025) = 5 years
     - 2018-2020 + 2021-2024 = 5 years (account for 1 year gap proportionally)
   • MUST return a number - estimate intelligently if dates unclear

✍️ PROFESSIONAL SUMMARY GENERATION:
   Create a compelling "about" section (3-4 sentences) that:
   • Opens with professional identity: "I'm a [job title] with [X] years of experience..."
   • Highlights 2-3 specific achievements with metrics when available
   • Mentions key technical domains or industry specializations
   • Conveys career focus and unique value proposition
   • Uses first-person voice, active language, confident tone
   • Reads like a LinkedIn "About" written by an executive coach
   
   Quality bar example:
   "I'm a seasoned Senior Software Engineer with 8 years of experience building scalable cloud infrastructure and leading high-performing engineering teams. I specialize in architecting microservices platforms that handle millions of daily transactions, with deep expertise in AWS, Kubernetes, and modern CI/CD pipelines. At TechCorp, I led the migration to serverless architecture that reduced infrastructure costs by 40% while improving system uptime to 99.99%. I'm passionate about DevOps culture, mentoring engineers, and solving complex distributed systems challenges."

🔧 COMPREHENSIVE SKILL EXTRACTION (20-40 SKILLS):
   Extract ALL skills across these categories:
   
   • **Programming Languages**: JavaScript, Python, Java, C++, Go, Rust, TypeScript, SQL, etc.
   • **Frontend**: React, Vue, Angular, Next.js, HTML, CSS, Tailwind, Redux, etc.
   • **Backend**: Node.js, Django, Flask, Spring Boot, Express, FastAPI, etc.
   • **Databases**: PostgreSQL, MongoDB, MySQL, Redis, DynamoDB, Cassandra, etc.
   • **Cloud & Infrastructure**: AWS, Azure, GCP, Docker, Kubernetes, Terraform, etc.
   • **DevOps & Tools**: Git, Jenkins, GitHub Actions, CI/CD, Monitoring, etc.
   • **Methodologies**: Agile, Scrum, TDD, Microservices, RESTful APIs, GraphQL, etc.
   • **Soft Skills**: Leadership, Communication, Project Management, Mentoring, etc.
   • **Domain Expertise**: FinTech, Healthcare, E-commerce, ML, Security, etc.
   
   APPLY INTELLIGENT INFERENCE:
   - "Built React app" → ["React", "JavaScript", "TypeScript", "HTML", "CSS", "npm", "Webpack"]
   - "Deployed to AWS" → ["AWS", "Cloud Computing", "DevOps", "Infrastructure"]
   - "Database design" → ["Database Design", "SQL", "Data Modeling", "PostgreSQL"]
   - "Led team of 5" → ["Team Leadership", "Mentoring", "Agile", "Project Management"]
   
   Target: 20-40 skills (be comprehensive, quality > quantity but don't miss important ones)

🎓 EDUCATION PARSING (EXTRACT ALL ENTRIES):
   • List in reverse chronological order
   • Extract EVERY degree, certification, course mentioned
   • Full institution names: "MIT" → "Massachusetts Institute of Technology"
   • Complete degree format: "BS CS" → "Bachelor of Science in Computer Science"
   • Dates in YYYY format (start and end/graduation year)
   • Use "Present" for ongoing education
   • Include: undergrad, graduate, certifications, bootcamps

💻 WORK EXPERIENCE ENRICHMENT (EXTRACT ALL ROLES):
   For EACH and EVERY job listed:
   • **Company**: Full legal name or brand name
   • **Title**: Exact job title from resume
   • **Location**: City, State/Country (extract from resume or "Remote")
   • **Dates**: YYYY-MM format (or YYYY if month not available)
   • **Description**: Create 2-3 sentence summary:
     1. Scope: team size, tech stack, role context
     2. Achievement: 1-2 key results with metrics (revenue, performance, user impact)
     3. Technologies: specific tools/frameworks used
   
   Focus on IMPACT over duties:
   ❌ Bad: "Responsible for developing web applications"
   ✅ Good: "Led development of customer-facing web app serving 100k users, reducing load times by 60% using React and AWS Lambda. Technologies: React, Node.js, PostgreSQL, Docker."
   
   NEVER skip entries - extract ALL jobs including internships

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 DATA QUALITY REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ MANDATORY COMPLETENESS:
• firstName: NEVER empty - extract from resume
• lastName: NEVER empty - extract from resume  
• email: NEVER empty - always on resume
• phone: Extract if present (should be on 99% of resumes)
• location: Extract at minimum city or state
• jobTitle: NEVER empty - get from first work experience
• experienceYears: NEVER null - calculate from work history
• about: NEVER empty - generate professional summary
• skills: MINIMUM 15 skills, target 25-40
• education: Extract ALL entries (at least 1 for most resumes)
• experience: Extract ALL entries (at least 1-2 for most resumes)

✅ FORMATTING STANDARDS:
• Dates: YYYY or YYYY-MM format strictly
• Email: Validate format before returning
• Phone: Keep formatting from resume
• Names: Proper case (not ALL CAPS)
• No placeholders like "Not specified" - use empty string ""
• No null for text fields - use ""
• Null only for experienceYears if truly cannot calculate

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 RESUME CONTENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${resumeText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 OUTPUT SCHEMA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return ONLY valid JSON matching this exact schema. ALL fields must be populated:

${JSON.stringify(PARSING_SCHEMA, null, 2)}

⚠️ REMINDER: 
- Extract EVERY piece of data from the resume
- firstName, lastName, email, jobTitle, about, skills CANNOT be empty
- Include ALL work experience and education entries
- Be thorough and comprehensive

Begin extraction now:`;
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
