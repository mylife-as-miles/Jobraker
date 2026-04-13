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

// Dynamic CORS headers that support multiple allowed origins
export function getCorsHeaders(origin?: string): Record<string, string> {
  const allowedOrigins = [
    'https://jobraker-tau.vercel.app',
    'https://jobraker.vercel.app',
    'http://127.0.0.1:3000',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://localhost:5173',
    'http://127.0.0.1:4173',
    'http://localhost:4173',
    'https://localhost:3000',
    'https://localhost:5173',
  ];

  const corsOrigin = origin && allowedOrigins.includes(origin) ? origin : '*';

  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-skyvern-api-key, x-api-key, accept, accept-language, content-language',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

// Legacy export for backwards compatibility
export const corsHeaders = getCorsHeaders();
