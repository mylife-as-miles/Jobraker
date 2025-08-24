import { createClient } from 'npm:@supabase/supabase-js@2';
import FirecrawlApp from 'npm:@mendable/firecrawl-js@0.0.28';
import { corsHeaders, CandidateProfile, JobListing } from '../_shared/types.ts';
import { pipeline } from 'npm:@xenova/transformers';

// Initialize clients and models
const firecrawl = new FirecrawlApp({ apiKey: Deno.env.get('FIRECRAWL_API_KEY')! });
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);
// The model will be downloaded on the first run
const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { resumeText } = await req.json();
    if (!resumeText) throw new Error("Resume text is required.");

    // --- Step 1: Parse Resume Text into a Structured Profile ---
    const profileSchema = {
      "type": "object",
      "properties": {
        "fullName": { "type": "string" },
        "location": { "type": "string" },
        "yearsOfExperience": { "type": "number" },
        "coreSkills": { "type": "array", "items": { "type": "string" } },
        "workExperience": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "jobTitle": { "type": "string" },
              "company": { "type": "string" },
              "responsibilities": { "type": "string" }
            },
            "required": ["jobTitle", "company", "responsibilities"]
          }
        }
      },
      "required": ["fullName", "location", "yearsOfExperience", "coreSkills", "workExperience"]
    };
    const { data: candidateProfile } = await firecrawl.extract({
      url: `data:text/plain;base64,${btoa(resumeText)}`,
      extractionSchema: profileSchema,
    }) as { data: CandidateProfile };

    // --- Step 2: Crawl and Scrape for New Jobs ---
    const primaryJobTitle = candidateProfile.workExperience[0]?.jobTitle || "Software Engineer";
    const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(primaryJobTitle)}&location=Remote`;

    const crawlResult = await firecrawl.crawl({ url: searchUrl, crawlerOptions: { limit: 15, includes: ['/jobs/view/'] } });
    const jobUrls = crawlResult.map(item => item.url).filter(Boolean);

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

        const jobsToEmbed = scrapeResults
            .filter(res => res.success && res.data)
            .map(res => ({ ...res.data, sourceUrl: res.url })) as JobListing[];

        for (const job of jobsToEmbed) {
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

    // --- Step 3: Create a Query Embedding from the User's Profile ---
    const experienceSummary = candidateProfile.workExperience
      .map(exp => `${exp.jobTitle} at ${exp.company}. ${exp.responsibilities}`)
      .join(' ');
    const query = `${candidateProfile.coreSkills.join(', ')}. ${experienceSummary}`;
    const queryOutput = await extractor(query, { pooling: 'mean', normalize: true });
    const queryEmbedding = Array.from(queryOutput.data);

    // --- Step 4: Find Matching Jobs using Vector Search ---
    const { data: matchedJobs, error } = await supabaseAdmin.rpc('match_jobs', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5, // Adjust as needed
      match_count: 50,
    });

    if (error) throw error;

    // --- Step 5: Return the results ---
    return new Response(JSON.stringify({ matchedJobs, candidateProfile }), {
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
