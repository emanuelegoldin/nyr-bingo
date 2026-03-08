## 2.0.2 - is_empty as Generated Column

A generated column allow us to ensure that the _is\_empty_ column of the _bingo\_cells_ table remains consistent upon insert and update operations.

- BOOL and BOOLEAN are synonims for TINYINT(1) in MariaDB
- A VIRTUAL generated column is not stored in the database; its value is computed only when necessary; a PERSISTENT generated column is stored as any regular column in the database.

## 2.0.3 - team_leaderboard Table

Adds a `team_leaderboard` table that persists per-user, per-team leaderboard
stats (`first_bingo_at`, `completed_tasks`) so the leaderboard API can read
directly from the table instead of computing values on every request.

- Unique key on `(user_id, team_id)`.
- Foreign keys to `users` and `teams` with `ON DELETE CASCADE`.
- Rows are bulk-initialized when a game starts and upserted on every cell state
  change.

## 2.0.4 - Fix is_empty Excludes Team Cells

Corrects the `is_empty` virtual generated column on `bingo_cells`.

The previous expression `(resolution_id IS NULL AND team_provided_resolution_id IS NULL)`
incorrectly flagged the team-goal cell as empty because it carries no FK to
either `resolutions` or `team_provided_resolutions` — it resolves its text
from `teams.team_resolution_text` via a JOIN at read time.

New expression: `(resolution_id IS NULL AND team_provided_resolution_id IS NULL AND source_type = 'empty')`

This ensures only cells explicitly inserted with `source_type = 'empty'` are
considered empty, while team-goal cells render normally.

## 3.0.0 - Resolution Rework: Typed Resolutions

Introduces a typed resolution system supporting three personal resolution
variants: **base**, **compound** (subtask checklist), and **iterative**
(counter-based).

### Schema changes

- `resolutions`: adds `title VARCHAR(255) NOT NULL` column.  Existing rows are
  backfilled by truncating `text` to 255 characters.
- `team_provided_resolutions`: adds `title VARCHAR(255) NOT NULL` column with
  the same backfill strategy.
- New table `compound_resolutions` — stores a JSON array of subtasks.
  Completion is automatic: all subtasks done → COMPLETED.
- New table `iterative_resolutions` — tracks `number_of_repetition` and
  `completed_times`.  Completion is automatic when
  `completed_times >= number_of_repetition`.
- `bingo_cells`: adds `resolution_type ENUM('base','team','compound','iterative')`
  as a polymorphic discriminator.  Existing rows default to `'base'`; cells
  with `source_type = 'team'` are backfilled to `'team'`.

### Design notes

- Compound and iterative resolutions are personal-only (owned by a user).
- `resolution_id` on `bingo_cells` is reused for compound/iterative types;
  because MariaDB foreign keys can only reference a single table, referential
  integrity for compound/iterative is enforced at the application layer.
- The `is_empty` generated column expression is unchanged.

## 3.1.0 - Drop resolution_id FK for Polymorphic Types

Drops the `fk_bingo_cells_resolution_id` foreign key constraint added in V2.0.0.

Since V3.0.0, `bingo_cells.resolution_id` is polymorphic — it can reference
`resolutions`, `compound_resolutions`, or `iterative_resolutions` depending on
the `resolution_type` discriminator column. MariaDB foreign keys can only target
a single table, so the old FK that referenced only `resolutions` must be removed
to allow compound and iterative resolution IDs to be stored in cells.

Referential integrity for compound/iterative types is enforced at the
application layer.

## 3.2.0 - Unified Resolutions Table

Consolidates all resolution types and scopes into a single `resolutions` table.

### Motivation

Previously, resolutions lived across four separate storage locations:
- `resolutions` — personal base resolutions
- `compound_resolutions` — personal compound (subtask) resolutions
- `iterative_resolutions` — personal iterative (counter) resolutions
- `team_provided_resolutions` — member-provided resolutions
- `teams.team_resolution_text` — team goal text (not a proper entity)

This migration unifies them into one `resolutions` table with discriminator
columns `resolution_type` and `scope`, enabling all resolution types (base,
compound, iterative) for all scopes (personal, team goal, member-provided).

### Schema changes

- `resolutions`: adds columns `resolution_type ENUM('base','compound','iterative')`,
  `scope ENUM('personal','team','member_provided')`, `team_id`, `to_user_id`,
  `subtasks JSON`, `number_of_repetition INT`, `completed_times INT`.
  Renames `text` → `description` (TEXT NULL).
- `compound_resolutions` data migrated into `resolutions` with
  `resolution_type='compound', scope='personal'`.
- `iterative_resolutions` data migrated into `resolutions` with
  `resolution_type='iterative', scope='personal'`.
- `team_provided_resolutions` data migrated into `resolutions` with
  `resolution_type='base', scope='member_provided'`.
- Team goal text migrated from `teams.team_resolution_text` to a resolution
  entity with `scope='team'`.
- `bingo_cells`: `team_provided_resolution_id` column dropped; member-provided
  cells now use `resolution_id`. `resolution_type` ENUM shrinks to
  `('base','compound','iterative')` — the `'team'` value is removed since it
  was a scope indicator, not a content type.
- Re-adds FK from `bingo_cells.resolution_id` → `resolutions(id)`.
- Adds unique constraint `unique_member_provided(team_id, owner_user_id, to_user_id)`
  for member-provided resolutions.
- Drops `teams.team_resolution_text` column.
- Drops tables: `compound_resolutions`, `iterative_resolutions`,
  `team_provided_resolutions`.

### Design notes

- `scope='personal'` — user's own resolutions (default).
- `scope='team'` — the team's shared goal resolution, one per team.
- `scope='member_provided'` — a resolution one member creates for another.
- MariaDB allows NULL values in unique constraints without conflict, so the
  `unique_member_provided` constraint only enforces uniqueness for
  member-provided resolutions where `team_id`, `owner_user_id`, and
  `to_user_id` are all non-NULL.