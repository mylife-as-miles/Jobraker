import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createClient } from "../lib/supabaseClient";
import { ROUTES } from "../routes";
import { RouteLoadingFallback } from "./system/RouteLoadingFallback";
import { prepareForFreshAuthentication } from "../lib/sessionIsolation";

const AUTH_SESSION_TIMEOUT_MS = 30_000;

type Props = { children: React.ReactNode };

function getAuthenticatedRedirectPath() {
  return window.location.hostname.startsWith("admin.")
    ? "/admin"
    : `${ROUTES.DASHBOARD}/overview`;
}

export const PublicOnly: React.FC<Props> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const supabase = createClient();
  const [checking, setChecking] = useState(true);
  const checkingRef = useRef(checking);
  checkingRef.current = checking;

  const needsMfaChallenge = async () => {
    const { data, error } = await (supabase as any).auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw error;
    return data?.currentLevel !== "aal2" && data?.nextLevel === "aal2";
  };

  useEffect(() => {
    let mounted = true;

    const withTimeout = async <T,>(promise: Promise<T>, ms: number) => {
      let timeoutId: number | undefined;
      try {
        return await Promise.race<T>([
          promise,
          new Promise<T>((_, reject) => {
            timeoutId = window.setTimeout(
              () => reject(new Error("Timed out")),
              ms,
            );
          }),
        ]);
      } finally {
        if (timeoutId) window.clearTimeout(timeoutId);
      }
    };

    const check = async () => {
      try {
        // Registration is an explicit account-boundary action. Clear any
        // previous local Supabase session before the signup UI can hydrate.
        if (location.pathname === ROUTES.SIGNUP) {
          await prepareForFreshAuthentication(supabase);
          if (mounted) setChecking(false);
          return;
        }

        const {
          data: { session },
          error,
        } = await withTimeout(
          supabase.auth.getSession(),
          AUTH_SESSION_TIMEOUT_MS,
        );

        if (!mounted) return;

        if (error) {
          console.error("Public auth check error:", error);
          setChecking(false);
          return;
        }

        // A cached app snapshot is never sufficient to treat a public route
        // as authenticated. Only Supabase's persisted/current session can
        // redirect the browser to protected pages.
        if (!session?.user) {
          setChecking(false);
          return;
        }

        try {
          if (await needsMfaChallenge()) {
            setChecking(false);
            return;
          }
        } catch (error) {
          console.error("MFA assurance check failed:", error);
          setChecking(false);
          return;
        }

        navigate(getAuthenticatedRedirectPath(), { replace: true });
      } catch (error) {
        if (!mounted) return;
        console.error("Public auth check error:", error);
        // Fail open to the public auth page on network/offline errors. A
        // stale offline snapshot must never redirect a logged-out/new user.
        setChecking(false);
      }
    };

    void check();

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event: any, session: any) => {
        if (!mounted || !session?.user) return;

        // If the initial storage-backed check is still running, let it own
        // the first redirect to avoid duplicate navigation.
        if (checkingRef.current) return;

        try {
          if (await needsMfaChallenge()) {
            setChecking(false);
            return;
          }
        } catch (error) {
          console.error("MFA assurance check failed:", error);
          return;
        }

        navigate(getAuthenticatedRedirectPath(), { replace: true });
      },
    );

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [location.pathname, navigate, supabase]);

  if (checking) {
    return <RouteLoadingFallback />;
  }

  return <>{children}</>;
};
