
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createGeminiClient,
  GEMINI_MODEL,
  withGeminiRetry,
  isGeminiRateLimitError,
} from "../_shared/gemini.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { fetchUserContext, formatUserContextForPrompt } from "../_shared/user-context.ts";
import { APP_INTERFACE_GUIDE } from "../_shared/app-map.ts";
import {
  normalizeSubscriptionTier,
  requireSubscriptionTier,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";
import {
  agentSearchJobRelatedEmails,
  agentSendJobRelatedEmail,
} from "../_shared/gmail-job-agent-tools.ts";

console.log("JobRaker AI Chat Starting...");

const MAX_CHAT_IMAGES = 3;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function estimateBase64Bytes(b64: string): number {
  const clean = b64.replace(/\s/g, "");
  return Math.floor((clean.length * 3) / 4);
}

function normalizeChatImages(raw: unknown): { mimeType: string; data: string }[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: { mimeType: string; data: string }[] = [];
  for (const item of raw.slice(0, MAX_CHAT_IMAGES)) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const mimeType = typeof rec.mimeType === "string" ? rec.mimeType : "";
    const dataRaw = typeof rec.data === "string" ? rec.data : "";
    const data = dataRaw.replace(/\s/g, "");
    if (!mimeType.startsWith("image/") || !data) continue;
    if (estimateBase64Bytes(data) > MAX_IMAGE_BYTES) {
      throw new Error(`Each image must be under ${MAX_IMAGE_BYTES / (1024 * 1024)}MB`);
    }
    out.push({ mimeType, data });
  }
  return out.length ? out : undefined;
}

/** Extract incremental/cumulative text from a @google/genai stream chunk. */
function streamChunkText(chunk: unknown): string {
  const c = chunk as Record<string, unknown> | null;
  if (!c) return "";
  const textField = c.text;
  if (typeof textField === "function") {
    try {
      const v = (textField as () => unknown)();
      return typeof v === "string" ? v : "";
    } catch {
      return "";
    }
  }
  if (typeof textField === "string") return textField;
  const candidates = c.candidates as
    | Array<{ content?: { parts?: Array<{ text?: string }> } }>
    | undefined;
  const parts = candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    return parts.filter((p) => typeof p?.text === "string").map((p) => p.text!).join("");
  }
  return "";
}

/** Gemini multimodal user turn */
function buildGeminiUserParts(
  text: string,
  images?: { mimeType: string; data: string }[],
): Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> {
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
  for (const img of images || []) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
  }
  const trimmed = (text || "").trim();
  if (trimmed) {
    parts.push({ text: trimmed });
  } else if (parts.length > 0) {
    parts.push({
      text:
        "The user shared a screenshot or image. Describe what you see and help with their request (errors, UI, job postings, resume feedback, etc.).",
    });
  }
  return parts;
}

