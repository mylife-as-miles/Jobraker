// @ts-nocheck
// Supabase Edge Function: jobs-cron
// - Fetch jobs from external sources (default: Remotive)
// - Upsert into Postgres jobs table
// - Optionally mirror to Firebase Firestore via REST using a service account

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { importPKCS8, SignJWT } from "https://esm.sh/jose@5.2.4";

type Job = {
  external_id: string;
  title: string;
  company: string;
  location: string | null;
  url: string;
  source: string;
  posted_at: string; // ISO string
  description?: string | null;
  tags?: string[] | null;
  salary_min?: number | null;
  salary_max?: number | null;
  work_type?: string | null;
};

async function fetchRemotive(query = "software"): Promise<Job[]> {
  const endpoint = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}`;
  const res = await fetch(endpoint, { headers: { "accept": "application/json" } });
  if (!res.ok) throw new Error(`Remotive fetch failed: ${res.status}`);
  const json: any = await res.json();
  const jobs: Job[] = (json?.jobs || []).map((j: any) => ({
    external_id: String(j?.id ?? j?.url ?? crypto.randomUUID()),
    title: j?.title ?? "",
    company: j?.company_name ?? "",
    location: j?.candidate_required_location ?? null,
    url: j?.url ?? "",
    source: "remotive",
    posted_at: j?.publication_date ? new Date(j.publication_date).toISOString() : new Date().toISOString(),
    description: j?.description ?? null,
    tags: Array.isArray(j?.tags) ? j.tags : null,
    work_type: "Remote",
  }));
  return jobs;
}

async function fetchRemoteOK(): Promise<Job[]> {
  // Free API, sometimes rate-limited
  const res = await fetch("https://remoteok.com/api", { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`RemoteOK fetch failed: ${res.status}`);
  const data: any[] = await res.json();
  const rows = Array.isArray(data) ? data : [];
  return rows
    .filter((j: any) => j && j.id && j.url)
    .map((j: any) => ({
      external_id: String(j.id),
      title: j.position || j.title || "",
      company: j.company || "",
      location: (j.location || j.candidate_required_location || null),
      url: j.url,
      source: "remoteok",
      posted_at: j.date ? new Date(j.date).toISOString() : new Date().toISOString(),
      description: j.description || null,
      tags: Array.isArray(j.tags) ? j.tags : null,
      salary_min: j.salary_min ?? null,
      salary_max: j.salary_max ?? null,
      work_type: "Remote",
    }));
}

async function fetchArbeitNow(query = "software"): Promise<Job[]> {
  // Arbeitnow jobs board JSON feed
  const res = await fetch(`https://www.arbeitnow.com/api/job-board-api?search=${encodeURIComponent(query)}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`ArbeitNow fetch failed: ${res.status}`);
  const json: any = await res.json();
  const list: any[] = json?.data || [];
  return list.map((j: any) => ({
    external_id: String(j.slug || j.id || j.url || crypto.randomUUID()),
    title: j.title || "",
    company: j.company || (j.company_name || ""),
    location: (j.location || j.remote || null),
    url: j.url,
    source: "arbeitnow",
    posted_at: j.created_at ? new Date(j.created_at).toISOString() : new Date().toISOString(),
    description: j.description || null,
    tags: Array.isArray(j.tags) ? j.tags : null,
    salary_min: j.salary_min ?? null,
    salary_max: j.salary_max ?? null,
    work_type: j.remote === true ? "Remote" : null,
  }));
}

