# 18 — Game Archive

## Purpose

Keep a read-only record of every finished game. An archived game is a snapshot of the final leaderboard and of each player's card. It is stored as plain values, so nothing that happens later to a resolution, a team or a game can change it.

---

## User Stories Covered

- Browse the finished games I took part in
- See the final standings of a game
- Look at each player's final card and open the details of a cell
- Read the game's archived review threads
- See how each player progressed during the game (spec 23)
- Delete a game, or one of its archived threads, from the archive, as an admin who ran it

---

## In Scope

- Archiving a game when it ends, with its archived threads
- Archive page and archived game page
- Deleting an archived game or one of its archived threads

---

## Functional Requirements

### Archiving a Game

Every game that ends is archived, whether it ended manually or at its deadline (spec 16).

- The archive holds, as they were when the game ended:
  - The game name, the team name, the start date, the end date, the card size and the admins who ran the game: its players who were Team Admins when it was archived
  - The leaderboard
  - The card of every player
  - The game's archived review threads (spec 07)
  - The progress history of its players (spec 23)
  - The reactions on its cells, with their emoji and spot (spec 24)
- The **players** of an archived game are the game's players (spec 16) who had a card in it. A member without a card has no access.
- A member-provided cell whose provider was no longer a player is labelled "Former Teammates".
- A cell keeps its position, title, description, type, state, source and source label. The snapshot is taken from the cell's own columns and from `bingo_cell_subtasks` (spec 05) when the game ends. A `compound` cell also keeps its subtasks and an `iterative` cell its counters.
- An archived thread keeps the cell it refers to (its card owner and position), when it was opened and closed, its `outcome`, its accept and deny vote counts, its messages with the author's username and time, and its files' name, link, size and type. The proof files stay on disk.
- A game is archived only once it has no open review thread, so every cell is final.
- Saving the archive and deleting the game happen in one transaction. The game's cards, cells, leaderboard rows, review threads, team goal and member-provided resolutions, and the cells' subtasks and history, are deleted with it.
- A game that could not be archived stays `ended`. The hourly sweep (spec 16) closes its open threads and archives it, so a failure is not reported to the admin. The same step archives games that ended before the archive existed. For those without a stored end date, the game's last update is used.

### Independence

An archived game has no reference to `games`, `teams` or `resolutions`.

- Editing or deleting a resolution does not change it.
- Deleting a team does not delete it (spec 04).
- Later changes to a username or display name do not change it.
- The leaderboard avatars and member-provided cell badges link to the player's current profile. A profile's own content is not part of the archive.

### Reading

- `GET /api/archived-games` lists the archived games the caller took part in, most recently ended first.
- `GET /api/archived-games/[archivedGameId]` returns one archived game with its leaderboard, cards and archived threads, to its players only (`403` otherwise). `404` is returned when it does not exist.

### Archive Page

`/archive` lists the caller's archived games with their name, team and end date, and a link to each. An empty state is shown when there are none.

### Archived Game Page

`/archive/[archivedGameId]` shows an archived game to its players. Others get a not-found page.

The header holds the game name, team name and end date, and a **Delete** button for the admins who ran the game. Below it are the tabs of the game page (spec 12), with **Cards** selected by default:

- **Cards**: the card of every player, in leaderboard order
- **Leaderboard**: the final leaderboard, with the columns and order of spec 12
- **Threads**: the game's archived threads, with the Threads tab of spec 07. The admins who ran the game can delete one.
- **Progress**: the progress chart of spec 23, up to the end date

Cards are read-only. They have no edit mode, real-time updates, confetti, proof actions or resolution history. Selecting a non-empty cell other than the Joker opens its details as plain text: title, description, state, type, source, and the subtasks or counter of a `compound` or `iterative` cell.

### Deleting an Archived Game

`DELETE /api/archived-games/[archivedGameId]`

- Only an admin who ran the game can delete it (`403` otherwise; `404` when it does not exist).
- The UI asks for confirmation.
- Deletion is a **hard delete** and removes the game from the archive of every player.
- Its archived threads, their messages and file rows are deleted with it. Their files are then removed from disk unless another thread or archived thread shares them. A file that cannot be removed is logged and skipped, since the deletion has already happened.

