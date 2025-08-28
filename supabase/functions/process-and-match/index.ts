// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, CandidateProfile, JobListing } from '../_shared/types.ts';

// Initialize clients (model is heavy; we will lazy-init it below after OPTIONS handling)
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') || 'https://yquhsllwrwfvrwolqywh.supabase.co',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')!
);
// No heavy ML in this edge function to avoid cold-start and memory errors

async function firecrawlFetch(path: string, apiKey: string, body: any) {
  const url = `https://api.firecrawl.dev${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
    },
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Parse request early to allow fallback usage
  let searchQuery: string | undefined;
  let location: string | undefined;
  try {
    const body = await req.json();
    searchQuery = body?.searchQuery;
    location = body?.location;
  } catch (_) {
    // ignore; will handle as missing in logic
  }

  try {
  // No heavy initialization required for OPTIONS/POST
  // Prefer API key passed from a trusted proxy (e.g., Vercel serverless) to avoid storing in Supabase
  const headerKey = req.headers.get('x-firecrawl-api-key') || req.headers.get('X-FIRECRAWL-API-KEY');
  const apiKey = headerKey || Deno.env.get('FIRECRAWL_API_KEY');
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY not provided');

    if (!searchQuery) throw new Error("Search query is required.");

    // --- Step 1: Use deepResearch (avoids LinkedIn restrictions) ---
    // Build a targeted prompt and parameters
    const locText = location ? ` in ${location}` : '';
    const prompt = `Find current, individual job postings for: ${searchQuery}${locText}.
Strict rules:
• Return only direct job posting pages (no search result pages).
• Exclude linkedin.com entirely and salary/average/calculator pages.
• Prefer company career pages or reputable boards.
`;
    const params: any = { maxDepth: 3, timeLimit: 90, maxUrls: 12 };
  const dr = await withRetry(() => firecrawlFetch('/v1/deep-research', apiKey, { query: prompt, ...params }), 3, 600);
    const sources = Array.isArray(dr?.data?.sources) ? dr.data.sources : [];

    // Filter plausible job listing URLs
    const isJobListingUrl = (url: string) => {
      if (!url) return false;
      const deny = [/linkedin\.com/i, /salary/i, /average/i, /calculator/i, /statistics/i, /glassdoor\.com\/Salaries/i, /payscale\.com/i, /\?q=/i, /search\?/i];
      if (deny.some((r) => r.test(url))) return false;
      const allow = [/\/job\//i, /\/jobs\//i, /\/careers?\//i, /\/jobdetail/i, /\/job-posting/i, /\/viewjob/i, /workatastartup\.com\/(jobs|companies)/i, /amazon\.jobs/i, /careers\./i];
      return allow.some((r) => r.test(url));
    };
    const jobUrls: string[] = sources.map((s: any) => s?.url).filter((u: any) => typeof u === 'string' && isJobListingUrl(u));

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
          fullJobDescription: { type: 'string' },
        },
        required: ['jobTitle', 'companyName', 'location', 'fullJobDescription'],
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
      scrapedJobs = scrapeResults
        .filter((res: any) => res?.success && res?.data)
        .map((res: any) => ({ ...res.data, sourceUrl: res.url })) as JobListing[];

      // Upsert minimal fields compatible with job_listings schema
      for (const job of scrapedJobs) {
        try {
          await supabaseAdmin.from('job_listings').upsert(
            {
              job_title: job.jobTitle,
              company_name: job.companyName,
              location: job.location,
              work_type: job.workType,
              full_job_description: job.fullJobDescription || '',
              source_url: job.sourceUrl,
              posted_at: new Date().toISOString(),
            },
            { onConflict: 'source_url' }
          );
        } catch (_) {
          // best-effort; skip failed upserts
        }
      }
    }

    // --- Step 2: Return the results ---
    return new Response(JSON.stringify({ matchedJobs: scrapedJobs }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    // Fallback: query local job_listings to return something useful
    try {
      const q = (searchQuery || '').trim();
      const loc = (location || '').trim();
      let query = supabaseAdmin
        .from('job_listings')
        .select('job_title, company_name, location, work_type, full_job_description, source_url, posted_at')
        .order('posted_at', { ascending: false, nullsFirst: false })
        .limit(15);
      if (q) {
        // Match on title or description
        query = query.ilike('job_title', `%${q}%`);
      }
      if (loc) {
        query = query.ilike('location', `%${loc}%`);
      }
      const { data } = await query;
      const fallbackJobs = (data || []).map((r: any) => ({
        jobTitle: r.job_title,
        companyName: r.company_name,
        location: r.location,
        workType: r.work_type,
        fullJobDescription: r.full_job_description,
        sourceUrl: r.source_url,
      }));
      const msg = (error && (error as any).message) ? String((error as any).message) : 'Unknown error';
      return new Response(JSON.stringify({ matchedJobs: fallbackJobs, note: `fallback: ${msg}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } catch (e2) {
      const msg = (error && (error as any).message) ? String((error as any).message) : 'Unknown error';
      return new Response(JSON.stringify({ matchedJobs: [], note: msg }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }
  }
});
