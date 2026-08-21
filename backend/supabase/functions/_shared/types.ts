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

// Re-export CORS helpers from canonical _shared/cors.ts
export { getCorsHeaders, corsHeaders } from "./cors.ts";

