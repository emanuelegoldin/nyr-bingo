# 13 — Resolution History and Progress

## Purpose

Allow users to record and share progress updates on a bingo cell through a history timeline kept per cell and shown from the cell dialog.

The timeline supports:
- Manual text entries by the owner of the card.
- Automatic system events produced by progress on the cell.

---

## User Stories Covered

- As a card owner, I can add text updates to the history of a cell on my card.
- As a team member, I can view the history of a cell on another player's card when I can view that card.
- As a user, I see the same history of a cell every time I open its dialog.
- As a teammate, I can observe progress updates on a cell as they happen.

---

## In Scope

- History timeline stored per cell (`cell_id`).
- Manual history text entries.
- Automatic history events for:
  - Iterative progress increment/decrement.
  - Compound subtask toggle.
- Read and write API routes for cell history.
- One viewing entry point: the cell dialog on a bingo card. The personal resolutions page has none.
- Real-time propagation using the card room (spec 11).

---

## Out of Scope

- External/public share links outside team context.
- Per-entry privacy toggles.
- Rich media uploads inside history entries.
- Editing/deleting existing history entries.

---

## Definitions

- **History entry**: one immutable timeline item attached to a cell (`cell_id`).
- **Manual entry**: a free-text item (`manual_note`) created by a user allowed to write.
- **System event**: an automatically generated timeline item (`system_event`), authored by the acting user.

---

## Functional Requirements

### 1) Single Source of Truth

- History is stored per cell (`cell_id`), in `cell_history_entries`. It is not shared between cells, even cells copied from the same resolution.
- The cell dialog is the only surface that shows it.

### 2) Manual Entry Creation

Only the owner of the card holding the cell can write, whatever the cell's source (`personal`, `member_provided`, `team` or `prepared`). Other players, including the author of a member-provided resolution and the Team Admin, cannot.

Manual entry content must be non-empty text.

### 3) History Visibility

- Anyone who can view the card the cell is on can read its history: the card owner and the other players of the game (spec 16).
- Anyone else receives `403`.

### 4) Sharing Policy

- History is shared with all eligible teammates by default.
- There is no opt-in toggle.

### 5) Automatic Event Logging

| Action | `event_key` |
| ------ | ----------- |
| Compound subtask toggled | `resolution.compound_subtask_toggled` |
| Iterative incremented | `resolution.iterative_incremented` |
| Iterative decremented | `resolution.iterative_decremented` |

The events are logged on the cell whose progress changed. Saving, changing the type of or deleting a resolution logs nothing, because it does not change any cell (spec 03).

A failure to log an event does not fail the action that produced it.

### 6) Surface Availability

- The cell dialog on a bingo card offers a **History** button that opens the cell's history.
- The personal resolutions page has no history.
- The history dialog shows the note form only when the API reports `canWrite`.

### 7) Real-Time Update Behavior

- After a manual note, a subtask toggle or a counter change, the server signals the `card` room of the cell's card (`refresh-card`, spec 11), so other viewers reload the cell dialog, checklist, counter and timeline.
- This applies inside a `TeamWsProvider`, meaning on the game page and the dashboard.
- The API remains the source of truth.

---

## Permissions

The role-to-permission table and the status of every refusal are defined in spec 21 (Authorization).

- Auth required for all cell history APIs.
- Write allowed only under the table in section 2.
- Read allowed only under the visibility rules above.

---

## API Endpoints

### `GET /api/cells/[cellId]/history`

- Returns `{ entries, canWrite }`, with entries ordered newest-first.
- Each entry includes the author's id and username.
- Supports pagination parameters:
  - `limit`: default `50`, capped at `100`, must be greater than 0
  - `offset`: default `0`, must not be negative
- Returns `400` for invalid pagination values.
- Returns `403` when the caller is not authorized to view.
- Returns `404` when the cell does not exist.

### `POST /api/cells/[cellId]/history`

- Creates a manual history entry and returns it with status `201`.
- Body:
  - `content: string` (required)
- Returns `400` when `content` is empty.
- Returns `403` when the caller is not allowed to write.
- Returns `404` when the cell does not exist.

---

## Data Model

Table `cell_history_entries` (migration `V5_9_0__cell_resolution_snapshot.sql`):
- `id`
- `cell_id` (FK → `bingo_cells.id`, ON DELETE CASCADE)
- `author_user_id` (FK → `users.id`, ON DELETE CASCADE)
- `entry_type` (`manual_note` | `system_event`)
- `event_key` (nullable)
- `content`
- `metadata_json` (nullable)
- `created_at`

Entries are immutable.

The former table `resolution_history_entries` (migration `V3_3_0`) is removed. The migration copied each existing entry onto every cell that referenced its resolution.

---

## Acceptance Criteria

- [ ] The card owner can add manual history entries to a cell on their card.
- [ ] Other users, including the author of a member-provided resolution and the Team Admin, cannot create manual history entries.
- [ ] A player of the game can view the history of any cell on a card of that game.
- [ ] Non-players cannot view history.
- [ ] A cell's history is separate from the history of other cells copied from the same resolution.
- [ ] Automatic events are recorded on the cell for iterative and compound progress actions.
- [ ] Saving or deleting a resolution produces no history event.
- [ ] The personal resolutions page offers no history.
- [ ] Notes and progress updates propagate through the card room on the game page and dashboard.

---

## Known Gaps

- Entries migrated from `resolution_history_entries` can carry the event keys `resolution.created`, `resolution.updated` and `resolution.type_changed`, which are no longer produced.
