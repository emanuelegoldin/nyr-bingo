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

State is stored per cell (`bingo_cells.state`). The same resolution can appear in several cells, each with its own state.

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
| `completed` | Green | Check |
| `pending_review` | Amber | Hourglass |
| `accomplished` | Green, text struck through | Thumbs up |
| `failed` | Red | X |

Every non-empty, non-joker cell shows its title. On `sm` screens and wider it also shows a source badge: "Team Goal", the provider's username, or "Personal".

---

## Functional Requirements

### Cell Detail Dialog

Outside edit mode, clicking any non-empty, non-joker cell that still references a resolution, on any card, opens a detail dialog with the title, description, state, type and source. It also offers:

| Viewer | Condition | Action |
| ------ | --------- | ------ |
| Anyone | Always | **History** (spec 13) |
| Card owner | `base`, `pending` or `failed` | **Mark Complete** |
| Card owner | `pending`, any type | **Mark Failed** |
| Card owner | `base`, `completed` | **Undo** |
| Card owner | `failed`, any type | **Undo** |
| Non-owner | `completed` | **Request Proof** (spec 07) |
| Anyone | `pending_review` | **View Thread** (spec 07) |

For `compound` and `iterative` cells the dialog shows the checklist or counter, with controls enabled for the card owner only. On `team` cells the controls are enabled for the team leader only, and the API returns `403` to anyone else.

The `base` row applies to the resolution's type, so a `base` team goal is completed manually, cell by cell, by each member.

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

### Automatic Completion (compound and iterative)

These types have no manual Mark Complete in the UI, and no manual Undo except from `failed`. After a subtask toggle or counter change (spec 03), every cell referencing the resolution, on any card of a game that has not ended (spec 16), is updated:

- Resolution complete and cell `pending` or `failed` → `completed`
- Resolution incomplete and cell `completed` → `pending`
- Resolution incomplete and cell `failed` is left unchanged
- Cells in `pending_review` or `accomplished` are left unchanged

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
- Team members **cannot** directly set others' cell states. Another member's cell changes only through proof review (spec 07) and through the leader's progress on a typed team goal.

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
- Team members can:
  - View other cards
  - Initiate proof review flows (see spec 07)

---

## Acceptance Criteria

- User can mark a `base` resolution completed.
- User can undo a completed `base` resolution.
- `compound` and `iterative` cells complete and revert automatically with progress.
- User can mark a `pending` cell of any type as failed, and undo it back to `pending`.
- A failed `base` cell can be marked completed, and a failed `compound` or `iterative` cell completes automatically.
- Empty and joker cells are not checkable and cannot be failed.
- Cell states are accurately reflected on the bingo card.
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
