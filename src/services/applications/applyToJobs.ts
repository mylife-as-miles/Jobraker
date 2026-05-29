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
  resume_text?: string;
  cover_letter?: string;
  cover_letter_template?: string;
  workflow_id?: string;
  proxy_location?: string;
  webhook_url?: string;
  title?: string;
  /** Passed through to apply-to-jobs → Skyvern `x-max-steps-override` (default 200, max 500). */
  max_steps_override?: number;
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
    skyvern?: any;
    automation?: any;
    provider?: any;
    billing?: {
      credits_deducted?: number;
      remaining_balance?: number;
      jobs_count?: number;
      note?: string;
    };
    submitted: { workflow_id: string; count: number; max_steps_override?: number };
  }>("apply-to-jobs", {
    body: payload,
  });

  return data;
}
