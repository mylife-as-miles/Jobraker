import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/toast";
import {
  createOAuthRequestId,
  waitForComposioConnection,
  type ComposioConnectionState,
} from "@/lib/composioConnection";
import {
  COMPOSIO_INTEGRATIONS,
  resolveViewState,
  type ComposioIntegration,
  type ComposioIntegrationSlug,
  type IntegrationActivity,
  type IntegrationStatus,
  type IntegrationViewState,
} from "@/lib/composioIntegrations";

const IDLE: IntegrationActivity = { phase: "idle" };

/**
 * Composio's connected-account list is eventually consistent: for a second or
 * two after a delete it still returns the account, and after an authorization
 * it still returns the pending shell. Both directions are re-checked instead of
 * trusting the first response.
 */
const PROPAGATION_ATTEMPTS = 8;
const PROPAGATION_INTERVAL_MS = 900;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type StatusMap = Partial<Record<ComposioIntegrationSlug, IntegrationStatus>>;
type ActivityMap = Partial<Record<ComposioIntegrationSlug, IntegrationActivity>>;

type StatusResponseItem = {
  slug?: string;
  state?: ComposioConnectionState;
  isConnected?: boolean;
  connectionId?: string | null;
  identifier?: string | null;
};

function toStatus(item: StatusResponseItem | undefined): IntegrationStatus {
  const state: ComposioConnectionState =
    item?.state ?? (item?.isConnected ? "active" : "inactive");
  return {
    state,
    connectionId: item?.connectionId ?? null,
    identifier: item?.identifier ?? null,
  };
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}

export type UseComposioIntegrationsResult = {
  integrations: ComposioIntegration[];
  statuses: StatusMap;
  hasLoaded: boolean;
  isRefreshing: boolean;
  lastCheckedAt: Date | null;
  connectedCount: number;
  /** True while any card is mid connect/disconnect. */
  isBusy: boolean;
  getViewState: (slug: ComposioIntegrationSlug) => IntegrationViewState;
  getStatus: (slug: ComposioIntegrationSlug) => IntegrationStatus | undefined;
  refresh: (options?: { silent?: boolean }) => Promise<void>;
  connect: (integration: ComposioIntegration) => Promise<void>;
  disconnect: (integration: ComposioIntegration) => Promise<void>;
};

