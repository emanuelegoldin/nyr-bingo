# 16 — Games

## Purpose

Separate a bingo game from the group of people playing it. A **team** (spec 04) is a list of users with one or more admins. A **game** is one instance of bingo played by members of that team. A team can run several games at the same time, and playing again does not require a new team or new invitations.

---

## User Stories Covered

- Start a new game with the same people, without inviting them again
- Choose which team members play a new game
- Invite a team member to a running game
- Leave a game
- Run several games with one team at the same time
- See the games I am playing in one list
- Define a team goal for a game
- Create resolutions for the other members of a game
- Write my own resolutions for a game
- Set or change the deadline of a game
- See how much time is left before the game starts
- Signal that I am ready, so the game can start early
- End a game, or have it end at its deadline
- Delete a game

---

## In Scope

- Game creation, listing and deletion
- Game roster, inviting a player and leaving a game
- Game lifecycle
- Preparation phase and automatic start
- Game page
- Game configuration
- Team goal, member-provided and personal resolutions of a game
- Ending a game

---

## Functional Requirements

### Game Model

- A game belongs to one team and has a non-empty name.
- `status` is `forming`, `started` or `ended`.
- `preparation_deadline` is the moment the preparation phase ends at the latest. It is chosen when the game is created and cannot be changed afterwards.
- `deadline` is optional. It is the last playable day of the game. A game without one only ends manually.
- `grid_size` is the size of every card of the game: `3` (3×3), `5` (5×5) or `9` (9×9). It is chosen when the game is created and cannot be changed afterwards, in any status.
- The players of a game are its **roster**, stored in `game_players`. Every player is a member of the game's team.
- The admins of a game are the Team Admins (spec 04) who are players of the game. Everything this spec reserves to "the admin" is open to any of them.
- A game always has at least one admin among its players: an admin cannot leave while they are the only one.
- The team goal, member-provided resolutions, personal resolutions, bingo cards and leaderboard rows belong to one game. Nothing carries over between games.

---

### Lifecycle

| Status | Meaning | Becomes |
| ------ | ------- | ------- |
| `forming` | The **preparation phase**. The goal, the deadline and the resolutions are written here. Shown as "Preparation". | `started` automatically (Preparation Phase), or deleted |
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
- The body has `preparationDeadline`, an ISO 8601 date-time with a time zone (for example `2027-01-05T18:00:00.000Z`) that is in the future (`400` otherwise). It is stored in UTC.
- The **New Game** dialog lists the team members with a checkbox each, all checked. The creator's box is checked and cannot be cleared.
- The **New Game** dialog has a **Card size** choice with 3×3, 5×5 and 9×9. 5×5 is selected by default.
- The **New Game** dialog has a required **Preparation ends** date-and-time field, in the user's local time, which cannot be in the past.
- The game starts in `forming` status (the preparation phase) with no goal, no resolutions and no player ready.
- A team can have any number of running games.

---

### Preparation Phase

A game is in its preparation phase while it is `forming`. During it:
- The admin sets the team goal (Team Goal) and, optionally, the game deadline (Game Configuration).
- Every player writes a resolution for each other player (Member-Provided Resolutions) in the **Teammates** tab, and their own resolutions (spec 03) in the **Personal** tab (spec 12).
- Each player signals that they are done with the **Ready** button.

#### Ready

`POST /api/games/[gameId]/ready` with `{ "ready": true | false }`.

- Any player can mark themselves ready, or no longer ready (permission `game.ready`, spec 21). `ready` must be a boolean (`400` otherwise).
- The game must be `forming` (`400` otherwise).
- Being ready does not require any number of resolutions, and does not prevent writing more.
- During the preparation phase the header shows a **Ready** button; once pressed it reads **Not ready** and undoes it. Next to it the header shows how many players are ready, as `x/y ready`.
- `game_players.ready_at` holds when the player became ready, or `NULL`.

#### Automatic Start

The game starts as soon as either is true:
- every player is ready, or
- the preparation deadline has passed.

There is no manual start. The start is triggered:
- by `POST /api/games/[gameId]/ready`, right after the last player becomes ready;
- by `POST /api/games/[gameId]/leave`, right after the last player who was not ready leaves;
- by a sweep that runs at server startup and then every minute, for every `forming` game whose preparation deadline has passed or whose players are all ready. A game can therefore start up to a minute after its preparation deadline.

