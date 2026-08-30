import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../routes";
import { createClient } from "../lib/supabaseClient";
import { events } from "@/lib/analytics";
import {
  cacheAuthSnapshot,
  getCachedAuthSnapshot,
  getCachedAuthSnapshotForUser,
  updateCachedOnboardingStatus,
} from "@/lib/offlineAppCache";
import { clearUserScopedClientState } from "@/lib/sessionIsolation";
import { RouteLoadingFallback } from "./system/RouteLoadingFallback";

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

    const rejectAccess = async () => {
      await clearUserScopedClientState();
      if (!mounted) return;
      navigate(ROUTES.SIGNIN, { replace: true });
    };

    const check = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await withTimeout(
          supabase.auth.getSession(),
          AUTH_SESSION_TIMEOUT_MS,
        );

        if (sessionError) {
          console.error("Session error:", sessionError);
          await rejectAccess();
          return;
        }

        // Cached JobRaker state is never authorization. A real Supabase
        // persisted/current session is required before protected UI renders.
        if (!session?.access_token || !session.user?.id) {
          await rejectAccess();
          return;
        }

        const authUser = {
          id: session.user.id,
          email: session.user.email,
        };

        const cachedSnapshot = await getCachedAuthSnapshot();
        const matchingCachedSnapshot =
          await getCachedAuthSnapshotForUser(authUser.id);

        // Account A -> account B in the same browser must invalidate every
        // user-scoped client cache before B's state can be hydrated.
        if (
          cachedSnapshot?.user?.id &&
          cachedSnapshot.user.id !== authUser.id
        ) {
          await clearUserScopedClientState();
        }

        if (!mounted) return;

        await cacheAuthSnapshot({
          hasSession: true,
          user: authUser,
          onboardingComplete:
            matchingCachedSnapshot?.onboardingComplete ?? null,
        });

        if (!isOffline()) {
          try {
            const { data: assurance, error: assuranceError } = await (supabase as any)
              .auth.mfa.getAuthenticatorAssuranceLevel();
            if (assuranceError) throw assuranceError;
            if (
              assurance?.currentLevel !== "aal2" &&
              assurance?.nextLevel === "aal2"
            ) {
              await clearUserScopedClientState();
              if (!mounted) return;
              navigate(`${ROUTES.SIGNIN}?mfa=required`, { replace: true });
              return;
            }

            const {
              updateSessionActivity,
              checkSecuritySettings,
              enforceMaxSessions,
            } = await import("../utils/sessionManagement");
            await updateSessionActivity(session.access_token);

            const securityCheck = await checkSecuritySettings(authUser.id);
            if (!securityCheck.allowed) {
              await supabase.auth.signOut({ scope: "local" });
              await clearUserScopedClientState();
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
              const timeoutMs =
                secSettings.session_timeout_minutes * 60 * 1000;

              if (sessionAge > timeoutMs) {
                await supabase.auth.signOut({ scope: "local" });
                await clearUserScopedClientState();
                if (!mounted) return;
                navigate(ROUTES.SIGNIN, { replace: true });
                return;
              }
            }
          } catch (error) {
            console.warn("Session management error:", error);
          }
        }

        if (isOffline()) {
          // Offline onboarding hints are allowed only after a real Supabase
          // session has been established AND only for the same user id.
          const complete =
            matchingCachedSnapshot?.onboardingComplete !== false;
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
        await rejectAccess();
      }
    };

    void check();

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event: any, session: any) => {
        if (session?.user?.id) {
          const existing = await getCachedAuthSnapshot();
          if (
            existing?.user?.id &&
            existing.user.id !== session.user.id
          ) {
            await clearUserScopedClientState();
          }

          await cacheAuthSnapshot({
            hasSession: true,
            user: {
              id: session.user.id,
              email: session.user.email,
            },
            onboardingComplete:
              existing?.user?.id === session.user.id &&
              onboardingCheckRef.current.done
                ? onboardingCheckRef.current.complete
                : null,
          });
          return;
        }

        // Do not resurrect a cached account when Supabase says there is no
        // session. This is the critical session-isolation boundary.
        if (checkingRef.current) return;

        await clearUserScopedClientState();
        if (!mounted) return;
        navigate(ROUTES.SIGNIN, { replace: true });
      },
    );

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate, supabase]);

  if (checking || !onboardingCheck.done) {
    return <RouteLoadingFallback />;
  }

  return <>{children}</>;
};
