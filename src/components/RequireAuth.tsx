import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../routes";
import { createClient } from "../lib/supabaseClient";
import { events } from "@/lib/analytics";
import {
  cacheAuthSnapshot,
  clearCachedAuthSnapshot,
  getCachedAuthSnapshot,
  updateCachedOnboardingStatus,
} from "@/lib/offlineAppCache";

type Props = { children: React.ReactNode };

const AUTH_SESSION_TIMEOUT_MS = 45_000;

export const RequireAuth: React.FC<Props> = ({ children }) => {
  const navigate = useNavigate();
  const supabase = createClient();
  const [checking, setChecking] = useState(true);
  const checkingRef = useRef(checking);
  checkingRef.current = checking;

  const [onboardingCheck, setOnboardingCheck] = useState<{
    done: boolean;
    complete: boolean;
  }>({ done: false, complete: false });
  const onboardingCheckRef = useRef(onboardingCheck);
  onboardingCheckRef.current = onboardingCheck;

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

    const applyCachedAccess = async () => {
      const cachedSnapshot = await getCachedAuthSnapshot();
      if (!cachedSnapshot?.hasSession || !cachedSnapshot.user || !mounted) {
        return false;
      }

      const complete = cachedSnapshot.onboardingComplete !== false;
      setOnboardingCheck({ done: true, complete });
      setChecking(false);

      if (!complete && window.location.pathname !== ROUTES.ONBOARDING) {
        navigate(ROUTES.ONBOARDING, { replace: true });
      }

      return true;
    };

    const check = async () => {
      try {
        const cachedSnapshot = await getCachedAuthSnapshot();
        const {
          data: { session },
          error: sessionError,
        } = await withTimeout(
          supabase.auth.getSession(),
          AUTH_SESSION_TIMEOUT_MS,
        );

        if (sessionError) {
          console.error("Session error:", sessionError);
          if ((isOffline() || isNetworkError(sessionError)) && (await applyCachedAccess())) return;
          if (!mounted) return;
          navigate(ROUTES.SIGNIN, { replace: true });
          return;
        }

        if (!session?.access_token) {
          if (isOffline() && (await applyCachedAccess())) return;
          if (!mounted) return;
          navigate(ROUTES.SIGNIN, { replace: true });
          return;
        }

        const authUser = session.user
          ? {
              id: session.user.id,
              email: session.user.email,
            }
          : cachedSnapshot?.user ?? null;

        if (!mounted) return;
        if (!authUser?.id) {
          navigate(ROUTES.SIGNIN, { replace: true });
          return;
        }

        await cacheAuthSnapshot({
          hasSession: true,
          user: authUser,
          onboardingComplete: cachedSnapshot?.onboardingComplete ?? null,
        });

        if (!isOffline()) {
          try {
            const {
              updateSessionActivity,
              checkSecuritySettings,
              enforceMaxSessions,
            } = await import("../utils/sessionManagement");
            await updateSessionActivity(session.access_token);

            const securityCheck = await checkSecuritySettings(authUser.id);
            if (!securityCheck.allowed) {
              await supabase.auth.signOut();
              await clearCachedAuthSnapshot();
              if (!mounted) return;
              navigate(ROUTES.SIGNIN, { replace: true });
              return;
            }

            const { data: secSettings } = await supabase
              .from("security_settings")
              .select("max_concurrent_sessions, session_timeout_minutes")
              .eq("id", authUser.id)
              .maybeSingle();

            if (secSettings?.max_concurrent_sessions) {
              await enforceMaxSessions(
                authUser.id,
                secSettings.max_concurrent_sessions,
              );
            }

            if (
              secSettings?.session_timeout_minutes &&
              secSettings.session_timeout_minutes > 0
            ) {
              const sessionAge =
                Date.now() -
                (session.expires_at ? session.expires_at * 1000 : Date.now());
              const timeoutMs = secSettings.session_timeout_minutes * 60 * 1000;
              if (sessionAge > timeoutMs) {
                await supabase.auth.signOut();
                await clearCachedAuthSnapshot();
                if (!mounted) return;
                navigate(ROUTES.SIGNIN, { replace: true });
                return;
              }
            }
          } catch (e) {
            console.warn("Session management error:", e);
          }
        }

        if (isOffline()) {
          const complete = cachedSnapshot?.onboardingComplete !== false;
          setOnboardingCheck({ done: true, complete });
          setChecking(false);
          if (!complete && window.location.pathname !== ROUTES.ONBOARDING) {
            navigate(ROUTES.ONBOARDING, { replace: true });
          }
          return;
        }

        const { data: profile, error: profErr } = await supabase
          .from("profiles")
          .select("onboarding_complete")
          .eq("id", authUser.id)
          .single();

        if (profErr) {
          try {
            await supabase
              .from("profiles")
              .upsert(
                { id: authUser.id, onboarding_complete: false },
                { onConflict: "id" },
              );
            try {
              events.onboardingStubProfileCreated();
            } catch {}
          } catch {}

          await updateCachedOnboardingStatus(false, authUser);
          setOnboardingCheck({ done: true, complete: false });
          if (window.location.pathname !== ROUTES.ONBOARDING) {
            try {
              events.onboardingRedirect("missing_profile");
            } catch {}
            navigate(ROUTES.ONBOARDING, { replace: true });
          }
        } else {
          const complete = !!profile?.onboarding_complete;
          await updateCachedOnboardingStatus(complete, authUser);
          setOnboardingCheck({ done: true, complete });

          if (!complete && window.location.pathname !== ROUTES.ONBOARDING) {
            try {
              events.onboardingRedirect("incomplete");
            } catch {}
            navigate(ROUTES.ONBOARDING, { replace: true });
          }

          if (complete && window.location.pathname === ROUTES.ONBOARDING) {
            navigate("/dashboard/overview", { replace: true });
          }

          try {
            if (complete && !(window as any).__profileCompletedTracked) {
              events.profileCompleted();
              (window as any).__profileCompletedTracked = true;
            }
          } catch {}
        }

        setChecking(false);
      } catch (error) {
        console.error("Auth check error:", error);
        if ((isOffline() || isNetworkError(error)) && (await applyCachedAccess())) return;
        if (!mounted) return;
        navigate(ROUTES.SIGNIN, { replace: true });
      }
    };

    check();

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event: any, session: any) => {
        if (session?.user) {
          await cacheAuthSnapshot({
            hasSession: true,
            user: { id: session.user.id, email: session.user.email },
            onboardingComplete: onboardingCheckRef.current.done
              ? onboardingCheckRef.current.complete
              : null,
          });
          return;
        }

        // If the initial check is still running, let it handle the initial state
        if (checkingRef.current) {
          return;
        }

        // If session is null, check if we are offline before redirecting
        if (isOffline()) {
          const cachedSnapshot = await getCachedAuthSnapshot();
          if (cachedSnapshot?.hasSession) {
            return;
          }
        }

        await clearCachedAuthSnapshot();
        navigate(ROUTES.SIGNIN, { replace: true });
      },
    );

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate, supabase]);

  if (checking || !onboardingCheck.done) {
    return (
      <div className='min-h-screen grid place-items-center bg-background'>
        <div className='w-6 h-6 border-2 border-foreground/20 border-t-brand rounded-full animate-spin' />
      </div>
    );
  }
  return <>{children}</>;
};
