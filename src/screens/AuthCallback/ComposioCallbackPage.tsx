import { useEffect, useState } from "react";
import {
  COMPOSIO_OAUTH_MESSAGE,
  type ComposioOAuthMessage,
} from "@/lib/composioConnection";

const providerLabel = (provider: string) =>
  provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : "Integration";

const ComposioCallbackPage = () => {
  const [message, setMessage] = useState("Finishing connection...");

  useEffect(() => {
    const segments = window.location.pathname.split("/").filter(Boolean);
    const provider = decodeURIComponent(segments[segments.length - 1] || "").toLowerCase();
    const params = new URLSearchParams(window.location.search);
    const requestId = params.get("requestId") || "";
    const errorMessage =
      params.get("error_description") || params.get("error") || params.get("message");
    const status: ComposioOAuthMessage["status"] = errorMessage ? "error" : "success";
    const label = providerLabel(provider);

    if (!requestId || !provider) {
      setMessage("This connection response is missing its verification details. Close this window and try again.");
      return;
    }

    const payload: ComposioOAuthMessage = {
      type: COMPOSIO_OAUTH_MESSAGE,
      requestId,
      provider,
      status,
      ...(errorMessage ? { message: errorMessage } : {}),
    };
    setMessage(
      status === "success"
        ? `${label} authorization finished. Verifying the connection...`
        : `${label} authorization failed: ${errorMessage}`,
    );

    window.history.replaceState({}, document.title, window.location.pathname);
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, window.location.origin);
      if (status === "success") window.setTimeout(() => window.close(), 700);
    } else {
      const suffix = status === "success" ? "connected" : "error";
      window.setTimeout(() => {
        window.location.replace(
          `${window.location.origin}/dashboard/settings/integrations?composio=${suffix}&provider=${encodeURIComponent(provider)}`,
        );
      }, 900);
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="max-w-sm rounded-xl border border-border bg-card p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold">Account connection</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
};

export default ComposioCallbackPage;
