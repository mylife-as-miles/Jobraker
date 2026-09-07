import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "backend/supabase/migrations/20260906161405_cookie_consent_preferences.sql",
  ),
  "utf8",
);

describe("cookie consent migration", () => {
  it("stores a versioned, constrained consent decision on existing privacy rows", () => {
    expect(migration).toContain("cookie_consent_status");
    expect(migration).toContain("cookie_consent_version");
    expect(migration).toContain("cookie_consent_updated_at");
    expect(migration).toMatch(/check\s*\(\s*cookie_consent_status\s+in/i);
    expect(migration).not.toMatch(/create\s+policy[\s\S]*using\s*\(\s*true\s*\)/i);
  });
});
