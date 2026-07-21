export type PortfolioProvider = "github" | "linkedin";

export type ComposioConnectionStatus = {
  configured?: boolean;
  isConnected: boolean;
  connectionId?: string | null;
  identifier?: string | null;
};

export const PORTFOLIO_INTEGRATIONS: Record<PortfolioProvider, {
  slug: PortfolioProvider;
  toolkitSlug: PortfolioProvider;
  authConfigId?: string;
}> = {
  github: {
    slug: "github",
    toolkitSlug: "github",
    authConfigId: import.meta.env.VITE_COMPOSIO_GITHUB_CONFIG_ID,
  },
  linkedin: {
    slug: "linkedin",
    toolkitSlug: "linkedin",
    authConfigId: import.meta.env.VITE_COMPOSIO_LINKEDIN_CONFIG_ID,
  },
};

type WaitOptions = {
  check: () => Promise<boolean>;
  popup: Window | null;
  requestId?: string;
  provider?: string;
  expectedOrigin?: string;
  timeoutMs?: number;
  intervalMs?: number;
};

export const COMPOSIO_OAUTH_MESSAGE = "jobraker:composio-oauth" as const;

export type ComposioOAuthMessage = {
  type: typeof COMPOSIO_OAUTH_MESSAGE;
  requestId: string;
  provider: string;
  status: "success" | "error";
  message?: string;
};

export function createOAuthRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 18)}`;
}

export function isMatchingComposioOAuthMessage(
  event: MessageEvent,
  options: { requestId: string; provider: string; expectedOrigin: string },
): event is MessageEvent<ComposioOAuthMessage> {
  const data = event.data as Partial<ComposioOAuthMessage> | null;
  return Boolean(
    event.origin === options.expectedOrigin &&
    data &&
    data.type === COMPOSIO_OAUTH_MESSAGE &&
    data.requestId === options.requestId &&
    data.provider === options.provider,
  );
}

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

/**
 * Wait for the provider to report an active connection. Popup closure shortens
 * the wait, but still allows a small propagation grace period.
 */
export async function waitForComposioConnection({
  check,
  popup,
  requestId,
  provider,
  expectedOrigin = window.location.origin,
  timeoutMs = 120_000,
  intervalMs = 1_500,
}: WaitOptions): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  let closedChecksRemaining = 3;
  let callbackStatus: ComposioOAuthMessage["status"] | null = null;
  const handleMessage = (event: MessageEvent) => {
    if (
      requestId &&
      provider &&
      isMatchingComposioOAuthMessage(event, { requestId, provider, expectedOrigin })
    ) {
      callbackStatus = event.data.status;
    }
  };
  window.addEventListener("message", handleMessage);

  try {
    while (Date.now() < deadline) {
      if (await check()) return true;
      if (callbackStatus === "error") return false;
      if (popup?.closed) {
        closedChecksRemaining -= 1;
        if (closedChecksRemaining <= 0) return false;
      }
      await delay(callbackStatus === "success" ? Math.min(intervalMs, 250) : intervalMs);
    }
    return false;
  } finally {
    window.removeEventListener("message", handleMessage);
  }
}
