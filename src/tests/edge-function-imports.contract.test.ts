import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

/**
 * A named import that does not resolve is not a type error in a Deno edge
 * function -- it is a module-load failure that takes the entire function down
 * on every invocation, with no partial degradation.
 *
 * skyvern-webhook shipped in exactly that state: it imported
 * `recordSkyvernUsageFromOutput`, which was declared but never exported, and
 * `refundCurrentAutoApplyQuota`, which did not exist at all. Every provider
 * callback failed at boot, so no auto-apply run could ever sync its status.
 * Nothing caught it because the deploy step does not type-check.
 */
const FUNCTIONS_DIR = resolve(process.cwd(), "backend/supabase/functions");
const SHARED_DIR = join(FUNCTIONS_DIR, "_shared");

function exportedNames(modulePath: string): Set<string> | null {
  if (!existsSync(modulePath)) return null;
  const src = readFileSync(modulePath, "utf8");
  const names = new Set<string>();
  const declRe =
    /^export\s+(?:default\s+)?(?:async\s+)?(?:function|const|let|var|class|type|interface|enum)\s+([A-Za-z0-9_$]+)/gm;
  for (const m of src.matchAll(declRe)) names.add(m[1]);
  const blockRe = /^export\s*\{([^}]*)\}/gm;
  for (const m of src.matchAll(blockRe)) {
    for (const raw of m[1].split(",")) {
      const part = raw.trim();
      if (!part) continue;
      names.add(part.includes(" as ") ? part.split(" as ").pop()!.trim() : part);
    }
  }
  if (/^export\s+\*/m.test(src)) names.add("*STAR*");
  return names;
}

describe("edge function imports", () => {
  it("every named import from _shared resolves to a real export", () => {
    const unresolved: string[] = [];

    for (const entry of readdirSync(FUNCTIONS_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === "_shared") continue;
      const indexPath = join(FUNCTIONS_DIR, entry.name, "index.ts");
      if (!existsSync(indexPath)) continue;
      const src = readFileSync(indexPath, "utf8");

      const importRe =
        /import\s+(type\s+)?\{([^}]*)\}\s*from\s*"\.\.\/_shared\/([^"]+)"/g;
      for (const m of src.matchAll(importRe)) {
        const moduleFile = m[3];
        const exports = exportedNames(join(SHARED_DIR, moduleFile));
        if (exports === null) {
          unresolved.push(`${entry.name} -> _shared/${moduleFile} (module missing)`);
          continue;
        }
        if (exports.has("*STAR*")) continue;

        for (const raw of m[2].split(",")) {
          const part = raw.trim().replace(/^type\s+/, "");
          if (!part) continue;
          const name = part.split(" as ")[0].trim();
          if (name && !exports.has(name)) {
            unresolved.push(`${entry.name} -> _shared/${moduleFile} : ${name}`);
          }
        }
      }
    }

    expect(unresolved).toEqual([]);
  });

  it("exports the helpers skyvern-webhook loads at boot", () => {
    const providerCredits = exportedNames(join(SHARED_DIR, "provider-credits.ts"));
    const featureLimits = exportedNames(join(SHARED_DIR, "feature-limits.ts"));
    expect(providerCredits).toContain("recordSkyvernUsageFromOutput");
    expect(featureLimits).toContain("refundCurrentAutoApplyQuota");
  });
});
