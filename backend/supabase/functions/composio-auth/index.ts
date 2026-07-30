import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Composio } from "npm:@composio/core@0.13.1";
import { getCorsHeaders, resolveAllowedOrigin } from "../_shared/cors.ts";
import {
  SubscriptionAccessError,
  requireAuthenticatedUser,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";
import {
  filterConnectedAccountsForUser,
  findActiveConnectedAccount,
  normalizeComposioSlug,
  normalizeConnectedAccount,
} from "../_shared/composio-connected-account.ts";

const composio = new Composio({
  apiKey: Deno.env.get("COMPOSIO_API_KEY") || "",
});

function asString(val: unknown): string {
  return typeof val === "string" ? val : "";
}

const normalizeSlug = normalizeComposioSlug;

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
  return Boolean(findActiveConnectedAccount([account], { authConfigId, slug }));
}

function extractConnectedAccounts(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) {
    return result.filter(
      (item): item is Record<string, unknown> =>
        item !== null && typeof item === "object" && !Array.isArray(item),
    );
  }

  if (result === null || typeof result !== "object") {
    return [];
  }

  const record = result as Record<string, unknown>;
  const candidates = [record.items, record.data];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(
        (item): item is Record<string, unknown> =>
          item !== null && typeof item === "object" && !Array.isArray(item),
      );
    }
  }

  return [];
}

async function listConnectedAccountsForUser(
  userId: string,
): Promise<Record<string, unknown>[]> {
  const response = await composio.connectedAccounts.list({
    userIds: [userId],
  });
  const accounts = extractConnectedAccounts(response);
  const ownedAccounts = filterConnectedAccountsForUser(accounts, userId);

  if (ownedAccounts.length !== accounts.length) {
    console.warn("Composio returned accounts outside the authenticated user scope", {
      userId,
      returned: accounts.length,
      retained: ownedAccounts.length,
    });
  }

  return ownedAccounts;
}

interface RequestedIntegration {
  slug: string;
  label?: string;
  toolkitSlug?: string;
  authConfigId?: string;
  noAuth?: boolean;
}

