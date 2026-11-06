# 06 — Bingo Gameplay

## Purpose

Allow users to track progress on their bingo card by marking resolutions as completed or undoing mistakes, while accurately reflecting cell states that may be impacted by team-based proof review.

This specification focuses on **card interaction and cell state changes**, not on proof submission or review mechanics.

---

## User Stories Covered

- Mark a resolution as completed on my bingo card
- Undo a mistakenly marked completion
- Mark a resolution as failed, and still complete it later
- Complete a checklist or repeatable resolution by making progress on it
- View my own bingo card state
- View other team members' bingo card states
- See when a resolution is under review or finalized

---

## In Scope

- Bingo cell state transitions
- Completion and undo flows
- Automatic completion for typed resolutions
- Mapping cell states to UI-visible card states
- Permissions for interacting with card cells

---

## Cell States

State is stored per cell (`bingo_cells.state`). So is progress (`bingo_cells.completed_times` and `bingo_cell_subtasks.completed`, spec 05). The same resolution can appear in several cells, each with its own state and progress.

- `pending`
  Default state. Resolution has not been completed.

- `completed`
  Resolution marked completed. Proof has **not** been requested.

- `pending_review`
  Proof has been requested by another team member and is under review.

- `accomplished`
  Proof has been accepted and the resolution is finalized.

- `failed`
  The owner marked the resolution as failed. It behaves as `pending` and can still be completed at any time.

---

## Card Display Rules

| State | Cell | Marker |
| ----- | ---- | ------ |
| `pending` | Default | None |
| `completed` | Default | Green check stamp |
| `pending_review` | Default | Yellow hourglass |
| `accomplished` | Default, text struck through | Blue check stamp |
| `failed` | Red | X |

A check stamp is a round stamp with a checkmark inside, drawn over the cell so the title stays readable. The hourglass is a simple upright hourglass drawn over the centre of the cell in the same way; it is not a stamp (spec 24). The state badge in the cell detail dialog keeps its colours and icons.

