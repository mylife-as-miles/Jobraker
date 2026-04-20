import { useEffect, useState } from "react";

import { createClient } from "../../lib/supabaseClient";

const GmailCallbackPage = () => {
  const [message, setMessage] = useState("Finishing Gmail connection...");

  useEffect(() => {
    let cancelled = false;

    const finishAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      const oauthError = params.get("error");
      const code = params.get("code");
      const state = params.get("state");
      const targetOrigin = window.location.origin;

      try {
        if (oauthError) {
          throw new Error(oauthError);
        }
        if (!code || !state) {
          throw new Error("Missing Gmail authorization response.");
        }

        window.history.replaceState({}, document.title, window.location.pathname);

        const supabase = createClient();
        const { error } = await supabase.functions.invoke("gmail-auth", {
          body: {
            action: "callback",
            code,
            state,
          },
        });

        if (error) {
          throw error;
        }

        if (!cancelled) {
          setMessage("Gmail connected. You can close this window.");
        }
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ type: "gmail-auth-success" }, targetOrigin);
          window.setTimeout(() => window.close(), 500);
        } else {
          window.location.replace(
            `${window.location.origin}/dashboard/settings/integrations?gmail=connected`,
          );
        }
      } catch (error: any) {
        const errorMessage =
          error?.details || error?.message || "Gmail connection failed.";
        if (!cancelled) {
          setMessage(errorMessage);
        }
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            { type: "gmail-auth-error", message: errorMessage },
            targetOrigin,
          );
        }
      }
    };

    finishAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className='min-h-screen bg-background text-foreground flex items-center justify-center p-6'>
      <div className='max-w-sm rounded-xl border border-border bg-card p-6 text-center shadow-sm'>
        <h1 className='text-lg font-semibold'>Gmail</h1>
        <p className='mt-2 text-sm text-muted-foreground'>{message}</p>
      </div>
    </div>
  );
};

export default GmailCallbackPage;
