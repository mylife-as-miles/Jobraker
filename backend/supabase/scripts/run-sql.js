#!/usr/bin/env node
// Simple SQL runner for Postgres using pg
// Usage: node run-sql.js --db-url <postgres-url> --file <path-to-sql>

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--db-url') out.dbUrl = args[++i];
    else if (a === '--file') out.file = args[++i];
    else if (a.startsWith('--db-url=')) out.dbUrl = a.split('=')[1];
    else if (a.startsWith('--file=')) out.file = a.split('=')[1];
  }
  return out;
}

async function main() {
  const { dbUrl, file } = parseArgs();
  if (!dbUrl || !file) {
    console.error('Usage: node run-sql.js --db-url <postgres-url> --file <path-to-sql>');
    process.exit(1);
  }

  function resolveSqlPath(p) {
    if (path.isAbsolute(p)) return p;
    const fromCwd = path.resolve(process.cwd(), p);
    if (fs.existsSync(fromCwd)) return fromCwd;
    return path.resolve(__dirname, p);
  }

  const sqlPath = resolveSqlPath(file);
  if (!fs.existsSync(sqlPath)) {
    console.error(`SQL file not found: ${sqlPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = new Client({ connectionString: dbUrl, application_name: 'jobraker-sql-runner' });
  try {
    await client.connect();
    await client.query("SET lock_timeout = '4s'");
    const res = await client.query(sql);
    if (res && Array.isArray(res.rows)) {
      console.log(JSON.stringify(res.rows, null, 2));
    }
    console.log('SQL executed successfully.');
  } catch (err) {
    console.error('SQL execution failed:', err.message || err);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main();
