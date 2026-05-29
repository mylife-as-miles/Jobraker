import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  createGeminiClient,
  extractGeminiText,
  GEMINI_MODEL,
  GEMINI_LITE_MODEL,
  getGeminiAccessDeniedMessage,
  isGeminiAccessDeniedError,
  withGeminiRetry,
  withModelFallback,
} from "../_shared/gemini.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { parseStructuredJson } from "../_shared/structured-json.ts";
import {
  normalizeSubscriptionTier,
  requireAuthenticatedUser,
  SubscriptionAccessError,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";
import { fetchUserContext } from "../_shared/user-context.ts";
import { buildAppInterfaceGuide } from "../_shared/app-pages.ts";
import {
  enforceFeatureRateLimit,
  recordFeatureUsage,
} from "../_shared/feature-limits.ts";

type SupportTurn = {
  role?: string;
  content?: string;
};

type SupportResponse = {
  response: string;
  suggestedActions?: Array<{
    label: string;
    route?: string | null;
    kind?: "navigate" | "human" | "reply";
    prompt?: string | null;
  }>;
};

const DEFAULT_SUPPORT_MODEL =
  Deno.env.get("SUPPORT_AI_MODEL") || "gemma-4-31b-it";
const FALLBACK_SUPPORT_MODEL = GEMINI_MODEL;

const PAGE_GUIDANCE: Record<string, string> = {
  overview:
    "The user is on the Overview page. Help them understand where to start and which dashboard areas matter most.",
  analytics:
    "The user is on Analytics. Help explain performance, trends, and what action to take from the metrics.",
  jobs:
    "The user is on Jobs. Help with scout search, job quality, opportunity intelligence, rankings, and next-step decisions.",
  application:
    "The user is on Applications. Help with tracking, status updates, follow-ups, and interview pipeline organization.",
  billing:
    "The user is on Billing. Help with plans, credits, usage, upgrades, downgrades, and renewals in plain language.",
  resume:
    "The user is on Resume. Help with tailoring, gaps, strong evidence, ATS optimization, and how to improve outcomes.",
  "cover-letter":
    "The user is on Cover Letter. Help with drafting quality, personalization, and when to generate or refine a letter.",
  settings:
    "The user is on Settings. Help with account controls, preferences, notifications, and feature setup.",
  notifications:
    "The user is on Notifications. Help with activity signals, follow-ups, and what requires attention.",
  profile:
    "The user is on Profile. Help with profile completeness, goals, preferences, and improving match quality.",
  referrals:
    "The user is on Referrals. Help explain referral mechanics, credit incentives, and what to do next.",
};

function clampText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalizeConversation(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(-6)
    .map((item) => {
      const turn = item as SupportTurn;
      const role = turn?.role === "assistant" ? "model" : "user";
      const content = clampText(turn?.content, 1_500);
      if (!content) return null;
      return {
        role,
        parts: [{ text: content }],
      };
    })
    .filter(Boolean);
}

function buildUserSnapshot(context: Awaited<ReturnType<typeof fetchUserContext>>) {
  const recentApplications = context.recentApplications
    .slice(0, 3)
    .map((item) => `${item.job_title} at ${item.company} (${item.status})`)
    .join("; ");

  const recentJobs = context.recentJobs
    .slice(0, 3)
    .map((item) => `${item.title} at ${item.company}`)
    .join("; ");

  return [
    `Name: ${context.name || "Unknown"}`,
    `Headline: ${context.headline || "Not set"}`,
    `Subscription tier: ${normalizeSubscriptionTier(context.subscriptionTier)}`,
    `Credits: ${context.credits}`,
    `Chat quota: ${context.chatFreeRemaining}/${context.chatFreeTotal} free, ${context.chatPaidCreditBalance} paid credits`,
    `Resume count: ${context.resumeCount}`,
    `Application count: ${context.applicationCount}`,
    recentApplications ? `Recent applications: ${recentApplications}` : "",
    recentJobs ? `Recent jobs: ${recentJobs}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSuggestedActions(pageId: string) {
  const common = [
    {
      label: "Talk to a person",
      kind: "human" as const,
      route: null,
      prompt: null,
    },
  ];

  switch (pageId) {
    case "overview":
      return [
        {
          label: "Check my Resumes",
          kind: "navigate" as const,
          route: "/dashboard/resume",
          prompt: null,
        },
        {
          label: "View Application History",
          kind: "navigate" as const,
          route: "/dashboard/application",
          prompt: null,
        },
        ...common,
      ];
    case "referrals":
      return [
        {
          label: "Invite friends",
          kind: "reply" as const,
          route: null,
          prompt: "How do I earn Jobricon credits by referring friends?",
        },
        {
          label: "View Referral Rules",
          kind: "reply" as const,
          route: null,
          prompt: "What are the rules and milestone caps for the referral system?",
        },
        ...common,
      ];
    case "jobs":
      return [
        {
          label: "Find Best-Fit Roles",
          kind: "navigate" as const,
          route: "/dashboard/jobs",
          prompt: null,
        },
        {
          label: "Explain ranking",
          kind: "reply" as const,
          route: null,
          prompt: "Explain how Jobraker decides which jobs are most worth applying to.",
        },
        ...common,
      ];
    case "application":
      return [
        {
          label: "Track applications",
          kind: "navigate" as const,
          route: "/dashboard/application",
          prompt: null,
        },
        {
          label: "Update status",
          kind: "reply" as const,
          route: null,
          prompt: "How do I update the status of my active job applications?",
        },
        ...common,
      ];
    case "billing":
      return [
        {
          label: "Open billing",
          kind: "navigate" as const,
          route: "/dashboard/billing",
          prompt: null,
        },
        {
          label: "Compare plans",
          kind: "reply" as const,
          route: null,
          prompt: "Compare Jobraker plans and explain which one fits my usage.",
        },
        ...common,
      ];
    case "resume":
      return [
        {
          label: "Open resumes",
          kind: "navigate" as const,
          route: "/dashboard/resume",
          prompt: null,
        },
        {
          label: "Improve ATS fit",
          kind: "reply" as const,
          route: null,
          prompt: "Show me how to improve ATS alignment without exaggerating my experience.",
        },
        ...common,
      ];
    case "cover-letter":
      return [
        {
          label: "Open cover letters",
          kind: "navigate" as const,
          route: "/dashboard/cover-letter",
          prompt: null,
        },
        {
          label: "Create cover letter",
          kind: "reply" as const,
          route: null,
          prompt: "How do I create a high-converting cover letter using AI?",
        },
        ...common,
      ];
    case "settings":
      return [
        {
          label: "Open settings",
          kind: "navigate" as const,
          route: "/dashboard/settings/profile",
          prompt: null,
        },
        {
          label: "Change appearance",
          kind: "navigate" as const,
          route: "/dashboard/settings/appearance",
          prompt: null,
        },
        ...common,
      ];
    case "profile":
      return [
        {
          label: "Open profile",
          kind: "navigate" as const,
          route: "/dashboard/profile",
          prompt: null,
        },
        {
          label: "Improve match score",
          kind: "reply" as const,
          route: null,
          prompt: "How do I update my profile history to get better matches?",
        },
        ...common,
      ];
    case "analytics":
      return [
        {
          label: "Open analytics",
          kind: "navigate" as const,
          route: "/dashboard/analytics",
          prompt: null,
        },
        {
          label: "Explain metrics",
          kind: "reply" as const,
          route: null,
          prompt: "Explain my application velocity and conversion rate trends.",
        },
        ...common,
      ];
    default:
      return [
        {
          label: "Check my Resumes",
          kind: "navigate" as const,
          route: "/dashboard/resume",
          prompt: null,
        },
        {
          label: "View Application History",
          kind: "navigate" as const,
          route: "/dashboard/application",
          prompt: null,
        },
        ...common,
      ];
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { authHeader, user, serviceClient } = await requireAuthenticatedUser(req);
    const subscriptionTier = await enforceFeatureRateLimit({
      userId: user.id,
      featureKey: "customer_support_chat",
      serviceClient,
    });
    const body = await req.json().catch(() => ({}));
    const ticketId = (body as Record<string, unknown>)?.ticketId as string | undefined;

    if (!ticketId) {
      return new Response(JSON.stringify({ error: "Ticket ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify ticket exists and belongs to the user
    const { data: ticket, error: ticketError } = await serviceClient
      .from("support_tickets")
      .select("status, user_id")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) {
      return new Response(JSON.stringify({ error: "Ticket not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (ticket.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Unauthorized access to ticket" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If ticket is not open (e.g. pending_human or resolved), do not reply via AI
    if (ticket.status !== "open") {
      return new Response(
        JSON.stringify({
          response: "Chat has been handed off to an administrator.",
          suggestedActions: [],
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const pageId = clampText((body as Record<string, unknown>)?.pageId, 80) || "overview";
    const pageTitle =
      clampText((body as Record<string, unknown>)?.pageTitle, 120) || "Dashboard";

    // Fetch conversation from support_messages database table
    const { data: messageRows, error: messagesError } = await serviceClient
      .from("support_messages")
      .select("sender_role, content")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (messagesError) {
      throw messagesError;
    }

    // Convert to Gemini API turns format, keeping the last 6 turns
    const baseContents = (messageRows || [])
      .map((row: any) => {
        const role = row.sender_role === "user" ? "user" : "model";
        return {
          role,
          parts: [{ text: row.content }],
        };
      })
      .slice(-6);

    // If there are no messages in baseContents, we might need a fallback, but the user must have sent one.
    if (baseContents.length === 0) {
      return new Response(JSON.stringify({ error: "No messages found in ticket" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userContext = await fetchUserContext(user.id, authHeader);
    const userSnapshot = buildUserSnapshot(userContext);
    const navigationMap = buildAppInterfaceGuide();
    const pageRule =
      PAGE_GUIDANCE[pageId] ||
      `The user is on ${pageTitle}. Help them succeed on this page and navigate to the right Jobraker workflow if needed.`;

    const systemInstruction = `You are Jobraker Customer Care, a warm and efficient in-app support assistant.

Your job:
- Answer product, billing, subscription, workflow, onboarding, and troubleshooting questions about Jobraker.
- Use the provided page context and account context to give grounded help.
- Be concise, clear, and practical.
- When helpful, tell the user exactly which Jobraker page to open next.
- If the issue appears account-specific, billing-sensitive, or unresolved after troubleshooting, recommend contacting human support at support@jobraker.io.

Boundaries:
- Do not invent account data, charges, plan limits, feature access, or product behavior.
- Do not claim you made changes to the account.
- Do not fabricate bugs or fixes. If uncertain, say what to verify next.
- Keep the answer customer-support oriented rather than general career coaching unless the user explicitly asks for workflow help.

Current page:
- Page id: ${pageId}
- Page title: ${pageTitle}
- Guidance: ${pageRule}

Known account context:
${userSnapshot}

Available pages and valid routes in the application:
${navigationMap}

Return valid JSON with:
- response: string
- suggestedActions: array of up to 3 items. For actions that navigate to a page inside the app, set "kind" to "navigate" and "route" to the exact route string from the navigation map. For actions that recommend replying with a message/prompt, set "kind" to "reply", "route" to null, and "prompt" to the prompt text. For general human support, set "kind" to "human".
The array should be shaped like: { "label": string, "route": string | null, "kind": "navigate" | "human" | "reply", "prompt": string | null }`;

    const ai = createGeminiClient();

    async function generateForModel(model: string) {
      return withGeminiRetry(() =>
        ai.models.generateContent({
          model,
          config: {
            systemInstruction: {
              role: "system",
              parts: [{ text: systemInstruction }],
            },
            responseMimeType: "application/json",
          },
          contents: baseContents,
        }),
      );
    }

    let rawText = "";

    try {
      if (DEFAULT_SUPPORT_MODEL !== GEMINI_MODEL) {
        try {
          const response = await generateForModel(DEFAULT_SUPPORT_MODEL);
          rawText = extractGeminiText(response);
        } catch (error) {
          if (isGeminiAccessDeniedError(error)) throw error;
          console.warn(`[CustomerSupport] Default model ${DEFAULT_SUPPORT_MODEL} failed, trying Gemini fallback chain...`, error);
          const { result: response } = await withModelFallback(
            (model) => generateForModel(model),
            GEMINI_MODEL
          );
          rawText = extractGeminiText(response);
        }
      } else {
        const { result: response } = await withModelFallback(
          (model) => generateForModel(model),
          GEMINI_MODEL
        );
        rawText = extractGeminiText(response);
      }
    } catch (error) {
      if (isGeminiAccessDeniedError(error)) {
        return new Response(
          JSON.stringify({
            error: getGeminiAccessDeniedMessage("Customer support AI"),
          }),
          {
            status: 503,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      throw error;
    }

    const parsed = parseStructuredJson<SupportResponse>(rawText);
    const responseText =
      clampText(parsed?.response, 5_000) ||
      "I couldn't shape that into a clean answer just yet, but I can help if you try again.";

    const suggestedActions =
      Array.isArray(parsed?.suggestedActions) && parsed.suggestedActions.length > 0
        ? parsed.suggestedActions.slice(0, 3).map((item) => ({
            label: clampText(item?.label, 80) || "Next step",
            route: clampText(item?.route, 200) || null,
            kind:
              item?.kind === "navigate" || item?.kind === "human" || item?.kind === "reply"
                ? item.kind
                : "reply",
            prompt: clampText(item?.prompt, 300) || null,
          }))
        : buildSuggestedActions(pageId);

    // Save AI response message to the database
    const { error: insertError } = await serviceClient
      .from("support_messages")
      .insert({
        ticket_id: ticketId,
        sender_role: "ai",
        content: responseText,
        metadata: { suggestedActions }
      });

    if (insertError) {
      throw insertError;
    }

    // Auto-escalate to human if suggested action includes human contact
    const hasHumanAction = suggestedActions.some((item) => item.kind === "human");
    if (hasHumanAction) {
      await serviceClient
        .from("support_tickets")
        .update({ status: "pending_human" })
        .eq("id", ticketId);
    }

    await recordFeatureUsage({
      userId: user.id,
      featureKey: "customer_support_chat",
      serviceClient,
      subscriptionTier,
      metadata: {
        page_id: pageId,
      },
    });

    const responsePayload: SupportResponse = {
      response: responseText,
      suggestedActions,
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof SubscriptionAccessError) {
      return subscriptionErrorResponse(error, corsHeaders);
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("customer-support-chat failed", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
