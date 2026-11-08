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

## 5.2.0 - Prepared Resolutions

Adds a shared pool of ready-made resolutions (spec 17).

### Schema changes

- New table `prepared_resolutions`: `id`, `category` (`short`, `medium`, `long`),
  `resolution_type`, `title`, `description`, `subtasks`, `number_of_repetition` and
  `created_at`, with an index on `category`.
- `resolutions.scope`: adds `prepared`.
- `bingo_cells.source_type`: adds `prepared`.

### Data migration

None. Existing rows keep their scope and source type.

### Design notes

- The pool is a separate table because its rows have no owner and no progress. Everything
  users receive from it is a copy in `resolutions`.
- `prepared` is a scope of its own because a copy on a card belongs to one game and must not
  appear in its owner's personal resolutions.
- The pool has no foreign keys: nothing references it, so a copy survives if its entry is
  removed.
- `is_empty` is unaffected: it only compares `source_type` to `'empty'`.

### Idempotency

`CREATE TABLE IF NOT EXISTS` skips an existing table, and `MODIFY COLUMN` sets each column to
the same definition on a second run, so the migration can run again.

## 5.2.1 - Seed Prepared Resolutions

Fills the pool created in 5.2.0 (spec 17).

### Data migration

Inserts 60 entries, 20 per category, mixing the `base`, `compound` and `iterative` types. The
text is in English only.

### Design notes

- `long` and `medium` together hold more than the 23 cells a card could need from them, so a
  card only gets `empty` cells when duplicates or a very short pool get in the way.
- The pool has no admin interface. Later changes to it are new migrations.
- Ids are readable slugs such as `prepared-short-01`, which fit the `VARCHAR(36)` column.

### Idempotency

Ids are fixed, and `INSERT IGNORE` skips ids already present, so the migration can run again.

## 5.3.0 - Failed Cell State

Adds the `failed` cell state (spec 06).

### Schema changes

`bingo_cells.state` gains the `failed` value. It goes last in the enum, so existing rows keep
their state.

### Idempotency

`MODIFY COLUMN` sets the column to the same definition on a second run, so the migration can
run again.

## 5.4.0 - Game Archive

Adds read-only snapshots of finished games (spec 18).

### Schema changes

Four new tables, each cascading from the one before it:

- `archived_games`: one row per game, keyed by the id the game had.
- `archived_game_players`: who can view the game, and each player's final leaderboard line.
- `archived_cells`: the cells of each card, without the implicit Joker.
- `archived_cell_subtasks`: the subtasks of `compound` cells.

### Data migration

None in SQL. The server's sweep archives every game in `ended` status at startup, then deletes
it with its cards, cells, leaderboard rows, closed threads and game resolutions. Games with no
`ended_at` use `updated_at` as their end date.

### Design notes

- The tables hold plain values and have no foreign key to `games`, `teams` or `resolutions`, so an
  archived game outlives all of them.
- `source_user_id` has no foreign key: it only links to a profile.

### Idempotency

`CREATE TABLE IF NOT EXISTS` skips a table that already exists, so the migration can run again.

## 5.5.0 - Notifications

Stores team events, their recipients and each user's notification setting (spec 19).

### Schema changes

Three new tables:

- `notification_events`: one row per event. Pending while `published_at` is `NULL`.
- `notification_recipients`: one row per notification received, with its read state.
- `notification_settings`: one row per user who changed the setting. No row means on.

### Data migration

None. Existing users have notifications on.

### Design notes

- `team_id`, `game_id` and `cell_id` have no foreign key, and team and game names are plain values:
  archiving deletes a game right after it ends, and a notification must outlive it.
- A pending `card_progress` event has one row per cell, so cancelling is a plain delete.
- Only the type is stored, never text, so the browser can translate it.

### Idempotency

`CREATE TABLE IF NOT EXISTS` skips a table that already exists, so the migration can run again.

## 5.6.0 - Game Players

