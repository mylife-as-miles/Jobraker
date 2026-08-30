import type { SupabaseClient } from "@supabase/supabase-js";
import { clearCachedAuthSnapshot } from "@/lib/offlineAppCache";

export const AUTH_CACHE_RESET_EVENT = "jobraker:auth-cache-reset";

const USER_SCOPED_LOCAL_STORAGE_KEYS = [
  "chat.sessions.v1",
  "jobSources",
] as const;

/**
 * Clear browser state that may contain data belonging to the previous account.
 *
 * Do not clear acquisition/preferences such as selectedPlan, selectedBilling,
 * referral attribution, appearance, or lastUsedProvider.
 */
export async function clearUserScopedClientState() {
  if (typeof window !== "undefined") {
    for (const key of USER_SCOPED_LOCAL_STORAGE_KEYS) {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    }

    window.dispatchEvent(new Event(AUTH_CACHE_RESET_EVENT));
  }

  await clearCachedAuthSnapshot();
}

/**
 * Authentication pages must start from a clean browser session.
 *
 * This is especially important for email-confirmation signups: Supabase can
 * return a newly-created user with session=null, so an already-persisted
 * session must be removed before signUp() is allowed to run.
 */
export async function prepareForFreshAuthentication(
  supabase: SupabaseClient,
) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    await clearUserScopedClientState();
    throw sessionError;
  }

  if (session) {
    const { error: signOutError } = await supabase.auth.signOut({
      scope: "local",
    });

    if (signOutError) {
      await clearUserScopedClientState();
      throw signOutError;
    }
  }

  await clearUserScopedClientState();
}
