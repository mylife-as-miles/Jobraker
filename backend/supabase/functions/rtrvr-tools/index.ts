import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const READ_ONLY_TOOLS = new Set([
  "rtrvr_scrape",
  "rtrvr_list_devices",
  "rtrvr_capabilities",
  "rtrvr_extract_from_page",
  "rtrvr_linkedin_job_hunter",
  "rtrvr_job_aggregator",
  "rtrvr_hiring_signals",
]);
const MUTATING_TOOLS = new Set(["rtrvr_run", "rtrvr_act_on_page"]);

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

    const workerUrl = (Deno.env.get("AUTOMATION_WORKER_URL") || "").replace(/\/$/, "");
    const workerSecret = Deno.env.get("AUTOMATION_WORKER_SECRET") || "";
    if (!workerUrl || !workerSecret) {
      return new Response(
        JSON.stringify({
          error: "The rtrvr automation worker is not configured.",
          code: "worker_not_configured",
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    const workerBody = JSON.stringify({
      tool,
      args: body.args && typeof body.args === "object" ? body.args : {},
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

    return new Response(JSON.stringify(redact(result)), {
      status: response.status,
      headers: { ...corsHeaders, "content-type": "application/json" },
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
