# 16 — Games

## Purpose

Separate a bingo game from the group of people playing it. A **team** (spec 04) is a list of users with one or more admins. A **game** is one instance of bingo played by members of that team. A team can run several games at the same time, and playing again does not require a new team or new invitations.

---

## User Stories Covered

- Start a new game with the same people, without inviting them again
- Choose which team members play a new game
- Leave a game
- Run several games with one team at the same time
- See the games I am playing in one list
- Define a team goal for a game
- Create resolutions for the other members of a game
- Set or change the deadline of a game
- Start bingo once setup is complete
- End a game, or have it end at its deadline
- Delete a game

---

## In Scope

- Game creation, listing and deletion
- Game roster and leaving a game
- Game lifecycle
- Game page
- Game configuration
- Team goal and member-provided resolutions of a game
- Bingo start conditions
- Ending a game

---

## Functional Requirements

### Game Model

- A game belongs to one team and has a non-empty name.
- `status` is `forming`, `started` or `ended`.
- `deadline` is optional. It is the last playable day of the game. A game without one only ends manually.
- `grid_size` is the size of every card of the game: `3` (3×3), `5` (5×5) or `9` (9×9). It is chosen when the game is created and cannot be changed afterwards, in any status.
- The players of a game are its **roster**, stored in `game_players`. Every player is a member of the game's team.
- The admins of a game are the Team Admins (spec 04) who are players of the game. Everything this spec reserves to "the admin" is open to any of them.
- A game always has at least one admin among its players: an admin cannot leave while they are the only one.
- The team goal, member-provided resolutions, bingo cards and leaderboard rows belong to one game. Nothing carries over between games.

---

### Lifecycle

| Status | Meaning | Becomes |
| ------ | ------- | ------- |
| `forming` | Being set up. The goal and resolutions are written here. | `started`, or deleted |
| `started` | Being played. | `ended`, or deleted |
| `ended` | Finished and read-only, until it is archived. | Archived, which deletes it (spec 18) |

A **running** game is one in `forming` or `started`.

---

### Game Creation

`POST /api/teams/[teamId]/games`

- Only an admin of the team can create a game (`403` otherwise), and the admin must be verified (`403` otherwise).
- The body has a non-empty `name` (`400` otherwise).
- The body MAY have `playerIds`, the team members who play the game. Without it, every member plays. Each id must belong to a team member (`400` otherwise). The creator is always a player, whether or not they are listed.
- The body MAY have `gridSize`, one of `3`, `5` or `9` (`400` otherwise). Without it, the game is 5×5.
- The **New Game** dialog lists the team members with a checkbox each, all checked. The creator's box is checked and cannot be cleared.
- The **New Game** dialog has a **Card size** choice with 3×3, 5×5 and 9×9. 5×5 is selected by default.
- The game starts in `forming` status with no goal and no resolutions.
- A team can have any number of running games.

---

### Listing and Reading Games

- `GET /api/teams/[teamId]/games` lists the team's running games that the caller plays, to members only (`403` otherwise).
- `GET /api/games` lists the caller's running games across their teams, each with its team's name, newest first.
- `GET /api/games/[gameId]` returns one game with its players, to its players only (`403` otherwise).
- Every other route under `/api/games/[gameId]` is also limited to the game's players, and "member" in this spec means a player of the game.
- `404` is returned for a game that does not exist, and for an ended game. This applies to every route under `/api/games/[gameId]`.

---

### Game Page

`/games/[gameId]` shows a running game to its players; others get a not-found page, as they do for an ended game.

The header holds the game name, the team name as plain text (it does not link to the team page, which is reached from the sidebar and the Teams page), the deadline if one is set, the status and the actions. It does not show the team goal, which is on every card's goal cell (spec 05). It does not list the admins: they are marked in the team page's members list (spec 04). The tabs below it are defined in spec 12.

| Action | Who | When |
| ------ | --- | ---- |
| **Set Goal** | Admin | Always |
| **Configure** | Admin | Running (`forming` or `started`) |
| **Start Bingo** | Admin | `forming` |
| **End Game** | Admin | `started`, after confirmation |
| **Delete Game** | Admin | Always, after confirmation |
| **Propose Resolutions** | Any member | Always |
| **Leave Game** | Any player | Always, after confirmation |

