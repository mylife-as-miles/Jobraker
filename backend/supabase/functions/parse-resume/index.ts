
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
    website: { type: "string" },
    profiles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          network: { type: "string" },
          username: { type: "string" },
          url: { type: "string" }
        },
        required: ["url"]
      }
    },
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
    },
    languages: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" }
        },
        required: ["name"]
      }
    },
    interests: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          keywords: { type: "array", items: { type: "string" } }
        },
        required: ["name"]
      }
    },
    awards: {
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
    },
    publications: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          publisher: { type: "string" },
          date: { type: "string" },
          description: { type: "string" },
          url: { type: "string" }
        },
        required: ["name"]
      }
    },
    volunteer: {
      type: "array",
      items: {
        type: "object",
        properties: {
          organization: { type: "string" },
          position: { type: "string" },
          location: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
          description: { type: "string" }
        },
        required: ["organization"]
      }
    },
    references: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" }
        },
        required: ["name"]
      }
    }
  },
  required: [
    "firstName", "lastName", "email", "jobTitle", "about", "skills",
    "education", "experience", "projects", "certifications", "languages",
    "interests", "awards", "publications", "volunteer", "references"
  ]
};

const MAX_RESUME_TEXT_LENGTH = 200_000;

function buildPrompt(resumeText: string): string {
  return `You are a lossless resume/CV parser. Your task is to extract structured profile data while preserving the candidate's original detail.

Extract into the following JSON structure:
${JSON.stringify(PARSING_SCHEMA, null, 2)}

Requirements:
- Extract First Name, Last Name, Email, Phone, Location, personal website, portfolio, and professional/social profile URLs.
- Determine the current/most recent Job Title.
- Calculate total Years of Experience.
- For "about": preserve the candidate's existing professional summary/profile if present. If there is no summary, write a brief 2-3 sentence overview, but do not omit concrete domains, leadership scope, metrics, certifications, or major tools found in the CV.
- Extract all clearly stated Skills, tools, technologies, languages, certifications, and domain keywords. Do not cap the list at 20 when the CV contains more relevant skills.
- Extract Education history (School, Degree, Start Year, End Year).
- Extract the full Experience history in reverse chronological order.
- Extract Projects and Certifications when present instead of folding them into summary text.
- Extract every supported standalone section when present: Languages (including proficiency), Interests, Awards/Honors, Publications, Volunteer/Community work, and References.
- Never move information into an unrelated section. Return an empty array only when that section is genuinely absent from the source.
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

type ResumeTextCandidate = {
  source: string;
  text: string;
};

function scoreResumeText(text: string): number {
  const cleaned = text.trim();
  if (!cleaned) return 0;

  const nonWhitespace = cleaned.replace(/\s/g, "").length;
  const uniqueLines = new Set(
    cleaned
      .split(/\n+/)
      .map((line) => line.replace(/\s+/g, " ").trim().toLowerCase())
      .filter((line) => line.length >= 3),
  ).size;
  const sectionMatches =
    cleaned.match(
      /^(experience|work experience|professional experience|education|skills|projects|certifications?|languages?|awards?|publications?|volunteer(?:ing)?|references?|interests?)\s*:?$/gim,
    )?.length ?? 0;

  return nonWhitespace + uniqueLines * 12 + sectionMatches * 400;
}

function chooseMostCompleteResumeText(
  candidates: ResumeTextCandidate[],
): ResumeTextCandidate {
  const usable = candidates
    .map((candidate) => ({
      ...candidate,
      text: candidate.text.trim(),
      score: scoreResumeText(candidate.text),
    }))
    .filter((candidate) => candidate.text.length > 0)
    .sort((a, b) => b.score - a.score || b.text.length - a.text.length);

  if (usable.length === 0) {
    throw new Error("No usable resume text was extracted.");
  }

  const selected = usable[0];
  console.log(
    `Selected resume text from ${selected.source}: ${selected.text.length} characters (score ${selected.score})`,
  );
  return { source: selected.source, text: selected.text };
}

async function extractTextFromPdf(
  pdfBytes: Uint8Array,
): Promise<ResumeTextCandidate> {
  const candidates: ResumeTextCandidate[] = [];

  // Run both extractors. A non-empty result can still be incomplete for
  // multi-column PDFs, so accepting the first result silently loses content.
  try {
    console.log("Attempting PDF extraction using unpdf...");
    const { getDocumentProxy, extractText } = await import("npm:unpdf");
    const pdf = await getDocumentProxy(pdfBytes);
    const result = await extractText(pdf);
    const text = typeof result?.text === "string" ? result.text : "";
    if (text.trim()) {
      candidates.push({ source: "unpdf", text });
      console.log(`unpdf extracted ${text.length} characters`);
    }
  } catch (unpdfError) {
    console.warn("unpdf extraction failed:", unpdfError);
  }

  try {
    console.log("Attempting PDF extraction using pdf.js-extract...");
    const { PDFExtract } = await import("npm:pdf.js-extract");
    const { Buffer } = await import("node:buffer");
    const nodeBuffer = Buffer.from(pdfBytes);
    const pdfExtract = new PDFExtract();

    const text = await new Promise<string>((resolve, reject) => {
      pdfExtract.extractBuffer(nodeBuffer, {}, (err: any, data: any) => {
        if (err) return reject(err);
        if (!data || !Array.isArray(data.pages)) {
          return reject(new Error("No pages found"));
        }

        let fullText = "";
        for (const page of data.pages) {
          const content = Array.isArray(page.content) ? page.content : [];
          const linesMap: Record<number, typeof content> = {};

          for (const item of content) {
            const y = Math.round(item.y);
            const foundKey = Object.keys(linesMap).find(
              (key) => Math.abs(Number(key) - y) <= 4,
            );
            if (foundKey) {
              linesMap[Number(foundKey)].push(item);
            } else {
              linesMap[y] = [item];
            }
          }

          const sortedY = Object.keys(linesMap)
            .map(Number)
            .sort((a, b) => a - b);
          let pageText = "";

          for (const y of sortedY) {
            const items = linesMap[y];
            items.sort((a, b) => a.x - b.x);
            const lineText = items.map((item: any) => item.str).join(" ");
            if (lineText.trim()) pageText += lineText + "\n";
          }

          fullText += pageText + "\n";
        }

        resolve(fullText.trim());
      });
    });

    if (text.trim()) {
      candidates.push({ source: "pdf.js-extract", text });
      console.log(`pdf.js-extract extracted ${text.length} characters`);
    }
  } catch (pdfExtractError) {
    console.warn("pdf.js-extract extraction failed:", pdfExtractError);
  }

  return chooseMostCompleteResumeText(candidates);
}

const SECTION_PRESENCE_RULES = [
  { key: "experience", pattern: /^(?:work|professional|employment|career)?\s*experience\s*:?$/im },
  { key: "education", pattern: /^education(?:al background)?\s*:?$/im },
  { key: "skills", pattern: /^(?:technical|core|professional)?\s*skills\s*:?$/im },
  { key: "projects", pattern: /^(?:selected\s+)?projects\s*:?$/im },
  { key: "certifications", pattern: /^(?:certifications?|licenses?(?:\s*&\s*certifications?)?)\s*:?$/im },
  { key: "languages", pattern: /^languages?\s*:?$/im },
  { key: "interests", pattern: /^(?:interests?|hobbies)\s*:?$/im },
  { key: "awards", pattern: /^(?:awards?|honou?rs?|achievements?)\s*:?$/im },
  { key: "publications", pattern: /^publications?\s*:?$/im },
  { key: "volunteer", pattern: /^(?:volunteer(?:ing)?|community(?:\s+service)?)\s*:?$/im },
  { key: "references", pattern: /^references?\s*:?$/im },
] as const;

type RecoverableSectionKey =
  (typeof SECTION_PRESENCE_RULES)[number]["key"];

function findMissingSourceSections(
  resumeText: string,
  parsed: unknown,
): RecoverableSectionKey[] {
  const record =
    parsed && typeof parsed === "object"
      ? parsed as Record<string, unknown>
      : {};

  return SECTION_PRESENCE_RULES
    .filter(({ key, pattern }) => {
      const value = record[key];
      return pattern.test(resumeText) &&
        (!Array.isArray(value) || value.length === 0);
    })
    .map(({ key }) => key);
}

function mergeRecoveredSections(
  parsed: unknown,
  recovered: unknown,
  keys: RecoverableSectionKey[],
): unknown {
  const base =
    parsed && typeof parsed === "object"
      ? { ...parsed as Record<string, unknown> }
      : {};
  const additions =
    recovered && typeof recovered === "object"
      ? recovered as Record<string, unknown>
      : {};

  for (const key of keys) {
    const value = additions[key];
    if (Array.isArray(value) && value.length > 0) {
      base[key] = value;
    }
  }

  return base;
}

async function recoverMissingSourceSections(
  ai: ReturnType<typeof createGeminiClient>,
  resumeText: string,
  keys: RecoverableSectionKey[],
): Promise<unknown> {
  const requestedSchema = Object.fromEntries(
    keys.map((key) => [key, (PARSING_SCHEMA.properties as any)[key]]),
  );
  const prompt = `The first parsing pass omitted CV sections that are clearly present in the source.

Extract ALL entries and ALL details for these sections only:
${keys.join(", ")}

Use this JSON property schema:
${JSON.stringify(requestedSchema, null, 2)}

Rules:
- Return one JSON object containing the requested property keys.
- Preserve every entry, bullet, date, metric, issuer, organization, proficiency, and description.
- Do not summarize multiple entries into one.
- Return an empty array only if the heading is present but truly has no content.

RESUME CONTENT:
${resumeText}

Return ONLY valid JSON.`;

  const { result } = await withModelFallback(
    (model) => withGeminiRetry(() => ai.models.generateContent({
      model,
      config: createGeminiConfig({
        systemInstruction:
          "Recover omitted resume sections losslessly. Return only valid JSON.",
        responseMimeType: "application/json",
        includeTools: false,
        thinkingLevel: "LOW",
      }, model),
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    })),
  );

  const text = extractGeminiText(result);
  if (!text) throw new Error("Empty response while recovering omitted sections.");
  return parseGeminiJson(text);
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
    let extractionSource = "request";
    
    if (pdfBase64) {
      try {
        const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, "").trim();
        const pdfBytes = Uint8Array.from(
          atob(cleanBase64),
          (character) => character.charCodeAt(0),
        );
        const serverExtracted = await extractTextFromPdf(pdfBytes);
        const selected = chooseMostCompleteResumeText([
          serverExtracted,
          {
            source: "client-pdfjs",
            text: requestBody.resumeText || "",
          },
        ]);
        resumeText = selected.text;
        extractionSource = selected.source;
      } catch (extractError: any) {
        console.error("Server-side PDF text extraction failed:", extractError);
        if (requestBody.resumeText) {
          resumeText = requestBody.resumeText;
          extractionSource = "client-fallback";
        } else {
          return new Response(JSON.stringify({ error: `Failed to extract text from PDF: ${extractError.message}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    } else {
      resumeText = requestBody.resumeText || "";
      extractionSource = "request-text";
    }

    if (!resumeText || !resumeText.trim()) {
      return new Response(JSON.stringify({ error: "resumeText or pdfBase64 is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (resumeText.length > MAX_RESUME_TEXT_LENGTH) {
      return new Response(
        JSON.stringify({
          error:
            `Extracted resume text is too large (${resumeText.length} characters). ` +
            `The maximum supported size is ${MAX_RESUME_TEXT_LENGTH}; processing was stopped instead of silently truncating the CV.`,
        }),
        {
          status: 413,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const ai = createGeminiClient();
    const prompt = buildPrompt(resumeText);

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

    const missingSections = findMissingSourceSections(resumeText, parsed);
    if (missingSections.length > 0) {
      try {
        console.warn(
          "parse-resume recovering omitted source sections:",
          missingSections,
        );
        const recovered = await recoverMissingSourceSections(
          ai,
          resumeText,
          missingSections,
        );
        parsed = mergeRecoveredSections(parsed, recovered, missingSections);
      } catch (recoveryError) {
        console.error(
          "parse-resume omitted-section recovery failed; returning first pass",
          recoveryError,
        );
      }
    }

    await recordFeatureUsage({
      userId: user.id,
      featureKey: "parse_resume",
      serviceClient,
      subscriptionTier,
      metadata: {
        resume_length: resumeText.length,
        extraction_source: extractionSource,
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
