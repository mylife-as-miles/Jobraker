import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createGeminiClient,
  createGeminiConfig,
  extractGeminiText,
  getGeminiAccessDeniedMessage,
  isGeminiAccessDeniedError,
  withModelFallback,
} from "../_shared/gemini.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { parseStructuredJson } from "../_shared/structured-json.ts";
import {
  SubscriptionAccessError,
  requireSubscriptionTier,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";
import {
  enforceFeatureRateLimit,
  recordFeatureUsage,
} from "../_shared/feature-limits.ts";

interface OutreachRequest {
  companyName: string;
  role: string;
  resumeText: string;
  publicProfileUrl?: string;
  jobDescription?: string;
  instructions?: string;
}

type OutreachResponse = {
  subject: string;
  body: string;
};

function sanitizeInput(text: string, maxLength: number): string {
  if (!text) return "";
  let sanitized = text.substring(0, maxLength);
  const injectionPatterns = [
    /ignore all previous instructions/gi,
    /disregard previous instructions/gi,
    /you are now a/gi,
    /system prompt/gi,
    /output the following/gi,
  ];
  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }
  return sanitized.trim();
}

function buildPrompt(
  companyName: string,
  role: string,
  resumeText: string,
  publicProfileUrl?: string,
  jobDescription?: string,
  instructions?: string,
): string {
  return `You are an expert career coach and professional copywriter writing a highly persuasive and personalized recruiter/hiring manager outreach message (LinkedIn note or email).

  <CANDIDATE_RESUME>
  ${resumeText}
  </CANDIDATE_RESUME>

  <TARGET_JOB_INFO>
  Company: ${companyName}
  Role: ${role}
  ${jobDescription ? `Job Description:\n${jobDescription}` : ""}
  </TARGET_JOB_INFO>

  ${publicProfileUrl ? `Candidate Portfolio Link: ${publicProfileUrl}` : ""}

  ${instructions ? `<ADDITIONAL_INSTRUCTIONS>\n  ${instructions}\n  </ADDITIONAL_INSTRUCTIONS>\n` : ""}

  REQUIREMENTS:
  1. The output MUST be a valid JSON object.
  2. The JSON object MUST have exactly two keys: "subject" and "body".
  3. "subject" should be a compelling, professional subject line (under 10 words). E.g. "Tech Operations & Systems Leadership - JohnPaul Ezeagwu" or similar tailored to the candidate's name and role.
  4. "body" should be a highly personalized, short outreach message (under 250 words) suitable for a LinkedIn connection note or an email.
  5. The message MUST start with a professional greeting like "Hi [Hiring Manager Name or 'Team']," or "Dear [Company Name] Hiring Team,".
  6. The body should connect key metrics and proof points from the candidate's resume/profile to the core responsibilities of the role.
  7. The body MUST naturally reference the Candidate Portfolio Link (if provided) using a friendly CTA. E.g. "You can view my full professional profile and project portfolio here: 👉 ${publicProfileUrl}".
  8. Return ONLY the raw JSON object. Do not wrap in markdown code blocks like \`\`\`json.
  `;
}

function buildFallbackOutreachResponse(
  companyName: string,
  role: string,
  publicProfileUrl?: string,
): OutreachResponse {
  const urlSnippet = publicProfileUrl
    ? `\n\nYou can view my full professional profile and project portfolio here: 👉 ${publicProfileUrl}`
    : "";

  return {
    subject: `Application interest: ${role} - JobRaker Candidate`,
    body: `Hi ${companyName} Hiring Team,\n\nI am writing to express my interest in the ${role} position at ${companyName}. Given my background in operations, execution, and project leadership, I am excited about the opportunity to contribute to your team's success.${urlSnippet}\n\nI would love to connect and share more about my experiences.\n\nBest,\nJobRaker Candidate`,
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { user, serviceClient, subscriptionTier } = await requireSubscriptionTier(
      req,
      "Basics",
      "AI outreach generation",
    );

    // Use the outreach feature limits / billing key
    await enforceFeatureRateLimit({
      userId: user.id,
      featureKey: "generate_outreach",
      serviceClient,
      subscriptionTier,
    });

    const {
      companyName,
      role,
      resumeText,
      publicProfileUrl,
      jobDescription,
      instructions,
    } = (await req.json()) as OutreachRequest;

    if (!companyName || !role || !resumeText) {
      return new Response(
        JSON.stringify({ error: "companyName, role, and resumeText are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const safeCompanyName = sanitizeInput(companyName, 200);
    const safeRole = sanitizeInput(role, 200);
    const safeResume = sanitizeInput(resumeText, 25000);
    const safePublicProfileUrl = publicProfileUrl ? sanitizeInput(publicProfileUrl, 1000) : undefined;
    const safeJobDesc = jobDescription ? sanitizeInput(jobDescription, 15000) : undefined;
    const safeInstructions = instructions ? sanitizeInput(instructions, 2000) : undefined;

    const prompt = buildPrompt(
      safeCompanyName,
      safeRole,
      safeResume,
      safePublicProfileUrl,
      safeJobDesc,
      safeInstructions,
    );

    let outreach: OutreachResponse;
    try {
      const ai = createGeminiClient();
      const { result } = await withModelFallback((model) =>
        ai.models.generateContent({
          model,
          config: createGeminiConfig({
            systemInstruction:
              "You are an expert recruiter outreach assistant. Return ONLY valid JSON matching the requested schema.",
            responseMimeType: "application/json",
          }),
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        })
      );

      const text = extractGeminiText(result);
      if (!text) throw new Error("Empty response from AI");
      const parsed = parseStructuredJson(text) as Record<string, unknown>;

      outreach = {
        subject: typeof parsed.subject === "string" ? parsed.subject : `Application interest: ${safeRole}`,
        body: typeof parsed.body === "string" ? parsed.body : `Hi ${safeCompanyName} Hiring Team,...`,
      };
    } catch (error: any) {
      console.error("generate-outreach falling back", error);
      if (isGeminiAccessDeniedError(error)) {
        console.warn(getGeminiAccessDeniedMessage("AI outreach generation"));
      }
      outreach = buildFallbackOutreachResponse(
        safeCompanyName,
        safeRole,
        safePublicProfileUrl,
      );
    }

    await recordFeatureUsage({
      userId: user.id,
      featureKey: "generate_outreach",
      serviceClient,
      subscriptionTier,
      metadata: {
        company_name: safeCompanyName,
        role: safeRole,
        has_public_profile: Boolean(safePublicProfileUrl),
      },
    });

    return new Response(JSON.stringify(outreach), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    if (error instanceof SubscriptionAccessError) {
      return subscriptionErrorResponse(error, corsHeaders);
    }
    console.error("Error in generate-outreach:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
