#!/usr/bin/env bash
# Run the SQL tests of the migration helper procedures (database/test/sql/*.test.sql).
# Each test file gets a fresh scratch database `proc_test` holding the procedures from
# V1_0_1__define_procedures.sql and the helpers from sql/_assert.sql. The procedures read
# DATABASE(), which is the database they live in, so they must be created in the scratch database.
# Needs the `db` service of docker-compose.test.yml running (`docker compose ... up -d --wait db`).
#
# Usage: database/test/run-sql-tests.sh [test files...]   (default: all of sql/*.test.sql)

set -euo pipefail
cd "$(dirname "$0")"

PROCEDURES=../../database-migrations/V1_0_1__define_procedures.sql
SCRATCH_DB=proc_test

run_sql() {
  docker compose -f docker-compose.test.yml exec -T db \
    mariadb -uroot -p"${MARIADB_ROOT_PASSWORD:-test}" --batch --skip-column-names
}

if [ "$#" -gt 0 ]; then tests=("$@"); else tests=(sql/*.test.sql); fi

failed=0
for test_file in "${tests[@]}"; do
  echo "# $test_file"
  if ! {
    echo "DROP DATABASE IF EXISTS $SCRATCH_DB; CREATE DATABASE $SCRATCH_DB; USE $SCRATCH_DB;"
    cat "$PROCEDURES"; echo
    cat sql/_assert.sql; echo
    cat "$test_file"; echo
  } | run_sql; then
    echo "not ok - $test_file"
    failed=1
  fi
done

echo "DROP DATABASE IF EXISTS $SCRATCH_DB;" | run_sql
[ "$failed" -eq 0 ] && echo "All SQL tests passed" || echo "SQL tests failed"
exit "$failed"
