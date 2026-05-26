// Simple useAuth hook for compatibility with the credit system
// Wraps the existing auth store to provide user information
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import {
  cacheAuthSnapshot,
  clearCachedAuthSnapshot,
  getCachedAuthSnapshot,
} from "@/lib/offlineAppCache";

interface User {
  id: string;
  email?: string;
  // Add other user properties as needed
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

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

    const applyCachedUser = async () => {
      const cachedSnapshot = await getCachedAuthSnapshot();
      if (!mounted) return;
      setUser(
        cachedSnapshot?.hasSession && cachedSnapshot.user
          ? cachedSnapshot.user
          : null,
      );
      setLoading(false);
    };

    const getUser = async () => {
      try {
        const {
          data: { session },
          error,
        } = await withTimeout(supabase.auth.getSession(), 2500);

        if (error) {
          console.error("Error getting session:", error);
          if (isOffline()) {
            await applyCachedUser();
            return;
          }
          if (!mounted) return;
          setUser(null);
          return;
        }

        const authUser = session?.user;
        if (!mounted) return;

        if (authUser) {
          const nextUser = {
            id: authUser.id,
            email: authUser.email,
          };
          setUser(nextUser);
          await cacheAuthSnapshot({
            hasSession: true,
            user: nextUser,
            onboardingComplete: (await getCachedAuthSnapshot())
              ?.onboardingComplete ?? null,
          });
          return;
        }

        if (isOffline()) {
          await applyCachedUser();
          return;
        }

        setUser(null);
      } catch (error) {
        console.error("Error getting session:", error);
        if (isOffline()) {
          await applyCachedUser();
          return;
        }
        if (!mounted) return;
        setUser(null);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        if (session?.user) {
          const nextUser = {
            id: session.user.id,
            email: session.user.email,
          };
          setUser(nextUser);
          await cacheAuthSnapshot({
            hasSession: true,
            user: nextUser,
            onboardingComplete: (await getCachedAuthSnapshot())
              ?.onboardingComplete ?? null,
          });
        } else {
          setUser(null);
          await clearCachedAuthSnapshot();
        }
        setLoading(false);
      }
    );

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
