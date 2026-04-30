import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createGeminiClient,
  GEMINI_MODEL,
  createGeminiConfig,
  extractGeminiText,
  getGeminiAccessDeniedMessage,
  isGeminiAccessDeniedError,
} from "../_shared/gemini.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  SubscriptionAccessError,
  requireSubscriptionTier,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";
import {
  createEmptyCandidateMemory,
  fetchCandidateMemory,
  formatCandidateMemoryForPrompt,
} from "../_shared/candidate-memory.ts";

function buildPrompt(
  jobDescription: string,
  resumeText: string,
  candidateMemory: string,
  instructions?: string,
): string {
  return `You are an expert executive resume writer. 
  
  Your task is to tailor the candidate's existing resume to perfectly align with the target job description.

  CANDIDATE MEMORY:
  """
  ${candidateMemory}
  """
  
  JOB DESCRIPTION:
  """
  ${jobDescription}
  """

  CANDIDATE'S EXISTING RESUME:
  """
  ${resumeText}
  """

  ${instructions ? `ADDITIONAL INSTRUCTIONS:\n  """\n  ${instructions}\n  """\n` : ''}

  REQUIREMENTS:
  1. Rewrite the professional summary to highlight the most relevant skills for this specific job.
  2. Rewrite experience bullet points to emphasize relevant achievements and use keywords from the job description.
  3. Ensure all changes are truthful. Do NOT invent new jobs, degrees, or years of experience.
  4. Output the result in clean, structured Markdown format (e.g., using # for Name/Header, ## for Experience, Education, Skills, etc.).
  5. The output must be the complete, tailored resume content ready to be read by an ATS or recruiter.
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { user, serviceClient } = await requireSubscriptionTier(req, "Basics", "AI resume optimization");
    const {
      jobDescription,
      resumeText,
      instructions,
      includeCandidateMemory = true,
    } = await req.json();

    if (!jobDescription || !resumeText) {
      return new Response(JSON.stringify({ error: "jobDescription and resumeText are required" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    let candidateMemory = createEmptyCandidateMemory();
    if (includeCandidateMemory !== false) {
      try {
        candidateMemory = await fetchCandidateMemory(serviceClient, user.id);
      } catch (candidateMemoryError) {
        console.error(
          "Failed to fetch candidate memory for resume tailoring",
          candidateMemoryError,
        );
      }
    }
    const prompt = buildPrompt(
      jobDescription,
      resumeText,
      formatCandidateMemoryForPrompt(candidateMemory),
      instructions,
    );

    let tailoredResume = resumeText.trim();
    try {
      const ai = createGeminiClient();
      const result = await ai.models.generateContent({
        model: GEMINI_MODEL,
        config: createGeminiConfig({
          systemInstruction:
            "You are an expert resume writer. Return ONLY the tailored resume in clean markdown format.",
          responseMimeType: "text/plain",
        }),
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const text = extractGeminiText(result);
      if (!text) throw new Error("Empty response from AI");
      tailoredResume = text.trim();
    } catch (error: any) {
      console.error("tailor-resume falling back", error);
      if (isGeminiAccessDeniedError(error)) {
        console.warn(getGeminiAccessDeniedMessage("AI resume optimization"));
      }
    }

    return new Response(JSON.stringify({ tailored_resume: tailoredResume }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error: any) {
    if (error instanceof SubscriptionAccessError) {
      return subscriptionErrorResponse(error, corsHeaders);
    }
    console.error("Error in tailor-resume:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
