#!/usr/bin/env bash
# ============================================================================
# Wgrywa WSZYSTKIE Edge Functions jednym poleceniem.
#
# Użycie:
#   SUPABASE_ACCESS_TOKEN=sbp_...  SUPABASE=/ścieżka/do/supabase.exe \
#     bash scripts/deploy-functions.sh
#
# Token generujesz raz: https://supabase.com/dashboard/account/tokens
# (po deployu możesz go skasować).
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

REF="${PROJECT_REF:-qlpqmkqbimdwokeofyqq}"
SB="${SUPABASE:-supabase}"
: "${SUPABASE_ACCESS_TOKEN:?Ustaw SUPABASE_ACCESS_TOKEN (token z dashboardu)}"

# submit-application jest publiczna (bez JWT); reszta wymaga zalogowania.
PUBLICZNE="submit-application"

for dir in supabase/functions/*/; do
  fn="$(basename "$dir")"
  [ "$fn" = "_shared" ] && continue
  if [ "$fn" = "$PUBLICZNE" ]; then
    echo "== $fn (--no-verify-jwt) =="
    "$SB" functions deploy "$fn" --no-verify-jwt --project-ref "$REF"
  else
    echo "== $fn =="
    "$SB" functions deploy "$fn" --project-ref "$REF"
  fi
done

echo "Gotowe — wszystkie funkcje wgrane."
