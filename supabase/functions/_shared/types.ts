export interface CandidateProfile {
  fullName: string;
  location: string;
  yearsOfExperience: number;
  coreSkills: string[];
  workExperience: {
    jobTitle: string;
    company: string;
    responsibilities: string;
  }[];
}

export interface JobListing {
  jobTitle: string;
  companyName: string;
  location: string;
  workType?: 'On-site' | 'Remote' | 'Hybrid';
  experienceLevel?: string;
  requiredSkills?: string[];
  // Optional structured extras
  requirements?: string[];
  benefits?: string[];
  fullJobDescription: string;
  sourceUrl: string;
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-firecrawl-api-key, x-skyvern-api-key, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
