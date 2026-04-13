
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createGeminiClient,
  GEMINI_MODEL,
  GEMINI_TOOLS,
  getGeminiAccessDeniedMessage,
  isGeminiAccessDeniedError,
  extractGeminiText
} from "../_shared/gemini.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { fetchUserContext, formatUserContextForPrompt } from "../_shared/user-context.ts";
import { APP_INTERFACE_GUIDE } from "../_shared/app-map.ts";
import {
  SubscriptionAccessError,
  requireSubscriptionTier,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";

console.log("JobRaker AI Chat Starting...");

const AGENT_FUNCTION_DECLARATIONS = [
  {
    name: "run_job_search",
    description: "Search for job listings based on a query and location.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Job search query, e.g. 'software engineer'" },
        location: { type: "string", description: "Location, e.g. 'Remote' or 'New York'" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_user_profile",
    description: "Get the user's career profile (skills, experience, headline).",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "list_applications",
    description: "List the user's job applications and their statuses.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_credits_balance",
    description: "Check remaining AI credits.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "list_recent_jobs",
    description: "Get the latest discovered job listings.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Default 10" },
      },
    },
  },
  {
      name: "apply_to_job",
      description: "Apply to a job using a job ID.",
      parameters: {
          type: "object",
          properties: {
              job_id: { type: "string" },
              cover_letter: { type: "string" }
          },
          required: ["job_id"]
      }
  }
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { messages, system, mode = "ask" } = await req.json();
    const { authHeader, user } = await requireSubscriptionTier(req, "Pro", "AI chat");

    const genAI = createGeminiClient();
    const userId = user.id;
    const userContext = await fetchUserContext(user.id, authHeader);

    let systemInstruction = system || "";
    systemInstruction += `\n\n${APP_INTERFACE_GUIDE}`;
    
    if (userContext) {
      const contextStr = formatUserContextForPrompt(userContext);
      systemInstruction = `User Info:\n${contextStr}\n\n${systemInstruction}`;
      if (mode === "agent") {
          systemInstruction = `You are JobRaker Agent. Be proactive, use tools to help the user. Confirm before applying.\n\n${systemInstruction}`;
      }
    }

    const modelParams: any = { model: GEMINI_MODEL, systemInstruction };
    if (mode === "agent") {
      modelParams.tools = [{ functionDeclarations: AGENT_FUNCTION_DECLARATIONS }];
    } else {
      modelParams.tools = [{ googleSearchRetrieval: {} }];
    }

    const model = genAI.getGenerativeModel(modelParams);

    const history = messages.slice(0, -1).map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const userPrompt = messages[messages.length - 1].content;

    const body = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const enqueueEvent = (ev: string, data: any) => {
          const payload = typeof data === "string" ? data : JSON.stringify(data);
          controller.enqueue(encoder.encode(`event: ${ev}\ndata: ${payload}\n\n`));
        };

        try {
          if (mode === "agent") {
            const chat = model.startChat({ history });
            let response = await chat.sendMessage(userPrompt);
            let turnCount = 0;

            while (turnCount < 5) {
              turnCount++;
              const parts = response.response.candidates?.[0]?.content?.parts || [];
              const text = parts.find(p => p.text)?.text;
              const functionCalls = parts.filter(p => p.functionCall);

              if (text) enqueueEvent("message", { delta: text });

              if (functionCalls.length > 0) {
                const toolResults = [];
                for (const fc of functionCalls) {
                  const fn = fc.functionCall;
                  console.log(`[Agent] Executing: ${fn.name}`);
                  let result;
                  try {
                    if (fn.name === "run_job_search") {
                      const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/jobs-search`, {
                        method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader! },
                        body: JSON.stringify({ searchQuery: fn.args.query, location: fn.args.location })
                      });
                      result = await res.json();
                    } else if (fn.name === "get_credits_balance") {
                      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
                      const { data } = await admin.from("user_credits").select("balance").eq("user_id", userId).single();
                      result = { success: true, balance: data?.balance || 0 };
                    } else if (fn.name === "get_user_profile") {
                        result = { success: true, profile: userContext };
                    } else {
                      const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/${fn.name.replace(/_/g, "-")}`, {
                        method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader! },
                        body: JSON.stringify(fn.args)
                      });
                      result = await res.json();
                    }
                  } catch (e: any) { result = { error: e.message }; }

                  toolResults.push({ functionResponse: { name: fn.name, response: result } });
                  enqueueEvent("tool_call", { name: fn.name, args: fn.args, result });
                }
                // Continue turn
                response = await chat.sendMessage(toolResults);
              } else {
                break;
              }
            }
          } else {
            const result = await model.generateContentStream({
              contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            });
            for await (const chunk of result.stream) {
              const text = chunk.text();
              if (text) enqueueEvent("message", { delta: text });
            }
          }
          enqueueEvent("done", "[DONE]");
          controller.close();
        } catch (e: any) {
          console.error("Agent Loop Error:", e);
          enqueueEvent("error", { error: e.message });
          controller.close();
        }
      },
    });

    return new Response(body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" }
    });

  } catch (error: any) {
    console.error("Outer Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500
    });
  }
});
