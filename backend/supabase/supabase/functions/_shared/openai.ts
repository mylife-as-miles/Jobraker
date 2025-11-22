import { OpenAI } from "https://deno.land/x/openai@v4.49.1/mod.ts";

// Helper to resolve the OpenAI API key from environment variables.
// Throws an error if the key is not found, ensuring that functions
// using this helper will fail early if not configured correctly.
export const resolveOpenAIApiKey = (): string => {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY environment variable.");
  }
  return apiKey;
};

// A structured interface for the response from the AI description generation.
export interface AiDescriptionResponse {
  description: string;
  tags?: string[];
  technologies?: string[];
}

// Calls the OpenAI API to generate a structured job description from raw content.
// It takes raw HTML, Markdown, and other text as input and asks the AI to
// synthesize it into a clean, comprehensive job description.
export const generateAiDescription = async (
  rawHtml: string,
  rawMarkdown: string,
  fallbackDescription: string,
  jobTitle: string,
): Promise<AiDescriptionResponse> => {
  const apiKey = resolveOpenAIApiKey();
  const openai = new OpenAI({ apiKey });

  // Combine all available raw content to provide maximum context to the AI.
  const combinedContent = `
    HTML:
    ${rawHtml}

    ---
    Markdown:
    ${rawMarkdown}

    ---
    Fallback Description:
    ${fallbackDescription}
  `;

  // The system prompt instructs the AI on its role, the desired output format,
  // and the specific task to perform.
  const systemPrompt = `
    You are an expert in parsing and cleaning job descriptions. Your task is to synthesize the provided raw data (HTML, Markdown, etc.) into a single, clean, and comprehensive job description.
    The output should be a JSON object with the following structure: { "description": "...", "tags": ["...", "..."], "technologies": ["...", "..."] }.
    - The "description" should be the full, complete job description in plain text, with appropriate line breaks for readability. Do not summarize.
    - The "tags" should be an array of relevant skills, methodologies, or concepts mentioned (e.g., "Agile", "Product Management", "SaaS").
    - The "technologies" should be an array of specific software or technologies mentioned (e.g., "React", "Node.js", "PostgreSQL").
  `;

  const userPrompt = `
    Please process the following job content for the role of "${jobTitle}":
    ${combinedContent}
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview", // A powerful model suitable for this task
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2, // Lower temperature for more deterministic output
      max_tokens: 2048,
    });

    const result = response.choices[0].message.content;
    if (!result) {
      throw new Error("OpenAI returned an empty response.");
    }

    return JSON.parse(result) as AiDescriptionResponse;
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    throw new Error(`Failed to generate AI description: ${error.message}`);
  }
};