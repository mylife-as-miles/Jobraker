import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import {
  COMPOSIO_OAUTH_MESSAGE,
  type ComposioOAuthMessage,
} from "@/lib/composioConnection";

const providerLabel = (provider: string) =>
  provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : "Integration";

const INTEGRATIONS_URL = "/dashboard/settings/integrations";

type Outcome = "working" | "success" | "error";

const ComposioCallbackPage = () => {
  const [outcome, setOutcome] = useState<Outcome>("working");
  const [message, setMessage] = useState("Finishing connection…");
  /** Set when this window has no opener and must navigate instead of close. */
  const [returnUrl, setReturnUrl] = useState<string | null>(null);

  useEffect(() => {
    const segments = window.location.pathname.split("/").filter(Boolean);
    const provider = decodeURIComponent(segments[segments.length - 1] || "").toLowerCase();
    const params = new URLSearchParams(window.location.search);
    const requestId = params.get("requestId") || "";
    const errorMessage =
      params.get("error_description") || params.get("error") || params.get("message");
    const status: ComposioOAuthMessage["status"] = errorMessage ? "error" : "success";
    const label = providerLabel(provider);
    const suffix = status === "success" ? "connected" : "error";
    const fallbackUrl = `${window.location.origin}${INTEGRATIONS_URL}?composio=${suffix}&provider=${encodeURIComponent(provider)}`;

    window.history.replaceState({}, document.title, window.location.pathname);

    // Without a correlation id the opener cannot trust this response, so send
    // the user back to settings where the status is re-checked from scratch.
    if (!requestId || !provider) {
      setOutcome("error");
      setMessage(
        "This connection response is missing its verification details. Returning you to Integrations…",
      );
      setReturnUrl(`${window.location.origin}${INTEGRATIONS_URL}`);
      window.setTimeout(
        () => window.location.replace(`${window.location.origin}${INTEGRATIONS_URL}`),
        1_500,
      );
      return;
    }

    const payload: ComposioOAuthMessage = {
      type: COMPOSIO_OAUTH_MESSAGE,
      requestId,
      provider,
      status,
      ...(errorMessage ? { message: errorMessage } : {}),
    };

    setOutcome(status === "success" ? "success" : "error");
    setMessage(
      status === "success"
        ? `${label} authorization finished. Verifying the connection…`
        : `${label} authorization failed: ${errorMessage}`,
    );

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, window.location.origin);
      // Always close, including on failure — a popup left behind on the error
      // screen is the thing users have to clean up by hand.
      window.setTimeout(() => window.close(), status === "success" ? 700 : 2_500);
      return;
    }

    setReturnUrl(fallbackUrl);
    window.setTimeout(() => window.location.replace(fallbackUrl), 900);
  }, []);

  const Icon =
    outcome === "success" ? CheckCircle2 : outcome === "error" ? XCircle : Loader2;
  const tone =
    outcome === "success"
      ? "text-brand"
      : outcome === "error"
        ? "text-rose-400"
        : "text-muted-foreground";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="max-w-sm rounded-xl border border-border bg-card p-6 text-center shadow-sm">
        <Icon
          className={`mx-auto mb-3 h-8 w-8 ${tone} ${outcome === "working" ? "animate-spin" : ""}`}
          aria-hidden
        />
        <h1 className="text-lg font-semibold">Account connection</h1>
        <p className="mt-2 text-sm text-muted-foreground" role="status" aria-live="polite">
          {message}
        </p>
        {returnUrl ? (
          <a
            className="mt-4 inline-block text-xs font-medium text-brand underline-offset-4 hover:underline"
            href={returnUrl}
          >
            Return to Integrations
          </a>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">
            You can close this window if it does not close on its own.
          </p>
        )}
      </div>
    </div>
  );
};

export default ComposioCallbackPage;
