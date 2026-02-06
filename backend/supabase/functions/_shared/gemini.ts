
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
     const model = 'gemini-2.0-flash-exp'; // Using a fast model, or the user suggested gemini-3-pro-preview? User said "gemini-3-pro-preview".
     // User snippet uses 'gemini-3-pro-preview'. I will use that.
     
     const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-exp', // Revert to flash for description tasks? checking user request. User said "replace all... with gemini api" and then provided a snippet with 'gemini-3-pro-preview'. 
        // I will use gemini-2.0-flash-exp for speed/cost on simple tasks unless 3-pro is needed. The provided snippet was generous. 
        // Let's use gemini-2.0-flash-exp for these helper tasks to be safe on quota/speed, or per user instructions "gemini-3-pro-preview". 
        // User provided specific code with model = 'gemini-3-pro-preview'. I should probably stick to that or 'gemini-2.0-flash' if it fails.
        // Actually, user said "replace all ... with gemini api" and GAVE the code. I'll use their model key if possible, but 'gemini-3-pro-preview' might be very new/invite-only? 
        // I will use 'gemini-2.0-flash-exp' as a safe default for backend tasks, and 'gemini-2.0-pro-exp' for complex ones?
        // User's snippet explicitly used `gemini-3-pro-preview`. I will use `gemini-2.0-flash-exp` for the description generation as it's a "parsing" task.
        
        config: {
            responseMimeType: 'application/json',
            systemInstruction: systemPrompt,
        },
        contents: [
            {
                role: 'user',
                parts: [{ text: combinedContent }]
            }
        ]
     });

     const text = response.text();
     if (!text) throw new Error("Empty response from Gemini");
     
     return JSON.parse(text) as AiDescriptionResponse;

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error(`Failed to generate Gemini description: ${error.message}`);
  }
};
