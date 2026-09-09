// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  cacheAuthSnapshot,
  cacheAuthenticatedUser,
  clearCachedAuthSnapshot,
  getCachedAuthSnapshot,
  getCachedAuthSnapshotForUser,
  updateCachedOnboardingStatus,
} from "./offlineAppCache";

describe("offline auth cache isolation", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await clearCachedAuthSnapshot();
  });

  it("does not carry onboarding state across authenticated users", async () => {
    await cacheAuthSnapshot({
      hasSession: true,
      user: { id: "user-a", email: "a@example.com" },
      onboardingComplete: true,
    });

    await cacheAuthenticatedUser({
      id: "user-b",
      email: "b@example.com",
    });

    const snapshot = await getCachedAuthSnapshot();

    expect(snapshot?.user?.id).toBe("user-b");
    expect(snapshot?.onboardingComplete).toBeNull();
    expect(await getCachedAuthSnapshotForUser("user-a")).toBeNull();
  });

  it("preserves onboarding state only for the same user", async () => {
    await cacheAuthSnapshot({
      hasSession: true,
      user: { id: "user-a", email: "a@example.com" },
      onboardingComplete: true,
    });

    await cacheAuthenticatedUser({
      id: "user-a",
      email: "a+updated@example.com",
    });

    const snapshot = await getCachedAuthSnapshot();

    expect(snapshot?.user).toEqual({
      id: "user-a",
      email: "a+updated@example.com",
    });
    expect(snapshot?.onboardingComplete).toBe(true);
  });

  it("allows a freshly computed onboarding result for a new user", async () => {
    await cacheAuthSnapshot({
      hasSession: true,
      user: { id: "user-a", email: "a@example.com" },
      onboardingComplete: true,
    });

    await updateCachedOnboardingStatus(false, {
      id: "user-b",
      email: "b@example.com",
    });

    const snapshot = await getCachedAuthSnapshot();

    expect(snapshot?.user?.id).toBe("user-b");
    expect(snapshot?.onboardingComplete).toBe(false);
  });
});
