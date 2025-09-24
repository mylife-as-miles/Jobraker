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
  const qpIncludeLinkedIn = url.searchParams.get('includeLinkedIn');
  const qpIncludeSearch = url.searchParams.get('includeSearch');

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
  // Feature flags (can be sent in body or query): includeLinkedIn, includeSearch
  let includeLinkedIn = true; // default allow LinkedIn
  let includeSearchListings = true; // default allow search/listing pages
  let includeIndeed = true;
  let allowedDomains: string[] | null = null;
  let enabledSources: string[] | null = null; // deepresearch is the source here; others apply to cron and DB fallback
  let parsedBody: any = undefined;
  try {
    const body = await req.json();
    parsedBody = body;
    includeLinkedIn = Boolean(body?.includeLinkedIn ?? includeLinkedIn);
    includeSearchListings = Boolean(body?.includeSearch ?? includeSearchListings);
    includeIndeed = Boolean(body?.includeIndeed ?? includeIndeed);
  } catch (_) {}
  if (qpIncludeLinkedIn != null) includeLinkedIn = ['1','true','yes','on'].includes(qpIncludeLinkedIn.toLowerCase());
  if (qpIncludeSearch != null) includeSearchListings = ['1','true','yes','on'].includes(qpIncludeSearch.toLowerCase());

  // If caller didn't send explicit flags, try loading per-user defaults from job_source_settings
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if ((!parsedBody || (parsedBody.includeLinkedIn == null && parsedBody.includeSearch == null && parsedBody.includeIndeed == null)) && token) {
      const supabaseAuthed = createClient(
        Deno.env.get('SUPABASE_URL') || 'https://yquhsllwrwfvrwolqywh.supabase.co',
        Deno.env.get('SUPABASE_ANON_KEY') || ''
      );
      try { (supabaseAuthed as any).auth.setAuth(token); } catch {}
      const { data: s } = await supabaseAuthed
        .from('job_source_settings')
        .select('include_linkedin, include_indeed, include_search, allowed_domains, enabled_sources')
        .limit(1).maybeSingle();
      if (s) {
        if (s.include_linkedin != null) includeLinkedIn = !!s.include_linkedin;
        if (s.include_search != null) includeSearchListings = !!s.include_search;
        if (s.include_indeed != null) includeIndeed = !!s.include_indeed;
        if (Array.isArray(s.allowed_domains) && s.allowed_domains.length) allowedDomains = s.allowed_domains;
        if (Array.isArray(s.enabled_sources) && s.enabled_sources.length) enabledSources = s.enabled_sources.map((x: string) => x.toLowerCase());
      }
    }
  } catch (_) {
    // ignore settings lookup errors
  }

  try {
  // No heavy initialization required for OPTIONS/POST
  // Prefer API key passed from a trusted proxy (e.g., Vercel serverless) to avoid storing in Supabase
  const headerKey = req.headers.get('x-firecrawl-api-key') || req.headers.get('X-FIRECRAWL-API-KEY');
  const envKey = Deno.env.get('FIRECRAWL_API_KEY');
  // Prefer env secret when present (prevents a bad client header from overriding a valid server key)
  const apiKey = envKey || headerKey;
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY not provided');
  try {
    // Non-sensitive debug signal about key source
    console.log('process-and-match key_source', {
      used: envKey ? 'env' : (headerKey ? 'header' : 'none'),
      header_present: Boolean(headerKey),
      env_present: Boolean(envKey),
    });
  } catch {}

    // Allow using saved Job Sources (deepresearch entries) when caller doesn't pass q
    let configDeepQueries: string[] = [];
    try {
      const authHeader = req.headers.get('authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (token) {
        const sb = createClient(
          Deno.env.get('SUPABASE_URL') || 'https://yquhsllwrwfvrwolqywh.supabase.co',
          Deno.env.get('SUPABASE_ANON_KEY') || ''
        );
        try { (sb as any).auth.setAuth(token); } catch {}
        const { data } = await sb
          .from('job_source_configs')
          .select('sources')
          .limit(1)
          .maybeSingle();
        const arr: any[] = (data && Array.isArray((data as any).sources)) ? (data as any).sources : [];
        configDeepQueries = arr
          .filter((s: any) => (s?.type || '').toLowerCase() === 'deepresearch' && (s?.enabled ?? true))
          .map((s: any) => String(s?.query || '').trim())
          .filter((q: string) => q.length > 0);
      }
    } catch (_) { /* ignore */ }

    const queriesToRun = effectiveQuery ? [effectiveQuery] : configDeepQueries;
    if (!queriesToRun.length) throw new Error("Search query is required.");

    // --- Step 1: Use deepResearch ---
    // Build a targeted prompt and parameters
  const locText = effectiveLocation ? ` in ${effectiveLocation}` : '';
  const typeText = effectiveTypes.length ? `\n• Prefer work type: ${effectiveTypes.join(', ')}` : '';
  const buildPrompt = (q: string) => `Find current job opportunities for: ${q}${locText}.
Strict rules:
${includeSearchListings ? '• You may include job search/listing pages if they contain multiple recent postings.\n' : '• Return only direct job posting pages (no search result pages).\n'}
${includeLinkedIn ? '• LinkedIn links are allowed.\n' : '• Exclude linkedin.com entirely.\n'}
• Exclude salary/average/calculator pages and generic advice pages.
• Prefer company career pages or reputable boards.${typeText}
`;
    const params: any = { maxDepth: 3, timeLimit: 90, maxUrls: 12 };
    // Aggregate sources across all configured queries
    const sources: any[] = [];
    for (const q of queriesToRun) {
      try {
        const dr = await withRetry(() => firecrawlFetch('/v1/deep-research', apiKey, { query: buildPrompt(q), ...params }), 3, 600);
        if (Array.isArray(dr?.data?.sources)) sources.push(...dr.data.sources);
      } catch (_) {
        // continue with next query
      }
    }

    // Filter plausible job listing URLs (with optional allowance for LinkedIn/search pages)
    const isJobListingUrl = (url: string) => {
      if (!url) return false;
  const deny = [
        includeLinkedIn ? /$a/ : /linkedin\.com/i,
        /salary/i, /average/i, /calculator/i, /statistics/i, /glassdoor\.com\/Salaries/i, /payscale\.com/i,
        includeSearchListings ? /$a/ : /\?q=/i,
        includeSearchListings ? /$a/ : /search\?/i
      ];
      if (deny.some((r) => r.test(url))) return false;
      const allow = [
        /\/job\//i, /\/jobs\//i, /\/careers?\//i, /\/jobdetail/i, /\/job-posting/i, /\/viewjob/i,
        /workatastartup\.com\/(jobs|companies)/i, /amazon\.jobs/i, /careers\./i,
      ];
  const looksLikeListing = allow.some((r) => r.test(url)) || (includeIndeed && url.includes('indeed.com') && (/\/job\//i.test(url) || /viewjob/i.test(url)));
      if (looksLikeListing) return true;
      if (includeSearchListings) {
        // permit search/listing pages that are common on boards
        const searchSignals = [/search\//i, /\?q=/i, /\?search=/i, /\bjobs\b/i];
        return searchSignals.some((r) => r.test(url));
      }
      return false;
    };
    let allUrls: string[] = sources.map((s: any) => s?.url).filter((u: any) => typeof u === 'string' && isJobListingUrl(u));
    if (allowedDomains && allowedDomains.length) {
      const domOk = (u: string) => {
        try { const h = new URL(u).hostname; return allowedDomains!.some(d => h.includes(d)); } catch { return false; }
      };
      allUrls = allUrls.filter(domOk);
    }
    const jobUrls: string[] = [];
    const searchUrls: string[] = [];
    for (const u of allUrls) {
      if (/\?q=|search\//i.test(u)) searchUrls.push(u);
      else jobUrls.push(u);
    }

    let scrapedJobs: JobListing[] = [];
    if (jobUrls.length) {
      // Helper to parse a salary range string like "$120000 - $180000" to numeric min/max
      const parseSalaryRangeToMinMax = (input?: string): { min: number | null; max: number | null } => {
        if (!input) return { min: null, max: null };
        const cleaned = String(input).replace(/[\s,]/g, '');
        const m = cleaned.match(/\$?(\d{2,7})(?:[-–to]+\$?(\d{2,7}))?/i);
        if (!m) return { min: null, max: null };
        const min = parseInt(m[1], 10);
        const max = m[2] ? parseInt(m[2], 10) : NaN;
        return { min: Number.isFinite(min) ? min : null, max: Number.isFinite(max) ? max : null };
      };

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

      // salary helpers
      const normalizeCurrency = (s?: string) => {
        if (!s) return null;
        const t = s.trim().toUpperCase();
        if (['USD','$'].includes(t)) return 'USD';
        if (['EUR','€'].includes(t)) return 'EUR';
        if (['GBP','£'].includes(t)) return 'GBP';
        return t;
      };
      const parseSalaryRangeToMinMax = (input?: string): { min: number | null; max: number | null } => {
        if (!input) return { min: null, max: null };
        const cleaned = String(input).replace(/[,\s]/g, '').toLowerCase();
        // handle 120k-180k
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

      // Try to infer salary period and currency from text if missing
      const inferSalaryMeta = (text?: string) => {
        const t = String(text || '').toLowerCase();
        const periodRe = /(per\s+)?(hour|hr|day|week|wk|month|mo|year|yr|annum)/i;
        const currencyRe = /([$€£]|usd|eur|gbp)/i;
        const periodMatch = t.match(periodRe);
        const currencyMatch = (text || '').match(currencyRe);
        const normPeriod = (p?: string | null) => {
          const v = (p || '').toLowerCase();
          if (v === 'hr' || v === 'hour') return 'hour';
          if (v === 'day') return 'day';
          if (v === 'week' || v === 'wk') return 'week';
          if (v === 'month' || v === 'mo') return 'month';
          if (v === 'year' || v === 'yr' || v === 'annum') return 'year';
          return null;
        };
        const normCurr = (c?: string | null) => {
          const v = (c || '').toUpperCase();
          if (v === '$' || v === 'USD') return 'USD';
          if (v === '€' || v === 'EUR') return 'EUR';
          if (v === '£' || v === 'GBP') return 'GBP';
          return null;
        };
        return { period: normPeriod(periodMatch?.[2] || null), currency: normCurr(currencyMatch?.[1] || null) } as { period: string | null; currency: string | null };
      };

      scrapedJobs = scrapeResults
        .filter((res: any) => res?.success && res?.data)
        .map((res: any) => {
          const data = res.data;
          const { reqs, bens } = extractLists(String(data.fullJobDescription || ''));
          // Parse salary range and posted date from extracted data if present
          const { min: sMin, max: sMax } = parseSalaryRangeToMinMax(String(data.salaryRange || ''));
          const postedISO = data.postedDate ? new Date(String(data.postedDate)).toISOString() : undefined;
          const meta = inferSalaryMeta(data.salaryRange || data.fullJobDescription || '');
          return {
            ...data,
            requirements: Array.isArray(data.requirements) && data.requirements.length ? data.requirements : (Array.isArray(data.requiredSkills) ? data.requiredSkills : reqs),
            benefits: Array.isArray(data.benefits) && data.benefits.length ? data.benefits : bens,
            sourceUrl: res.url,
            // Additional salary/contract metadata (not all DB-persisted)
            salary_currency: normalizeCurrency(data.salaryCurrency) || meta.currency,
            salary_period: data.salaryPeriod || meta.period,
            employmentType: data.employmentType || null,
            contractDuration: data.contractDuration || null,
            // Extra fields used by UI mapping
            salary_min: sMin ?? null,
            salary_max: sMax ?? null,
            _posted_at: postedISO,
          } as JobListing;
        });

      // Upsert minimal fields compatible with job_listings schema
  for (const job of scrapedJobs) {
        try {
          const postedISO = (job as any)._posted_at || new Date().toISOString();
          await supabaseAdmin.from('job_listings').upsert(
            {
              job_title: job.jobTitle,
              company_name: job.companyName,
              location: job.location,
              work_type: job.workType,
              full_job_description: job.fullJobDescription || '',
              source_url: job.sourceUrl,
              posted_at: postedISO,
              salary_min: (job as any).salary_min ?? null,
              salary_max: (job as any).salary_max ?? null,
              salary_period: (job as any).salary_period ?? null,
              salary_currency: (job as any).salary_currency ?? null,
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

    // --- Step 2: If no scraped results, attempt per-user jobs fallback (RLS) and optional seeding ---
    if (!scrapedJobs.length) {
      try {
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
        const authed = createClient(
          Deno.env.get('SUPABASE_URL') || 'https://yquhsllwrwfvrwolqywh.supabase.co',
          anonKey
        );
        const authHeader = (req.headers.get('authorization') || '');
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (token) { try { (authed as any).auth.setAuth(token); } catch { /* ignore */ } }
        const toJobListing = (r: any): JobListing => ({
          jobTitle: r.title || r.job_title,
          companyName: r.company || r.company_name,
          location: r.location || null,
          workType: r.remote_type ? (String(r.remote_type).toLowerCase() === 'remote' ? 'Remote' : (String(r.remote_type).toLowerCase() === 'hybrid' ? 'Hybrid' : 'On-site')) : (r.work_type || null),
          fullJobDescription: r.description || r.full_job_description || '',
          sourceUrl: r.apply_url || r.source_url,
          requirements: Array.isArray(r.requirements) ? r.requirements : [],
          benefits: Array.isArray(r.benefits) ? r.benefits : [],
        });
        const normalizeType = (s: string) => {
          const v = s.toLowerCase();
          if (v === 'remote') return 'Remote';
          if (v === 'hybrid') return 'Hybrid';
          if (v === 'on-site' || v === 'onsite' || v === 'on_site' || v === 'on site') return 'On-site';
          return s;
        };
        const typesNorm = Array.from(new Set(effectiveTypes.map(normalizeType)));
        let qJobs = authed
          .from('jobs')
          .select('title, company, location, remote_type, employment_type, description, apply_url, posted_at, salary_min, salary_max, salary_currency')
          .order('posted_at', { ascending: false })
          .limit(50);
        if (effectiveQuery) {
          (qJobs as any) = (qJobs as any).or(`title.ilike.%${effectiveQuery}%,company.ilike.%${effectiveQuery}%,description.ilike.%${effectiveQuery}%`);
        }
        if (effectiveLocation) {
          (qJobs as any) = (qJobs as any).ilike('location', `%${effectiveLocation}%`);
        }
        if (typesNorm.length) {
          const t = typesNorm[0];
          if (t === 'Remote' || t === 'Hybrid' || t === 'On-site') {
            (qJobs as any) = (qJobs as any).ilike('remote_type', `%${t.toLowerCase()}%`);
          }
        }
        const { data: personal } = await qJobs;
        if (Array.isArray(personal) && personal.length) {
          const items = personal.map(toJobListing);
          return new Response(JSON.stringify({ matchedJobs: items, note: 'fallback: personal' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          });
        }
        // Try seeding from Remotive
        const uid = (() => {
          try { const jwt = token ? JSON.parse(atob(token.split('.')[1])) : null; return jwt?.sub || jwt?.user_id || null; } catch { return null; }
        })();
        if (uid && effectiveQuery) {
          try {
            const endpoint = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(effectiveQuery)}`;
            const res = await fetch(endpoint, { headers: { 'accept': 'application/json' } });
            if (res.ok) {
              const json: any = await res.json();
              const jobs = (json?.jobs || []).slice(0, 30).map((j: any) => ({
                user_id: uid,
                source_type: 'remotive',
                source_id: String(j?.id ?? j?.url ?? crypto.randomUUID()),
                title: j?.title ?? '',
                company: j?.company_name ?? '',
                description: j?.description ?? null,
                location: j?.candidate_required_location ?? null,
                remote_type: 'remote',
                employment_type: null,
                salary_min: j?.salary_min ?? null,
                salary_max: j?.salary_max ?? null,
                salary_currency: 'USD',
                tags: Array.isArray(j?.tags) ? j.tags : null,
                apply_url: j?.url ?? '',
                posted_at: j?.publication_date ? new Date(j.publication_date).toISOString() : new Date().toISOString(),
                status: 'active',
                raw_data: j || null,
              }));
              if (jobs.length) {
                await supabaseAdmin.from('jobs').upsert(jobs, { onConflict: 'user_id,source_id' as any });
                const items = jobs.map(toJobListing);
                return new Response(JSON.stringify({ matchedJobs: items, note: 'fallback: seeded_personal' }), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                  status: 200,
                });
              }
            }
          } catch (_) {}
        }
      } catch (_) {}
    }
    // Return scraped results (normal path)
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

    // Fallback: Prefer per-user jobs (RLS) and populate if empty
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

      // Try using authed client to read per-user jobs via RLS
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
      const authed = createClient(
        Deno.env.get('SUPABASE_URL') || 'https://yquhsllwrwfvrwolqywh.supabase.co',
        anonKey
      );
      const authHeader = (req.headers.get('authorization') || '');
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (token) { try { (authed as any).auth.setAuth(token); } catch { /* ignore */ } }

      const toJobListing = (r: any): JobListing => ({
        jobTitle: r.title || r.job_title,
        companyName: r.company || r.company_name,
        location: r.location || null,
        workType: r.remote_type ? (String(r.remote_type).toLowerCase() === 'remote' ? 'Remote' : (String(r.remote_type).toLowerCase() === 'hybrid' ? 'Hybrid' : 'On-site')) : (r.work_type || null),
        fullJobDescription: r.description || r.full_job_description || '',
        sourceUrl: r.apply_url || r.source_url,
        requirements: Array.isArray(r.requirements) ? r.requirements : [],
        benefits: Array.isArray(r.benefits) ? r.benefits : [],
      });

      // Query the personal jobs table first
      let qJobs = authed
        .from('jobs')
        .select('title, company, location, remote_type, employment_type, description, apply_url, posted_at, salary_min, salary_max, salary_currency')
        .order('posted_at', { ascending: false })
        .limit(50);

      if (q) {
        // Match on title/company/description
        (qJobs as any) = (qJobs as any).or(`title.ilike.%${q}%,company.ilike.%${q}%,description.ilike.%${q}%`);
      }
      if (loc) {
        (qJobs as any) = (qJobs as any).ilike('location', `%${loc}%`);
      }
      if (typesNorm.length) {
        // remote_type in jobs may vary; normalize simple contains
        const t = typesNorm[0];
        if (t === 'Remote' || t === 'Hybrid' || t === 'On-site') {
          (qJobs as any) = (qJobs as any).ilike('remote_type', `%${t.toLowerCase()}%`);
        }
      }

      const { data: personal, error: perErr } = await qJobs;
      if (perErr) {
        console.error('fallback personal jobs query error', perErr);
      }
      if (Array.isArray(personal) && personal.length) {
        const items = personal.map(toJobListing);
        return new Response(JSON.stringify({ matchedJobs: items, note: 'fallback: personal' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      // If no personal jobs, attempt a lightweight fetch from Remotive and store per-user
      const uid = (() => {
        try { const jwt = token ? JSON.parse(atob(token.split('.')[1])) : null; return jwt?.sub || jwt?.user_id || null; } catch { return null; }
      })();
      if (uid && q) {
        try {
          const endpoint = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(q)}`;
          const res = await fetch(endpoint, { headers: { 'accept': 'application/json' } });
          if (res.ok) {
            const json: any = await res.json();
            const jobs = (json?.jobs || []).slice(0, 30).map((j: any) => ({
              user_id: uid,
              source_type: 'remotive',
              source_id: String(j?.id ?? j?.url ?? crypto.randomUUID()),
              title: j?.title ?? '',
              company: j?.company_name ?? '',
              description: j?.description ?? null,
              location: j?.candidate_required_location ?? null,
              remote_type: 'remote',
              employment_type: null,
              salary_min: j?.salary_min ?? null,
              salary_max: j?.salary_max ?? null,
              salary_currency: 'USD',
              tags: Array.isArray(j?.tags) ? j.tags : null,
              apply_url: j?.url ?? '',
              posted_at: j?.publication_date ? new Date(j.publication_date).toISOString() : new Date().toISOString(),
              status: 'active',
              raw_data: j || null,
            }));
            if (jobs.length) {
              await supabaseAdmin.from('jobs').upsert(jobs, { onConflict: 'user_id,source_id' as any });
              const items = jobs.map(toJobListing);
              return new Response(JSON.stringify({ matchedJobs: items, note: 'fallback: seeded_personal' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
              });
            }
          }
        } catch (e3) {
          console.error('fallback remotive seed error', e3);
        }
      }

      // As a final fallback, return empty list with note
      return new Response(JSON.stringify({ matchedJobs: [], note: 'fallback: provider_unavailable' }), {
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
