
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createGeminiClient,
  GEMINI_MODEL,
  GEMINI_TOOLS,
  getGeminiAccessDeniedMessage,
  isGeminiAccessDeniedError,
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
        // RAG mode: inject user context
        systemInstruction = `You are JobRaker AI, a helpful career assistant. You know the following about the user you are helping:\n\n${contextStr}\n\nUse this information to personalize your responses. Address the user by name when appropriate.\n\n${systemInstruction}`;
      } else if (mode === "agent") {
        // Agent mode: enable function calling AND provide context
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

    const body = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const enqueueEvent = (event: string, payload: unknown) => {
          const data =
            typeof payload === "string" ? payload : JSON.stringify(payload);
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${data}\n\n`),
          );
        };

        try {
          const stream = await ai.models.generateContentStream({
            model: GEMINI_MODEL,
            config,
            contents: geminiContent,
          });

          for await (const chunk of stream) {
            // Handle text responses
            const text = typeof chunk.text === 'function' ? (typeof chunk.text === 'function' ? chunk.text() : chunk.text) : chunk.text;
            if (text) {
              enqueueEvent("message", { delta: text });
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
                    
                    let resumeText = fn.args.resume_text;
                    if (!resumeText) {
                      const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
                      const { data } = await supabaseAdmin.from("parsed_resumes").select("content").eq("user_id", userId).order("extracted_at", { ascending: false }).limit(1).single();
                      resumeText = data?.content || "";
                    }

                    const res = await fetch(analyzeUrl, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: authHeader! },
                      body: JSON.stringify({ 
                        resumeText, 
                        profileSummary: JSON.stringify(userContext) 
                      }),
                    });
                    result = await res.json();
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
                  } else if (fn.name === "get_user_profile") {
                    result = { success: true, profile: userContext };
                  } else if (fn.name === "list_applications") {
                    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
                    const { data: apps } = await supabaseAdmin.from("applications").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
                    result = { success: true, applications: apps || [] };
                  } else if (fn.name === "list_resumes") {
                    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
                    const { data: resumes } = await supabaseAdmin.from("resumes").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
                    result = { success: true, resumes: resumes || [] };
                  } else if (fn.name === "generate_cover_letter" || fn.name === "tailor_resume" || fn.name === "evaluate_job_fit") {
                    // Proxy call to sibling functions
                    const functionName = fn.name.replace(/_/g, "-");
                    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/${functionName}`;
                    
                    // Most documents need the resume text. We fetch the latest parsed resume if not provided.
                    let resumeText = fn.args.resume_text;
                    if (!resumeText) {
                      const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
                      const { data } = await supabaseAdmin.from("parsed_resumes").select("content").eq("user_id", userId).order("extracted_at", { ascending: false }).limit(1).single();
                      resumeText = data?.content || "";
                    }

                    const res = await fetch(url, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: authHeader! },
                      body: JSON.stringify({
                        jobDescription: fn.args.job_description,
                        resumeText: resumeText,
                        instructions: fn.args.instructions,
                      }),
                    });
                    result = await res.json();
                  } else if (fn.name === "schedule_interview") {
                    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/schedule-interview`;
                    const res = await fetch(url, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: authHeader! },
                      body: JSON.stringify({
                        application_id: fn.args.application_id,
                        date_time: fn.args.date_time,
                        notes: fn.args.notes,
                      }),
                    });
                    result = await res.json();
                  } else if (fn.name === "get_credits_balance") {
                    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
                    const { data } = await supabaseAdmin.from("user_credits").select("balance").eq("user_id", userId).single();
                    result = { success: true, balance: data?.balance || 0 };
                  } else if (fn.name === "intake_job_url") {
                    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/intake-job-url`;
                    const res = await fetch(url, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: authHeader! },
                      body: JSON.stringify({ url: fn.args.url }),
                    });
                    result = await res.json();
                  } else if (fn.name === "list_recent_jobs") {
                    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
                    const { data: jobs } = await supabaseAdmin.from("jobs").select("id, title, company, location, status, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(fn.args.limit || 10);
                    result = { success: true, jobs: jobs || [] };
                  } else if (fn.name === "polish_content") {
                    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/polish-content`;
                    const res = await fetch(url, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: authHeader! },
                      body: JSON.stringify({ content: fn.args.content, instruction: fn.args.instruction }),
                    });
                    result = await res.json();
                  }
                } catch (e: any) {
                  result = { success: false, message: e.message };
                }

                // Send function result back to stream
                enqueueEvent("function_result", {
                  functionCall: fn.name,
                  result,
                });
              }
            }
          }

          enqueueEvent("done", "[DONE]");
          controller.close();
        } catch (e: any) {
          const errorMessage = isGeminiAccessDeniedError(e)
            ? getGeminiAccessDeniedMessage("AI chat")
            : e?.message || "Could not complete the chat request.";
          enqueueEvent("error", { error: errorMessage });
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
    const message = isGeminiAccessDeniedError(error)
      ? getGeminiAccessDeniedMessage("AI chat")
      : error.message;
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: isGeminiAccessDeniedError(error) ? 503 : 500,
    });
  }
});
