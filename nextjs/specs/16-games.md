# 16 — Games

## Purpose

Separate a bingo game from the group of people playing it. A **team** (spec 04) is a list of users with a leader. A **game** is one instance of bingo played by that team. A team can run several games at the same time, and playing again does not require a new team or new invitations.

---

## User Stories Covered

- Start a new game with the same people, without inviting them again
- Run several games with one team at the same time
- See the games I am playing in one list
- Define a team goal for a game
- Create resolutions for the other members of a game
- Start bingo once setup is complete
- End a game
- Delete a game

---

## In Scope

- Game creation, listing and deletion
- Game lifecycle
- Game page
- Team goal and member-provided resolutions of a game
- Bingo start conditions
- Ending a game

---

## Functional Requirements

### Game Model

- A game belongs to one team and has a non-empty name.
- `status` is `forming`, `started` or `ended`.
- The players of a game are the current members of its team. There is no per-game roster.
- The leader of a game is the leader of its team.
- The team goal, member-provided resolutions, bingo cards and leaderboard rows belong to one game. Nothing carries over between games.

---

### Lifecycle

| Status | Meaning | Becomes |
| ------ | ------- | ------- |
| `forming` | Being set up. The goal and resolutions are written here. | `started`, or deleted |
| `started` | Being played. | `ended`, or deleted |
| `ended` | Finished. Read-only and kept in the database. | Deleted only with its team |

A **running** game is one in `forming` or `started`.

---

### Game Creation

`POST /api/teams/[teamId]/games`

- Only the leader of the team can create a game (`403` otherwise), and the leader must be verified (`403` otherwise).
- The body has a non-empty `name` (`400` otherwise).
- The game starts in `forming` status with no goal and no resolutions.
- A team can have any number of running games.

---

### Listing and Reading Games

- `GET /api/teams/[teamId]/games` lists the team's running games, to members only (`403` otherwise).
- `GET /api/games` lists the caller's running games across their teams, each with its team's name, newest first.
- `GET /api/games/[gameId]` returns one game with its team's members, to members of its team only (`403` otherwise).
- `404` is returned for a game that does not exist, and for an ended game. This applies to every route under `/api/games/[gameId]`.

---

### Game Page

`/games/[gameId]` shows a running game to the members of its team; others get a not-found page, as they do for an ended game.

The header holds the game name, the team name linking to the team page, the leader, the status, the team goal and the actions. The tabs below it are defined in spec 12.

| Action | Who | When |
| ------ | --- | ---- |
| **Set Goal** | Leader | Always |
| **Start Bingo** | Leader | `forming` |
| **End Game** | Leader | `started`, after confirmation |
| **Delete Game** | Leader | Always, after confirmation |
| **Propose Resolutions** | Any member | Always |

`/games` lists the caller's running games with their name, team, status and a link to the game page. New games are created from the team page (spec 04).

---

### Team Goal

- The team goal is a resolution with `scope = team`, of any type (spec 03). It belongs to one game.
- Only the leader can create or edit it: `POST /api/resolutions/save` with `scope = 'team'` and `gameId`.
- A game has one goal. Saving a new goal without an `id` when one already exists updates the existing goal, keeping its stored type (spec 03).
- The goal can be edited at any time, including after the game has started. Cells reference it, so edits are reflected on every card of the game.
- `GET /api/games/[gameId]/goal` returns it to team members.
- The goal is shown on the game page and appears as a normal `team` cell on the cards (spec 05). It is **not** the Joker.

---

### Member-Provided Resolutions

- For each game, each member is expected to create one resolution for every **other** member.
- `POST /api/resolutions/save` with `scope = 'member_provided'`, `gameId` and `toUserId`. Any type is allowed.
- Rules:
  - The author and the target must both be members of the game's team.
  - Members cannot create a resolution for themselves.
- The game page's **Propose Resolutions** dialog lists every other member with their resolution, if any.
- `GET /api/games/[gameId]/resolutions` returns the caller's written and received resolutions, the members and the overall status. With `?toUserId=<id>` it returns the resolutions targeted to that member. Both are limited to team members.

#### Ongoing Updates

- Team members MAY create or update their member-provided resolutions at any time, before or after game start.
- There is at most one resolution per `(game_id, owner_user_id, to_user_id)`; saving again overwrites it, keeping its stored type unless the save is a type change (spec 03). Cells reference resolutions by id, so edits are reflected on the card.
- A resolution created after the recipient's card was generated is not added to that card automatically. The recipient can place it through card editing (spec 09).

