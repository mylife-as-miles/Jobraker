import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Composio } from "npm:@composio/core@0.13.1";
import { getCorsHeaders, resolveAllowedOrigin } from "../_shared/cors.ts";
import {
  SubscriptionAccessError,
  requireAuthenticatedUser,
  resolveSubscriptionTier,
  subscriptionErrorResponse,
} from "../_shared/subscription.ts";
import {
  filterConnectedAccountsForUser,
  findConnectedAccountsForIntegration,
  normalizeComposioSlug,
  normalizeConnectedAccount,
  resolveIntegrationConnection,
} from "../_shared/composio-connected-account.ts";
import { runMeteredComposioCall } from "../_shared/metered-composio.ts";

const composio = new Composio({
  apiKey: Deno.env.get("COMPOSIO_API_KEY") || "",
});

const PAID_ACTIONS = new Set(["initiate", "execute", "debug-configs"]);

function asString(val: unknown): string {
  return typeof val === "string" ? val : "";
}

function requiresPaidPlan(action: unknown): boolean {
  return typeof action === "string" && PAID_ACTIONS.has(action);
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
  const accountMap = new Map<string, Record<string, unknown>>();
  const apiKey = Deno.env.get("COMPOSIO_API_KEY") || "";

  /**
   * `scoped` means the upstream call already filtered by this user. Rows from
   * a scoped source that carry no owner field are stamped with the user id so
   * the strict ownership filter below keeps them; rows from the workspace-wide
   * endpoint are only kept when they explicitly name this user.
   */
  const addItems = (items: unknown[], scoped: boolean) => {
    const extracted = extractConnectedAccounts(items);
    for (const item of extracted) {
      const norm = normalizeConnectedAccount(item);
      if (!norm.id) continue;
      if (norm.userId && norm.userId !== userId) continue;
      if (!norm.userId && !scoped) continue;

      const owned = norm.userId ? item : { ...item, user_id: userId };
      if (scoped || !accountMap.has(norm.id)) {
        accountMap.set(norm.id, owned);
      }
    }
  };

  try {
    const response = await composio.connectedAccounts.list({
      userIds: [userId],
    });
    addItems(extractConnectedAccounts(response), true);
  } catch (e) {
    console.warn("SDK connectedAccounts.list failed:", e);
  }

  if (apiKey) {
    const endpoints: Array<{ url: string; scoped: boolean }> = [
      {
        url: `https://backend.composio.dev/api/v3.1/connected_accounts?user_id=${encodeURIComponent(userId)}`,
        scoped: true,
      },
      {
        url: `https://backend.composio.dev/api/v3.1/connected_accounts?entity_id=${encodeURIComponent(userId)}`,
        scoped: true,
      },
      { url: `https://backend.composio.dev/api/v3.1/connected_accounts`, scoped: false },
    ];
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint.url, { headers: { "x-api-key": apiKey } });
        if (res.ok) {
          const data = await res.json();
          const items = data.items || data.data || (Array.isArray(data) ? data : []);
          addItems(items, endpoint.scoped);
        }
      } catch (e) {
        console.warn(`REST fetch failed for ${endpoint.url}:`, e);
      }
    }
  }

  return filterConnectedAccountsForUser(Array.from(accountMap.values()), userId);
}

/** Fetches a single account so disconnect can verify ownership even when the
 * aggregate listing is momentarily stale. */
async function fetchConnectedAccountById(
  connectionId: string,
): Promise<Record<string, unknown> | null> {
  const apiKey = Deno.env.get("COMPOSIO_API_KEY") || "";

  try {
    const account = await composio.connectedAccounts.get(connectionId);
    if (account && typeof account === "object") {
      return account as Record<string, unknown>;
    }
  } catch (e) {
    console.warn(`SDK connectedAccounts.get failed for ${connectionId}:`, e);
  }

  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://backend.composio.dev/api/v3.1/connected_accounts/${encodeURIComponent(connectionId)}`,
      { headers: { "x-api-key": apiKey } },
    );
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === "object" && !Array.isArray(data)) {
        return data as Record<string, unknown>;
      }
    }
  } catch (e) {
    console.warn(`REST connected account fetch failed for ${connectionId}:`, e);
  }

  return null;
}

