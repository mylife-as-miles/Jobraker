// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/types.ts';
import { withRetry, resolveFirecrawlApiKey, firecrawlFetch } from '../_shared/firecrawl.ts';

function hostFromUrl(u: string): string | null {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing token' }), { status: 401, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    // User-scoped client for reading settings
    const supabaseAuthed = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await supabaseAuthed.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), { status: 401, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }
    const userId = user.id;

    const body = await req.json().catch(() => ({}));
    const searchQuery = (body?.searchQuery || '').trim();
    const location = (body?.location || '').trim();
  // No hard limit; we'll curate a reasonable set but not enforce per-job caps
  const limit = Number.isFinite(Number(body?.limit)) ? Math.max(1, Number(body.limit)) : undefined;
    if (!searchQuery) {
      return new Response(JSON.stringify({ error: 'searchQuery is required' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    // Pull allowed sources (domains) from settings; fallback to remotive.com
    const settingsRes = await supabaseAuthed
      .from('job_source_settings')
      .select('allowed_domains')
      .eq('id', userId)
      .maybeSingle();
    const allowedDomains: string[] = Array.isArray(settingsRes?.data?.allowed_domains) ? settingsRes.data.allowed_domains.filter(Boolean) : [];
    const domainList = allowedDomains.length > 0 ? allowedDomains : ['remotive.com'];

    // Compose the search query with domain filters
    const siteClause = domainList.map((d) => `site:${d}`).join(' OR ');
    const fullQuery = [searchQuery, location ? `"${location}"` : null, siteClause].filter(Boolean).join(' ');

    // Build Firecrawl search payload (with your requested defaults)
    const firecrawlApiKey = await resolveFirecrawlApiKey();
    const userScrapeOptions = typeof body?.scrapeOptions === 'object' && body.scrapeOptions ? body.scrapeOptions : {};
    const searchPayload = {
      query: fullQuery,
      limit: limit,
      sources: ['web'],
      categories: [],
      tbs: undefined,
      location: location || undefined,
      timeout: 60000,
      ignoreInvalidURLs: false,
      scrapeOptions: {
        formats: ['markdown'],
        onlyMainContent: true,
        includeTags: [],
        excludeTags: [],
        maxAge: 172800000,
        headers: {},
        waitFor: 0,
        mobile: false,
        skipTlsVerification: true,
        timeout: 123,
        parsers: ['pdf'],
        actions: [],
        location: { country: 'US', languages: ['en-US'] },
        removeBase64Images: true,
        blockAds: true,
        proxy: 'auto',
        storeInCache: true,
        ...userScrapeOptions,
      },
    } as any;

    let searchRes: any;
    try {
      searchRes = await withRetry(() => firecrawlFetch('/search', firecrawlApiKey, searchPayload, userId), 2, 600);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (e?.status === 429 || /Rate limit exceeded/i.test(msg)) {
        const retryAfterSeconds = typeof e?.retryAfterSeconds === 'number' ? e.retryAfterSeconds : 55;
        console.warn('firecrawl.search_rate_limited', { message: msg, retry_after_seconds: retryAfterSeconds });
        return new Response(JSON.stringify({ error: 'rate_limited', retryAfterSeconds }), {
          status: 429,
          headers: { ...corsHeaders, 'content-type': 'application/json' },
        });
      }
      console.error('firecrawl.search_failed', { error: msg });
      return new Response(JSON.stringify({ error: 'search_failed', detail: msg }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    // Extract URLs from response (be permissive with shape)
    const items = Array.isArray(searchRes?.data) ? searchRes.data : (Array.isArray(searchRes?.results) ? searchRes.results : []);
    let urls: string[] = items
      .map((it: any) => it?.url || it?.link || it?.href)
      .filter((u: any) => typeof u === 'string');

    // Filter to allowed domains (or remotive fallback)
    const domainSet = new Set(domainList);
    urls = urls.filter((u) => {
      const h = hostFromUrl(u);
      return h ? Array.from(domainSet).some((d) => h === d || h.endsWith(`.${d}`)) : false;
    });

    // Dedupe and cap
    const seen = new Set<string>();
    const curated: string[] = [];
    for (const u of urls) {
      const clean = String(u).replace(/\/$/, '');
      if (!seen.has(clean)) { seen.add(clean); curated.push(clean); }
      if (typeof limit === 'number' && curated.length >= limit) break;
    }
    if (curated.length === 0) {
      curated.push('https://remotive.com');
    }

    // Kick off extraction via our existing function to keep a single polling flow
    const supabaseFunctions = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: pmData, error: pmError } = await supabaseFunctions.functions.invoke('process-and-match', {
      body: { searchQuery, location, urls: curated, relaxSchema: Boolean(body?.relaxSchema) },
    });
    if (pmError) {
      console.error('jobs-search.process-and-match_failed', pmError?.message || pmError);
      return new Response(JSON.stringify({ error: 'process_and_match_failed', detail: pmError?.message }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }
    if (pmData?.error) {
      const status = pmData.error === 'rate_limited' ? 429 : (pmData.error === 'missing_api_key' ? 400 : 500);
      return new Response(JSON.stringify(pmData), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }
    if (pmData?.jobId) {
      console.info('jobs-search.started', { user_id: userId, jobId: pmData.jobId, urls: curated.length });
      return new Response(JSON.stringify({ success: true, jobId: pmData.jobId, urls: curated }), { status: 202, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    // Fallback unexpected
    return new Response(JSON.stringify({ error: 'unexpected_response' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'An unexpected error occurred.' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } });
  }
});
