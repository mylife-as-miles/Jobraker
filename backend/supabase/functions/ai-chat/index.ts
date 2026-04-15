
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createGeminiClient,
  GEMINI_MODEL,
  withGeminiRetry,
  isGeminiRateLimitError,
} from "../_shared/gemini.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { fetchUserContext, formatUserContextForPrompt } from "../_shared/user-context.ts";
import { APP_INTERFACE_GUIDE } from "../_shared/app-map.ts";
import {
  normalizeSubscriptionTier,
  requireSubscriptionTier,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";

console.log("JobRaker AI Chat Starting...");

const ACCOUNT_ACCESS_RULES = `
You are inside the authenticated user's JobRaker workspace.
You DO have access to the user's JobRaker account data provided in this prompt and, in agent mode, through the available tools.
Do not claim that you lack access to the user's JobRaker profile, resumes, tracked jobs, applications, credits, cover letters, or recent conversations when that information is present in context or retrievable through tools.
Only describe limitations for external systems that are not connected here, such as LinkedIn dashboards, Indeed, external inboxes, or third-party job boards.
When the user asks for totals, counts, lists, or recent activity inside JobRaker, answer from the account context or tools first before giving generic advice.
`;

const createAuthedSupabaseClient = (authHeader: string) =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

const createServiceSupabaseClient = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

const AGENT_FUNCTION_DECLARATIONS = [
  {
    name: "get_account_snapshot",
    description: "Get a summary of the user's JobRaker account, including counts for applications, tracked jobs, resumes, credits, and recent activity.",
    parameters: { type: "object", properties: {} },
  },
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
    name: "list_resumes",
    description: "List all resumes uploaded by the user.",
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
  },
  {
      name: "analyze_resume",
      description: "Analyze a resume for improvements.",
      parameters: { type: "object", properties: { target_role: { type: "string" } } }
  },
  {
      name: "generate_cover_letter",
      description: "Generate a tailored cover letter.",
      parameters: { type: "object", properties: { job_description: { type: "string" }, instructions: { type: "string" } }, required: ["job_description"] }
  },
  {
      name: "evaluate_job_fit",
      description: "Evaluate matching between user and a job.",
      parameters: { type: "object", properties: { job_description: { type: "string" } }, required: ["job_description"] }
  },
  {
      name: "intake_job_url",
      description: "Import a job from a URL.",
      parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] }
  },
  {
      name: "polish_content",
      description: "Improve professional text.",
      parameters: { type: "object", properties: { content: { type: "string" }, instruction: { type: "string" } }, required: ["content"] }
  }
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const {
      messages,
      system,
      mode = "ask",
      model: requestedModel,
      webSearch = false,
    } = await req.json();
    const { authHeader, user, subscriptionTier } = await requireSubscriptionTier(req, "Pro", "AI chat");

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const serviceClient = createServiceSupabaseClient();

    // --- Rate limit check ---
    const { data: rateLimitResult, error: rlError } = await serviceClient.rpc(
      "check_chat_rate_limit",
      { p_user_id: userId, p_tier: subscriptionTier },
    );
    if (!rlError && rateLimitResult && rateLimitResult.allowed === false) {
      return new Response(
        JSON.stringify({
          error: rateLimitResult.message,
          code: rateLimitResult.reason,
          retry_after: rateLimitResult.retry_after_seconds,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // --- Credit / quota consumption ---
    const { data: consumeResult, error: consumeError } = await serviceClient.rpc(
      "consume_chat_message",
      { p_user_id: userId },
    );
    if (consumeError) {
      console.error("consume_chat_message RPC error:", consumeError);
    } else if (consumeResult && consumeResult.success === false) {
      return new Response(
        JSON.stringify({
          error: consumeResult.message,
          code: consumeResult.reason,
          balance: consumeResult.balance,
          free_remaining: consumeResult.free_remaining,
        }),
        {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const genAI = createGeminiClient();
    let userContext = null;
    try {
      userContext = await fetchUserContext(user.id, authHeader);
      if (userContext) {
        userContext.email = user.email ?? "";
        userContext.subscriptionTier = subscriptionTier;
      }
    } catch (contextError) {
      console.error("Failed to fetch AI chat user context:", contextError);
    }

    let systemInstruction = [ACCOUNT_ACCESS_RULES.trim(), APP_INTERFACE_GUIDE.trim()]
      .filter(Boolean)
      .join("\n\n");

    if (system) {
      systemInstruction = `${systemInstruction}\n\n${system}`;
    }
    
    if (userContext) {
      const contextStr = formatUserContextForPrompt(userContext);
      systemInstruction = `User Info:\n${contextStr}\n\n${systemInstruction}`;
    }

    if (mode === "agent") {
      systemInstruction = `You are JobRaker Agent. Be proactive, use tools to help the user, and answer from JobRaker data before falling back to general advice. Confirm before applying, deleting, or triggering any side-effectful workflow.\n\n${systemInstruction}`;
    }

    const modelParams: any = {
      model: requestedModel || GEMINI_MODEL,
      systemInstruction,
    };
    if (mode === "agent") {
      modelParams.tools = [{ functionDeclarations: AGENT_FUNCTION_DECLARATIONS }];
    } else if (webSearch) {
      modelParams.tools = [{ googleSearch: {} }];
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
            let response = await withGeminiRetry(() => chat.sendMessage(userPrompt));
            let turnCount = 0;

            while (turnCount < 5) {
              turnCount++;
              const parts = response.response.candidates?.[0]?.content?.parts || [];
              const text = parts.find(p => p.text)?.text;
              const functionCalls = parts.filter(p => p.functionCall);

              if (text) enqueueEvent("message", { delta: text });

              if (functionCalls.length > 0) {
                // Option C: extra credit per agent tool round (Ask mode has no surcharge)
                const { data: surchargeResult, error: surchargeError } = await serviceClient.rpc(
                  "consume_ai_chat_tool_surcharge",
                  { p_user_id: userId, p_credits: 1 },
                );
                if (surchargeError) {
                  console.error("consume_ai_chat_tool_surcharge RPC error:", surchargeError);
                }
                if (!surchargeError && surchargeResult && surchargeResult.success === false) {
                  enqueueEvent("error", {
                    error: surchargeResult.message ||
                      "Not enough credits to run agent tools this step. Add credits or switch to Ask mode.",
                    code: "agent_tool_surcharge",
                    balance: surchargeResult.balance,
                  });
                  break;
                }
                if (surchargeResult?.success) {
                  enqueueEvent("agent_surcharge", {
                    credits_charged: surchargeResult.credits_charged,
                    balance: surchargeResult.balance,
                  });
                }

                const toolResults = [];
                for (const fc of functionCalls) {
                  const fn = fc.functionCall;
                  console.log(`[Agent] Executing: ${fn.name}`);
                  let result;
                  try {
                    const supabaseUser = createAuthedSupabaseClient(authHeader!);
                    
                    if (fn.name === "get_account_snapshot") {
                      result = {
                        success: true,
                        snapshot: {
                          name: userContext?.name || "User",
                          email: userContext?.email || "",
                          headline: userContext?.headline || null,
                          credits: userContext?.credits || 0,
                          subscriptionTier: userContext?.subscriptionTier || subscriptionTier,
                          applicationCount: userContext?.applicationCount || 0,
                          jobCount: userContext?.jobCount || 0,
                          resumeCount: userContext?.resumeCount || 0,
                          recentApplications: userContext?.recentApplications || [],
                          recentJobs: userContext?.recentJobs || [],
                          resumes: userContext?.resumes || [],
                        },
                      };
                    } else if (fn.name === "run_job_search") {
                      const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/jobs-search`, {
                        method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader! },
                        body: JSON.stringify({ searchQuery: fn.args.query, location: fn.args.location })
                      });
                      result = await res.json();
                    } else if (fn.name === "get_credits_balance") {
                      const { data } = await supabaseUser.from("user_credits").select("balance").eq("user_id", userId).maybeSingle();
                      result = { success: true, balance: data?.balance || 0 };
                    } else if (fn.name === "get_user_profile") {
                        result = { success: true, profile: userContext };
                    } else if (fn.name === "list_applications") {
                        const { data } = await supabaseUser
                          .from("applications")
                          .select("id, job_title, company, status, created_at, updated_at")
                          .eq("user_id", userId)
                          .order("created_at", { ascending: false });
                        result = { success: true, applications: data || [] };
                    } else if (fn.name === "list_resumes") {
                        const { data } = await supabaseUser
                          .from("resumes")
                          .select("id, name, status, updated_at, is_favorite")
                          .eq("user_id", userId)
                          .order("created_at", { ascending: false });
                        result = { success: true, resumes: data || [] };
                    } else if (fn.name === "list_recent_jobs") {
                        const { data } = await supabaseUser
                          .from("jobs")
                          .select("id, title, company, location, url, created_at, status, canonical_status")
                          .eq("user_id", userId)
                          .order("created_at", { ascending: false })
                          .limit(fn.args.limit || 10);
                        result = { success: true, jobs: data || [] };
                    } else if (fn.name === "evaluate_job_fit") {
                        const t = normalizeSubscriptionTier(subscriptionTier);
                        if (t === "Free") {
                          result = {
                            success: false,
                            error:
                              "AI job fit reports require Basics or higher. Upgrade at Billing to unlock full evaluation (blockers, confidence, interview angles).",
                            upgrade_required: true,
                            required_tier: "Basics",
                            billing_path: "/dashboard/billing",
                          };
                        } else {
                          const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/evaluate-job-fit`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", Authorization: authHeader! },
                            body: JSON.stringify(fn.args),
                          });
                          result = await res.json();
                        }
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
                response = await withGeminiRetry(() => chat.sendMessage(toolResults));
              } else {
                break;
              }
            }
          } else {
            const result = await withGeminiRetry(() =>
              model.generateContentStream({
                contents: [
                  ...history,
                  { role: "user", parts: [{ text: userPrompt }] },
                ],
              }),
            );
            for await (const chunk of result.stream) {
              const text = chunk.text();
              if (text) enqueueEvent("message", { delta: text });
            }
          }
          enqueueEvent("done", "[DONE]");
          controller.close();
        } catch (e: any) {
          console.error("Agent Loop Error:", e);
          const userMessage = isGeminiRateLimitError(e)
            ? "Our AI service is temporarily busy. Please try again in a moment."
            : e.message;
          enqueueEvent("error", { error: userMessage });
          controller.close();
        }
      },
    });

    return new Response(body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" }
    });

  } catch (error: any) {
    console.error("Outer Error:", error);
    return subscriptionErrorResponse(error, corsHeaders);
  }
});
