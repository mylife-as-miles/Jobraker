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
  const limit = Number.isFinite(Number(body?.limit)) ? Math.max(0, Number(body?.limit)) : undefined;
  const clearExisting = Boolean(body?.clearExisting);
  const relaxSchema = Boolean(body?.relaxSchema);

    if (!searchQuery) {
        return new Response(JSON.stringify({ error: 'Search query is required.' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

  // Resolve Firecrawl API key from function secrets only.
  const firecrawlApiKey = await resolveFirecrawlApiKey();

    // Step 3: Use FIRE-1 agentic extraction for personalized job sourcing.
    // The frontend should now provide the URLs directly in the payload.
    const urls = Array.isArray(body?.urls) ? body.urls : [];
    const userSources = urls.filter(Boolean).map(url => String(url).replace(/\/$/, ''));

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

    const extractPrompt = `For the role of "${searchQuery}" ${location ? `near "${location}"` : ''}, extract job posting details.${limit === 1 ? ' Return only the single best matching job.' : ''}`;

    const finalSchema: any = {
      type: 'object',
      properties: {
        jobs: {
          type: 'array',
          items: jobSchema,
          ...(typeof limit === 'number' && limit > 0 ? { maxItems: limit } : {}),
          minItems: 0,
        }
      },
      required: ['jobs'],
    };

    const payload = {
      urls: userSources,
      prompt: extractPrompt,
      schema: finalSchema,
      agent: { model: "FIRE-1" },
      enableWebSearch: true,
      scrapeOptions: {
        formats: [{
          type: 'json',
          prompt: extractPrompt,
          schema: finalSchema,
        }]
      }
    };

    let extractJob: any;
    try {
      extractJob = await withRetry(() => firecrawlFetch('/extract', firecrawlApiKey, payload), 2, 600);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (e?.status === 429 || /Rate limit exceeded/i.test(msg)) {
        const retryAfterSeconds = typeof e?.retryAfterSeconds === 'number' ? e.retryAfterSeconds : 55;
        console.warn('firecrawl.rate_limited', { message: msg, retry_after_seconds: retryAfterSeconds });
        return new Response(JSON.stringify({ error: 'rate_limited', retryAfterSeconds }), {
          status: 429,
          headers: { ...corsHeaders, 'content-type': 'application/json' },
        });
      }
      throw e;
    }

    // The Firecrawl API returns the job identifier in the `id` field.
    const jobId = extractJob?.id;
    if (!jobId) {
      console.error('Firecrawl job started but no ID was returned.', { response: extractJob });
      throw new Error('Failed to start Firecrawl extract job.');
    }

    console.info('firecrawl.extract_started', { user_id: userId, query: searchQuery, location, jobId, prompt: extractPrompt, sources: userSources });

    // Return the ID as `jobId` to match what the frontend and polling function expect.
    return new Response(JSON.stringify({ success: true, jobId }), {
      status: 202, // Accepted
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });

  } catch (error) {
    const msg = String(error?.message || '');
    if (msg.includes('No Firecrawl API key configured') || msg.includes('Firecrawl API key not found')) {
      return new Response(JSON.stringify({ error: 'missing_api_key', detail: error.message }), {
        status: 400, // Bad Request, as the user needs to configure their key.
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }
    console.error('process-and-match error:', msg);
    return new Response(JSON.stringify({ error: msg || 'An unexpected error occurred.' }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});