
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createGeminiClient,
  createGeminiConfig,
  extractGeminiText,
  GEMINI_MODEL,
  withModelFallback,
} from "../_shared/gemini.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  requireAuthenticatedUser,
  SubscriptionAccessError,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";
import {
  enforceFeatureRateLimit,
  recordFeatureUsage,
} from "../_shared/feature-limits.ts";

console.log("Hello from generate-title!");

const buildFallbackTitle = (message: string): string => {
  const cleaned = message
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[#*_`>\[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "New Chat";
  }

  const lower = cleaned.toLowerCase();

  if (lower.includes("resume")) {
    return "Resume Help";
  }
  if (lower.includes("cover letter")) {
    return "Cover Letter Help";
  }
  if (lower.includes("interview")) {
    return "Interview Prep";
  }
  if (lower.includes("job") || lower.includes("career")) {
    return "Job Search Help";
  }

  const words = cleaned.split(" ").slice(0, 6).join(" ");
  return words.length > 50 ? `${words.slice(0, 47)}...` : words;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user, serviceClient } = await requireAuthenticatedUser(req);
    const subscriptionTier = await enforceFeatureRateLimit({
      userId: user.id,
      featureKey: "generate_title",
      serviceClient,
    });
    const { message } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let title = buildFallbackTitle(message);

    try {
      const ai = createGeminiClient();
      const systemPrompt = `
        You are a helpful assistant that generates concise and descriptive titles for chat sessions based on the first user message.
        The title should be short (under 50 characters), summarizing the user's intent.
        Examples:
        User: "Can you help me rewrite my resume for a senior dev role?" -> "Resume Rewrite: Senior Dev"
        User: "I need interview practice for product management." -> "Interview Prep: PM"
        User: "What is the capital of France?" -> "General Inquiry"
        User: "Write a cover letter for Amazon." -> "Cover Letter: Amazon"
        Do not include quotes in the output. Just the title text.
      `;

      const { result: response } = await withModelFallback((model) =>
        ai.models.generateContent({
          model,
          config: createGeminiConfig({
            systemInstruction: systemPrompt,
            responseMimeType: "text/plain",
          }),
          contents: [{ role: "user", parts: [{ text: message }] }],
        })
      );

      title = extractGeminiText(response)?.trim() || title;
    } catch (error) {
      console.warn("generate-title fallback", error);
    }
    
    // Ensure title isn't too long
    const cleanTitle = title.length > 50 ? title.substring(0, 47) + "..." : title;

    await recordFeatureUsage({
      userId: user.id,
      featureKey: "generate_title",
      serviceClient,
      subscriptionTier,
    });

    return new Response(JSON.stringify({ title: cleanTitle }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    if (error instanceof SubscriptionAccessError) {
      return subscriptionErrorResponse(error, corsHeaders);
    }
    console.error("Error generating title:", error);
    return new Response(JSON.stringify({ title: "New Chat" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
