
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createGeminiClient, GEMINI_MODEL, createGeminiConfig, extractGeminiText } from "../_shared/gemini.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  SubscriptionAccessError,
  requireSubscriptionTier,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";

interface PolishContentRequest {
  content: string;
  instruction?: string;
}

const POLISH_SCHEMA = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: { type: "string", enum: ["enhancement", "correction", "professional"] },
          label: { type: "string" },
          content: { type: "string" },
          isRecommended: { type: "boolean" }
        },
        required: ["id", "type", "label", "content"]
      }
    }
  },
  required: ["suggestions"]
};

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
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    await requireSubscriptionTier(req, "Basics", "AI writing tools");
    const { content, instruction } = await req.json();

    if (!content) {
      return new Response(JSON.stringify({ error: "Content is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ai = createGeminiClient();
    const prompt = buildPrompt(content, instruction);

    const result = await ai.models.generateContent({
        model: GEMINI_MODEL,
        config: createGeminiConfig({ 
            systemInstruction: "You are a resume polishing assistant. Return ONLY valid JSON matching the requested schema.",
            responseMimeType: "application/json"
        }),
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });

    const text = extractGeminiText(result);
    if (!text) throw new Error("Empty response from AI");
    
    const parsed = JSON.parse(text);
    return new Response(JSON.stringify(parsed), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    if (error instanceof SubscriptionAccessError) {
      return subscriptionErrorResponse(error, corsHeaders);
    }
    console.error("Error in polish-content:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
