// Generate an entire resume using Gemini based on the authenticated user's profile data.
// POST body accepts:
// {
//   targetRole?: string,
//   tone?: 'professional' | 'modern' | 'creative'
// }
// Returns: { personalInfo, summary, experience, education, skills }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createGeminiClient, GEMINI_MODEL } from "../_shared/gemini.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
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
    const body = await req.json().catch(() => ({}));
    const targetRole = (body?.targetRole || "").trim();
    const tone = (body?.tone || "professional").trim();

    // Auth
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const sb =
      supabaseUrl && anon
        ? createClient(supabaseUrl, anon, {
            global: { headers: { Authorization: authHeader } },
          })
        : null;

    // Fetch user profile data
    let profile: any = null;
    let skills: string[] = [];
    let experiences: any[] = [];
    let education: any[] = [];

    if (sb) {
      try {
        const { data: prof } = await sb
          .from("profiles")
          .select(
            "id,first_name,last_name,job_title,experience_years,location,goals,phone"
          )
          .limit(1)
          .maybeSingle();
        if (prof) profile = prof;
      } catch {}

      try {
        const { data } = await sb
          .from("profile_skills")
          .select("name,level")
          .limit(100);
        if (Array.isArray(data))
          skills = data.map((s: any) => s?.name).filter(Boolean);
      } catch {}

      try {
        const { data } = await sb
          .from("profile_experiences")
          .select("title,company,description,start_date,end_date")
          .order("start_date", { ascending: false })
          .limit(10);
        if (Array.isArray(data)) experiences = data;
      } catch {}

      try {
        const { data } = await sb
          .from("profile_education")
          .select("degree,school,location,gpa,start_date,end_date")
          .order("start_date", { ascending: false })
          .limit(5);
        if (Array.isArray(data)) education = data;
      } catch {}
    }

    // Get email from auth
    let email = "";
    if (sb) {
      try {
        const {
          data: { user },
        } = await sb.auth.getUser();
        email = user?.email || "";
      } catch {}
    }

    // Build candidate context
    const name = [profile?.first_name, profile?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    const years = profile?.experience_years;
    const title = profile?.job_title;
    const location = profile?.location;
    const phone = profile?.phone;
    const goals = Array.isArray(profile?.goals)
      ? profile.goals.join(", ")
      : profile?.goals || "";

    const expBullets = experiences
      .map((e) => {
        const pos = [e?.title, e?.company].filter(Boolean).join(" at ");
        const period = [e?.start_date, e?.end_date || "Present"]
          .filter(Boolean)
          .join(" - ");
        const desc = (e?.description || "").replace(/\s+/g, " ").trim();
        return pos
          ? `- ${pos} (${period})${desc ? `: ${desc}` : ""}`
          : desc
            ? `- ${desc}`
            : "";
      })
      .filter(Boolean)
      .join("\n");

    const eduBullets = education
      .map((e) => {
        const parts = [e?.degree, e?.school, e?.location]
          .filter(Boolean)
          .join(" · ");
        const period = [e?.start_date, e?.end_date]
          .filter(Boolean)
          .join(" - ");
        const gpa = (e?.gpa || "").toString().trim();
        return parts
          ? `- ${parts}${period ? ` (${period})` : ""}${gpa ? ` — GPA: ${gpa}` : ""}`
          : "";
      })
      .filter(Boolean)
      .join("\n");

    const skillsLine = skills.length ? skills.slice(0, 30).join(", ") : "";

    const systemPrompt = `You are an expert resume writer and career coach. Generate a complete, polished resume for the candidate based on the provided profile data.

Your output MUST be a valid JSON object that STRICTLY follows the Reactive Resume schema below.

**CRITICAL**: All \`id\` fields must be valid UUIDs.
**CRITICAL**: Do NOT include markdown formatting or code fences in your response. Return raw JSON only.

Schema Reference:
{
  "basics": {
    "name": "Full Name",
    "headline": "Current Job Title",
    "email": "email@example.com",
    "phone": "Phone Number",
    "location": "City, Country",
    "website": { "url": "", "label": "" },
    "customFields": []
  },
  "summary": {
    "title": "Summary",
    "columns": 1,
    "hidden": false,
    "content": "<p>2-4 sentence professional summary in HTML format (e.g. using <p>, <strong> etc)</p>"
  },
  "sections": {
    "experience": {
      "title": "Experience",
      "columns": 1,
      "hidden": false,
      "items": [
        {
          "id": "uuid-here",
          "hidden": false,
          "company": "Company Name",
          "position": "Job Title",
          "location": "Location",
          "period": "Date Range",
          "website": { "url": "", "label": "" },
          "description": "<ul><li>Action-oriented bullet point 1</li><li>Quantifiable achievement 2</li></ul> (HTML list)"
        }
      ]
    },
    "education": {
      "title": "Education",
      "columns": 1,
      "hidden": false,
      "items": [
        {
          "id": "uuid-here",
          "hidden": false,
          "school": "School Name",
          "degree": "Degree",
          "area": "Field of Study",
          "grade": "GPA (optional)",
          "location": "Location",
          "period": "Date Range",
          "website": { "url": "", "label": "" },
          "description": ""
        }
      ]
    },
    "skills": {
      "title": "Skills",
      "columns": 1,
      "hidden": false,
      "items": [
        {
          "id": "uuid-here",
          "hidden": false,
          "name": "Skill Name",
          "proficiency": "Advanced",
          "level": 4,
          "keywords": []
        }
      ]
    },
    "projects": {
      "title": "Projects",
      "columns": 1,
      "hidden": false,
      "items": []
    },
    "languages": {
      "title": "Languages",
      "columns": 1,
      "hidden": false,
      "items": []
    },
    "interests": {
        "title": "Interests",
        "columns": 1,
        "hidden": false,
        "items": []
    },
    "certifications": {
        "title": "Certifications",
        "columns": 1,
        "hidden": false,
        "items": []
    }
  },
  "metadata": {
    "template": "onyx",
    "layout": {
      "sidebarWidth": 35,
      "pages": [
        {
            "fullWidth": false,
            "main": ["experience", "education", "projects"],
            "sidebar": ["summary", "skills", "languages", "interests"]
        }
      ]
    }
  }
}

Resume writing guidelines:
- Lead with impact: Start bullet points with action verbs (Led, Developed, Increased, Managed)
- Quantify achievements: Use numbers when possible ("Increased sales by 25%", "Managed team of 8")
- Be specific: Replace vague terms with concrete examples
- Use ${tone} tone throughout
${targetRole ? `- Tailor the resume for the target role: ${targetRole}` : ""}
- Do NOT hallucinate or invent information. Only use what was provided.
- If limited information is provided, work with what you have and make it compelling.`;

    const userPrompt = [
      "Candidate Profile:",
      name && `Name: ${name}`,
      title && `Current Title: ${title}`,
      email && `Email: ${email}`,
      phone && `Phone: ${phone}`,
      location && `Location: ${location}`,
      years != null && `Years of Experience: ${years}`,
      goals && `Career Goals: ${goals}`,
      targetRole && `Target Role: ${targetRole}`,
      "",
      skillsLine && `Skills: ${skillsLine}`,
      "",
      expBullets && `Work Experience:\n${expBullets}`,
      "",
      eduBullets && `Education:\n${eduBullets}`,
      "",
      "Please generate a complete, professional resume using the information above. Return only valid JSON.",
    ]
      .filter(Boolean)
      .join("\n");

    const ai = createGeminiClient();

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      config: {
        thinkingConfig: { thinkingLevel: "HIGH" },
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
      },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    });

    const text = (typeof response.text === 'function' ? response.text() : response.text)?.trim() || "";

    // Parse and validate the JSON
    let resumeData;
    try {
      resumeData = JSON.parse(text);
    } catch {
      // If JSON parse fails, return raw text for debugging
      return new Response(JSON.stringify({ error: "Invalid JSON from AI", raw: text }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(resumeData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : "Unknown error";
    console.error("ai-generate-resume error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
