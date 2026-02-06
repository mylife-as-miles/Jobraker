
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createGeminiClient, GEMINI_MODEL, GEMINI_TOOLS } from "../_shared/gemini.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { messages, system } = await req.json();

        const ai = createGeminiClient();

        // Separate system instruction from messages
        let systemInstruction = system;
        const geminiContent = [];

        for (const msg of messages) {
            if (msg.role === 'system') {
                systemInstruction = systemInstruction ? `${systemInstruction}\n${msg.content}` : msg.content;
            } else {
                geminiContent.push({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: msg.content }]
                });
            }
        }

        const config = {
            thinkingConfig: {
                thinkingLevel: 'HIGH',
            },
            tools: GEMINI_TOOLS,
            ...(systemInstruction ? { systemInstruction } : {}),
        };

        const stream = await ai.models.generateContentStream({
            model: GEMINI_MODEL,
            config,
            contents: geminiContent,
        });

        const body = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();

                try {
                    for await (const chunk of stream) {
                        const text = chunk.text();
                        if (text) {
                            const data = JSON.stringify({ delta: text });
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
        console.error("AI Chat Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});