function buildOAuthCallbackUrl(
  req: Request,
  slug: string,
  requestId: unknown,
): string | null {
  if (typeof requestId !== "string" || !/^[a-zA-Z0-9_-]{12,128}$/.test(requestId)) {
    return null;
  }
  const origin =
    resolveAllowedOrigin(req.headers.get("origin")) ||
    resolveAllowedOrigin(Deno.env.get("PUBLIC_APP_URL")) ||
    "https://app.jobraker.io";
  const callback = new URL(`/auth/callback/composio/${encodeURIComponent(slug)}`, origin);
  callback.searchParams.set("requestId", requestId);
  return callback.toString();
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);
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
    const reqSlug = normalizeSlug((body.toolkitSlug as string) || (body.integrationSlug as string) || (body.slug as string));
    const authConfigId = resolveAuthConfigId(body as Record<string, unknown>);

    // 3. Handle Actions
    if (action === "initiate") {
      const slug = normalizeSlug(body.toolkitSlug || body.integrationSlug || body.slug || "");
      if (!slug) {
         return new Response(JSON.stringify({ error: "Missing integration slug" }), { status: 400, headers: corsHeaders });
      }

      const callbackUrl = buildOAuthCallbackUrl(req, slug, body.oauthRequestId);
      const linkConnection = async (configId: string) => {
        const apiKey = Deno.env.get("COMPOSIO_API_KEY") || "";
        try {
          const conn = await composio.connectedAccounts.link(userId, configId, {
            ...(callbackUrl ? { callbackUrl } : {}),
          });
          return {
            ok: true,
            status: 200,
            connectionId: conn.id || (conn as any).connected_account_id || (conn as any).connectionId,
            redirectUrl: conn.redirectUrl || (conn as any).redirect_url,
          };
        } catch (sdkErr: any) {
          const errStr = String(sdkErr?.message || sdkErr?.cause?.message || sdkErr);
          console.warn(`SDK link call failed for config ${configId}: ${errStr}. Trying REST v3 link fallback...`);

          const res = await fetch("https://backend.composio.dev/api/v3.1/connected_accounts/link", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
            },
            body: JSON.stringify({
              user_id: userId,
              auth_config_id: configId,
              ...(callbackUrl ? { callback_url: callbackUrl } : {}),
            }),
          });

          if (res.ok) {
            const data = await res.json();
            return {
              ok: true,
              status: 200,
              connectionId: data.id || data.connected_account_id || data.connectionId,
              redirectUrl: data.redirectUrl || data.redirect_url,
            };
          }

          const errorText = await res.text();
          return {
            ok: false,
            status: res.status,
            errorText: `${errStr} | REST (${res.status}): ${errorText}`,
          };
        }
      };

      let finalAuthConfigId = authConfigId;
      let connectionData: { connectionId?: string; redirectUrl?: string } | null = null;

      if (finalAuthConfigId) {
        const apiKey = Deno.env.get("COMPOSIO_API_KEY") || "";
        try {
          const configRes = await fetch(`https://backend.composio.dev/api/v3.1/auth_configs/${finalAuthConfigId}`, {
            headers: { "x-api-key": apiKey },
          });
          if (configRes.ok) {
            const configData = await configRes.json();
            const configToolkit = normalizeSlug(
              configData?.toolkit_slug ||
                configData?.toolkit?.slug ||
                configData?.app_slug ||
                configData?.app?.slug ||
                configData?.auth_config?.toolkit_slug ||
                ""
            );
            if (configToolkit && configToolkit !== slug) {
              console.warn(`AuthConfig ${finalAuthConfigId} belongs to '${configToolkit}', not requested '${slug}'. Falling back to default ${slug} config...`);
              finalAuthConfigId = null;
            }
          }
        } catch (e) {
          console.warn(`Could not verify AuthConfig ${finalAuthConfigId} toolkit:`, e);
        }
      }

      if (finalAuthConfigId) {
        const res = await linkConnection(finalAuthConfigId);
        if (res.ok) {
          connectionData = res;
        } else {
          const errorText = res.errorText || "";
          if (
            (res.status === 400 || res.status === 404) &&
            (errorText.includes("Auth_Config_NotFound") ||
              errorText.includes("Auth config not found") ||
              errorText.includes("NotFound"))
          ) {
            console.warn(`Custom AuthConfig ID ${finalAuthConfigId} not found on Composio (HTTP ${res.status}). Falling back to default...`);
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
            isDefault: true,
          });
          if (authConfigs.items && authConfigs.items.length > 0) {
            finalAuthConfigId = authConfigs.items[0].id;
          }
        } catch (e) {
          console.warn(`Failed to fetch default auth config for ${slug}:`, e);
        }

        if (!finalAuthConfigId) {
          try {
            const authConfigsAll = await composio.authConfigs.list({
              toolkitSlug: slug,
            });
            if (authConfigsAll.items && authConfigsAll.items.length > 0) {
              finalAuthConfigId = authConfigsAll.items[0].id;
            }
          } catch (e) {
            console.warn(`Failed to fetch all auth configs for ${slug}:`, e);
          }
        }

        if (!finalAuthConfigId) {
          try {
            const apiKey = Deno.env.get("COMPOSIO_API_KEY") || "";
            const v3Res = await fetch(
              `https://backend.composio.dev/api/v3.1/auth_configs?toolkit_slug=${encodeURIComponent(slug)}`,
              {
                headers: { "x-api-key": apiKey },
              }
            );
            if (v3Res.ok) {
              const v3Data = await v3Res.json();
              const items = v3Data.items || v3Data.data || (Array.isArray(v3Data) ? v3Data : []);
              if (items.length > 0) {
                const defaultItem = items.find((i: any) => i.is_default || i.isDefault) || items[0];
                finalAuthConfigId = defaultItem.id;
              }
            }
          } catch (e) {
            console.warn(`Failed to fetch v3 auth config fallback for ${slug}:`, e);
          }
        }

        if (!finalAuthConfigId) {
          return new Response(
            JSON.stringify({ error: `Could not resolve default AuthConfigId for ${slug}` }),
            { status: 400, headers: corsHeaders }
          );
        }

        const res = await linkConnection(finalAuthConfigId);
        if (!res.ok) {
          throw new Error(`Composio API error (${res.status}): ${res.errorText}`);
        }
        connectionData = res;
      }

      return new Response(
        JSON.stringify({
          connectionId: connectionData?.connectionId,
          redirectUrl: connectionData?.redirectUrl,
          callbackConfigured: Boolean(callbackUrl),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    } else if (action === "disconnect" || action === "delete") {
      if (!connectionId || typeof connectionId !== "string") {
        return new Response(JSON.stringify({ error: "Missing connectionId for disconnect action" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const accounts = await listConnectedAccountsForUser(userId);
      const ownsConnection = accounts.some(
        (account) => normalizeConnectedAccount(account).id === connectionId,
      );
      if (!ownsConnection) {
        return new Response(
          JSON.stringify({ error: "Connection not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }

      try {
        await composio.connectedAccounts.delete(connectionId);
      } catch (e: any) {
        console.warn(`SDK disconnect error for ${connectionId}:`, e);
        const apiKey = Deno.env.get("COMPOSIO_API_KEY") || "";
        const response = await fetch(`https://backend.composio.dev/api/v3.1/connected_accounts/${encodeURIComponent(connectionId)}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
        });
        if (!response.ok && response.status !== 404) {
          const errorText = await response.text();
          throw new Error(`Composio API error (${response.status}): ${errorText}`);
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

      const accounts = await listConnectedAccountsForUser(userId);
      console.log(`[Status SDK] userId=${userId} count=${accounts.length}`);

      if (requested.length > 0) {
        const statuses = requested.map((item) => {
          const itemSlug = normalizeSlug(item.slug) || "unknown";
          const isNoAuth = item.noAuth === true;
          const itemAuthConfigId = resolveAuthConfigId(body as Record<string, unknown>, item);
          const account = accounts.find((candidate) =>
            connectedAccountMatches(candidate, itemAuthConfigId, itemSlug)
          );
          const identifier = account
            ? normalizeConnectedAccount(account).identifier
            : null;

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
      const account = findActiveConnectedAccount(accounts, {
        authConfigId,
        slug: singleSlug,
      });

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
    } else if (action === "debug-configs") {
      const apiKey = Deno.env.get("COMPOSIO_API_KEY") || "";
      const authConfigsRes = await fetch("https://backend.composio.dev/api/v3.1/auth_configs", {
        method: "GET",
        headers: { "x-api-key": apiKey },
      });
      const data = await authConfigsRes.json();
      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
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
