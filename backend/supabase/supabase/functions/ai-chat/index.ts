import { createGeminiClient, GEMINI_MODEL } from "../_shared/gemini.ts";
import { getCorsHeaders } from "../_shared/types.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

function createSupabaseClient(authHeader: string) {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
}

async function fetchUserContext(sb: ReturnType<typeof createClient>): Promise<string> {
  const sections: string[] = [];

  const { data: profile } = await sb
    .from("profiles")
    .select("first_name, last_name, job_title, location, experience_years, skills, goals, about, subscription_tier")
    .single();

  if (profile) {
    const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Unknown";
    sections.push(
      `## User Profile\n- Name: ${name}\n- Title: ${profile.job_title || "N/A"}\n- Location: ${profile.location || "N/A"}` +
      `\n- Experience: ${profile.experience_years ?? "N/A"} years\n- Skills: ${(profile.skills || []).join(", ") || "None listed"}` +
      `\n- Goals: ${(profile.goals || []).join(", ") || "None listed"}\n- Plan: ${profile.subscription_tier || "Free"}` +
      (profile.about ? `\n- About: ${profile.about}` : ""),
    );
  }

  const { count: totalJobs } = await sb.from("jobs").select("id", { count: "exact", head: true });
  const { data: statusCounts } = await sb.rpc("get_job_status_counts").catch(() => ({ data: null }));

  let jobSummary = `## Jobs\n- Total tracked jobs: ${totalJobs ?? 0}`;

  if (!statusCounts) {
    const statuses = ["discovered", "evaluated", "draft_ready", "queued", "submitted", "interview", "offer", "rejected", "failed"];
    for (const s of statuses) {
      const { count } = await sb.from("jobs").select("id", { count: "exact", head: true }).eq("canonical_status", s);
      if (count && count > 0) jobSummary += `\n- ${s}: ${count}`;
    }
  } else if (Array.isArray(statusCounts)) {
    for (const row of statusCounts) {
      if (row.count > 0) jobSummary += `\n- ${row.canonical_status}: ${row.count}`;
    }
  }

  const { data: recentJobs } = await sb
    .from("jobs")
    .select("title, company, location, canonical_status, created_at, salary_min, salary_max, salary_currency, bookmarked")
    .order("created_at", { ascending: false })
    .limit(10);

  if (recentJobs && recentJobs.length > 0) {
    jobSummary += "\n\n### 10 Most Recent Jobs";
    for (const j of recentJobs) {
      const salary = j.salary_min || j.salary_max
        ? ` | ${j.salary_currency || "USD"} ${j.salary_min ?? "?"}–${j.salary_max ?? "?"}`
        : "";
      jobSummary += `\n- ${j.title} @ ${j.company} (${j.canonical_status})${salary}${j.bookmarked ? " ★" : ""}`;
    }
  }
  sections.push(jobSummary);

  const { count: totalApps } = await sb.from("applications").select("id", { count: "exact", head: true });
  if (totalApps && totalApps > 0) {
    let appSummary = `## Applications\n- Total applications: ${totalApps}`;
    const appStatuses = ["Applied", "Interview", "Offer", "Rejected", "Pending", "Draft", "Failed", "Withdrawn"];
    for (const s of appStatuses) {
      const { count } = await sb.from("applications").select("id", { count: "exact", head: true }).eq("status", s);
      if (count && count > 0) appSummary += `\n- ${s}: ${count}`;
    }
    const { data: recentApps } = await sb
      .from("applications")
      .select("job_title, company, status, applied_date")
      .order("applied_date", { ascending: false })
      .limit(5);
    if (recentApps && recentApps.length > 0) {
      appSummary += "\n\n### Recent Applications";
      for (const a of recentApps) {
        appSummary += `\n- ${a.job_title} @ ${a.company} — ${a.status} (${new Date(a.applied_date).toLocaleDateString()})`;
      }
    }
    sections.push(appSummary);
  }

  const { data: resumes } = await sb
    .from("resumes")
    .select("name, status, updated_at")
    .order("updated_at", { ascending: false })
    .limit(5);
  if (resumes && resumes.length > 0) {
    let resumeSummary = "## Resumes";
    for (const r of resumes) {
      resumeSummary += `\n- ${r.name} (${r.status})`;
    }
    sections.push(resumeSummary);
  }

  return sections.join("\n\n");
}

const ASK_SYSTEM = `You are JobRaker AI, a helpful career assistant. You have access to the user's real profile, tracked jobs, applications, and resumes from their JobRaker account. Use this data to give accurate, personalized answers. When the user asks about their jobs, applications, or profile, refer to the actual data provided below. Be concise and helpful.`;

const AGENT_SYSTEM = `You are JobRaker Agent, a high-performance autonomous career assistant. You have full access to the user's JobRaker data (profile, jobs, applications, resumes) shown below. You also have web search capabilities to find new information. Be proactive, data-driven, and actionable. When discussing the user's data, always reference their actual numbers and details.`;

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin || undefined);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const body: ChatBody = await req.json();
    const { messages, system, mode = "ask", webSearch } = body;

    const authHeader = req.headers.get("authorization") || "";

    const ai = createGeminiClient();
    const sb = createSupabaseClient(authHeader);

    let userContext = "";
    if (sb) {
      try {
        userContext = await fetchUserContext(sb);
      } catch (e) {
        console.error("Failed to fetch user context:", e);
      }
    }

    const baseSystem = mode === "agent" ? AGENT_SYSTEM : ASK_SYSTEM;
    const providedSystem = system ? `\n\n${system}` : "";
    const contextBlock = userContext ? `\n\n---\n# YOUR JOBRAKER DATA (live from database)\n\n${userContext}\n---` : "";
    const fullSystem = `${baseSystem}${providedSystem}${contextBlock}`;

    const geminiContent: { role: string; parts: { text: string }[] }[] = [];

    if (Array.isArray(messages)) {
      for (const msg of messages) {
        const role = msg.role === "assistant" ? "model" : "user";
        const text = (msg.parts?.map((p) => p.text).join("\n") || msg.content || "").trim();

        if (msg.role === "system") continue;
        if (text) {
          geminiContent.push({ role, parts: [{ text }] });
        }
      }
    }

    const useTools = mode === "agent" || webSearch;
    const tools = useTools ? [{ googleSearch: {} }] : undefined;

    const config: Record<string, unknown> = {
      ...(tools ? { tools } : {}),
      systemInstruction: fullSystem,
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
