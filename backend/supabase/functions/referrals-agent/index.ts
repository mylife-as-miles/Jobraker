import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  createGeminiClient,
  createGeminiConfig,
  extractGeminiText,
  GEMINI_MODEL,
  withGeminiRetry,
  withModelFallback,
} from "../_shared/gemini.ts";
import {
  SubscriptionAccessError,
  requireSubscriptionTier,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";
import {
  enforceFeatureRateLimit,
  recordFeatureUsage,
} from "../_shared/feature-limits.ts";

type Conn = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  position: string | null;
};

type JobRow = {
  id: string;
  title: string | null;
  company: string | null;
  description: string | null;
};

serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    const { user, serviceClient, subscriptionTier } = await requireSubscriptionTier(
      req,
      "Basics",
      "Referral network AI match",
    );
    await enforceFeatureRateLimit({
      userId: user.id,
      featureKey: "referrals_agent",
      serviceClient,
      subscriptionTier,
    });

    const { data: connections, error: cErr } = await serviceClient
      .from("linkedin_connections")
      .select("id, first_name, last_name, company, position")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(60);

    if (cErr) throw cErr;
    const conns = (connections || []) as Conn[];
    if (!conns.length) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "no_connections",
          message: "Upload LinkedIn connections first.",
        }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const { data: jobs, error: jErr } = await serviceClient
      .from("jobs")
      .select("id, title, company, description")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(28);

    if (jErr) throw jErr;
    const jobRows = (jobs || []) as JobRow[];
    if (!jobRows.length) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "no_jobs",
          message: "Save jobs to your board first so we can match your network.",
        }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const connPayload = conns.map((c, ci) => ({
      ci,
      id: c.id,
      name: [c.first_name, c.last_name].filter(Boolean).join(" "),
      company: c.company,
      title: c.position,
    }));

    const jobPayload = jobRows.map((j, ji) => ({
      ji,
      id: j.id,
      title: j.title,
      company: j.company,
      description: (j.description || "").slice(0, 1200),
    }));

    const prompt = `You are JobRaker's referral agent. Match LinkedIn connections to the user's saved job postings.
Return ONLY valid JSON: { "matches": [ { "ci": number, "ji": number, "fit_score": number, "rationale": string } ] }
Rules:
- ci and ji are indices into the provided connections and jobs arrays (0-based).
- At most 24 matches total; only include pairs with fit_score >= 45.
- fit_score is 0-100 integer.
- rationale: one short sentence.

Connections JSON:
${JSON.stringify(connPayload)}

Jobs JSON:
${JSON.stringify(jobPayload)}`;

    const ai = createGeminiClient();
    const { result: response } = await withModelFallback((model) =>
      ai.models.generateContent({
        model,
        config: createGeminiConfig({
          systemInstruction:
            "You output only JSON. Never include markdown fences. Be conservative—prefer fewer high-confidence matches.",
          responseMimeType: "application/json",
          thinkingLevel: "LOW",
        }, model),
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      })
    );

    const text = extractGeminiText(response);
    const parsed = JSON.parse(text) as {
      matches?: Array<{ ci: number; ji: number; fit_score: number; rationale: string }>;
    };
    const rawMatches = Array.isArray(parsed.matches) ? parsed.matches : [];

    await serviceClient.from("referral_match_suggestions").delete().eq("user_id", user.id);

    const rows: Array<{
      user_id: string;
      connection_id: string;
      job_id: string;
      fit_score: number;
      rationale: string;
      agent_metadata: Record<string, unknown>;
    }> = [];

    for (const m of rawMatches) {
      const c = conns[m.ci];
      const j = jobRows[m.ji];
      if (!c?.id || !j?.id) continue;
      const score = Math.max(0, Math.min(100, Math.round(Number(m.fit_score) || 0)));
      if (score < 45) continue;
      rows.push({
        user_id: user.id,
        connection_id: c.id,
        job_id: j.id,
        fit_score: score,
        rationale: String(m.rationale || "").slice(0, 500),
        agent_metadata: { ci: m.ci, ji: m.ji },
      });
    }

    if (rows.length) {
      const { error: insErr } = await serviceClient.from("referral_match_suggestions").insert(rows);
      if (insErr) throw insErr;
    }

    await serviceClient
      .from("linkedin_connections")
      .update({ agent_scan_status: "complete" })
      .eq("user_id", user.id);

    await recordFeatureUsage({
      userId: user.id,
      featureKey: "referrals_agent",
      serviceClient,
      subscriptionTier,
      metadata: {
        suggestions_created: rows.length,
        connections_scanned: conns.length,
        jobs_considered: jobRows.length,
      },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        suggestions_created: rows.length,
        connections_scanned: conns.length,
        jobs_considered: jobRows.length,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    if (error instanceof SubscriptionAccessError) {
      return subscriptionErrorResponse(error, cors);
    }
    console.error("referrals-agent:", error);
    const message = error instanceof Error ? error.message : "Internal error";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
