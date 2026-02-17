#!/usr/bin/env node
/* Migration Lint Script (JS ESM version)
   Checks:
    1. Filename format: YYYYMMDDHHMMSS_description.sql (or legacy exceptions flagged as WARN)
    2. Chronological ordering (timestamps must be non-decreasing and 14 digits if canonical)
    3. Duplicate timestamp or duplicate description segments
    4. Large gaps (>14 days) (warn)
    5. Placeholder / retry / manual duplicates clusters (suggest archive)
    6. Cross-directory duplicate timestamps
*/
import fs from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LEGACY_DIR = path.resolve(ROOT, 'migrations');
const SUPABASE_DIR = path.resolve(ROOT, 'supabase/migrations');
const ARCHIVE_DIR = path.resolve(ROOT, 'supabase/migrations-archived');

const CANON = /^(\d{14})_([a-z0-9_]+)\.sql$/;

function collect(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.sql')).map(f => path.join(dir, f));
}

const files = [
  ...collect(LEGACY_DIR),
  ...collect(SUPABASE_DIR)
  // archive intentionally skipped
];

const issues = [];

function issue(level, file, message) { issues.push({ level, file, message }); }

const metas = files.map(file => {
  const base = path.basename(file);
  const m = base.match(CANON);
  if (m) return { file, name: base, tsRaw: m[1], ts: Number(m[1]), slug: m[2], dir: path.dirname(file) };
  return { file, name: base, dir: path.dirname(file) };
});

// 1. Format
for (const m of metas) if (!m.ts) issue('WARN', m.file, 'Non-canonical filename (consider renaming): ' + m.name);

// 2. Chronological ordering & duplicates
const canon = metas.filter(m => m.ts).sort((a,b) => a.ts - b.ts);
for (let i=0;i<canon.length;i++) {
  const cur = canon[i];
  const prev = canon[i-1];
  if (prev && cur.ts === prev.ts) issue('ERROR', cur.file, `Duplicate timestamp also used in ${prev.file}`);
  if (prev && cur.ts < prev.ts) issue('ERROR', cur.file, 'Timestamp out of order relative to previous canonical migration');
  if (prev && cur.ts - prev.ts > 14 * 24 * 60 * 60 * 1000) issue('WARN', cur.file, 'Large chronological gap vs previous canonical migration');
}

// 3. Duplicate slug
const bySlug = {};
for (const m of canon) { if (!m.slug) continue; (bySlug[m.slug] ||= []).push(m); }
for (const [slug, list] of Object.entries(bySlug)) if (list.length > 1) issue('WARN', list[0].file, `Slug '${slug}' appears in multiple canonical migrations: ${list.map(l=>l.file).join(', ')}`);

// 4. Placeholder markers
for (const m of metas) if (/placeholder|retry|manual/i.test(m.name) && !/^\d{14}_/.test(m.name)) issue('WARN', m.file, 'Temporary / placeholder file (consider archiving): ' + m.name);

// 5. Cross-directory duplicate timestamps
const byTs = {};
for (const m of metas) { if (!m.tsRaw) continue; (byTs[m.tsRaw] ||= []).push(m); }
for (const [ts, group] of Object.entries(byTs)) {
  if (group.length > 1) {
    const dirs = new Set(group.map(g => g.dir));
    if (dirs.size > 1) issue('ERROR', group[0].file, `Timestamp ${ts} used across multiple directories: ${group.map(g => g.file).join(', ')}`);
  }
}

if (!issues.length) {
  console.log('Migration lint: OK (no issues)');
  process.exit(0);
} else {
  console.log('Migration lint report:');
  for (const i of issues) console.log('  ' + i.level.padEnd(6) + ' | ' + i.file + ' | ' + i.message);
  process.exit(issues.some(i => i.level === 'ERROR') ? 1 : 0);
}
