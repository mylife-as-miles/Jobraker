import { getCorsHeaders } from "../_shared/cors.ts";
import { capturePostHogEvent } from "../_shared/posthog.ts";
import { requireAuthenticatedUser } from "../_shared/subscription.ts";

const allowedEvents = new Set([
  "user_signed_up",
  "resume_uploaded",
  "application_started",
  "application_submitted",
  "subscription_started",
]);

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin, req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  try {
    const { user } = await requireAuthenticatedUser(req);
    const body = await req.json().catch(() => ({}));
    const event = typeof body?.event === "string" ? body.event.trim() : "";

    if (!allowedEvents.has(event)) {
      return new Response(JSON.stringify({ error: "Unsupported event" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const properties =
      body?.properties &&
      typeof body.properties === "object" &&
      !Array.isArray(body.properties)
        ? body.properties
        : {};

    await capturePostHogEvent({
      event,
      distinctId: user.id,
      properties: {
        ...properties,
        source: "supabase_edge_function",
      },
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = /unauthorized|authorization/i.test(message) ? 401 : 500;

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
