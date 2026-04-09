
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createGeminiClient, GEMINI_MODEL, createGeminiConfig } from "../_shared/gemini.ts";
import { corsHeaders } from "../_shared/types.ts";

interface ResumeAnalysisRequest {
  resumeText: string;
  profileSummary: string;
  resumeId?: string;
}

interface ResumeAnalysisResult {
  overallScore: number;
  alignmentScore: number;
  atsScore: number;
  readabilityScore: number;
  jobFitLikelihood: number;
  grade: string;
  summary: string;
  strengths: string[];
  gaps: string[];
  recommendations: Array<{
    focus: string;
    action: string;
    impact?: string | null;
  }>;
  atsRiskNarrative?: string | null;
  metadata?: {
    resumeExcerpt?: string;
  } | null;
}

const JSON_FAILSAFE: ResumeAnalysisResult = {
  overallScore: 0,
  alignmentScore: 0,
  atsScore: 0,
  readabilityScore: 0,
  jobFitLikelihood: 0,
  grade: "N/A",
  summary: "Analysis unavailable.",
  strengths: [],
  gaps: [],
  recommendations: [],
  atsRiskNarrative: null,
  metadata: null,
};

function buildPromptBody(resumeText: string, profileSummary: string) {
  return `You are JobRaker's Resume Intelligence model. Examine the provided resume content in detail and evaluate it against the candidate profile snapshot. Identify strengths, gaps, and risks that could impact Applicant Tracking Systems (ATS) scoring or recruiter perception.

Required output JSON schema:
{
  "overall_score": number (0-100, holistic resume quality),
  "alignment_score": number (0-100, alignment to target profile/goals),
  "ats_score": number (0-100, ATS friendliness),
  "readability_score": number (0-100, human readability/clarity),
  "job_fit_likelihood": number (0-100 probability of securing interviews for aligned roles),
  "grade": string (A+, A, B+, B, C, D, F),
  "summary": string (3-4 sentence executive summary),
  "strengths": string[] (max 6),
  "gaps": string[] (max 6, prioritize critical weaknesses),
  "recommendations": [{ "focus": string, "action": string, "impact": string }],
  "ats_risk_narrative": string | null,
  "metadata": { "resume_excerpt": string } | null
}

Rules:
- Use concise business language.
- Tailor every insight to the resume provided; avoid generic career advice.
- Reference profile data when explaining alignment or risk.
- Highlight quantified wins to keep if they already exist; otherwise note missing metrics.
- Grade must correlate with overall_score.
- Keep recommendations actionable and sorted by impact.

<profile>
${profileSummary}
</profile>

<resume>
${resumeText}
</resume>`;
}

function toResult(raw: any): ResumeAnalysisResult {
  if (!raw || typeof raw !== "object") return JSON_FAILSAFE;
  const num = (val: any) => {
    const parsed = Number(val);
    if (Number.isFinite(parsed)) return Math.max(0, Math.min(100, Math.round(parsed)));
    return 0;
  };
  const arr = (val: any) => Array.isArray(val) ? val.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()) : [];
  const recs = Array.isArray(raw.recommendations)
    ? raw.recommendations
        .map((item: any) => ({
          focus: String(item?.focus || item?.area || ""),
          action: String(item?.action || item?.recommendation || ""),
          impact: item?.impact ? String(item.impact) : null,
        }))
        .filter((item: any) => item.focus.trim() || item.action.trim())
    : [];

  const grade = typeof raw.grade === "string" ? raw.grade.trim() : "N/A";

  return {
    overallScore: num(raw.overall_score ?? raw.score ?? raw.overallScore),
    alignmentScore: num(raw.alignment_score ?? raw.match_score ?? raw.alignmentScore),
    atsScore: num(raw.ats_score ?? raw.atsScore),
    readabilityScore: num(raw.readability_score ?? raw.readabilityScore),
    jobFitLikelihood: num(raw.job_fit_likelihood ?? raw.interview_odds ?? raw.jobFitLikelihood),
    grade: grade || "N/A",
    summary: typeof raw.summary === "string" ? raw.summary.trim() : JSON_FAILSAFE.summary,
    strengths: arr(raw.strengths),
    gaps: arr(raw.gaps ?? raw.weaknesses),
    recommendations: recs,
    atsRiskNarrative: typeof raw.ats_risk_narrative === "string" ? raw.ats_risk_narrative.trim() : null,
    metadata: raw.metadata && typeof raw.metadata === "object" ? {
      resumeExcerpt: typeof raw.metadata.resume_excerpt === "string" ? raw.metadata.resume_excerpt : undefined,
    } : null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { resumeText, profileSummary, resumeId }: ResumeAnalysisRequest = await req.json();

    if (!resumeText || !profileSummary) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: resumeText, profileSummary" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ai = createGeminiClient();
    const systemPrompt = "You are JobRaker's resume intelligence engine. Always reply with structured JSON matching the requested schema.";
    const userPrompt = buildPromptBody(resumeText.slice(0, 15000), profileSummary);

    const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        config: createGeminiConfig({ systemInstruction: systemPrompt }),
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }]
    });

    const content = (typeof response.text === 'function' ? response.text() : response.text);
    if (!content) throw new Error("Invalid response from Gemini (empty)");

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err: any) {
      throw new Error(`Failed to parse analysis JSON: ${err?.message || err}`);
    }

    const result = toResult(parsed);

    // Optionally log the analysis to database
    if (resumeId && user.id) {
      try {
        await supabase.from("resume_analyses").insert({
          user_id: user.id,
          resume_id: resumeId,
          overall_score: result.overallScore,
          alignment_score: result.alignmentScore,
          ats_score: result.atsScore,
          readability_score: result.readabilityScore,
          job_fit_likelihood: result.jobFitLikelihood,
          grade: result.grade,
          summary: result.summary,
          strengths: result.strengths,
          gaps: result.gaps,
          recommendations: result.recommendations,
          ats_risk_narrative: result.atsRiskNarrative,
          created_at: new Date().toISOString(),
        }).select().single();
      } catch (logError) {
        console.warn("Failed to log analysis to database:", logError);
      }
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in analyze-resume function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
