import { createClient } from '../../lib/supabaseClient';

import { type Profile } from "../../hooks/useProfileSettings";

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
  user_input?: Profile | null;
  email?: string | null;
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
