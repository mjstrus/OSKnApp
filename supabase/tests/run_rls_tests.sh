#!/usr/bin/env bash
# ============================================================================
# Uruchamia migracje + testy izolacji RLS na ŚWIEŻEJ bazie.
#
# Użycie:
#   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
#     ./run_rls_tests.sh                    # baza lokalnego `supabase start`
#
#   APPLY_LOCAL_AUTH_SHIM=1 DATABASE_URL=... ./run_rls_tests.sh
#     # czysty Postgres bez Supabase — najpierw shim auth (roles + auth.uid())
#
# Migracje nie są idempotentne — baza musi być świeża (bez tabel projektu).
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")"

DB_URL="${DATABASE_URL:?Ustaw DATABASE_URL (np. postgresql://postgres:postgres@127.0.0.1:54322/postgres)}"

if [ "${APPLY_LOCAL_AUTH_SHIM:-0}" = "1" ]; then
  echo "== Shim auth dla czystego Postgresa =="
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f helpers/local_auth_shim.sql
fi

echo "== Migracje =="
for m in ../migrations/*.sql; do
  echo "-- $m"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$m"
done

echo "== Testy SQL (izolacja RLS + guardrail rezerwacji) =="
for t in *.test.sql; do
  echo "-- $t"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$t"
done
