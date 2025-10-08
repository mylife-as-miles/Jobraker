// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/types.ts';
import { withRetry, resolveFirecrawlApiKey, firecrawlFetch } from '../_shared/firecrawl.ts';

// Use the admin client for elevated privileges to delete/insert into the jobs table.
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  // Immediately handle CORS preflight requests.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Step 1: Authenticate the user and get their ID.
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing token' }), { status: 401, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    const supabaseAuthed = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await supabaseAuthed.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), { status: 401, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }
    const userId = user.id;

  // Step 2: Parse request parameters & feature flags
  const body = await req.json().catch(() => ({}));
  const searchQuery = (body?.searchQuery || '').trim();
  const location = (body?.location || '').trim();
  const types = Array.isArray(body?.type) ? body.type : (typeof body?.type === 'string' ? [body.type] : []);
  const debug = Boolean(body?.debug);
  const clearExisting = Boolean(body?.clearExisting);
  const relaxSchema = Boolean(body?.relaxSchema);

    if (!searchQuery) {
        return new Response(JSON.stringify({ error: 'Search query is required.' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    // Resolve Firecrawl API key using the shared utility.
    const headerKey = req.headers.get('x-firecrawl-api-key');
    const firecrawlApiKey = await resolveFirecrawlApiKey(supabaseAdmin, userId, headerKey);

    // Step 3: Use FIRE-1 agentic extraction for personalized job sourcing.
    // Fetch user's job source preferences.
    const { data: settings } = await supabaseAdmin.from('job_source_settings').select('allowed_domains').eq('user_id', userId).maybeSingle();
    const userSources = (settings?.allowed_domains || []).filter(Boolean).map(url => `${url.replace(/\/$/, '')}/*`);

    if (userSources.length === 0) {
      return new Response(JSON.stringify({ success: true, jobs_added: 0, reason: 'no_job_sources_configured' }), { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    const jobSchema = {
      type: 'object',
      properties: {
        jobTitle: { type: 'string' },
        companyName: { type: 'string' },
        location: { type: 'string' },
        workType: { type: 'string', enum: ['On-site', 'Remote', 'Hybrid'] },
        fullJobDescription: { type: 'string' },
        postedDate: { type: 'string' },
        salaryRange: { type: 'string' },
        applyUrl: { type: 'string' },
      },
      required: relaxSchema ? ['jobTitle','companyName'] : ['jobTitle','companyName','location','fullJobDescription'],
    };

    const extractPrompt = `For the role of "${searchQuery}" ${location ? `near "${location}"` : ''}, extract job posting details.`;

    const extractJob = await withRetry(() => firecrawlFetch('/extract', firecrawlApiKey, {
      urls: userSources,
      prompt: extractPrompt,
      schema: {
        type: 'object',
        properties: {
          jobs: {
            type: 'array',
            items: jobSchema,
          }
        },
        required: ['jobs'],
      },
      agent: { model: "FIRE-1" },
      enableWebSearch: true
    }), 2, 600);

    const jobId = extractJob?.jobId;
    if (!jobId) {
      throw new Error('Failed to start Firecrawl extract job.');
    }

    console.info('firecrawl.extract_started', { user_id: userId, query: searchQuery, location, jobId, prompt: extractPrompt, sources: userSources });

    return new Response(JSON.stringify({ success: true, jobId }), {
      status: 202, // Accepted
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });

  } catch (error) {
    if (error.message.includes('Firecrawl API key not found')) {
      return new Response(JSON.stringify({ error: 'missing_api_key', detail: error.message }), {
        status: 400, // Bad Request, as the user needs to configure their key.
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }
    console.error('process-and-match error:', error.message);
    return new Response(JSON.stringify({ error: error.message || 'An unexpected error occurred.' }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});