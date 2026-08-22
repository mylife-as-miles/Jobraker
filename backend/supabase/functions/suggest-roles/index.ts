import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createGeminiClient,
  createGeminiConfig,
  extractGeminiText,
  GEMINI_MODEL,
  runMeteredAiCall,
  withModelFallback,
} from "../_shared/gemini.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { parseStructuredJson } from "../_shared/structured-json.ts";
import {
  requireAuthenticatedUser,
} from "../_shared/subscription.ts";

interface SuggestSearchPreferencesRequest {
  type?: "roles" | "locations" | "all";
  currentRole?: string;
  currentLocation?: string;
  skills?: string[];
  experiences?: Array<{ title?: string; company?: string; location?: string }>;
}

interface SuggestSearchPreferencesResponse {
  roles?: string[];
  locations?: string[];
}

function sanitizeText(val: unknown, maxLen = 100): string {
  if (typeof val !== "string") return "";
  return val.replace(/[^\w\s&/+#,.-]/gi, " ").replace(/\s+/g, " ").trim().slice(0, maxLen);
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { user, serviceClient } = await requireAuthenticatedUser(req);
    const body: SuggestSearchPreferencesRequest = await req.json().catch(() => ({}));
    const reqType = body.type || "all";

    // Load profile context
    let currentRole = sanitizeText(body.currentRole || "");
    let currentLocation = sanitizeText(body.currentLocation || "");
    let skills = Array.isArray(body.skills) ? body.skills.map((s) => sanitizeText(s, 50)).filter(Boolean) : [];
    let experiences = Array.isArray(body.experiences)
      ? body.experiences.map((e) => ({
          title: sanitizeText(e?.title || "", 80),
          company: sanitizeText(e?.company || "", 80),
          location: sanitizeText(e?.location || "", 80),
        })).filter((e) => e.title || e.location)
      : [];

    if (!skills.length || !experiences.length || !currentRole || !currentLocation) {
      const [profileRes, skillsRes, expRes] = await Promise.all([
        serviceClient.from("profiles").select("job_title, location, location_scope, goals, work_timezone").eq("id", user.id).maybeSingle(),
        serviceClient.from("profile_skills").select("name").eq("user_id", user.id).limit(15),
        serviceClient.from("profile_experiences").select("title, company, location").eq("user_id", user.id).limit(5),
      ]);

      if (!currentRole && profileRes.data?.job_title) {
        currentRole = sanitizeText(profileRes.data.job_title);
      }
      if (!currentLocation && profileRes.data?.location) {
        currentLocation = sanitizeText(profileRes.data.location);
      }
      if (!skills.length && Array.isArray(skillsRes.data)) {
        skills = skillsRes.data.map((s: any) => sanitizeText(s.name, 50)).filter(Boolean);
      }
      if (!experiences.length && Array.isArray(expRes.data)) {
        experiences = expRes.data.map((e: any) => ({
          title: sanitizeText(e.title, 80),
          company: sanitizeText(e.company, 80),
          location: sanitizeText(e.location, 80),
        })).filter((e: any) => e.title || e.location);
      }
    }

    const ai = createGeminiClient();
    const systemPrompt = `You are an elite AI career intelligence advisor and global job discovery assistant.
Analyze the candidate's profile context (current role, current location, skills, past experience locations).

Tasks to output:
1. If "roles" are requested: Suggest 6 to 8 highly relevant, standard target job titles (in Title Case).
2. If "locations" are requested: Suggest 6 to 8 realistic, high-opportunity target locations (e.g. "Remote", their primary city/country, top tech hubs, and high-demand global remote markets like "United States", "United Kingdom", "Canada", "Germany", "Lagos, Nigeria", "London, UK", "New York, US").

Rules:
- Return clean strings without bracket annotations or emojis.
- Return STRICT valid JSON matching this schema:
{
  "roles": ["Title 1", "Title 2", ...],
  "locations": ["Remote", "Location 1", "Location 2", ...]
}`;

    const userPrompt = JSON.stringify({
      requestType: reqType,
      currentRole: currentRole || "Software Engineer",
      currentLocation: currentLocation || "Remote",
      topSkills: skills.slice(0, 12),
      pastExperience: experiences.slice(0, 5),
    });

    const aiResult = await runMeteredAiCall({
      userId: user.id,
      featureKey: "suggest_roles",
      call: async () => {
        return await withModelFallback(
          (m) =>
            ai.models.generateContent({
              model: m,
              contents: [{ role: "user", parts: [{ text: userPrompt }] }],
              config: createGeminiConfig({
                systemInstruction: systemPrompt,
                responseMimeType: "application/json",
                temperature: 0.35,
              }),
            }),
          GEMINI_MODEL,
        );
      },
    });

    const rawText = extractGeminiText(aiResult);
    const parsed = parseStructuredJson<SuggestSearchPreferencesResponse>(rawText);

    let roles: string[] = [];
    if (parsed && Array.isArray(parsed.roles) && parsed.roles.length > 0) {
      roles = parsed.roles
        .map((r) => sanitizeText(r, 80))
        .filter((r) => r.length >= 3 && r.length <= 80);
    }
    if (!roles.length && (reqType === "roles" || reqType === "all")) {
      roles = [
        currentRole || "Senior Software Engineer",
        "Senior AI & Backend Developer",
        "Full Stack Engineer",
        "AI Engineer",
        "Backend Developer",
        "Machine Learning Engineer",
        "DevOps Engineer",
      ].filter((v, i, a) => a.indexOf(v) === i);
    }

    let locations: string[] = [];
    if (parsed && Array.isArray(parsed.locations) && parsed.locations.length > 0) {
      locations = parsed.locations
        .map((l) => sanitizeText(l, 80))
        .filter((l) => l.length >= 2 && l.length <= 80);
    }
    if (!locations.length && (reqType === "locations" || reqType === "all")) {
      locations = [
        "Remote",
        currentLocation || "Enugu, Nigeria",
        "Lagos, Nigeria",
        "United States",
        "United Kingdom",
        "Canada",
        "Germany",
      ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i) as string[];
    }

    return new Response(JSON.stringify({ roles, locations }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[suggest-roles] Error:", err);
    return new Response(
      JSON.stringify({
        roles: [
          "Senior AI & Backend Developer",
          "Full Stack Engineer",
          "AI Engineer",
          "Backend Developer",
          "Machine Learning Engineer",
          "DevOps Engineer",
        ],
        locations: [
          "Remote",
          "Enugu, Nigeria",
          "Lagos, Nigeria",
          "United States",
          "United Kingdom",
          "Canada",
          "Germany",
        ],
        warning: err.message,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
