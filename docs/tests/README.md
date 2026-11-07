# Tests

The automated tests are split into layers. Each layer has its own folder, its own command and its own CI job, so the layers run in parallel.

| Layer | Folder | What it checks | Needs |
|---|---|---|---|
| Unit | `nextjs/tests/unit/<area>/` | Pure functions: bingo lines, grid, permissions matrix, progress buckets, i18n keys, themes, room tokens | Nothing |
| DB | `nextjs/tests/db/<area>/` | Repository functions (`src/lib/db/`) against the real schema | Test MariaDB with migrations |
| Route | `nextjs/tests/api/<area>/` | API route handlers: status codes, validation, who may call them | Test MariaDB with migrations |
| WebSocket | `ws-server/tests/` | Notify endpoint, rooms, origin check, rate and size limits | Nothing (starts a server on a free port) |
| SQL | `database/test/sql/` | The migration helper procedures of `V1_0_1__define_procedures.sql` | Test MariaDB, no migrations |
| E2E | `nextjs/tests/e2e/` | Playwright browser tests | A built app (`main.yml`, not part of `tests.yml`) |

`docs/tests/ui/` holds manual UI test descriptions.

## Running them

From `nextjs/`:

```bash
pnpm test:unit       # unit tests, no database
pnpm test:db:up      # start mariadb:11 with 001-schema.sql, then apply every migration with Flyway
pnpm test:db         # DB tests
pnpm test:db:watch   # re-run the DB tests on save, for the TDD loop
pnpm test:api        # route tests (same database)
pnpm test            # unit, then DB, then route tests
pnpm test:db:down    # stop and delete the test DB
```

From `ws-server/`:

```bash
pnpm test            # WebSocket server tests
```

From the repository root, with the test DB running (`pnpm test:db:up`, or only `docker compose -f database/test/docker-compose.test.yml up -d --wait db`):

```bash
database/test/run-sql-tests.sh                          # all SQL tests
database/test/run-sql-tests.sh sql/create_column.test.sql   # one file (path relative to database/test)
```

The test DB listens on `127.0.0.1:3307`, keeps its data in memory and never touches a development or production database. It can stay up between runs: every DB and route test is rolled back. Run `test:db:down` and `test:db:up` again after adding a migration.

The connection settings come from `TEST_DB_HOST`, `TEST_DB_PORT`, `TEST_DB_USER`, `TEST_DB_PASSWORD` and `TEST_DB_NAME` (default `127.0.0.1`, `3307`, `root`, `test`, `resolution_bingo`). The `DB_*` variables of the app are deliberately not read.

On a machine without Node, run Vitest in a container from `nextjs/`:

```bash
docker run --rm --network host -u $(id -u):$(id -g) -e HOME=/tmp \
  -v "$PWD":/workspaces/studio/nextjs -w /workspaces/studio/nextjs \
  node:22-slim node node_modules/vitest/vitest.mjs run --project unit
```

The same works from `ws-server/` (mount it on `/app` and run `node node_modules/vitest/vitest.mjs run`).

## CI

`.github/workflows/tests.yml` runs one job per layer: `nextjs-unit`, `nextjs-db` and `nextjs-api` (a matrix, each with its own database), `ws-server` and `sql-procedures`. It runs on pull requests and pushes to `dev`, gates the release images in `main.yml`, and can be started by hand from the Actions tab ("tests", "Run workflow"). The Node.js jobs share the local composite action `.github/actions/setup-node-pnpm`.

## Writing a test

### Common rules

- One folder per area and one file per aspect, for example `tests/db/reviews/votes.test.ts`. Setups shared by an area live in `<area>/helpers.ts`.
- Mark `// Arrange`, `// Act` and `// Assert` in every test. The Act is one call to the code under test. A test with nothing to arrange marks only `// Act` and `// Assert`.
- Cite the spec rule in the test title, for example `(06-bingo-gameplay.md – Non-Checkable Cells)`. Test only rules the spec states; if the code enforces a rule the spec does not mention, report it instead.
- If a new test fails against the current code, do not bend the test: report the case (spec gap or bug).
- Do not test random behaviour (for example the card shuffle).
- Start new files with the usual header docblock (purpose and `Spec Reference`).

### Unit tests

Pure functions only: no database, no `next/headers`. They run in parallel.

### DB tests

They call the TypeScript repository functions against a real MariaDB and check what ends up in the tables. Most game rules are enforced in the repositories, not by DB constraints, which is why the tests go through the TS code.

