// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/types.ts';
import { withRetry, resolveFirecrawlApiKey, firecrawlFetch } from '../_shared/firecrawl.ts';
import { generateGeminiDescription } from '../_shared/gemini.ts';

function hostFromUrl(u: string): string | null {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return null; }
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

Deno.serve(async (req) => {
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

    const body = await req.json().catch(() => ({}));
    const rawQuery = (body?.searchQuery || body?.query || '').trim();
    const location = (body?.location || '').trim();
    const limit = Number.isFinite(Number(body?.limit)) ? Math.max(1, Math.min(20, Number(body.limit))) : 10; // Reduced limit for realtime speed
    const tbs = 'qdr:m';

    if (!rawQuery) {
      return new Response(JSON.stringify({ error: 'searchQuery is required' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const supabaseAuthed = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await supabaseAuthed.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), { status: 401, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }
    const userId = user.id;

    console.log(`[jobs-search] Processing for user ${userId}: ${rawQuery} in ${location || 'Remote'}`);

    // --- Search Logic (Ported from process-job-search) ---

    // 1. Domain allowlist logic
    const defaultDomains = [
      'remote.co', 'remotive.com', 'remoteok.com', 'jobicy.com', 
      'levels.fyi', 'greenhouse.io', 'lever.co', 'wellfound.com',
      'builtin.com', 'workingnomads.com', 'weuowkremotely.com',
      'flexjobs.com', 'cryptojobslist.com'
    ];
    const blocked = new Set(['techsolutions.com']);
    let domainList: string[] = defaultDomains;

    // (Simplified settings fetch for speed - can add back full DB fetch if needed, but defaults are usually fine for Agent)
    
    // 2. Compose Query
    domainList = domainList.map((d) => String(d).toLowerCase().replace(/^www\./, ''));
    const siteClause = domainList.map((d) => `site:${d}`).join(' OR ');
    
    const fullQuery = [
      rawQuery,
      location ? `"${location}"` : null,
      `(${siteClause})`,
      '(job OR career OR opening)',
      '-inurl:search -inurl:login'
    ].filter(Boolean).join(' ');

    const firecrawlApiKey = await resolveFirecrawlApiKey();
    
    const performSearch = async (query: string, timeFilter?: string) => {
      const payload: any = {
        query: query,
        limit: limit,
        sources: ['web'],
        scrapeOptions: { formats: ["markdown", "json"] }
      };
      if (timeFilter) payload.tbs = timeFilter;
      
      console.log(`[jobs-search] Calling Firecrawl with query: ${query}...`);
      return await withRetry(() => firecrawlFetch('/search', firecrawlApiKey, payload, userId), 1, 1000);
    };

    let searchRes: any;
    try {
      // Primary search: Restricted domains, past month
      searchRes = await performSearch(fullQuery, tbs);
      
      // Fallback 1: Restricted domains, past 6 months
      if (!searchRes?.data?.web?.length) {
        console.log('[jobs-search] No results in past month, trying past 6 months...');
        searchRes = await performSearch(fullQuery, 'qdr:m6');
      }

      // Fallback 2: General web search for remote jobs, past month
      if (!searchRes?.data?.web?.length) {
        console.log('[jobs-search] Still no results, trying general web search...');
        const generalQuery = `${rawQuery} ${location || 'Remote'} jobs (hiring OR careers) -inurl:search`;
        searchRes = await performSearch(generalQuery, tbs);
      }
    } catch (e: any) {
      console.error('[jobs-search] Firecrawl failed', e);
      return new Response(JSON.stringify({ success: true, jobs: [], message: "Search provider unavailable." }), { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    const webItems: any[] = Array.isArray(searchRes?.data?.web) ? searchRes.data.web : [];
    
    // 3. Process Items
    const processedJobs = webItems.map(item => {
        const url = item.url || item.metadata?.sourceURL;
        if (!url) return null;
        
        let company = 'Unknown';
        if (item.metadata?.title) {
          // Try to extract company from title like "Job | Company" or "Job at Company"
          const title = item.metadata.title;
          const parts = title.split(/[|:-]| at /i);
          if (parts.length > 1) {
            company = parts[parts.length - 1].trim();
          } else {
            company = title.split(' - ')[0].trim(); // Try another common separator
          }
        }
        
        return {
            title: item.title || rawQuery,
            company: company,
            location: location || 'Remote',
            url: url,
            description: item.markdown || item.description || '',
            posted_at: new Date().toISOString()
        };
    }).filter(Boolean);

    // 4. Save to DB (Async/Background if possible, or await)
    // We will await to ensure consistency for now, but catch errors
    if (processedJobs.length > 0) {
        const dbJobs = processedJobs.map(job => ({
            user_id: userId,
            source_type: 'web_search',
            source_id: job.url,
            title: job.title,
            company: job.company,
            location: job.location,
            apply_url: job.url,
            status: 'active',
            description: job.description
        }));

        const { error: insertError } = await supabaseAdmin
            .from('jobs')
            .upsert(dbJobs, { onConflict: 'user_id,source_id', ignoreDuplicates: true });
            
        if (insertError) console.error('DB Insert Error', insertError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        jobs: processedJobs, // Return actual jobs to Agent!
        count: processedJobs.length,
        status: 'completed'
      }),
      { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' } },
    );

  } catch (e: any) {
    console.error('jobs-search.error', e);
    return new Response(JSON.stringify({ error: e?.message || 'An unexpected error occurred.' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } });
  }
});
