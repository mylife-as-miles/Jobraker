import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createGeminiClient, GEMINI_MODEL, createGeminiConfig } from "../_shared/gemini.ts";
import { corsHeaders } from "../_shared/cors.ts";

function buildPrompt(jobDescription: string, resumeText: string, instructions?: string): string {
  return `You are an expert career coach and professional copywriter writing a highly persuasive cover letter.
  
  Please write a tailored cover letter for the following job using the candidate's resume as source material.
  
  JOB DESCRIPTION:
  """
  ${jobDescription}
  """

  CANDIDATE'S RESUME:
  """
  ${resumeText}
  """

  ${instructions ? `ADDITIONAL INSTRUCTIONS:\n  """\n  ${instructions}\n  """\n` : ''}

  REQUIREMENTS:
  1. The letter should be exactly 3-4 paragraphs long.
  2. Maintain a professional, confident, yet humble tone.
  3. Directly connect the candidate's past experiences and metrics from the resume to the core needs expressed in the job description.
  4. Do NOT include placeholder bracketed text like "[Company Name]" if you know it, or just use generic phrasing if the company name isn't provided. 
  5. The output should be raw plain text (no markdown formatting, no JSON escaping) representing the final cover letter body. Do not include a header with name/address unless it's naturally part of the text body. Start with a greeting (e.g., "Dear Hiring Manager,").
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { jobDescription, resumeText, instructions } = await req.json();

    if (!jobDescription || !resumeText) {
      return new Response(JSON.stringify({ error: "jobDescription and resumeText are required" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const ai = createGeminiClient();
    const prompt = buildPrompt(jobDescription, resumeText, instructions);

    const result = await ai.models.generateContent({
        model: GEMINI_MODEL,
        config: createGeminiConfig({ 
            systemInstruction: "You are an expert cover letter writer. Return ONLY the plain text of the cover letter.",
        }),
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });

    const text = result.text();
    if (!text) throw new Error("Empty response from AI");
    
    return new Response(JSON.stringify({ cover_letter: text.trim() }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error: any) {
    console.error("Error in generate-cover-letter:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