| File | Role |
|---|---|
| `database/test/docker-compose.test.yml` | The test DB and the one-shot Flyway migration |
| `nextjs/vitest.config.mts` | Projects `unit`, `db` and `api`; `db` and `api` run one file at a time |
| `nextjs/tests/support/db/setup.ts` | Replaces `@/lib/db/connection` with the test connection; starts a transaction before each test and rolls it back after |
| `nextjs/tests/support/db/test-connection.ts` | One pinned connection per file; `withTransaction` becomes a savepoint inside the test's transaction |
| `nextjs/tests/support/db/fixtures.ts` | Builders that insert the toy data a test needs |
| `nextjs/tests/support/db/schema.ts` | `getColumns(table)` for structure tests |
| `nextjs/tests/support/db/rows.ts` | `countRows(table, where, params)` to check what a call kept or removed |

Inside a file, one `describe` per concern:

- `structure`: the table's columns (`getColumns`), compared in full so that a schema change must update the test.
- `operations`: a repository call that should succeed; check the return value and the stored row.
- `rejects`: a call the rules forbid; check the error and that the stored row did not change.

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
- **Assert** reads the table directly with `query`, not through the repository under test.

### Route tests

Route handlers run unchanged, on the same rolled-back transaction as the DB tests.

| File | Role |
|---|---|
| `nextjs/tests/support/api/setup.ts` | Loads the DB setup; replaces `next/headers` with an in-memory cookie jar and `@/lib/email` with a stub; unsets `WS_SHARED_SECRET`, so real-time signals are skipped |
| `nextjs/tests/support/api/session.ts` | `signInAs(user)` creates a real session and stores its token in the jar; `signOut()` |
| `nextjs/tests/support/api/call-route.ts` | `callRoute(handler, { method, body, params, search })` builds the `NextRequest` and returns `{ status, body }` |

```ts
it('a member inviting, with 403 (21-authorization.md – Permission Table)', async () => {
  // Arrange
  const [admin, member] = [await createUser(), await createUser()];
  const team = await createTeam(admin);
  await addMember(team, member);
  await signInAs(member);

  // Act
  const result = await callRoute(invite, { method: 'POST', body: {}, params: { teamId: team.id } });

  // Assert
  expect(result.status).toBe(403);
  expect(await countRows('team_invitations', 'team_id = ?', [team.id])).toBe(0);
});
```

### WebSocket server tests

`ws-server/create-server.ts` builds the server; `server.ts` only reads the environment and calls it. Tests start a server on port 0 with a test secret and connect real clients (`ws-server/tests/support.ts`: `startServer`, `signToken`, `connect`, `notify`). To check that a socket hears nothing, also notify a control room and wait for that message.

### SQL tests

`database/test/run-sql-tests.sh` gives each `sql/*.test.sql` file a fresh scratch database `proc_test`, loads the procedures and the helpers of `sql/_assert.sql` into it, then runs the file. The procedures read `DATABASE()`, so they must live in the database they change. Each test is one `BEGIN NOT ATOMIC ... END$$` block:

```sql
BEGIN NOT ATOMIC
    DECLARE v_caught INT DEFAULT 0;
    DECLARE CONTINUE HANDLER FOR SQLSTATE '45000' SET v_caught = 1;
    -- Arrange
    CREATE TABLE cc_no_ref_table (id INT);

    -- Act
    CALL Create_Column('cc_no_ref_table', 'parent_id', 'INT', 1, NULL, NULL, 'cc_parentID', NULL);

    -- Assert
    CALL assert_equals('Create_Column: referenced column without table signals 45000', '1', v_caught);
END$$
```

`assert_equals(label, expected, actual)` prints `ok - <label>`, or signals SQLSTATE `45001` (never caught by a test's `45000` handler), which stops the file and fails the run. Use a table name prefix per test, since the tests of a file share the scratch database. Do not name a helper `column_*` after MariaDB's built-in dynamic-column functions (`COLUMN_EXISTS` and others).

## TDD loop

1. Write or change the test for the feature or the bug, citing the spec.
2. Run the layer's command and see it fail for the expected reason.
3. Change the code until it passes, then run the whole layer.

For a bug fix, the failing test is the reproduction: commit it together with the fix.

## Limits

- `AUTO_INCREMENT` counters are not rolled back. Do not assert on numeric ids.
- A statement that runs DDL (`CREATE`, `ALTER`, ...) commits implicitly and would break isolation. No repository does this today.
- Code that opens its own connection outside `lib/db/connection` would escape the transaction. Keep all DB access in that module.
- DB and route test files run one after another (`fileParallelism: false`), because they share one database.
- The host and the test DB can be in different time zones. Set expiries with SQL (`NOW() - INTERVAL ...`) and avoid exact duration asserts.
- React components are not unit-tested: that would need jsdom and Testing Library, which are not dependencies yet.
