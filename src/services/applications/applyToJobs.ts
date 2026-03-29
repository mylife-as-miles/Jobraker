import { invokeProtectedFunction } from "../supabase/invokeProtectedFunction";

export type ApplyToJobsParams = {
  job_urls?: string[] | string;
  jobs?: Array<{ sourceUrl?: string; url?: string; source_url?: string }>;
  additional_information?: string;
  resume?: string;
  cover_letter?: string;
  cover_letter_template?: string;
  workflow_id?: string;
  proxy_location?: string;
  webhook_url?: string;
  title?: string;
  email?: string;
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
