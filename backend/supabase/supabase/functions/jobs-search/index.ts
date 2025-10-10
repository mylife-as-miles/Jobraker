// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/types.ts';
import { withRetry, resolveFirecrawlApiKey, firecrawlFetch } from '../_shared/firecrawl.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

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
    // Enforce last 30 days window for search time-bounds
    const tbs = 'qdr:m';
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

    // Pull allowed sources (domains); fallback to popular job boards
    const settingsRes = await supabaseAuthed
      .from('job_source_settings')
      .select('allowed_domains')
      .eq('id', userId)
      .maybeSingle();
    const allowedDomains: string[] = Array.isArray(settingsRes?.data?.allowed_domains) ? settingsRes.data.allowed_domains.filter(Boolean) : [];
    const domainList = allowedDomains.length > 0 ? allowedDomains : [
      'indeed.com',
      'linkedin.com',
      'glassdoor.com',
      'angel.co',
      'wellfound.com',           // Formerly angel.co, startup and tech jobs
      'weworkremotely.com',       // Remote-specific positions
      'remote.co',                // Curated remote jobs
      'remotive.com',             // Remote tech and non-tech jobs
      'remoteok.com',             // Remote jobs aggregator
      'jobicy.com',               // Remote jobs in various fields
      'levels.fyi',               // Tech jobs with salary data
      'flexjobs.com',             // Flexible and remote work
      'upwork.com',               // Freelance opportunities
      'freelancer.com',           // Freelance projects
      'dice.com',                 // Tech jobs and IT positions
    ];

    console.log('jobs-search.domains', { allowed_domains: domainList, user_id: userId });

    // Compose optimized query using Firecrawl operators
    const siteClause = domainList.map((d) => `site:${d}`).join(' OR ');
    
    // Use inurl: to find actual job posting pages (not search result pages)
    const jobPagePatterns = '(inurl:job OR inurl:view OR inurl:posting OR inurl:opening OR inurl:career OR inurl:apply OR inurl:detail)';
    
    // Exclude common search/listing pages using negative operator
    const exclusions = '-inurl:search -inurl:/q- -inurl:company-reviews -inurl:salaries';
    
    // Use intitle: to prioritize pages with job titles
    const titleHints = 'intitle:job OR intitle:hiring OR intitle:career OR intitle:opening';
    
    // Combine all parts: query + location (exact match) + sites + URL patterns + exclusions + title hints
    const fullQuery = [
      rawQuery,
      location ? `"${location}"` : null,
      `(${siteClause})`,
      jobPagePatterns,
      exclusions,
      `(${titleHints})`
    ].filter(Boolean).join(' ');

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
    
    // Helper to check if URL looks like an individual job posting
    const isJobPostingUrl = (url: string): boolean => {
      const lower = url.toLowerCase();
      // Indeed job view pages
      if (lower.includes('indeed.com') && (lower.includes('/viewjob') || lower.includes('/rc/clk'))) return true;
      // LinkedIn job view pages
      if (lower.includes('linkedin.com') && lower.includes('/jobs/view/')) return true;
      // WeWorkRemotely individual jobs
      if (lower.includes('weworkremotely.com') && lower.includes('/remote-jobs/') && !lower.endsWith('/remote-jobs')) return true;
      // Remote.co individual jobs
      if (lower.includes('remote.co') && (lower.includes('/job/') || lower.includes('/remote-jobs/')) && lower.split('/').length > 5) return true;
      // Remotive individual jobs  
      if (lower.includes('remotive.com') && lower.includes('/remote-jobs/')) return true;
      // RemoteOK individual jobs
      if (lower.includes('remoteok.com') && lower.includes('/remote-jobs/')) return true;
      // Jobicy individual jobs
      if (lower.includes('jobicy.com') && lower.includes('/job/')) return true;
      // Levels.fyi job postings
      if (lower.includes('levels.fyi') && lower.includes('/jobs/')) return true;
      // Glassdoor job view
      if (lower.includes('glassdoor.com') && (lower.includes('/job-listing/') || lower.includes('/partner/jobListing'))) return true;
      // AngelList/Wellfound jobs
      if ((lower.includes('angel.co') || lower.includes('wellfound.com')) && (lower.includes('/l/') || lower.includes('/jobs/'))) return true;
      // FlexJobs individual postings
      if (lower.includes('flexjobs.com') && lower.includes('/jobs/')) return true;
      // Upwork job postings
      if (lower.includes('upwork.com') && lower.includes('/jobs/')) return true;
      // Freelancer job postings
      if (lower.includes('freelancer.com') && (lower.includes('/projects/') || lower.includes('/jobs/'))) return true;
      // Dice tech jobs
      if (lower.includes('dice.com') && (lower.includes('/jobs/detail/') || lower.includes('/job-detail/'))) return true;
      // Generic patterns
      if (lower.match(/\/(job|posting|opening|career|apply|position)s?\/[^\/]+\/?$/)) return true;
      return false;
    };
    
    for (const item of webItems) {
      const url: string | undefined = item?.url || item?.metadata?.sourceURL;
      if (typeof url !== 'string') continue;
      const clean = url.replace(/\/$/, '');
      const h = hostFromUrl(clean);
      if (!h) continue;
      const allowed = Array.from(domainSet).some((d) => h === d || h.endsWith(`.${d}`));
      if (!allowed) continue;
      if (seen.has(clean)) continue;
      
      // Skip obvious search result pages
      if (clean.toLowerCase().includes('/search') || 
          clean.toLowerCase().includes('/q-') ||
          clean.toLowerCase().match(/jobs\.html?$/)) {
        console.log('jobs-search.skipping_search_page', { url: clean });
        continue;
      }
      
      seen.add(clean);
      
      // Extract company name from URL or title
      const extractCompanyFromUrl = (url: string): string => {
        try {
          const hostname = new URL(url).hostname.replace('www.', '');
          const parts = hostname.split('.');
          return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        } catch {
          return 'Unknown Company';
        }
      };
      
      filtered.push({
        url: clean,
        title: typeof item?.title === 'string' ? item.title : undefined,
        description: typeof item?.description === 'string' ? item.description : undefined,
        category: typeof item?.category === 'string' ? item.category : undefined,
        isJobPosting: isJobPostingUrl(clean),
        company: extractCompanyFromUrl(clean),
      });
      if (typeof limit === 'number' && filtered.length >= limit) break;
    }
    
    // Sort to prioritize actual job posting URLs
    filtered.sort((a, b) => {
      if (a.isJobPosting && !b.isJobPosting) return -1;
      if (!a.isJobPosting && b.isJobPosting) return 1;
      return 0;
    });

    // Save jobs directly to database
    console.log('jobs-search.saving_to_database', { count: filtered.length, user_id: userId });
    
    const jobsToInsert = filtered.map((item) => ({
      user_id: userId,
      source_type: 'web_search',
      source_id: item.url,
      title: item.title || rawQuery,
      company: item.company,
      description: item.description || null,
      location: loc || 'Remote',
      remote_type: 'Remote',
      apply_url: item.url,
      posted_at: new Date().toISOString(),
      status: 'active',
      raw_data: {
        search_query: rawQuery,
        search_location: loc,
        category: item.category,
        isJobPosting: item.isJobPosting,
        source: 'firecrawl_search',
      },
    }));

    const { data: insertedJobs, error: insertError } = await supabaseAdmin
      .from('jobs')
      .upsert(jobsToInsert, { 
        onConflict: 'user_id,source_id',
        ignoreDuplicates: false 
      })
      .select('id');

    if (insertError) {
      console.error('jobs-search.insert_error', { error: insertError.message, user_id: userId });
      throw new Error(`Failed to insert jobs: ${insertError.message}`);
    }

    const insertedCount = Array.isArray(insertedJobs) ? insertedJobs.length : 0;
    console.log('jobs-search.inserted', { count: insertedCount, user_id: userId });

    // Return success response with count
    return new Response(
      JSON.stringify({ 
        success: true, 
        jobsInserted: insertedCount,
        totalFound: filtered.length 
      }),
      { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' } },
    );

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'An unexpected error occurred.' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } });
  }
});
