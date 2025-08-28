// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';
import FirecrawlApp from 'npm:@mendable/firecrawl-js@0.0.28';
import { corsHeaders, CandidateProfile, JobListing } from '../_shared/types.ts';
import { pipeline } from 'npm:@xenova/transformers';

// Initialize clients and models (model is heavy, keep at module scope)
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') || 'https://yquhsllwrwfvrwolqywh.supabase.co',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')!
);
// The model will be downloaded on the first run
const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
  // Prefer API key passed from a trusted proxy (e.g., Vercel serverless) to avoid storing in Supabase
  const headerKey = req.headers.get('x-firecrawl-api-key') || req.headers.get('X-FIRECRAWL-API-KEY');
  const apiKey = headerKey || Deno.env.get('FIRECRAWL_API_KEY');
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY not provided');
  const firecrawl = new FirecrawlApp({ apiKey });

    const { searchQuery, location } = await req.json();
    if (!searchQuery) throw new Error("Search query is required.");

    // --- Step 1: Crawl and Scrape for New Jobs ---
    const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(searchQuery)}&location=${encodeURIComponent(location || 'Remote')}`;

    const crawlResult = await firecrawl.crawl({ url: searchUrl, crawlerOptions: { limit: 15, includes: ['/jobs/view/'] } });
    const jobUrls = crawlResult.map(item => item.url).filter(Boolean);

    let scrapedJobs: JobListing[] = [];

    if (jobUrls.length > 0) {
        const jobSchema = {
          "type": "object",
          "properties": {
            "jobTitle": { "type": "string" },
            "companyName": { "type": "string" },
            "location": { "type": "string" },
            "workType": { "type": "string", "enum": ["On-site", "Remote", "Hybrid"] },
            "experienceLevel": { "type": "string" },
            "requiredSkills": { "type": "array", "items": { "type": "string" } },
            "fullJobDescription": { "type": "string" }
          },
          "required": ["jobTitle", "companyName", "location", "fullJobDescription"]
        };
        const scrapeResults = await firecrawl.scrape(jobUrls, { pageOptions: { extractionSchema: jobSchema } });

        scrapedJobs = scrapeResults
            .filter(res => res.success && res.data)
            .map(res => ({ ...res.data, sourceUrl: res.url })) as JobListing[];

        // We can still embed and save these jobs for future use, but we won't use them for matching in this request.
        for (const job of scrapedJobs) {
            const output = await extractor(job.fullJobDescription, { pooling: 'mean', normalize: true });
            await supabaseAdmin.from('job_listings').upsert({
                job_title: job.jobTitle,
                company_name: job.companyName,
                location: job.location,
                work_type: job.workType,
                experience_level: job.experienceLevel,
                required_skills: job.requiredSkills,
                full_job_description: job.fullJobDescription,
                description_embedding: Array.from(output.data),
                source_url: job.sourceUrl,
            }, { onConflict: 'source_url' });
        }
    }

    // --- Step 2: Return the results ---
    // The new implementation directly returns the scraped jobs.
    // The `matchedJobs` key is kept for consistency with the old API, but it's not from a matching algorithm anymore.
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
