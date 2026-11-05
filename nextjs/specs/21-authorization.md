# 21 — Authorization

## Purpose

Define in one place who may do what. Specs 04, 06, 07, 13, 16 and 18 describe the features; this spec lists the roles, the permissions each role holds and the HTTP status of every refusal. All routes and pages ask one authorization module (`src/lib/authz/`), and repositories only read and write data.

This spec does not change any rule of the other specs. Where they describe a permission, the rule here is the same one.

---

## User Stories Covered

- As a player, I can only see and act on the teams, games and archived games I belong to
- As a leader, I hold every leader action on my team and on the games I play
- As a maintainer of the code, I can find every rule in one table and add a role without touching every route

---

## In Scope

- Scopes and their roles
- The permission table
- Resource rules (ownership)
- Status codes of refusals
- Client-side gating of actions

---

## Scopes and Roles

A role is held by a user **in a scope**. A user has at most one role per scope instance, and no role means no permission.

| Scope | Instance | Roles | Source |
| ----- | -------- | ----- | ------ |
| `team` | A team | `leader`, `member` | `team_memberships.role` |
| `game` | A running game | `leader`, `player` | `game_players`: a player who is a leader of the game's team is `leader`, any other player is `player` (spec 16) |
| `archive` | An archived game | `leader`, `player` | `archived_game_players`: `is_leader` gives `leader` (spec 18) |

- The `game` scope covers running games only. A missing or ended game is not found (`404`), before any role is looked at.
- A team leader who does not play a game has no role in it.
- Some permissions need no scope: they are open to any logged-in user.
- **Reserved:** an `app` scope for app-wide roles (such as a `maintainer`) is not implemented. It needs its own spec before it is added.

---

## Permission Table

Every role is listed with the full set of permissions it holds; there is no inheritance between roles. "Verified" means the permission also requires a verified email (spec 01).

| Permission | Scope | Allowed roles | Verified |
| ---------- | ----- | ------------- | -------- |
| `team.create` | none | any logged-in user | yes |
| `team.join` | none | any logged-in user | yes |
| `team.view` | team | `leader`, `member` | – |
| `team.leave` | team | `leader`, `member` | – |
| `team.invite` | team | `leader` | – |
| `team.promote` | team | `leader` | – |
| `team.delete` | team | `leader` | – |
| `game.create` | team | `leader` | yes |
| `game.view` | game | `leader`, `player` | – |
| `game.propose` | game | `leader`, `player` | – |
| `game.leave` | game | `leader`, `player` | – |
| `thread.request` | game | `leader`, `player` | – |
| `thread.view` | game | `leader`, `player` | – |
| `thread.message` | game | `leader`, `player` | – |
| `thread.vote` | game | `leader`, `player` | – |
| `card.arrange` | game | `leader`, `player` | – |
| `game.configure` | game | `leader` | – |
| `game.start` | game | `leader` | yes |
| `game.end` | game | `leader` | – |
| `game.delete` | game | `leader` | – |
| `game.goal.set` | game | `leader` | – |
| `archive.view` | archive | `leader`, `player` | – |
| `archive.delete` | archive | `leader` | – |

Where they are used:

- `team.view`: the team route `GET /api/teams/[teamId]`, the team's game list `GET /api/teams/[teamId]/games` and the team page.
- `game.view`: every read under `/api/games/[gameId]` (the game, its cards, goal and resolutions) and the game page.
- `game.propose`: saving a member-provided resolution (spec 16). The target must also be a player of the game.
- `thread.*`: a cell's or thread's game is resolved first, and the role is the caller's role in that game (spec 07). The game is resolved whatever its status; what an ended game's cells and threads allow is a game status rule (spec 16).
- `game.goal.set`: saving the team goal of a game (spec 16).
- `card.arrange`: shuffling and locking the caller's own card (spec 22).

Lists of the caller's own teams, games, archived games, resolutions and notifications (`GET /api/teams`, `/api/games`, `/api/archived-games`, the dashboard) only return the caller's own data and need no permission.

