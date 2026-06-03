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
import { withRetry, resolveFirecrawlApiKey, firecrawlFetch } from "../_shared/firecrawl.ts";

interface ScoutRequest {
  companyName: string;
}

interface ScoutResult {
  domain: string;
  careersPageUrl: string;
  contactEmail: string;
  publicContactChannels: string[];
  confidence: "high" | "medium" | "low";
  foundSource: string;
}

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

function buildPrompt(companyName: string, searchMarkdown: string): string {
  return `You are a professional recruiting research assistant. Extract the career page URL, contact email, domain, and contact channels for the company "${companyName}" from the following web search data.
  
  <SEARCH_DATA>
  ${searchMarkdown}
  </SEARCH_DATA>
  
  REQUIREMENTS:
  1. The output MUST be a valid JSON object.
  2. The JSON object MUST have exactly these keys: "domain", "careersPageUrl", "contactEmail", "publicContactChannels", "confidence", "foundSource".
  3. "domain" should be the official domain of the company (e.g. "company.com" or "company.co.uk").
  4. "careersPageUrl" should be the official careers, jobs, or about page URL.
  5. "contactEmail" should be a verified recruitment, HR, talent, or general contact email. Leave as empty string if none found.
  6. "publicContactChannels" should be an array of strings representing found application channels (e.g., ["Careers Portal", "LinkedIn", "Email"]).
  7. "confidence" should be "high" (if verified email or page found on their domain), "medium" (if found via third party or directories), or "low" (if guessed/unverified).
  8. "foundSource" should describe where you found this information (e.g., "Official careers page via Firecrawl search" or similar).
  
  Return ONLY the raw JSON object. Do not wrap in markdown code blocks like \`\`\`json.
  `;
}

function buildFallbackScoutResponse(companyName: string): ScoutResult {
  const cleanCompany = companyName.replace(/\s+/g, "").toLowerCase();
  return {
    domain: `${cleanCompany}.com`,
    careersPageUrl: `https://www.${cleanCompany}.com/careers`,
    contactEmail: "",
    publicContactChannels: ["Careers Page", "Contact Form", "LinkedIn Company Page"],
    confidence: "low",
    foundSource: "Heuristic domain matching only; no verified email found",
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
      "Company scouting",
    );

    await enforceFeatureRateLimit({
      userId: user.id,
      featureKey: "scout_company",
      serviceClient,
      subscriptionTier,
    });

    const { companyName } = (await req.json()) as ScoutRequest;

    if (!companyName) {
      return new Response(
        JSON.stringify({ error: "companyName is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const safeCompanyName = sanitizeInput(companyName, 200);

    // 1. Perform Firecrawl Search
    let searchMarkdown = "";
    let scoutedResult: ScoutResult;

    try {
      const firecrawlApiKey = await resolveFirecrawlApiKey();
      const query = `"${safeCompanyName}" careers page OR "${safeCompanyName}" recruiter email contact info OR "${safeCompanyName}" jobs`;
      const searchRes = await withRetry(
        () =>
          firecrawlFetch(
            "/search",
            firecrawlApiKey,
            {
              query,
              limit: 4,
              sources: ["web"],
            },
            user.id
          ),
        2,
        600
      );

      const items = Array.isArray(searchRes?.data) ? searchRes.data : [];
      searchMarkdown = items
        .map((item: any) => `URL: ${item.url || ""}\nContent:\n${item.markdown || item.description || ""}`)
        .join("\n\n---\n\n");
    } catch (firecrawlError) {
      console.warn("Firecrawl search failed or unauthorized", firecrawlError);
    }

    // 2. Process with Gemini if search results found
    if (searchMarkdown.trim()) {
      try {
        const prompt = buildPrompt(safeCompanyName, searchMarkdown);
        const ai = createGeminiClient();
        const { result } = await withModelFallback((model) =>
          ai.models.generateContent({
            model,
            config: createGeminiConfig({
              systemInstruction:
                "You are an expert recruitment researcher. Extract company channels. Return ONLY valid JSON.",
              responseMimeType: "application/json",
            }),
            contents: [{ role: "user", parts: [{ text: prompt }] }],
          })
        );

        const text = extractGeminiText(result);
        if (!text) throw new Error("Empty response from AI extraction");
        const parsed = parseStructuredJson(text) as Record<string, unknown>;

        scoutedResult = {
          domain: typeof parsed.domain === "string" ? parsed.domain : `${safeCompanyName.toLowerCase().replace(/\s+/g, "")}.com`,
          careersPageUrl: typeof parsed.careersPageUrl === "string" ? parsed.careersPageUrl : "",
          contactEmail: typeof parsed.contactEmail === "string" ? parsed.contactEmail : "",
          publicContactChannels: Array.isArray(parsed.publicContactChannels) ? parsed.publicContactChannels : [],
          confidence: (parsed.confidence === "high" || parsed.confidence === "medium" || parsed.confidence === "low") ? parsed.confidence : "medium",
          foundSource: typeof parsed.foundSource === "string" ? parsed.foundSource : "Web search results",
        };
      } catch (geminiError) {
        console.error("Gemini extraction failed, using fallback", geminiError);
      scoutedResult = buildFallbackScoutResponse(safeCompanyName);
    }
  } else {
    console.info("No search data available, using fallback");
    scoutedResult = buildFallbackScoutResponse(safeCompanyName);
  }

    if (scoutedResult.confidence === "low") {
      scoutedResult = {
        ...scoutedResult,
        contactEmail: "",
        publicContactChannels: Array.from(
          new Set([
            "Careers Page",
            ...scoutedResult.publicContactChannels.filter((channel) =>
              !/email/i.test(channel)
            ),
          ]),
        ),
      };
    }

    await recordFeatureUsage({
      userId: user.id,
      featureKey: "scout_company",
      serviceClient,
      subscriptionTier,
      metadata: {
        company_name: safeCompanyName,
        confidence: scoutedResult.confidence,
        has_email: Boolean(scoutedResult.contactEmail),
        source: scoutedResult.foundSource,
      },
    });

    return new Response(JSON.stringify(scoutedResult), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    if (error instanceof SubscriptionAccessError) {
      return subscriptionErrorResponse(error, corsHeaders);
    }
    console.error("Error in scout-company:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
