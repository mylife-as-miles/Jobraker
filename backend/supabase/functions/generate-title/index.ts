
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createGeminiClient, GEMINI_MODEL, createGeminiConfig, extractGeminiText } from "../_shared/gemini.ts";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Hello from generate-title!");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { message } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp', // Use faster model for titles
      config: createGeminiConfig({ 
        systemInstruction: systemPrompt,
        responseMimeType: 'text/plain' 
      }),
      contents: [{ role: 'user', parts: [{ text: message }] }]
    });

    let title = "New Chat";
    try { title = extractGeminiText(response)?.trim() || "New Chat"; } catch { /* fallback */ }
    
    // Ensure title isn't too long
    const cleanTitle = title.length > 50 ? title.substring(0, 47) + "..." : title;

    return new Response(JSON.stringify({ title: cleanTitle }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error generating title:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
