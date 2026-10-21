#!/usr/bin/env bash
# Prueba las migraciones, el seed y las políticas RLS en un PostgreSQL local
# temporal (no necesita Supabase). Requiere los binarios de PostgreSQL.
set -euo pipefail
cd "${ROOT:-$(dirname "$0")/..}"
PGBIN=${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}
TMP=$(mktemp -d)
trap '"$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"' EXIT
"$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-k $TMP -p 54329 -c listen_addresses=''" -l "$TMP/log" start >/dev/null
PSQL=(psql -h "$TMP" -p 54329 -U postgres -v ON_ERROR_STOP=1 -q -d postgres)
if [ -w supabase ]; then node --experimental-strip-types --no-warnings scripts/gen-seed.ts; fi
"${PSQL[@]}" -f supabase/tests/00_local_stubs.sql
for f in supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -f supabase/seed.sql
"${PSQL[@]}" -f supabase/tests/10_rls_test.sql
