
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
  runMeteredAiCall,
  createSafeAiErrorResponse,
} from "../_shared/gemini.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  parseStructuredJson,
  stripCodeFences,
  extractJsonCandidate,
} from "../_shared/structured-json.ts";
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

import {
  PolishSuggestion,
  PolishContentResponse,
  polishTextHeuristically,
  extractSuggestionContent,
  extractSuggestionsArray,
  normalizeSuggestion,
  buildFallbackPolishResponse,
  normalizePolishResponse,
} from "../_shared/polish-content-utils.ts";

function buildPrompt(content: string, instruction?: string): string {
  return `You are a world-class executive resume writer and ATS optimization specialist.

Your task is to transform and polish the following resume content into elite, high-impact bullet points/summaries:
"${content}"

${instruction ? `Target Context / Special Instruction: ${instruction}` : ''}

CRITICAL RULES:
1. Under NO circumstances should you return the input text verbatim or unchanged. The rewritten text in each suggestion MUST visibly differ from and elevate the original input.
2. Use Google's XYZ formula: "Accomplished [X], as measured by [Y], by doing [Z]" whenever applicable.
3. Lead with powerful, high-impact action verbs (e.g., Engineered, Orchestrated, Spearheaded, Accelerated, Maximized, Streamlined).
4. Insert realistic metric place-holders or quantified impacts (e.g., "+35% efficiency", "reduced latency by 40ms", "$2.5M ARR") if exact numbers aren't specified.
5. Keep syntax sharp, active, concise, and 100% free of fluff or passive language.

Please provide exactly 3 distinct high-caliber suggestions:
1. "High Impact & Metrics" (Type: enhancement): Heavily optimized with metrics, strong action verbs, and quantifiable achievements. (isRecommended: true)
2. "Executive & Leadership Tone" (Type: professional): Tailored for senior leadership, highlighting scope, strategy, cross-functional impact, and governance.
3. "Targeted ATS Optimization" (Type: correction): Standardized industry keywords, clear ATS-friendly phrasing, and punchy syntax.

Return the result as a JSON object with a "suggestions" array.
Each suggestion must have:
- id: String ("1", "2", "3")
- type: "enhancement", "professional", or "correction"
- label: Short descriptive label (e.g., "Metrics & Action-Driven", "Executive Leadership", "ATS Keyword Optimized")
- content: The rewritten high-impact text (MUST visibly differ from the input text)
- isRecommended: true ONLY for suggestion "1".
`;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { user, serviceClient, subscriptionTier } = await requireSubscriptionTier(req, "Starter", "AI writing tools");
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
      const metered = await runMeteredAiCall({
        userId: user.id,
        featureKey: "polish_content",
        model: GEMINI_MODEL,
        promptTextLength: prompt.length,
        execute: async ({ maxOutputTokens }) => {
          const { result: rawResponse, modelUsed } = await withModelFallback(
            (model) => withGeminiRetry(() => ai.models.generateContent({
              model,
              config: createGeminiConfig({ 
                systemInstruction: "You are an executive resume polishing assistant. Return ONLY valid JSON matching the requested schema. All rewritten text must significantly differ from and improve upon the input.",
                responseMimeType: "application/json",
                maxOutputTokens,
              }, model),
              contents: [{ role: 'user', parts: [{ text: prompt }] }]
            })),
            GEMINI_MODEL
          );
          return {
            result: rawResponse,
            usageMetadata: (rawResponse as any)?.usageMetadata,
            modelUsed,
          };
        },
      });

      const text = extractGeminiText(metered.result);
      if (!text) throw new Error("Empty response from AI");
      try {
        parsed = parseStructuredJson(text);
      } catch {
        try {
          parsed = parseStructuredJson(extractJsonCandidate(text));
        } catch {
          parsed = { content: stripCodeFences(text).trim() };
        }
      }
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
    return createSafeAiErrorResponse(error, corsHeaders);
  }
});
