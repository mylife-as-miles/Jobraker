import { describe, expect, it, vi } from "vitest";
import {
  COMPOSIO_OAUTH_MESSAGE,
  createOAuthRequestId,
  isMatchingComposioOAuthMessage,
  waitForComposioConnection,
} from "../lib/composioConnection";

describe("waitForComposioConnection", () => {
  it("finishes as soon as the live provider status becomes connected", async () => {
    const check = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await expect(waitForComposioConnection({
      check,
      popup: { closed: false } as Window,
      intervalMs: 0,
      timeoutMs: 1_000,
    })).resolves.toBe(true);
    expect(check).toHaveBeenCalledTimes(2);
  });

  it("allows a short status-propagation grace period after popup closure", async () => {
    const check = vi.fn().mockResolvedValue(false);

    await expect(waitForComposioConnection({
      check,
      popup: { closed: true } as Window,
      intervalMs: 0,
      timeoutMs: 1_000,
    })).resolves.toBe(false);
    expect(check).toHaveBeenCalledTimes(3);
  });

  it("uses a correlated same-origin callback event to accelerate verification", async () => {
    const requestId = "oauth_request_123456";
    const check = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    window.setTimeout(() => {
      window.dispatchEvent(new MessageEvent("message", {
        origin: window.location.origin,
        data: {
          type: COMPOSIO_OAUTH_MESSAGE,
          requestId,
          provider: "github",
          status: "success",
        },
      }));
    }, 0);

    await expect(waitForComposioConnection({
      check,
      popup: { closed: false } as Window,
      requestId,
      provider: "github",
      intervalMs: 20,
      timeoutMs: 1_000,
    })).resolves.toBe(true);
    expect(check).toHaveBeenCalledTimes(2);
  });

  it("rejects callback messages from a different origin or request", () => {
    const event = new MessageEvent("message", {
      origin: "https://attacker.example",
      data: {
        type: COMPOSIO_OAUTH_MESSAGE,
        requestId: "different_request",
        provider: "github",
        status: "success",
      },
    });
    expect(isMatchingComposioOAuthMessage(event, {
      requestId: "oauth_request_123456",
      provider: "github",
      expectedOrigin: window.location.origin,
    })).toBe(false);
  });

  it("creates callback-safe correlation IDs", () => {
    expect(createOAuthRequestId()).toMatch(/^[a-zA-Z0-9_-]{12,128}$/);
  });
});
