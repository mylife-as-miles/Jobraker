
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createGeminiClient,
  GEMINI_MODEL,
  createGeminiConfig,
  extractGeminiText,
  withGeminiRetry,
  withModelFallback,
} from "../_shared/gemini.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { parseStructuredJson } from "../_shared/structured-json.ts";
import {
  SubscriptionAccessError,
  requireAuthenticatedUser,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";
import {
  enforceFeatureRateLimit,
  recordFeatureUsage,
} from "../_shared/feature-limits.ts";

interface ParseResumeRequest {
  resumeText?: string;
  pdfBase64?: string;
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

  const { result: repaired } = await withModelFallback(
    (model) => ai.models.generateContent({
      model,
      config: createGeminiConfig({
        systemInstruction:
          "You repair malformed JSON. Return only valid JSON with no commentary.",
        includeTools: false,
        thinkingLevel: "LOW",
      }, model),
      contents: [{ role: "user", parts: [{ text: repairPrompt }] }],
    }),
  );

  const repairedText = extractGeminiText(repaired);
  if (!repairedText) throw new Error("Empty response while repairing JSON.");
  return repairedText;
}

async function extractTextFromPdf(pdfBytes: Uint8Array): Promise<string> {
  let extractedText = "";
  
  // Try unpdf first (very fast, modern, and edge-compatible)
  try {
    console.log("Attempting PDF extraction using unpdf...");
    const { getDocumentProxy, extractText } = await import("npm:unpdf");
    const pdf = await getDocumentProxy(pdfBytes);
    const result = await extractText(pdf);
    extractedText = result.text;
    console.log(`unpdf extraction successful, extracted ${extractedText.length} characters`);
  } catch (unpdfError) {
    console.warn("unpdf extraction failed:", unpdfError);
  }
  
  // If unpdf failed or returned empty, try pdf.js-extract
  if (!extractedText || !extractedText.trim()) {
    try {
      console.log("Attempting PDF extraction using pdf.js-extract...");
      const { PDFExtract } = await import("npm:pdf.js-extract");
      const { Buffer } = await import("node:buffer");
      const nodeBuffer = Buffer.from(pdfBytes);
      const pdfExtract = new PDFExtract();
      
      const resultText = await new Promise<string>((resolve, reject) => {
        pdfExtract.extractBuffer(nodeBuffer, {}, (err: any, data: any) => {
          if (err) return reject(err);
          if (!data || !data.pages) return reject(new Error("No pages found"));
          
          let fullText = "";
          for (const page of data.pages) {
            const content = page.content || [];
            const linesMap: Record<number, typeof content> = {};
            for (const item of content) {
              const y = Math.round(item.y);
              let foundKey = Object.keys(linesMap).find(k => Math.abs(Number(k) - y) <= 4);
              if (foundKey) {
                linesMap[Number(foundKey)].push(item);
              } else {
                linesMap[y] = [item];
              }
            }
            
            const sortedY = Object.keys(linesMap).map(Number).sort((a, b) => a - b);
            let pageText = "";
            for (const y of sortedY) {
              const items = linesMap[y];
              items.sort((a, b) => a.x - b.x);
              const lineText = items.map(it => it.str).join(" ");
              if (lineText.trim()) {
                pageText += lineText + "\n";
              }
            }
            fullText += pageText + "\n";
          }
          resolve(fullText.trim());
        });
      });
      extractedText = resultText;
      console.log(`pdf.js-extract extraction successful, extracted ${extractedText.length} characters`);
    } catch (pdfExtractError) {
      console.warn("pdf.js-extract extraction failed:", pdfExtractError);
    }
  }
  
  if (!extractedText || !extractedText.trim()) {
    throw new Error("Could not extract text from PDF using unpdf or pdf.js-extract.");
  }
  
  return extractedText;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { user, serviceClient } = await requireAuthenticatedUser(req);
    const subscriptionTier = await enforceFeatureRateLimit({
      userId: user.id,
      featureKey: "parse_resume",
      serviceClient,
    });

    const requestBody = (await req.json()) as ParseResumeRequest;
    const pdfBase64 = requestBody.pdfBase64;
    let resumeText = "";
    
    if (pdfBase64) {
      try {
        const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, "").trim();
        const pdfBytes = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));
        resumeText = await extractTextFromPdf(pdfBytes);
      } catch (extractError: any) {
        console.error("Server-side PDF text extraction failed:", extractError);
        if (requestBody.resumeText) {
          resumeText = requestBody.resumeText;
        } else {
          return new Response(JSON.stringify({ error: `Failed to extract text from PDF: ${extractError.message}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    } else {
      resumeText = requestBody.resumeText || "";
    }

    if (!resumeText || !resumeText.trim()) {
      return new Response(JSON.stringify({ error: "resumeText or pdfBase64 is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ai = createGeminiClient();
    const prompt = buildPrompt(resumeText.slice(0, 60000));

    const { result } = await withModelFallback(
      (model) => withGeminiRetry(() => ai.models.generateContent({
          model,
          config: createGeminiConfig({
            systemInstruction: "You are a lossless resume parser. Extract, preserve detail, and return only valid JSON.",
            responseMimeType: "application/json",
            includeTools: false,
            thinkingLevel: "LOW",
          }, model),
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
      })),
    );

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

    await recordFeatureUsage({
      userId: user.id,
      featureKey: "parse_resume",
      serviceClient,
      subscriptionTier,
      metadata: {
        resume_length: resumeText.length,
      },
    });

    return new Response(JSON.stringify(parsed), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    if (error instanceof SubscriptionAccessError) {
      return subscriptionErrorResponse(error, corsHeaders);
    }
    console.error("Error in parse-resume:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