---

## Resource Rules (Ownership)

Some actions depend on who owns a record, not on a role. They apply on top of the permission table.

- **Resolution edit or delete:** only its owner. A game-scoped resolution can only be edited or deleted while its owner is still a player of the game.
- **Cell progress** (compound subtask toggle, iterative increment and decrement, spec 06): only the owner of the card, and only while the game has not ended. This holds for every source, including `team` cells.
- **Cell history:** read and write access as defined in spec 13 (History Visibility, Manual Entry Creation).
- **Cell complete, undo or edit:** only the owner of the card.
- **Card shuffle or lock:** only the owner of the card. The routes act on the caller's own card (spec 22).
- **Thread close, proof upload and proof delete:** only the completing user.
- **Self-scoped data:** profile and notifications routes (`/api/profile`, `/api/notifications`) only read and change the caller's own data.

---

## Status Rules

The HTTP status of a refusal:

| Situation | Status |
| --------- | ------ |
| Not logged in | `401` |
| The permission requires a verified email and the caller is not verified | `403` |
| The game or archived game does not exist, or the game has ended | `404` |
| The team does not exist, on the routes that look it up (below) | `404` |
| The caller has no role in the scope, or the role lacks the permission | `403` |
| A resource rule refuses the action | `403`, except for cell routes (below) |

- When several checks fail, the first in this order wins: logged in, verified, resource exists, role, resource rule.
- Team routes that look the team up first, and return `404` for a missing team: delete (`DELETE /api/teams/[teamId]`), promote (`/leaders`) and leave (`/leave`). The other team routes (read, invite, game list and game creation) return `403` for a missing team, as for a non-member.
- Pages call not-found instead of returning `403`: a user without the permission sees the same page as for a missing resource.
- Cell routes (`/api/cells/[cellId]` and its sub-routes, including progress, except history, which follows spec 13) return `400` for every refusal, including a missing cell and a user who does not own the card. A user who is not logged in still gets `401`.
- Thread routes return `404` for a missing thread, cell or file, `403` for a refused permission or resource rule and `400` for any other refusal. The role and the resource rule are checked before the thread's state, so a non-player or a user other than the completing user gets `403` on a closed thread too.

---

## Domain Invariants

These rules are not permissions and stay with the data they protect:

- The last leader cannot leave a team or game (specs 04 and 16).
- Game status rules: what a `forming`, `started` or `ended` game allows (spec 16).
- A completing user cannot vote on their own proof, and closed threads accept no messages, files or votes (spec 07).
- The SQL guards on owner columns in `UPDATE` and `DELETE` statements are kept as atomic protection.

---

## Client Gating

- Team and game pages receive the list of permissions the caller holds in that team or game, computed on the server by the same module, and show an action only when its permission is in the list.
- The members list shows **Make Leader** only when the caller holds `team.promote`.
- Client gating is for display only. Every action is checked again by the API.

---

## Acceptance Criteria

- Every permission in the table is granted exactly to the listed roles, and refused to every other role and to users without a role.
- Verified-only permissions are refused to unverified users with `403`.
- A missing team, game or archived game, and an ended game, give `404`.
- Pages show not-found where the API would refuse.
- The resource rules hold: only the card owner changes progress on a cell, so neither the author of a member-provided resolution nor the team leader can; only the card owner completes a cell; only the completing user closes a thread.
- Team and game pages show leader actions only to callers who hold the matching permission.
- No route or page decides a role-based permission without the authorization module.

---

## Out of Scope

- New roles, and any app-wide role (reserved `app` scope)
- Storing roles in a new table
- Changing who may do what

---

## Known Gaps

- Real-time card rooms are joined by **team** membership (spec 11), not by game role, so team members who do not play a game can receive its refresh signals (never its data). Thread rooms use the rules above.
- Cell routes report refusals as `400` instead of `403` or `404`.
