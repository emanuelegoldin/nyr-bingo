# 24 — Cell Reactions

## Purpose

Let players cheer on their teammates by putting a small emoji reaction on a teammate's completed or accomplished cell.

## User Stories Covered

- React to a teammate's completed or accomplished cell
- Change the reaction I put on a teammate's cell
- Remove the reaction I put on a teammate's cell
- See the reactions my teammates put on my cells and on each other's cells

## Spec References

- 06-bingo-gameplay.md (cell states, Card Display Rules, Cell Detail Dialog)
- 07-proof-and-approval.md (proof request, thread closure)
- 09-bingo-card-editing.md (a cell edit resets the state)
- 11-real-time-card-updates.md (card room signals)
- 16-games.md (players, ended games, leaving a game)
- 18-game-archive.md (archived cards)
- 21-authorization.md (`cell.react` permission)

## In Scope

- The reaction pool
- Adding, changing and removing a reaction
- Showing reactions on the card, live and archived
- Losing reactions when a cell is no longer stamped

## Out of Scope

- Notifications about reactions (spec 19 is unchanged)
- Showing who put a reaction
- Reactions on other cell states, on empty or Joker cells, or on one's own cells
- Reaction counts, leaderboards or any effect on the game

## Definitions

- **Stamped cell**: a cell in state `completed` or `accomplished` (spec 06, Card Display Rules).
- **Teammate's cell**: a cell on the card of another player of the same running game (spec 16).

## Functional Requirements

### Reaction Pool

A reaction is one of a fixed pool of six, identified by a stable id:

| Id | Shows |
| -- | ----- |
| `heart` | A red heart |
| `thumbs_up` | A thumbs up |
| `fire` | A flame |
| `star` | A gold star |
| `smile` | A smiling face |
| `party` | A party popper |

Each reaction is drawn as a simple inline SVG that the app ships itself, so it looks the same on every device and needs no external asset. Its name is translated (spec 15) and used as its accessible label.

### Who Can React

- A player can react to a teammate's stamped cell, on a running game.
- A player cannot react to their own cells.
- A player has **at most one** reaction per teammate cell. Many teammates can react to the same cell.

### Adding, Changing and Removing

- Adding a reaction gives it a **random placement**: a spot in the cell, a tilt and a size. The server picks the placement and stores it, so every viewer sees the same layout.
- Changing a reaction replaces the emoji and picks a **new** random placement.
- Removing a reaction deletes it. Removing a reaction that does not exist succeeds and changes nothing.

### Losing Reactions

A cell loses **all** its reactions when it stops being stamped, whatever the reason:

- A proof request moves it to `pending_review` (spec 07).
- An undo, a rejected review, a cell edit or automatic completion moves it to `pending` (specs 06, 07, 09).

A cell that becomes stamped again starts with no reaction. A cell that goes from `completed` to `accomplished` through a review has already lost its reactions when the proof was requested.

When a player leaves a game (spec 16), their cells are deleted with their reactions. Reactions they put on other players' cells stay.

### Card Display

- Reactions are drawn on top of the stamp and below the title, so the title stays readable. Each reaction is clearly smaller than the stamp.
- The spot is stored as the position of the reaction's center, in percent of the cell's width and height, between 15 and 85, so the reaction stays inside the cell.
- The tilt is stored as a rotation around the reaction's center, in whole degrees between −45 and 45.
- The size is stored as a scale, in whole percent between 75 and 125 of the base reaction size.
- Reactions are clipped to the cell, so a tilted or enlarged reaction near an edge never sticks out of it.
- Reactions show on every view of a card: the game page, the dashboard and archived games.
- Reactions appear without animation.

### Reacting in the Cell Detail Dialog

- For a player viewing a teammate's stamped cell, the cell detail dialog (spec 06) shows a **React** row with one button per reaction in the pool.
- The button of the viewer's current reaction on that cell is shown as selected.
- Pressing an unselected button adds that reaction, or changes the current one to it.
- Pressing the selected button removes the reaction.
- The row updates as soon as the request succeeds. A failed request shows the error and leaves the row as it was.
- The row is not shown to the card owner, on other states, or on archived games.

### Ended and Archived Games

