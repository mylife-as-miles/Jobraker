
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createGeminiClient, GEMINI_MODEL, GEMINI_TOOLS } from "../_shared/gemini.ts";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Supabase Edge Function: ai-chat
 * Streaming chat completion using Gemini 3 Pro.
 */

interface UIMessagePart { text?: string }
interface UIMessage { id?: string; role: string; content?: string; parts?: UIMessagePart[] }
interface ChatBody { model?: string; messages: UIMessage[]; webSearch?: boolean; system?: string; previous_response_id?: string }

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const body: ChatBody = await req.json();
        const { messages, system } = body;

        const ai = createGeminiClient();

        // Separate system instruction from messages
        let systemInstruction = system;
        const geminiContent = [];

        if (Array.isArray(messages)) {
            for (const msg of messages) {
                const role = msg.role === 'assistant' ? 'model' : 'user';
                const text = (msg.parts?.map(p => p.text).join('\n') || msg.content || '').trim();
                
                if (msg.role === 'system') {
                    systemInstruction = systemInstruction ? `${systemInstruction}\n${text}` : text;
                } else if (text) {
                    geminiContent.push({
                        role,
                        parts: [{ text }]
                    });
                }
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

        const bodyStream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();

                try {
                    for await (const chunk of stream) {
                        const text = (typeof chunk.text === 'function' ? chunk.text() : chunk.text);
                        if (text) {
                            const data = JSON.stringify({ delta: text });
                            const message = `event: message\ndata: ${data}\n\n`;
                            controller.enqueue(encoder.encode(message));
                        }
                    }

                    const doneMessage = `event: done\ndata: [DONE]\n\n`;
                    controller.enqueue(encoder.encode(doneMessage));
                    controller.close();
                } catch (e: any) {
                    const errorData = JSON.stringify({ error: e.message });
                    const errorMessage = `event: error\ndata: ${errorData}\n\n`;
                    controller.enqueue(encoder.encode(errorMessage));
                    controller.close();
                }
            },
        });

        return new Response(bodyStream, {
            headers: {
                ...corsHeaders,
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        });

    } catch (error: any) {
        console.error("AI Chat Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});
