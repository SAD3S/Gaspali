#!/usr/bin/env bash
# Teste les migrations sur un Postgres nu : base jetable, stub Supabase, migrations, tests.
# Usage : PGHOST=… PGUSER=… supabase/tests/run.sh   (psql doit pouvoir créer une base)
set -euo pipefail
cd "$(dirname "$0")/.."
DB="gaspalli_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/00_supabase_stub.sql
for f in migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"
done
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/foyers.test.sql
