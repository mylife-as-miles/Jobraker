import { invokeProtectedFunction } from "../supabase/invokeProtectedFunction";

export type ApplyToJobsParams = {
  job_urls?: string[] | string;
  jobs?: Array<{
    sourceUrl?: string;
    url?: string;
    source_url?: string;
    job_id?: string;
    job_title?: string;
    company?: string;
    location?: string | null;
    salary?: string | null;
    match_score?: number | null;
    match_reasons?: string[] | null;
    ai_confidence_score?: number | null;
    evaluation_id?: string | null;
  }>;
  additional_information?: string;
  resume?: string;
  cover_letter?: string;
  cover_letter_template?: string;
  workflow_id?: string;
  proxy_location?: string;
  webhook_url?: string;
  title?: string;
  email?: string;
  job_id?: string | null;
  job_title?: string | null;
  company?: string | null;
  location?: string | null;
  salary?: string | null;
  match_score?: number | null;
  match_reasons?: string[] | null;
  ai_confidence_score?: number | null;
  evaluation_id?: string | null;
};

export async function applyToJobs(payload: ApplyToJobsParams) {
  const data = await invokeProtectedFunction<{
    ok: boolean;
    skyvern: any;
    submitted: { workflow_id: string; count: number };
  }>("apply-to-jobs", {
    body: payload,
  });

  return data;
}
