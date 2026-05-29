// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';
import { withRetry, resolveFirecrawlApiKey, firecrawlFetch } from '../_shared/firecrawl.ts';
import { generateGeminiDescription } from '../_shared/gemini.ts';
import { formatJobTitleAndDescriptionWithAi } from '../_shared/jobs.ts';
import { applyMicro1ReferralToUrl } from '../_shared/micro1-referral.ts';
import { createNotificationRecord } from '../_shared/notification-center.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

function hostFromUrl(u: string): string | null {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return null; }
}

function stripHtmlTags(html: string): string {
  // Remove HTML tags and decode common HTML entities
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanJobDescription(value: string | undefined | null): string {
  if (!value) return '';
  const raw = String(value);
  const cleaned = /<\/?[a-z][\s\S]*>/i.test(raw) ? stripHtmlTags(raw) : raw;
  return cleaned.replace(/\[(.*?)\]\((.*?)\)/g, '$1 ($2)').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function isLikelyAggregateJobPage(url: string, title?: string, description?: string): boolean {
  const lowerUrl = url.toLowerCase();
  const text = `${title || ''} ${description || ''}`.toLowerCase();
  if (/\/(search|job-search|jobs-search|find-jobs|browse|companies|categories)(\/|$)/i.test(lowerUrl)) return true;
  if (/\/(jobs?|careers?|openings?|positions?|vacancies?|remote-jobs)\/?$/i.test(lowerUrl)) return true;
  if (/\b\d+\s+(?:fully\s+remote\s+)?[\w\s()/-]{2,80}\s+jobs?\s+in\b/i.test(text)) return true;
  if (/\b(jobs|vacancies|openings)\s+in\s+(the\s+best\s+)?companies\b/i.test(text)) return true;
  if (/\b(show|find|browse|view)\s+\d+\+?\s+jobs?\b/i.test(text)) return true;
  return /\bjob board\b|\bsearch results\b|\ball jobs\b|\bmore jobs\b/i.test(text);
}

Deno.serve(async (req) => {
  // The Kafka Sink sends the payload as the request body.
  // The payload format depends on the Connector configuration.
  const corsHeaders = getCorsHeaders(req.headers.get('origin'), req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log('[process-job-search] Received payload:', JSON.stringify(payload));

    // Confluent HTTP Sink might send the value directly if configured with JSON converter
    // Our produceMessage sent: { type: "job_search_request", userId, searchQuery, location, limit, ... }

    const { userId, searchQuery, location, limit, tbs } = payload;

    if (!userId || !searchQuery) {
      console.error('[process-job-search] Missing userId or searchQuery in payload');
      return new Response('Missing required fields', { status: 400 });
    }

    const rawQuery = searchQuery;

    console.log(`[process-job-search] Processing for user ${userId}: ${rawQuery} in ${location || 'Remote'}`);

    // Default domains (fallback if user settings not found)
    const defaultDomains = [
      'remote.co', 'remotive.com', 'remoteok.com', 'jobicy.com', 
      'levels.fyi', 'greenhouse.io', 'lever.co', 'wellfound.com',
      'builtin.com', 'workingnomads.com', 'weworkremotely.com',
      'flexjobs.com', 'cryptojobslist.com', 'otta.com', 'hired.com',
      'dice.com', 'ycombinator.com', 'startup.jobs', 'nodesk.co',
      'remoterocketship.com', 'jobspresso.com', 'talent.hubstaff.com',
      'flexa.careers', 'jobs.micro1.ai',
    ];

    // Blocklist: exclude problematic domains from search
    const blocked = new Set([
      'techsolutions.com',
    ]);

    // Fetch user's job source settings from database
    let domainList: string[] = defaultDomains;
    try {
      const { data: settings, error: settingsError } = await supabaseAdmin
        .from('job_source_settings')
        .select('enabled_default_sources, allowed_domains')
        .eq('id', userId)
        .maybeSingle();

      if (!settingsError && settings) {
        if (Array.isArray(settings.enabled_default_sources) && settings.enabled_default_sources.length > 0) {
          domainList = settings.enabled_default_sources.map((d: string) => String(d).toLowerCase().trim());
        }
      }
    } catch (err) {
      console.warn('[process-job-search] Failed to load settings, using defaults:', err);
      domainList = defaultDomains;
    }

    // Normalize and filter domains
    domainList = domainList
      .map((d) => String(d).toLowerCase().replace(/^www\./, ''))
      .filter((d) => {
        for (const b of blocked) {
          const bb = String(b).toLowerCase().replace(/^www\./, '');
          if (d === bb || d.endsWith(`.${bb}`)) return false;
        }
        return true;
      })
      .filter((d, index, self) => self.indexOf(d) === index);

    // Compose optimized query
    const siteClause = domainList.map((d) => `site:${d}`).join(' OR ');
    const jobPagePatterns = '(inurl:job OR inurl:view OR inurl:posting OR inurl:opening OR inurl:career OR inurl:apply OR inurl:detail)';
    const exclusions = '-inurl:search -inurl:/q- -inurl:company-reviews -inurl:salaries';
    const titleHints = 'intitle:job OR intitle:hiring OR intitle:career OR intitle:opening';

    const fullQuery = [
      rawQuery,
      location ? `"${location}"` : null,
      `(${siteClause})`,
      jobPagePatterns,
      exclusions,
      `(${titleHints})`
    ].filter(Boolean).join(' ');

    const firecrawlApiKey = await resolveFirecrawlApiKey();
    const searchPayload: any = {
      query: fullQuery,
      limit: limit || 50,
      sources: ['web'],
      tbs: tbs || 'qdr:m',
      ...(location ? { location } : {}),
      scrapeOptions: {
        onlyMainContent: true,
        skipTlsVerification: true,
        removeBase64Images: true,
        blockAds: true,
        proxy: "auto",
        actions: [
          { type: "wait", milliseconds: 1000 },
          { type: "scroll", direction: "down", count: 2 }
        ],
        formats: [
          "markdown",
          "links",
          {
            type: "json",
            schema: {
              type: "object",
              properties: {
                title: { type: "string" },
                company: { type: "string" },
                description: { type: "string" },
                employment_type: { type: "string" },
                experience_level: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
                salary: { type: "string" },
                salary_min: { type: "number" },
                salary_max: { type: "number" },
                salary_currency: { type: "string" },
                location: { type: "string" },
                deadline: { type: "string" },
                apply_link: { type: "string" }
              }
            },
            prompt: "Extract exactly one specific job posting. If the page is a list, search result, company directory, or generic careers page, leave title/company/description empty instead of inventing a job. Description must be plain text with no HTML."
          }
        ]
      }
    };

    console.log('[process-job-search] Sending Firecrawl payload');

    let searchRes: any;
    try {
      searchRes = await withRetry(() => firecrawlFetch('/search', firecrawlApiKey, searchPayload, userId), 2, 600);
    } catch (e: any) {
      console.error('[process-job-search] Firecrawl failed', e);
      return new Response('Search provider error', { status: 500 });
    }

    const webItems: any[] = Array.isArray(searchRes?.data?.web) ? searchRes.data.web : [];
    const domainSet = new Set(domainList);
    const filtered: any[] = [];
    const seen = new Set<string>();

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
      // Otta jobs
      if (lower.includes('otta.com') && lower.includes('/jobs/')) return true;
      // BuiltIn jobs
      if (lower.includes('builtin.com') && lower.includes('/job/')) return true;
      // WorkingNomads jobs
      if (lower.includes('workingnomads.com') && lower.includes('/jobs/')) return true;
      // CryptoJobsList jobs
      if (lower.includes('cryptojobslist.com') && lower.includes('/jobs/')) return true;
      // YCombinator jobs
      if (lower.includes('ycombinator.com') && lower.includes('/jobs/')) return true;
      // Startup.jobs
      if (lower.includes('startup.jobs') && lower.split('/').length > 4) return true;
      // Talent.hubstaff.com
      if (lower.includes('talent.hubstaff.com') && lower.includes('/jobs/')) return true;
      // NodeDesk.co
      if (lower.includes('nodesk.co') && lower.includes('/remote-jobs/')) return true;
      // micro1 opportunities (subdomain jobs.micro1.ai)
      if (lower.includes('jobs.micro1.ai') && /jobs\.micro1\.ai\/[^/?#]+/.test(lower)) return true;

      // Generic patterns
      if (lower.match(/\/(job|posting|opening|career|apply|position)s?\/[^\/]+\/?$/)) return true;
      return false;
    };

    const extractCompanyFromUrl = (url: string): string => {
        try {
          const hostname = new URL(url).hostname.replace('www.', '');
          const parts = hostname.split('.');
          return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        } catch { return 'Unknown Company'; }
    };

    const getCompanyLogoUrl = (companyName: string, url: string): string | null => {
        try {
          const hostname = new URL(url).hostname.replace('www.', '');
          return `https://logo.clearbit.com/${encodeURIComponent(hostname)}`;
        } catch { return null; }
    };

    for (const item of webItems) {
      const url: string | undefined = item?.url || item?.metadata?.sourceURL;
      if (typeof url !== 'string') continue;
      const clean = url.replace(/\/$/, '');
      const referredClean = applyMicro1ReferralToUrl(clean);
      const h = hostFromUrl(clean);
      if (!h) continue;

      const allowed = Array.from(domainSet).some((d) => h === d || h.endsWith(`.${d}`));
      if (h === 'techsolutions.com' || h.endsWith('.techsolutions.com')) continue;
      if (!allowed) continue;
      if (seen.has(referredClean)) continue;

      if (clean.toLowerCase().includes('/search') ||
          clean.toLowerCase().includes('/q-') ||
          clean.toLowerCase().match(/jobs\.html?$/)) {
        continue;
      }

      seen.add(referredClean);

      const scrapedJson = item?.scraped?.json || item?.json;
      const hasStructuredData = scrapedJson && typeof scrapedJson === 'object';
      const companyName = hasStructuredData ? (scrapedJson.company || extractCompanyFromUrl(referredClean)) : extractCompanyFromUrl(referredClean);
      const companyLogo = getCompanyLogoUrl(companyName, referredClean);
      const screenshot = item?.scraped?.screenshot || item?.screenshot;
      const fullHtml = item?.scraped?.html || item?.html;
      const fullMarkdown = item?.scraped?.markdown || item?.markdown;
      const fallbackDesc = typeof item?.description === 'string' ? item.description : undefined;
      const cleanDescription = cleanJobDescription(fullMarkdown || scrapedJson?.description || fallbackDesc || fullHtml);
      if (!isJobPostingUrl(clean) && isLikelyAggregateJobPage(clean, item?.title, cleanDescription)) {
        continue;
      }

      filtered.push({
        url: referredClean,
        title: hasStructuredData ? (scrapedJson.title || item?.title) : item?.title,
        description: cleanDescription,
        category: typeof item?.category === 'string' ? item.category : undefined,
        isJobPosting: isJobPostingUrl(clean),
        company: companyName,
        company_logo: companyLogo,
        salary: hasStructuredData ? (scrapedJson.salary || undefined) : undefined,
        salary_min_json: hasStructuredData ? (scrapedJson.salary_min ?? undefined) : undefined,
        salary_max_json: hasStructuredData ? (scrapedJson.salary_max ?? undefined) : undefined,
        salary_currency_json: hasStructuredData ? (scrapedJson.salary_currency ?? undefined) : undefined,
        location: hasStructuredData ? scrapedJson.location : undefined,
        deadline: hasStructuredData ? scrapedJson.deadline : undefined,
        apply_link: hasStructuredData
          ? applyMicro1ReferralToUrl(String(scrapedJson.apply_link || referredClean))
          : referredClean,
        employment_type: hasStructuredData ? scrapedJson.employment_type : undefined,
        experience_level: hasStructuredData ? scrapedJson.experience_level : undefined,
        tags: hasStructuredData && Array.isArray(scrapedJson.tags) ? scrapedJson.tags.filter(Boolean) : undefined,
        markdown: fullMarkdown,
        html: undefined,
        screenshot: screenshot,
      });
      if (typeof limit === 'number' && filtered.length >= limit) break;
    }

    filtered.sort((a, b) => {
      if (a.isJobPosting && !b.isJobPosting) return -1;
      if (!a.isJobPosting && b.isJobPosting) return 1;
      return 0;
    });

    console.log('[process-job-search] Saving jobs...', { count: filtered.length });

    const jobsToInsert = await Promise.all(filtered.map(async (item) => {
      let aiData;
      try {
        aiData = await generateGeminiDescription(item.html, item.markdown, item.description, item.title || rawQuery);
      } catch (e) {
        console.error('AI enrichment failed', e);
        const fallbackDescription = cleanJobDescription(item.markdown || item.description || '');
        aiData = { description: fallbackDescription, tags: item.tags || [] };
      }

      const rawTitle = item.title || rawQuery;
      const formatted = await formatJobTitleAndDescriptionWithAi(rawTitle, aiData.description);

      let expiresAt = null;
      if (item.deadline) {
        try {
            const parsed = new Date(item.deadline);
            if (!isNaN(parsed.getTime())) expiresAt = parsed.toISOString();
        } catch {}
      }

      // Parse salary from string to structured fields
      let salary_min: number | null = null;
      let salary_max: number | null = null;
      let salary_currency: string | null = null;

      // Prefer structured salary from JSON if present
      if (typeof item.salary_min_json === 'number') salary_min = Math.round(item.salary_min_json);
      if (typeof item.salary_max_json === 'number') salary_max = Math.round(item.salary_max_json);
      if (typeof item.salary_currency_json === 'string') salary_currency = item.salary_currency_json;

      if ((salary_min == null || salary_max == null) && item.salary && typeof item.salary === 'string') {
        const salaryStr = item.salary;

        // Detect currency
        if (!salary_currency && (salaryStr.includes('£') || salaryStr.toLowerCase().includes('gbp'))) {
          salary_currency = 'GBP';
        } else if (!salary_currency && (salaryStr.includes('€') || salaryStr.toLowerCase().includes('eur'))) {
          salary_currency = 'EUR';
        } else if (!salary_currency && salaryStr.toLowerCase().includes('cad')) {
          salary_currency = 'CAD';
        } else if (!salary_currency && salaryStr.toLowerCase().includes('aud')) {
          salary_currency = 'AUD';
        } else if (!salary_currency && (salaryStr.includes('$') || salaryStr.toLowerCase().includes('usd'))) {
          salary_currency = 'USD';
        }

        // Extract numeric values (supports ranges like "50,000-80,000" or "50k-80k")
        const rangeMatch = salaryStr.match(/[\$£€]?([\d,]+)k?\s*-\s*[\$£€]?([\d,]+)k?/i);
        if (rangeMatch) {
          const min = parseFloat(rangeMatch[1].replace(/,/g, ''));
          const max = parseFloat(rangeMatch[2].replace(/,/g, ''));

          // Handle "k" notation (e.g., 50k = 50000)
          const minIsK = salaryStr.toLowerCase().includes(rangeMatch[1].toLowerCase() + 'k');
          const maxIsK = salaryStr.toLowerCase().includes(rangeMatch[2].toLowerCase() + 'k');

          salary_min = minIsK ? Math.round(min * 1000) : Math.round(min);
          salary_max = maxIsK ? Math.round(max * 1000) : Math.round(max);
        } else {
          // Try single value
          const singleMatch = salaryStr.match(/[\$£€]?([\d,]+)k?/i);
          if (singleMatch) {
            const val = parseFloat(singleMatch[1].replace(/,/g, ''));
            const isK = salaryStr.toLowerCase().includes(singleMatch[1].toLowerCase() + 'k');
            const amount = isK ? Math.round(val * 1000) : Math.round(val);
            salary_min = amount;
            // Don't set max for single values
          }
        }
      }

      return {
        user_id: userId,
        source_type: 'web_search',
        source_id: item.url,
        title: formatted.title,
        company: item.company,
        company_logo: item.company_logo || null,
        description: formatted.description,
        location: item.location || location || 'Remote',
        remote_type: 'Remote',
        employment_type: item.employment_type || null,
        experience_level: item.experience_level || null,
        tags: aiData.tags,
        apply_url: item.apply_link || item.url,
        posted_at: new Date().toISOString(),
        expires_at: expiresAt,
        salary_min,
        salary_max,
        salary_currency,
        status: 'active',
        raw_data: {
            search_query: rawQuery,
            search_location: location,
            category: item.category,
            isJobPosting: item.isJobPosting,
            source: 'firecrawl_kafka',
            salary: item.salary,
            deadline: item.deadline,
            screenshot: item.screenshot,
            markdown: item.markdown,
            html: null,
            scraped_data: {
                title: item.title,
                company: item.company,
                salary: item.salary,
                salary_min: salary_min,
                salary_max: salary_max,
                salary_currency: salary_currency,
                location: item.location,
                deadline: item.deadline,
                apply_link: item.apply_link,
                employment_type: item.employment_type,
                experience_level: item.experience_level,
                tags: item.tags,
            }
        }
      };
    }));

    if (jobsToInsert.length > 0) {
        const { error: insertError } = await supabaseAdmin
        .from('jobs')
        .upsert(jobsToInsert, { onConflict: 'user_id,source_id', ignoreDuplicates: false });

        if (insertError) {
            console.error('[process-job-search] Insert error', insertError);
            throw insertError;
        }
    }

    // Insert notification for completed search
    try {
      await createNotificationRecord(supabaseAdmin, {
        userId,
        type: 'job_search',
        source: 'job_search',
        title: 'Job Search Complete',
        message: `Found ${jobsToInsert.length} new jobs matching "${rawQuery}"`,
        priority: jobsToInsert.length > 0 ? 'medium' : 'low',
        actionUrl: '/dashboard/jobs',
        actionLabel: 'Review jobs',
        metadata: {
          query: rawQuery,
          location: location || null,
          limit: typeof limit === 'number' ? limit : null,
          jobs_found: jobsToInsert.length,
          source_domains: domainList,
          tbs: tbs || null,
        },
        dedupeKey: `job-search:${userId}:${rawQuery.toLowerCase()}:${location || 'any'}:${new Date().toISOString().slice(0, 13)}`,
      });
    } catch (notifError) {
      console.error('[process-job-search] Failed to create notification', notifError);
    }

    console.log('[process-job-search] Successfully processed batch');
    return new Response('Processed', { status: 200 });

  } catch (e) {
    console.error('[process-job-search] Unexpected error', e);
    return new Response(e.message, { status: 500 });
  }
});
