# Enterprise AI-Powered Onboarding Setup

## Overview

The onboarding flow features **enterprise-grade AI-powered resume parsing** using **GPT-4o** (OpenAI's most advanced model) that performs sophisticated career analysis and automatically creates rich, professional profiles with zero manual data entry.

## How It Works

### 1. Resume Upload
When a user uploads their resume during onboarding:
- The file is uploaded to Supabase storage (`resumes` bucket)
- A resume record is created in the `resumes` table
- The file content is extracted (PDF or text)

### 2. Enterprise AI Analysis (Primary Method)
If the user has configured an OpenAI API key in their settings:
- The resume text is sent to **OpenAI GPT-4o** with an enterprise-level system prompt
- AI performs deep analysis including:
  
  **📋 Contact & Identity Extraction:**
  - First name and last name (with cultural awareness for compound names)
  - Professional email (prioritizes company/edu domains)
  - Phone number with international format recognition
  - Complete location normalization (City, State, Country)
  
  **💼 Professional Profile Analysis:**
  - Current/most recent job title identification
  - Intelligent total experience calculation (handles overlaps, gaps, part-time roles)
  - Career trajectory assessment
  
  **✍️ Professional Summary Generation:**
  - Compelling 3-4 sentence "About" section
  - Written in first person, executive-coach quality
  - Highlights expertise, achievements, and unique value
  - Showcases technical domains and career focus
  
  **🔧 Comprehensive Skill Extraction (15-40 skills):**
  - Programming languages, frameworks, libraries
  - Databases, cloud platforms, infrastructure tools
  - Methodologies (Agile, TDD, CI/CD, Microservices)
  - Soft skills (Leadership, Communication, Mentoring)
  - Domain expertise (FinTech, Healthcare, ML, etc.)
  - **Smart inference**: Extracts implicit skills from project descriptions
  
  **🎓 Education Parsing:**
  - Reverse chronological order
  - Full institution names (expands abbreviations)
  - Complete degree details (type + major + minor)
  - Standardized date formats
  
  **💻 Work Experience Enrichment:**
  - Full company names
  - Exact titles and locations
  - Precise dates (YYYY-MM format)
  - Impact-focused descriptions with metrics and technologies

### 3. Fallback Heuristic Parsing
If no OpenAI key is configured or AI parsing fails:
- Falls back to the existing heuristic parser (`analyzeResumeText`)
- Extracts basic information using regex patterns and keyword matching
- Less accurate but still functional

### 4. Automatic Profile Creation
Once parsed, the system automatically:
- Saves all extracted data to the `profiles` table
- Inserts education records into `profile_education` table
- Inserts skills into `profile_skills` table
- Marks `onboarding_complete` as `true`
- Redirects user to the dashboard

## AI Model Configuration

### GPT-4o Enterprise Setup

**Model**: `gpt-4o` (OpenAI's latest and most capable model)
- **Temperature**: `0.3` - Balanced between factual accuracy and creative professional summaries
- **Response Format**: Structured JSON object with strict schema validation
- **System Prompt**: Enterprise-level career analyst persona with talent assessment expertise
- **Timeout**: 30 seconds per request
- **Token Limit**: ~128k context window (handles even lengthy resumes)

### Why GPT-4o?

1. **Superior Understanding**: Better context comprehension for implicit skill extraction
2. **Professional Writing**: Generates executive-quality professional summaries
3. **Complex Reasoning**: Accurately calculates experience years, handles career gaps, identifies career trajectory
4. **Schema Adherence**: More reliable JSON output with fewer parsing errors
5. **Multimodal Ready**: Future support for parsing resume images/scanned PDFs

### Cost Optimization

- Only called once per resume upload
- Structured output reduces token usage vs. free-form responses
- Cached results stored in `parsed_resumes` table
- Falls back to free heuristic parser if API key unavailable

## Database Schema

The profile data is stored across multiple tables:

### profiles
```sql
{
  id: uuid,
  first_name: text,
  last_name: text,
  phone: text,
  location: text,
  job_title: text,
  experience_years: integer,
  about: text,
  skills: text[],
  education: jsonb,
  experience: jsonb,
  goals: text[],
  onboarding_complete: boolean,
  avatar_url: text,
  updated_at: timestamp
}
```

**Note**: Email is stored in `auth.users` table, not in profiles.

### profile_education
```sql
{
  id: uuid,
  user_id: uuid,
  school: text,
  degree: text,
  location: text,
  start_date: date,
  end_date: date,
  gpa: numeric
}
```

### profile_skills
```sql
{
  id: uuid,
  user_id: uuid,
  name: text,
  level: text,
  category: text
}
```

## JSON Schema for AI Parsing

The AI parser uses this structured schema:

```json
{
  "type": "object",
  "properties": {
    "firstName": { "type": "string" },
    "lastName": { "type": "string" },
    "email": { "type": "string", "format": "email" },
    "phone": { "type": "string" },
    "location": { "type": "string" },
    "jobTitle": { "type": "string" },
    "experienceYears": { "type": "number", "nullable": true },
    "about": { "type": "string" },
    "skills": {
      "type": "array",
      "items": { "type": "string" }
    },
    "education": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "school": { "type": "string" },
          "degree": { "type": "string" },
          "start": { "type": "string" },
          "end": { "type": "string" }
        }
      }
    },
    "experience": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "company": { "type": "string" },
          "title": { "type": "string" },
          "location": { "type": "string" },
          "startDate": { "type": "string" },
          "endDate": { "type": "string" },
          "description": { "type": "string" }
        }
      }
    }
  },
  "required": ["firstName", "email", "skills"]
}
```

## User Flow

1. **User arrives at onboarding** after sign up
2. **Chooses "AI-Powered Setup"** (recommended option)
3. **Uploads resume** (PDF, TXT, MD, or RTF)
4. **System processes**:
   - Uploads file → Extracts text → Calls AI parser → Saves to database
5. **Success message** displayed with automatic redirect
6. **User lands on dashboard** with fully populated profile

## Configuration Requirements

### For AI Parsing
Users need to configure their OpenAI API key in Settings → Integrations:
- Navigate to Settings
- Go to Integrations section
- Add OpenAI API key
- The key is stored in the `settings` table

### Without API Key
The system will fall back to heuristic parsing, which extracts:
- Email addresses (regex)
- Phone numbers (regex)
- Skills (keyword matching)
- Section-based content (experience, education, etc.)

## Benefits

- **Zero manual data entry** - users don't fill out forms
- **Accurate extraction** - AI understands context and structure
- **Fast setup** - complete profile in seconds
- **Flexible** - works with various resume formats
- **Editable** - users can modify any field later in settings

## Implementation Files

- `/src/services/ai/parseResumeProfile.ts` - AI parsing service
- `/src/screens/Onboarding/Onboarding.tsx` - Updated onboarding flow
- `/src/utils/analyzeResume.ts` - Fallback heuristic parser

## Future Enhancements

- Support for more file formats (DOCX, etc.)
- Batch resume processing
- Confidence scores for extracted data
- Manual review/edit step before save (optional)
- Multi-language support
- Custom field mapping