Gives each game an explicit roster, so a leader chooses who plays and a player can leave (spec 16).

### Schema changes

- New table `game_players`, keyed by `(game_id, user_id)`, cascading from `games` and `users`.

### Data migration

Every existing game gets its team's current members as players, with their team join date.

### Design notes

- Every player is a team member, but not every member is a player: a member may be left out of a new
  game, or leave one. Leaving the team leaves its games, so no player outlives their membership.
- A user who joins a team is added to each running game, which keeps the existing "join after start"
  rule.

### Idempotency

`CREATE TABLE IF NOT EXISTS` skips the table and `INSERT IGNORE` skips existing rows, so the migration
can run again.

## 5.7.0 - Multiple Team Leaders

Lets a team have several leaders (specs 04 and 18).

### Schema changes

- `teams.leader_user_id` is dropped, with its foreign key. The leaders are the memberships with
  `role = 'leader'`.
- `archived_game_players.is_leader` (`TINYINT(1)`, default `0`) replaces `archived_games.leader_user_id`,
  which is dropped.

### Data migration

- Each team's `leader_user_id` membership gets `role = 'leader'`. Teams created by the app already have
  it.
- Each archived game flags its former `leader_user_id` player as a leader.

### Idempotency

The steps that read a column to be dropped are skipped once it is gone, and `Create_Column` and
`Drop_Column` do nothing when the column already exists or is already gone. The dropped columns are
read before they are dropped, so the migration can run again after a partial failure.

## 5.8.0 - Card Lock

Lets a card owner shuffle their card until they lock it (spec 22).

### Schema changes

- `bingo_cards.locked_at` (`DATETIME`, nullable) is the time the card was locked. It is `NULL` while the
  card can be shuffled.

### Data migration

None: every existing card starts unlocked.

### Idempotency

`Create_Column` does nothing when the column already exists, so the migration can run again.

## 5.9.0 - Cell Resolution Snapshot

A resolution becomes a definition only, and every card cell holds a copy of it with its own progress
(specs 03, 05, 06 and 13). The same resolution can now be completed in one game and pending in another.

### Schema changes

- `bingo_cells` gets `title` (`VARCHAR(255)`, nullable), `description` (`TEXT`, nullable),
  `number_of_repetition` (`INT`, nullable) and `completed_times` (`INT`, default `0`). With the existing
  `resolution_type`, they are the cell's copy of its resolution and its iterative progress.
- New table `bingo_cell_subtasks`, keyed by `(cell_id, subtask_index)` and cascading from `bingo_cells`.
  It holds each subtask of a compound cell (`title`, `description`) and whether it is `completed`.
  `subtask_index` is 0-based.
- New table `cell_history_entries` replaces `resolution_history_entries`. It has the same columns, with
  `cell_id` (cascading from `bingo_cells`) in place of `resolution_id`, and indexes on
  `(cell_id, created_at)` and `(author_user_id, created_at)`.
- `bingo_cells.is_empty` is redefined as `source_type = 'empty'`. `resolution_id` is now only a link to
  the resolution the cell was copied from, so it no longer decides whether a cell is empty.
- `resolutions.scope` loses the `prepared` value.
- `resolutions.completed_times` and the `resolution_history_entries` table are dropped.

### Data migration

- Every cell with a resolution gets that resolution's title, description, type and target. It also gets
  the resolution's current progress: `completed_times` and the subtasks with their `completed` flags.
  Progress used to be shared, so every cell of a resolution starts from the same value.
- Every history entry is copied to each cell that showed its resolution. Entries of a resolution that is
  on no card are dropped, because history now belongs to cells.
- Cells of prepared fallbacks lose their `resolution_id`, and the per-cell `prepared` resolution rows are
  deleted. The cells keep their copy.
- The `completed` flag is removed from every subtask in `resolutions.subtasks` and `prepared_resolutions.subtasks`.
  The order is kept.

### Design notes

