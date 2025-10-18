#!/usr/bin/env bash
set -euo pipefail

# Small helper to run SQL migrations against a Postgres database using psql.
# Usage: DATABASE_URL="postgres://..." ./scripts/run_migrations.sh

MIGRATIONS_DIR="$(dirname "$0")/../migrations"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set"
  echo "Set DATABASE_URL and re-run, e.g."
  echo "  DATABASE_URL=\"postgres://user:pass@host:5432/dbname\" $0"
  exit 2
fi

echo "Running migrations from: $MIGRATIONS_DIR"

for f in "$MIGRATIONS_DIR"/*.sql; do
  [ -e "$f" ] || break
  echo "--- Applying $f"
  psql "$DATABASE_URL" -f "$f"
done

echo "All migrations applied."
