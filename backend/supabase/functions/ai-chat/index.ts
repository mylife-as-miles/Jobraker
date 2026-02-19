
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createGeminiClient, GEMINI_MODEL, GEMINI_TOOLS } from "../_shared/gemini.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { fetchUserContext, formatUserContextForPrompt } from "../_shared/user-context.ts";
import { APP_INTERFACE_GUIDE } from "../_shared/app-map.ts";

console.log("Hello from ai-chat!");

// Agent mode function declarations for Gemini
const AGENT_FUNCTION_DECLARATIONS = [
  {
    name: "run_job_search",
    description: "Search for job listings based on a query and location. Use this when the user asks to find jobs.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Job search query, e.g. 'software engineer'" },
        location: { type: "string", description: "Location for the job search, e.g. 'Remote' or 'New York'" },
      },
      required: ["query"],
    },
  },
  {
    name: "apply_to_job",
    description: "Apply to a specific job on behalf of the user. Use when user explicitly asks to apply.",
    parameters: {
      type: "object",
      properties: {
        job_id: { type: "string", description: "The UUID of the job listing to apply to" },
        cover_letter: { type: "string", description: "Optional custom cover letter text" },
      },
      required: ["job_id"],
    },
  },
  {
    name: "analyze_resume",
    description: "Analyze the user's resume and provide improvement suggestions.",
    parameters: {
      type: "object",
      properties: {
        target_role: { type: "string", description: "Optional target role to optimize the resume for" },
      },
    },
  },
  {
    name: "get_job_matches",
    description: "Get job matches for the user based on their profile and resume.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of matches to return, default 10" },
      },
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const { messages, system, mode = "ask" } = await req.json();

    const ai = createGeminiClient();

    // Get user context if authenticated
    let userContext = null;
    let userId = null;
    if (authHeader) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
        userContext = await fetchUserContext(user.id, authHeader);
      }
    }

    // Build system instruction based on mode
    let systemInstruction = system || "";
    
    // Inject App Interface Guide for ALL modes so it knows where it is
    systemInstruction += `\n\n${APP_INTERFACE_GUIDE}`;
    
    if (mode === "ask" && userContext) {
      // RAG mode: inject user context
      const contextStr = formatUserContextForPrompt(userContext);
      systemInstruction = `You are JobRaker AI, a helpful career assistant. You know the following about the user you are helping:\n\n${contextStr}\n\nUse this information to personalize your responses. Address the user by name when appropriate.\n\n${systemInstruction}`;
    } else if (mode === "agent") {
      // Agent mode: enable function calling
      systemInstruction = `You are JobRaker Agent, an autonomous AI assistant that can take actions on behalf of the user. You have access to tools to search for jobs, apply to positions, and analyze resumes. Always confirm before taking irreversible actions. Be proactive and helpful.\n\n${systemInstruction}`;
    }

    // Prepare Gemini content
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

    // Configure based on mode
    const config: any = {
      thinkingConfig: { thinkingLevel: 'HIGH' },
      ...(systemInstruction ? { systemInstruction } : {}),
    };

    if (mode === "agent") {
      // Enable function calling for agent mode
      config.tools = [{ functionDeclarations: AGENT_FUNCTION_DECLARATIONS }];
    } else {
      // Ask mode uses web search tools
      config.tools = GEMINI_TOOLS;
    }

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
            // Handle text responses
            const text = typeof chunk.text === 'function' ? chunk.text() : chunk.text;
            if (text) {
              const data = JSON.stringify({ delta: text });
              const message = `event: message\ndata: ${data}\n\n`;
              controller.enqueue(encoder.encode(message));
            }

            // Handle function calls (Agent mode)
            const functionCalls = chunk.candidates?.[0]?.content?.parts?.filter(
              (p: any) => p.functionCall
            );

            if (functionCalls?.length > 0 && userId) {
              for (const part of functionCalls) {
                const fn = part.functionCall;
                console.log(`[Agent] Function call: ${fn.name}`, fn.args);

                let result = { success: false, message: "Unknown function" };

                try {
                  if (fn.name === "run_job_search") {
                    // Call jobs-search function
                    const searchUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/jobs-search`;
                    const searchRes = await fetch(searchUrl, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: authHeader!,
                      },
                      body: JSON.stringify({
                        searchQuery: fn.args.query,
                        location: fn.args.location || "",
                      }),
                    });
                    result = await searchRes.json();
                  } else if (fn.name === "apply_to_job") {
                    // Insert application
                    const supabaseAdmin = createClient(
                      Deno.env.get("SUPABASE_URL")!,
                      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
                    );
                    const { error } = await supabaseAdmin.from("applications").insert({
                      user_id: userId,
                      job_listing_id: fn.args.job_id,
                      status: "applied",
                      cover_letter: fn.args.cover_letter || null,
                    });
                    result = error 
                      ? { success: false, message: error.message }
                      : { success: true, message: "Application submitted successfully!" };
                  } else if (fn.name === "analyze_resume") {
                    // Call analyze-resume function
                    const analyzeUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/analyze-resume`;
                    const analyzeRes = await fetch(analyzeUrl, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: authHeader!,
                      },
                      body: JSON.stringify({ targetRole: fn.args.target_role }),
                    });
                    result = await analyzeRes.json();
                  } else if (fn.name === "get_job_matches") {
                    // Fetch job matches from DB
                    const supabaseAdmin = createClient(
                      Deno.env.get("SUPABASE_URL")!,
                      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
                    );
                    const { data: matches } = await supabaseAdmin
                      .from("job_matches")
                      .select("job_listings(title, company, location)")
                      .eq("user_id", userId)
                      .order("match_score", { ascending: false })
                      .limit(fn.args.limit || 10);
                    result = { success: true, matches: matches || [] };
                  }
                } catch (e: any) {
                  result = { success: false, message: e.message };
                }

                // Send function result back to stream
                const fnData = JSON.stringify({
                  functionCall: fn.name,
                  result,
                });
                const fnMessage = `event: function_result\ndata: ${fnData}\n\n`;
                controller.enqueue(encoder.encode(fnMessage));
              }
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

    return new Response(body, {
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
