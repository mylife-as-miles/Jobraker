import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createGeminiClient, GEMINI_MODEL, createGeminiConfig } from "../_shared/gemini.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  SubscriptionAccessError,
  requireSubscriptionTier,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";

interface EvaluateJobFitRequest {
  jobDescription: string;
  profileSnapshot: string;
  resumeText: string;
}

interface EvaluateJobFitResponse {
  confidence_score: number;
  missing_requirements: string[];
  tailoring_suggestions: string[];
  matched_keywords: string[];
}

const JSON_FAILSAFE: EvaluateJobFitResponse = {
  confidence_score: 50,
  missing_requirements: [],
  tailoring_suggestions: [],
  matched_keywords: [],
};

const buildPromptBody = (jobDescription: string, profileSnapshot: string, resumeText: string) => `
You are JobRaker's AI Decision Boundary Engine. You evaluate if it is safe and appropriate to autonomously apply to a given job based on the user's profile and resume.

Required output JSON schema:
{
  "confidence_score": number (0-100, indicating your confidence in the feasibility and match quality of an application. >70 is considered auto-apply safe),
  "missing_requirements": string[] (Array of strict, non-negotiable job requirements that the user clearly lacks. For example, "Requires active Secret Clearance", "Must reside in New York, NY", "Requires portfolio URL". If none, return empty array. Only list absolute dealbreakers, not "nice-to-haves"),
  "tailoring_suggestions": string[] (Array of conversational, actionable suggestions to improve the resume or profile for this specific job. E.g., "This job emphasizes 'React Native'. Your resume only says 'React'. Should we highlight mobile experience?"),
  "matched_keywords": string[] (Array of specific skills, keywords, or technologies that overlap between the job requirements and the user's profile/resume)
}

Rule: If missing_requirements has items, confidence_score should generally be lower (e.g., < 70).

<profile>
${profileSnapshot}
</profile>

<resume>
${resumeText}
</resume>

<job_description>
${jobDescription}
</job_description>
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    await requireSubscriptionTier(req, "Basics", "Auto apply");

    const { jobDescription, profileSnapshot, resumeText }: EvaluateJobFitRequest = await req.json();

    if (!jobDescription) {
      return new Response(
        JSON.stringify({ error: "Missing required field: jobDescription" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ai = createGeminiClient();
    const systemPrompt = "You are JobRaker's AI Decision Boundary Engine. Always reply with structured JSON matching the requested schema. Be strict about missing_requirements, only including true dealbreakers.";
    const userPrompt = buildPromptBody(
      jobDescription.slice(0, 15000), 
      profileSnapshot || "No profile provided.", 
      resumeText?.slice(0, 15000) || "No resume provided."
    );

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

    const result: EvaluateJobFitResponse = {
      confidence_score: typeof parsed.confidence_score === "number" ? parsed.confidence_score : JSON_FAILSAFE.confidence_score,
      missing_requirements: Array.isArray(parsed.missing_requirements) ? parsed.missing_requirements : JSON_FAILSAFE.missing_requirements,
      tailoring_suggestions: Array.isArray(parsed.tailoring_suggestions) ? parsed.tailoring_suggestions : JSON_FAILSAFE.tailoring_suggestions,
      matched_keywords: Array.isArray(parsed.matched_keywords) ? parsed.matched_keywords : JSON_FAILSAFE.matched_keywords,
    };

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    if (error instanceof SubscriptionAccessError) {
      return subscriptionErrorResponse(error, corsHeaders);
    }
    console.error("Error in evaluate-job-fit function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
