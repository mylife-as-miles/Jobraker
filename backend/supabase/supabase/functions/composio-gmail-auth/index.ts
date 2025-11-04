import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Composio } from "npm:@composio/core@0.2.2";
import { corsHeaders } from "../_shared/cors.ts";

const composio = new Composio();

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const {
    userId,
    authConfigId,
    action = "initiate",
    connectionId,
  } = await req.json();

  if (!userId || !authConfigId) {
    return new Response(
      JSON.stringify({
        error: "Missing userId or authConfigId",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }

  try {
    if (action === "initiate") {
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
          JSON.stringify({
            error: "Missing connectionId for verification",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      const connectedAccount = await composio.connectedAccounts.get(
        connectionId
      );
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
      const { data: connectedAccounts } =
        await composio.connectedAccounts.list({
          userIds: [userId],
        });
      const isConnected =
        connectedAccounts &&
        connectedAccounts.some(
          (account) => account.authConfigId === authConfigId
        );

      return new Response(
        JSON.stringify({
          isConnected,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          error: "Invalid action",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
  } catch (error) {
    console.error("Error during authentication:", error);
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
