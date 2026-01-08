// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/types.ts";

console.log("Telemetry function initialized");

serve(async (req) => {
  const { method } = req;
  const origin = req.headers.get("origin") || "";
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight request
  if (method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Only accept POST requests
    if (method !== "POST") {
      throw new Error("Method not allowed");
    }

    const { events } = await req.json();

    // In a production environment, you would insert these events into an analytics table,
    // log them to a specialized logging service (like Sentry, LogRocket, PostHog),
    // or forward them to a data warehouse (BigQuery, Snowflake).
    //
    // For now, we log them to the function logs which serves as a basic capture mechanism.
    if (Array.isArray(events)) {
      console.log(`[Telemetry] Received ${events.length} events:`);
      events.forEach((event, index) => {
        console.log(`[Event ${index + 1}]`, JSON.stringify(event));
      });
    } else {
       console.log(`[Telemetry] Received payload:`, events);
    }

    return new Response(JSON.stringify({ ok: true, count: events?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Telemetry error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