async function deleteConnectedAccount(connectionId: string): Promise<boolean> {
  let deleted = false;

  try {
    await composio.connectedAccounts.delete(connectionId);
    deleted = true;
  } catch (e) {
    console.warn(`SDK disconnect error for ${connectionId}:`, e);
  }

  const apiKey = Deno.env.get("COMPOSIO_API_KEY") || "";
  if (apiKey) {
    try {
      const response = await fetch(
        `https://backend.composio.dev/api/v3.1/connected_accounts/${encodeURIComponent(connectionId)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        },
      );
      // 404 means it is already gone, which is the outcome the caller wanted.
      if (response.ok || response.status === 404) {
        deleted = true;
      }
    } catch (e) {
      console.warn(`REST disconnect error for ${connectionId}:`, e);
    }
  }

  return deleted;
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
    const { user, serviceClient } = await requireAuthenticatedUser(req);
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

    if (requiresPaidPlan(action)) {
      const subscriptionTier = await resolveSubscriptionTier(userId, serviceClient);
      if (subscriptionTier === "Free") {
        throw new SubscriptionAccessError(
          403,
          "Connected integrations require the Basics plan or higher.",
        );
      }
    }

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
      const hasConnectionId = typeof connectionId === "string" && connectionId.length > 0;
      if (!hasConnectionId && !reqSlug) {
        return new Response(
          JSON.stringify({ error: "Provide a connectionId or an integrationSlug to disconnect" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }

      const ownedAccounts = await listConnectedAccountsForUser(userId);
      const targets = new Map<string, Record<string, unknown>>();

      // Disconnecting by slug clears every row for that toolkit, including the
      // abandoned "pending" shells that otherwise keep a card looking connected.
      if (reqSlug) {
        for (const account of findConnectedAccountsForIntegration(ownedAccounts, {
          slug: reqSlug,
          authConfigId,
        })) {
          const id = normalizeConnectedAccount(account).id;
          if (id) targets.set(id, account);
        }
      }

      if (hasConnectionId && !targets.has(connectionId as string)) {
        const owned = ownedAccounts.find(
          (account) => normalizeConnectedAccount(account).id === connectionId,
        );
        if (owned) {
          targets.set(connectionId as string, owned);
        } else {
          // Not in the (possibly stale) listing — confirm ownership directly
          // rather than deleting an id supplied by the caller on trust.
          const fetched = await fetchConnectedAccountById(connectionId as string);
          if (!fetched) {
            return new Response(
              JSON.stringify({ error: "Connection not found", code: "not_found" }),
              {
                status: 404,
                headers: { "Content-Type": "application/json", ...corsHeaders },
              },
            );
          }
          const owner = normalizeConnectedAccount(fetched).userId;
          if (owner && owner !== userId) {
            console.warn(`Blocked cross-user disconnect of ${connectionId} by ${userId}`);
            return new Response(
              JSON.stringify({ error: "Connection not found", code: "not_found" }),
              {
                status: 404,
                headers: { "Content-Type": "application/json", ...corsHeaders },
              },
            );
          }
          targets.set(connectionId as string, fetched);
        }
      }

      if (targets.size === 0) {
        // Nothing left to remove: the caller's desired end state already holds.
        return new Response(
          JSON.stringify({ success: true, deleted: 0, alreadyDisconnected: true }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }

      const failed: string[] = [];
      let deletedCount = 0;
      for (const id of targets.keys()) {
        if (await deleteConnectedAccount(id)) {
          deletedCount += 1;
        } else {
          failed.push(id);
        }
      }

      if (deletedCount === 0) {
        return new Response(
          JSON.stringify({
            error: "Composio rejected the disconnect request",
            code: "disconnect_failed",
            failed,
          }),
          {
            status: 502,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Connection deleted",
          deleted: deletedCount,
          failed,
        }),
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
          const { account, state } = resolveIntegrationConnection(accounts, {
            slug: itemSlug,
            authConfigId: itemAuthConfigId,
          });
          const normalized = account ? normalizeConnectedAccount(account) : null;

          return {
            slug: itemSlug,
            label: item.label || itemSlug,
            toolkitSlug: item.toolkitSlug || itemSlug,
            configured: true,
            // Only a fully authorized account counts as connected. A `pending`
            // shell is surfaced separately so the UI can say "finish in popup"
            // instead of claiming success.
            isConnected: isNoAuth || state === "active",
            state: isNoAuth ? "active" : state,
            connectionId: normalized?.id || null,
            identifier: normalized?.identifier ?? null,
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
      const { account, state } = resolveIntegrationConnection(accounts, {
        authConfigId,
        slug: singleSlug,
      });
      const normalized = account ? normalizeConnectedAccount(account) : null;

      return new Response(
        JSON.stringify({
          isConnected: state === "active",
          state,
          connectionId: normalized?.id || null,
          identifier: normalized?.identifier ?? null,
        }),
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

      const toolkitSlug = slug.split("_")[0]?.toLowerCase() || "composio";
      const payloadArgs = (toolArguments ?? args ?? {}) as Record<string, unknown>;

      const result = await runMeteredComposioCall({
        serviceClient,
        userId,
        toolkitSlug,
        toolSlug: slug,
        payload: payloadArgs,
        execute: async () => {
          let resVal: unknown = null;
          let executed = false;

          const executeFn = (composio as any)?.tools?.execute;
          if (typeof executeFn === "function") {
            try {
              resVal = await executeFn.call((composio as any).tools, slug, {
                userId,
                arguments: payloadArgs,
              });
              executed = true;
            } catch (e: any) {
              console.warn(`SDK tool execution failed for ${slug}:`, e);
            }
          }

          if (!executed) {
            const apiKey = Deno.env.get("COMPOSIO_API_KEY") || "";
            const res = await fetch(`https://backend.composio.dev/api/v3.1/tools/execute/${encodeURIComponent(slug)}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
              },
              body: JSON.stringify({
                user_id: userId,
                arguments: payloadArgs,
              }),
            });

            if (!res.ok) {
              const errorText = await res.text();
              throw new Error(`Composio tool execution failed (${res.status}): ${errorText}`);
            }

            resVal = await res.json();
          }

          return resVal;
        },
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