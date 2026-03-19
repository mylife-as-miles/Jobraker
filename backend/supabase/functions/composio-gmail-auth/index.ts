import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Composio } from "npm:@composio/core@0.2.2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  SubscriptionAccessError,
  requireSubscriptionTier,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";

// Initialize with explicit API key in edge runtime
const composio = new Composio({ apiKey: Deno.env.get("COMPOSIO_API_KEY") });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user } = await requireSubscriptionTier(
      req,
      "Ultimate",
      "Gmail integration",
    );

    const userId = user.id;

    // 2. Parse request body
    let body;
    try {
      body = await req.json();
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Invalid JSON in request body",
          details: error.message,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { authConfigId, action = "initiate", connectionId } = body;

    // 3. Handle Actions
    if (action === "initiate") {
      if (!authConfigId) {
        return new Response(JSON.stringify({ error: "Missing authConfigId for initiate action" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const connectionRequest = await composio.connectedAccounts.initiate(
        userId,
        authConfigId,
        { allowMultiple: true }
      );

      return new Response(
        JSON.stringify({
          connectionId: connectionRequest.id,
          redirectUrl: connectionRequest.redirectUrl,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    } else if (action === "verify") {
      if (!connectionId) {
        return new Response(
          JSON.stringify({ error: "Missing connectionId for verification" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      const connectedAccount = await composio.connectedAccounts.get(connectionId);
      console.log("Connected account:", connectedAccount);

      return new Response(
        JSON.stringify({
          message: "Verification successful",
          connectedAccount,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    } else if (action === "status") {
      if (!authConfigId) {
         return new Response(JSON.stringify({ error: "Missing authConfigId for status action" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
         });
      }

      const { data: connectedAccounts } = await composio.connectedAccounts.list({
        userIds: [userId],
      });
      const isConnected =
        connectedAccounts &&
        connectedAccounts.some((account) => account.authConfigId === authConfigId);

      return new Response(
        JSON.stringify({ isConnected }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  } catch (error) {
    if (error instanceof SubscriptionAccessError) {
      return subscriptionErrorResponse(error, corsHeaders);
    }
    console.error("Error during Composio authentication:", error);
    return new Response(
      JSON.stringify({
        error: "Authentication failed",
        details: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