On start, in one transaction (if card generation fails, the game stays `forming` with no cards and `started_at` stays `NULL`, and the sweep retries):
- If the game has no team goal, a random entry of the prepared pool (spec 17) is stored as the team goal (`scope = team`, of the entry's type, with its text and type-specific data), owned by the admin of the game who joined it first. An admin can change it afterwards (Team Goal).
- The game's status becomes `started`, its `started_at` is set to the current time, and a bingo card is generated for every player (spec 05).

After the commit:
- A leaderboard row is created for every player (spec 12).
- Players receive a `game_started` notification (spec 19), and open game pages refresh (spec 11).

A start triggered by a route reports nothing to the caller if it fails: the ready or leave request still succeeds, and the sweep retries.

The game deadline does not block the start.

#### Countdown

During the preparation phase the game page header shows the time left until the preparation deadline as a live countdown (`Starts in 2d 4h 12m`, with seconds in the last hour). Once it reaches zero, it reads `Starting…` until the page refreshes. It is shown:
- in the normal text colour while more than 24 hours are left,
- in bold, in the `warning` colour, from 24 hours,
- in bold, in the `destructive` colour, from 1 hour.

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

The header holds the game name, the team name as plain text (it does not link to the team page, which is reached from the sidebar and the Teams page), the deadline information, the status and the actions. It does not show the team goal, which is on every card's goal cell (spec 05). It does not list the admins: they are marked in the team page's members list (spec 04). The tabs below it are defined in spec 12.

| Action | Who | When |
| ------ | --- | ---- |
| **Set Goal** | Admin | Always |
| **Configure** | Admin | Running (`forming` or `started`) |
| **Invite to Game** | Admin | Running |
| **Ready** / **Not ready** | Any player | `forming` |
| **End Game** | Admin | `started`, after confirmation |
| **Delete Game** | Admin | Always, after confirmation |
| **Leave Game** | Any player | Always, after confirmation |

The header keeps only the most used actions visible, so it stays readable for admins:
- **Ready** (during the preparation phase) is a button, with the `x/y ready` count next to it.
- The other actions are in a **More actions** menu, opened by a "⋯" button labelled "More actions". Its items, in this order, are Set Goal, Configure, Invite to Game, End Game, a separator, Leave Game and Delete Game, which is styled as destructive. The menu lists only the actions the caller can use in the current state, as in the table above.
- Choosing a menu item opens the same dialog or confirmation as the action's button did.
- While no goal is set, the header says so, and an admin also sees a **Set Goal** button next to that notice. During the preparation phase the notice also says that a prepared resolution will be used as the goal if none is set before the start. Once a goal is set, the notice and its button go away: the goal is changed through **Set Goal** in the More actions menu.

**Deadline information.** One component shows it, in the header:
- During the preparation phase, the countdown to the preparation deadline (Preparation Phase), followed by the last day if a deadline is set.
- Once started, the last day, `Last day: <date>`, with the date formatted in the user's locale, if a deadline is set. It is shown in the normal text colour, in bold in the `warning` colour when the last day is 3 days away or less, and in bold in the `destructive` colour on the last day itself.

`/games` lists the caller's running games as cards with their name, team and status. The whole card is a link to the game page; it has no separate button. The team page lists its games the same way (spec 04). New games are created from the team page (spec 04).

---

### Game Configuration

`PATCH /api/games/[gameId]` with `deadline`, a date as `YYYY-MM-DD` or `null` for no deadline.

- The grid size is not configurable: the route ignores any other field, and the **Configure** dialog does not offer it.

- Only the admin can configure a game (`403` otherwise), and it must be running: `forming` or `started` (`400` otherwise).
- `deadline` must be a real date that is not before today, and not before the date of the preparation deadline in UTC (`400` otherwise). `null` removes the deadline.
- A new game has no deadline. Setting one is optional.
- The deadline of a started game can also be set, changed or removed, under the same rules. The new deadline applies from the next deadline sweep (Ending a Game); removing it means the game only ends manually.
- The **Configure** dialog sets the deadline with a date picker, which offers no date before today or before the preparation deadline. It is reached from the More actions menu in both statuses.
- The preparation deadline cannot be changed: the route ignores it and the dialog does not offer it.

The deadline is a calendar date with no time or time zone. "Today" is the date on the database server's clock. The chosen day is still playable: the deadline is over once that date has passed.

---

### Team Goal

- The team goal is a resolution with `scope = team`, of any type (spec 03). It belongs to one game.
- Only the admin can create or edit it: `POST /api/resolutions/save` with `scope = 'team'` and `gameId`.
- A game has one goal. Saving a new goal without an `id` when one already exists updates the existing goal, keeping its stored type (spec 03).
- The goal belongs to the admin who set it: only they edit it. When they leave the game, it passes to another admin of the game.
- The goal is one definition row per game. Each player's goal cell has its own snapshot and its own progress, tracked by that player, not by the admin.
- The goal can be edited at any time, including after the game has started. Cards copy it when they are generated (spec 05), so an edit after the start affects only cards generated after it, for players invited later. Existing cards are unchanged.
- `GET /api/games/[gameId]/goal` returns it to team members.
- The goal is shown on the game page and appears as a normal `team` cell on the cards (spec 05). It is **not** the Joker.

---

### Member-Provided Resolutions

- For each game, each member is expected to create one resolution for every **other** member during the preparation phase. A missing resolution does not block the game: at start, the recipient gets a prepared resolution instead (spec 05).
- `POST /api/resolutions/save` with `scope = 'member_provided'`, `gameId` and `toUserId`. Any type is allowed.
- Rules:
  - The author and the target must both be players of the game.
  - Members cannot create a resolution for themselves.
- The game page's **Teammates** tab (spec 12) lists every other member with the caller's resolution for them, if any, and a button to write or edit it.
- `GET /api/games/[gameId]/resolutions` returns the caller's written and received resolutions, the members and the overall status. With `?toUserId=<id>` it returns the resolutions targeted to that member. Both are limited to team members.

#### Ongoing Updates

- Team members MAY create or update their member-provided resolutions at any time, before or after game start.
- There is at most one resolution per `(game_id, owner_user_id, to_user_id)`; saving again overwrites it, keeping its stored type unless the save is a type change (spec 03). Cards hold a snapshot, so an edit does not change a card that already contains the resolution.
- A resolution created after the recipient's card was generated is not added to that card automatically. The recipient can place it through card editing (spec 09).

#### New Member Effects

- Nothing enforces resolutions for or from a new member after the game has started.

---

### Inviting a Player

Joining a team (spec 04) does not make the user a player of any game. An admin invites team members to a game instead.

`POST /api/games/[gameId]/players` with `{ "userId": "<id>" }`

- Only the admin can invite (permission `game.invite`, spec 21; `403` otherwise). The game must be running (`404` otherwise, as for every game route).
- `userId` must be a member of the game's team who is not a player of the game (`400` otherwise). This includes a member who left the game.
- The invited member becomes a player at once, not ready. There is no accept step: a player who does not want to play leaves the game (Leaving a Game).
- In a `started` game they receive a card at once:
  - The card is generated under the rules of spec 05. This requires the team goal to still exist; a failure to generate the card is not reported to the admin.
  - The new player's goal cell is a snapshot of the goal as it is at that moment, with progress at zero.
  - Existing players' cards are not regenerated.
- The invited member receives a `game_invited` notification (spec 19), and open team and game pages refresh (spec 11).
- The **Invite to Game** dialog lists the team members who are not players of the game, each with an **Invite** button. It says so when there is nobody to invite.

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
- Its team goal, member-provided and personal resolutions cannot be saved or deleted, and progress on its cells cannot be changed.

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
  - Deletes their personal resolutions of this game
  - Leaves no prepared resolutions to delete, because prepared fallbacks create no resolution rows (spec 05)
- Resolutions they wrote **for** other players stay in those players' Teammates lists, and their snapshots stay on those players' cards. Their badge reads "Former Teammates" (spec 05). The leaver can no longer edit them.
- Votes they cast on other players' threads stay.
- A user who left a game returns to it only if an admin invites them again (Inviting a Player), as a new player with a new card.
- Leaving a team (spec 04) leaves each of its running games the user plays.
- During the preparation phase, if every remaining player is ready, the game starts (Automatic Start).

---

## Permissions

The role-to-permission table and the status of every refusal are defined in spec 21 (Authorization).

- Only verified users can create games.
- Only a Team Admin can create a game.
- Only an admin of the game (a Team Admin who plays it) can:
  - Configure, end and delete a game
  - Invite team members to the game
  - Define the team goal
- Players can:
  - Provide resolutions for other players
  - Write their own resolutions for the game
  - Mark themselves ready
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
| `preparation_deadline` | DATETIME | UTC. End of the preparation phase. Set at creation, never changed. NULL for games started before the preparation phase existed |
| `ended_at` | DATETIME | NULL until the game ends |
| `deadline` | DATE | Last playable day. NULL when the game only ends manually |
| `grid_size` | TINYINT | `3`, `5` or `9`. Set at creation, never changed. Default `5` |

### `game_players`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `game_id` | VARCHAR(36) | FK → `games.id` ON DELETE CASCADE |
| `user_id` | VARCHAR(36) | FK → `users.id` ON DELETE CASCADE |
| `joined_at` | DATETIME | |
| `ready_at` | DATETIME | NULL until the player is ready in the preparation phase |

The primary key is `(game_id, user_id)`.

`bingo_cards`, `team_leaderboard` and `resolutions` carry both `game_id` and `team_id`. `resolutions.game_id` is `NULL` only for legacy personal resolutions (spec 03). Each of those tables is unique per game, not per team.

**Migration:** `V5_0_0__separate_games_from_teams.sql`. Each existing team receives one game with the team's name, status and creation date. Teams are not merged. `V5_1_0__game_deadline.sql` adds `deadline`, which is `NULL` for existing games. `V5_6_0__game_players.sql` adds `game_players`, with every existing game's team members as its players. `V5_10_0__game_grid_size.sql` adds `grid_size`, which is `5` for existing games. `V5_12_0__leaderboard_progress.sql` adds `started_at`; for a game already `started` or `ended`, it is set to the creation time of the game's earliest bingo card. `V5_14_0__game_preparation_phase.sql` adds `preparation_deadline` and `game_players.ready_at`; a game already `forming` gets a preparation deadline 7 days after the migration. For every `started` game, it also copies each `personal` cell of a card into a personal resolution of that game, owned by the card owner, and recreates from its cell a `member_provided` resolution whose row was deleted, so the Personal and Teammates tabs of games started before the change are not empty. Each such cell is linked to its new resolution.

---

## Acceptance Criteria

- A Team Admin can create several games for one team without inviting anyone again.
- Non-admins cannot create, end or delete a game.
- Unverified users cannot create a game.
- A game cannot be created without a preparation deadline in the future, and the preparation deadline cannot be changed.
- During the preparation phase the header shows a live countdown to the preparation deadline, which turns bold and `warning` from 24 hours and `destructive` from 1 hour.
- The game starts as soon as every player is ready, or at the latest about a minute after the preparation deadline.
- A player can mark themselves ready and undo it while the game is in preparation.
- A game started without a team goal gets a prepared resolution as its goal, on every card.
- Each game has its own goal, member-provided resolutions, cards and leaderboard.
- Two players track the team goal independently, each on their own cell.
- Editing the team goal after the start changes only cards generated after the edit.
- Bingo starts while member-provided resolutions are missing.
- An admin can set, change or remove the deadline of a running game (`forming` or `started`), and not of an ended one.
- Changing the deadline of a started game changes when it ends automatically.
- A game with no deadline only ends manually.
- A started game is ended automatically once its deadline is over, the same way as a manual end.
- An admin can end a started game before its deadline.
- The game deadline cannot be set before the date of the preparation deadline.
- Once started, the last day is shown in the user's locale, bold and `warning` from 3 days before it and `destructive` on the day itself.
- `/games` lists the caller's running games.
- Joining a team does not make the user a player of any game.
- An admin can invite a team member who is not a player to a running game; the member becomes a player, receives a card if the game has started, and is notified.
- Ending a game closes its open review threads, archives it and removes it from every list of running games.
- An ended game cannot be changed and its routes return `404`.
- Deleting a game leaves its team and sibling games intact.
- An admin can choose which team members play a new game; all are selected by default.
- An admin chooses a 3×3, 5×5 or 9×9 card size when creating a game; 5×5 is selected by default.
- The card size of a game cannot be changed once it is created, and every card of the game has that size.
- Only players can see and play a game.
- A player can leave a game after confirming. Their card, leaderboard row, their personal resolutions of the game and the resolutions written for them are removed; resolutions they wrote for others stay, tagged "Former Teammates".
- The only admin of a game cannot leave it until another player is promoted.
- An admin's game header shows at most one action button plus the More actions menu, and every action in the Game Page table can be reached from the header or the menu.

---

## Known Gaps

- A player invited after a game has started gets a card built only from resolutions that exist at that moment, normally the team goal and empty cells, because they had no preparation phase. They can write personal resolutions in the Personal tab and place them through card editing (spec 09).
- Card rooms stay per team (spec 11), so activity in one game also refreshes pages of its sibling games, and team members who do not play a game can receive its refresh signals (never its data).
