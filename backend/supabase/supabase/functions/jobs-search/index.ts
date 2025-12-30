// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/types.ts';
import { produceMessage } from '../_shared/kafka.ts';

Deno.serve(async (req) => {
  // Get dynamic CORS headers based on request origin
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing token' }), { status: 401, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    // Parse body early for query params
    const body = await req.json().catch(() => ({}));
    const rawQuery = (body?.searchQuery || body?.query || '').trim();
    const location = (body?.location || '').trim();
    // Enforce last 30 days window for search time-bounds
    const tbs = 'qdr:m';
    const limit = Number.isFinite(Number(body?.limit))
      ? Math.max(1, Math.min(100, Number(body.limit)))
      : 50;

    if (!rawQuery) {
      return new Response(JSON.stringify({ error: 'searchQuery is required' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    // User-scoped client and user
    const supabaseAuthed = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await supabaseAuthed.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), { status: 401, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }
    const userId = user.id;

    console.log('jobs-search.request_received', { userId, rawQuery, location, method: 'kafka_async' });

    // Produce message to Kafka
    // Topic name should be configured in env vars, default to 'job-search-requests'
    const topic = Deno.env.get('KAFKA_TOPIC_JOB_SEARCH') || 'job-search-requests';

    const messagePayload = {
      userId,
      searchQuery: rawQuery,
      location,
      limit,
      tbs,
      timestamp: new Date().toISOString()
    };

    await produceMessage(topic, {
      key: userId, // Key by userId to ensure ordering if needed, or distribution
      value: messagePayload,
      headers: {
        source: 'supabase-edge-function',
        action: 'job-search'
      }
    });

    console.log('jobs-search.queued', { topic });

    // Return success immediately with 0 inserted (frontend will wait for Realtime updates)
    return new Response(
      JSON.stringify({ 
        success: true, 
        jobsInserted: 0,
        status: 'queued',
        message: 'Search request queued for processing. Results will appear shortly.'
      }),
      { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' } },
    );

  } catch (e: any) {
    console.error('jobs-search.error', e);
    return new Response(JSON.stringify({ error: e?.message || 'An unexpected error occurred.' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } });
  }
});
