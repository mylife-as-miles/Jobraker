import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

let row: Record<string, unknown> | null = null;

vi.mock("@/lib/supabaseClient", () => ({
  createClient: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
            }),
          }),
        }),
      }),
    }),
  }),
}));

import { useExpiredSubscription } from "@/hooks/useExpiredSubscription";

const future = () => new Date(Date.now() + 86_400_000).toISOString();
const past = () => new Date(Date.now() - 86_400_000).toISOString();

describe("useExpiredSubscription", () => {
  beforeEach(() => {
    window.localStorage.clear();
    row = null;
  });

  it("stays quiet for someone who never subscribed", async () => {
    row = null;
    const { result } = renderHook(() => useExpiredSubscription());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.expired).toBeNull();
  });

  it("stays quiet while a paid plan is still active", async () => {
    row = { status: "active", current_period_end: future(), subscription_plans: { name: "Pro" } };
    const { result } = renderHook(() => useExpiredSubscription());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.expired).toBeNull();
  });

  it("flags a plan whose period has elapsed", async () => {
    row = { status: "active", current_period_end: past(), subscription_plans: { name: "Pro" } };
    const { result } = renderHook(() => useExpiredSubscription());
    await waitFor(() => expect(result.current.expired).not.toBeNull());
    expect(result.current.expired?.planName).toBe("Pro");
  });

  it("flags a cancelled plan", async () => {
    row = { status: "canceled", current_period_end: future(), subscription_plans: { name: "Ultimate" } };
    const { result } = renderHook(() => useExpiredSubscription());
    await waitFor(() => expect(result.current.expired).not.toBeNull());
    expect(result.current.expired?.planName).toBe("Ultimate");
  });

  it("does not nag a lapsed Free row", async () => {
    row = { status: "expired", current_period_end: past(), subscription_plans: { name: "Free" } };
    const { result } = renderHook(() => useExpiredSubscription());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.expired).toBeNull();
  });

  it("stays dismissed for that period, but not for a later one", async () => {
    const endedAt = past();
    row = { status: "expired", current_period_end: endedAt, subscription_plans: { name: "Pro" } };

    const first = renderHook(() => useExpiredSubscription());
    await waitFor(() => expect(first.result.current.expired).not.toBeNull());
    act(() => first.result.current.dismiss());
    await waitFor(() => expect(first.result.current.expired).toBeNull());

    // Same period -> still dismissed.
    const again = renderHook(() => useExpiredSubscription());
    await waitFor(() => expect(again.result.current.loading).toBe(false));
    expect(again.result.current.expired).toBeNull();

    // A later lapse is a new notice and must surface again.
    row = {
      status: "expired",
      current_period_end: new Date(Date.now() - 1000).toISOString(),
      subscription_plans: { name: "Pro" },
    };
    const next = renderHook(() => useExpiredSubscription());
    await waitFor(() => expect(next.result.current.expired).not.toBeNull());
  });
});
