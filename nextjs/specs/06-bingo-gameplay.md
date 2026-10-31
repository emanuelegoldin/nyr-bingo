# 06 — Bingo Gameplay

## Purpose

Allow users to track progress on their bingo card by marking resolutions as completed or undoing mistakes, while accurately reflecting cell states that may be impacted by team-based proof review.

This specification focuses on **card interaction and cell state changes**, not on proof submission or review mechanics.

---

## User Stories Covered

- Mark a resolution as completed on my bingo card
- Undo a mistakenly marked completion
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

---

## Card Display Rules

| State | Cell | Marker |
| ----- | ---- | ------ |
| `pending` | Default | None |
| `completed` | Green | Check |
| `pending_review` | Amber | Hourglass |
| `accomplished` | Green, text struck through | Thumbs up |

Every non-empty, non-joker cell shows its title. On `sm` screens and wider it also shows a source badge: "Team Goal", the provider's username, or "Personal".

---

## Functional Requirements

### Cell Detail Dialog

Outside edit mode, clicking any non-empty, non-joker cell that still references a resolution, on any card, opens a detail dialog with the title, description, state, type and source. It also offers:

| Viewer | Condition | Action |
| ------ | --------- | ------ |
| Anyone | Always | **History** (spec 13) |
| Card owner | `base`, `pending` | **Mark Complete** |
| Card owner | `base`, `completed` | **Undo** |
| Non-owner | `completed` | **Request Proof** (spec 07) |
| Anyone | `pending_review` | **View Thread** (spec 07) |

For `compound` and `iterative` cells the dialog shows the checklist or counter, with controls enabled for the card owner only. On `team` cells only the team leader's actions take effect; other card owners see the same controls, but they change nothing (spec 03, Known Gaps).

The `base` row applies to the resolution's type, so a `base` team goal is completed manually, cell by cell, by each member.

---

### Mark Resolution as Completed

`PUT /api/cells/[cellId]` with `{ state: 'completed' }`

- Only the card owner can mark a cell as completed.
- Marking completion transitions `pending` → `completed`.
- No proof or review is triggered automatically.

---

### Automatic Completion (compound and iterative)

These types have no manual Mark Complete or Undo in the UI. After a subtask toggle or counter change (spec 03), every cell referencing the resolution, on any card, is updated:

- Resolution complete and cell `pending` → `completed`
- Resolution incomplete and cell `completed` → `pending`
- Cells in `pending_review` or `accomplished` are left unchanged

---

### Undo Completion

`POST /api/cells/[cellId]/undo-complete`

- The API accepts `completed`, `pending_review` and `accomplished`, and rejects `pending`.
- Undoing:
  - Transitions the cell back to `pending`
  - Closes any open proof review thread
  - Deletes the thread's messages and file records (spec 07)
- The UI offers Undo only for `base` cells in `completed`. A cell in `pending_review` is reverted by closing the thread (spec 07).

---

### Viewing Other Cards

- Team members can view other users' bingo cards on the team page.
- Team members **cannot** directly set others' cell states. Another member's cell changes only through proof review (spec 07) and through the leader's progress on a typed team goal.

---

## Non-Checkable Cells

- Empty filler cells cannot be marked completed and are not clickable outside edit mode.
- The center Joker cell is informational only and not clickable.

---

## Permissions

- Only the card owner can manually:
  - Mark a cell completed
  - Undo completion
- Team members can:
  - View other cards
  - Initiate proof review flows (see spec 07)

---

## Acceptance Criteria

- User can mark a `base` resolution completed.
- User can undo a completed `base` resolution.
- `compound` and `iterative` cells complete and revert automatically with progress.
- Empty and joker cells are not checkable.
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

- `PUT /api/cells/[cellId]` does not check the resolution type, so `compound` and `iterative` cells can be set manually through the API.
- An `accomplished` cell has no Undo in the UI.
