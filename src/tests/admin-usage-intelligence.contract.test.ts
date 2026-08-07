import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const edge = readFileSync(resolve(process.cwd(), "backend/supabase/functions/admin-usage-analytics/index.ts"), "utf8");
const migration = readFileSync(resolve(process.cwd(), "backend/supabase/migrations/20260805120000_admin_usage_cost_intelligence.sql"), "utf8");
const costPage = readFileSync(resolve(process.cwd(), "src/pages/admin/pages/AdminCostAllocation.tsx"), "utf8");

describe("admin usage intelligence security contract", () => {
  it("resolves roles from user_roles after validating JWT and never from metadata", () => {
    expect(edge).toContain("authClient.auth.getUser()");
    expect(edge).toContain('.from("user_roles")');
    expect(edge).not.toContain("user_metadata");
  });

  it("keeps readers read-only, editors bounded, and owner changes explicit", () => {
    expect(edge).toContain('context.role === "reader"');
    expect(edge).toContain('context.role !== "owner"');
    expect(edge).toContain("admin_audit_logs");
    expect(edge).not.toContain(".rpc(\"execute_sql");
  });

  it("does not grant aggregation views to browser roles", () => {
    expect(migration).toMatch(/REVOKE ALL[\s\S]*FROM PUBLIC, anon, authenticated/);
    expect(migration).toContain("TO service_role");
  });

  it("keeps Basics AI and provider allocations separate at five dollars each", () => {
    expect(migration).toContain("WHEN 'Basics' THEN 5000000000");
    expect(migration).toContain("WHEN 'Basics' THEN 250");
    expect(migration).toContain("included_credits * 20000000");
    expect(costPage).toContain("Separate AI allowance from external-provider allocation");
  });
});
