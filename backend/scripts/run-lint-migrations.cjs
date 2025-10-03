#!/usr/bin/env node
// Thin wrapper to execute the TypeScript migration lint under ESM settings.
// Avoids needing a global ts-node; relies on ts-node/register/transpile-only.

import('ts-node/register/transpile-only')
  .then(() => import('./lint-migrations.ts'))
  .catch(err => {
    console.error('Failed to execute migration lint:', err);
    process.exit(1);
  });
