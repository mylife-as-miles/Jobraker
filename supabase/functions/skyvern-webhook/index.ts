// @ts-nocheck
// Skyvern webhook receiver to update application status and manage the user's job queue.
// When a job application is successful, it is removed from the user's personal 'jobs' table.

import { corsHeaders } from "../_shared/types.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

function ok(json: any, status = 200) {
  return new Response(JSON.stringify(json), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } });
}

// Helper to extract the source_url from the 'notes' field of an application.
// This is necessary to identify which job to delete from the user's queue.
function extractSourceUrl(notes: string | null): string | null {
  if (!notes) return null;
  // The format is "Source: <url> | ..."
  const match = notes.match(/Source: (https?:\/\/[^\s|]+)/);
  return match ? match[1] : null;
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

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || '';
    if (!serviceKey) return ok({ error: 'Server misconfigured: Missing service key' }, 500);

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, { auth: { persistSession: false } });

    // Step 1: Find the application associated with this run to get user_id and source_url for later.
    const { data: application, error: appFetchError } = await sb
      .from('applications')
      .select('user_id, notes')
      .eq('run_id', run_id)
      .maybeSingle();

    if (appFetchError) {
      console.error('Webhook error: Could not fetch application by run_id.', { run_id, error: appFetchError.message });
      // We can still proceed to update the application status, so this is not a fatal error.
    }

    // Step 2: Update the application status.
    const finalStatus = ['succeeded', 'completed'].includes(status) ? 'Applied' : (['failed', 'error', 'cancelled'].includes(status) ? 'Rejected' : null);

    const patch: any = {
      provider_status: status || null,
      workflow_id: workflow_id || null,
      app_url: app_url || null,
      recording_url: recording_url || null,
      failure_reason: failure_reason || null,
      updated_at: new Date().toISOString(),
    };
    if (finalStatus) patch.status = finalStatus;

    const { data: updatedApps, error: updateError } = await sb.from('applications').update(patch).eq('run_id', run_id).select();

    if (updateError) {
      return ok({ error: `Failed to update application: ${updateError.message}` }, 500);
    }

    // Step 3: If the application was successful, remove the job from the user's personal queue.
    if (finalStatus === 'Applied' && application) {
      const sourceUrl = extractSourceUrl(application.notes);
      if (sourceUrl) {
        const { error: deleteJobError } = await sb
          .from('jobs') // The new, renamed table for per-user job queues.
          .delete()
          .eq('user_id', application.user_id)
          .eq('apply_url', sourceUrl); // The 'apply_url' in 'jobs' table corresponds to the job's sourceUrl.

        if (deleteJobError) {
          // Log this error but don't fail the webhook. The main task (updating status) succeeded.
          console.error(`Webhook: Failed to delete job from queue for user ${application.user_id}. URL: ${sourceUrl}. Error: ${deleteJobError.message}`);
        }
      } else {
        console.warn(`Webhook: Could not extract sourceUrl from notes for run_id ${run_id}. Cannot delete job from queue.`);
      }
    }

    return ok({ ok: true, updated: updatedApps?.length ?? 0 });
  } catch (e) {
    console.error('Webhook processing error:', e.message);
    return ok({ error: e?.message || 'Unknown error' }, 500);
  }
});