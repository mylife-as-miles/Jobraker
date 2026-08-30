// Simple useAuth hook for compatibility with the credit system
// Wraps the existing Supabase session while preserving strict account isolation.
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import {
  cacheAuthSnapshot,
  getCachedAuthSnapshot,
  getCachedAuthSnapshotForUser,
} from "@/lib/offlineAppCache";
import { clearUserScopedClientState } from "@/lib/sessionIsolation";

const AUTH_SESSION_TIMEOUT_MS = 45_000;

interface User {
  id: string;
  email?: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

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

    const applySessionUser = async (authUser: {
      id: string;
      email?: string;
    }) => {
      const existing = await getCachedAuthSnapshot();
      const sameUserSnapshot =
        await getCachedAuthSnapshotForUser(authUser.id);

      if (existing?.user?.id && existing.user.id !== authUser.id) {
        await clearUserScopedClientState();
      }

      if (!mounted) return;

      const nextUser = {
        id: authUser.id,
        email: authUser.email,
      };

      setUser(nextUser);
      await cacheAuthSnapshot({
        hasSession: true,
        user: nextUser,
        onboardingComplete: sameUserSnapshot?.onboardingComplete ?? null,
      });
    };

    const getUser = async () => {
      try {
        const {
          data: { session },
          error,
        } = await withTimeout(
          supabase.auth.getSession(),
          AUTH_SESSION_TIMEOUT_MS,
        );

        if (!mounted) return;

        if (error) {
          console.error("Error getting session:", error);
          setUser(null);
          await clearUserScopedClientState();
          return;
        }

        if (session?.user?.id) {
          await applySessionUser({
            id: session.user.id,
            email: session.user.email,
          });
          return;
        }

        // Never restore identity from IndexedDB/localStorage when Supabase has
        // no session. This prevents account A from being shown as account B.
        setUser(null);
        await clearUserScopedClientState();
      } catch (error) {
        console.error("Error getting session:", error);
        if (!mounted) return;
        setUser(null);
        await clearUserScopedClientState();
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      if (session?.user?.id) {
        await applySessionUser({
          id: session.user.id,
          email: session.user.email,
        });
      } else {
        setUser(null);
        await clearUserScopedClientState();
      }

      if (mounted) {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  return {
    user,
    loading,
    isAuthenticated: !!user,
  };
};
