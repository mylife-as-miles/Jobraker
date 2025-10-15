#!/usr/bin/env node
// Wrapper now simply executes the ESM JS lint script.
import('file://' + require('path').resolve(__dirname, 'lint-migrations.mjs')).catch(err => {
  console.error('Failed to execute migration lint:', err);
  process.exit(1);
});