The header keeps only the most used actions visible, so it stays readable for admins:
- **Start Bingo** (when the caller can use it) and **Propose Resolutions** are buttons.
- The other actions are in a **More actions** menu, opened by a "⋯" button labelled "More actions". Its items, in this order, are Set Goal, Configure, End Game, a separator, Leave Game and Delete Game, which is styled as destructive. The menu lists only the actions the caller can use in the current state, as in the table above.
- Choosing a menu item opens the same dialog or confirmation as the action's button did.
- While no goal is set, the header says so, and an admin also sees a **Set Goal** button next to that notice. Once a goal is set, the notice and its button go away: the goal is changed through **Set Goal** in the More actions menu.

`/games` lists the caller's running games as cards with their name, team and status. The whole card is a link to the game page; it has no separate button. The team page lists its games the same way (spec 04). New games are created from the team page (spec 04).

---

### Game Configuration

`PATCH /api/games/[gameId]` with `deadline`, a date as `YYYY-MM-DD` or `null` for no deadline.

- The grid size is not configurable: the route ignores any other field, and the **Configure** dialog does not offer it.

- Only the admin can configure a game (`403` otherwise), and it must be running: `forming` or `started` (`400` otherwise).
- `deadline` must be a real date that is not before today (`400` otherwise). `null` removes the deadline.
- A new game has no deadline. Setting one is optional.
- The deadline of a started game can also be set, changed or removed, under the same rules. The new deadline applies from the next deadline sweep (Ending a Game); removing it means the game only ends manually.
- The **Configure** dialog sets the deadline with a date picker. It is reached from the More actions menu in both statuses.

The deadline is a calendar date with no time or time zone. "Today" is the date on the database server's clock. The chosen day is still playable: the deadline is over once that date has passed.

---

### Team Goal

- The team goal is a resolution with `scope = team`, of any type (spec 03). It belongs to one game.
- Only the admin can create or edit it: `POST /api/resolutions/save` with `scope = 'team'` and `gameId`.
- A game has one goal. Saving a new goal without an `id` when one already exists updates the existing goal, keeping its stored type (spec 03).
- The goal belongs to the admin who set it: only they edit it. When they leave the game, it passes to another admin of the game.
- The goal is one definition row per game. Each player's goal cell has its own snapshot and its own progress, tracked by that player, not by the admin.
- The goal can be edited at any time, including after the game has started. Cards copy it when they are generated (spec 05), so an edit after the start affects only cards generated after it, for players who join late. Existing cards are unchanged.
- `GET /api/games/[gameId]/goal` returns it to team members.
- The goal is shown on the game page and appears as a normal `team` cell on the cards (spec 05). It is **not** the Joker.

---

### Member-Provided Resolutions

- For each game, each member is expected to create one resolution for every **other** member. A missing resolution does not block the game: at start, the recipient gets a prepared resolution instead (spec 05).
- `POST /api/resolutions/save` with `scope = 'member_provided'`, `gameId` and `toUserId`. Any type is allowed.
- Rules:
  - The author and the target must both be players of the game.
  - Members cannot create a resolution for themselves.
- The game page's **Propose Resolutions** dialog lists every other member with their resolution, if any.
- `GET /api/games/[gameId]/resolutions` returns the caller's written and received resolutions, the members and the overall status. With `?toUserId=<id>` it returns the resolutions targeted to that member. Both are limited to team members.

#### Ongoing Updates

- Team members MAY create or update their member-provided resolutions at any time, before or after game start.
- There is at most one resolution per `(game_id, owner_user_id, to_user_id)`; saving again overwrites it, keeping its stored type unless the save is a type change (spec 03). Cards hold a snapshot, so an edit does not change a card that already contains the resolution.
- A resolution created after the recipient's card was generated is not added to that card automatically. The recipient can place it through card editing (spec 09).

#### New Member Effects

