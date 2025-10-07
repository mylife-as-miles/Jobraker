// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/types.ts';

// Use the admin client for elevated privileges to delete/insert into the jobs table.
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

async function firecrawlFetch(path: string, apiKey: string, body: any) {
  const url = `https://api.firecrawl.dev${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Firecrawl ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 500): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e) {
      lastErr = e;
      if (i < attempts - 1) {
        const delay = baseDelayMs * Math.pow(2, i);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

Deno.serve(async (req) => {
  // Immediately handle CORS preflight requests.
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
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

    // Step 2: Parse request parameters
    const body = await req.json().catch(() => ({}));
    const searchQuery = (body?.searchQuery || '').trim();
    const location = (body?.location || '').trim();
    const types = Array.isArray(body?.type) ? body.type : (typeof body?.type === 'string' ? [body.type] : []);

    if (!searchQuery) {
        return new Response(JSON.stringify({ error: 'Search query is required.' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlApiKey) {
        return new Response(JSON.stringify({ error: 'FIRECRAWL_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }


  let scrapedJobs: JobListing[] = [];
    if (jobUrls.length) {
      const jobSchema = {
        type: 'object',
        properties: {
          jobTitle: { type: 'string' },
          companyName: { type: 'string' },
          location: { type: 'string' },
          workType: { type: 'string', enum: ['On-site', 'Remote', 'Hybrid'] },
          experienceLevel: { type: 'string' },
          requiredSkills: { type: 'array', items: { type: 'string' } },
          requirements: { type: 'array', items: { type: 'string' } },
          benefits: { type: 'array', items: { type: 'string' } },
          fullJobDescription: { type: 'string' },
          // Additional fields to populate UI when available
          salaryRange: { type: 'string' },
          salaryPeriod: { type: 'string', enum: ['hour', 'day', 'week', 'month', 'year'] },
          salaryCurrency: { type: 'string' },
          employmentType: { type: 'string' },
          contractDuration: { type: 'string' },
          postedDate: { type: 'string' },
        },
        required: ['jobTitle', 'companyName', 'location', 'fullJobDescription'],
      } as const;
      // Schema for search/listing pages extracting multiple cards
      const listingSchema = {
        type: 'object',
        properties: {
          jobs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                jobTitle: { type: 'string' },
                companyName: { type: 'string' },
                location: { type: 'string' },
                workType: { type: 'string' },
                salaryRange: { type: 'string' },
                salaryPeriod: { type: 'string' },
                salaryCurrency: { type: 'string' },
                employmentType: { type: 'string' },
                contractDuration: { type: 'string' },
                postedDate: { type: 'string' },
                jobUrl: { type: 'string' },
              },
            },
          },
        },
      } as const;
      // Scrape sequentially to avoid provider rate limits
      const scrapeResults: any[] = [];
    for (const u of jobUrls) {
        try {
      const s = await withRetry(() => firecrawlFetch('/v1/scrape', apiKey, { url: u, pageOptions: { extractionSchema: jobSchema } }), 2, 500);
          // normalize to { success, data, url }
          if (s?.success && s?.data) scrapeResults.push({ success: true, data: s.data, url: u });
        } catch (_) {
          // skip failed url
        }
      }
      // Optionally parse search/list pages into multiple jobs
      if (includeSearchListings && searchUrls.length) {
        for (const u of searchUrls) {
          try {
            const s = await withRetry(() => firecrawlFetch('/v1/scrape', apiKey, { url: u, pageOptions: { extractionSchema: listingSchema } }), 2, 500);
            if (s?.success && s?.data && Array.isArray(s.data.jobs)) {
              for (const j of s.data.jobs) {
                if (j && (j.jobUrl || u)) {
                  scrapeResults.push({ success: true, data: { ...j, fullJobDescription: j.fullJobDescription || '', _fromListing: true }, url: j.jobUrl || u });
                }
              }
            }
          } catch (_) {}
        }
      }
      // Basic extractor to pull lists under common headings when schema misses them
      const extractLists = (htmlOrText: string) => {
        const clean = (htmlOrText || '').replace(/\r/g, '');
        const lower = clean.toLowerCase();
        const reqHeads = ['requirements', 'qualifications', "what you'll need", 'what you will need'];
        const benHeads = ['benefits', 'perks', 'what we offer', 'what you get', 'compensation & benefits'];
        const grabAfter = (heads: string[]) => {
          for (const h of heads) {
            const idx = lower.indexOf(h);
            if (idx !== -1) {
              const segment = clean.slice(idx, idx + 2000);
              // Try list items first
              const liMatches = Array.from(segment.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)).map(m => m[1].replace(/<[^>]+>/g, '').trim());
              if (liMatches.length) return liMatches.filter(Boolean).slice(0, 20);
              // Fallback to lines starting with -, *, •
              const lines = segment.split(/\n+/).map(s => s.trim());
              const bullets = lines.filter(s => /^[-*•]/.test(s)).map(s => s.replace(/^[-*•]\s*/, ''));
              if (bullets.length) return bullets.slice(0, 20);
            }
          }
          return [] as string[];
        };
        return { reqs: grabAfter(reqHeads), bens: grabAfter(benHeads) };
      };
=======
    // Step 3: Clear the user's existing job queue in the 'jobs' table.
    const { error: deleteError } = await supabaseAdmin.from('jobs').delete().eq('user_id', userId);
    if (deleteError) {
      console.error(`Failed to clear job queue for user ${userId}:`, deleteError.message);
      // Non-fatal, proceed with fetching new jobs.
    }


    // Step 4: Perform the deep research and scraping with Firecrawl.
    const locText = location ? ` in ${location}` : '';
    const typeText = types.length ? `\n• Prefer work type: ${types.join(', ')}` : '';
    const buildPrompt = (q: string) => `Find current job opportunities for: ${q}${locText}.${typeText}`;

    const firecrawlParams = { maxDepth: 3, timeLimit: 90, maxUrls: 20 };
    const { data: firecrawlData } = await withRetry(() => firecrawlFetch('/v1/deep-research', firecrawlApiKey, { query: buildPrompt(searchQuery), ...firecrawlParams }), 2, 600);

    const scrapedUrls = (firecrawlData?.sources || []).map((s: any) => s?.url).filter(Boolean);

    if (!scrapedUrls.length) {
      return new Response(JSON.stringify({ success: true, jobs_added: 0, message: "No new job sources found." }), { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    // Step 5: Scrape structured data from the found URLs.
    const jobSchema = {
      type: 'object',
      properties: {
        jobTitle: { type: 'string' },
        companyName: { type: 'string' },
        location: { type: 'string' },
        workType: { type: 'string', enum: ['On-site', 'Remote', 'Hybrid'] },
        fullJobDescription: { type: 'string' },
        postedDate: { type: 'string' },
      },
      required: ['jobTitle', 'companyName', 'location', 'fullJobDescription'],
    };

    const scrapePromises = scrapedUrls.map((url: string) =>
      withRetry(() => firecrawlFetch('/v1/scrape', firecrawlApiKey, { url, pageOptions: { extractionSchema: jobSchema } }), 2, 500)
        .then(res => ({ ...res, sourceUrl: url }))
        .catch(() => null)
    );
    const scrapeResults = (await Promise.all(scrapePromises)).filter(res => res?.success && res?.data);

    // Step 6: Map scraped data and insert into the user's personal 'jobs' table.
    if (scrapeResults.length > 0) {
      const jobsToInsert = scrapeResults.map(({ data, sourceUrl }) => ({
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
        raw_data: data,
      }));

      const { error: insertError } = await supabaseAdmin.from('jobs').insert(jobsToInsert);
      if (insertError) {
        throw new Error(`Failed to insert new jobs: ${insertError.message}`);
      }

      return new Response(JSON.stringify({ success: true, jobs_added: jobsToInsert.length }), {
        status: 200,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, jobs_added: 0, message: "Could not extract structured data from sources." }), { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' } });

  } catch (error) {
    console.error('process-and-match error:', error.message);
    return new Response(JSON.stringify({ error: error.message || 'An unexpected error occurred.' }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});