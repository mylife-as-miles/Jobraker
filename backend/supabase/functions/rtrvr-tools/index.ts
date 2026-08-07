import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { runMeteredRtrvrCall } from "../_shared/metered-provider-credits.ts";

const RTRVR_API_BASE = "https://api.rtrvr.ai";

const READ_ONLY_TOOLS = new Set([
  "rtrvr_scrape",
  "rtrvr_list_devices",
  "rtrvr_capabilities",
  "rtrvr_extract_from_page",
  "rtrvr_linkedin_job_hunter",
  "rtrvr_job_aggregator",
  "rtrvr_hiring_signals",
  "rtrvr_yc_startup_jobs",
  "rtrvr_brand_mention_scanner",
]);
const MUTATING_TOOLS = new Set([
  "rtrvr_run",
  "rtrvr_act_on_page",
  "rtrvr_linkedin_connect",
  "rtrvr_send_linkedin_connection_request",
]);

/** Tools that map to the /scrape endpoint instead of /agent */
const SCRAPE_TOOLS = new Set(["rtrvr_scrape", "rtrvr_extract_from_page"]);

function redact(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/(rtrvr_|mcp_at_|Bearer\s+)[A-Za-z0-9._-]+/g, "$1[redacted]");
  }
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
      key,
      /authorization|cookie|password|token|secret|api[_-]?key/i.test(key)
        ? "[redacted]"
        : redact(nested),
    ]),
  );
}

/* ---------- Template payload builders ---------- */

interface AgentPayload {
  input: string;
  urls?: string[];
  schema?: Record<string, unknown>;
  webhookUrl?: string;
  response?: { verbosity: string };
}

function buildLinkedInJobHunterPayload(args: Record<string, unknown>): AgentPayload {
  const query = String(args.query || "Software Engineer");
  const location = String(args.location || "");
  const experienceLevel = String(args.experience_level || "all");
  const limit = Number(args.limit) || 50;
  return {
    input: `Search LinkedIn Jobs for "${query}" positions${location ? ` in ${location}` : ""}. ` +
      `Experience level filter: ${experienceLevel}. Extract up to ${limit} job listings with: ` +
      `job title, company name, location, salary (if shown), job URL, posting date, job type (Full-time/Part-time/Contract), ` +
      `and a brief description. Return structured JSON.`,
    urls: ["https://www.linkedin.com/jobs"],
    response: { verbosity: "final" },
  };
}

function buildJobAggregatorPayload(args: Record<string, unknown>): AgentPayload {
  const title = String(args.title || "Software Engineer");
  const location = String(args.location || "");
  const salaryMin = String(args.salary_min || "");
  const limit = Number(args.limit) || 100;
  const perPlatform = Math.ceil(limit / 3);
  return {
    input: `Search for "${title}" jobs${location ? ` in ${location}` : ""}${salaryMin ? ` with minimum salary $${salaryMin}` : ""}. ` +
      `Search across LinkedIn Jobs, Indeed, and Glassdoor. Extract roughly ${perPlatform} jobs from each platform (${limit} total). ` +
      `For each job extract: title, company, location, salary range, URL, source platform, posting date. ` +
      `Deduplicate by company+title. Return structured JSON.`,
    urls: [
      "https://www.linkedin.com/jobs",
      "https://www.indeed.com",
      "https://www.glassdoor.com/Job",
    ],
    response: { verbosity: "final" },
  };
}

function buildHiringSignalsPayload(args: Record<string, unknown>): AgentPayload {
  const companies = String(args.companies || "");
  const signalType = String(args.signal_type || "all");
  return {
    input: `Track hiring signals for these companies: ${companies}. ` +
      `Signal focus: ${signalType}. For each company: ` +
      `1. Check their LinkedIn company page for recent job postings. ` +
      `2. Look for pattern changes in hiring (new departments, senior roles, expansion). ` +
      `3. Note new job categories or locations. ` +
      `Return a structured JSON report with company name, total open roles, key departments hiring, ` +
      `notable positions, growth signals, and hiring velocity assessment.`,
    urls: ["https://www.linkedin.com"],
    response: { verbosity: "final" },
  };
}

function buildYCStartupJobsPayload(args: Record<string, unknown>): AgentPayload {
  const role = String(args.role || "");
  const batch = String(args.batch || "all");
  const limit = Number(args.limit) || 50;
  return {
    input: `Navigate to Y Combinator's Work at a Startup (ycombinator.com/jobs). ` +
      `${role ? `Search for "${role}" positions. ` : ""}` +
      `${batch !== "all" ? `Filter by batch: ${batch}. ` : ""}` +
      `Extract up to ${limit} jobs with: job title, company name, YC batch, company description, ` +
      `location, job URL, and role type. Return structured JSON.`,
    urls: ["https://www.ycombinator.com/jobs"],
    response: { verbosity: "final" },
  };
}

