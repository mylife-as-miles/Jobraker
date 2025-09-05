import { createClient } from '../../lib/supabaseClient';

export type ApplyToJobsParams = {
  job_urls?: string[] | string;
  jobs?: Array<{ sourceUrl?: string; url?: string; source_url?: string }>;
  additional_information?: string;
  resume?: string;
  workflow_id?: string;
  proxy_location?: string;
  webhook_url?: string;
  title?: string;
};

export async function applyToJobs(payload: ApplyToJobsParams) {
  const supabase = createClient();
  const { data, error } = await (supabase as any).functions.invoke('apply-to-jobs', {
    body: payload,
  });
  if (error) throw error;
  return data as {
    ok: boolean;
    skyvern: any;
    submitted: { workflow_id: string; count: number };
  };
}