### Deleting an Archived Thread

`DELETE /api/archived-games/[archivedGameId]/threads/[threadId]`

- Only an admin who ran the game can delete one of its archived threads (`403` otherwise; `404` when the game or the thread does not exist).
- The UI asks for confirmation.
- Its files are removed from disk first, under the same sharing rule. If one cannot be removed, the deletion fails and the thread is kept.

---

## Permissions

The role-to-permission table and the status of every refusal are defined in spec 21 (Authorization).

- Only the players of an archived game can view it.
- Only an admin who ran the game can delete it, or delete one of its archived threads.
- Archived games cannot be edited by anyone.

---

## Data Model

| Table | Primary key | Holds |
| ----- | ----------- | ----- |
| `archived_games` | `id`, the game's former id | `name`, `team_name`, `started_at`, `ended_at`, `grid_size` |
| `archived_game_players` | `archived_game_id`, `user_id` | `player_name`, `is_leader`, `leaderboard_rank`, `completed_tasks`, `first_bingo_at` |
| `archived_cells` | `archived_game_id`, `user_id`, `position` | `title`, `description`, `resolution_type`, `state`, `source_type`, `source_user_id`, `source_label`, `is_empty`, `number_of_repetition`, `completed_times` |
| `archived_cell_subtasks` | `archived_game_id`, `user_id`, `position`, `subtask_index` | `title`, `description`, `completed` |
| `archived_cell_reactions` | `archived_game_id`, `user_id`, `position`, `reactor_user_id` | `reaction`, `pos_x`, `pos_y` (spec 24) |
| `archived_threads` | `id`, the thread's former id | `archived_game_id`, `user_id`, `position` (the cell), `created_at`, `closed_at`, `outcome`, `accept_votes`, `deny_votes` |
| `archived_thread_messages` | `id` | `archived_thread_id`, `author_name`, `content`, `created_at` |
| `archived_thread_files` | `id` | `archived_thread_id`, `file_path`, `file_name`, `file_size`, `mime_type`, `created_at` |
| `archived_progress` | `id` | `archived_game_id`, `user_id`, `recorded_at`, `completed_tasks` (spec 23) |

Each table cascades from the one above it; `archived_threads` cascades from `archived_cells`, and `archived_progress` from `archived_game_players`. `archived_game_players.user_id` references `users.id` ON DELETE CASCADE. `leaderboard_rank` is `NULL` for a player who had no leaderboard row, who is left out of the leaderboard. The Joker is implicit, as on a live card (spec 05).

**Migration:** `V5_4_0__game_archive.sql`. `V5_11_0__archived_threads.sql` adds the thread tables. `V5_12_0__leaderboard_progress.sql` adds `archived_progress` and `archived_games.started_at`, which is `NULL` for games archived before it. `V5_13_0__cell_reactions.sql` adds `archived_cell_reactions`. `V5_7_0__multiple_team_leaders.sql` replaces `archived_games.leader_user_id` with `archived_game_players.is_leader`.

---

## Acceptance Criteria

- A game that ends, manually or at its deadline, appears in the archive of each player.
- An ended game with an open thread is archived once the thread has closed.
- A game that fails to archive is archived by a later sweep, once.
- Games that ended before the archive existed are archived.
- Once archived, the game no longer exists in `games`.
- The archive page lists only the games the user took part in.
- The archived game page shows each player's card and the final leaderboard.
- Cells cannot be changed, and selecting one shows its details as plain text.
- Editing or deleting a resolution, or deleting the team, does not change an archived game.
- Non-players cannot view an archived game.
- Only an admin who ran the game can delete it, and deletion removes it for every player.
- The archived game page shows the Cards, Leaderboard, Threads and Progress tabs.
- A game's archived threads, with their messages, file links and results, are in its archive.
- Only an admin who ran the game can delete an archived thread.
- Deleting an archived game, or one of its archived threads, removes their files from disk unless another thread shares them.
