import { createGeminiClient, GEMINI_MODEL } from "../_shared/gemini.ts";
import { getCorsHeaders } from "../_shared/types.ts";

interface UIMessagePart { text?: string }
interface UIMessage { id?: string; role: string; content?: string; parts?: UIMessagePart[] }
interface ChatBody {
  model?: string;
  messages: UIMessage[];
  webSearch?: boolean;
  system?: string;
  mode?: "ask" | "agent";
  previous_response_id?: string;
}

Deno.serve(async (req) => {
    const origin = req.headers.get("origin");
    const cors = getCorsHeaders(origin || undefined);

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: cors });
    }

    try {
        const body: ChatBody = await req.json();
        const { messages, system, mode = "ask", webSearch } = body;

        const ai = createGeminiClient();

        let systemInstruction = system;
        const geminiContent: { role: string; parts: { text: string }[] }[] = [];

        if (Array.isArray(messages)) {
            for (const msg of messages) {
                const role = msg.role === "assistant" ? "model" : "user";
                const text = (msg.parts?.map((p) => p.text).join("\n") || msg.content || "").trim();

                if (msg.role === "system") {
                    systemInstruction = systemInstruction ? `${systemInstruction}\n${text}` : text;
                } else if (text) {
                    geminiContent.push({ role, parts: [{ text }] });
                }
            }
        }

        const useTools = mode === "agent" || webSearch;
        const tools = useTools
            ? [{ googleSearch: {} }]
            : undefined;

        const config: Record<string, unknown> = {
            ...(tools ? { tools } : {}),
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
                let sentAny = false;

                const send = (event: string, payload: string) => {
                    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${payload}\n\n`));
                };

                try {
                    for await (const chunk of stream) {
                        const text = typeof chunk.text === "function" ? chunk.text() : chunk.text;
                        if (text) {
                            send("message", JSON.stringify({ delta: text }));
                            sentAny = true;
                        }
                    }

                    if (!sentAny) {
                        send("message", JSON.stringify({ delta: "I wasn't able to generate a response. Please try rephrasing your question." }));
                    }
                    send("done", "[DONE]");
                    controller.close();
                } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : String(e);
                    console.error("ai-chat stream error:", msg);
                    send("error", JSON.stringify({ error: msg }));
                    controller.close();
                }
            },
        });

        return new Response(bodyStream, {
            headers: {
                ...cors,
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
            },
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("AI Chat Error:", msg);
        return new Response(JSON.stringify({ error: msg }), {
            headers: { ...cors, "Content-Type": "application/json" },
            status: 500,
        });
    }
});