async function fetchFromSources(): Promise<Job[]> {
  // Priority: DB (job_source_configs by JOB_SOURCES_USER_ID) > env var JOB_SOURCES > defaults
  const envSources = Deno.env.get("JOB_SOURCES");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");

  // Defaults
  let sources: { type: string; url?: string; query?: string; workType?: string[]; location?: string; salaryRange?: string; experienceLevel?: string; maxResults?: number }[] = [
    { type: "remotive", query: "software engineer" },
    { type: "remoteok" },
    { type: "arbeitnow", query: "typescript" },
    { type: "deepresearch", query: "senior full-stack engineer react node", workType: ["Remote", "Hybrid"], location: "United States", salaryRange: "120k-200k", experienceLevel: "senior", maxResults: 20 }
  ];

  // Try DB config first if we have credentials and a configured user id
  const configUserId = Deno.env.get("JOB_SOURCES_USER_ID");
  if (supabaseUrl && serviceKey && configUserId) {
    try {
      const sb = createClient(supabaseUrl, serviceKey);
      const { data, error } = await sb
        .from('job_source_configs')
        .select('sources')
        .eq('user_id', configUserId)
        .maybeSingle();
      if (!error && data && Array.isArray((data as any).sources)) {
        const arr: any[] = (data as any).sources;
        // Map UI shape to expected ingestor shape, keep only enabled
        const mapped = arr
          .filter((s: any) => s && (s.enabled ?? true))
          .map((s: any) => {
            const t = String(s.type || '').toLowerCase();
            if (t === 'json') {
              return { type: 'json', url: s.query || s.url };
            }
            if (t === 'deepresearch') {
              return { type: 'deepresearch', query: s.query || 'software engineer' };
            }
            return { type: t, query: s.query };
          });
        if (mapped.length) sources = mapped as any;
      }
    } catch (e) {
      console.warn('Failed to load job sources from DB:', e);
    }
  }
  // If DB didn't override and env var is present, use it
  if (envSources) {
    try { const parsed = JSON.parse(envSources); if (Array.isArray(parsed) && parsed.length) sources = parsed; } catch { /* ignore */ }
  }
  const results: Job[] = [];
  for (const s of sources) {
    try {
      if (s.type === "remotive") {
        results.push(...await fetchRemotive(s.query || "software"));
      } else if (s.type === "remoteok") {
        results.push(...await fetchRemoteOK());
      } else if (s.type === "arbeitnow") {
        results.push(...await fetchArbeitNow(s.query || "software"));
      } else if (s.type === "deepresearch") {
        results.push(...await fetchDeepResearchJobs({
          query: s.query || "software engineer",
          workType: s.workType || [],
          location: s.location || "",
          salaryRange: s.salaryRange || "",
          experienceLevel: s.experienceLevel || "",
          maxResults: s.maxResults || 15,
        }));
  } else if (s.type === "json" && s.url) {
        const r = await fetch(s.url, { headers: { accept: "application/json" } });
        if (r.ok) {
          const data: any[] = await r.json();
          for (const it of data) {
            results.push({
              external_id: String(it.external_id ?? it.id ?? crypto.randomUUID()),
              title: it.title,
              company: it.company,
              location: it.location ?? null,
              url: it.url,
              source: it.source ?? new URL(s.url).hostname,
              posted_at: it.posted_at ? new Date(it.posted_at).toISOString() : new Date().toISOString(),
              description: it.description ?? null,
              tags: Array.isArray(it.tags) ? it.tags : null,
              salary_min: it.salary_min ?? null,
              salary_max: it.salary_max ?? null,
              work_type: it.work_type ?? null,
            });
          }
        }
      }
    } catch (e) {
      console.error("Source fetch error", s, e);
    }
  }
  return results;
}

// Inspired by user-provided Firecrawl deep research logic
const INCLUDE_LINKEDIN = (() => {
  try {
    return ['1','true','yes','on'].includes(String(Deno.env.get('INCLUDE_LINKEDIN') ?? 'true').toLowerCase());
  } catch { return true; }
})();
const INCLUDE_SEARCH = (() => {
  try {
    return ['1','true','yes','on'].includes(String(Deno.env.get('INCLUDE_SEARCH') ?? 'true').toLowerCase());
  } catch { return true; }
})();

