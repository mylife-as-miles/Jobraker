
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createGeminiClient,
  GEMINI_MODEL,
  createGeminiConfig,
  extractGeminiText,
  withGeminiRetry,
} from "../_shared/gemini.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { parseStructuredJson } from "../_shared/structured-json.ts";
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
    },
    projects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          organization: { type: "string" },
          date: { type: "string" },
          description: { type: "string" }
        },
        required: ["name", "description"]
      }
    },
    certifications: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          issuer: { type: "string" },
          date: { type: "string" },
          description: { type: "string" }
        },
        required: ["name"]
      }
    }
  },
  required: ["firstName", "lastName", "email", "jobTitle", "about", "skills", "education", "experience"]
};

function buildPrompt(resumeText: string): string {
  return `You are a lossless resume/CV parser. Your task is to extract structured profile data while preserving the candidate's original detail.

Extract into the following JSON structure:
${JSON.stringify(PARSING_SCHEMA, null, 2)}

Requirements:
- Extract First Name, Last Name, Email, Phone, Location.
- Determine the current/most recent Job Title.
- Calculate total Years of Experience.
- For "about": preserve the candidate's existing professional summary/profile if present. If there is no summary, write a brief 2-3 sentence overview, but do not omit concrete domains, leadership scope, metrics, certifications, or major tools found in the CV.
- Extract all clearly stated Skills, tools, technologies, languages, certifications, and domain keywords. Do not cap the list at 20 when the CV contains more relevant skills.
- Extract Education history (School, Degree, Start Year, End Year).
- Extract the full Experience history in reverse chronological order.
- Extract Projects and Certifications when present instead of folding them into summary text.
- For each experience.description, preserve the vital details from that role: responsibilities, achievements, metrics, customers/industries, tools, leadership scope, and named initiatives.
- Do not compress a role to 1-2 generic sentences. Use newline-separated bullet-like lines inside the description string when the source has multiple bullets.
- Never drop older roles, extra bullets, metrics, or technical/domain keywords merely to make the output shorter.
- Keep dates as written when month precision is unavailable. Use End Date "Present" only when the CV indicates the role is current.

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
  try {
    return parseStructuredJson(text);
  } catch {
    return parseStructuredJson(extractJsonCandidate(text));
  }
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
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);

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
    const prompt = buildPrompt(resumeText.slice(0, 60000));

    const result = await withGeminiRetry(() => ai.models.generateContent({
        model: GEMINI_MODEL,
        config: createGeminiConfig({
          systemInstruction: "You are a lossless resume parser. Extract, preserve detail, and return only valid JSON.",
          responseMimeType: "application/json",
          includeTools: false,
          thinkingLevel: "LOW",
        }),
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
    }));

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
