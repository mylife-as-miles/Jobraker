
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createGeminiClient,
  GEMINI_MODEL,
  GEMINI_TOOLS,
  getGeminiAccessDeniedMessage,
  isGeminiAccessDeniedError,
  createGeminiConfig,
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
  {
    name: "get_user_profile",
    description: "Get the current user's full profile information, including their headline, experience, and skills. Use when you need to know more about the user.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "list_applications",
    description: "List the user's recent job applications and their current statuses (e.g., applied, interviewing, rejected).",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "list_resumes",
    description: "List all resumes the user has uploaded to their profile.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "generate_cover_letter",
    description: "Generate a professionally tailored cover letter for a specific job description using the user's resume.",
    parameters: {
      type: "object",
      properties: {
        job_description: { type: "string", description: "The full job description to tailor the letter for." },
        instructions: { type: "string", description: "Optional specific instructions or focus points for the letter." },
      },
      required: ["job_description"],
    },
  },
  {
    name: "tailor_resume",
    description: "Tailor the user's resume for a specific job description to improve ATS compatibility and relevance.",
    parameters: {
      type: "object",
      properties: {
        job_description: { type: "string", description: "The job description to tailor the resume for." },
        instructions: { type: "string", description: "Optional specific instructions to the resume writer." },
      },
      required: ["job_description"],
    },
  },
  {
    name: "evaluate_job_fit",
    description: "Analyze how well the user's profile and resume match a job description. Returns a score and detailed breakdown.",
    parameters: {
      type: "object",
      properties: {
        job_description: { type: "string", description: "The job description to evaluate." },
      },
      required: ["job_description"],
    },
  },
  {
    name: "schedule_interview",
    description: "Record an upcoming interview in the system. Use when the user says they have an interview scheduled.",
    parameters: {
      type: "object",
      properties: {
        application_id: { type: "string", description: "The UUID of the job application" },
        date_time: { type: "string", description: "Date and time of the interview (ISO format)" },
        notes: { type: "string", description: "Optional notes about the interview" },
      },
      required: ["application_id", "date_time"],
    },
  },
  {
    name: "intake_job_url",
    description: "Import a job listing from a URL. Use when the user shares a link to a job posting (e.g. on LinkedIn, Greenhouse, etc.).",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL of the job posting" },
      },
      required: ["url"],
    },
  },
  {
    name: "list_recent_jobs",
    description: "List the most recently discovered or imported job listings in the user's account.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of jobs to return, default 10" },
      },
    },
  },
  {
    name: "polish_content",
    description: "Improve a piece of text (e.g. a bio, bullet point, or email) to make it more professional and impactful.",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string", description: "The text to polish" },
        instruction: { type: "string", description: "Optional specific instruction for polishing" },
      },
      required: ["content"],
    },
  },
  {
    name: "get_credits_balance",
    description: "Check the user's remaining AI credits balance.",
    parameters: { type: "object", properties: {} },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { messages, system, mode = "ask" } = await req.json();
    const { authHeader, user } = await requireSubscriptionTier(
      req,
      "Pro",
      "AI chat assistant",
    );

    const ai = createGeminiClient();
    const userId = user.id;
    const userContext = await fetchUserContext(user.id, authHeader);

    // Build system instruction based on mode
    let systemInstruction = system || "";
    
    // Inject App Interface Guide for ALL modes so it knows where it is
    systemInstruction += `\n\n${APP_INTERFACE_GUIDE}`;
    
    if (userContext) {
      const contextStr = formatUserContextForPrompt(userContext);
      if (mode === "ask") {
        systemInstruction = `You are JobRaker AI, a helpful career assistant. You know the following about the user you are helping:\n\n${contextStr}\n\nUse this information to personalize your responses. Address the user by name when appropriate.\n\n${systemInstruction}`;
      } else if (mode === "agent") {
        systemInstruction = `You are JobRaker Agent, an autonomous AI assistant that can take actions on behalf of the user. You have access to tools to search for jobs, apply to positions, analyze resumes, and more. 
        
        You know the following about the user:\n\n${contextStr}\n\nUse this information to be proactive. Always confirm before taking irreversible actions. Be proactive and helpful.\n\n${systemInstruction}`;
      }
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
    const config = createGeminiConfig({
      systemInstruction,
      includeTools: true,
      thinkingLevel: 'HIGH',
      responseMimeType: 'text/plain'
    });

    if (mode === "agent") {
      config.tools = [{ functionDeclarations: AGENT_FUNCTION_DECLARATIONS }];
    } else {
      config.tools = GEMINI_TOOLS;
    }

    const body = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const enqueueEvent = (event: string, payload: unknown) => {
          const data = typeof payload === "string" ? payload : JSON.stringify(payload);
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
        };

        try {
          if (mode === "agent") {
            console.log(`[ai-chat] Agent mode starting for user ${userId}`);
            let currentContent = [...geminiContent];
            let turnLimit = 5;
            
            while (turnLimit > 0) {
              turnLimit--;
              const response = await ai.models.generateContent({
                model: GEMINI_MODEL,
                config,
                contents: currentContent,
              });

              const candidate = response.candidates?.[0];
              const parts = candidate?.content?.parts || [];
              const text = extractGeminiText(response);
              const functionCalls = parts.filter((p: any) => p.functionCall);

              if (functionCalls.length > 0) {
                console.log(`[ai-chat] Agent executing ${functionCalls.length} tools...`);
                currentContent.push({ role: 'model', parts });
                
                const toolResults = [];
                for (const fc of functionCalls) {
                  const fn = fc.functionCall;
                  let result;
                  try {
                    if (fn.name === "run_job_search") {
                      const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/jobs-search`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: authHeader! },
                        body: JSON.stringify({ searchQuery: fn.args.query, location: fn.args.location }),
                      });
                      result = await res.json();
                    } else if (fn.name === "get_credits_balance") {
                      const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
                      const { data } = await supabaseAdmin.from("user_credits").select("balance").eq("user_id", userId).single();
                      result = { success: true, balance: data?.balance || 0 };
                    } else if (fn.name === "list_recent_jobs") {
                      const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
                      const { data } = await supabaseAdmin.from("jobs").select("id, title, company, location, status").eq("user_id", userId).order("created_at", { ascending: false }).limit(fn.args.limit || 10);
                      result = { success: true, jobs: data || [] };
                    } else if (fn.name === "get_user_profile") {
                      result = { success: true, profile: userContext || {} };
                    } else {
                      const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/${fn.name.replace(/_/g, '-')}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: authHeader! },
                        body: JSON.stringify(fn.args),
                      });
                      result = await res.json();
                    }
                  } catch (e: any) {
                    result = { error: e.message };
                  }
                  
                  toolResults.push({
                    functionResponse: { name: fn.name, response: result }
                  });
                  enqueueEvent("tool_call", { name: fn.name, args: fn.args, result });
                }
                
                currentContent.push({ role: 'user', parts: toolResults });
                continue;
              }

              if (text) {
                enqueueEvent("message", { delta: text });
              }
              break;
            }
          } else {
            const stream = await ai.models.generateContentStream({
              model: GEMINI_MODEL,
              config,
              contents: geminiContent,
            });

            for await (const chunk of stream) {
              const text = extractGeminiText(chunk);
              if (text) {
                enqueueEvent("message", { delta: text });
              }
            }
          }

          enqueueEvent("done", "[DONE]");
          controller.close();
        } catch (e: any) {
          console.error("ai-chat execution error:", e);
          enqueueEvent("error", { error: e.message });
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
    if (error instanceof SubscriptionAccessError) {
      return subscriptionErrorResponse(error, corsHeaders);
    }
    console.error("AI Chat Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
