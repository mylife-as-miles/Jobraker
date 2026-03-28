
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createGeminiClient, GEMINI_MODEL, createGeminiConfig, extractGeminiText } from "../_shared/gemini.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  SubscriptionAccessError,
  requireAuthenticatedUser,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";

interface ParseResumeRequest {
  resumeText: string;
}

const PARSING_SCHEMA = {
  type: "object",
  properties: {
    firstName: { type: "string" },
    lastName: { type: "string" },
    email: { type: "string" },
    phone: { type: "string" },
    location: { type: "string" },
    jobTitle: { type: "string" },
    experienceYears: { type: "number", nullable: true },
    about: { type: "string" },
    skills: { type: "array", items: { type: "string" } },
    education: {
      type: "array",
      items: {
        type: "object",
        properties: {
          school: { type: "string" },
          degree: { type: "string" },
          start: { type: "string" },
          end: { type: "string" }
        },
        required: ["school", "degree"]
      }
    },
    experience: {
      type: "array",
      items: {
        type: "object",
        properties: {
          company: { type: "string" },
          title: { type: "string" },
          location: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
          description: { type: "string" }
        },
        required: ["company", "title", "description"]
      }
    }
  },
  required: ["firstName", "lastName", "email", "jobTitle", "about", "skills", "education", "experience"]
};

function buildPrompt(resumeText: string): string {
  return `You are an elite AI career analyst and resume parser. Your task is to perform deep analysis of the resume and extract ALL structured profile data.

Extract into the following JSON structure:
${JSON.stringify(PARSING_SCHEMA, null, 2)}

Requirements:
- Extract First Name, Last Name, Email, Phone, Location.
- Determine the current/most recent Job Title.
- Calculate total Years of Experience.
- Generate a professional "About" summary (3-4 sentences).
- Extract a list of Skills (20-40 items).
- Extract Education history (School, Degree, Start Year, End Year).
- Extract Experience history (Company, Title, Location, Start Date YYYY-MM, End Date YYYY-MM or "Present", and a 2-3 sentence description).

RESUME CONTENT:
${resumeText}

Return ONLY valid JSON.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    await requireAuthenticatedUser(req);

    const { resumeText } = await req.json();
    if (!resumeText) {
      return new Response(JSON.stringify({ error: "resumeText is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ai = createGeminiClient();
    const prompt = buildPrompt(resumeText.slice(0, 30000));

    const result = await ai.models.generateContent({
        model: GEMINI_MODEL,
        config: createGeminiConfig({ systemInstruction: "You are a resume parser. Return only JSON." }),
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });

    const text = extractGeminiText(result);
    if (!text) throw new Error("Empty response from AI");
    
    const parsed = JSON.parse(text);
    return new Response(JSON.stringify(parsed), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    if (error instanceof SubscriptionAccessError) {
      return subscriptionErrorResponse(error, corsHeaders);
    }
    console.error("Error in parse-resume:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
