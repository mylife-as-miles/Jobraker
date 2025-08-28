// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, CandidateProfile, JobListing } from '../_shared/types.ts';

// Initialize clients (model is heavy; we will lazy-init it below after OPTIONS handling)
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') || 'https://yquhsllwrwfvrwolqywh.supabase.co',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')!
);
let extractor: any | null = null;

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
  // Ensure heavy modules are initialized only for non-OPTIONS requests
  if (!extractor) {
    const { pipeline } = await import('npm:@xenova/transformers');
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  // Prefer API key passed from a trusted proxy (e.g., Vercel serverless) to avoid storing in Supabase
  const headerKey = req.headers.get('x-firecrawl-api-key') || req.headers.get('X-FIRECRAWL-API-KEY');
  const apiKey = headerKey || Deno.env.get('FIRECRAWL_API_KEY');
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY not provided');

    const { searchQuery, location } = await req.json();
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
    const dr = await firecrawlFetch('/v1/deep-research', apiKey, { query: prompt, ...params });
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
          const s = await firecrawlFetch('/v1/scrape', apiKey, { url: u, pageOptions: { extractionSchema: jobSchema } });
          // normalize to { success, data, url }
          if (s?.success && s?.data) scrapeResults.push({ success: true, data: s.data, url: u });
        } catch (_) {
          // skip failed url
        }
      }
      scrapedJobs = scrapeResults
        .filter((res: any) => res?.success && res?.data)
        .map((res: any) => ({ ...res.data, sourceUrl: res.url })) as JobListing[];

      // Embed and upsert for future queries
      for (const job of scrapedJobs) {
        try {
          const output = await extractor(job.fullJobDescription, { pooling: 'mean', normalize: true });
          await supabaseAdmin.from('job_listings').upsert(
            {
              job_title: job.jobTitle,
              company_name: job.companyName,
              location: job.location,
              work_type: job.workType,
              experience_level: job.experienceLevel,
              required_skills: job.requiredSkills,
              full_job_description: job.fullJobDescription,
              description_embedding: Array.from(output.data),
              source_url: job.sourceUrl,
            },
            { onConflict: 'source_url' }
          );
        } catch (_) {
          // Continue on best-effort basis
        }
      }
    }

    // --- Step 2: Return the results ---
    return new Response(JSON.stringify({ matchedJobs: scrapedJobs }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
