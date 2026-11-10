#!/usr/bin/env bash
# Aplica las migraciones a una base de datos PostgreSQL vacía y ejecuta las pruebas de privacidad.
# Uso: DATABASE_URL=postgres://... supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${DATABASE_URL:?Define DATABASE_URL apuntando a una base de datos vacía de pruebas}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f tests/00_simular_supabase.sql
for f in migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f"; done
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f tests/rls_test.sql
