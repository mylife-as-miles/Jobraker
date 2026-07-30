export type PortfolioProvider = "github" | "linkedin";

/**
 * Lifecycle reported by the `composio-auth` edge function.
 * `pending` is the shell account Composio creates the instant we call `link()`
 * — the user has not authorized anything yet.
 */
export type ComposioConnectionState = "active" | "pending" | "inactive";

export type ComposioConnectionStatus = {
  configured?: boolean;
  isConnected: boolean;
  state?: ComposioConnectionState;
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

/** Why `waitForComposioConnection` stopped waiting. */
export type ComposioWaitOutcome =
  | "connected"
  | "cancelled"
  | "failed"
  | "timeout";

type WaitOptions = {
  /** Resolves the live provider state. Only `active` ends the wait successfully. */
  check: () => Promise<ComposioConnectionState>;
  popup: Window | null;
  requestId?: string;
  provider?: string;
  expectedOrigin?: string;
  timeoutMs?: number;
  intervalMs?: number;
  /** Notified on every phase change so the UI can narrate the wait. */
  onPhase?: (phase: "authorizing" | "verifying") => void;
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

/** Checks left after the popup closes before we call the attempt abandoned. */
const CLOSED_GRACE_CHECKS = 3;
/**
 * The callback page told us authorization succeeded, so the account is coming
 * — Composio just needs a moment to flip it to ACTIVE. Wait considerably
 * longer in that case instead of reporting a failure the user can see is wrong.
 */
const AUTHORIZED_GRACE_CHECKS = 16;

/**
 * Waits for a provider to report a fully authorized connection.
 *
 * A same-origin callback message shortens the wait; popup closure ends it.
 * `pending` is explicitly *not* success — Composio creates a pending record as
 * soon as the authorization link is issued, so treating it as connected made
 * the UI announce success while the consent screen was still open.
 */
export async function waitForComposioConnection({
  check,
  popup,
  requestId,
  provider,
  expectedOrigin = window.location.origin,
  timeoutMs = 120_000,
  intervalMs = 1_500,
  onPhase,
}: WaitOptions): Promise<ComposioWaitOutcome> {
  const deadline = Date.now() + timeoutMs;
  let closedChecksRemaining = CLOSED_GRACE_CHECKS;
  let callbackStatus: ComposioOAuthMessage["status"] | null = null;
  let phase: "authorizing" | "verifying" = "authorizing";

  const handleMessage = (event: MessageEvent) => {
    if (
      requestId &&
      provider &&
      isMatchingComposioOAuthMessage(event, { requestId, provider, expectedOrigin })
    ) {
      callbackStatus = event.data.status;
      if (callbackStatus === "success") {
        closedChecksRemaining = AUTHORIZED_GRACE_CHECKS;
        if (phase !== "verifying") {
          phase = "verifying";
          onPhase?.("verifying");
        }
      }
    }
  };
  window.addEventListener("message", handleMessage);

  try {
    onPhase?.("authorizing");
    while (Date.now() < deadline) {
      if (await check() === "active") return "connected";
      if (callbackStatus === "error") return "failed";
      if (popup?.closed) {
        closedChecksRemaining -= 1;
        if (closedChecksRemaining <= 0) {
          return callbackStatus === "success" ? "timeout" : "cancelled";
        }
      }
      await delay(callbackStatus === "success" ? Math.min(intervalMs, 250) : intervalMs);
    }
    return "timeout";
  } finally {
    window.removeEventListener("message", handleMessage);
  }
}
