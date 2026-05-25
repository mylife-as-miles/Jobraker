import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createGeminiClient,
  GEMINI_MODEL,
  createGeminiConfig,
  extractGeminiText,
  getGeminiAccessDeniedMessage,
  isGeminiAccessDeniedError,
  withModelFallback,
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
import {
  fetchAnswerBankEntries,
  formatAnswerBankForPrompt,
} from "../_shared/answer-bank.ts";
import {
  enforceFeatureRateLimit,
  recordFeatureUsage,
} from "../_shared/feature-limits.ts";

function buildPrompt(
  jobDescription: string,
  resumeText: string,
  candidateMemory: string,
  answerBank: string | null,
  instructions?: string,
): string {
  return `You are an expert executive resume writer. 
  
  Your task is to tailor the candidate's existing resume to perfectly align with the target job description.

  CANDIDATE MEMORY:
  """
  ${candidateMemory}
  """

  ANSWER BANK:
  """
  ${answerBank || "None"}
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
    const { user, serviceClient, subscriptionTier } = await requireSubscriptionTier(req, "Basics", "AI resume optimization");
    await enforceFeatureRateLimit({
      userId: user.id,
      featureKey: "tailor_resume",
      serviceClient,
      subscriptionTier,
    });
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
    const answerBankEntries = await fetchAnswerBankEntries(serviceClient, user.id, {
      limit: 10,
    }).catch(() => []);
    const prompt = buildPrompt(
      jobDescription,
      resumeText,
      formatCandidateMemoryForPrompt(candidateMemory),
      formatAnswerBankForPrompt(answerBankEntries, 10),
      instructions,
    );

    let tailoredResume = resumeText.trim();
    try {
      const ai = createGeminiClient();
      const { result } = await withModelFallback(
        (model) => ai.models.generateContent({
          model,
          config: createGeminiConfig({
            systemInstruction:
              "You are an expert resume writer. Return ONLY the tailored resume in clean markdown format.",
            responseMimeType: "text/plain",
          }),
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        }),
      );

      const text = extractGeminiText(result);
      if (!text) throw new Error("Empty response from AI");
      tailoredResume = text.trim();
    } catch (error: any) {
      console.error("tailor-resume falling back", error);
      if (isGeminiAccessDeniedError(error)) {
        console.warn(getGeminiAccessDeniedMessage("AI resume optimization"));
      }
    }

    await recordFeatureUsage({
      userId: user.id,
      featureKey: "tailor_resume",
      serviceClient,
      subscriptionTier,
      metadata: {
        job_description_length: String(jobDescription).length,
        resume_length: String(resumeText).length,
      },
    });

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
