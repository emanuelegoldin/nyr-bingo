# 13 — Resolution History and Progress

## Purpose

Allow users to record and share progress updates on a resolution through a single history timeline that is consistent wherever that resolution is shown.

The timeline supports:
- Manual text entries by the user who works on the resolution.
- Automatic system events produced by resolution actions.

---

## User Stories Covered

- As a resolution owner, I can add text updates to a personal resolution's history.
- As the recipient of a member-provided resolution, I can add text updates to its history.
- As a team member, I can view another member's resolution history when I am eligible to view that resolution in my team context.
- As a user, I see the same history no matter whether I open it from my personal resolutions page or from a bingo card cell dialog.
- As a teammate, I can observe progress updates without data divergence across views.

---

## In Scope

- History timeline stored per `resolution_id`.
- Manual history text entries.
- Automatic history events for:
  - Resolution creation.
  - Resolution save and type change.
  - Iterative progress increment/decrement.
  - Compound subtask toggle.
- Read and write API routes for resolution history.
- Resolution-history viewing entry points from:
  - Personal resolutions page.
  - Resolution detail dialog from card cells.
- Real-time propagation using the resolution-level WebSocket refresh flow (spec 11).

---

## Out of Scope

- External/public share links outside team context.
- Per-entry privacy toggles.
- Rich media uploads inside history entries.
- Editing/deleting existing history entries.

---

## Definitions

- **History entry**: one immutable timeline item attached to `resolution_id`.
- **Manual entry**: a free-text item (`manual_note`) created by a user allowed to write.
- **System event**: an automatically generated timeline item (`system_event`), authored by the acting user.

---

## Functional Requirements

### 1) Single Source of Truth

- Resolution history is stored once per resolution (`resolution_id`) and not per cell.
- Any UI surface displaying that resolution reads the same underlying history.

### 2) Manual Entry Creation

Who can write depends on the resolution's scope:

| Scope | Allowed writer |
| ----- | -------------- |
| `personal` | The resolution owner |
| `member_provided` | The recipient (`toUserId`), not the author |
| `team` | Nobody |

Manual entry content must be non-empty text.

### 3) History Visibility

- Owner can always view the history of their own resolution.
- For `scope = team` and `scope = member_provided` resolutions:
  - Team members of the associated team can view history.
- For `scope = personal` resolutions:
  - A user can view history only if the resolution appears in at least one bingo card of a team they belong to.
- Anyone else receives `403`.

### 4) Sharing Policy

- History is shared with all eligible teammates by default.
- There is no opt-in toggle.

### 5) Automatic Event Logging

| Action | `event_key` |
| ------ | ----------- |
| Resolution created | `resolution.created` |
| Resolution saved, same type | `resolution.updated` |
| Resolution type changed | `resolution.type_changed` |
| Compound subtask toggled | `resolution.compound_subtask_toggled` |
| Iterative incremented | `resolution.iterative_incremented` |
| Iterative decremented | `resolution.iterative_decremented` |

A failure to log an event does not fail the action that produced it.

### 6) Surface Availability

- The personal resolutions page offers a button that opens a resolution's history.
- The resolution detail dialog from a bingo card cell offers a **History** button that opens the same history.
- The history dialog shows the note form only when the API reports `canWrite`.

### 7) Real-Time Update Behavior

- After a manual note, a subtask toggle or a counter change, the client sends `resolution-refresh` (spec 11) so other viewers reload the timeline.
- This applies only inside a `TeamWsProvider`, meaning on the team page and the dashboard. On the personal resolutions page the WebSocket functions are no-ops.
- Saving a resolution sends no refresh message.
- The API remains the source of truth.

---

## Permissions

- Auth required for all resolution history APIs.
- Write allowed only under the table in section 2.
- Read allowed only under the visibility rules above.

---

## API Endpoints

### `GET /api/resolutions/[id]/history`

- Returns `{ entries, canWrite }`, with entries ordered newest-first.
- Each entry includes the author's id and username.
- Supports pagination parameters:
  - `limit`: default `50`, capped at `100`, must be greater than 0
  - `offset`: default `0`, must not be negative
- Returns `400` for invalid pagination values.
- Returns `403` when the caller is not authorized to view.
- Returns `404` when the resolution does not exist.

### `POST /api/resolutions/[id]/history`

- Creates a manual history entry and returns it with status `201`.
- Body:
  - `content: string` (required)
- Returns `400` when `content` is empty.
- Returns `403` when the caller is not allowed to write.
- Returns `404` when the resolution does not exist.

---

## Data Model

Table `resolution_history_entries` (migration `V3_3_0`):
- `id`
- `resolution_id` (FK → `resolutions.id`, ON DELETE CASCADE)
- `author_user_id` (FK → `users.id`, ON DELETE CASCADE)
- `entry_type` (`manual_note` | `system_event`)
- `event_key` (nullable)
- `content`
- `metadata_json` (nullable)
- `created_at`

Entries are immutable.

---

## Acceptance Criteria

- [ ] Personal resolution owner can add manual history entries.
- [ ] Member-provided recipient can add manual history entries.
- [ ] Other users cannot create manual history entries.
- [ ] Team member can view history when visibility rules permit.
- [ ] Non-member cannot view history.
- [ ] Personal page and card detail dialog show the same timeline for the same resolution.
- [ ] Automatic events are recorded for iterative and compound progress actions.
- [ ] Resolution create and save operations produce history events.
- [ ] Notes and progress updates propagate using resolution-refresh on the team page and dashboard.

---

## Known Gaps

- Nobody can add manual notes to a team goal. A `TODO` in `getResolutionHistoryAccess` records that the card owner cannot be determined from the resolution alone.
