# 13 — Resolution History and Progress

## Purpose

Allow users to record and share progress updates on a resolution through a single history timeline that is consistent wherever that resolution is shown.

The timeline supports:
- Manual text entries by the resolution owner.
- Automatic system events produced by resolution progress actions.

---

## User Stories Covered

- As a resolution owner, I can add text updates to a resolution history.
- As a team member, I can view another member's resolution history when I am eligible to view that resolution in my team context.
- As a user, I see the same history no matter whether I open it from my personal resolutions page or from a bingo card cell dialog.
- As a teammate, I can observe progress updates without data divergence across views.

---

## In Scope

- History timeline stored per `resolution_id`.
- Manual history text entries.
- Automatic history events for:
  - Iterative progress increment/decrement.
  - Compound subtask toggle.
  - Resolution save/type-change updates.
- Read and write API routes for resolution history.
- Resolution-history viewing entry points from:
  - Personal resolutions page.
  - Resolution detail dialog from card cells.
- Real-time propagation using existing resolution-level WebSocket refresh flow.

---

## Out of Scope

- External/public share links outside team context.
- Per-entry privacy toggles.
- Rich media uploads inside history entries.
- Editing/deleting existing history entries.

---

## Definitions

- **History entry**: one immutable timeline item attached to `resolution_id`.
- **Manual entry**: a free-text item created by the resolution owner.
- **System event**: an automatically generated timeline item produced by system actions.

---

## Functional Requirements

### 1) Single Source of Truth

- Resolution history SHALL be stored once per resolution (`resolution_id`) and not per cell.
- Any UI surface displaying that resolution SHALL read the same underlying history.

### 2) Manual Entry Creation

- Only the resolution owner SHALL be allowed to create manual history entries.
- Manual entry content SHALL be non-empty text.

### 3) History Visibility

- Owner can always view the history of their own resolution.
- For `scope = team` and `scope = member_provided` resolutions:
  - Team members of the associated team can view history.
- For `scope = personal` resolutions:
  - Team members can view history only if the resolution appears in at least one bingo card for a team they belong to.
- Non-members SHALL NOT access history entries through API.

### 4) Sharing Policy

- History is considered shared to all eligible teammates by default.
- No extra opt-in toggle is required for V1.

### 5) Automatic Event Logging

- System events SHALL be added when:
  - A compound subtask is toggled.
  - An iterative resolution is incremented or decremented.
  - A resolution save operation updates content and/or type.

### 6) Surface Availability

- The personal resolutions page SHALL offer a way to open a resolution's history.
- The resolution detail dialog from a bingo card cell SHALL offer a way to open the same history.

### 7) Real-Time Update Behavior

- After a history write or automatic history event, clients SHALL use the existing resolution-level WS room refresh behavior (`resolution-refresh`) so other viewers can reload the timeline.
- The API remains the source of truth.

---

## Permissions

- Auth required for all resolution history APIs.
- Owner-only write for manual entries.
- Read allowed only under the visibility rules above.

---

## API Endpoints

### `GET /api/resolutions/[id]/history`

- Returns history entries for the resolution ordered newest-first.
- Supports pagination parameters (`limit`, `offset`).
- Returns `403` when the caller is not authorized to view.

### `POST /api/resolutions/[id]/history`

- Creates a manual history entry.
- Body:
  - `content: string` (required)
- Returns `403` when caller is not the owner.

---

## Data Model

A new table stores history entries with at least:
- `id`
- `resolution_id`
- `author_user_id`
- `entry_type` (`manual_note` | `system_event`)
- `event_key` (nullable)
- `content`
- `metadata_json` (nullable)
- `created_at`

Entries are immutable.

---

## Acceptance Criteria

- [ ] Owner can add manual history entries for own resolution.
- [ ] Non-owner cannot create manual history entries.
- [ ] Team member can view history when visibility rules permit.
- [ ] Non-member cannot view history.
- [ ] Personal page and card detail dialog show the same timeline for the same resolution.
- [ ] Automatic events are recorded for iterative and compound progress actions.
- [ ] Resolution save updates produce history events.
- [ ] History updates propagate using existing resolution-refresh behavior.
