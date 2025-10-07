// @ts-nocheck
// Skyvern webhook receiver to update application status when runs complete
// Expects JSON with fields: id/run_id, status, workflow_id, app_url, recording_url, failure_reason
// Optionally include job source URL or application id in metadata for linking.

import { corsHeaders } from "../_shared/types.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

function ok(json: any, status = 200) {
  return new Response(JSON.stringify(json), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return ok({});
  if (req.method !== 'POST') return ok({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json();
    const run_id = body?.id || body?.run_id || null;
    const status = (body?.status || '').toLowerCase();
    const workflow_id = body?.workflow_id || null;
    const app_url = body?.app_url || null;
    const recording_url = body?.recording_url || null;
    const failure_reason = body?.failure_reason || body?.error || null;

    if (!run_id) return ok({ error: 'run_id missing' }, 400);

    let supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    if (!supabaseUrl) {
      const ref = req.headers.get('sb-project-ref') || '';
      if (ref) supabaseUrl = `https://${ref}.supabase.co`;
    }
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !serviceKey) return ok({ error: 'server misconfigured' }, 500);

    const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Update applications that match run_id
    const finalStatus = ['succeeded','completed'].includes(status) ? 'Applied' : (['failed','error','cancelled'].includes(status) ? 'Rejected' : null);

    const patch: any = {
      provider_status: status || null,
      workflow_id: workflow_id || null,
      app_url: app_url || null,
      recording_url: recording_url || null,
      failure_reason: failure_reason || null,
      updated_at: new Date().toISOString(),
    };
    if (finalStatus) patch.status = finalStatus;

    const { data, error } = await sb.from('applications').update(patch).eq('run_id', run_id);
    if (error) return ok({ error: error.message }, 500);

    return ok({ ok: true, updated: (data as any)?.length ?? 0 });
  } catch (e) {
    return ok({ error: e?.message || 'unknown error' }, 500);
  }
});
