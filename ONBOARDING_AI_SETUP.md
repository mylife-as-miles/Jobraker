# AI-Powered Onboarding Setup

## Overview

The onboarding flow now features **automatic AI-powered resume parsing** that extracts profile data and saves it directly to the database, eliminating the need for manual data entry.

## How It Works

### 1. Resume Upload
When a user uploads their resume during onboarding:
- The file is uploaded to Supabase storage (`resumes` bucket)
- A resume record is created in the `resumes` table
- The file content is extracted (PDF or text)

### 2. AI Parsing (Primary Method)
If the user has configured an OpenAI API key in their settings:
- The resume text is sent to OpenAI GPT-4o-mini
- AI extracts structured profile data including:
  - First name and last name
  - Email and phone number
  - Location
  - Current job title
  - Years of experience
  - Professional summary (about)
  - Skills array
  - Education history (with schools, degrees, dates)
  - Work experience (with companies, titles, descriptions)

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

## Database Schema

The profile data is stored across multiple tables:

### profiles
```sql
{
  id: uuid,
  first_name: text,
  last_name: text,
  email: text,
  phone: text,
  location: text,
  job_title: text,
  experience_years: integer,
  about: text,
  skills: text[],
  education: jsonb,
  experience: jsonb,
  onboarding_complete: boolean,
  updated_at: timestamp
}
```

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
