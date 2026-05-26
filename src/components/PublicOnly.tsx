import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "../lib/supabaseClient";
import { ROUTES } from "../routes";
import { getCachedAuthSnapshot } from "@/lib/offlineAppCache";

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

  useEffect(() => {
    let mounted = true;
    const isOffline = () =>
      typeof navigator !== "undefined" && navigator.onLine === false;
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
        const {
          data: { session },
        } = await withTimeout(supabase.auth.getSession(), 2500);

        if (!mounted) return;
        if (session?.user || (isOffline() && cachedSnapshot?.hasSession)) {
          navigate(getAuthenticatedRedirectPath(), { replace: true });
          return;
        }
      } catch (error) {
        if (!mounted) return;
        if (isOffline()) {
          setChecking(false);
          return;
        }
        console.error("Public auth check error:", error);
      }
      if (!mounted) return;
      setChecking(false);
    };
    check();

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event: any, session: any) => {
        if (session?.user)
          navigate(getAuthenticatedRedirectPath(), { replace: true });
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