- Nothing enforces resolutions for or from a new member after the game has started.

---

### Start Conditions

`POST /api/games/[gameId]/start`

The admin may start bingo only when:
- The admin is verified
- The game is in `forming` status
- The deadline, if any, is not over
- The team goal is set

Other members are verified because joining requires it.

On start:
- The game's status becomes `started`, its `started_at` is set to the current time, and a bingo card is generated for every player (spec 05), in one transaction: if generation fails, the game stays `forming` with no cards, and `started_at` stays `NULL`
- A leaderboard row is created for every player (spec 12)

---

### Joining After Start

A user who joins a team (spec 04) becomes a player of **every** running game of that team, and receives a card in every `started` one:
- The game stays in `started` status.
- The card is generated at join time under the rules of spec 05. This requires the team goal to still exist; a failure to generate a card is not reported to the user and does not affect the other games.
- The new member's goal cell is a snapshot of the goal as it is at join time, with progress at zero.
- Existing members' cards are not regenerated.

---

### Ending a Game

A game ends in one of two ways, and both follow the same steps:

- **Manually:** `POST /api/games/[gameId]/end`. Only the admin can end a game (`403` otherwise), and it must be `started` (`400` otherwise). This is allowed at any time, whether or not the game has a deadline.
- **At the deadline:** every `started` game whose deadline is over is ended by `finishExpiredGames`, which runs in the same sweep as the thread deadline (spec 07): at server startup and then every hour. A game can therefore end up to an hour after its last day. A `forming` game is never ended this way.

Steps:

- The status becomes `ended` first, so no further change can start while the game closes.
- Every open review thread of the game is then closed under the deadline rule (spec 07): the cell becomes `accomplished` when accept votes ≥ deny votes, which includes a thread with no votes, and `pending` otherwise. Each closure refreshes the leaderboard entry of the completing user. A thread that fails to close is picked up by the deadline sweep.
- The game is archived, which deletes it from the database (spec 18). A game that fails to archive stays `ended` and is picked up by the same sweep.
- An ended game leaves `/games`, the team page and the dashboard. It is viewed from the archive (spec 18).

Until it is archived, after a game has ended:
- Its cells cannot be completed, undone, edited or put under review.
- Automatic completion (spec 06) no longer changes its cells.
- Its team goal and member-provided resolutions cannot be saved or deleted, and progress on its cells cannot be changed.
- Personal resolutions on its cards remain the user's to change. This does not change the game's final cards.

---

### Deleting a Game

`DELETE /api/games/[gameId]`

- Only the admin can delete a game (`403` otherwise).
- The UI asks for confirmation.
- Deletion is a **hard delete**. Stored proof files of the game's threads are removed too, unless another thread uses the same file.
- Due to database `ON DELETE CASCADE` constraints, deleting a game also deletes its roster, team goal, member-provided resolutions, leaderboard rows, bingo cards and all dependent gameplay and review records.

---

### Leaving a Game

`POST /api/games/[gameId]/leave`

- Only a player can leave (`403` otherwise). The game must be running (`404` otherwise, as for every game route).
- An admin cannot leave while no other player of the game is a Team Admin (`400` otherwise). They promote another player first (spec 04).
- The UI asks for confirmation and then returns the user to `/games`.
- In one transaction, leaving:
  - Removes the user from the roster
  - Deletes their bingo card, with its cells and their threads, and their leaderboard row. Stored proof files of those threads are removed too, unless another thread uses the same file.
  - Deletes the member-provided resolutions written **for** them in this game
  - Leaves no prepared resolutions to delete, because prepared fallbacks create no resolution rows (spec 05)
- Resolutions they wrote **for** other players stay in the Propose Resolutions lists, and their snapshots stay on those players' cards. Their badge reads "Former Teammates" (spec 05). The leaver can no longer edit them.
- Votes they cast on other players' threads stay.
- A user who left a game cannot return to it while they stay in the team. A user who leaves the team and joins it again is a new member (Joining After Start), with a new card.
- Leaving a team (spec 04) leaves each of its running games the user plays.

---

## Permissions

