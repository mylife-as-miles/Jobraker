import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Composio } from "npm:@composio/core@0.2.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  SubscriptionAccessError,
  requireAuthenticatedUser,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";

// Initialize with explicit API key in edge runtime
const composio = new Composio({ apiKey: Deno.env.get("COMPOSIO_API_KEY") });

type RequestedIntegration = {
  slug?: string;
  label?: string;
  authConfigId?: string;
  toolkitSlug?: string;
  noAuth?: boolean;
};

function normalizeSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
  return normalized || null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getEnvAuthConfigId(slug: string | null): string | null {
  if (!slug) return null;
  const envKey = `COMPOSIO_${slug.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_CONFIG_ID`;
  return asString(Deno.env.get(envKey));
}

function resolveAuthConfigId(body: Record<string, unknown>, item?: RequestedIntegration): string | null {
  const slug = normalizeSlug(item?.slug ?? body.integrationSlug ?? body.slug);
  return (
    asString(item?.authConfigId) ||
    asString(body.authConfigId) ||
    getEnvAuthConfigId(slug)
  );
}

function connectedAccountMatches(
  account: Record<string, unknown>,
  authConfigId: string,
  slug?: string | null,
) {
  const authConfig = isRecord(account.authConfig) ? account.authConfig : null;
  const isIdMatch =
    account.authConfigId === authConfigId ||
    account.auth_config_id === authConfigId ||
    authConfig?.id === authConfigId;

  const accSlug = normalizeSlug(
    account.appSlug ||
    account.appName ||
    account.app ||
    account.toolkitSlug ||
    account.toolkit
  );

  const isSlugMatch = slug ? accSlug === normalizeSlug(slug) : false;
  const isActive =
    !account.status ||
    account.status === "ACTIVE" ||
    account.status === "active";

  return (isIdMatch || isSlugMatch) && isActive;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin") || undefined, req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user } = await requireAuthenticatedUser(req);

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

    const {
      action = "initiate",
      connectionId,
      integrations,
      toolSlug,
      arguments: toolArguments,
      args,
    } = body as Record<string, unknown>;
    const authConfigId = resolveAuthConfigId(body as Record<string, unknown>);

    // 3. Handle Actions
    if (action === "initiate") {
      if (!authConfigId) {
        return new Response(JSON.stringify({ error: "Missing authConfigId for initiate action" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const apiKey = Deno.env.get("COMPOSIO_API_KEY") || "";
      let response = await fetch("https://backend.composio.dev/api/v3/connected_accounts/link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          user_id: userId,
          auth_config_id: authConfigId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const isConfigNotFound =
          response.status === 400 &&
          (errorText.includes("Auth_Config_NotFound") ||
           errorText.includes("Auth config not found") ||
           errorText.includes("config not found"));

        if (isConfigNotFound) {
          const fallbackAppName = String(body.toolkitSlug || body.integrationSlug || body.slug || "");
          console.warn(`[composio-auth] Auth config ID ${authConfigId} not found/invalid. Retrying connection with default managed app for: ${fallbackAppName}`);
          response = await fetch("https://backend.composio.dev/api/v3/connected_accounts/link", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
            },
            body: JSON.stringify({
              user_id: userId,
              app_name: fallbackAppName,
              appName: fallbackAppName,
              app: fallbackAppName,
              toolkit: fallbackAppName,
              toolkitSlug: fallbackAppName,
            }),
          });
        }

        if (!response.ok) {
          const finalErrorText = isConfigNotFound ? await response.text() : errorText;
          throw new Error(`Composio API error (${response.status}): ${finalErrorText}`);
        }
      }

      const connectionRequest = await response.json();

      return new Response(
        JSON.stringify({
          connectionId: connectionRequest.id || connectionRequest.connectionId,
          redirectUrl: connectionRequest.redirectUrl || connectionRequest.redirect_url,
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
    } else if (action === "disconnect") {
      if (!connectionId) {
        return new Response(
          JSON.stringify({ error: "Missing connectionId for disconnect action" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      try {
        await composio.connectedAccounts.delete({ id: connectionId });
      } catch (err) {
        try {
          await (composio.connectedAccounts as any).delete(connectionId);
        } catch {
          const apiKey = Deno.env.get("COMPOSIO_API_KEY") || "";
          const response = await fetch(`https://backend.composio.dev/api/v3/connected_accounts/${connectionId}`, {
            method: "DELETE",
            headers: {
              "x-api-key": apiKey,
            },
          });
          if (!response.ok) {
            throw new Error(`Composio API delete failed: ${response.statusText}`);
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: "Connection deleted" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    } else if (action === "status") {
      const requested = Array.isArray(integrations)
        ? integrations.filter((item): item is RequestedIntegration =>
            item && typeof item === "object"
          )
        : [];

      if (!authConfigId && requested.length === 0) {
         return new Response(JSON.stringify({ error: "Missing authConfigId for status action" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
         });
      }

      const { data: connectedAccounts } = await composio.connectedAccounts.list({
        userIds: [userId],
      });
      const accounts = Array.isArray(connectedAccounts)
        ? connectedAccounts as Record<string, unknown>[]
        : [];

      if (requested.length > 0) {
        const statuses = requested.map((item) => {
          const itemSlug = normalizeSlug(item.slug) || "unknown";
          const isNoAuth = item.noAuth === true;
          const itemAuthConfigId = resolveAuthConfigId(body as Record<string, unknown>, item);
          const account = itemAuthConfigId
            ? accounts.find((candidate) =>
                connectedAccountMatches(candidate, itemAuthConfigId, itemSlug)
              )
            : null;
          const connectionParams = isRecord(account?.connectionParams) ? account.connectionParams : {};
          const metadata = isRecord(account?.metadata) ? account.metadata : {};
          const identifier =
            asString(connectionParams.account_name) ||
            asString(connectionParams.email) ||
            asString(connectionParams.username) ||
            asString(metadata.account_name) ||
            asString(metadata.email) ||
            asString(metadata.username) ||
            asString(account?.name) ||
            null;

          return {
            slug: itemSlug,
            label: item.label || itemSlug,
            toolkitSlug: item.toolkitSlug || itemSlug,
            configured: isNoAuth || Boolean(itemAuthConfigId),
            isConnected: isNoAuth || Boolean(account),
            connectionId: account?.id || null,
            identifier,
            authType: isNoAuth ? "NO_AUTH" : "OAUTH2",
          };
        });

        return new Response(
          JSON.stringify({ statuses }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      const singleSlug = normalizeSlug(body.integrationSlug ?? body.slug);
      const account = authConfigId
        ? accounts.find((candidate) => connectedAccountMatches(candidate, authConfigId, singleSlug))
        : null;

      return new Response(
        JSON.stringify({ isConnected: Boolean(account), connectionId: account?.id || null }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    } else if (action === "execute") {
      const slug = asString(toolSlug);
      if (!slug) {
        return new Response(JSON.stringify({ error: "Missing toolSlug for execute action" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const execute = (composio as any)?.tools?.execute;
      if (typeof execute !== "function") {
        return new Response(JSON.stringify({ error: "Composio tool execution is not available in this SDK version" }), {
          status: 501,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const result = await execute.call((composio as any).tools, slug, {
        userId,
        arguments: toolArguments ?? args ?? {},
      });

      return new Response(
        JSON.stringify({ success: true, result }),
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
        error: "Internal server error during Composio operation",
        details: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : "UnknownError",
        stack: error instanceof Error ? error.stack : undefined,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
