// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/types.ts';
import { parseSalaryRangeToMinMax, inferSalaryMeta } from '../_shared/salary.ts';
import { resolveFirecrawlApiKey } from '../_shared/firecrawl.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
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

    const { jobId, searchQuery, searchLocation } = await req.json();

    if (!jobId) {
      return new Response(JSON.stringify({ error: 'jobId is required' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    const firecrawlApiKey = await resolveFirecrawlApiKey(supabaseAdmin, userId);

    // Per the Firecrawl API documentation, checking the status of a job
    // must be done via a GET request.
    const statusRes = await fetch(`https://api.firecrawl.dev/v2/extract/${jobId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${firecrawlApiKey}` },
    });

    if (!statusRes.ok) {
      const errorText = await statusRes.text();
      console.error('firecrawl.extract_status_check_failed', { jobId, status: statusRes.status, error: errorText });
      return new Response(JSON.stringify({ error: 'Failed to check job status', detail: errorText }), { status: statusRes.status, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    const extractStatus = await statusRes.json();

    let jobsInserted = 0;
    if (extractStatus.status === 'completed') {
      const extractedJobs = extractStatus.data?.jobs || [];
      console.info('firecrawl.extract_complete', { userId, jobId, jobs_found: extractedJobs.length });

      if (extractedJobs.length > 0) {
        const jobsToInsert = extractedJobs.map((job) => {
          const salaryText = job.salaryRange || job.fullJobDescription || '';
          const { min: salary_min, max: salary_max } = parseSalaryRangeToMinMax(salaryText);
          const meta = inferSalaryMeta(salaryText);
          return {
            user_id: userId,
            source_type: 'agentic_extract',
            source_id: job.applyUrl || `agentic-${jobId}-${Math.random()}`,
            title: job.jobTitle,
            company: job.companyName,
            description: job.fullJobDescription,
            location: job.location,
            remote_type: job.workType,
            apply_url: job.applyUrl,
            posted_at: job.postedDate ? new Date(job.postedDate).toISOString() : new Date().toISOString(),
            status: 'active',
            raw_data: { ...job, _search_query: searchQuery, _search_location: searchLocation },
            salary_min,
            salary_max,
            salary_currency: meta.currency || (salary_min || salary_max ? 'USD' : null),
          };
        });

        const { data: upData, error: insertError } = await supabaseAdmin.from('jobs').upsert(jobsToInsert, { onConflict: 'user_id,source_id' }).select('id');
        if (insertError) {
          throw new Error(`Failed to insert new jobs: ${insertError.message}`);
        }
        jobsInserted = Array.isArray(upData) ? upData.length : extractedJobs.length;
      }
    }

    return new Response(JSON.stringify({ ...extractStatus, jobsInserted }), {
      status: 200,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });

  } catch (error) {
    console.error('get-extract-status error:', error.message);
    return new Response(JSON.stringify({ error: error.message || 'An unexpected error occurred.' }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});