The role-to-permission table and the status of every refusal are defined in spec 21 (Authorization).

- Only verified users can create or start games.
- Only a Team Admin can create a game.
- Only an admin of the game (a Team Admin who plays it) can:
  - Configure, start, end and delete a game
  - Define the team goal
- Players can:
  - Provide resolutions for other players
  - Leave the game
- Non-players receive `403` from the API.

---

## Data Model

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | VARCHAR(36) | Primary key |
| `team_id` | VARCHAR(36) | FK → `teams.id` ON DELETE CASCADE |
| `name` | VARCHAR(255) | Required |
| `status` | ENUM | `forming`, `started`, `ended` |
| `created_at`, `updated_at` | DATETIME | |
| `started_at` | DATETIME | NULL until bingo starts |
| `ended_at` | DATETIME | NULL until the game ends |
| `deadline` | DATE | Last playable day. NULL when the game only ends manually |
| `grid_size` | TINYINT | `3`, `5` or `9`. Set at creation, never changed. Default `5` |

### `game_players`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `game_id` | VARCHAR(36) | FK → `games.id` ON DELETE CASCADE |
| `user_id` | VARCHAR(36) | FK → `users.id` ON DELETE CASCADE |
| `joined_at` | DATETIME | |

The primary key is `(game_id, user_id)`.

`bingo_cards`, `team_leaderboard` and `resolutions` carry both `game_id` and `team_id`. `resolutions.game_id` is `NULL` for personal resolutions. Each of those tables is unique per game, not per team.

**Migration:** `V5_0_0__separate_games_from_teams.sql`. Each existing team receives one game with the team's name, status and creation date. Teams are not merged. `V5_1_0__game_deadline.sql` adds `deadline`, which is `NULL` for existing games. `V5_6_0__game_players.sql` adds `game_players`, with every existing game's team members as its players. `V5_10_0__game_grid_size.sql` adds `grid_size`, which is `5` for existing games. `V5_12_0__leaderboard_progress.sql` adds `started_at`; for a game already `started` or `ended`, it is set to the creation time of the game's earliest bingo card.

---

## Acceptance Criteria

- A Team Admin can create several games for one team without inviting anyone again.
- Non-admins cannot create, start, end or delete a game.
- Unverified users cannot create or start a game.
- Each game has its own goal, member-provided resolutions, cards and leaderboard.
- Two players track the team goal independently, each on their own cell.
- Editing the team goal after the start changes only cards generated after the edit.
- Bingo cannot start until the team goal exists.
- Bingo can start while member-provided resolutions are missing.
- An admin can set, change or remove the deadline of a running game (`forming` or `started`), and not of an ended one.
- Changing the deadline of a started game changes when it ends automatically.
- A game with no deadline only ends manually.
- A started game is ended automatically once its deadline is over, the same way as a manual end.
- An admin can end a started game before its deadline.
- Bingo cannot start after the deadline is over.
- `/games` lists the caller's running games.
- A member joining a team receives a card in each of its started games.
- Ending a game closes its open review threads, archives it and removes it from every list of running games.
- An ended game cannot be changed and its routes return `404`.
- Deleting a game leaves its team and sibling games intact.
- An admin can choose which team members play a new game; all are selected by default.
- An admin chooses a 3×3, 5×5 or 9×9 card size when creating a game; 5×5 is selected by default.
- The card size of a game cannot be changed once it is created, and every card of the game has that size.
- Only players can see and play a game.
- A player can leave a game after confirming. Their card, leaderboard row and the resolutions written for them are removed; resolutions they wrote for others stay, tagged "Former Teammates".
- The only admin of a game cannot leave it until another player is promoted.
- An admin's game header shows at most two action buttons plus the More actions menu, and every action in the Game Page table can be reached from the header or the menu.

---

## Known Gaps

- A user who joins after a game has started gets a card built only from resolutions that exist at that moment, normally the team goal plus personal resolutions and empty cells.
- Card rooms stay per team (spec 11), so activity in one game also refreshes pages of its sibling games, and team members who do not play a game can receive its refresh signals (never its data).
