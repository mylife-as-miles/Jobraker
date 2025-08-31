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
  let typesFromBody: string[] | undefined;
  try {
    const body = await req.json();
    searchQuery = body?.searchQuery;
    location = body?.location;
    if (Array.isArray(body?.type)) typesFromBody = body.type as string[];
    else if (typeof body?.type === 'string') typesFromBody = String(body.type).split(',').map((s: string) => s.trim()).filter(Boolean);
  } catch (_) {
    // ignore; will handle as missing in logic
  }

  // Parse URL query params: ?q=...&location=...&type=Remote,Hybrid
  const url = new URL(req.url);
  const qpQ = url.searchParams.get('q') || url.searchParams.get('query');
  const qpLocation = url.searchParams.get('location');
  const qpTypes: string[] = [];
  const typeParams = url.searchParams.getAll('type');
  for (const t of typeParams) {
    for (const part of t.split(',')) {
      const v = part.trim();
      if (v) qpTypes.push(v);
    }
  }

  // Normalize effective inputs
  const effectiveQuery = (searchQuery ?? qpQ ?? '').trim();
  const effectiveLocation = (location ?? qpLocation ?? '').trim();
  const effectiveTypesRaw = (typesFromBody && typesFromBody.length ? typesFromBody : qpTypes);
  const normalizeType = (s: string) => {
    const v = s.toLowerCase();
    if (v === 'remote') return 'Remote';
    if (v === 'hybrid') return 'Hybrid';
    if (v === 'on-site' || v === 'onsite' || v === 'on_site' || v === 'on site') return 'On-site';
    return s; // leave as-is
  };
  const effectiveTypes = Array.from(new Set(effectiveTypesRaw.map(normalizeType)));

  try {
  // No heavy initialization required for OPTIONS/POST
  // Prefer API key passed from a trusted proxy (e.g., Vercel serverless) to avoid storing in Supabase
  const headerKey = req.headers.get('x-firecrawl-api-key') || req.headers.get('X-FIRECRAWL-API-KEY');
  const apiKey = headerKey || Deno.env.get('FIRECRAWL_API_KEY');
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY not provided');

    if (!effectiveQuery) throw new Error("Search query is required.");

    // --- Step 1: Use deepResearch (avoids LinkedIn restrictions) ---
    // Build a targeted prompt and parameters
  const locText = effectiveLocation ? ` in ${effectiveLocation}` : '';
  const typeText = effectiveTypes.length ? `\n• Prefer work type: ${effectiveTypes.join(', ')}` : '';
  const prompt = `Find current, individual job postings for: ${effectiveQuery}${locText}.
Strict rules:
• Return only direct job posting pages (no search result pages).
• Exclude linkedin.com entirely and salary/average/calculator pages.
• Prefer company career pages or reputable boards.${typeText}
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
          requirements: { type: 'array', items: { type: 'string' } },
          benefits: { type: 'array', items: { type: 'string' } },
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

      scrapedJobs = scrapeResults
        .filter((res: any) => res?.success && res?.data)
        .map((res: any) => {
          const data = res.data;
          const { reqs, bens } = extractLists(String(data.fullJobDescription || ''));
          return {
            ...data,
            requirements: Array.isArray(data.requirements) && data.requirements.length ? data.requirements : (Array.isArray(data.requiredSkills) ? data.requiredSkills : reqs),
            benefits: Array.isArray(data.benefits) && data.benefits.length ? data.benefits : bens,
            sourceUrl: res.url,
          } as JobListing;
        });

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
      requirements: (job as any).requirements ?? (Array.isArray(job.requiredSkills) ? job.requiredSkills : []),
      benefits: (job as any).benefits ?? [],
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
    // Log detailed provider error to Supabase Logs only
    try {
      const msg = (error && (error as any).message) ? String((error as any).message) : 'Unknown error';
      console.error('process-and-match firecrawl_error', msg);
    } catch {}

    // Fallback: query local job_listings to return something useful
    try {
      const q = effectiveQuery;
      const loc = effectiveLocation;
      const normalizeType = (s: string) => {
        const v = s.toLowerCase();
        if (v === 'remote') return 'Remote';
        if (v === 'hybrid') return 'Hybrid';
        if (v === 'on-site' || v === 'onsite' || v === 'on_site' || v === 'on site') return 'On-site';
        return s;
      };
      const typesNorm = Array.from(new Set(effectiveTypes.map(normalizeType)));

      let query = supabaseAdmin
        .from('job_listings')
  .select('job_title, company_name, location, work_type, full_job_description, source_url, posted_at, requirements, benefits')
        .order('posted_at', { ascending: false, nullsFirst: false })
        .limit(50);

      if (q) {
        // Match on Job Title OR Full Description
        query = query.or(`job_title.ilike.%${q}%,full_job_description.ilike.%${q}%`);
      }
      if (loc) {
        const locLower = loc.toLowerCase();
        if (['remote', 'hybrid', 'on-site', 'onsite', 'on_site', 'on site'].includes(locLower)) {
          const m = normalizeType(loc);
          query = query.or(`work_type.eq.${m},location.ilike.%${loc}%`);
        } else {
          query = query.ilike('location', `%${loc}%`);
        }
      }
      if (typesNorm.length === 1) {
        query = query.eq('work_type', typesNorm[0]);
      } else if (typesNorm.length > 1) {
        query = (query as any).in('work_type', typesNorm);
      }

      const { data } = await query;
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
              const liMatches = Array.from(segment.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)).map(m => m[1].replace(/<[^>]+>/g, '').trim());
              if (liMatches.length) return liMatches.filter(Boolean).slice(0, 20);
              const lines = segment.split(/\n+/).map(s => s.trim());
              const bullets = lines.filter(s => /^[-*•]/.test(s)).map(s => s.replace(/^[-*•]\s*/, ''));
              if (bullets.length) return bullets.slice(0, 20);
            }
          }
          return [] as string[];
        };
        return { reqs: grabAfter(reqHeads), bens: grabAfter(benHeads) };
      };
    const fallbackJobs = (data || []).map((r: any) => {
        const { reqs, bens } = extractLists(String(r.full_job_description || ''));
        return {
          jobTitle: r.job_title,
          companyName: r.company_name,
          location: r.location,
          workType: r.work_type,
          fullJobDescription: r.full_job_description,
          sourceUrl: r.source_url,
      requirements: Array.isArray(r.requirements) && r.requirements.length ? r.requirements : reqs,
      benefits: Array.isArray(r.benefits) && r.benefits.length ? r.benefits : bens,
        } as JobListing;
      });
      return new Response(JSON.stringify({ matchedJobs: fallbackJobs, note: 'fallback: provider_unavailable' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } catch (e2) {
      return new Response(JSON.stringify({ matchedJobs: [], note: 'fallback: provider_unavailable' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }
  }
});
