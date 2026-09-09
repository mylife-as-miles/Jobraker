import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  createGeminiClient,
  createGeminiConfig,
  extractGeminiText,
  GEMINI_MODEL,
  withModelFallback,
  runMeteredAiCall,
  formatGeminiErrorMessage,
  isGeminiQuotaError,
  isGeminiTransientProviderError,
} from "../_shared/gemini.ts";

function generateHeuristicFallbackInsights(metrics: any) {
  const { totalApps, applied, interviews, offers, failed, pending, failureReasons, profile } = metrics;
  
  const conversionRate = totalApps > 0 ? Math.round(((interviews + offers) / totalApps) * 100) : 0;
  let executiveSummary = `You have tracked ${totalApps} applications. `;
  if (conversionRate > 20) {
    executiveSummary += `Your interview conversion rate of ${conversionRate}% is strong, indicating good initial alignment.`;
  } else if (totalApps > 10) {
    executiveSummary += `Your conversion rate of ${conversionRate}% suggests room to optimize your resume for your target roles.`;
  } else {
    executiveSummary += `Keep applying to build more data for deeper career insights.`;
  }

  const successFactors = interviews + offers > 0 
    ? ["Your profile is generating interest and passing initial screens."] 
    : [];

  const failureDiagnostics = failureReasons.length > 0
    ? failureReasons.slice(0, 2)
    : (failed > 0 ? ["Some applications were rejected at the initial review stage."] : []);

  const actionableTips = conversionRate < 10 && totalApps > 10
    ? ["Review your resume keywords against typical job descriptions in your target roles."]
    : ["Continue tailoring your resume for each application to maintain strong conversion."];

  const crmNextSteps = pending > 0 
    ? ["Follow up on your pending applications if it has been more than a week."] 
    : ["Find and apply to 3 new roles this week to build pipeline."];
    
  const skillGapAnalysis = profile?.target_roles?.length 
    ? [`Ensure your resume highlights the core skills required for: ${profile.target_roles.join(", ")}.`]
    : [];

  return {
    executiveSummary,
    successFactors,
    failureDiagnostics,
    actionableTips,
    crmNextSteps,
    skillGapAnalysis
  };
}

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

    let parsed = {};
    let isFallback = false;
    let fallbackReason = "";

    try {
      const ai = createGeminiClient();
      const metered = await runMeteredAiCall({
        userId: user.id,
        featureKey: "ai_analytics_insights",
        model: GEMINI_MODEL,
        promptTextLength: prompt.length,
        execute: async () => {
          const { result: rawResponse, modelUsed } = await withModelFallback((model) =>
            ai.models.generateContent({
              model,
              config: createGeminiConfig({
                systemInstruction:
                  "You are an executive AI career coach. Return ONLY valid JSON matching the requested schema.",
                responseMimeType: "application/json",
              }),
              contents: [{ role: "user", parts: [{ text: prompt }] }],
            })
          );
          return {
            result: rawResponse,
            usageMetadata: (rawResponse as any)?.usageMetadata,
            modelUsed,
          };
        },
      });

      const aiText = extractGeminiText(metered.result);
      try {
        parsed = JSON.parse(aiText);
      } catch {
        parsed = { executiveSummary: aiText };
      }
    } catch (providerError) {
      if (isGeminiQuotaError(providerError) || isGeminiTransientProviderError(providerError)) {
        console.warn("[ai-analytics-insights] Gemini provider unavailable, generating heuristic fallback:", providerError);
        parsed = generateHeuristicFallbackInsights({
          totalApps, applied, interviews, offers, failed, pending, failureReasons, profile
        });
        isFallback = true;
        fallbackReason = "Live AI engine temporarily resting. Showing metric-based assessment.";
      } else {
        throw providerError;
      }
    }

    return jsonResponse(req, {
      success: true,
      insights: parsed,
      isFallback,
      fallbackReason,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("ai-analytics-insights error:", error);
    return jsonResponse(
      req,
      { 
        error: formatGeminiErrorMessage(error),
        code: "AI_UNAVAILABLE" 
      },
      500,
    );
  }
});

