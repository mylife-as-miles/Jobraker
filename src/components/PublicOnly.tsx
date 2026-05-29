import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "../lib/supabaseClient";
import { ROUTES } from "../routes";
import { getCachedAuthSnapshot } from "@/lib/offlineAppCache";

const AUTH_SESSION_TIMEOUT_MS = 30_000;

type Props = { children: React.ReactNode };

function getAuthenticatedRedirectPath() {
  return window.location.hostname.startsWith("admin.")
    ? "/admin"
    : `${ROUTES.DASHBOARD}/overview`;
}

export const PublicOnly: React.FC<Props> = ({ children }) => {
  const navigate = useNavigate();
  const supabase = createClient();
  const [checking, setChecking] = useState(true);
  const checkingRef = useRef(checking);
  checkingRef.current = checking;

  useEffect(() => {
    let mounted = true;
    const isOffline = () =>
      typeof navigator !== "undefined" && navigator.onLine === false;

    const isNetworkError = (error: any) => {
      if (!error) return false;
      const msg = String(error.message || error).toLowerCase();
      return (
        msg.includes("fetch") ||
        msg.includes("network") ||
        msg.includes("timeout") ||
        msg.includes("timed out") ||
        msg.includes("err_") ||
        error instanceof TypeError
      );
    };

    const withTimeout = async <T,>(promise: Promise<T>, ms: number) =>
      await Promise.race<T>([
        promise,
        new Promise<T>((_, reject) =>
          window.setTimeout(() => reject(new Error("Timed out")), ms),
        ),
      ]);

    const check = async () => {
      try {
        const cachedSnapshot = await getCachedAuthSnapshot();

        if (isOffline()) {
          if (cachedSnapshot?.hasSession) {
            navigate(getAuthenticatedRedirectPath(), { replace: true });
            return;
          }
          setChecking(false);
          return;
        }

        try {
          const {
            data: { session },
          } = await withTimeout(supabase.auth.getSession(), AUTH_SESSION_TIMEOUT_MS);

          if (!mounted) return;
          if (session?.user) {
            navigate(getAuthenticatedRedirectPath(), { replace: true });
            return;
          }
        } catch (error) {
          if (!mounted) return;
          if (isNetworkError(error)) {
            if (cachedSnapshot?.hasSession) {
              navigate(getAuthenticatedRedirectPath(), { replace: true });
              return;
            }
            setChecking(false);
            return;
          }
          throw error;
        }
      } catch (error) {
        if (!mounted) return;
        console.error("Public auth check error:", error);
      }
      if (!mounted) return;
      setChecking(false);
    };
    check();

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event: any, session: any) => {
        if (session?.user) {
          // If the initial check is still running, let it handle the initial state
          if (checkingRef.current) {
            return;
          }

          if (isOffline()) {
            getCachedAuthSnapshot().then((cachedSnapshot) => {
              if (cachedSnapshot?.hasSession && mounted) {
                navigate(getAuthenticatedRedirectPath(), { replace: true });
              }
            });
            return;
          }

          navigate(getAuthenticatedRedirectPath(), { replace: true });
        }
      },
    );

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate, supabase]);

  if (checking) {
    return (
      <div className='min-h-screen grid place-items-center bg-background'>
        <div className='w-6 h-6 border-2 border-foreground/20 border-t-brand rounded-full animate-spin' />
      </div>
    );
  }
  return <>{children}</>;
};
