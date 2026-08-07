
import { GoogleGenAI, ThinkingLevel } from "npm:@google/genai";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  runMeteredAiCall,
  estimatePreflightReservationNanos,
  reserveAiUsage,
  settleAiUsage,
  releaseAiUsage,
  MeteredAiLimitError,
} from "./metered-ai.ts";

export const resolveGeminiApiKey = (): string => {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable.");
  }
  return apiKey;
};

function getAdminSupabaseClient() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return createClient(url, key);
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

const getGeminiHttpStatus = (error: unknown): number | null => {
  if (!error || typeof error !== "object") return null;
  const record = error as Record<string, unknown>;
  if (typeof record.status === "number") return record.status;
  if (typeof record.code === "number") return record.code;
  const nested = record.error;
  if (nested && typeof nested === "object") {
    const nestedRecord = nested as Record<string, unknown>;
    if (typeof nestedRecord.status === "number") return nestedRecord.status;
    if (typeof nestedRecord.code === "number") return nestedRecord.code;
  }
  return null;
};

export const isGeminiAccessDeniedError = (error: unknown): boolean => {
  const status = getGeminiHttpStatus(error);
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

export const isGeminiQuotaError = (error: unknown): boolean => {
  const status = getGeminiHttpStatus(error);
  const message = readNestedErrorMessage(error).toLowerCase();

  return (
    status === 429 ||
    message.includes("resource_exhausted") ||
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("quota")
  );
};

export const isGeminiTransientProviderError = (error: unknown): boolean => {
  const status = getGeminiHttpStatus(error);
  const message = readNestedErrorMessage(error).toLowerCase();

  return (
    status === 502 ||
    status === 503 ||
    status === 504 ||
    message.includes("high demand") ||
    message.includes("service unavailable") ||
    message.includes("overloaded") ||
    message.includes("model is unavailable") ||
    message.includes("model unavailable") ||
    message.includes("backend error")
  );
};

/**
 * Backwards-compatible retry predicate used throughout the Edge Functions.
 * Despite the historical name, it intentionally includes both quota/rate-limit
 * failures and transient upstream availability failures.
 */
export const isGeminiRateLimitError = (error: unknown): boolean => {
  if (
    error &&
    typeof error === "object" &&
    (error as Record<string, unknown>).jobrakerFallbackExhausted === true
  ) {
    return false;
  }
  return isGeminiQuotaError(error) || isGeminiTransientProviderError(error);
};

export const formatGeminiErrorMessage = (error: unknown): string => {
  if (isGeminiQuotaError(error)) {
    return "The AI provider is temporarily rate-limiting this request. Please try again shortly.";
  }
  if (isGeminiTransientProviderError(error)) {
    return "The AI provider is temporarily having trouble responding. Please try again shortly.";
  }
  if (isGeminiAccessDeniedError(error)) {
    return "The configured AI model is temporarily inaccessible. Please try again shortly.";
  }

  let rawMsg = readNestedErrorMessage(error);
  if (!rawMsg) {
    rawMsg = typeof error === "string"
      ? error
      : (error as any)?.message || String(error || "Unknown error");
  }

  if (rawMsg.includes("{") && rawMsg.includes("}")) {
    try {
      const match = rawMsg.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        const innerMsg = parsed?.error?.message || parsed?.message;
        if (typeof innerMsg === "string" && innerMsg.trim()) {
          rawMsg = innerMsg;
        }
      }
    } catch {
      // Ignore JSON parse failure.
    }
  }

  return rawMsg.replace(/^Error:\s*/i, "").trim();
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
        `[Gemini] Retryable provider failure (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

// Standardize default text/function-calling work on current supported Gemini models.
// Tiered model strategy:
//   LITE    – cheaper fallback for simple work
//   MODEL   – standard workhorse for most features
//   PREMIUM – explicitly requested higher-capability path
export const GEMINI_LITE_MODEL = "gemini-3.5-flash-lite";
export const GEMINI_MODEL = "gemini-3.6-flash";
export const GEMINI_FAST_MODEL = GEMINI_LITE_MODEL;
export const GEMINI_PREMIUM_MODEL = "gemini-3.5-flash";

/** Ordered fallback chain. Every entry is deliberately a distinct live model. */
export const MODEL_FALLBACK_CHAIN = [
  GEMINI_MODEL,
  GEMINI_LITE_MODEL,
  "gemini-2.5-flash",
] as const;

const asProviderRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const providerChunkParts = (chunk: unknown): unknown[] => {
  const record = asProviderRecord(chunk);
  const candidates = Array.isArray(record?.candidates) ? record!.candidates : [];
  const candidate = asProviderRecord(candidates[0]);
  const content = asProviderRecord(candidate?.content);
  return Array.isArray(content?.parts) ? content!.parts as unknown[] : [];
};

const chatHistoryEntryFromMessage = (message: unknown) => {
  const record = asProviderRecord(message);
  if (record && Array.isArray(record.parts)) {
    return {
      role: typeof record.role === "string" ? record.role : "user",
      parts: record.parts,
    };
  }
  if (Array.isArray(message)) {
    return { role: "user", parts: message };
  }
  if (typeof message === "string") {
    return { role: "user", parts: [{ text: message }] };
  }
  return {
    role: "user",
    parts: [{ text: JSON.stringify(message ?? {}) }],
  };
};

const getFunctionResponses = (message: unknown) => {
  const record = asProviderRecord(message);
  const parts = record && Array.isArray(record.parts) ? record.parts : [];
  return parts
    .map((part) => asProviderRecord(part)?.functionResponse)
    .map(asProviderRecord)
    .filter((part): part is Record<string, unknown> => Boolean(part));
};

const isFunctionResponseMessage = (message: unknown): boolean =>
  getFunctionResponses(message).length > 0;

const humanizeToolName = (value: unknown) =>
  typeof value === "string"
    ? value.replace(/^(default_api|mcp_default_api):/, "").replace(/_/g, " ")
    : "tool step";

const buildPreservedWorkMessage = (message: unknown): string => {
  const responses = getFunctionResponses(message);
  const successful: string[] = [];
  const incomplete: string[] = [];

  for (const response of responses) {
    const name = humanizeToolName(response.name);
    const payload = asProviderRecord(response.response);
    const failed = payload?.success === false || typeof payload?.error === "string";
    const target = failed ? incomplete : successful;
    if (!target.includes(name)) target.push(name);
  }

  const lines = [
    "**Work preserved.** The AI provider stopped responding while generating the next summary, even after JobRaker tried backup models.",
  ];
  if (successful.length > 0) {
    lines.push(`Successful tool result${successful.length === 1 ? "" : "s"} preserved: ${successful.join(", ")}.`);
  }
  if (incomplete.length > 0) {
    lines.push(`Tool result${incomplete.length === 1 ? "" : "s"} that reported an issue: ${incomplete.join(", ")}.`);
  }
  lines.push(
    "The completed actions above were not rolled back. Review the tool results, or send **Continue** and JobRaker will resume from the last successful state.",
  );
  return lines.join("\n\n");
};

const makeSyntheticTextChunk = (text: string) => ({
  text,
  candidates: [
    {
      content: {
        role: "model",
        parts: [{ text }],
      },
    },
  ],
  usageMetadata: {
    promptTokenCount: 0,
    candidatesTokenCount: 0,
    totalTokenCount: 0,
  },
});

const isModelNotFoundError = (error: unknown) => {
  const status = getGeminiHttpStatus(error);
  const message = readNestedErrorMessage(error).toLowerCase();
  return status === 404 || message.includes("not found") || message.includes("model not found");
};

/**
 * Wrap the SDK chat object so every streamed chat step can fail over, not just
 * the first request in an Agent Mode turn. The wrapper keeps a minimal local
 * transcript, allowing a newly-created backup-model chat to continue after a
 * successful function-call round without replaying side effects.
 */
function createResilientGeminiClient(apiKey: string) {
  const nativeAi: any = new GoogleGenAI({ apiKey });
  const nativeChats: any = nativeAi?.chats;
  if (!nativeChats || typeof nativeChats.create !== "function") {
    return nativeAi;
  }

  const resilientChats = new Proxy(nativeChats, {
    get(target, property, receiver) {
      if (property !== "create") {
        const value = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      }

      return (createArgs: Record<string, unknown>) => {
        const baseArgs = createArgs || {};
        const originalHistory = Array.isArray(baseArgs.history)
          ? [...baseArgs.history]
          : [];
        let transcript = [...originalHistory];
        let activeModel = typeof baseArgs.model === "string" && baseArgs.model
          ? baseArgs.model
          : GEMINI_MODEL;
        let activeNativeChat = target.create.call(target, {
          ...baseArgs,
          model: activeModel,
          history: transcript,
        });

        const resilientChat: any = {};
        Object.defineProperty(resilientChat, "model", {
          enumerable: true,
          get: () => activeModel,
        });

        resilientChat.sendMessageStream = async ({ message }: { message: unknown }) => {
          const messageEntry = chatHistoryEntryFromMessage(message);
          const models = [...new Set([activeModel, ...MODEL_FALLBACK_CHAIN])];

          return (async function* resilientStream() {
            let lastError: unknown = null;

            for (const candidateModel of models) {
              const candidateChat = candidateModel === activeModel
                ? activeNativeChat
                : target.create.call(target, {
                  ...baseArgs,
                  model: candidateModel,
                  history: transcript,
                });
              const responseParts: unknown[] = [];
              let yieldedAnyChunk = false;

              try {
                if (candidateModel !== activeModel) {
                  console.warn(
                    `[Gemini chat] ${activeModel} failed; continuing on ${candidateModel}`,
                  );
                }
                const nativeStream = await candidateChat.sendMessageStream({ message });
                for await (const chunk of nativeStream) {
                  yieldedAnyChunk = true;
                  responseParts.push(...providerChunkParts(chunk));
                  yield chunk;
                }

                transcript = [
                  ...transcript,
                  messageEntry,
                  {
                    role: "model",
                    parts: responseParts.length > 0
                      ? responseParts
                      : [{ text: "" }],
                  },
                ];
                activeModel = candidateModel;
                activeNativeChat = candidateChat;
                return;
              } catch (error) {
                lastError = error;
                const retryable =
                  isGeminiRateLimitError(error) || isModelNotFoundError(error);

                // Once visible output has escaped, replaying the same model turn
                // on another provider model could duplicate user-facing text or
                // function calls. For a post-tool synthesis failure, finish with
                // a deterministic preservation notice instead of replaying work.
                if (yieldedAnyChunk) {
                  if (retryable && isFunctionResponseMessage(message)) {
                    const preserved = buildPreservedWorkMessage(message);
                    transcript = [
                      ...transcript,
                      messageEntry,
                      { role: "model", parts: [{ text: preserved }] },
                    ];
                    yield makeSyntheticTextChunk(`\n\n${preserved}`);
                    return;
                  }
                  throw error;
                }

                if (!retryable) {
                  throw error;
                }
              }
            }

            if (isFunctionResponseMessage(message)) {
              const preserved = buildPreservedWorkMessage(message);
              transcript = [
                ...transcript,
                messageEntry,
                { role: "model", parts: [{ text: preserved }] },
              ];
              yield makeSyntheticTextChunk(preserved);
              return;
            }

            const exhaustedError = lastError instanceof Error
              ? lastError
              : new Error("All configured Gemini models failed to respond.");
            Object.assign(exhaustedError, { jobrakerFallbackExhausted: true });
            throw exhaustedError;
          })();
        };

        return new Proxy(resilientChat, {
          get(targetObject, property, receiver) {
            if (Reflect.has(targetObject, property)) {
              return Reflect.get(targetObject, property, receiver);
            }
            const value = activeNativeChat?.[property as any];
            return typeof value === "function" ? value.bind(activeNativeChat) : value;
          },
        });
      };
    },
  });

  return new Proxy(nativeAi, {
    get(target, property, receiver) {
      if (property === "chats") return resilientChats;
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export const createGeminiClient = () => {
  const apiKey = resolveGeminiApiKey();
  return createResilientGeminiClient(apiKey);
};

/**
 * Try `fn` with the given model. On retryable provider failure or model not
 * found, cascade through fallback models before giving up.
 */
export async function withModelFallback<T>(
  fn: (model: string) => Promise<T>,
  primaryModel: string = GEMINI_MODEL,
): Promise<{ result: T; modelUsed: string }> {
  const chain = [...new Set([primaryModel, ...MODEL_FALLBACK_CHAIN])];
  let lastError: unknown;
  for (const model of chain) {
    try {
      const result = await fn(model);
      return { result, modelUsed: model };
    } catch (error) {
      lastError = error;
      const isNotFound = isModelNotFoundError(error);
      if (!isGeminiRateLimitError(error) && !isNotFound) {
        throw error;
      }
      console.warn(
        `[Gemini] ${model} failed (${isNotFound ? "not found" : "retryable provider error"}), falling back…`,
      );
    }
  }
  throw lastError;
}

// Standard tools configuration
export const GEMINI_TOOLS = [
  { urlContext: {} },
  { googleSearch: {} },
];

// Standard config with thinking enabled
export const createGeminiConfig = (
  options?: {
    systemInstruction?: string;
    responseMimeType?: string;
    includeTools?: boolean;
    thinkingLevel?: "LOW" | "MEDIUM" | "HIGH";
    maxOutputTokens?: number;
  },
  modelName?: string,
) => {
  const thinkingLevel = options?.thinkingLevel
    ? ThinkingLevel[options.thinkingLevel]
    : undefined;
  const supportsThinking = modelName
    ? (
      modelName.toLowerCase().includes("thinking") ||
      modelName.toLowerCase().includes("gemini-3") ||
      modelName.toLowerCase().includes("3.0") ||
      modelName.toLowerCase().includes("3.1") ||
      modelName.toLowerCase().includes("3.5") ||
      modelName.toLowerCase().includes("3.6")
    )
    : false;

  return {
    ...(thinkingLevel && supportsThinking
      ? {
        thinkingConfig: {
          thinkingLevel,
        },
      }
      : {}),
    ...(options?.includeTools ? { tools: GEMINI_TOOLS } : {}),
    responseMimeType: options?.responseMimeType || "application/json",
    ...(options?.systemInstruction
      ? {
        systemInstruction: {
          role: "system",
          parts: [{ text: options.systemInstruction }],
        },
      }
      : {}),
    ...(typeof options?.maxOutputTokens === "number" && options.maxOutputTokens > 0
      ? { maxOutputTokens: options.maxOutputTokens }
      : {}),
  };
};

/**
 * Safely extract text from a Gemini generateContent response.
 * Handles multiple SDK response shapes:
 *  - response.text (string property or getter)
 *  - response.text() (function in older SDK versions)
 *  - response.candidates[0].content.parts[0].text (raw structure)
 */
export function extractGeminiText(response: any): string {
  if (typeof response?.text === "string" && response.text.length > 0) {
    return response.text;
  }
  if (typeof response?.text === "function") {
    try {
      const val = response.text();
      if (typeof val === "string" && val.length > 0) return val;
    } catch {
      // Fall through.
    }
  }
  try {
    const parts = response?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      const textParts = parts
        .filter((p: any) => typeof p?.text === "string")
        .map((p: any) => p.text);
      if (textParts.length > 0) return textParts.join("");
    }
  } catch {
    // Fall through.
  }
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

export interface GenerateGeminiDescriptionOptions {
  /** The authenticated user that initiated the job-search enrichment. */
  userId: string;
  featureKey?: string;
  maxOutputTokens?: number;
}

export const generateGeminiDescription = async (
  rawHtml: string,
  rawMarkdown: string,
  fallbackDescription: string,
  jobTitle: string,
  options: GenerateGeminiDescriptionOptions,
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
    const response = await runMeteredAiCall({
      serviceClient: getAdminSupabaseClient(),
      userId: options.userId,
      featureKey: options.featureKey || "job_search_enrichment",
      model: GEMINI_MODEL,
      promptTextLength: combinedContent.length,
      maxOutputTokens: options.maxOutputTokens || 2_048,
      payload: { jobTitle, rawHtml, rawMarkdown, fallbackDescription },
      execute: async ({ maxOutputTokens }) => {
        const { result } = await withModelFallback(
          (model) => ai.models.generateContent({
            model,
            config: createGeminiConfig({
              systemInstruction: systemPrompt,
              responseMimeType: "application/json",
              maxOutputTokens,
            }, model),
            contents: [
              {
                role: "user",
                parts: [{ text: combinedContent }],
              },
            ],
          }),
          GEMINI_MODEL,
        );
        return result;
      },
    });

    const text = extractGeminiText(response);
    if (!text) throw new Error("Empty response from Gemini");
    return JSON.parse(text) as AiDescriptionResponse;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to generate Gemini description: ${message}`);
  }
};