const ACCOUNT_ACCESS_RULES = `
You are inside the authenticated user's JobRaker workspace.
You DO have access to the user's JobRaker account data provided in this prompt and, in agent mode, through the available tools.
Do not claim that you lack access to the user's JobRaker profile, resumes, tracked jobs, applications, credits, cover letters, or recent conversations when that information is present in context or retrievable through tools.
Only describe limitations for external systems that are not connected here, such as LinkedIn dashboards, Indeed, or third-party job boards when Gmail is not connected.
If the user has connected Gmail in JobRaker Settings, job-related inbox tools may be available in agent mode (search/send guardrails still apply).
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
  },
  {
    name: "search_gmail_job_emails",
    description:
      "Search the user's Gmail ONLY for job-search correspondence (applications, interviews, offers, rejections, assessments, recruiter mail). Uses a fixed job-related query on the server; cannot search arbitrary personal mail. Requires Gmail connected in Settings → Integrations.",
    parameters: {
      type: "object",
      properties: {
        max_results: {
          type: "number",
          description: "Max messages to return (1–15, default 8).",
        },
        refine_query: {
          type: "string",
          description:
            "Optional extra Gmail search terms to AND with the job filter (e.g. company or role). Letters, numbers, spaces, basic punctuation only.",
        },
      },
    },
  },
  {
    name: "send_gmail_job_email",
    description:
      "Send an email from the user's Gmail address ONLY for professional job-related communication (recruiter follow-up, thank-you after interview, application status). The server rejects content that does not look job-related. Always confirm recipient, subject, and body with the user before calling. Requires Gmail connected with send permission.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address" },
        subject: { type: "string", description: "Email subject line" },
        body: { type: "string", description: "Plain-text body" },
      },
      required: ["to", "subject", "body"],
    },
  },
];

serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get("origin"), req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    const body = await req.json();
    const {
      messages,
      system,
      mode = "ask",
      model: requestedModel,
      webSearch = false,
    } = body;
    const { authHeader, user, subscriptionTier } = await requireSubscriptionTier(req, "Pro", "AI chat");

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages are required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    let normalizedMessages: { role: string; content: string; images?: { mimeType: string; data: string }[] }[];
    try {
      normalizedMessages = messages.map((m: any, i: number) => {
        const role = m?.role === "assistant" ? "assistant" : "user";
        const content = typeof m?.content === "string" ? m.content : "";
        const isLast = i === messages.length - 1;
        const images =
          isLast && role === "user" ? normalizeChatImages(m?.images) : undefined;
        return { role, content, images };
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e?.message || "Invalid image payload" }), {
        status: 413,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const lastNorm = normalizedMessages[normalizedMessages.length - 1];
    if (
      lastNorm.role === "user" &&
      !lastNorm.content.trim() &&
      !lastNorm.images?.length
    ) {
      return new Response(JSON.stringify({ error: "Message text or image is required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
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
          headers: { ...cors, "Content-Type": "application/json" },
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
      return new Response(
        JSON.stringify({
          error: "Could not verify chat billing. Please try again.",
          code: "billing_error",
        }),
        {
          status: 503,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }
    const consumed = consumeResult as Record<string, unknown> | null;
    if (!consumed || consumed.success !== true) {
      const c = consumed || {};
      return new Response(
        JSON.stringify({
          error: (c.message as string) || "Chat billing failed.",
          code: (c.reason as string) || "insufficient_credits",
          balance: c.balance,
          free_remaining: c.free_remaining,
        }),
        {
          status: 402,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    const genAI = createGeminiClient();
    const modelName = requestedModel || GEMINI_MODEL;
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
      const gmailJobRules = `
