import { describe, it, expect } from "vitest";
import fc from "fast-check";

describe("Insights test infrastructure smoke test", () => {
  it("vitest runs correctly", () => {
    expect(1 + 1).toBe(2);
  });

  it("fast-check generates and validates properties", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        expect(a + b).toBe(b + a);
      }),
      { numRuns: 100 },
    );
  });

  it("path alias @ resolves correctly", async () => {
    // Verify the @ alias resolves to the src directory
    // by importing a known module from the project
    const mod = await import("@/lib/utils");
    expect(mod).toBeDefined();
  });
});
