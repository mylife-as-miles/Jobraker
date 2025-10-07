// @ts-nocheck
// Skyvern webhook receiver to update application status when runs complete.
// On success, it also removes the corresponding job from the user's 'jobs' queue.

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

    if (!run_id) return ok({ error: 'run_id is required' }, 400);

    const sbAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    // --- 1. Update the application status ---
    const finalStatus = ['succeeded', 'completed'].includes(status) ? 'Applied' : (['failed', 'error', 'cancelled'].includes(status) ? 'Rejected' : null);
    const patch: any = {
      provider_status: status || null,
      workflow_id: body?.workflow_id || null,
      app_url: body?.app_url || null,
      recording_url: body?.recording_url || null,
      failure_reason: body?.failure_reason || body?.error || null,
      updated_at: new Date().toISOString(),
    };
    if (finalStatus) patch.status = finalStatus;

    // Update the application and select the result to get user_id and notes
    const { data: applications, error: updateError } = await sbAdmin
      .from('applications')
      .update(patch)
      .eq('run_id', run_id)
      .select('user_id, notes');

    if (updateError) throw updateError;

    // --- 2. If successful, remove job from the user's queue ---
    if (['succeeded', 'completed'].includes(status) && applications && applications.length > 0) {
      const app = applications[0];
      const userId = app.user_id;
      const notes = app.notes;

      // Extract the source URL from the notes field to identify the job
      const sourceUrlMatch = notes ? notes.match(/Source: (https?:\/\/[^\s]+)/) : null;
      const sourceId = sourceUrlMatch ? sourceUrlMatch[1] : null;

      if (userId && sourceId) {
        // Delete the job from the user's personal `jobs` table
        await sbAdmin.from('jobs').delete().match({ user_id: userId, source_id: sourceId });
      }
    }

    return ok({ ok: true, updated: applications?.length ?? 0 });
  } catch (e) {
    console.error('Webhook processing error:', e);
    return ok({ error: e?.message || 'unknown error' }, 500);
  }
});