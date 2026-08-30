import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cacheAuthSnapshot,
  clearCachedAuthSnapshot,
  getCachedAuthSnapshot,
  getCachedAuthSnapshotForUser,
  updateCachedOnboardingStatus,
} from "@/lib/offlineAppCache";
import {
  AUTH_CACHE_RESET_EVENT,
  clearUserScopedClientState,
  prepareForFreshAuthentication,
} from "@/lib/sessionIsolation";

describe("auth session/cache isolation", () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await clearCachedAuthSnapshot();
  });

  it("never returns another user's offline auth snapshot", async () => {
    await cacheAuthSnapshot({
      hasSession: true,
      user: { id: "user-a", email: "a@example.com" },
      onboardingComplete: true,
    });

    expect(await getCachedAuthSnapshotForUser("user-a")).toMatchObject({
      user: { id: "user-a" },
      onboardingComplete: true,
    });
    expect(await getCachedAuthSnapshotForUser("user-b")).toBeNull();
  });

  it("does not inherit a previous user's identity when onboarding cache changes", async () => {
    await cacheAuthSnapshot({
      hasSession: true,
      user: { id: "user-a", email: "a@example.com" },
      onboardingComplete: true,
    });

    await updateCachedOnboardingStatus(false, {
      id: "user-b",
      email: "b@example.com",
    });

    expect(await getCachedAuthSnapshot()).toMatchObject({
      hasSession: true,
      user: { id: "user-b", email: "b@example.com" },
      onboardingComplete: false,
    });
  });

  it("purges user-scoped browser data but preserves acquisition preferences", async () => {
    localStorage.setItem("chat.sessions.v1", "sensitive-chat-state");
    localStorage.setItem("jobSources", "[\"linkedin\"]");
    localStorage.setItem("selectedPlan", "Pro");
    localStorage.setItem("selectedBilling", "annual");
    localStorage.setItem("lastUsedProvider", "google");

    await cacheAuthSnapshot({
      hasSession: true,
      user: { id: "user-a" },
      onboardingComplete: true,
    });

    const resetListener = vi.fn();
    window.addEventListener(AUTH_CACHE_RESET_EVENT, resetListener);

    await clearUserScopedClientState();

    expect(localStorage.getItem("chat.sessions.v1")).toBeNull();
    expect(localStorage.getItem("jobSources")).toBeNull();
    expect(await getCachedAuthSnapshot()).toBeNull();

    expect(localStorage.getItem("selectedPlan")).toBe("Pro");
    expect(localStorage.getItem("selectedBilling")).toBe("annual");
    expect(localStorage.getItem("lastUsedProvider")).toBe("google");
    expect(resetListener).toHaveBeenCalledTimes(1);

    window.removeEventListener(AUTH_CACHE_RESET_EVENT, resetListener);
  });

  it("signs out an existing local session before fresh authentication", async () => {
    const callOrder: string[] = [];
    const client = {
      auth: {
        getSession: vi.fn(async () => {
          callOrder.push("getSession");
          return {
            data: {
              session: {
                user: { id: "user-a" },
                access_token: "old-token",
              },
            },
            error: null,
          };
        }),
        signOut: vi.fn(async (options: { scope: string }) => {
          callOrder.push(`signOut:${options.scope}`);
          return { error: null };
        }),
      },
    } as unknown as SupabaseClient;

    await prepareForFreshAuthentication(client);

    expect(callOrder).toEqual(["getSession", "signOut:local"]);
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("does not call signOut when no Supabase session exists", async () => {
    const signOut = vi.fn(async () => ({ error: null }));
    const client = {
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: null },
          error: null,
        })),
        signOut,
      },
    } as unknown as SupabaseClient;

    await prepareForFreshAuthentication(client);

    expect(signOut).not.toHaveBeenCalled();
  });
});
