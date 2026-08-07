import { describe, expect, it, vi } from "vitest";
import {
  COMPOSIO_OAUTH_MESSAGE,
  createOAuthRequestId,
  isMatchingComposioOAuthMessage,
  waitForComposioConnection,
} from "../lib/composioConnection";

describe("waitForComposioConnection", () => {
  it("finishes as soon as the live provider status becomes active", async () => {
    const check = vi.fn()
      .mockResolvedValueOnce("inactive" as const)
      .mockResolvedValueOnce("active" as const);

    await expect(waitForComposioConnection({
      check,
      popup: { closed: false } as Window,
      intervalMs: 0,
      timeoutMs: 1_000,
    })).resolves.toBe("connected");
    expect(check).toHaveBeenCalledTimes(2);
  });

  it("does not treat a pending authorization as a connection", async () => {
    // Composio creates a pending record the moment the link is issued; the
    // user has not authorized anything yet.
    const check = vi.fn().mockResolvedValue("pending" as const);

    await expect(waitForComposioConnection({
      check,
      popup: { closed: true } as Window,
      intervalMs: 0,
      timeoutMs: 1_000,
    })).resolves.toBe("cancelled");
  });

  it("reports cancellation when the popup closes without authorizing", async () => {
    const check = vi.fn().mockResolvedValue("inactive" as const);

    await expect(waitForComposioConnection({
      check,
      popup: { closed: true } as Window,
      intervalMs: 0,
      timeoutMs: 1_000,
    })).resolves.toBe("cancelled");
    expect(check).toHaveBeenCalledTimes(3);
  });

  it("uses a correlated same-origin callback event to accelerate verification", async () => {
    const requestId = "oauth_request_123456";
    const check = vi.fn()
      .mockResolvedValueOnce("inactive" as const)
      .mockResolvedValueOnce("active" as const);

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
    })).resolves.toBe("connected");
    expect(check).toHaveBeenCalledTimes(2);
  });

  it("keeps waiting after an authorized popup closes before Composio catches up", async () => {
    const requestId = "oauth_request_654321";
    // Fails the first several polls, then flips active — the pattern seen when
    // the callback fires before Composio marks the account ACTIVE.
    const check = vi.fn()
      .mockResolvedValue("pending" as const)
      .mockResolvedValueOnce("pending" as const)
      .mockResolvedValueOnce("pending" as const)
      .mockResolvedValueOnce("pending" as const)
      .mockResolvedValueOnce("pending" as const)
      .mockResolvedValueOnce("active" as const);

    window.setTimeout(() => {
      window.dispatchEvent(new MessageEvent("message", {
        origin: window.location.origin,
        data: {
          type: COMPOSIO_OAUTH_MESSAGE,
          requestId,
          provider: "gmail",
          status: "success",
        },
      }));
    }, 0);

    await expect(waitForComposioConnection({
      check,
      popup: { closed: true } as Window,
      requestId,
      provider: "gmail",
      intervalMs: 0,
      timeoutMs: 2_000,
    })).resolves.toBe("connected");
  });

  it("surfaces a provider-reported failure instead of waiting it out", async () => {
    const requestId = "oauth_request_abcdef";
    const check = vi.fn().mockResolvedValue("inactive" as const);

    window.setTimeout(() => {
      window.dispatchEvent(new MessageEvent("message", {
        origin: window.location.origin,
        data: {
          type: COMPOSIO_OAUTH_MESSAGE,
          requestId,
          provider: "notion",
          status: "error",
        },
      }));
    }, 0);

    await expect(waitForComposioConnection({
      check,
      popup: { closed: false } as Window,
      requestId,
      provider: "notion",
      intervalMs: 0,
      timeoutMs: 1_000,
    })).resolves.toBe("failed");
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
