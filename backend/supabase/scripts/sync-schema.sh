#!/usr/bin/env bash
set -euo pipefail

# This script generates a new migration (if there are changes) and dumps the current public schema
# using the Supabase CLI. It expects to be run from the repo root or anywhere; it CD's to the supabase dir.

SUPABASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SUPABASE_DIR"

# Ensure supabase containers are up (otherwise diff may fail due to no shadow db)
if ! npx supabase status >/dev/null 2>&1; then
  echo "Starting Supabase local stack..."
  npx supabase start
fi

STAMP=$(date +%Y%m%d%H%M%S)

echo "Generating migration with stamp: $STAMP (if changes exist)"
# supabase db diff exits 0 with a new file when there are diffs; if no diffs, it prints a message
npx supabase db diff -f "$STAMP" --local || true

# Always dump the schema to schema.sql to keep it as single source of truth
echo "Dumping public schema to schema.sql"
npx supabase db dump --local --schema public --file ./schema.sql

echo "Done. Check backend/supabase/migrations for new files and backend/supabase/schema.sql for the latest schema dump."
