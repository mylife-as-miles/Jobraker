
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

const readNestedErrorMessage = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return [
      typeof record.message === "string" ? record.message : "",
      typeof record.status === "string" ? record.status : "",
      typeof record.code === "string" ? record.code : "",
      readNestedErrorMessage(record.error),
      readNestedErrorMessage(record.cause),
    ]
      .filter(Boolean)
      .join(" ");
  }
  return "";
};

export const isGeminiAccessDeniedError = (error: unknown): boolean => {
  const record =
    error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const status = typeof record.status === "number" ? record.status : null;
  const message = readNestedErrorMessage(error).toLowerCase();

  return (
    status === 403 ||
    message.includes("permission_denied") ||
    message.includes("forbidden") ||
    message.includes("denied access") ||
    message.includes("project has been denied access")
  );
};

export const getGeminiAccessDeniedMessage = (feature: string): string =>
  `${feature} is temporarily unavailable because the configured Gemini project no longer has model access. Re-enable Gemini access or switch this feature to another provider.`;

export const isGeminiRateLimitError = (error: unknown): boolean => {
  const record =
    error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const status = typeof record.status === "number" ? record.status : null;
  const message = readNestedErrorMessage(error).toLowerCase();

  return (
    status === 429 ||
    message.includes("resource_exhausted") ||
    message.includes("rate limit") ||
    message.includes("quota")
  );
};

function parseRetryDelay(error: unknown): number | null {
  const message = readNestedErrorMessage(error);
  const match = message.match(/retryDelay['":\s]*(\d+(?:\.\d+)?)\s*s/i);
  if (match) return Math.ceil(parseFloat(match[1]) * 1000);
  const matchMs = message.match(/retry\s*(?:in|after)\s*(\d+(?:\.\d+)?)\s*ms/i);
  if (matchMs) return Math.ceil(parseFloat(matchMs[1]));
  return null;
}

const DEFAULT_BACKOFF_MS = [5_000, 15_000, 30_000];

export async function withGeminiRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isGeminiRateLimitError(error) || attempt === maxRetries) {
        throw error;
      }
      const parsed = parseRetryDelay(error);
      const delay = parsed ?? DEFAULT_BACKOFF_MS[Math.min(attempt, DEFAULT_BACKOFF_MS.length - 1)];
      console.warn(
        `[Gemini] Rate limited (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

// Standardize default text/function-calling work on the current shared Gemini model.
// Tiered model strategy:
//   LITE   – cheapest, highest rate limits, best for simple tasks & fallback
//   MODEL  – standard workhorse for most features
//   PREMIUM – most capable, costs 2 credits, for advanced reasoning tasks
export const GEMINI_LITE_MODEL = "gemini-3.1-flash-lite";
export const GEMINI_MODEL = "gemini-2.5-flash";
export const GEMINI_FAST_MODEL = GEMINI_LITE_MODEL;
export const GEMINI_PREMIUM_MODEL = "gemini-3.5-flash";

/** Ordered fallback chain: try primary → standard → lite */
export const MODEL_FALLBACK_CHAIN = [
  GEMINI_MODEL,
  GEMINI_LITE_MODEL,
] as const;

/**
 * Try `fn` with the given model. On rate-limit, cascade through cheaper
 * fallback models before giving up.
 */
export async function withModelFallback<T>(
  fn: (model: string) => Promise<T>,
  primaryModel: string = GEMINI_MODEL,
): Promise<{ result: T; modelUsed: string }> {
  const chain = [primaryModel, ...MODEL_FALLBACK_CHAIN.filter((m) => m !== primaryModel)];
  let lastError: unknown;
  for (const model of chain) {
    try {
      const result = await fn(model);
      return { result, modelUsed: model };
    } catch (error) {
      lastError = error;
      if (!isGeminiRateLimitError(error)) {
        throw error; // non-rate-limit errors propagate immediately
      }
      console.warn(`[Gemini] ${model} rate-limited, falling back…`);
    }
  }
  throw lastError;
}

// Standard tools configuration
export const GEMINI_TOOLS = [
    { urlContext: {} },
    { googleSearch: {} }
];

// Standard config with thinking enabled
export const createGeminiConfig = (options?: {
    systemInstruction?: string;
    responseMimeType?: string;
    includeTools?: boolean;
    thinkingLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
}) => ({
    ...(options?.thinkingLevel ? {
      thinkingConfig: {
        thinkingLevel: options.thinkingLevel,
      }
    } : {}),
    ...(options?.includeTools ? { tools: GEMINI_TOOLS } : {}),
    responseMimeType: options?.responseMimeType || 'application/json',
    ...(options?.systemInstruction ? {
      systemInstruction: {
        role: "system",
        parts: [{ text: options.systemInstruction }]
      }
    } : {}),
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
