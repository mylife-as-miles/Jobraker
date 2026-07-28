import { describe, expect, it } from "vitest";
import {
  filterConnectedAccountsForUser,
  findActiveConnectedAccount,
  normalizeConnectedAccount,
} from "../../backend/supabase/functions/_shared/composio-connected-account";

describe("Composio connected-account normalization", () => {
  it("matches camel-case toolkit fields", () => {
    const account = { id: "one", toolkitSlug: "GitHub", status: "ACTIVE" };
    expect(findActiveConnectedAccount([account], { slug: "github" })).toBe(account);
  });

  it("matches snake-case and lowercase active statuses", () => {
    const account = { id: "two", toolkit_slug: "linkedin", status: "active" };
    expect(findActiveConnectedAccount([account], { slug: "linkedin" })).toBe(account);
  });

  it("matches nested toolkit and auth configuration shapes", () => {
    const account = {
      id: "three",
      toolkit: { slug: "github" },
      auth_config: { id: "config-1" },
      connection_params: { username: "octocat" },
      status: "ACTIVE",
    };
    expect(findActiveConnectedAccount([account], { authConfigId: "config-1" })).toBe(account);
    expect(normalizeConnectedAccount(account).identifier).toBe("octocat");
  });

  it("does not match inactive accounts", () => {
    const account = { id: "four", app_name: "github", status: "EXPIRED" };
    expect(findActiveConnectedAccount([account], { slug: "github" })).toBeUndefined();
  });

  it("normalizes supported Composio ownership fields", () => {
    expect(normalizeConnectedAccount({ user_id: "user-a" }).userId).toBe("user-a");
    expect(normalizeConnectedAccount({ entityId: "user-b" }).userId).toBe("user-b");
    expect(normalizeConnectedAccount({ user: { id: "user-c" } }).userId).toBe("user-c");
  });

  it("keeps only accounts owned by the authenticated user", () => {
    const owned = { id: "owned", user_id: "user-a", toolkit_slug: "gmail" };
    const other = { id: "other", user_id: "user-b", toolkit_slug: "github" };
    const unscoped = { id: "unscoped", toolkit_slug: "notion" };

    expect(
      filterConnectedAccountsForUser([owned, other, unscoped], "user-a"),
    ).toEqual([owned]);
  });
});
