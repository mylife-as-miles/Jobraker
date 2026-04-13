
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createGeminiClient, GEMINI_MODEL, createGeminiConfig, extractGeminiText } from "../_shared/gemini.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
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
- Generate a professional "About" summary (2-3 sentences).
- Extract a list of the 12-20 most relevant Skills.
- Extract Education history (School, Degree, Start Year, End Year).
- Extract Experience history (Company, Title, Location, Start Date YYYY-MM, End Date YYYY-MM or "Present", and a concise 1-2 sentence description).

RESUME CONTENT:
${resumeText}

Return ONLY valid JSON.`;
}

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractJsonCandidate(text: string): string {
  const cleaned = stripCodeFences(text);
  const objectStart = cleaned.indexOf("{");
  const objectEnd = cleaned.lastIndexOf("}");

  if (objectStart !== -1 && objectEnd > objectStart) {
    return cleaned.slice(objectStart, objectEnd + 1);
  }

  return cleaned;
}

function parseGeminiJson(text: string) {
  const candidates = [stripCodeFences(text), extractJsonCandidate(text)];
  const tried = new Set<string>();

  for (const candidate of candidates) {
    if (!candidate || tried.has(candidate)) continue;
    tried.add(candidate);
    try {
      return JSON.parse(candidate);
    } catch {
      // try the next cleanup strategy
    }
  }

  throw new SyntaxError("Unable to parse structured JSON response.");
}

async function repairMalformedJson(ai: ReturnType<typeof createGeminiClient>, text: string) {
  const repairPrompt = `Repair the malformed JSON below and return ONLY valid JSON that matches this schema:
${JSON.stringify(PARSING_SCHEMA, null, 2)}

Malformed JSON:
${text.slice(0, 14000)}`;

  const repaired = await ai.models.generateContent({
    model: GEMINI_MODEL,
    config: createGeminiConfig({
      systemInstruction:
        "You repair malformed JSON. Return only valid JSON with no commentary.",
      includeTools: false,
      thinkingLevel: "LOW",
    }),
    contents: [{ role: "user", parts: [{ text: repairPrompt }] }],
  });

  const repairedText = extractGeminiText(repaired);
  if (!repairedText) throw new Error("Empty response while repairing JSON.");
  return repairedText;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    await requireAuthenticatedUser(req);

    const { resumeText } = (await req.json()) as ParseResumeRequest;
    if (!resumeText) {
      return new Response(JSON.stringify({ error: "resumeText is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ai = createGeminiClient();
    const prompt = buildPrompt(resumeText.slice(0, 30000));

    const result = await ai.models.generateContent({
        model: GEMINI_MODEL,
        config: createGeminiConfig({
          systemInstruction: "You are a resume parser. Return only valid JSON.",
          includeTools: false,
          thinkingLevel: "LOW",
        }),
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });

    const text = extractGeminiText(result);
    if (!text) throw new Error("Empty response from AI");

    let parsed: unknown;
    try {
      parsed = parseGeminiJson(text);
    } catch (parseError) {
      console.warn("parse-resume initial JSON parse failed, attempting repair", parseError);
      const repairedText = await repairMalformedJson(ai, text);
      parsed = parseGeminiJson(repairedText);
    }

    return new Response(JSON.stringify(parsed), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    if (error instanceof SubscriptionAccessError) {
      return subscriptionErrorResponse(error, corsHeaders);
    }
    console.error("Error in parse-resume:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
