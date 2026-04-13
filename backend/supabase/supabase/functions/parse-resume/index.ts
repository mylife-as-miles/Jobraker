import { createGeminiClient, GEMINI_MODEL, createGeminiConfig } from "../_shared/gemini.ts";
import { getCorsHeaders } from "../_shared/types.ts";
declare const Deno: any;

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin') || undefined);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { resumeText } = await req.json();

    if (!resumeText) {
      return new Response(JSON.stringify({ error: "Resume text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ai = createGeminiClient();

    const systemPrompt = `You are an expert resume parser. Extract structured data from the provided resume text into the exact JSON format required by our resume builder.

    Required JSON Schema:
    {
      "basics": {
        "name": "string (Full Name)",
        "headline": "string (Current Job Title)",
        "email": "string",
        "phone": "string",
        "location": "string",
        "website": { "url": "string", "label": "string (e.g. Portfolio)" },
        "profiles": [
          { "network": "string (e.g. LinkedIn)", "username": "string", "url": "string" }
        ]
      },
      "summary": {
        "content": "string (Professional summary)"
      },
      "sections": {
        "experience": {
          "items": [
            {
              "company": "string",
              "position": "string",
              "location": "string",
              "date": "string (e.g. 2020 - Present)",
              "summary": "string (responsibilities)"
            }
          ]
        },
        "education": {
          "items": [
            {
              "school": "string",
              "degree": "string",
              "date": "string (e.g. 2016 - 2020)"
            }
          ]
        },
        "skills": {
          "items": [
            { "name": "string", "level": number (1-5, default 3) }
          ]
        },
        "projects": {
          "items": [
            {
              "name": "string",
              "description": "string",
              "date": "string",
              "website": { "url": "string", "label": "string" }
            }
          ]
        },
        "awards": { "items": [{ "title": "string", "date": "string", "awarder": "string", "summary": "st ring" }] },
        "certifications": { "items": [{ "name": "string", "date": "string", "issuer": "string", "summary": "string" }] },
        "languages": { "items": [{ "name": "string", "description": "string (e.g. Fluent)" }] },
        "interests": { "items": [{ "name": "string" }] },
        "volunteer": { "items": [{ "organization": "string", "position": "string", "date": "string", "summary": "string" }] },
        "publications": { "items": [{ "name": "string", "publisher": "string", "date": "string", "summary": "string" }] },
        "references": { "items": [{ "name": "string", "description": "string (Relationship/Contact)" }] }
      }
    }

    Rules:
    - Return ONLY valid JSON.
    - If a section is missing in the resume, return an empty array for "items".
    - Populate "basics" fields as best as possible.
    - For "date" fields, use "YYYY-MM" or "YYYY" format, or ranges like "2020 - 2022".
    - Do not invent information.
    `;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      config: createGeminiConfig({ 
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        includeTools: false,
        thinkingLevel: "LOW",
      }),
      contents: [{ role: 'user', parts: [{ text: resumeText }] }]
    });

    const text = typeof (response as any).text === 'function' ? (response as any).text() : (response as any).text;
    
    if (!text) throw new Error("Empty response from AI");

    const parsedData = JSON.parse(text);

    return new Response(JSON.stringify(parsedData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error parsing resume:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
