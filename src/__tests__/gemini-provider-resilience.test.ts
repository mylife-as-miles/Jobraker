import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "backend/supabase/functions/_shared/gemini.ts"),
  "utf8",
);

describe("Gemini provider resilience guardrails", () => {
  it("uses distinct currently-supported fallback models", () => {
    expect(source).toContain('GEMINI_MODEL = "gemini-3.6-flash"');
    expect(source).toContain('GEMINI_LITE_MODEL = "gemini-3.5-flash-lite"');
    expect(source).toContain('"gemini-2.5-flash"');
    expect(source).not.toContain('"gemini-1.5-flash"');
  });

  it("distinguishes provider throttling from transient provider availability", () => {
    expect(source).toContain("isGeminiQuotaError");
    expect(source).toContain("isGeminiTransientProviderError");
    expect(source).toContain("temporarily rate-limiting this request");
    expect(source).toContain("temporarily having trouble responding");
  });

  it("preserves completed agent tool work when every model fails", () => {
    expect(source).toContain("isFunctionResponseMessage(message)");
    expect(source).toContain("**Work preserved.**");
    expect(source).toContain("The completed actions above were not rolled back");
    expect(source).toContain("jobrakerFallbackExhausted");
  });
});
