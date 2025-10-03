#!/usr/bin/env node
// Wrapper to execute the TypeScript migration lint script with ts-node in an ESM project.
// Uses CommonJS loader hook to support .ts without modifying Node startup flags.

try {
  require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs' } });
  require('./lint-migrations.ts');
} catch (err) {
  console.error('Failed to execute migration lint:', err);
  process.exit(1);
}