- Snapshot, no propagation: editing or deleting a resolution no longer changes the cards that were filled
  with it. A cell whose resolution is deleted keeps its copy, because `resolution_id` is `ON DELETE SET
  NULL`.
- Cells whose resolution had been deleted before this migration have no copy to take, so they keep a
  `NULL` title, as they had no content before.
- The cell subtasks are rows rather than JSON, like `archived_cell_subtasks`.

### Idempotency

- The steps that read `resolutions.completed_times` or `resolution_history_entries` are skipped once
  those are gone, and both are dropped last.
- Subtasks are inserted with `INSERT IGNORE`, and history copies skip an entry the cell already has.
- `Create_Column`, `CREATE TABLE IF NOT EXISTS`, `Drop_Column` and `Drop_Table` do nothing on a second
  run. Rebuilding the subtask lists gives the same lists again.
- The migration can therefore run again, including after a partial failure.

## 5.10.0 - Game Grid Size

Lets the admin choose a 3×3, 5×5 or 9×9 card size when creating a game (spec 16).

### Schema changes

- `games.grid_size` (`TINYINT`, not null, default `5`) is the size of every card of the game. It is set
  at creation and never changed. The route that creates games accepts only `3`, `5` and `9`.
- `archived_games.grid_size` (`TINYINT`, not null, default `5`) keeps the size in the archive (spec 18).
- `bingo_cards.grid_size` already existed; a card now takes its game's size instead of always `5`.

### Data migration

None: the defaults give existing and archived games their 5×5 size.

### Idempotency

`Create_Column` does nothing when the column already exists, so the migration can run again.

## 5.11.0 - Archived Threads

Closing a review thread keeps its messages and files: the thread becomes a read-only archived thread
(spec 07), and archived games keep their threads (spec 18).

### Schema changes

- `review_threads.outcome` (`ENUM('accomplished', 'pending')`, nullable) is the state the thread's cell
  took when it closed.
- `archived_threads` holds a game's closed threads once it is archived. Its `id` is the thread's former
  id, and `(archived_game_id, user_id, position)` references the archived cell, `ON DELETE CASCADE`. It
  keeps `created_at`, `closed_at`, `outcome` and the `accept_votes` and `deny_votes` counts.
- `archived_thread_messages` keeps each message's `author_name`, `content` and `created_at`.
- `archived_thread_files` keeps each file's `file_path`, `file_name`, `file_size`, `mime_type` and
  `created_at`. Both cascade from `archived_threads`.
- The archive tables have no foreign key to `users`, `games` or `review_threads` (spec 18 Independence).

### Data migration

None. Threads closed before this migration have a `NULL` outcome and no messages or files left.

### Idempotency

`Create_Column` and `CREATE TABLE IF NOT EXISTS` do nothing on a second run.

## 5.12.0 - Leaderboard Progress

Games record when bingo started, and every change of a player's completed count is logged, so the
Progress tab can chart it over time (spec 23). Archived games keep both (spec 18).

### Schema changes

- `games.started_at` (`DATETIME`, nullable) is set when bingo starts (spec 16).
- `archived_games.started_at` (`DATETIME`, nullable) is copied from the game when it is archived.
- `leaderboard_progress` holds one row per change of a player's completed count: `game_id`
  (FK → `games`), `user_id` (FK → `users`), `recorded_at` and `completed_tasks`, both foreign keys
  `ON DELETE CASCADE`, with an index on `(game_id, recorded_at)`.
- `archived_progress` holds the same values for an archived game. `(archived_game_id, user_id)`
  references `archived_game_players`, `ON DELETE CASCADE`.

### Data migration

- `games.started_at` of every `started` or `ended` game is set to the creation time of its earliest
  bingo card.
- Every leaderboard row of a `started` or `ended` game gets a `0` point at the creation time of the
  player's card, then one point per cell now `completed` or `accomplished`, ordered by the cell's
  `updated_at`, holding the running count. Completions that were later undone are not recovered.
- Games already archived get no `started_at` and no progress points.

### Idempotency

