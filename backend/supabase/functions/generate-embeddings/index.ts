import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { embedBatch, embedText } from "../_shared/embeddings.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { text, texts, model } = body;

    if (Array.isArray(texts)) {
      const embeddings = await embedBatch(texts, { model });
      return new Response(JSON.stringify({ embeddings }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof text === "string") {
      const embedding = await embedText(text, { model });
      return new Response(JSON.stringify({ embedding }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Provide 'text' (string) or 'texts' (array of strings)." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Embeddings function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
