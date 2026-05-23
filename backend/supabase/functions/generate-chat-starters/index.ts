import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createGeminiClient,
  createGeminiConfig,
  extractGeminiText,
  GEMINI_MODEL,
  getGeminiAccessDeniedMessage,
  isGeminiAccessDeniedError,
  withGeminiRetry,
} from "../_shared/gemini.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { parseStructuredJson } from "../_shared/structured-json.ts";
import { requireAuthenticatedUser } from "../_shared/subscription.ts";
import { fetchUserContext } from "../_shared/user-context.ts";

type ChatStarterIcon =
  | "resume"
  | "jobs"
  | "interview"
  | "cover-letter"
  | "applications"
  | "strategy";

interface ChatStarter {
  id: string;
  title: string;
  description: string;
  prompt: string;
  icon: ChatStarterIcon;
}

interface ChatStarterResponse {
  suggestions: ChatStarter[];
}

const ALLOWED_ICONS = new Set<ChatStarterIcon>([
  "resume",
  "jobs",
  "interview",
  "cover-letter",
  "applications",
  "strategy",
]);

function clampText(value: unknown, maxLength: number, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

function summarizeContext(context: Awaited<ReturnType<typeof fetchUserContext>>) {
  const profileSummary = [
    context.headline,
    context.resumeSummary,
    context.candidateMemorySummary,
  ]
    .filter((item): item is string => Boolean(item?.trim()))
    .join(" ")
    .slice(0, 1400);

  const recentApplicationSummary = context.recentApplications
    .slice(0, 3)
    .map((item) => `${item.job_title} at ${item.company} (${item.status})`)
    .join("; ");

  const recentJobSummary = context.recentJobs
    .slice(0, 3)
    .map((item) => `${item.title} at ${item.company}`)
    .join("; ");

  return {
    profileSummary,
    recentApplicationSummary,
    recentJobSummary,
  };
}

function buildFallbackSuggestions(
  context: Awaited<ReturnType<typeof fetchUserContext>>,
): ChatStarterResponse {
  const recentRole =
    context.recentApplications[0]?.job_title ||
    context.recentJobs[0]?.title ||
    context.headline ||
    "software engineer";

  return {
    suggestions: [
      {
        id: "resume",
        title: "Optimize Resume",
        description: `Tailor your resume for ${recentRole} opportunities.`,
        prompt: `Optimize my resume for a ${recentRole} role and show me the biggest gaps first.`,
        icon: "resume",
      },
      {
        id: "jobs",
        title: "Find Best-Fit Roles",
        description: "Search for remote jobs that match your current profile.",
        prompt: `Find remote ${recentRole} jobs that fit my background and explain the strongest matches.`,
        icon: "jobs",
      },
      {
        id: "interview",
        title: "Interview Prep",
        description: "Practice realistic questions with feedback on your answers.",
        prompt: `Interview me for a ${recentRole} position and coach my answers like a hiring manager.`,
        icon: "interview",
      },
    ],
  };
}

function normalizeSuggestion(
  value: unknown,
  index: number,
  fallback: ChatStarter,
): ChatStarter {
  const record =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const icon = ALLOWED_ICONS.has(record.icon as ChatStarterIcon)
    ? (record.icon as ChatStarterIcon)
    : fallback.icon;

  return {
    id: clampText(record.id, 40, fallback.id),
    title: clampText(record.title, 36, fallback.title),
    description: clampText(record.description, 90, fallback.description),
    prompt: clampText(record.prompt, 180, fallback.prompt),
    icon,
  };
}

function normalizeResponse(
  parsed: unknown,
  fallback: ChatStarterResponse,
): ChatStarterResponse {
  const rawSuggestions = Array.isArray((parsed as Record<string, unknown>)?.suggestions)
    ? ((parsed as Record<string, unknown>).suggestions as unknown[])
    : [];

  const normalized = fallback.suggestions.map((fallbackSuggestion, index) =>
    normalizeSuggestion(rawSuggestions[index], index, fallbackSuggestion),
  );

  return { suggestions: normalized };
}

function buildPrompt(context: Awaited<ReturnType<typeof fetchUserContext>>) {
  const { profileSummary, recentApplicationSummary, recentJobSummary } =
    summarizeContext(context);

  return `
You generate smart starter cards for JobRaker's AI chat homepage.

Return valid JSON only in this shape:
{
  "suggestions": [
    {
      "id": "short-id",
      "title": "2 to 4 words",
      "description": "1 short sentence",
      "prompt": "the exact prompt to insert into the chat input",
      "icon": "resume" | "jobs" | "interview" | "cover-letter" | "applications" | "strategy"
    }
  ]
}

Rules:
- Return exactly 3 suggestions.
- Make them feel personalized to this user.
- Titles must be concise and non-generic.
- Descriptions must be under 90 characters.
- Prompts should be specific and actionable.
- Favor job search, resume, interview, applications, and strategy tasks.
- Avoid repeating the same idea three times.
- Do not mention credits, pricing, subscriptions, or internal system details.

User context:
- Name: ${context.name || "Unknown"}
- Headline: ${context.headline || "Unknown"}
- Resume summary: ${profileSummary || "Unavailable"}
- Recent applications: ${recentApplicationSummary || "None"}
- Recent tracked jobs: ${recentJobSummary || "None"}
- Resume count: ${context.resumeCount}
- Application count: ${context.applicationCount}
- Job count: ${context.jobCount}
`.trim();
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { authHeader, user } = await requireAuthenticatedUser(req);
    const context = await fetchUserContext(user.id, authHeader);
    const fallback = buildFallbackSuggestions(context);

    let response = fallback;

    try {
      const ai = createGeminiClient();
      const result = await withGeminiRetry(() =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          config: createGeminiConfig({
            systemInstruction:
              "You create personalized starter prompts for a career AI assistant. Return only valid JSON.",
            responseMimeType: "application/json",
          }),
          contents: [{ role: "user", parts: [{ text: buildPrompt(context) }] }],
        }),
      );

      const text = extractGeminiText(result);
      if (!text) throw new Error("Empty response from AI");
      response = normalizeResponse(parseStructuredJson(text), fallback);
    } catch (error) {
      console.error("generate-chat-starters falling back", error);
      if (isGeminiAccessDeniedError(error)) {
        console.warn(getGeminiAccessDeniedMessage("AI chat suggestions"));
      }
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in generate-chat-starters:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to generate starters" }),
      {
        status: error?.status || 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
