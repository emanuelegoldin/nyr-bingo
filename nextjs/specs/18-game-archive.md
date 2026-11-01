# 18 — Game Archive

## Purpose

Keep a read-only record of every finished game. An archived game is a snapshot of the final leaderboard and of each player's card. It is stored as plain values, so nothing that happens later to a resolution, a team or a game can change it.

---

## User Stories Covered

- Browse the finished games I took part in
- See the final standings of a game
- Look at each player's final card and open the details of a cell
- Delete a game from the archive, as the leader who ran it

---

## In Scope

- Archiving a game when it ends
- Archive page and archived game page
- Deleting an archived game

---

## Functional Requirements

### Archiving a Game

Every game that ends is archived, whether it ended manually or at its deadline (spec 16).

- The archive holds, as they were when the game ended:
  - The game name, the team name, the end date and the leader who ran the game
  - The leaderboard
  - The card of every player
- The **players** of an archived game are the team members who had a card in it. A member without a card has no access.
- A cell keeps its position, title, description, type, state, source and source label. A `compound` cell also keeps its subtasks and an `iterative` cell its counters. A cell whose resolution was deleted before the game ended is archived blank (spec 03).
- A game is archived only once it has no open review thread, so every cell is final.
- Saving the archive and deleting the game happen in one transaction. The game's cards, cells, leaderboard rows, closed threads, team goal and member-provided and prepared resolutions are deleted with it.
- A game that could not be archived stays `ended`. The hourly sweep (spec 16) closes its open threads and archives it, so a failure is not reported to the leader. The same step archives games that ended before the archive existed. For those without a stored end date, the game's last update is used.

### Independence

An archived game has no reference to `games`, `teams` or `resolutions`.

- Editing or deleting a resolution does not change it.
- Deleting a team does not delete it (spec 04).
- Later changes to a username or display name do not change it.
- The leaderboard avatars and member-provided cell badges link to the player's current profile. A profile's own content is not part of the archive.

### Reading

- `GET /api/archived-games` lists the archived games the caller took part in, most recently ended first.
- `GET /api/archived-games/[archivedGameId]` returns one archived game with its leaderboard and cards, to its players only (`403` otherwise). `404` is returned when it does not exist.

### Archive Page

`/archive` lists the caller's archived games with their name, team and end date, and a link to each. An empty state is shown when there are none.

### Archived Game Page

`/archive/[archivedGameId]` shows an archived game to its players. Others get a not-found page.

From top to bottom:

- The game name, team name and end date, and a **Delete** button for the leader who ran the game
- The final leaderboard, with the columns and order of spec 12
- The card of every player, in leaderboard order

Cards are read-only. They have no edit mode, real-time updates, confetti, proof actions or resolution history. Selecting a non-empty cell other than the Joker opens its details as plain text: title, description, state, type, source, and the subtasks or counter of a `compound` or `iterative` cell.

### Deleting an Archived Game

`DELETE /api/archived-games/[archivedGameId]`

- Only the leader who ran the game can delete it (`403` otherwise; `404` when it does not exist).
- The UI asks for confirmation.
- Deletion is a **hard delete** and removes the game from the archive of every player.

---

## Permissions

- Only the players of an archived game can view it.
- Only the leader who ran the game can delete it.
- Archived games cannot be edited by anyone.

---

## Data Model

| Table | Primary key | Holds |
| ----- | ----------- | ----- |
| `archived_games` | `id`, the game's former id | `leader_user_id` (FK → `users.id` ON DELETE SET NULL), `name`, `team_name`, `ended_at` |
| `archived_game_players` | `archived_game_id`, `user_id` | `player_name`, `leaderboard_rank`, `completed_tasks`, `first_bingo_at` |
| `archived_cells` | `archived_game_id`, `user_id`, `position` | `title`, `description`, `resolution_type`, `state`, `source_type`, `source_user_id`, `source_label`, `is_empty`, `number_of_repetition`, `completed_times` |
| `archived_cell_subtasks` | `archived_game_id`, `user_id`, `position`, `subtask_index` | `title`, `description`, `completed` |

Each table cascades from the one above it. `archived_game_players.user_id` references `users.id` ON DELETE CASCADE. `leaderboard_rank` is `NULL` for a player who had no leaderboard row, who is left out of the leaderboard. The Joker is implicit, as on a live card (spec 05).

**Migration:** `V5_4_0__game_archive.sql`.

---

## Acceptance Criteria

- A game that ends, manually or at its deadline, appears in the archive of each player.
- An ended game with an open thread is archived once the thread has closed.
- A game that fails to archive is archived by a later sweep, once.
- Games that ended before the archive existed are archived.
- Once archived, the game no longer exists in `games`.
- The archive page lists only the games the user took part in.
- The archived game page shows the final leaderboard above each player's card.
- Cells cannot be changed, and selecting one shows its details as plain text.
- Editing or deleting a resolution, or deleting the team, does not change an archived game.
- Non-players cannot view an archived game.
- Only the leader who ran the game can delete it, and deletion removes it for every player.
