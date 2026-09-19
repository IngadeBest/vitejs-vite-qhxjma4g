#!/usr/bin/env bash
set -euo pipefail

# Small helper to run SQL migrations against a Postgres database using psql.
# Usage: DATABASE_URL="postgres://..." bash scripts/run_migrations.sh exact_migration.sql

MIGRATIONS_DIR="$(dirname "$0")/../migrations"

if [ "$#" -eq 0 ]; then
  echo "ERROR: Specify exact migration filenames; replaying all historical migrations is unsafe."
  exit 2
fi

for migration in "$@"; do
  if [[ ! "$migration" =~ ^[0-9][A-Za-z0-9_-]*\.sql$ ]] || [ ! -f "$MIGRATIONS_DIR/$migration" ]; then
    echo "ERROR: Invalid or missing migration filename: $migration"
    exit 2
  fi
done

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set"
  echo "Set DATABASE_URL and re-run, e.g."
  echo "  DATABASE_URL=\"postgres://user:pass@host:5432/dbname\" $0"
  exit 2
fi

echo "Running migrations from: $MIGRATIONS_DIR"

for migration in "$@"; do
  f="$MIGRATIONS_DIR/$migration"
  echo "--- Applying $f"
  psql "$DATABASE_URL" --set ON_ERROR_STOP=1 -f "$f"
done

echo "All migrations applied."
