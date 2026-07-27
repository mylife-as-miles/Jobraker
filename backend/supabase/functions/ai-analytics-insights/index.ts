import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createGeminiClient, GEMINI_MODEL, withGeminiRetry } from "../_shared/gemini.ts";

function jsonResponse(req: Request, data: Record<string, unknown>, status = 200) {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return jsonResponse(req, { ok: true });
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader) {
    return jsonResponse(req, { error: "Missing Authorization header" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(req, { error: "Supabase configuration missing" }, 500);
  }

  try {
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Fetch user applications
    const { data: apps, error: appsErr } = await serviceClient
      .from("applications")
      .select("id, job_title, company, status, canonical_stage, applied_date, match_score, failure_reason, notes, location, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (appsErr) throw appsErr;

    // Fetch candidate resume / profile summary
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("first_name, last_name, bio, target_roles, skills, base_resume_text")
      .eq("id", user.id)
      .maybeSingle();

    const applicationList = apps || [];
    const totalApps = applicationList.length;
    const applied = applicationList.filter((a) => a.status === "Applied" || a.canonical_stage === "submitted").length;
    const interviews = applicationList.filter((a) => a.status === "Interview" || a.canonical_stage === "interview").length;
    const offers = applicationList.filter((a) => a.status === "Offer" || a.canonical_stage === "offer").length;
    const failed = applicationList.filter((a) => a.status === "Failed" || a.status === "Rejected" || a.canonical_stage === "failed" || a.canonical_stage === "rejected").length;
    const pending = applicationList.filter((a) => a.status === "Pending" || a.status === "Draft" || a.canonical_stage === "queued").length;

    const failureReasons = applicationList
      .filter((a) => a.failure_reason)
      .map((a) => `${a.company} (${a.job_title}): ${a.failure_reason}`);

    const prompt = `You are an executive AI career strategist, talent intelligence lead, and CRM coach.
Analyze the candidate's job application performance data below and provide deep, hyper-personalized, actionable career insights and diagnostic guidance.

## Candidate Overview
- Target Roles: ${profile?.target_roles?.join(", ") || "General Professional"}
- Top Skills: ${profile?.skills?.join(", ") || "Not specified"}
- Bio: ${profile?.bio || "Not specified"}

## Application Metrics
- Total Applications Tracked: ${totalApps}
- Applied / Submitted: ${applied}
- Pending / Review: ${pending}
- Interviews Landed: ${interviews}
- Offers Received: ${offers}
- Failed / Rejected: ${failed}
- Success / Conversion Rate: ${totalApps > 0 ? Math.round(((interviews + offers) / totalApps) * 100) : 0}%

## Recorded Failure / Rejection Diagnostics
${failureReasons.length > 0 ? failureReasons.join("\n") : "No specific failure logs recorded."}

## Recent Application Samples
${JSON.stringify(applicationList.slice(0, 15), null, 2)}

Provide your strategic evaluation in JSON format with the exact following schema:
{
  "executiveSummary": "Short 2-3 sentence strategic executive diagnosis of their job search performance.",
  "successFactors": [
    "Key reason why high-match applications or interviews are succeeding",
    "Pattern found in successful company targets"
  ],
  "failureDiagnostics": [
    "Root cause diagnosis of why applications stall or get rejected",
    "Bottleneck identified in resume or application timing"
  ],
  "actionableTips": [
    "Specific resume/bullet modification tip to boost conversion",
    "Strategy tip for networking or follow-ups",
    "ATS optimization recommendation"
  ],
  "crmNextSteps": [
    "Immediate CRM action 1 for pending roles",
    "Immediate CRM action 2 for interview prep or follow-up"
  ],
  "skillGapAnalysis": [
    "In-demand skill identified from target roles that is underrepresented",
    "Recommended certification or portfolio keyword to highlight"
  ]
}`;

    const gemini = createGeminiClient();
    const model = gemini.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: { responseMimeType: "application/json" },
    });

    const aiResult = await withGeminiRetry(async () => {
      const res = await model.generateContent(prompt);
      return res.response.text();
    });

    let parsed = {};
    try {
      parsed = JSON.parse(aiResult);
    } catch {
      parsed = { executiveSummary: aiResult };
    }

    return jsonResponse(req, {
      success: true,
      insights: parsed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("ai-analytics-insights error:", error);
    return jsonResponse(
      req,
      { error: error instanceof Error ? error.message : "Failed to generate AI analytics insights" },
      500,
    );
  }
});