export function useComposioIntegrations(options?: {
  /** Skip network work while the integrations surface is not visible. */
  enabled?: boolean;
}): UseComposioIntegrationsResult {
  const enabled = options?.enabled ?? true;
  const supabase = useMemo(() => createClient(), []);
  const { success, error: toastError, info } = useToast();

  const [statuses, setStatuses] = useState<StatusMap>({});
  const [activities, setActivities] = useState<ActivityMap>({});
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  const mountedRef = useRef(true);
  /**
   * Slugs with an action in flight. A background refresh must not overwrite
   * their optimistic state, otherwise a focus event mid-OAuth flips the card
   * back to "Not connected" under the user.
   */
  const lockedRef = useRef<Set<ComposioIntegrationSlug>>(new Set());
  /** Mirrors `statuses` so the action callbacks stay referentially stable. */
  const statusesRef = useRef<StatusMap>({});
  statusesRef.current = statuses;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setActivity = useCallback(
    (slug: ComposioIntegrationSlug, activity: IntegrationActivity) => {
      if (!mountedRef.current) return;
      setActivities((previous) => ({ ...previous, [slug]: activity }));
    },
    [],
  );

  const fetchStatuses = useCallback(async (): Promise<StatusMap> => {
    const { data, error } = await supabase.functions.invoke("composio-auth", {
      body: {
        action: "status",
        integrations: COMPOSIO_INTEGRATIONS.map((integration) => ({
          slug: integration.slug,
          label: integration.name,
          toolkitSlug: integration.toolkitSlug,
          authConfigId: integration.authConfigId,
        })),
      },
    });

    if (error) throw error;

    const items: StatusResponseItem[] = Array.isArray(
      (data as { statuses?: unknown } | null)?.statuses,
    )
      ? ((data as { statuses: StatusResponseItem[] }).statuses)
      : [];

    const next: StatusMap = {};
    for (const integration of COMPOSIO_INTEGRATIONS) {
      next[integration.slug] = toStatus(
        items.find((item) => item.slug === integration.slug),
      );
    }
    return next;
  }, [supabase]);

  const refresh = useCallback(
    async (refreshOptions?: { silent?: boolean }) => {
      if (!refreshOptions?.silent) setIsRefreshing(true);
      try {
        const next = await fetchStatuses();
        if (!mountedRef.current) return;
        setStatuses((previous) => {
          const merged: StatusMap = { ...previous };
          for (const [slug, status] of Object.entries(next) as Array<
            [ComposioIntegrationSlug, IntegrationStatus]
          >) {
            if (lockedRef.current.has(slug)) continue;
            merged[slug] = status;
          }
          return merged;
        });
        setLastCheckedAt(new Date());
      } catch (error) {
        console.error("Failed to check Composio connections:", error);
        if (!refreshOptions?.silent && mountedRef.current) {
          toastError(
            "Could not check integrations",
            errorMessage(error, "Connection status is unavailable right now."),
          );
        }
      } finally {
        if (mountedRef.current) {
          setIsRefreshing(false);
          setHasLoaded(true);
        }
      }
    },
    [fetchStatuses, toastError],
  );

  /** Single-integration probe used while polling a connect/disconnect. */
  const probe = useCallback(
    async (integration: ComposioIntegration): Promise<IntegrationStatus> => {
      const { data, error } = await supabase.functions.invoke("composio-auth", {
        body: {
          action: "status",
          integrationSlug: integration.slug,
          toolkitSlug: integration.toolkitSlug,
          authConfigId: integration.authConfigId,
        },
      });
      if (error) throw error;
      return toStatus(data as StatusResponseItem);
    },
    [supabase],
  );

  const connect = useCallback(
    async (integration: ComposioIntegration) => {
      const slug = integration.slug;
      if (lockedRef.current.has(slug)) return;

      // Opened synchronously with the click so the popup blocker stays quiet.
      const popup = window.open("about:blank", "_blank", "width=560,height=760");
      const oauthRequestId = createOAuthRequestId();

      lockedRef.current.add(slug);
      setActivity(slug, { phase: "connecting" });

      try {
        const { data, error } = await supabase.functions.invoke("composio-auth", {
          body: {
            action: "initiate",
            integrationSlug: slug,
            toolkitSlug: integration.toolkitSlug,
            authConfigId: integration.authConfigId,
            oauthRequestId,
          },
        });

        if (error) throw error;

        const redirectUrl = (data as { redirectUrl?: unknown } | null)?.redirectUrl;
        if (typeof redirectUrl !== "string" || !redirectUrl) {
          throw new Error(
            `Composio did not return an authorization link for ${integration.name}.`,
          );
        }

        if (popup && !popup.closed) {
          popup.location.href = redirectUrl;
        } else {
          // Popup blocked: continue in this tab. The callback route sends the
          // user back to the integrations tab and the status is re-checked there.
          info(
            `Opening ${integration.name} authorization`,
            "Your browser blocked the popup, so we're continuing in this tab.",
          );
          window.location.assign(redirectUrl);
          return;
        }

        setActivity(slug, { phase: "authorizing" });

        const outcome = await waitForComposioConnection({
          popup,
          requestId: oauthRequestId,
          provider: slug,
          onPhase: (phase) => setActivity(slug, { phase }),
          check: async () => {
            try {
              return (await probe(integration)).state;
            } catch {
              return "inactive";
            }
          },
        });

        if (!mountedRef.current) return;

        if (outcome === "connected") {
          const status = await probe(integration).catch(() => undefined);
          setStatuses((previous) => ({
            ...previous,
            [slug]: status ?? {
              state: "active",
              connectionId: null,
              identifier: null,
            },
          }));
          success(
            `${integration.name} connected`,
            status?.identifier
              ? `Agent Mode can now use ${status.identifier}.`
              : `Agent Mode can now use your ${integration.name} account.`,
          );
          return;
        }

        if (!popup.closed) popup.close();

        if (outcome === "cancelled") {
          info(
            `${integration.name} not connected`,
            "The authorization window closed before the connection completed.",
          );
        } else if (outcome === "failed") {
          toastError(
            `${integration.name} authorization failed`,
            "The provider rejected the request. Please try connecting again.",
          );
        } else {
          toastError(
            `${integration.name} is taking longer than expected`,
            "Authorization has not come through yet. Use Refresh status in a moment.",
          );
        }
      } catch (error) {
        if (popup && !popup.closed) popup.close();
        toastError(
          `Failed to connect ${integration.name}`,
          errorMessage(error, "Could not start the connection."),
        );
      } finally {
        setActivity(slug, IDLE);
        // The lock is held across the trailing refresh so a lagging list
        // response cannot undo the state we just confirmed for this card.
        await refresh({ silent: true }).catch(() => undefined);
        lockedRef.current.delete(slug);
      }
    },
    [info, probe, refresh, setActivity, success, supabase, toastError],
  );

  const disconnect = useCallback(
    async (integration: ComposioIntegration) => {
      const slug = integration.slug;
      if (lockedRef.current.has(slug)) return;

      const connectionId = statusesRef.current[slug]?.connectionId ?? null;

      lockedRef.current.add(slug);
      setActivity(slug, { phase: "disconnecting" });

      try {
        const { error } = await supabase.functions.invoke("composio-auth", {
          body: {
            action: "disconnect",
            // The slug clears every row for this toolkit, so a missing or stale
            // connection id can no longer leave the card stuck on "Connected".
            integrationSlug: slug,
            toolkitSlug: integration.toolkitSlug,
            authConfigId: integration.authConfigId,
            ...(connectionId ? { connectionId } : {}),
          },
        });

        if (error) throw error;

        // Confirm removal instead of announcing it: the list endpoint lags, and
        // an unverified success followed by a refresh is what made cards flip
        // straight back to "Connected".
        let cleared = false;
        for (let attempt = 0; attempt < PROPAGATION_ATTEMPTS; attempt += 1) {
          const status = await probe(integration).catch(() => null);
          if (status && status.state !== "active") {
            cleared = true;
            break;
          }
          if (!status) break;
          await sleep(PROPAGATION_INTERVAL_MS);
        }

        if (!mountedRef.current) return;

        setStatuses((previous) => ({
          ...previous,
          [slug]: { state: "inactive", connectionId: null, identifier: null },
        }));

        if (cleared) {
          success(
            `${integration.name} disconnected`,
            `JobRaker no longer has access to your ${integration.name} account.`,
          );
        } else {
          info(
            `${integration.name} disconnect submitted`,
            "The provider is still catching up. Use Refresh status shortly to confirm.",
          );
        }
      } catch (error) {
        toastError(
          `Failed to disconnect ${integration.name}`,
          errorMessage(error, "The connection could not be removed."),
        );
      } finally {
        setActivity(slug, IDLE);
        await refresh({ silent: true }).catch(() => undefined);
        lockedRef.current.delete(slug);
      }
    },
    [info, probe, refresh, setActivity, success, supabase, toastError],
  );

  // Initial load for the surface.
  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  // Same-tab authorization (popup blocked, or mobile) returns here with a
  // result in the query string. Acknowledge it, re-check, and clean the URL.
  useEffect(() => {
    if (!enabled) return;
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get("composio");
    if (!outcome) return;

    const provider = (params.get("provider") || "").toLowerCase();
    const integration = COMPOSIO_INTEGRATIONS.find(
      (item) => item.slug === provider,
    );
    const name = integration?.name ?? "Integration";

    params.delete("composio");
    params.delete("provider");
    const query = params.toString();
    window.history.replaceState(
      {},
      document.title,
      `${window.location.pathname}${query ? `?${query}` : ""}`,
    );

    if (outcome === "connected") {
      info(`Finishing ${name} connection`, "Verifying with the provider…");
      void refresh();
    } else {
      toastError(
        `${name} authorization failed`,
        "The provider did not complete the connection. Please try again.",
      );
    }
  }, [enabled, info, refresh, toastError]);

  // Re-check when the user comes back from an authorization window/tab.
  useEffect(() => {
    if (!enabled) return;
    let debounce: ReturnType<typeof setTimeout>;
    const onFocus = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void refresh({ silent: true }), 400);
    };
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(debounce);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, refresh]);

  const getStatus = useCallback(
    (slug: ComposioIntegrationSlug) => statuses[slug],
    [statuses],
  );

  const getViewState = useCallback(
    (slug: ComposioIntegrationSlug) =>
      resolveViewState({
        status: statuses[slug],
        activity: activities[slug] ?? IDLE,
        hasLoaded,
      }),
    [activities, hasLoaded, statuses],
  );

  const connectedCount = useMemo(
    () =>
      COMPOSIO_INTEGRATIONS.filter(
        (integration) => statuses[integration.slug]?.state === "active",
      ).length,
    [statuses],
  );

  const isBusy = useMemo(
    () =>
      Object.values(activities).some(
        (activity) => activity && activity.phase !== "idle",
      ),
    [activities],
  );

  return {
    integrations: COMPOSIO_INTEGRATIONS,
    statuses,
    hasLoaded,
    isRefreshing,
    lastCheckedAt,
    connectedCount,
    isBusy,
    getViewState,
    getStatus,
    refresh,
    connect,
    disconnect,
  };
}
