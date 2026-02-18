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

    const systemPrompt = `You are an expert resume parser. Extract structured data from the provided resume text into the following JSON format.
    
    Required JSON Schema:
    {
      "firstName": "string",
      "lastName": "string",
      "email": "string",
      "phone": "string",
      "location": "string",
      "jobTitle": "string (current or most recent)",
      "experienceYears": number,
      "about": "string (short professional summary)",
      "skills": ["string", "string"],
      "education": [
        {
          "school": "string",
          "degree": "string",
          "start": "string (YYYY-MM or YYYY)",
          "end": "string (YYYY-MM or YYYY or Present)"
        }
      ],
      "experience": [
        {
          "company": "string",
          "title": "string",
          "location": "string",
          "startDate": "string",
          "endDate": "string",
          "description": "string (summary of responsibilities)"
        }
      ]
    }

    Rules:
    - If a field is missing, use empty string "" or null for numbers.
    - Infer experienceYears from the work history if not explicitly stated.
    - Extract skills from the entire document.
    - Return ONLY valid JSON.
    `;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      config: createGeminiConfig({ 
        systemInstruction: systemPrompt,
        responseMimeType: "application/json"
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
