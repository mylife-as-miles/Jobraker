
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createGeminiClient,
  GEMINI_MODEL,
  createGeminiConfig,
  extractGeminiText,
  withGeminiRetry,
  withModelFallback,
  runMeteredAiCall,
  createSafeAiErrorResponse,
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
    website: { type: "string" },
    profiles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          network: { type: "string" },
          url: { type: "string" },
          username: { type: "string" }
        },
        required: ["network", "url"]
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

function buildPrompt(resumeText: string | null): string {
  const basePrompt = `You are a world-class, lossless resume/CV parser. Your primary directive is FAITHFUL, UNCORRUPTED SECTION SEGMENTATION. Resumes frequently have distinct sections such as Summary, Experience (Work History), Education, Skills, Projects, and Certifications. You must NEVER mix or merge these sections.

Strict Section Segmentation Directives:
1. WORK EXPERIENCE ONLY in 'experience' array:
   - Contains ONLY real professional employment, jobs, internships, or contractor roles.
   - Company name must be a company or organization (e.g. 'Google', 'Acme Corp'), NOT a degree, school, or skill name.
   - Title must be a job title (e.g. 'Senior Software Engineer'), NOT a degree (e.g. 'B.S. in Computer Science').
   - NEVER place Education degrees, university names, personal projects, or standalone skill lists inside 'experience'.
   - NEVER fold Education or Skills into experience descriptions.
2. EDUCATION ONLY in 'education' array:
   - Contains university/college/school degrees, majors, certifications of study, and graduation dates.
   - School must be an academic institution (e.g. 'Stanford University').
   - Degree must be an academic degree (e.g. 'B.S. Computer Science').
3. SKILLS ONLY in 'skills' array:
   - Extract every technical skill, tool, programming language, framework, cloud platform, methodology, library, and domain expertise into this string array.
   - Do NOT cap skills at 20; if the resume mentions 40 skills, extract all 40.
4. SOCIAL PROFILES & LINKS:
   - Extract all social profiles, portfolio links, and web presences (LinkedIn, GitHub, Portfolio, Personal Website, Twitter/X, Medium, Behance, etc.) into the 'profiles' array with network name, full URL, and username.
   - If a personal website or portfolio is present, also populate 'website'.
5. PROJECTS ONLY in 'projects' array:
   - Independent projects, open-source work, portfolio items, or research projects.
6. CERTIFICATIONS ONLY in 'certifications' array:
   - Professional certifications, AWS/GCP/Azure certs, PMP, Scrum, licenses, etc.
7. ABOUT / SUMMARY:
   - The candidate's professional summary, profile, or objective. If not explicitly present, write a concise 2-3 sentence overview based on their background.
8. MULTI-COLUMN & MARKDOWN HEADERS:
   - The input text may include markdown headers (such as '## Skills', '## Experience', '## Education', '## Summary').
   - Use these headers as strict boundaries. Content under '## Education' belongs exclusively in 'education'. Content under '## Skills' belongs exclusively in 'skills'. Content under '## Experience' belongs exclusively in 'experience'.
   - For bullet points in experience descriptions, preserve each bullet point separated by newlines.

Extract into the following JSON structure:
${JSON.stringify(PARSING_SCHEMA, null, 2)}`;

  if (resumeText) {
    return `${basePrompt}\n\nRESUME CONTENT:\n${resumeText}\n\nReturn ONLY valid JSON.`;
  }
  return `${basePrompt}\n\nI have attached the resume PDF. Carefully inspect the visual columns and section headings to isolate each section accurately. Return ONLY valid JSON.`;
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
    let resumeText = (requestBody.resumeText || "").trim();
    
    let parts: any[] = [];
    let promptLength = 0;

    if (resumeText.length >= 50) {
      // Fast path: direct text tokenization in Gemini (~1.5s vs 10s+ for raw PDF multimodal OCR)
      const prompt = buildPrompt(resumeText.slice(0, 60000));
      parts = [{ text: prompt }];
      promptLength = prompt.length;
    } else if (pdfBase64) {
      const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, "").trim();
      const prompt = buildPrompt(null);
      parts = [
        { text: prompt },
        { inlineData: { mimeType: "application/pdf", data: cleanBase64 } }
      ];
      promptLength = prompt.length + cleanBase64.length;
    } else if (resumeText.length > 0) {
      const prompt = buildPrompt(resumeText.slice(0, 60000));
      parts = [{ text: prompt }];
      promptLength = prompt.length;
    } else {
      return new Response(
        JSON.stringify({ error: "resumeText or pdfBase64 is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ai = createGeminiClient();

    const metered = await runMeteredAiCall({
      userId: user.id,
      featureKey: "parse_resume",
      model: GEMINI_MODEL,
      promptTextLength: promptLength,
      execute: async () => {
        const { result: rawResponse, modelUsed } = await withModelFallback(
          (model) => withGeminiRetry(() => ai.models.generateContent({
              model,
              config: createGeminiConfig({
                systemInstruction: "You are a lossless resume parser. Extract, preserve detail, and return only valid JSON.",
                responseMimeType: "application/json",
                includeTools: false,
                thinkingLevel: "LOW",
              }, model),
              contents: [{ role: 'user', parts }]
          })),
        );
        return {
          result: rawResponse,
          usageMetadata: (rawResponse as any)?.usageMetadata,
          modelUsed,
        };
      },
    });

    const text = extractGeminiText(metered.result);
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
        resume_length: resumeText.length || (pdfBase64 ? pdfBase64.length : 0),
      },
    });

    return new Response(JSON.stringify(parsed), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    if (error instanceof SubscriptionAccessError) {
      return subscriptionErrorResponse(error, corsHeaders);
    }
    console.error("Error in parse-resume:", error);
    return createSafeAiErrorResponse(error, corsHeaders);
  }
});