function isJobListingUrl(url: string): boolean {
  if (!url) return false;
  // Exclude obvious non-job or salary/search pages
  const redFlags = [
    /salary/i,
    /average/i,
    /statistics/i,
    /calculator/i,
    /how-much/i,
    /glassdoor\.com\/Salaries/i,
    /indeed\.com\/career/i,
    /payscale\.com/i,
    INCLUDE_SEARCH ? /$a/ : /\?q=/i,
    INCLUDE_SEARCH ? /$a/ : /search\?/i,
    INCLUDE_LINKEDIN ? /$a/ : /linkedin\.com\/jobs/i, // optionally exclude LinkedIn
  ];
  for (const pattern of redFlags) if (pattern.test(url)) return false;

  // Positive signals
  const jobIdPatterns = [
    /\/job[s]?\//i,
    /\/position[s]?\//i,
    /\/career[s]?\//i,
    /\/viewjob/i,
    /\/job-posting/i,
    /\/jobdetail/i,
  ];
  const companyJobSites = [
    "workatastartup.com/companies",
    "workatastartup.com/jobs",
    "careers.google.com",
    "amazon.jobs",
    "careers.microsoft.com",
    "apple.com/careers",
    "careers.twitter.com",
    "facebook.com/careers",
    "weworkremotely.com/remote-jobs",
  ];
  const hasPattern = jobIdPatterns.some((p) => p.test(url));
  const isCompanySite = companyJobSites.some((site) => url.includes(site));
  const isIndeedJob = url.includes("indeed.com") && (url.includes("/job/") || url.includes("/viewjob") || (INCLUDE_SEARCH && /\bjobs\b|search|\?q=/.test(url)));
  if (hasPattern || isCompanySite || isIndeedJob) return true;
  if (INCLUDE_SEARCH) {
    const searchSignals = [/search\//i, /\?q=/i, /\?search=/i, /\bjobs\b/i];
    if (searchSignals.some((r) => r.test(url))) return true;
  }
  return false;
}

function parseSalaryRangeToMinMax(input?: string): { min: number | null; max: number | null } {
  if (!input) return { min: null, max: null };
  const cleaned = input.replace(/[,\s]/g, "");
  const m = cleaned.match(/\$?(\d{2,6})(?:[-–to]+\$?(\d{2,6}))?/i);
  if (!m) return { min: null, max: null };
  const min = parseInt(m[1], 10);
  const max = m[2] ? parseInt(m[2], 10) : null;
  return { min: isFinite(min) ? min : null, max: isFinite(Number(max)) ? Number(max) : null };
}

type DeepResearchConfig = {
  query: string;
  workType?: string[];
  location?: string;
  salaryRange?: string;
  experienceLevel?: string;
  maxResults?: number;
};

async function fetchDeepResearchJobs(cfg: DeepResearchConfig): Promise<Job[]> {
  const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!apiKey) {
    console.warn('Skipping deepresearch source: FIRECRAWL_API_KEY not set');
    return [];
  }

  // Build filter criteria string similar to inspiration
  let filterCriteria = '';
  if (cfg.workType && cfg.workType.length) filterCriteria += `\nWork Type: ${cfg.workType.join(' or ')}`;
  if (cfg.location) filterCriteria += `\nLocation: ${cfg.location}`;
  if (cfg.salaryRange) filterCriteria += `\nSalary Range: ${cfg.salaryRange}`;
  if (cfg.experienceLevel) filterCriteria += `\nExperience Level: ${cfg.experienceLevel}`;

  const deepQuery = `Find and return current, individual job postings that match this search: ${cfg.query}.\nStrict Rules:\n• Only return jobs posted within the last 90 days.\n• Only include direct individual job postings (not job search result pages).\n• Exclude LinkedIn job links completely.\n• Ignore pages about salary info or generic career advice.\n${filterCriteria ? `\nUse these filters to narrow results:${filterCriteria}` : ''}`;

  const body = { query: deepQuery, maxDepth: 4, timeLimit: 120, maxUrls: cfg.maxResults || 15 } as any;

  try {
    const res = await fetch('https://api.firecrawl.dev/v1/deep-research', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`firecrawl deep-research ${res.status}: ${txt}`);
    }
    const json = await res.json();
    const data = (json && (json as any).data) || {};
    const sources = Array.isArray(data.sources) ? data.sources : [];

    const jobs: Job[] = [];
    for (const src of sources) {
      const url = src?.url || '';
      const title = src?.title || '';
      const snippet = src?.snippet || src?.content || '';
      if (!isJobListingUrl(url)) continue;

      let company = src?.companyName || src?.company || '';
      if (!company && title) {
        const m1 = title.match(/\bat\s+([A-Za-z0-9.\s]+?)(?:\s+\||$)/i);
        if (m1?.[1]) company = m1[1].trim();
      }
      const loc = src?.location || (snippet.match(/\b(Remote|Hybrid|On-site)\b/i)?.[1] || null);
      const posted = src?.postedDate || null;
      const salaryText = src?.salaryRange || src?.salary || '';
      const { min: salary_min, max: salary_max } = parseSalaryRangeToMinMax(salaryText);
      const work_type = (cfg.workType && cfg.workType[0]) || (loc && /remote/i.test(String(loc)) ? 'Remote' : null);
      // infer salary period/currency from snippet text
      const inferMeta = (text?: string) => {
        const t = String(text || '').toLowerCase();
        const periodRe = /(per\s+)?(hour|hr|day|week|wk|month|mo|year|yr|annum)/i;
        const currencyRe = /([$€£]|usd|eur|gbp)/i;
        const p = t.match(periodRe)?.[2] || '';
        const c = (text || '').match(currencyRe)?.[1] || '';
        const normP = (v: string) => v === 'hr' ? 'hour' : v === 'wk' ? 'week' : v === 'mo' ? 'month' : v === 'yr' ? 'year' : v;
        const normC = (v: string) => ({'$':'USD','USD':'USD','€':'EUR','EUR':'EUR','£':'GBP','GBP':'GBP'} as any)[v] || undefined;
        return { period: normP(p), currency: normC(c) } as { period?: string; currency?: string };
      };
      const meta = inferMeta(salaryText || snippet || title);

      jobs.push({
        external_id: url,
        title: title || 'Job',
        company: company || 'Unknown',
        location: loc,
        url,
        source: 'deepresearch',
        posted_at: posted ? new Date(posted).toISOString() : new Date().toISOString(),
        description: snippet || null,
        tags: null,
        salary_min,
        salary_max,
        work_type,
        // meta not persisted to DB but available in payload if needed downstream
        ...(meta.period ? { salary_period: meta.period } : {}),
        ...(meta.currency ? { salary_currency: meta.currency } : {}),
      });
    }
    return jobs;
  } catch (e) {
    console.error('Deep research fetch error', e);
    return [];
  }
}