export {
  runMeteredAiCall,
  runInternalUnmeteredAiCall,
  estimatePreflightReservationNanos,
  reserveAiUsage,
  settleAiUsage,
  releaseAiUsage,
  MeteredAiLimitError,
  hashPayload,
  extractProviderTokenUsage,
} from "./metered-ai.ts";

export async function generateGeminiContent(
  prompt: string,
  options: {
    temperature?: number;
    response_mime_type?: string;
    responseMimeType?: string;
    model?: string;
    userId?: string;
    featureKey?: string;
    requestId?: string;
    maxOutputTokens?: number;
  } = {},
): Promise<string> {
  const ai = createGeminiClient();
  const responseMimeType = options.responseMimeType || options.response_mime_type;
  const targetModel = options.model || GEMINI_MODEL;

  if (options.userId) {
    const supabaseAdmin = getAdminSupabaseClient();
    const result = await runMeteredAiCall({
      serviceClient: supabaseAdmin,
      userId: options.userId,
      featureKey: options.featureKey || "general_ai",
      model: targetModel,
      maxOutputTokens: options.maxOutputTokens || 2048,
      payload: { prompt },
      execute: async (meta) => {
        const { result: rawResponse } = await withModelFallback(
          (model) =>
            ai.models.generateContent({
              model,
              config: {
                ...createGeminiConfig(
                  {
                    responseMimeType: responseMimeType || "text/plain",
                    maxOutputTokens: meta.maxOutputTokens,
                  },
                  model,
                ),
                ...(typeof options.temperature === "number"
                  ? { temperature: options.temperature }
                  : {}),
              },
              contents: prompt,
            }),
          targetModel,
        );
        return rawResponse;
      },
    });
    return extractGeminiText(result);
  }

  const { result } = await withModelFallback(
    (model) =>
      ai.models.generateContent({
        model,
        config: {
          ...createGeminiConfig(
            {
              responseMimeType: responseMimeType || "text/plain",
            },
            model,
          ),
          ...(typeof options.temperature === "number"
            ? { temperature: options.temperature }
            : {}),
        },
        contents: prompt,
      }),
    targetModel,
  );

  return extractGeminiText(result);
}
