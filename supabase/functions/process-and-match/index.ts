// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, JobListing } from '../_shared/types.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const parseSalaryRangeToMinMax = (input?: string): { min: number | null; max: number | null } => {
    if (!input) return { min: null, max: null };
    const cleaned = String(input).replace(/[,\s]/g, '').toLowerCase();
    const kRe = /(?:(\$|€|£)?)(\d{2,3})k(?:[-–to]+(?:(\$|€|£)?)(\d{2,3})k)?/i;
    const mK = cleaned.match(kRe);
    if (mK) {
        const a = parseInt(mK[2], 10) * 1000;
        const b = mK[4] ? parseInt(mK[4], 10) * 1000 : NaN;
        return { min: Number.isFinite(a) ? a : null, max: Number.isFinite(b) ? b : null };
    }
    const m = cleaned.match(/(\$|€|£)?(\d{2,7})(?:[-–to]+(\$|€|£)?(\d{2,7}))?/i);
    if (!m) return { min: null, max: null };
    const min = parseInt(m[2], 10);
    const max = m[4] ? parseInt(m[4], 10) : NaN;
    return { min: Number.isFinite(min) ? min : null, max: Number.isFinite(max) ? max : null };
};

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user } } = await createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
    }).auth.getUser(jwt);

    if (!user) throw new Error('User not found');
    const uid = user.id;

    const { searchQuery, location } = await req.json();

    // Clear existing jobs for the user
    await supabaseAdmin.from('jobs').delete().eq('user_id', uid);

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) throw new Error('FIRECRAWL_API_KEY not provided');

    const prompt = `Find current job opportunities for: ${searchQuery}${location ? ` in ${location}` : ''}. Return only direct job posting pages.`;
    const params = { maxDepth: 2, maxUrls: 30 };
    const researchData = await firecrawlFetch('/v1/deep-research', apiKey, { query: prompt, ...params });
    const urls = (researchData?.data?.sources || []).map((s: any) => s?.url).filter(Boolean);

    const jobSchema = {
      type: 'object',
      properties: {
        jobTitle: { type: 'string' },
        companyName: { type: 'string' },
        location: { type: 'string' },
        workType: { type: 'string', enum: ['On-site', 'Remote', 'Hybrid'] },
        fullJobDescription: { type: 'string' },
        requirements: { type: 'array', items: { type: 'string' } },
        benefits: { type: 'array', items: { type: 'string' } },
        salaryRange: { type: 'string' },
        postedDate: { type: 'string' },
      },
      required: ['jobTitle', 'companyName', 'location', 'fullJobDescription'],
    };

    const scrapePromises = urls.map((url: string) =>
      firecrawlFetch('/v1/scrape', apiKey, { url, pageOptions: { extractionSchema: jobSchema } })
    );

    const scrapeResults = await Promise.allSettled(scrapePromises);
    const scrapedJobs: JobListing[] = scrapeResults
      .filter(res => res.status === 'fulfilled' && res.value?.success && res.value?.data)
      .map((res: any) => ({ ...res.value.data, sourceUrl: res.value.url }));

    if (scrapedJobs.length > 0) {
      const jobsToInsert = scrapedJobs.map(job => {
        const { min: salary_min, max: salary_max } = parseSalaryRangeToMinMax(job.salaryRange);
        return {
          user_id: uid,
          source_type: 'deepresearch',
          source_id: job.sourceUrl,
          title: job.jobTitle,
          company: job.companyName,
          description: job.fullJobDescription,
          location: job.location,
          remote_type: job.workType?.toLowerCase(),
          apply_url: job.sourceUrl,
          posted_at: job.postedDate ? new Date(job.postedDate).toISOString() : new Date().toISOString(),
          status: 'active',
          raw_data: job,
          requirements: job.requirements,
          benefits: job.benefits,
          salary_min,
          salary_max,
        };
      });

      await supabaseAdmin.from('jobs').upsert(jobsToInsert, { onConflict: 'user_id,source_id' });
    }

    return new Response(JSON.stringify({ matchedJobs: scrapedJobs }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});