function buildBrandMentionScannerPayload(args: Record<string, unknown>): AgentPayload {
  const brand = String(args.brand || "");
  const platforms = String(args.platforms || "all");
  const urls: string[] = [];
  if (platforms === "all" || platforms === "twitter") urls.push(`https://twitter.com/search?q=${encodeURIComponent(brand)}`);
  if (platforms === "all" || platforms === "reddit") urls.push(`https://www.reddit.com/search/?q=${encodeURIComponent(brand)}`);
  if (platforms === "all" || platforms === "hackernews") urls.push(`https://hn.algolia.com/?q=${encodeURIComponent(brand)}`);
  return {
    input: `Search for mentions of "${brand}" across ${platforms === "all" ? "Twitter/X, Reddit, and HackerNews" : platforms}. ` +
      `For each mention extract: platform, author/username, content/text, URL, date/time, sentiment (positive/neutral/negative), ` +
      `and engagement metrics (likes, comments, shares). Return structured JSON report.`,
    urls,
    response: { verbosity: "final" },
  };
}

function buildLinkedInConnectPayload(args: Record<string, unknown>): AgentPayload {
  const profileUrl = String(args.profile_url || args.profileUrl || "");
  const note = String(args.connection_note || args.connectionNote || "");
  return {
    input: `Navigate to this LinkedIn profile and send a connection request. ` +
      `${note ? `Include this personalized note: "${note.slice(0, 300)}"` : "Do not include a note."}`,
    urls: [profileUrl],
    response: { verbosity: "final" },
  };
}

function buildGenericAgentPayload(args: Record<string, unknown>): AgentPayload {
  const instruction = String(args.instruction || "");
  const url = String(args.url || "");
  const urls = Array.isArray(args.urls) ? (args.urls as string[]).filter(Boolean) : [];
  const allUrls = url ? [url, ...urls] : urls;
  const payload: AgentPayload = {
    input: instruction,
    response: { verbosity: "final" },
  };
  if (allUrls.length > 0) payload.urls = allUrls;
  if (args.schema && typeof args.schema === "object") payload.schema = args.schema as Record<string, unknown>;
  return payload;
}

function buildScrapePayload(args: Record<string, unknown>): { urls: string[]; response: { verbosity: string } } {
  const url = String(args.url || "");
  const urls = Array.isArray(args.urls) ? (args.urls as string[]).filter(Boolean) : [];
  const allUrls = url ? [url, ...urls] : urls;
  return {
    urls: allUrls,
    response: { verbosity: "final" },
  };
}

/**
 * Map a tool name + args to the RTRVR Cloud API endpoint and payload.
 */
function resolveRtrvrRequest(
  tool: string,
  args: Record<string, unknown>,
): { endpoint: string; payload: Record<string, unknown> } {
  if (SCRAPE_TOOLS.has(tool)) {
    return { endpoint: `${RTRVR_API_BASE}/scrape`, payload: buildScrapePayload(args) };
  }

  let agentPayload: AgentPayload;
  switch (tool) {
    case "rtrvr_linkedin_job_hunter":
      agentPayload = buildLinkedInJobHunterPayload(args);
      break;
    case "rtrvr_job_aggregator":
      agentPayload = buildJobAggregatorPayload(args);
      break;
    case "rtrvr_hiring_signals":
      agentPayload = buildHiringSignalsPayload(args);
      break;
    case "rtrvr_yc_startup_jobs":
      agentPayload = buildYCStartupJobsPayload(args);
      break;
    case "rtrvr_brand_mention_scanner":
      agentPayload = buildBrandMentionScannerPayload(args);
      break;
    case "rtrvr_linkedin_connect":
    case "rtrvr_send_linkedin_connection_request":
      agentPayload = buildLinkedInConnectPayload(args);
      break;
    case "rtrvr_list_devices":
      return {
        endpoint: `${RTRVR_API_BASE}/agent`,
        payload: { input: "List all connected browser extension devices.", response: { verbosity: "final" } },
      };
    case "rtrvr_capabilities":
      return {
        endpoint: `${RTRVR_API_BASE}/agent`,
        payload: { input: "Return current profile capabilities and available automation features.", response: { verbosity: "final" } },
      };
    default:
      // rtrvr_run, rtrvr_act_on_page, and any unknown tools
      agentPayload = buildGenericAgentPayload(args);
      break;
  }

  return { endpoint: `${RTRVR_API_BASE}/agent`, payload: agentPayload };
}

