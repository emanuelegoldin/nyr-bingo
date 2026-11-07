# Database tests

Tests for the data layer (`nextjs/src/lib/db/`). They call the TypeScript repository functions against a real MariaDB built from the production schema and migrations, and check what ends up in the tables.

Most game rules (for example "an empty cell cannot be completed", spec 06) are enforced in the repositories, not by DB constraints. That is why the tests go through the TS code instead of plain SQL.

## Running them

The tests need a throwaway MariaDB on `127.0.0.1:3307`. It keeps its data in memory and never touches a development or production database.

From `nextjs/`:

```bash
pnpm test:db:up      # start mariadb:11 with 001-schema.sql, then apply every migration with Flyway
pnpm test:db         # run all DB tests once
pnpm test:db:watch   # re-run on save, for the TDD loop
pnpm test:db:down    # stop and delete the test DB
```

The test DB can stay up between runs: every test is rolled back, so the tables are empty again after each run. Run `test:db:down` and `test:db:up` again after adding a migration.

The connection settings come from `TEST_DB_HOST`, `TEST_DB_PORT`, `TEST_DB_USER`, `TEST_DB_PASSWORD` and `TEST_DB_NAME` (default `127.0.0.1`, `3307`, `root`, `test`, `resolution_bingo`). The `DB_*` variables of the app are deliberately not read.

On a machine without Node, run Vitest in a container from `nextjs/`:

```bash
docker run --rm --network host -u $(id -u):$(id -g) -e HOME=/tmp \
  -v "$PWD":/workspaces/studio/nextjs -w /workspaces/studio/nextjs \
  node:22-slim node node_modules/vitest/vitest.mjs run
```

In CI the tests run in `.github/workflows/db-tests.yml`. They gate the release images in `main.yml`, and can be started by hand on any branch from the Actions tab ("db-tests", "Run workflow").

## How it works

| File | Role |
|---|---|
| `database/test/docker-compose.test.yml` | The test DB and the one-shot Flyway migration |
| `nextjs/vitest.config.mts` | The `db` project runs `tests/db/**/*.test.ts`, one file at a time |
| `nextjs/tests/support/db/setup.ts` | Replaces `@/lib/db/connection` with the test connection; starts a transaction before each test and rolls it back after |
| `nextjs/tests/support/db/test-connection.ts` | One pinned connection per file; `withTransaction` becomes a savepoint inside the test's transaction |
| `nextjs/tests/support/db/fixtures.ts` | Builders that insert the toy data a test needs |
| `nextjs/tests/support/db/schema.ts` | `getColumns(table)` for structure tests |
| `nextjs/tests/support/db/rows.ts` | `countRows(table, where, params)` to check what a call kept or removed |

Because every repository reaches the DB through `lib/db/connection`, the whole data layer runs on the test's transaction without any change to production code. Each test starts from an empty database.

## Writing a test

One folder per area and one file per aspect: `nextjs/tests/db/<area>/<aspect>.test.ts` (for example `db/reviews/votes.test.ts`). Setups and direct table reads shared by an area live in `db/<area>/helpers.ts`. Inside a file, one `describe` per concern:

- `structure`: the table's columns (`getColumns`), compared in full so that a schema change must update the test.
- `operations`: a repository call that should succeed; check the return value and the stored row.
- `rejects`: a call the rules forbid; check the error and that the stored row did not change.

Every test follows Arrange-Act-Assert, with the three parts marked:

```ts
it('completing an empty cell (06-bingo-gameplay.md – Non-Checkable Cells)', async () => {
  // Arrange
  const { card } = await createPlayingCard([{ source: 'empty' }]);
  const [cellId] = card.cellIds;

  // Act
  const result = await updateCellState(cellId, CellState.COMPLETED);

  // Assert
  expect(result).toEqual({ success: false, error: 'Empty cells cannot be marked as completed' });
  expect((await readCell(cellId)).state).toBe(CellState.PENDING);
});
```

- **Arrange** inserts data with the fixture builders. Add a builder to `fixtures.ts` rather than writing raw inserts in a test.
- **Act** makes one call to the code under test.
- **Assert** checks the result and reads the table directly with `query`, not through the repository under test.
- Tests with nothing to arrange (structure tests) mark only `// Act` and `// Assert`.
- Cite the spec rule in the test title. Test only rules the spec states; if the code enforces a rule the spec does not mention, report it instead.
- Start new files with the usual header docblock (purpose and `Spec Reference`).

## TDD loop

1. Write or change the test for the feature or the bug, citing the spec.
2. Run `pnpm test:db` and see it fail for the expected reason.
3. Change the code until it passes, then run the whole suite.

For a bug fix, the failing test is the reproduction: commit it together with the fix.

## Limits

- `AUTO_INCREMENT` counters are not rolled back. Do not assert on numeric ids.
- A statement that runs DDL (`CREATE`, `ALTER`, ...) commits implicitly and would break isolation. No repository does this today.
- Code that opens its own connection outside `lib/db/connection` would escape the transaction. Keep all DB access in that module.
- Test files run one after another (`fileParallelism: false`), because they share one database.