**Stamp animation.** When a cell becomes `completed` or `accomplished` while the card is shown, for any reason (the owner's action, progress, a live update or a review result), its stamp fades in and presses onto the cell. If one of the cell's dialogs is open, the animation plays after the dialog closes. It does not play for cells that are already stamped when the card loads, or when the user prefers reduced motion. The animation is short and subtle, because it repeats often.

**Hourglass animation.** When a cell becomes `pending_review` while the card is shown, its hourglass fades in, shakes briefly left and right, and settles centred on the cell. The same rules as the stamp animation apply: it waits for an open dialog of the cell to close, and does not play on load or when the user prefers reduced motion.

**Card grid.** The cells form a ruled grid, like a printed bingo card: square cells touch each other and are separated by thin lines in the primary colour, inside a thicker frame of the same colour. This applies to live and archived cards. A clickable cell shows a background highlight on hover.

**Reactions.** Teammates can put small emoji reactions on a stamped cell. They are drawn above the stamp and below the title (spec 24).

Every non-empty, non-joker cell shows its title. On `sm` screens and wider it also shows a source badge: "Team Goal", the provider's username, or "Personal". A member-provided cell whose provider is no longer a player of the game (spec 16, Leaving a Game) shows "Former Teammates", without a profile link.

---

## Functional Requirements

### Cell Detail Dialog

Outside edit mode, clicking any non-empty, non-joker cell, on any card, opens a detail dialog with the cell's own title, description, state, type and source, read from `GET /api/cells/[cellId]` (the snapshot, its subtasks and its progress). It also offers:

| Viewer | Condition | Action |
| ------ | --------- | ------ |
| Anyone | Always | **History** of the cell (spec 13) |
| Card owner | `base`, `pending` or `failed` | **Mark Complete** |
| Card owner | `pending`, any type | **Mark Failed** |
| Card owner | `base`, `completed` | **Undo** |
| Card owner | `failed`, any type | **Undo** |
| Non-owner | `completed` | **Request Proof** (spec 07) |
| Non-owner | `completed` or `accomplished` | **React** row (spec 24) |
| Anyone | `pending_review` | **View Thread** (spec 07) |

For `compound` and `iterative` cells the dialog shows the checklist or counter, with controls enabled for the card owner only, on every source including `team` cells. Everyone else sees them read-only, and the API refuses their changes (spec 21).

The `base` row applies to the cell's type, so a `base` team goal is completed manually, cell by cell, by each member.

---

### Mark Resolution as Completed

`PUT /api/cells/[cellId]` with `{ state: 'completed' }`

- Only the card owner can mark a cell as completed.
- Marking completion transitions `pending` or `failed` → `completed`.
- No proof or review is triggered automatically.

---

### Mark Resolution as Failed

`PUT /api/cells/[cellId]` with `{ state: 'failed' }`

- Only the card owner can mark a cell as failed.
- Marking failure transitions `pending` → `failed`, for every resolution type. No confirmation is asked.
- A `completed` cell must be undone first.
- A failed cell does not count as done for the leaderboard or bingo lines (spec 12).
- A cell that was failed and then completed behaves as any `completed` cell. Undoing it, or a rejected review, returns it to `pending`, not to `failed`.

---

### Progress on a Cell (compound and iterative)

Progress is stored on the cell and changed only by the card owner, only while the game has not ended (spec 16):

- `PATCH /api/cells/[cellId]/subtasks/[index]/toggle` toggles one subtask of a `compound` cell. An index that is not an existing subtask's position returns `400`.
- `PATCH /api/cells/[cellId]/progress/increment` adds one to `completed_times` of an `iterative` cell. There is no upper limit, so the counter can exceed the target.
- `PATCH /api/cells/[cellId]/progress/decrement` subtracts one, with a floor of 0.
- A route used on a cell of the wrong type returns `400`.
- Each change logs a history event on the cell (spec 13) and signals the cell's card room (spec 11).

Refusals follow spec 21: `401` when not logged in, and the cell-route status for an unknown cell, a caller who does not own the card, or an ended game.

### Automatic Completion (compound and iterative)

These types have no manual Mark Complete in the UI, and no manual Undo except from `failed`. After a subtask toggle or counter change, only the cell whose progress changed is updated. No other cell is touched, even one copied from the same resolution:

- Progress complete and cell `pending` or `failed` → `completed`
- Progress incomplete and cell `completed` → `pending`
- Progress incomplete and cell `failed` is left unchanged
- A cell in `pending_review` or `accomplished` is left unchanged

Progress is complete when every subtask of the cell is completed (`compound`), or when the cell's `completed_times >= number_of_repetition` (`iterative`).

---

### Undo Completion

`POST /api/cells/[cellId]/undo-complete`

- The API accepts `completed`, `pending_review`, `accomplished` and `failed`, and rejects `pending`.
- Undoing:
  - Transitions the cell back to `pending`
  - Closes any open proof review thread
  - Deletes the thread's messages and file records (spec 07)
- The UI offers Undo only for `base` cells in `completed` and for cells of any type in `failed`. A cell in `pending_review` is reverted by closing the thread (spec 07).

---

### Viewing Other Cards

- Team members can view other users' bingo cards on the game page.
- Team members **cannot** directly set others' cell states. Another member's cell changes only through proof review (spec 07).

---

## Non-Checkable Cells

- Empty filler cells cannot be marked completed or failed and are not clickable outside edit mode.
- The center Joker cell is informational only and not clickable.

---

## Permissions

- Only the card owner can manually:
  - Mark a cell completed
  - Mark a cell failed
  - Undo completion or failure
  - Change subtask and counter progress on a cell
- Team members can:
  - View other cards
  - Initiate proof review flows (see spec 07)

---

## Acceptance Criteria

- User can mark a `base` resolution completed.
- User can undo a completed `base` resolution.
- `compound` and `iterative` cells complete and revert automatically with progress.
- Progress on a cell does not change any other cell, even one copied from the same resolution.
- Only the card owner can change progress on a cell, and not after the game has ended.
- Two players track the same team goal independently, each on their own cell.
- User can mark a `pending` cell of any type as failed, and undo it back to `pending`.
- A failed `base` cell can be marked completed, and a failed `compound` or `iterative` cell completes automatically.
- Empty and joker cells are not checkable and cannot be failed.
- Cell states are accurately reflected on the bingo card.
- `completed` and `accomplished` cells show a green or blue check stamp instead of a coloured background.
- A cell that becomes stamped while the card is shown plays the stamp animation once, after any open dialog of that cell closes. Cells stamped on load, and users who prefer reduced motion, see no animation.
- `pending_review` cells show a yellow hourglass instead of an amber background.
- A cell that becomes `pending_review` while the card is shown plays the hourglass animation once, under the same conditions as the stamp animation.
- Review-related states do not break card interaction.

---

## Out of Scope

- Proof upload
- Review threads, voting, or comments
- Approval logic

These concerns are handled in **07 — Proof and Approval**.

---

## Known Gaps

- An `accomplished` cell has no Undo in the UI.
