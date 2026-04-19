/**
 * One-off: replace migrated teal/cyan accent hex + rgba with gold family.
 * Skips calendar.tsx (Applied pipeline stays teal).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const EXT = new Set([".tsx", ".ts", ".css", ".html", ".jsx", ".mjs", ".cjs"]);
const SKIP_NAMES = new Set(["calendar.tsx"]);
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next"]);

/** Longer keys first */
const REPLACEMENTS = [
  ["rgba(45,212,191", "rgba(255,215,0"],
  ["rgba(10,130,70", "rgba(180,83,9"],
  ["#2dd4bf05", "#ffd70005"],
  ["#2dd4bf", "#ffd700"],
  ["#22d3ee", "#fbbf24"],
  ["#0d9488", "#b45309"],
  ["#15c944", "#d97706"],
  ["#15bd00", "#ca8a04"],
  ["#7dff5c", "#fde047"],
  ["#0fc74f", "#f59e0b"],
  ["#0a8246", "#b45309"],
  ["#9dff8a", "#fde68a"],
];

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(full, out);
    } else if (e.isFile()) {
      const ext = path.extname(e.name);
      if (!EXT.has(ext)) continue;
      if (SKIP_NAMES.has(e.name)) continue;
      out.push(full);
    }
  }
}

function migrateFile(filePath) {
  let s = fs.readFileSync(filePath, "utf8");
  const orig = s;
  for (const [from, to] of REPLACEMENTS) {
    s = s.split(from).join(to);
  }
  if (s !== orig) {
    fs.writeFileSync(filePath, s, "utf8");
    return true;
  }
  return false;
}

const files = [];
walk(ROOT, files);
let n = 0;
for (const f of files) {
  if (migrateFile(f)) {
    n++;
    console.log("updated:", path.relative(ROOT, f));
  }
}
console.log(`Done. ${n} files changed.`);