`Create_Column` and `CREATE TABLE IF NOT EXISTS` do nothing on a second run. `started_at` is only
set where it is `NULL`, the `0` points only for players with no point, and the running counts only
for players whose only point is that `0`.

## 5.13.0 - Cell Reactions

Players can put one emoji reaction on each of a teammate's completed or accomplished cells, at a
random spot the server picks. Archived games keep them (spec 24).

### Schema changes

- `cell_reactions` holds one row per player per cell: `cell_id` (FK → `bingo_cells`), `user_id`
  (FK → `users`), `reaction` (an id from the pool), `pos_x` and `pos_y` (the reaction's center, in
  percent of the cell), `created_at` and `updated_at`. Primary key `(cell_id, user_id)`, both
  foreign keys `ON DELETE CASCADE`.
- `archived_cell_reactions` holds the same values for an archived cell, with the reacting player
  as `reactor_user_id` (no foreign key). `(archived_game_id, user_id, position)` references
  `archived_cells`, `ON DELETE CASCADE`.

### Data migration

None. Existing cells start with no reaction.

### Idempotency

`CREATE TABLE IF NOT EXISTS` does nothing on a second run.

## 5.13.1 - Reaction Tilt and Scale

Each cell reaction also gets a random tilt and size, picked again every time it is placed, as its
spot already was. Archived games keep them (spec 24).

### Schema changes

- `cell_reactions` and `archived_cell_reactions` get `rotation` (`TINYINT`, degrees between -45
  and 45, default `0`) and `scale` (`TINYINT UNSIGNED`, percent of the base size between 75 and
  125, default `100`).

### Data migration

None. Reactions stored before it take the defaults, so they show untilted at the base size.

### Idempotency

`Create_Column` does nothing on a second run.

## 5.14.0 - Game Preparation Phase

A forming game is now a preparation phase with a fixed deadline: players write their own resolutions
for the game, write resolutions for each other and mark themselves ready, and the game starts when
everyone is ready or the deadline passes. Personal resolutions belong to a game; the ones without a
game are legacy rows, kept read-only on `/resolutions` until 2027-05-08 (specs 16 and 03).

### Schema changes

- `games.preparation_deadline` (`DATETIME`, nullable, UTC): the end of the preparation phase. Set at
  creation and never changed.
- `game_players.ready_at` (`DATETIME`, nullable): when the player marked themselves ready.
- `resolutions` is unchanged. A game-bound personal resolution is a `scope = 'personal'` row with
  `game_id` and `team_id` set; a legacy one has `game_id IS NULL`.

### Data migration

- Games already `forming` get `preparation_deadline = UTC_TIMESTAMP() + 7 days`. Started and ended
  games keep `NULL`.
- For every `started` game, each `personal` cell of a card is copied into a `personal` resolution of
  that game, owned by the card owner, from the cell's snapshot (title, description, type, target, and
  subtasks from `bingo_cell_subtasks`). The new row takes the cell's id, and the cell's
  `resolution_id` is pointed at it. The legacy row the cell came from is not changed.
- For every `started` game, a `member_provided` cell whose source row was deleted
  (`resolution_id IS NULL`) is recreated the same way as a `member_provided` resolution from its
  author to the card owner, if the author still plays the game and has no resolution for that player
  yet. Existing member-provided rows are already game-bound and are left as they are.

So the Personal and Teammates tabs of games started before the change show what is on their cards.

### Idempotency

- `Create_Column` does nothing on a second run.
- The preparation deadline is only set where it is `NULL`.
- The backfill inserts a row only when no row with the cell's id exists (`NOT EXISTS`, and
  `INSERT IGNORE` on the member-provided unique key), and the final `UPDATE` only changes cells not
  yet linked to it.

Checked by hand on `mariadb:11`: a started game with personal base, compound (two subtasks) and
iterative cells, a member-provided cell whose source was deleted, empty and prepared cells, plus a
forming and an ended game. Running the migration twice gave the same rows and links.
