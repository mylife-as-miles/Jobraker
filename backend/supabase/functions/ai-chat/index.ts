import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { OpenAI } from "https://esm.sh/openai";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { messages, model, system } = await req.json();

        const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
        if (!OPENAI_API_KEY) {
            throw new Error("Missing OPENAI_API_KEY environment variable");
        }

        const openai = new OpenAI({
            apiKey: OPENAI_API_KEY,
        });

        const systemMessage = system ? [{ role: "system", content: system }] : [];
        const allMessages = [...systemMessage, ...messages];

        const stream = await openai.chat.completions.create({
            model: model || "gpt-4o-mini",
            messages: allMessages,
            stream: true,
        });

        const body = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();

                try {
                    for await (const chunk of stream) {
                        const content = chunk.choices[0]?.delta?.content || "";
                        if (content) {
                            const data = JSON.stringify({ delta: content });
                            const message = `event: message\ndata: ${data}\n\n`;
                            controller.enqueue(encoder.encode(message));
                        }
                    }

                    const doneMessage = `event: done\ndata: [DONE]\n\n`;
                    controller.enqueue(encoder.encode(doneMessage));
                    controller.close();
                } catch (e) {
                    const errorData = JSON.stringify({ error: e.message });
                    const errorMessage = `event: error\ndata: ${errorData}\n\n`;
                    controller.enqueue(encoder.encode(errorMessage));
                    controller.close();
                }
            },
        });

        return new Response(body, {
            headers: {
                ...corsHeaders,
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});