- Once a game has ended, its reactions can no longer be added, changed or removed.
- When the game is archived, every reaction of its cards is copied into the archive with its emoji and placement, and archived cards show them read-only (spec 18).

## Backend Rules

Both routes are cell routes: every refusal is `400`, and `401` when not logged in (spec 21, Status Rules). Checks run in this order: the cell exists and is not the Joker, its game is running, the caller holds `cell.react` in that game, the caller does not own the card, the cell is stamped, and (for `PUT`) the reaction is in the pool.

### `PUT /api/cells/[cellId]/reaction`

- Body: `{ reaction: <id> }`.
- Adds the caller's reaction, or changes the emoji of their existing reaction, with a new random placement each time.
- The insert is guarded by the cell's state in the same statement, so a reaction is never stored on a cell that is no longer stamped.
- Signals the team's card room (spec 11).
- Returns `{ reaction: { userId, reaction, x, y, rotation, scale } }`.

### `DELETE /api/cells/[cellId]/reaction`

- Removes the caller's reaction on the cell, if any.
- Signals the team's card room when a reaction was removed.
- Returns `{ success: true }`.

### Clearing

Every write that moves a cell out of a stamped state also deletes the cell's reactions, after the state change and in the same transaction when there is one. The delete is guarded by the cell's current state, so it never removes reactions from a cell that is stamped.

### Reading

The cells returned with a card (`GET /api/games/[gameId]/cards`, the dashboard card) carry `reactions`: a list of `{ userId, reaction, x, y, rotation, scale }`, empty for unstamped, empty and Joker cells. Archived cells carry `reactions` as `{ reaction, x, y, rotation, scale }`.

## Data Model

### `cell_reactions`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `cell_id` | VARCHAR(36) | FK → `bingo_cells`, `ON DELETE CASCADE` |
| `user_id` | VARCHAR(36) | The player who reacted. FK → `users`, `ON DELETE CASCADE` |
| `reaction` | VARCHAR(32) | A reaction id from the pool |
| `pos_x`, `pos_y` | TINYINT UNSIGNED | Center of the reaction, in percent (15–85) |
| `rotation` | TINYINT | Tilt, in degrees (−45–45). Default `0` |
| `scale` | TINYINT UNSIGNED | Size, in percent of the base size (75–125). Default `100` |
| `created_at`, `updated_at` | TIMESTAMP | |

Primary key `(cell_id, user_id)`: one reaction per player per cell.

### `archived_cell_reactions`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `archived_game_id`, `user_id`, `position` | | The archived cell. FK → `archived_cells`, `ON DELETE CASCADE` |
| `reactor_user_id` | VARCHAR(36) | The player who reacted. No foreign key (spec 18, Independence) |
| `reaction` | VARCHAR(32) | |
| `pos_x`, `pos_y` | TINYINT UNSIGNED | |
| `rotation` | TINYINT | |
| `scale` | TINYINT UNSIGNED | |

Primary key `(archived_game_id, user_id, position, reactor_user_id)`.

**Migration:** `V5_13_0__cell_reactions.sql` creates both tables. Existing cells start with no reaction. `V5_13_1__reaction_tilt_and_scale.sql` adds `rotation` and `scale` to both tables; reactions stored before it keep no tilt and the base size.

## Acceptance Criteria

- A player can add one reaction from the pool to a teammate's `completed` or `accomplished` cell, and it appears at a random spot inside the cell, with a random tilt between −45° and 45° and a random size between 75% and 125% of the base size.
- Every viewer of the card sees the reaction at the same spot, tilt and size, without reloading the page.
- A player can change their reaction, which gets a new random spot, tilt and size, and remove it.
- A player has at most one reaction per teammate cell.
- A player cannot react to their own cells, to unstamped, empty or Joker cells, or on an ended game (API returns `400`).
- A non-player cannot react (API returns `400`).
- When a cell moves to `pending_review` or `pending`, all its reactions are deleted, and they do not come back if it is stamped again. A reaction added after that gets a new random spot, tilt and size.
- Reactions are drawn above the stamp, below the title, and smaller than the stamp.
- An archived game shows the reactions its cards had when the game ended, read-only.
