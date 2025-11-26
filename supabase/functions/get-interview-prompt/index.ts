import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { OpenAI } from "https://esm.sh/openai";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { previousPrompt } = await req.json();

    const messages = [
      {
        role: "system",
        content: "You are a friendly and encouraging interview coach. Provide a concise, open-ended question to help a user practice for a job interview. Questions should be under 15 words and inspire a thoughtful response.",
      },
    ];

    if (previousPrompt) {
      messages.push({
        role: "user",
        content: `My previous question was: "${previousPrompt}". Give me a relevant follow-up question.`,
      });
    } else {
      messages.push({
        role: "user",
        content: "Give me an initial interview question.",
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages,
      max_tokens: 30,
    });

    const newPrompt = completion.choices[0]?.message?.content;

    return new Response(JSON.stringify({ prompt: newPrompt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