Job-related Gmail (only when tools are available):
- search_gmail_job_emails searches using a fixed job-search filter on the server; it is not a full inbox search.
- send_gmail_job_email sends only if the message clearly relates to the user's job search; the server may reject other content. Always show the user the exact To, Subject, and body and obtain explicit confirmation before sending.
Never use Gmail tools for personal, medical, financial (non-compensation job offer), or unrelated topics.`;
      systemInstruction =
        `You are JobRaker Agent. Be proactive, use tools to help the user, and answer from JobRaker data before falling back to general advice. Confirm before applying, deleting, sending email, or triggering any side-effectful workflow.\n\n${gmailJobRules.trim()}\n\n${systemInstruction}`;
    }

    const chatConfig: Record<string, unknown> = {
      systemInstruction: {
        role: "system",
        parts: [{ text: systemInstruction }],
      },
      thinkingConfig: { thinkingLevel: "MEDIUM" },
    };
    if (mode === "agent") {
      chatConfig.tools = webSearch
        ? [
            { functionDeclarations: AGENT_FUNCTION_DECLARATIONS },
            { googleSearch: {} },
          ]
        : [{ functionDeclarations: AGENT_FUNCTION_DECLARATIONS }];
    } else if (webSearch) {
      chatConfig.tools = [{ googleSearch: {} }];
    }

    const history = normalizedMessages.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const lastUserParts = buildGeminiUserParts(
      normalizedMessages[normalizedMessages.length - 1].content,
      normalizedMessages[normalizedMessages.length - 1].images,
    );

    const streamBody = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const enqueueEvent = (ev: string, data: any) => {
          const payload = typeof data === "string" ? data : JSON.stringify(data);
          controller.enqueue(encoder.encode(`event: ${ev}\ndata: ${payload}\n\n`));
        };

        try {
          if (mode === "agent") {
            const chat = genAI.chats.create({
              model: modelName,
              config: chatConfig,
              history,
            });
            let response = await withGeminiRetry(() =>
              chat.sendMessage({ message: lastUserParts }),
            );
            let turnCount = 0;

            while (turnCount < 5) {
              turnCount++;
              const parts = response.candidates?.[0]?.content?.parts || [];
              const text = parts.find(p => p.text)?.text;
              const functionCalls = parts.filter(p => p.functionCall);

              if (text) enqueueEvent("message", { delta: text });

              if (functionCalls.length > 0) {
                // Option C: extra credit per agent tool round (Ask mode has no surcharge)
                const { data: surchargeResult, error: surchargeError } = await serviceClient.rpc(
                  "consume_ai_chat_tool_surcharge",
                  { p_user_id: userId, p_credits: 1 },
                );
                const sur = surchargeResult as Record<string, unknown> | null;
                const surchargeOk =
                  sur &&
                  (sur.success === true || sur.success === "true" || sur.success === "t");
                if (surchargeError || !surchargeOk) {
                  if (surchargeError) {
                    console.error("consume_ai_chat_tool_surcharge RPC error:", surchargeError);
                  }
                  const rpcMsg =
                    typeof sur?.message === "string" ? sur.message : null;
                  enqueueEvent("error", {
                    error: surchargeError
                      ? `Could not charge credits for agent tools. ${(surchargeError as { message?: string }).message || "Please try again."}`
                      : rpcMsg ||
                        "Not enough credits to run agent tools this step. Add credits or switch to Ask mode.",
                    code: surchargeError ? "billing_error" : "agent_tool_surcharge",
                    balance: sur?.balance,
                    reason: sur?.reason,
                  });
                  break;
                }
                enqueueEvent("agent_surcharge", {
                  credits_charged: sur.credits_charged,
                  balance: sur.balance,
                });

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
                        const { data, error } = await supabaseUser
                          .from("resumes")
                          .select("id, name, status, updated_at, is_favorite")
                          .eq("user_id", userId)
                          .order("updated_at", { ascending: false });
                        if (error) {
                          console.error("list_resumes:", error.message);
                          result = { success: false, error: error.message, resumes: [] };
                        } else {
                          result = { success: true, resumes: data || [] };
                        }
                    } else if (fn.name === "list_recent_jobs") {
                        const { data } = await supabaseUser
                          .from("jobs")
                          .select("id, title, company, location, url, created_at, status, canonical_status")
                          .eq("user_id", userId)
                          .order("created_at", { ascending: false })
                          .limit(fn.args.limit || 10);
                        result = { success: true, jobs: data || [] };
                    } else if (fn.name === "search_gmail_job_emails") {
                        result = await agentSearchJobRelatedEmails(
                          serviceClient,
                          userId,
                          (fn.args || {}) as {
                            max_results?: number;
                            refine_query?: string;
                          },
                        );
                    } else if (fn.name === "send_gmail_job_email") {
                        result = await agentSendJobRelatedEmail(
                          serviceClient,
                          userId,
                          (fn.args || {}) as {
                            to?: string;
                            subject?: string;
                            body?: string;
                          },
                        );
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
                          const a = (fn.args || {}) as Record<string, unknown>;
                          const jd =
                            typeof a.job_description === "string" ? a.job_description
                            : typeof a.jobDescription === "string" ? a.jobDescription
                            : "";
                          const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/evaluate-job-fit`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", Authorization: authHeader! },
                            body: JSON.stringify({
                              jobDescription: jd,
                              jobId: a.job_id ?? a.jobId,
                              jobTitle: a.job_title ?? a.jobTitle,
                              company: a.company,
                              profileSnapshot: a.profile_snapshot ?? a.profileSnapshot,
                              resumeText: a.resume_text ?? a.resumeText,
                            }),
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
                response = await withGeminiRetry(() =>
                  chat.sendMessage({
                    message: { role: "user", parts: toolResults },
                  }),
                );
              } else {
                break;
              }
            }
          } else {
            const chat = genAI.chats.create({
              model: modelName,
              config: chatConfig,
              history,
            });
            const stream = await withGeminiRetry(() =>
              chat.sendMessageStream({ message: lastUserParts }),
            );
            for await (const chunk of stream) {
              const text = streamChunkText(chunk);
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

    return new Response(streamBody, {
      headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" }
    });

  } catch (error: any) {
    console.error("Outer Error:", error);
    return subscriptionErrorResponse(error, cors);
  }
});
