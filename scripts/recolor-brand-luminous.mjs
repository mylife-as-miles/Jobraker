/**
 * Recolor brand primary to Luminous Green (#2fd968 / hsl 140 69% 52%).
 * Replaces the previous green-600 (#16a34a) brand hex/rgb. HSL tokens are
 * edited separately to avoid touching the shared --success value.
 * Run: node scripts/recolor-brand-luminous.mjs
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
  [/#16a34a/gi, "#2fd968"], // green-600 -> luminous green
  [/rgba\(\s*22\s*,\s*163\s*,\s*74\s*,/gi, "rgba(47,217,104,"],
  [/rgb\(\s*22\s*,\s*163\s*,\s*74\s*\)/gi, "rgb(47,217,104)"],
];

let touched = 0;
const changed = [];
for (const f of files.values()) {
  let s = fs.readFileSync(f, "utf8");
  const orig = s;
  for (const [re, rep] of steps) s = s.replace(re, rep);
  if (s !== orig) { fs.writeFileSync(f, s); touched++; changed.push(path.relative(root, f)); }
}
console.log(`recolor-brand-luminous: updated ${touched} files`);
