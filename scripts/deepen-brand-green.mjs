/**
 * Deepen the brand primary from green-500 (#22c55e / hsl 142 71% 45%) to
 * green-600 (#16a34a / hsl 142 76% 36%) to match the deeper emerald card.
 * Run: node scripts/deepen-brand-green.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skipDirs = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage"]);
const exts = new Set([".tsx", ".ts", ".jsx", ".js", ".css", ".md", ".html", ".sql"]);

function walk(dir, files = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return files; }
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
for (const d of dirs) if (fs.existsSync(d)) for (const f of walk(d)) files.add(f);
for (const f of ["tailwind.css"]) {
  const p = path.join(root, f);
  if (fs.existsSync(p)) files.add(p);
}

const steps = [
  [/#22c55e/gi, "#16a34a"], // green-500 -> green-600
  [/rgba\(\s*34\s*,\s*197\s*,\s*94\s*,/gi, "rgba(22,163,74,"], // rgb of green-500 -> green-600
  [/rgb\(\s*34\s*,\s*197\s*,\s*94\s*\)/gi, "rgb(22,163,74)"],
  [/142\s+71%\s+45%/g, "142 76% 36%"],
  [/142\s*,\s*71%\s*,\s*45%/g, "142, 76%, 36%"],
];

let touched = 0;
const changed = [];
for (const f of files.values()) {
  let s = fs.readFileSync(f, "utf8");
  const orig = s;
  for (const [re, rep] of steps) s = s.replace(re, rep);
  if (s !== orig) { fs.writeFileSync(f, s); touched++; changed.push(path.relative(root, f)); }
}
console.log(`deepen-brand-green: updated ${touched} files`);
for (const c of changed.sort()) console.log("  " + c);
