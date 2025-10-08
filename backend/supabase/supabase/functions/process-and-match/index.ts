// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/types.ts';
import { parseSalaryRangeToMinMax, inferSalaryMeta } from '../_shared/salary.ts';
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
  const clearExisting = Boolean(body?.clearExisting); // Clear only after confirming new jobs
  const relaxSchema = Boolean(body?.relaxSchema); // Less strict required fields for debugging

    if (!searchQuery) {
        return new Response(JSON.stringify({ error: 'Search query is required.' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    // Resolve Firecrawl API key using the shared utility.
    const headerKey = req.headers.get('x-firecrawl-api-key');
    const firecrawlApiKey = await resolveFirecrawlApiKey(supabaseAdmin, userId, headerKey);

    // Step 3: Perform deep research with a fallback for broader results.
    const typeText = types.length ? `\n• Prefer work type: ${types.join(', ')}` : '';
    const buildPrompt = (q: string, withLocation: boolean) => {
      const locText = withLocation && location ? ` in ${location}` : '';
      return `Find current job opportunities for: ${q}${locText}.${typeText}`;
    };

    const firecrawlParams = { maxDepth: 3, timeLimit: 90, maxUrls: 20 };
    let deepResearchData: any = null;
    let sources: any[] = [];
    let usedFallback = false;
    let initialPrompt = buildPrompt(searchQuery, true);

    const performResearch = async (prompt: string) => {
      try {
        const resp: any = await withRetry(() => firecrawlFetch('/v1/deep-research', firecrawlApiKey, { query: prompt, ...firecrawlParams }), 2, 600);
        return resp?.data || resp;
      } catch (e: any) {
        const status = e?.status;
        if (status === 401) {
          console.error('firecrawl.deep_research_unauthorized', { user_id: userId });
          throw new Response(JSON.stringify({ error: 'firecrawl_unauthorized', detail: 'Firecrawl rejected the API key (401). Rotate or supply a valid key.' }), { status: 502, headers: { ...corsHeaders, 'content-type': 'application/json' } });
        }
        console.error('firecrawl.deep_research_error', { user_id: userId, message: e?.message, prompt });
        throw new Response(JSON.stringify({ error: 'deep_research_failed', detail: e?.message }), { status: 502, headers: { ...corsHeaders, 'content-type': 'application/json' } });
      }
    };

    // Attempt 1: Specific search with location.
    deepResearchData = await performResearch(initialPrompt);
    sources = Array.isArray(deepResearchData?.sources) ? deepResearchData.sources : [];

    // Attempt 2: Fallback to a broader search if the first yielded no results.
    if (sources.length === 0 && location) {
      usedFallback = true;
      console.info('firecrawl.deep_research_fallback', { user_id: userId, query: searchQuery, location });
      const fallbackPrompt = buildPrompt(searchQuery, false);
      deepResearchData = await performResearch(fallbackPrompt);
      sources = Array.isArray(deepResearchData?.sources) ? deepResearchData.sources : [];
    }

    const scrapedUrls = sources
      .map((s: any) => s?.url || s?.link || s?.source_url || s?.page_url)
      .filter((u: any) => typeof u === 'string')
      .map((u: string) => { try { const uo = new URL(u); uo.hash=''; return uo.toString(); } catch { return u.trim(); } })
      .filter((u, i, arr) => arr.indexOf(u) === i);

    console.info('firecrawl.deep_research', {
      user_id: userId,
      query: searchQuery,
      location,
      types,
      params: firecrawlParams,
      used_fallback: usedFallback,
      raw_source_count: sources.length,
      unique_url_count: scrapedUrls.length,
      sample_sources: debug ? sources.slice(0,3) : undefined,
      prompt: debug ? (usedFallback ? buildPrompt(searchQuery, false) : initialPrompt) : undefined,
    });

    if (!scrapedUrls.length) {
      return new Response(JSON.stringify({ success: true, jobs_added: 0, reason: 'no_sources', raw_source_count: sources.length, used_fallback: usedFallback }), { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    // Step 4: Scrape structured data from the found URLs.
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
      },
      required: relaxSchema ? ['jobTitle','companyName'] : ['jobTitle','companyName','location','fullJobDescription'],
    };

    const scrapePromises = scrapedUrls.map((url: string) =>
      withRetry(() => firecrawlFetch('/v1/scrape', firecrawlApiKey, { url, pageOptions: { extractionSchema: jobSchema } }), 2, 500)
        .then(res => ({ ...res, sourceUrl: url }))
        .catch((err) => { if (debug) console.warn('scrape_failed', { url, err: err?.message }); return null; })
    );
    const scrapeResults = (await Promise.all(scrapePromises)).filter(res => res?.success && res?.data);

    console.info('firecrawl.scrape_summary', {
      user_id: userId,
      attempted: scrapedUrls.length,
      succeeded: scrapeResults.length,
      relaxSchema,
    });

    // Step 5: Map scraped data and insert into the user's personal 'jobs' table.
    if (scrapeResults.length > 0) {
      const jobsToInsert = scrapeResults.map(({ data, sourceUrl }) => {
        const salaryText = data.salaryRange || data.fullJobDescription || '';
        const { min: salary_min, max: salary_max } = parseSalaryRangeToMinMax(salaryText);
        const meta = inferSalaryMeta(salaryText);
        return {
          user_id: userId,
          source_type: 'deepresearch',
          source_id: sourceUrl,
          title: data.jobTitle,
          company: data.companyName,
            description: data.fullJobDescription,
          location: data.location,
          remote_type: data.workType,
          apply_url: sourceUrl,
          posted_at: data.postedDate ? new Date(data.postedDate).toISOString() : new Date().toISOString(),
          status: 'active',
          raw_data: { ...data, _search_query: searchQuery, _search_location: location, _search_used_fallback: usedFallback },
          salary_min: salary_min,
          salary_max: salary_max,
          salary_currency: meta.currency || (salary_min || salary_max ? 'USD' : null),
        };
      });

      if (clearExisting) {
        let deleteQuery = supabaseAdmin
          .from('jobs')
          .delete()
          .eq('user_id', userId)
          .eq('source_type', 'deepresearch')
          .eq('raw_data->>_search_query', searchQuery);

        if (location) {
          deleteQuery = deleteQuery.eq('raw_data->>_search_location', location);
        } else {
          deleteQuery = deleteQuery.or('raw_data->>_search_location.is.null,raw_data->>_search_location.eq.');
        }

        const { error: deleteError } = await deleteQuery;

        if (deleteError) {
          console.error('jobs_clear_failed', { user_id: userId, error: deleteError.message });
        }
      }

      // Upsert to avoid duplicate entries for the same source URL for this user (requires unique index on (user_id, source_id)).
      const { error: insertError } = await supabaseAdmin.from('jobs')
        .upsert(jobsToInsert, { onConflict: 'user_id,source_id' });
      if (insertError) {
        throw new Error(`Failed to insert new jobs: ${insertError.message}`);
      }

      return new Response(JSON.stringify({ success: true, jobs_added: jobsToInsert.length, cleared: clearExisting || false }), {
        status: 200,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, jobs_added: 0, reason: 'no_structured_results', attempted: scrapedUrls.length }), { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' } });

  } catch (error) {
    console.error('process-and-match error:', error.message);
    return new Response(JSON.stringify({ error: error.message || 'An unexpected error occurred.' }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});