#!/usr/bin/env ts-node
/*
  Migration Lint Script
  Checks:
    1. Filename format: YYYYMMDDHHMMSS_description.sql (or legacy exceptions flagged as WARN)
    2. Chronological ordering (timestamps must be non-decreasing and 14 digits if in canonical format)
    3. Duplicate timestamp or duplicate description segments
    4. Large gaps: > 14 days between sequential timestamps (warn)
    5. Placeholder / retry / manual duplicates clusters (suggest archive if >1 variant)
    6. Accidental duplicates in supabase/migrations vs backend/migrations (same timestamp)
  Exit codes:
    0 success, 1 hard errors found
*/
import fs from 'fs';
import path from 'path';

interface Issue { level: 'ERROR' | 'WARN'; file: string; message: string; }

const ROOT = path.resolve(__dirname, '..');
const LEGACY_DIR = path.resolve(ROOT, 'migrations');
const SUPABASE_DIR = path.resolve(ROOT, 'supabase/migrations');

const CANON = /^(\d{14})_([a-z0-9_]+)\.sql$/;

function collect(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.sql')).map(f => path.join(dir, f));
}

const files = [...collect(LEGACY_DIR), ...collect(SUPABASE_DIR)];
const issues: Issue[] = [];

interface MigMeta { file: string; name: string; ts?: number; tsRaw?: string; slug?: string; dir: string; }
const metas: MigMeta[] = files.map(file => {
  const base = path.basename(file);
  const m = base.match(CANON);
  if (m) {
    return { file, name: base, tsRaw: m[1], ts: Number(m[1]), slug: m[2], dir: path.dirname(file) };
  }
  return { file, name: base, dir: path.dirname(file) };
});

// 1. Format check
for (const m of metas) {
  if (!m.ts) {
    issues.push({ level: 'WARN', file: m.file, message: 'Non-canonical filename (consider renaming): ' + m.name });
  }
}

// 2. Chronological ordering (only canonical considered) & duplicates
const canon = metas.filter(m => m.ts).sort((a,b) => (a.ts! - b.ts!));
for (let i=0;i<canon.length;i++) {
  const cur = canon[i];
  const prev = canon[i-1];
  if (prev && cur.ts === prev.ts) {
    issues.push({ level: 'ERROR', file: cur.file, message: `Duplicate timestamp also used in ${prev.file}` });
  }
  if (prev && cur.ts! < prev.ts!) {
    issues.push({ level: 'ERROR', file: cur.file, message: 'Timestamp out of order relative to previous canonical migration' });
  }
  if (prev && cur.ts! - prev.ts! > 14 * 24 * 60 * 60 * 1000) { // naive large gap check (treat ts as lexical time, not exact ms)
    issues.push({ level: 'WARN', file: cur.file, message: 'Large chronological gap vs previous canonical migration' });
  }
}

// 3. Duplicate description slug detection
const bySlug: Record<string, MigMeta[]> = {};
for (const m of canon) {
  if (!m.slug) continue;
  bySlug[m.slug] = bySlug[m.slug] || [];
  bySlug[m.slug].push(m);
}
for (const [slug, list] of Object.entries(bySlug)) {
  if (list.length > 1) {
    const refs = list.map(l => l.file).join(', ');
    issues.push({ level: 'WARN', file: list[0].file, message: `Slug '${slug}' appears in multiple canonical migrations: ${refs}` });
  }
}

// 4. Placeholder / retry / manual clusters
for (const m of metas) {
  if (/placeholder|retry|manual/i.test(m.name) && !/^(?:\d{14})_/.test(m.name)) {
    issues.push({ level: 'WARN', file: m.file, message: 'Temporary / placeholder file (consider archiving): ' + m.name });
  }
}

// 5. Cross-directory duplicate timestamps
const byTs: Record<string, MigMeta[]> = {};
for (const m of metas) {
  if (!m.tsRaw) continue;
  byTs[m.tsRaw] = byTs[m.tsRaw] || [];
  byTs[m.tsRaw].push(m);
}
for (const [ts, group] of Object.entries(byTs)) {
  if (group.length > 1) {
    const dirs = new Set(group.map(g => g.dir));
    if (dirs.size > 1) {
      issues.push({ level: 'ERROR', file: group[0].file, message: `Timestamp ${ts} used across multiple directories: ${group.map(g => g.file).join(', ')}` });
    }
  }
}

// Report
const pad = (s: string, n: number) => s.padEnd(n);
const rows = issues.map(i => `${pad(i.level,6)} | ${i.file} | ${i.message}`);
if (!rows.length) {
  console.log('Migration lint: OK (no issues)');
  process.exit(0);
} else {
  console.log('Migration lint report:');
  for (const r of rows) console.log('  ' + r);
  const hasError = issues.some(i => i.level === 'ERROR');
  process.exit(hasError ? 1 : 0);
}
