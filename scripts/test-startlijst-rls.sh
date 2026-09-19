#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL to a Postgres connection with permission to SET ROLE}"
test_root="$(cd "$(dirname "$0")/.." && pwd)"
{
  printf 'BEGIN;\n'
  sed '/^BEGIN;$/d; /^COMMIT;$/d' \
    "$test_root/migrations/20260918092712_fix_startlijst_admin_transactions.sql" \
    "$test_root/migrations/20260918160135_restrict_score_volunteer_access.sql"
  cat "$test_root/scripts/test-startlijst-rls.sql" "$test_root/scripts/test-score-access.sql"
  printf '\nROLLBACK;\n'
} | psql "$DATABASE_URL" --set ON_ERROR_STOP=1
