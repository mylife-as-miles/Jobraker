// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/types.ts';
import { withRetry, resolveFirecrawlApiKey, firecrawlFetch } from '../_shared/firecrawl.ts';
import { generateAiDescription } from '../_shared/openai.ts';

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

    const allowedDomains = [
      'remote.co',
      'remotive.com',
      'remoteok.com',
      'jobicy.com',
      'levels.fyi',
    ];
    // Blocklist: exclude problematic domains from search
    const blocked = new Set([
      'techsolutions.com',
    ]);

    // Start from user-configured domains if present; else use defaults
    let domainList = allowedDomains
      .map((d) => String(d).toLowerCase().replace(/^www\./, ''))
      .filter((d) => {
        // Exclude any domain that matches or is a subdomain of a blocked entry
        for (const b of blocked) {
          const bb = String(b).toLowerCase().replace(/^www\./, '');
          if (d === bb || d.endsWith(`.${bb}`)) return false;
        }
        return true;
      });

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
          // Include full content for better descriptions
          "markdown",
          "html",
          {
            type: "json",
            // Use a JSON Schema to strongly type the output and allow the AI to infer missing fields
            schema: {
              type: "object",
              properties: {
                title: { type: "string" },
                company: { type: "string" },
                description: { type: "string" },
                employment_type: { type: "string" },
                experience_level: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
                // Raw salary string if present
                salary: { type: "string" },
                // Structured salary fields when possible
                salary_min: { type: "number" },
                salary_max: { type: "number" },
                salary_currency: { type: "string" },
                location: { type: "string" },
                deadline: { type: "string" },
                apply_link: { type: "string" }
              }
            },
            prompt: "You are extracting structured job posting data. If the page does not explicitly state a field, infer it conservatively from the content. Return concise values. For salary, prefer annual ranges. Populate: title, company, description (the full, complete job description, do not summarize), employment_type (e.g., Full-time, Contract, Internship), experience_level (e.g., Junior, Mid, Senior), tags (skills and technologies), salary, salary_min, salary_max, salary_currency (USD/GBP/EUR/CAD/AUD), location, deadline, apply_link."
          },
          {
            type: "screenshot",
            fullPage: false,
            quality: 80
          }
        ]
      }
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
      // Jobberman jobs
      if (lower.includes('jobberman.com') && lower.includes('/listings/')) return true;
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
  // Extra safety: blocklist check
  if (h === 'techsolutions.com' || h.endsWith('.techsolutions.com')) continue;
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
      
      // Generate company logo URL using Clearbit Logo API
      const getCompanyLogoUrl = (companyName: string, url: string): string | null => {
        try {
          // Try to extract domain from URL for more accurate logo lookup
          const hostname = new URL(url).hostname.replace('www.', '');
          
          // Use Clearbit Logo API (free, no API key required)
          // Format: https://logo.clearbit.com/:domain
          return `https://logo.clearbit.com/${encodeURIComponent(hostname)}`;
        } catch {
          // Fallback: try to construct domain from company name
          const sanitizedName = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (sanitizedName && sanitizedName !== 'unknowncompany') {
            return `https://logo.clearbit.com/${encodeURIComponent(sanitizedName)}.com`;
          }
          return null;
        }
      };
      
      // Check for AI-extracted JSON data first
      const scrapedJson = item?.scraped?.json || item?.json;
      const hasStructuredData = scrapedJson && typeof scrapedJson === 'object';
      
      // Get company name
      const companyName = hasStructuredData ? (scrapedJson.company || extractCompanyFromUrl(clean)) : extractCompanyFromUrl(clean);
      
      // Get company logo URL
      const companyLogo = getCompanyLogoUrl(companyName, clean);
      
      // Get screenshot if available
      const screenshot = item?.scraped?.screenshot || item?.screenshot;
      
  // Prefer full content for description: html > markdown > fallback
  const fullMarkdown = item?.scraped?.markdown || item?.markdown;
  const fullHtml = item?.scraped?.html || item?.html;
      const fallbackDesc = typeof item?.description === 'string' ? item.description : undefined;
      
      filtered.push({
        url: clean,
        title: hasStructuredData ? (scrapedJson.title || item?.title) : item?.title,
        // Store rich description (prefer HTML so UI can render directly)
        description: fullHtml || fullMarkdown || scrapedJson?.description || fallbackDesc,
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
        apply_link: hasStructuredData ? (scrapedJson.apply_link || clean) : clean,
        employment_type: hasStructuredData ? scrapedJson.employment_type : undefined,
        experience_level: hasStructuredData ? scrapedJson.experience_level : undefined,
        tags: hasStructuredData && Array.isArray(scrapedJson.tags) ? scrapedJson.tags.filter(Boolean) : undefined,
        // keep raw content for future processing
        markdown: fullMarkdown,
        html: fullHtml,
        screenshot: screenshot,
      });
      if (typeof limit === 'number' && filtered.length >= limit) break;
    }
    
    // Sort to prioritize actual job posting URLs
    filtered.sort((a, b) => {
      if (a.isJobPosting && !b.isJobPosting) return -1;
      if (!a.isJobPosting && b.isJobPosting) return 1;
      return 0;
    });

    // Process and enrich jobs with AI, then save to the database
    console.log('jobs-search.enriching_and_saving', { count: filtered.length, user_id: userId });

    const jobsToInsert = await Promise.all(filtered.map(async (item) => {
      // Enrich with AI
      let aiData;
      try {
        aiData = await generateAiDescription(
          item.html,
          item.markdown,
          item.description,
          item.title || rawQuery
        );
      } catch (e) {
        console.error('jobs-search.ai_enrichment_failed', { error: e.message, url: item.url });
        // Fallback to raw data if AI fails
        aiData = { description: item.description || '', tags: item.tags || [] };
      }

      // Parse deadline if available
      let expiresAt = null;
      if (item.deadline) {
        try {
          const parsed = new Date(item.deadline);
          if (!isNaN(parsed.getTime())) {
            expiresAt = parsed.toISOString();
          }
        } catch {
          // Invalid date, keep as null
        }
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
        title: item.title || rawQuery,
        company: item.company,
        company_logo: item.company_logo || null,
        description: aiData.description,
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
          source: 'firecrawl_search',
          salary: item.salary,
          deadline: item.deadline,
          screenshot: item.screenshot,
          markdown: item.markdown,
          html: item.html,
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
        },
      };
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

    // Note: Enrichment occurs inline (before save) via Firecrawl JSON schema + parsing.

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
