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

    // Parse body early for query params
    const body = await req.json().catch(() => ({}));
    const rawQuery = (body?.searchQuery || body?.query || '').trim();
    const location = (body?.location || '').trim();
  // Enforce last 7 days window for search time-bounds
  const tbs = 'qdr:w';
    const categories = Array.isArray(body?.categories) ? body.categories : undefined;
    // Default limit to 50 (clamped 1..100) if not provided
    const limit = Number.isFinite(Number(body?.limit))
      ? Math.max(1, Math.min(100, Number(body.limit)))
      : 50;
    const relaxSchema = Boolean(body?.relaxSchema);
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

    // Pull allowed sources (domains); fallback to remotive.com
    const settingsRes = await supabaseAuthed
      .from('job_source_settings')
      .select('allowed_domains')
      .eq('id', userId)
      .maybeSingle();
    const allowedDomains: string[] = Array.isArray(settingsRes?.data?.allowed_domains) ? settingsRes.data.allowed_domains.filter(Boolean) : [];
    const domainList = allowedDomains.length > 0 ? allowedDomains : ['remotive.com'];

    // Compose query with site filters
    const siteClause = domainList.map((d) => `site:${d}`).join(' OR ');
    const fullQuery = [rawQuery, location ? `"${location}"` : null, siteClause].filter(Boolean).join(' ');

    // Firecrawl search payload per API spec
    const firecrawlApiKey = await resolveFirecrawlApiKey();
    const searchPayload: any = {
      query: fullQuery,
      limit,
      sources: ['web'],
      tbs,
      ...(location ? { location } : {}),
    };

    console.log('jobs-search.firecrawl_payload', { payload: searchPayload, user_id: userId });

    // Perform search
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

    console.log('jobs-search.firecrawl_response', { status: searchRes?.success, web_count: searchRes?.data?.web?.length || 0 });

    // Extract items from data.web per OpenAPI, filter by allowed domains, dedupe, and cap
    const webItems: any[] = Array.isArray(searchRes?.data?.web) ? searchRes.data.web : [];
    const domainSet = new Set(domainList);
    const filtered: any[] = [];
    const seen = new Set<string>();
    for (const item of webItems) {
      const url: string | undefined = item?.url || item?.metadata?.sourceURL;
      if (typeof url !== 'string') continue;
      const clean = url.replace(/\/$/, '');
      const h = hostFromUrl(clean);
      if (!h) continue;
      const allowed = Array.from(domainSet).some((d) => h === d || h.endsWith(`.${d}`));
      if (!allowed) continue;
      if (seen.has(clean)) continue;
      seen.add(clean);
      filtered.push({
        url: clean,
        title: typeof item?.title === 'string' ? item.title : undefined,
        description: typeof item?.description === 'string' ? item.description : undefined,
        category: typeof item?.category === 'string' ? item.category : undefined,
      });
      if (typeof limit === 'number' && filtered.length >= limit) break;
    }

    // Return OpenAPI-aligned response shape
    return new Response(
      JSON.stringify({ success: true, data: { web: filtered } }),
      { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' } },
    );

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'An unexpected error occurred.' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } });
  }
});