async function upsertIntoSupabase(jobs: Job[]) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://yquhsllwrwfvrwolqywh.supabase.co";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceKey);

  // Upsert in chunks
  const chunkSize = 200;
  let upserted = 0;
  // heuristic extractors for requirements/benefits from description text
  const extractLists = (htmlOrText?: string) => {
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
    return { requirements: grabAfter(reqHeads), benefits: grabAfter(benHeads) };
  };

  for (let i = 0; i < jobs.length; i += chunkSize) {
    const chunk = jobs.slice(i, i + chunkSize);
    const rows = chunk.map(j => ({
      source: j.source,
      external_id: j.external_id,
      job_title: j.title,
      company_name: j.company,
      location: j.location,
      source_url: j.url,
      posted_at: j.posted_at,
      // job_listings.full_job_description is NOT NULL, ensure a fallback string
      full_job_description: (j.description && String(j.description).trim()) || "",
      work_type: j.work_type ?? (j.source === "remotive" || j.source === "remoteok" ? "Remote" : null),
      tags: j.tags ?? null,
      salary_min: j.salary_min ?? null,
      salary_max: j.salary_max ?? null,
      updated_at: new Date().toISOString(),
      // derived lists
      ...(() => {
        const { requirements, benefits } = extractLists(j.description || '');
        return { requirements, benefits };
      })(),
    }));

    // Upsert by unique source_url
    const { error, count } = await supabase
      .from("job_listings")
      .upsert(rows, { onConflict: "source_url", ignoreDuplicates: false, count: "estimated" });
    if (error) throw error;
    upserted += count ?? chunk.length;
  }
  return upserted;
}

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
};

