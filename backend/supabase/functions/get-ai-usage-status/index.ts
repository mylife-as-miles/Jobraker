import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuthenticatedUser } from "../_shared/subscription.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user, serviceClient } = await requireAuthenticatedUser(req);

    const { data, error } = await serviceClient.rpc("get_ai_usage_status", {
      p_user_id: user.id,
    });

    if (error) {
      console.error("[get-ai-usage-status] RPC error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to retrieve AI usage status" }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Cache-Control": "private, no-cache, no-store, must-revalidate",
          },
        },
      );
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (err: any) {
    const status = typeof err?.status === "number" ? err.status : 500;
    const message = err?.message || "Internal server error";

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  }
});
