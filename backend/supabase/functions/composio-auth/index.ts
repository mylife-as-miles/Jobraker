import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Composio } from "npm:@composio/core@0.13.1";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  SubscriptionAccessError,
  requireAuthenticatedUser,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";

const corsHeaders = getCorsHeaders();

const composio = new Composio({
  apiKey: Deno.env.get("COMPOSIO_API_KEY") || "",
});

function asString(val: unknown): string {
  return typeof val === "string" ? val : "";
}

function normalizeSlug(slug: string | null | undefined): string {
  if (!slug) return "";
  return slug.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getEnvAuthConfigId(slug: string | null): string | null {
  if (!slug) return null;
  const envKey = `COMPOSIO_${slug.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_CONFIG_ID`;
  return Deno.env.get(envKey) || null;
}

function resolveAuthConfigId(body: Record<string, unknown>, item?: RequestedIntegration): string | null {
  const slug = normalizeSlug(item?.slug ?? (body.integrationSlug as string) ?? (body.slug as string));
  return (
    item?.authConfigId ||
    (body.authConfigId as string) ||
    getEnvAuthConfigId(slug)
  );
}

function connectedAccountMatches(
  account: Record<string, unknown>,
  authConfigId: string | null,
  slug?: string | null,
) {
  const authConfig = isRecord(account.authConfig) 
    ? account.authConfig 
    : (isRecord(account.auth_config) ? account.auth_config : null);
  
  const authConfigIdField = account.authConfigId || account.auth_config_id;
  const isIdMatch = authConfigId ? (
    authConfigIdField === authConfigId ||
    authConfig?.id === authConfigId
  ) : false;

  const toolkit = isRecord(account.toolkit) ? account.toolkit : null;
  const app = isRecord(account.app) ? account.app : null;

  const provider = 
    asString(authConfig?.provider) || 
    asString(account.appSlug) || 
    asString(account.app_slug) ||
    asString(account.appName) || 
    asString(account.app_name) ||
    asString(toolkit?.slug) ||
    asString(toolkit?.name) ||
    asString(app?.slug) ||
    asString(app?.name) ||
    "";

  const appUniqueId = asString(account.appUniqueId) || asString(account.app_unique_id) || "";
  const isSlugMatch = slug && (
    normalizeSlug(provider) === slug ||
    normalizeSlug(appUniqueId) === slug
  );

  console.log(
    `[Matching] Account ID=${account.id} Status=${account.status} Provider=${provider} AppUniqueId=${appUniqueId} TargetSlug=${slug} isIdMatch=${isIdMatch} isSlugMatch=${isSlugMatch}`
  );

  return (isIdMatch || isSlugMatch) && account.status === "ACTIVE";
}

interface RequestedIntegration {
  slug: string;
  label?: string;
  toolkitSlug?: string;
  authConfigId?: string;
  noAuth?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user } = await requireAuthenticatedUser(req);
    const userId = user.id;

    let body;
    try {
      body = await req.json();
    } catch (_e) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
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
      const slug = normalizeSlug(body.toolkitSlug || body.integrationSlug || body.slug || "");
      if (!slug) {
         return new Response(JSON.stringify({ error: "Missing integration slug" }), { status: 400, headers: corsHeaders });
      }

      const linkConnection = async (configId: string) => {
        const apiKey = Deno.env.get("COMPOSIO_API_KEY") || "";
        return await fetch("https://backend.composio.dev/api/v3/connected_accounts/link", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({
            user_id: userId,
            auth_config_id: configId,
          }),
        });
      };

      let finalAuthConfigId = authConfigId;
      let response: Response | null = null;

      if (finalAuthConfigId) {
        const res = await linkConnection(finalAuthConfigId);
        if (res.ok) {
          response = res;
        } else {
          const errorText = await res.text();
          if (res.status === 400 && (errorText.includes("Auth_Config_NotFound") || errorText.includes("Auth config not found"))) {
            console.warn(`Custom AuthConfig ID ${finalAuthConfigId} not found on Composio. Falling back to default...`);
            finalAuthConfigId = null;
          } else {
            throw new Error(`Composio API error (${res.status}): ${errorText}`);
          }
        }
      }

      if (!finalAuthConfigId) {
        try {
          const authConfigs = await composio.authConfigs.list({
            toolkitSlug: slug,
            isDefault: true
          });
          if (authConfigs.items && authConfigs.items.length > 0) {
            finalAuthConfigId = authConfigs.items[0].id;
          }
        } catch (e) {
          console.warn(`Failed to fetch default auth config for ${slug}:`, e);
        }

        if (!finalAuthConfigId) {
          return new Response(
            JSON.stringify({ error: `Could not resolve default AuthConfigId for ${slug}` }), 
            { status: 400, headers: corsHeaders }
          );
        }

        const res = await linkConnection(finalAuthConfigId);
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Composio API error (${res.status}): ${errorText}`);
        }
        response = res;
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
    } else if (action === "delete") {
      if (!connectionId) {
        return new Response(JSON.stringify({ error: "Missing connectionId for delete action" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const apiKey = Deno.env.get("COMPOSIO_API_KEY") || "";
      const response = await fetch(`https://backend.composio.dev/api/v1/client/auth/connection/${connectionId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Composio API error (${response.status}): ${errorText}`);
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

      // Use v3 API (v1 is deprecated and returns 410)
      const apiKey = Deno.env.get("COMPOSIO_API_KEY") || "";

      // Fetch connected accounts for this user via v3 API
      const accountsResponse = await fetch(
        `https://backend.composio.dev/api/v3/connected_accounts?user_id=${encodeURIComponent(userId)}`,
        {
          method: "GET",
          headers: { "x-api-key": apiKey },
        }
      );
      let accounts: Record<string, unknown>[] = [];
      const filteredResponseText = await accountsResponse.text();
      let rawApiResponse: unknown = null;
      try {
        rawApiResponse = JSON.parse(filteredResponseText);
        if (accountsResponse.ok) {
          const parsed = rawApiResponse as Record<string, unknown>;
          const rawItems = parsed?.items || parsed?.data || parsed;
          accounts = Array.isArray(rawItems) ? rawItems : [];
        }
      } catch (_) {
        rawApiResponse = filteredResponseText;
      }

      console.log(`[Status API v3] userId=${userId} count=${accounts.length} (${accountsResponse.status})`);

      if (requested.length > 0) {
        const statuses = requested.map((item) => {
          const itemSlug = normalizeSlug(item.slug) || "unknown";
          const isNoAuth = item.noAuth === true;
          const itemAuthConfigId = resolveAuthConfigId(body as Record<string, unknown>, item);
          const account = accounts.find((candidate) =>
            connectedAccountMatches(candidate, itemAuthConfigId, itemSlug)
          );
          const connectionParams = isRecord(account?.connectionParams) 
            ? account.connectionParams 
            : (isRecord(account?.connection_params) 
               ? account.connection_params 
               : (isRecord(account?.data) ? account.data : {}));

          const metadata = isRecord(account?.metadata) 
            ? account.metadata : (isRecord(account?.meta_data) ? account.meta_data : {});

          const identifier =
            asString(connectionParams.account_name) ||
            asString(connectionParams.email) ||
            asString(connectionParams.username) ||
            asString(connectionParams.accountName) ||
            asString(metadata.account_name) ||
            asString(metadata.email) ||
            asString(metadata.username) ||
            asString(metadata.accountName) ||
            asString(account?.name) ||
            null;

          return {
            slug: itemSlug,
            label: item.label || itemSlug,
            toolkitSlug: item.toolkitSlug || itemSlug,
            configured: true,
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
