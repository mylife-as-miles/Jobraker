// Generated Supabase types placeholder.
// TODO: Replace with actual generated output via `npx supabase gen types typescript --local > src/types/supabase.ts`
// Keeping minimal shapes for immediate DX; refine once generation command integrated.

export interface Tables {
  profiles: {
    Row: {
      id: string;
      first_name: string | null;
      last_name: string | null;
      job_title: string | null;
      experience_years: number | null;
      location: string | null;
      goals: string[] | null;
      about: string | null;
      onboarding_complete: boolean | null;
      base_resume_id?: string | null;
      created_at?: string;
      updated_at?: string;
      walkthrough_overview?: boolean | null;
      walkthrough_applications?: boolean | null;
      walkthrough_jobs?: boolean | null;
      walkthrough_resume?: boolean | null;
      walkthrough_analytics?: boolean | null;
      walkthrough_settings?: boolean | null;
      walkthrough_profile?: boolean | null;
      walkthrough_notifications?: boolean | null;
      walkthrough_chat?: boolean | null;
    };
  };
  resumes: {
    Row: {
      id: string;
      user_id: string | null;
      name: string;
      template: string | null;
      status: string;
      applications: number;
      thumbnail: string | null;
      is_favorite: boolean;
      file_path: string | null;
      file_ext: string | null;
      size: number | null;
      updated_at?: string;
    };
  };
  parsed_resumes: {
    Row: {
      id?: string;
      resume_id: string;
      user_id: string;
      raw_text: string;
      json: any;
      structured: any;
      skills: string[];
      embedding: string | null;
      created_at?: string;
    }
  }
}

export type ProfileRow = Tables['profiles']['Row'];
export type ResumeRow = Tables['resumes']['Row'];
export type ParsedResumeRow = Tables['parsed_resumes']['Row'];
