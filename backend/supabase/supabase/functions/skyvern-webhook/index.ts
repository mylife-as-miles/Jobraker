// @ts-nocheck
// Skyvern webhook receiver to update application status and manage the user's job queue.
// When a job application is successful, it is removed from the user's personal 'jobs' table.

import { getCorsHeaders } from "../_shared/types.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

// Helper to extract the source_url from the 'notes' field of an application.
// This is necessary to identify which job to delete from the user's queue.
function extractSourceUrl(notes: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/Source: (https?:\/\/[^\s|]+)/);
  return match ? match[1] : null;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Immediately handle CORS preflight requests.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'content-type': 'application/json' }});
  }

  try {
    const body = await req.json();
    const run_id = body?.id || body?.run_id || null;
    const status = (body?.status || '').toLowerCase();

    if (!run_id) {
      return new Response(JSON.stringify({ error: 'run_id is missing from webhook payload' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' }});
    }

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceKey) {
      console.error("FATAL: SUPABASE_SERVICE_ROLE_KEY is not set.");
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' }});
    }

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, { auth: { persistSession: false } });

    // Step 1: Find the application associated with this run to get user_id and source_url.
    const { data: application, error: appFetchError } = await sb
      .from('applications')
      .select('user_id, notes')
      .eq('run_id', run_id)
      .maybeSingle();

    if (appFetchError) {
      // This is a critical error, as we can't update the status or delete the job without this info.
      console.error('Webhook error: Could not fetch application by run_id.', { run_id, error: appFetchError.message });
      return new Response(JSON.stringify({ error: 'Failed to fetch original application record' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' }});
    }

    if (!application) {
        console.warn('Webhook warning: No application found for run_id', { run_id });
        return new Response(JSON.stringify({ ok: true, message: 'No application found for this run_id.' }), { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' }});
    }

    // Step 2: Update the application status.
    const finalStatus = ['succeeded', 'completed'].includes(status) ? 'Applied' : (['failed', 'error', 'cancelled'].includes(status) ? 'Rejected' : null);
    const patch = {
      provider_status: status,
      workflow_id: body?.workflow_id || null,
      app_url: body?.app_url || null,
      recording_url: body?.recording_url || null,
      failure_reason: body?.failure_reason || body?.error || null,
      updated_at: new Date().toISOString(),
      ...(finalStatus && { status: finalStatus }),
    };

    const { data: updatedApps, error: updateError } = await sb.from('applications').update(patch).eq('run_id', run_id).select();

    if (updateError) {
      console.error('Webhook error: Failed to update application status.', { run_id, error: updateError.message });
      return new Response(JSON.stringify({ error: `Failed to update application: ${updateError.message}` }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' }});
    }

    // Step 3: If the application was successful, remove the job from the user's personal queue.
    if (finalStatus === 'Applied') {
      const sourceUrl = extractSourceUrl(application.notes);
      if (sourceUrl) {
        // CRITICAL FIX: Use both user_id and apply_url to uniquely identify the job to delete.
        const { error: deleteJobError } = await sb
          .from('jobs') // The renamed table for per-user job queues.
          .delete()
          .eq('user_id', application.user_id)
          .eq('apply_url', sourceUrl);

        if (deleteJobError) {
          // Log this error but don't fail the webhook. The main task (updating status) succeeded.
          console.error(`Webhook: Failed to delete job from queue for user ${application.user_id}. URL: ${sourceUrl}. Error: ${deleteJobError.message}`);
        }
      } else {
        console.warn(`Webhook: Could not extract sourceUrl from notes for run_id ${run_id}. Cannot delete job from queue.`);
      }
    }

    return new Response(JSON.stringify({ ok: true, updated: updatedApps?.length ?? 0 }), { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' }});
  } catch (e) {
    console.error('Webhook processing error:', e.message);
    return new Response(JSON.stringify({ error: e.message || 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' }});
  }
});