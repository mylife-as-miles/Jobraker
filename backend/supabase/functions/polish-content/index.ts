
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createGeminiClient,
  GEMINI_MODEL,
  createGeminiConfig,
  extractGeminiText,
  getGeminiAccessDeniedMessage,
  isGeminiAccessDeniedError,
  withGeminiRetry,
  withModelFallback,
} from "../_shared/gemini.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { parseStructuredJson } from "../_shared/structured-json.ts";
import {
  SubscriptionAccessError,
  requireSubscriptionTier,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";
import {
  enforceFeatureRateLimit,
  recordFeatureUsage,
} from "../_shared/feature-limits.ts";

interface PolishContentRequest {
  content: string;
  instruction?: string;
}

type PolishSuggestion = {
  id: string;
  type: "enhancement" | "correction" | "professional";
  label: string;
  content: string;
  isRecommended?: boolean;
};

type PolishContentResponse = {
  suggestions: PolishSuggestion[];
};

function sanitizeInput(text: string, maxLength: number): string {
  if (!text) return "";
  let sanitized = text.substring(0, maxLength);
  const injectionPatterns = [
    /ignore all previous instructions/gi,
    /disregard previous instructions/gi,
    /you are now a/gi,
    /system prompt/gi,
    /output the following/gi,
  ];
  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }
  return sanitized.trim();
}

function normalizeSuggestion(
  value: unknown,
  index: number,
  fallbackContent: string,
): PolishSuggestion {
  const record =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const type =
    record.type === "professional" || record.type === "correction"
      ? record.type
      : "enhancement";
  const content =
    typeof record.content === "string" && record.content.trim()
      ? record.content.trim()
      : fallbackContent;

  return {
    id:
      typeof record.id === "string" && record.id.trim()
        ? record.id.trim()
        : String(index + 1),
    type,
    label:
      typeof record.label === "string" && record.label.trim()
        ? record.label.trim()
        : type === "professional"
          ? "More Professional"
          : "Stronger Verbs + Metrics",
    content,
    isRecommended:
      typeof record.isRecommended === "boolean"
        ? record.isRecommended
        : index === 0,
  };
}

function normalizePolishResponse(
  parsed: unknown,
  fallbackContent: string,
): PolishContentResponse {
  const suggestions = Array.isArray((parsed as any)?.suggestions)
    ? (parsed as any).suggestions
    : [];
  const normalized = suggestions
    .slice(0, 2)
    .map((item, index) => normalizeSuggestion(item, index, fallbackContent))
    .filter((item) => item.content.trim().length > 0);

  if (normalized.length === 0) {
    return buildFallbackPolishResponse(fallbackContent);
  }

  return { suggestions: normalized };
}

function ensureSentence(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function buildFallbackPolishResponse(content: string): PolishContentResponse {
  const cleaned = ensureSentence(content);
  const fallbackContent = cleaned || content;

  return {
    suggestions: [
      {
        id: "1",
        type: "enhancement",
        label: "Cleaned Formatting",
        content: fallbackContent,
        isRecommended: true,
      },
      {
        id: "2",
        type: "professional",
        label: "Original Draft",
        content: fallbackContent,
      },
    ],
  };
}

function buildPrompt(content: string, instruction?: string): string {
  return `You are an expert career coach and professional copywriter.
  
  Your task is to improve the following resume content:
  "${content}"

  ${instruction ? `Specific Instruction: ${instruction}` : ''}

  Please provide exactly 2 distinct suggestions:
  1. "Enhancement": Focus on stronger action verbs, quantifiable metrics, and impact.
  2. "Professional": Focus on formal, corporate-appropriate tone and clarity.

  Return the result as a JSON object with a "suggestions" array.
  Each suggestion must have:
  - id: A unique string id (e.g. "1", "2")
  - type: "enhancement" or "professional"
  - label: A short label like "Stronger Verbs + Metrics" or "More Professional"
  - content: The rewritten text
  - isRecommended: true for the "enhancement" suggestion.
  `;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { user, serviceClient, subscriptionTier } = await requireSubscriptionTier(req, "Basics", "AI writing tools");
    await enforceFeatureRateLimit({
      userId: user.id,
      featureKey: "polish_content",
      serviceClient,
      subscriptionTier,
    });
    const { content, instruction } = (await req.json()) as PolishContentRequest;

    const safeContent = sanitizeInput(content || "", 12000);
    const safeInstruction = sanitizeInput(instruction || "", 2000);

    if (!safeContent) {
      return new Response(JSON.stringify({ error: "Content is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const prompt = buildPrompt(safeContent, safeInstruction);
    let parsed: unknown;

    try {
      const ai = createGeminiClient();
      const { result } = await withModelFallback((model) => ai.models.generateContent({
        model,
        config: createGeminiConfig({ 
            systemInstruction: "You are a resume polishing assistant. Return ONLY valid JSON matching the requested schema.",
            responseMimeType: "application/json"
        }),
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      }));

      const text = extractGeminiText(result);
      if (!text) throw new Error("Empty response from AI");
      parsed = parseStructuredJson(text);
    } catch (error: any) {
      console.error("polish-content falling back", error);
      if (isGeminiAccessDeniedError(error)) {
        console.warn(getGeminiAccessDeniedMessage("AI writing tools"));
      }
      parsed = buildFallbackPolishResponse(safeContent);
    }

    const response = normalizePolishResponse(parsed, safeContent);
    await recordFeatureUsage({
      userId: user.id,
      featureKey: "polish_content",
      serviceClient,
      subscriptionTier,
      metadata: {
        content_length: safeContent.length,
        has_instruction: Boolean(safeInstruction),
      },
    });
    return new Response(JSON.stringify(response), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    if (error instanceof SubscriptionAccessError) {
      return subscriptionErrorResponse(error, corsHeaders);
    }
    console.error("Error in polish-content:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
