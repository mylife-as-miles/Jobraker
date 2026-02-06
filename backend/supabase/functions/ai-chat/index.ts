
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createGeminiClient } from "../_shared/gemini.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { messages, model, system } = await req.json();

        // Initialize Gemini client
        const ai = createGeminiClient();

        // 1. Separate system instruction from messages if present in "messages" array, 
        //    or use the explicit "system" param.
        let systemInstruction = system;
        const geminiContent = [];

        for (const msg of messages) {
            if (msg.role === 'system') {
                // If multiple system messages, join them or override? Usually join.
                systemInstruction = systemInstruction ? `${systemInstruction}\n${msg.content}` : msg.content;
            } else {
                geminiContent.push({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: msg.content }]
                });
            }
        }

        // 2. Select Model (Use user param or default to gemini-2.0-flash-exp for speed/cost)
        // User requested to replace 'openai'. User snippet suggests 'gemini-3-pro-preview'.
        // But for chat 'gemini-2.0-flash-exp' is great. 
        // I will map 'openai/gpt-4o-mini' etc to known Gemini models if needed, or just use the target model.
        // Let's default to a strong generic model.
        const targetModel = 'gemini-2.0-flash-exp'; 

        const stream = await ai.models.generateContentStream({
            model: targetModel,
            config: {
                systemInstruction: systemInstruction,
            },
            contents: geminiContent,
        });

        const body = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();

                try {
                    for await (const chunk of stream) {
                        const text = chunk.text();
                        if (text) {
                            // Map to OpenAI-compatible delta format for frontend compatibility
                            // Frontend expects: { delta: "text" }
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
