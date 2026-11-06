# 23 — Progress Chart

## Purpose

Show how a game has moved over time. The leaderboard (spec 12) only holds each player's current count of completed resolutions; the **Progress** tab shows how that count changed, day by day or month by month, for every player of the game.

---

## User Stories Covered

- See, for each player, how many resolutions they had completed on each day or month of the game.
- Tell players apart by colour.
- Highlight one or more players to compare them.
- See the progress of a finished game in the archive.

---

## In Scope

- A **Progress** tab on the game page (spec 12) and the archived game page (spec 18)
- A per-player history of the completed-resolution count, stored in the database
- Copying that history into the archive when a game is archived
- Rebuilding a history for games that were already started when this feature shipped

## Out of Scope

- Progress of a single cell (the cell history of spec 13 covers that)
- Other measures than the completed count (bingo lines, failed cells, typed progress)
- Exporting the chart or its data

---

## Definitions

- **Completed count**: the `completed_tasks` value of spec 12, the number of a player's cells in state `completed` or `accomplished`.
- **Progress point**: one stored value of a player's completed count, with the time it took that value.
- **Start of the chart**: the time the game started (`games.started_at`, spec 16; `archived_games.started_at` for an archived game). When that is `NULL`, the time of the game's earliest progress point.
- **End of the chart**: now, for a running game; the end date (`ended_at`), for an archived game.

---

## Functional Requirements

### 1) Recording Progress

- A progress point is stored each time a player's completed count changes. Every change of the count goes through the leaderboard refresh of spec 12 (When rows are written), and the point is written there, with the time of the refresh.
- When the refresh finds the same count as before, nothing is stored.
- When a game starts, every player gets a point with the value `0`, at the start time. A player who joins late gets a point when their leaderboard row is first written.
- Points are never edited. Deleting the game deletes them.

### 2) Archiving

- When a game is archived (spec 18), its progress points and its `started_at` are copied into the archive in the same transaction, as plain values.
- They are deleted with the game, like its leaderboard rows.
- They belong to the archived game's players: a point of a user who is not one of them is not copied.

### 3) Progress Tab

- The tab is the last tab of the game page and of the archived game page, after **Threads**.
- A game in `forming` status shows a placeholder message instead of the chart.
- A game with no progress point shows the same placeholder.
- The tab holds a chart and, under it, a legend.
- The data is loaded on the server with the page; there is no progress API. On the game page the tab re-renders on `refresh-card` and on catch-up, like the leaderboard (spec 11, spec 12). The archived game page does not update.

### 4) Chart

- One line per player of the leaderboard (spec 12; for an archived game, the players who have a leaderboard rank, spec 18).
- The horizontal axis is time, from the start to the end of the chart. The vertical axis is the completed count, starting at `0`, with whole-number ticks only.
- A **Day / Month** toggle above the chart chooses the step of the time axis. **Day** is selected by default.
  - **Day**: one value per calendar day.
  - **Month**: one value per calendar month.
- The value of a player for a day or a month is their completed count at the end of it, or at the end of the chart for the day or month that contains it. A day or month without a point carries the value from before it. Before a player's first point, their value is `0`.
- Days and months are the viewer's local calendar days and months.
- The lines are drawn as steps: a value holds until the next day or month.
- Hovering or tapping a day or month shows a tooltip with its date and each player's value, sorted from highest to lowest.

### 5) Colours and Legend

- Each player has a colour from a fixed categorical palette, assigned in leaderboard order. The palette works in light and dark themes. The palette has eight colours: from the ninth player on, the colours repeat in order, and those players' lines are dashed, so no two players share the same line.
- The legend under the chart lists every player with their colour and their name: display name if `displayNamePublic` is true, otherwise username (as in spec 12).
- Clicking a name in the legend toggles that player's highlight. Several players can be highlighted at once.
- While at least one player is highlighted, the highlighted lines are drawn thicker and the others are dimmed. With nobody highlighted, every line is drawn normally.
- The highlight is kept while the tab re-renders on an update, and is lost when the page is left. It is not stored.

### 6) Layout

- The chart fills the width of the tab and keeps a fixed height. It fits a mobile screen without horizontal scrolling (spec 20).
- The legend wraps onto as many lines as it needs.

---

## Permissions

The role-to-permission table and the status of every refusal are defined in spec 21 (Authorization).

- The tab is part of the game page and the archived game page, and is shown to the players who can view that page. It adds no rule of its own.

---

## Data Model

### `leaderboard_progress`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | BIGINT | Auto-increment primary key |
| `game_id` | VARCHAR(36) | FK → `games.id` ON DELETE CASCADE |
| `user_id` | VARCHAR(36) | FK → `users.id` ON DELETE CASCADE |
| `recorded_at` | DATETIME | When the count took this value |
| `completed_tasks` | INT | The completed count from then on |

- Index on `(game_id, recorded_at)`.

### `archived_progress`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | BIGINT | Auto-increment primary key |
| `archived_game_id` | VARCHAR(36) | With `user_id`, FK → `archived_game_players` ON DELETE CASCADE |
| `user_id` | VARCHAR(36) | |
| `recorded_at` | DATETIME | |
| `completed_tasks` | INT | |

### `games.started_at` and `archived_games.started_at`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `started_at` | DATETIME | NULL until bingo starts (spec 16). In the archive, NULL for games archived before the migration |

### Migration

`V5_12_0__leaderboard_progress.sql` adds `started_at` to `games` and `archived_games`, creates both tables, sets `games.started_at` as described in spec 16, and rebuilds a history for every leaderboard row of a `started` or `ended` game:

- A point with value `0` at the time the player's card was created.
- Then one point for each of the player's cells now in state `completed` or `accomplished`, ordered by the cell's `updated_at`, whose value is the running count of those cells.

Games archived before the migration get no progress points.

---

## Acceptance Criteria

- [ ] Game page and archived game page show a last tab, **Progress**, after Threads.
- [ ] Starting a game sets `started_at`; the chart starts there.
- [ ] A `forming` game, or a game with no progress point, shows a placeholder in the tab.
- [ ] Completing, undoing, failing, requesting proof on and reviewing a cell stores a point only when the completed count changes.
- [ ] Starting a game stores a `0` point for every player.
- [ ] The chart shows one line per player, from the start of the game to now or to its end date.
- [ ] The Day / Month toggle switches the time axis, with Day selected by default, and values carry forward over days or months without changes.
- [ ] Each player has their own colour, shown in the legend under the chart with their name.
- [ ] Clicking names in the legend highlights those players and dims the others; clicking again removes the highlight.
- [ ] The tooltip shows the date and each player's value.
- [ ] The tab updates without a page reload when a card change is signalled.
- [ ] An archived game shows the progress it had when it ended, and deleting it deletes its progress.
- [ ] Games started before the migration show a history rebuilt from their cells.
- [ ] The tab fits a mobile screen without horizontal scrolling.

---

## Known Gaps

- The history rebuilt by the migration only holds the cells completed at the time of the migration, at their last change. A completion that was later undone, and the times of earlier changes to a cell, are lost.
- Games archived before the migration have no progress history: their Progress tab shows the placeholder.
