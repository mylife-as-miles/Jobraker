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
      walkthrough_application?: boolean | null;
      walkthrough_applications?: boolean | null;
      walkthrough_jobs?: boolean | null;
      walkthrough_resume?: boolean | null;
      walkthrough_analytics?: boolean | null;
      walkthrough_settings?: boolean | null;
      walkthrough_profile?: boolean | null;
      walkthrough_notifications?: boolean | null;
      walkthrough_chat?: boolean | null;
      walkthrough_cover_letter?: boolean | null;
      availability_start?: string | null;
      preferred_weekly_hours?: number | null;
      work_timezone?: string | null;
      weekly_availability?: Record<string, { start: string; end: string }[]> | null;
      availability_date_exceptions?: Array<{
        id: string;
        date: string;
        unavailable: boolean;
        slots: { start: string; end: string }[];
      }> | null;
      referral_code?: string | null;
      referred_by_user_id?: string | null;
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
      extracted_at?: string;
    };
  };
  answer_bank: {
    Row: {
      id: string;
      user_id: string;
      theme: 'identity' | 'beliefs' | 'stories' | 'career' | 'skills' | 'voice';
      slug: string;
      question: string;
      tags: string[];
      body: string;
      created_at: string;
      updated_at: string;
    };
  };
  public_profile_sites: {
    Row: {
      id: string;
      user_id: string;
      slug: string;
      is_public: boolean;
      theme: string;
      headline: string | null;
      intro: string | null;
      cta_label: string;
      contact_email: string | null;
      links: Array<{ label: string; url: string }>;
      design: Record<string, unknown>;
      section_order: string[];
      views: number;
      created_at: string;
      updated_at: string;
    };
  };
}

export type ProfileRow = Tables['profiles']['Row'];
export type ResumeRow = Tables['resumes']['Row'];
export type ParsedResumeRow = Tables['parsed_resumes']['Row'];
export type AnswerBankRow = Tables['answer_bank']['Row'];
export type PublicProfileSiteRow = Tables['public_profile_sites']['Row'];