async function getGoogleAccessToken(sa: ServiceAccount, scope: string) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: sa.client_email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  } as const;
  const key = await importPKCS8(sa.private_key, "RS256");
  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .sign(key);
  const form = new URLSearchParams();
  form.set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
  form.set("assertion", jwt);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  const json = await res.json();
  return json.access_token as string;
}

async function pushToFirestore(jobs: Job[]) {
  const saRaw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  const projectId = Deno.env.get("FIREBASE_PROJECT_ID");
  const collection = Deno.env.get("FIREBASE_COLLECTION") || "jobs";
  if (!saRaw || !projectId) return { pushed: 0 };
  let sa: ServiceAccount;
  try { sa = JSON.parse(saRaw); } catch { throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT JSON"); }
  const accessToken = await getGoogleAccessToken(sa, "https://www.googleapis.com/auth/datastore");

  // Batch write in chunks of 500
  let pushed = 0;
  for (let i = 0; i < jobs.length; i += 400) {
    const batch = jobs.slice(i, i + 400);
    const writes = batch.map((j) => ({
      upsert: {
        name: `projects/${projectId}/databases/(default)/documents/${collection}/${j.source}_${j.external_id}`,
        fields: {
          title: { stringValue: j.title },
          company: { stringValue: j.company },
          location: j.location ? { stringValue: j.location } : { nullValue: null },
          url: { stringValue: j.url },
          source: { stringValue: j.source },
          posted_at: { timestampValue: j.posted_at },
          description: j.description ? { stringValue: j.description } : { nullValue: null },
          tags: j.tags ? { arrayValue: { values: j.tags.map(t => ({ stringValue: t })) } } : { nullValue: null },
          salary_min: j.salary_min != null ? { integerValue: String(j.salary_min) } : { nullValue: null },
          salary_max: j.salary_max != null ? { integerValue: String(j.salary_max) } : { nullValue: null },
        }
      }
    }));
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:batchWrite`, {
      method: "POST",
      headers: { "authorization": `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ writes }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Firestore batchWrite failed: ${res.status} ${txt}`);
    }
    pushed += batch.length;
  }
  return { pushed };
}

async function handler(req: Request) {
  const start = Date.now();
  try {
    const jobs = await fetchFromSources();
    const unique = new Map<string, Job>();
    for (const j of jobs) {
      const key = `${j.source}:${j.external_id}`;
      if (!unique.has(key)) unique.set(key, j);
    }
    const arr = Array.from(unique.values());

    const upserted = await upsertIntoSupabase(arr);
    const { pushed } = await pushToFirestore(arr);

    const ms = Date.now() - start;
    return new Response(JSON.stringify({ ok: true, fetched: jobs.length, unique: arr.length, upserted, pushed, ms }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

Deno.serve(handler);

// Optional: run on a schedule using Deno.cron when deployed on Supabase
try {
  const cronExpr = Deno.env.get("JOBS_CRON_EXPR"); // e.g. "0 */6 * * *" every 6 hours
  if (cronExpr) {
    // @ts-ignore - Deno.cron is available in Supabase Edge Runtime
    Deno.cron("jobs-cron", cronExpr, async () => {
      try {
        await handler(new Request("http://local/cron"));
      } catch (e) {
        console.error("jobs-cron scheduled run failed", e);
      }
    });
  }
} catch (_) {
  // ignore if Deno.env or Deno.cron isn't available in local TS tooling
}
