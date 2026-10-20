#!/usr/bin/env bash
# Runs the migrations (twice, to prove they are re-runnable), the seed and the
# RLS tests against a throwaway database on a plain Postgres.
#
#   TEST_DATABASE_URL=postgres://postgres@localhost:5432/postgres npm run test:db
#
# TEST_DATABASE_URL must point at a local or CI Postgres you can throw away,
# never at the Supabase project.
set -euo pipefail

: "${TEST_DATABASE_URL:?Set TEST_DATABASE_URL to a throwaway Postgres, e.g. postgres://postgres@localhost:5432/postgres}"
cd "$(dirname "$0")/.."

DB="cp_rls_test_$$"
psql "$TEST_DATABASE_URL" -qAtc "create database $DB" >/dev/null
trap 'psql "$TEST_DATABASE_URL" -qAtc "drop database if exists $DB with (force)" >/dev/null' EXIT

# Same server, new database name
TEST_URL=$(node -e 'const u=new URL(process.argv[1]); u.pathname="/"+process.argv[2]; console.log(u.toString())' "$TEST_DATABASE_URL" "$DB")
run() { PGOPTIONS="-c client_min_messages=warning" psql "$TEST_URL" -v ON_ERROR_STOP=1 -q "$@"; }

run -f supabase/tests/supabase-stub.sql
for pass in 1 2; do
  for f in supabase/migrations/*.sql; do run -f "$f"; done
  run -f supabase/seed.sql
done
echo "migrations and seed applied twice"

run -f supabase/tests/rls.test.sql 2>&1 | sed -n 's/^.*NOTICE:  //p; /ERROR/p'
test "${PIPESTATUS[0]}" -eq 0
echo "all RLS checks passed"
