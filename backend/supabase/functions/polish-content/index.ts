
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
    .slice(0, 3)
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
  return `You are a world-class executive resume writer and ATS optimization specialist.

Your task is to transform and polish the following resume content into elite, high-impact bullet points/summaries:
"${content}"

${instruction ? `Target Context / Special Instruction: ${instruction}` : ''}

Rules for rewriting:
1. Use Google's XYZ formula: "Accomplished [X], as measured by [Y], by doing [Z]" whenever applicable.
2. Lead with powerful, high-impact action verbs (e.g., Engineered, Orchestrated, Spearheaded, Accelerated, Maximized, Streamlined).
3. Insert realistic metric place-holders or quantified impacts (e.g., "+35% efficiency", "reduced latency by 40ms", "$2.5M ARR") if exact numbers aren't specified.
4. Keep syntax sharp, active, concise, and 100% free of fluff or passive language.

Please provide exactly 3 distinct high-caliber suggestions:
1. "High Impact & Metrics" (Type: enhancement): Heavily optimized with metrics, strong action verbs, and quantifiable achievements. (isRecommended: true)
2. "Executive & Leadership Tone" (Type: professional): Tailored for senior leadership, highlighting scope, strategy, cross-functional impact, and governance.
3. "Targeted ATS Optimization" (Type: correction): Standardized industry keywords, clear ATS-friendly phrasing, and punchy syntax.

Return the result as a JSON object with a "suggestions" array.
Each suggestion must have:
- id: String ("1", "2", "3")
- type: "enhancement", "professional", or "correction"
- label: Short descriptive label (e.g., "Metrics & Action-Driven", "Executive Leadership", "ATS Keyword Optimized")
- content: The rewritten high-impact text
- isRecommended: true ONLY for suggestion "1".
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
