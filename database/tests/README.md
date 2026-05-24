# Database Tests

## Scope

These tests cover MariaDB stored procedures first. App-level database usage tests stay in `nextjs/tests`.

## Source of Truth

- Schema: `nextjs/src/lib/db/schema.ts`
- Procedures: `database-migrations/V1_0_1__define_procedures.sql`

## Assumptions

- Tests run against a disposable database named `${DB_NAME}_test`.
- Each Jest test starts a transaction and rolls it back.
- DDL statements auto-commit in MariaDB, so tests that create tables must clean up explicitly.

## Running Locally

- `pnpm --dir nextjs test:db`

## Running via Docker Compose

- `docker compose --profile test run --rm db-tests`

## Test Structure

Arrange (seed) -> Act (CALL procedure) -> Assert (SELECT + compare) -> Teardown (ROLLBACK)

## Naming

- Stored procedure tests: `database/tests/procedures/*.test.ts`
- Helpers: `database/tests/helpers/*`