/* ---------- Legacy worker support ---------- */

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return bytesToHex(new Uint8Array(hash));
}

async function hmacSha256Hex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return bytesToHex(new Uint8Array(signature));
}

async function signedWorkerHeaders(
  workerSecret: string,
  body: string,
): Promise<Record<string, string>> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomUUID();
  const bodyHash = await sha256Hex(body);
  const signature = await hmacSha256Hex(
    workerSecret,
    `${timestamp}.${nonce}.${bodyHash}`,
  );
  return {
    "x-jobraker-worker-timestamp": timestamp,
    "x-jobraker-worker-nonce": nonce,
    "x-jobraker-worker-body-sha256": bodyHash,
    "x-jobraker-worker-signature": `sha256=${signature}`,
  };
}

/* ---------- Main handler ---------- */

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const tool = typeof body.tool === "string" ? body.tool : "";
    if (!READ_ONLY_TOOLS.has(tool) && !MUTATING_TOOLS.has(tool)) {
      return new Response(JSON.stringify({ error: "Unsupported rtrvr tool" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    if (MUTATING_TOOLS.has(tool) && body.approved !== true) {
      return new Response(
        JSON.stringify({
          error: "Mutating rtrvr tools require explicit Agent Mode approval.",
          code: "approval_required",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    const rtrvrApiKey = Deno.env.get("RTRVR_API_KEY") || "";
    const args = body.args && typeof body.args === "object" ? body.args : {};
    const operationClass = SCRAPE_TOOLS.has(tool) ? "scrape" : MUTATING_TOOLS.has(tool) ? "act" : "run";

    const executeRtrvr = async () => {
      // ── Strategy A: RTRVR Cloud API (preferred) ──
      if (rtrvrApiKey) {
        const { endpoint, payload } = resolveRtrvrRequest(tool, args);
        console.log(`rtrvr-tools [cloud] tool=${tool} endpoint=${endpoint}`);

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${rtrvrApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const result = await response.json().catch(async () => ({
          raw: await response.text().catch(() => ""),
        }));

        const confirmedUnits = typeof result?.credits_used === "number"
          ? result.credits_used
          : typeof result?.usage?.credits === "number"
            ? result.usage.credits
            : 1;

        return {
          result: new Response(JSON.stringify(redact(result)), {
            status: response.ok ? 200 : response.status,
            headers: { ...corsHeaders, "content-type": "application/json" },
          }),
          confirmedUnits,
          providerRunId: result?.id || result?.run_id || undefined,
        };
      }

      // ── Strategy B: Legacy automation worker (fallback) ──
      const workerUrl = (Deno.env.get("AUTOMATION_WORKER_URL") || "").replace(/\/$/, "");
      const workerSecret = Deno.env.get("AUTOMATION_WORKER_SECRET") || "";
      if (!workerUrl || !workerSecret) {
        return {
          result: new Response(
            JSON.stringify({
              error: "No RTRVR API key or automation worker configured. Set RTRVR_API_KEY in Supabase secrets.",
              code: "not_configured",
            }),
            {
              status: 503,
              headers: { ...corsHeaders, "content-type": "application/json" },
            },
          ),
          confirmedUnits: 0,
        };
      }

      console.log(`rtrvr-tools [worker-fallback] tool=${tool}`);
      const workerBody = JSON.stringify({
        tool,
        args,
        user_id: userData.user.id,
      });
      const response = await fetch(`${workerUrl}/tools/rtrvr`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...await signedWorkerHeaders(workerSecret, workerBody),
        },
        body: workerBody,
      });
      const result = await response.json().catch(async () => ({
        raw: await response.text().catch(() => ""),
      }));

      const confirmedUnits = typeof result?.credits_used === "number"
        ? result.credits_used
        : 1;

      return {
        result: new Response(JSON.stringify(redact(result)), {
          status: response.status,
          headers: { ...corsHeaders, "content-type": "application/json" },
        }),
        confirmedUnits,
        providerRunId: result?.id || result?.run_id || undefined,
      };
    };

    return runMeteredRtrvrCall({
      serviceClient,
      userId: userData.user.id,
      operationClass,
      featureKey: tool,
      payload: args,
      execute: executeRtrvr,
    });
  } catch (error) {
    console.error("rtrvr-tools error", redact(error));
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  }
});
