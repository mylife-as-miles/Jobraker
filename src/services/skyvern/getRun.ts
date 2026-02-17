import { createClient } from '../../lib/supabaseClient';

export interface SkyvernRunSubset {
  run_id: string;
  status: string;
  failure_reason?: string | null;
  recording_url?: string | null;
  screenshot_urls?: string[];
  downloaded_files?: any[];
  created_at?: string;
  started_at?: string | null;
  finished_at?: string | null;
  modified_at?: string;
  run_type?: string;
  app_url?: string;
  parsed_resume_output?: Record<string, any>;
  extracted_information?: any[];
  request_parameters?: Record<string, any>;
  workflow_id?: string;
}

export interface GetRunResponse {
  ok: boolean;
  run: SkyvernRunSubset;
  raw?: any;
  error?: string;
}

export async function getRun(run_id: string, opts: { raw?: boolean } = {}): Promise<GetRunResponse> {
  if (!run_id) throw new Error('run_id required');
  const supabase = createClient();
  const { data, error } = await (supabase as any).functions.invoke('get-run', {
    // GET semantics: Supabase invoke sends POST by default, but we built function expecting GET.
    // Workaround: call via fetch directly to edge function URL for true GET.
    // We'll fall back to manual fetch.
    body: { _method: 'GET', run_id },
  });
  if (error) throw error;
  // If the edge function rejects POST, we fetch manually
  if (!data || data.error === 'Method not allowed') {
    const baseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '') + '/functions/v1/get-run';
    const url = `${baseUrl}?run_id=${encodeURIComponent(run_id)}${opts.raw ? '&raw=1' : ''}`;
    const res = await fetch(url, { method: 'GET', headers: { 'accept': 'application/json' } });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to fetch run');
    return json as GetRunResponse;
  }
  return data as GetRunResponse;
}
