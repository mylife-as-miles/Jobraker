
import { GoogleGenAI } from "npm:@google/genai";

export const resolveGeminiApiKey = (): string => {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable.");
  }
  return apiKey;
};

export const createGeminiClient = () => {
    const apiKey = resolveGeminiApiKey();
    return new GoogleGenAI({ apiKey });
}

// Default model - Gemini 3 Pro Preview
export const GEMINI_MODEL = 'gemini-3.1-pro-preview';

// Standard tools configuration
export const GEMINI_TOOLS = [
    { urlContext: {} },
    { googleSearch: {} }
];

// Standard config with thinking enabled
export const createGeminiConfig = (options?: {
    systemInstruction?: string;
    responseMimeType?: string;
}) => ({
    thinkingConfig: {
        thinkingLevel: 'HIGH',
    },
    tools: GEMINI_TOOLS,
    responseMimeType: options?.responseMimeType || 'application/json',
    ...(options?.systemInstruction ? { systemInstruction: options.systemInstruction } : {}),
});

/**
 * Safely extract text from a Gemini generateContent response.
 * Handles multiple SDK response shapes:
 *  - response.text (string property or getter)
 *  - response.text() (function in older SDK versions)
 *  - response.candidates[0].content.parts[0].text (raw structure)
 */
export function extractGeminiText(response: any): string {
    // 1. Direct string property or getter
    if (typeof response?.text === 'string' && response.text.length > 0) {
        return response.text;
    }
    // 2. Function (older SDK versions)
    if (typeof response?.text === 'function') {
        try {
            const val = response.text();
            if (typeof val === 'string' && val.length > 0) return val;
        } catch { /* fall through */ }
    }
    // 3. Nested candidates structure
    try {
        const parts = response?.candidates?.[0]?.content?.parts;
        if (Array.isArray(parts)) {
            const textParts = parts.filter((p: any) => typeof p?.text === 'string').map((p: any) => p.text);
            if (textParts.length > 0) return textParts.join('');
        }
    } catch { /* fall through */ }
    // 4. response.response wrapper (some SDK versions wrap the result)
    if (response?.response) {
        return extractGeminiText(response.response);
    }
    throw new Error("Failed to extract text from Gemini response");
}

export interface AiDescriptionResponse {
  description: string;
  tags?: string[];
  technologies?: string[];
}

export const generateGeminiDescription = async (
  rawHtml: string,
  rawMarkdown: string,
  fallbackDescription: string,
  jobTitle: string,
): Promise<AiDescriptionResponse> => {
  const ai = createGeminiClient();

  const combinedContent = `
    Job Title: ${jobTitle}
    
    HTML Content:
    ${rawHtml}

    Markdown Content:
    ${rawMarkdown}

    Fallback Description:
    ${fallbackDescription}
  `;

  const systemPrompt = `
    You are an expert in parsing and cleaning job descriptions. Your task is to synthesize the provided raw data (HTML, Markdown, etc.) into a single, clean, and comprehensive job description.
    The output must be a valid JSON object with the following structure: { "description": "...", "tags": ["...", "..."], "technologies": ["...", "..."] }.
    - The "description" should be the full, complete job description in plain text, with appropriate line breaks. Do not summarize too aggressively, keep the details.
    - The "tags" should be an array of relevant skills, methodologies, or concepts (e.g., "Agile", "SaaS").
    - The "technologies" should be an array of specific software/technologies (e.g., "React", "Node.js").
  `;

  try {
     const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        config: createGeminiConfig({ systemInstruction: systemPrompt }),
        contents: [
            {
                role: 'user',
                parts: [{ text: combinedContent }]
            }
        ]
     });

     const text = extractGeminiText(response);
     if (!text) throw new Error("Empty response from Gemini");
     
     return JSON.parse(text) as AiDescriptionResponse;

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error(`Failed to generate Gemini description: ${error.message}`);
  }
};
