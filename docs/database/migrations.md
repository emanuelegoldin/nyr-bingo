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

## 3.3.0 - Resolution History Entries

Adds a dedicated timeline table for resolution history and progress updates.

### Schema changes

- New table `resolution_history_entries` with immutable entries keyed by
  `resolution_id`.
- Entry model supports both manual notes and automatic system events:
  - `entry_type ENUM('manual_note', 'system_event')`
  - `event_key` (nullable)
  - `content` (required text)
  - `metadata_json` (nullable JSON payload)
- Foreign keys:
  - `resolution_id -> resolutions.id` (`ON DELETE CASCADE`)
  - `author_user_id -> users.id` (`ON DELETE CASCADE`)
- Added indexes for timeline and author queries:
  - `(resolution_id, created_at)`
  - `(author_user_id, created_at)`

### Design notes

- History is stored once per resolution (not per cell), so all surfaces read
  from the same source of truth.
- Entries are append-only and intended for auditability/progress sharing.

## 4.1.0 - Drop Close Threads Event

Drops the `CloseThreadsEvent` event and the `CloseThreads` procedure added in
V4.0.0.

Deadline closure of review threads now runs in the Next.js application, which
can also remove the proof files from disk. The `event_scheduler` setting is no
longer needed.

## 5.0.0 - Separate Games from Teams

Splits the bingo game out of the team. A team becomes a list of users with a
leader, and a team can run several games at once (spec 16).

### Schema changes

- New table `games`: `id`, `team_id`, `name`, `status ENUM('forming','started','ended')`,
  `created_at`, `updated_at`, `ended_at`. Deleting a team cascades to its games.
- `bingo_cards`, `team_leaderboard`: add `game_id VARCHAR(36) NOT NULL`.
- `resolutions`: adds `game_id VARCHAR(36) NULL`, set for `team` and
  `member_provided` scopes and `NULL` for `personal`.
- All three `game_id` columns reference `games(id)` with `ON DELETE CASCADE`.
- Unique keys move from team to game:
  - `bingo_cards`: `unique_card` → `unique_game_card (game_id, user_id)`
  - `team_leaderboard`: `unique_user_team` → `unique_user_game (user_id, game_id)`
  - `resolutions`: `unique_member_provided` →
    `unique_member_provided_game (game_id, owner_user_id, to_user_id)`
- `resolutions` gains the explicit index `idx_resolutions_team (team_id)`.
- Drops `teams.status`. Its value now lives in `games.status`.

### Data migration

Each existing team receives one game that copies the team's `name`, `status`
and `created_at`. Its cards, leaderboard rows, team goal and member-provided
resolutions are linked to that game. Existing teams are never merged, because
nothing records that two teams are the same group of people.

### Design notes

- `team_id` stays on the three tables. Membership checks, real-time room lookup
  and team deletion read it, and a game never moves to another team.
- New keys are added before old ones are dropped. A foreign key can rely on an
  old unique key as its only index: `user_id` on `team_leaderboard` and `team_id`
  on `resolutions`. Dropping those first would fail.
- `teams.status` is dropped last because the game backfill reads it.

### Idempotency

MariaDB DDL cannot be rolled back, so a run that fails halfway leaves its earlier
steps applied. Every step can run again, using `IF [NOT] EXISTS` clauses, the
`Create_Column` and `Drop_Column` procedures, `information_schema` guards on the
foreign keys, and backfills limited to rows still unset.

## 5.1.0 - Game Deadline

Adds an optional deadline to games (spec 16).

### Schema changes

- `games`: adds `deadline DATE NULL`, the last playable day of the game.

### Data migration

None. Existing games keep `deadline = NULL` and still end only manually.

### Design notes

- `DATE` rather than `DATETIME`: the picker selects a day, so there is no time or
  time zone to convert. A game ends once `deadline < CURDATE()`.
- No index: the hourly sweep is the only reader that filters on it.

### Idempotency

`Create_Column` skips a column that already exists, so the migration can run again.
