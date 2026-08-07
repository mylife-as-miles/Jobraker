import { describe, expect, it } from "vitest";
import {
  classifyConnectedAccountStatus,
  filterConnectedAccountsForUser,
  findActiveConnectedAccount,
  findConnectedAccountsForIntegration,
  normalizeConnectedAccount,
  resolveIntegrationConnection,
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

  it("never falls back to other tenants' accounts when the user has none", () => {
    // The workspace-wide list endpoint returns every account in the org; a
    // permissive fallback would show them all as the user's own connections.
    const foreign = [
      { id: "a", user_id: "user-b", toolkit_slug: "gmail" },
      { id: "b", user_id: "user-c", toolkit_slug: "github" },
    ];

    expect(filterConnectedAccountsForUser(foreign, "user-a")).toEqual([]);
  });
});

describe("Composio connection state", () => {
  it("classifies authorization-in-progress records as pending, not connected", () => {
    for (const status of ["INITIALIZING", "INITIATED", "PENDING"]) {
      expect(classifyConnectedAccountStatus(status)).toBe("pending");
    }
    expect(classifyConnectedAccountStatus("ACTIVE")).toBe("active");
    expect(classifyConnectedAccountStatus("")).toBe("active");
    expect(classifyConnectedAccountStatus("EXPIRED")).toBe("inactive");
  });

  it("does not report a half-finished authorization as connected", () => {
    const pending = { id: "pending", toolkit_slug: "gmail", status: "INITIATED" };

    expect(findActiveConnectedAccount([pending], { slug: "gmail" })).toBeUndefined();
    expect(resolveIntegrationConnection([pending], { slug: "gmail" })).toEqual({
      account: pending,
      state: "pending",
    });
  });

  it("prefers a live account over a leftover pending attempt", () => {
    const pending = { id: "pending", toolkit_slug: "gmail", status: "INITIALIZING" };
    const active = { id: "active", toolkit_slug: "gmail", status: "ACTIVE" };

    expect(resolveIntegrationConnection([pending, active], { slug: "gmail" })).toEqual({
      account: active,
      state: "active",
    });
  });

  it("reports no connection when only unusable accounts exist", () => {
    const expired = { id: "expired", toolkit_slug: "notion", status: "EXPIRED" };

    expect(resolveIntegrationConnection([expired], { slug: "notion" })).toEqual({
      account: null,
      state: "inactive",
    });
  });

  it("collects every row for a toolkit so disconnect can clear duplicates", () => {
    const accounts = [
      { id: "one", toolkit_slug: "github", status: "ACTIVE" },
      { id: "two", toolkit_slug: "github", status: "INITIATED" },
      { id: "three", toolkit_slug: "notion", status: "ACTIVE" },
    ];

    expect(
      findConnectedAccountsForIntegration(accounts, { slug: "github" }).map(
        (account) => account.id,
      ),
    ).toEqual(["one", "two"]);
  });
});
