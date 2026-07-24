/**
 * Brand accent migrator: legacy lime accent (#1dff00, hue 113) → green palette (hue 142).
 * Aligns the brand with the existing --success green so the whole app reads as one green.
 * Run: node scripts/replace-brand-green.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skipDirs = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
]);

const exts = new Set([
  ".tsx",
  ".ts",
  ".jsx",
  ".js",
  ".css",
  ".md",
  ".html",
  ".sql",
]);

function walk(dir, files = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const e of entries) {
    if (skipDirs.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, files);
    else if (exts.has(path.extname(e.name))) files.push(p);
  }
  return files;
}

const dirs = [
  path.join(root, "src"),
  path.join(root, "public"),
  path.join(root, "docs"),
  path.join(root, "backend", "supabase", "templates"),
  path.join(root, "backend", "supabase", "functions"),
  path.join(root, "hyperframes"),
];

const files = new Set();
for (const d of dirs) {
  if (fs.existsSync(d)) for (const f of walk(d)) files.add(f);
}
for (const f of ["tailwind.css"]) {
  const p = path.join(root, f);
  if (fs.existsSync(p)) files.add(p);
}

// Order matters: rgb/rgba first, then hex shades, then HSL triples.
const steps = [
  // rgb / rgba of #1dff00 (29,255,0) -> #22c55e (34,197,94)
  [/rgba\(\s*29\s*,\s*255\s*,\s*0\s*,/gi, "rgba(34,197,94,"],
  [/rgb\(\s*29\s*,\s*255\s*,\s*0\s*\)/gi, "rgb(34,197,94)"],
  // hex shade family (lime -> green ramp)
  [/#1dff00/gi, "#22c55e"], // primary   green-500
  [/#52ff4b/gi, "#4ade80"], // mid       green-400
  [/#7bffb2/gi, "#86efac"], // light     green-300
  [/#eaffea/gi, "#dcfce7"], // tint      green-100
  // HSL triples (hue 113 -> hue 142). Handle space- and comma-separated forms.
  [/113\s+100%\s+50%/g, "142 71% 45%"],
  [/113\s*,\s*100%\s*,\s*50%/g, "142, 71%, 45%"],
  [/113\s+100%\s+95%/g, "142 72% 94%"], // product tint bg
  [/113\s*,\s*100%\s*,\s*95%/g, "142, 72%, 94%"],
  [/113\s+86%\s+74%/g, "142 69% 73%"], // product ring
  [/113\s*,\s*86%\s*,\s*74%/g, "142, 69%, 73%"],
];

let touched = 0;
const changed = [];
for (const f of files.values()) {
  let s = fs.readFileSync(f, "utf8");
  const orig = s;
  for (const [re, rep] of steps) s = s.replace(re, rep);
  if (s !== orig) {
    fs.writeFileSync(f, s);
    touched++;
    changed.push(path.relative(root, f));
  }
}
console.log(`replace-brand-green: updated ${touched} files`);
for (const c of changed.sort()) console.log("  " + c);
