import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(
    process.cwd(),
    "src/screens/Dashboard/pages/CoverLetterBuilderPage.tsx",
  ),
  "utf8",
);

describe("CoverLetterBuilderPage React hooks", () => {
  it("imports the hooks used by the mobile header scroll handler", () => {
    const reactImport = source.match(
      /import\s*\{([^}]*)\}\s*from\s*["']react["'];/,
    )?.[1];

    expect(reactImport).toBeDefined();
    expect(reactImport).toMatch(/\buseRef\b/);
    expect(reactImport).toMatch(/\buseCallback\b/);
  });
});
