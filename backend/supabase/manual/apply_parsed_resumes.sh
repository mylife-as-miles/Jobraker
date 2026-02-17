#!/usr/bin/env bash
set -euo pipefail

# Applies parsed_resumes consolidated SQL to remote Supabase database.
# Requires env vars:
#   SUPABASE_PROJECT_REF
#   SUPABASE_ACCESS_TOKEN
#   DB_PASSWORD  (optional; if omitted CLI will prompt)
# Usage:
#   chmod +x apply_parsed_resumes.sh
#   ./apply_parsed_resumes.sh

SQL_FILE="$(dirname "$0")/parsed_resumes_apply.sql"
if [ ! -f "$SQL_FILE" ]; then
  echo "Missing SQL file: $SQL_FILE" >&2
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "supabase CLI not found in PATH" >&2
  exit 1
fi

# Pipe SQL through psql via supabase db remote commit workaround:
# CLI lacks direct 'run arbitrary remote SQL file' without studio; we open a psql shell.

echo "Applying parsed_resumes schema to remote project $SUPABASE_PROJECT_REF..."

# Use temporary psql session
supabase db remote psql < "$SQL_FILE"

echo "Done. Now run the following repairs if not already marked applied:" >&2
cat <<'EOF'
supabase migration repair --status applied 20250910120000
supabase migration repair --status applied 20250910120010
supabase migration repair --status applied 20250910123000
supabase migration repair --status applied 20250910124500
EOF