#### New Member Effects

- The requirement to provide resolutions for every other member is only evaluated at game start. After the game has started, nothing enforces resolutions for or from a new member.

---

### Start Conditions

`POST /api/games/[gameId]/start`

The leader may start bingo only when:
- The leader is verified
- The game is in `forming` status
- The team goal is set
- Every member has provided a resolution for every other member (trivially true for a one-person team)

Other members are verified because joining requires it.

On start:
- The game's status becomes `started` and a bingo card is generated for every member (spec 05), in one transaction: if generation fails, the game stays `forming` with no cards
- A leaderboard row is created for every member (spec 12)

---

### Joining After Start

A user who joins a team (spec 04) receives a card in **every** `started` game of that team:
- The game stays in `started` status.
- The card is generated at join time under the rules of spec 05. This requires the team goal to still exist; a failure to generate a card is not reported to the user and does not affect the other games.
- If the team goal is `compound` or `iterative`, the new member's goal cell is set to match the goal's progress.
- Existing members' cards are not regenerated.

---

### Ending a Game

`POST /api/games/[gameId]/end`

- Only the leader can end a game (`403` otherwise), and it must be `started` (`400` otherwise).
- The status becomes `ended` first, so no further change can start while the game closes.
- Every open review thread of the game is then closed under the deadline rule (spec 07): the cell becomes `accomplished` when accept votes ≥ deny votes, which includes a thread with no votes, and `pending` otherwise. Each closure refreshes the leaderboard entry of the completing user. A thread that fails to close is picked up by the deadline sweep.
- An ended game leaves `/games`, the team page and the dashboard. There is no UI to view it. Its cards and leaderboard stay in the database.

After a game has ended:
- Its cells cannot be completed, undone, edited or put under review.
- Automatic completion (spec 06) no longer changes its cells.
- Its team goal and member-provided resolutions cannot be saved, deleted or progressed.
- Personal resolutions on its cards remain the user's to change. Their cards keep referencing them.

---

### Deleting a Game

`DELETE /api/games/[gameId]`

- Only the leader can delete a game (`403` otherwise).
- The UI asks for confirmation.
- Deletion is a **hard delete**. Stored proof files of the game's threads are removed too, unless another thread uses the same file.
- Due to database `ON DELETE CASCADE` constraints, deleting a game also deletes its team goal, member-provided resolutions, leaderboard rows, bingo cards and all dependent gameplay and review records.

---

## Permissions

- Only verified users can create or start games.
- Only the team leader can:
  - Create, start, end and delete a game
  - Define the team goal
- Team members can:
  - Provide resolutions for other members
- Non-members receive `403` from the API.

---

## Data Model

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | VARCHAR(36) | Primary key |
| `team_id` | VARCHAR(36) | FK → `teams.id` ON DELETE CASCADE |
| `name` | VARCHAR(255) | Required |
| `status` | ENUM | `forming`, `started`, `ended` |
| `created_at`, `updated_at` | DATETIME | |
| `ended_at` | DATETIME | NULL until the game ends |

`bingo_cards`, `team_leaderboard` and `resolutions` carry both `game_id` and `team_id`. `resolutions.game_id` is `NULL` for personal resolutions. Each of those tables is unique per game, not per team.

**Migration:** `V5_0_0__separate_games_from_teams.sql`. Each existing team receives one game with the team's name, status and creation date. Teams are not merged.

---

## Acceptance Criteria

- A team leader can create several games for one team without inviting anyone again.
- Non-leaders cannot create, start, end or delete a game.
- Unverified users cannot create or start a game.
- Each game has its own goal, member-provided resolutions, cards and leaderboard.
- Bingo cannot start until the team goal and all required resolutions exist.
- `/games` lists the caller's running games.
- A member joining a team receives a card in each of its started games.
- Ending a game closes its open review threads and removes it from every list.
- An ended game cannot be changed and its routes return `404`.
- Deleting a game leaves its team and sibling games intact.

---

## Known Gaps

- A user who joins after a game has started gets a card built only from resolutions that exist at that moment, normally the team goal plus personal resolutions and empty cells.
- Card rooms stay per team (spec 11), so activity in one game also refreshes pages of its sibling games.
- Final standings of an ended game are stored but cannot be viewed.
