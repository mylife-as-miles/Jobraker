/**
 * One-off migrator: legacy lime accent (#1dff00) → gold / amber palette.
 * Run: node scripts/replace-brand-accent.mjs
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
];

const files = new Set();
for (const d of dirs) {
  if (fs.existsSync(d)) for (const f of walk(d)) files.add(f);
}
const tailwindCss = path.join(root, "tailwind.css");
if (fs.existsSync(tailwindCss)) files.add(tailwindCss);

const steps = [
  [/rgba\(29,255,0,/g, "rgba(255,215,0,"],
  [/from-\[#1dff00\]/gi, "from-[#fbbf24]"],
  [/to-\[#1dff00\]/gi, "to-[#b45309]"],
  [/via-\[#1dff00\]/gi, "via-[#ffd700]"],
  [/#1dff00/gi, "#ffd700"],
  [/#7bffb2/gi, "#fde68a"],
  [/#52ff4b/gi, "#fbbf24"],
  [/#eaffea/gi, "#fef3c7"],
];

let touched = 0;
for (const f of files.values()) {
  let s = fs.readFileSync(f, "utf8");
  const orig = s;
  for (const [re, rep] of steps) s = s.replace(re, rep);
  if (s !== orig) {
    fs.writeFileSync(f, s);
    touched++;
  }
}
console.log(`replace-brand-accent: updated ${touched} files`);
