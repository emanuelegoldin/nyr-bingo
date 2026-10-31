# 09 — Bingo Card Editing

## Purpose
Allow a card owner to update the *content* of a generated bingo card after the game has started, by replacing any non-joker cell with a compatible resolution.

Team goal cells are not editable in this flow.

This spec defines:
- UI edit mode behavior
- Allowed replacement sources
- Backend validation and persistence rules

## Spec References
- 03-personal-resolutions.md (personal resolutions list)
- 04-bingo-teams.md (member-provided resolutions)
- 05-bingo-card-generation.md (joker immutability)
- 06-bingo-gameplay.md (cell state model)

## In Scope
- Editing card content (resolution reference and source metadata) for a card the user owns
- Editing empty filler cells
- Resetting edited cells back to `pending`

## Out of Scope
- Editing gameplay state via this flow (mark complete/undo)
- Editing the joker cell
- A UI option for clearing a cell back to empty

## Definitions
- **Card owner**: the user whose `bingo_cards.user_id` matches the authenticated user.
- **Member-provided resolution**: a row in `resolutions` where:
  - `scope = 'member_provided'`
  - `team_id` equals the card's `bingo_cards.team_id`
  - `to_user_id` equals the card owner
- **Personal resolution**: a row in `resolutions` where `scope = 'personal'` and `owner_user_id` is the card owner.

## Functional Requirements

### 1) Enter/Exit Edit Mode
- Edit mode is available on the dashboard only, through the **Edit Card** button on each of the user's cards (spec 14). The team page has no edit mode.
- While in edit mode the button reads **Done** and exits edit mode.

### 2) Selectable Cells in Edit Mode
- While in edit mode, the card owner can select **any non-joker, non-team cell**, including empty filler cells, in any state except `pending_review`.
- The joker (center) cell cannot be selected.
- A team goal cell (`source_type = 'team'`) cannot be selected.

### 3) Replacement Options
Selecting a cell opens a dialog listing replacement options:
- All member-provided resolutions for the team, targeted to the current user: `GET /api/teams/[teamId]/resolutions?toUserId=<currentUserId>`
- All personal resolutions of every type owned by the user: `GET /api/resolutions/all`

The list:
- Excludes resolutions already on the card
- Can be filtered by a text input
- Shows a badge with the source (provider's username or "Personal"), and the type for compound and iterative resolutions

### 4) Apply or Cancel
- The user can either select a replacement option or dismiss the dialog.
- If the user dismisses it, the dialog closes and the card stays in edit mode.

### 5) Persisting a Cell Edit
When a replacement option is selected, the system updates the cell via `PUT /api/cells/[cellId]/edit`:
- `bingo_cells.resolution_id`
- `bingo_cells.resolution_type`
- `bingo_cells.source_type`
- `bingo_cells.source_user_id` (`NULL` when absent)
- `bingo_cells.state`, reset to `pending`

`is_empty` follows from these values because it is a generated column.

### 6) Permissions & Safety
- Only the card owner can edit the content of cells on their card.
- Attempts to edit the joker cell fail.
- Attempts to edit a team goal cell fail.
- Attempts to edit a cell under review fail, so a review always concerns the content it was opened on.

## Backend Rules

### `PUT /api/cells/[cellId]/edit`
Request body (JSON):
- `sourceType: 'member_provided' | 'personal' | 'empty'` (required)
- `resolutionId: string | null` (optional)

The cell's `resolution_type` and `source_user_id` come from the resolution. Other fields in the body are ignored.

Request constraints:
- If `sourceType` is `personal` or `member_provided`, `resolutionId` is required.
- If `sourceType` is `empty`, `resolutionId` must be null/omitted.

Validation:
- Auth required
- The authenticated user MUST be the card owner for the specified cell
- The specified cell MUST NOT be a joker cell (`joker:` id)
- The specified cell MUST NOT be a team goal cell
- The specified cell MUST NOT be in `pending_review`
- For `personal`, the resolution MUST be the caller's own personal resolution
- For `member_provided`, the resolution MUST be proposed to the caller in the card's team
- The resolution MUST NOT already be on another cell of the card

Validation failures return `400` with a message.

Effects:
- Update the cell content fields and set state to `pending`

### `GET /api/teams/[teamId]/resolutions?toUserId=...`
- Auth required
- The authenticated user MUST be a member of the team
- Returns the list of member-provided resolutions targeted to `toUserId`

## Acceptance Criteria
- A card owner can enter and exit edit mode from the dashboard.
- In edit mode, the owner can select any non-joker, non-team cell not under review (including empty).
- On selection, the UI shows a list combining:
  - `GET /api/resolutions/all`
  - `GET /api/teams/[teamId]/resolutions?toUserId=<currentUserId>`
- Selecting an option updates the cell via `PUT /api/cells/[cellId]/edit`.
- Dismissing the dialog returns to the card still in edit mode.
- The joker cell cannot be modified (both UI and API enforce this).
- The team goal cell cannot be modified (both UI and API enforce this).
- On edit, the cell updates `resolution_id`, `resolution_type`, `source_type`, `source_user_id` (NULL when absent), and resets state to `pending`.

## Known Gaps
- `sourceType = 'empty'` is accepted, so a cell can be cleared through the API although the UI has no such option.
- The rule against duplicate text (spec 05) is not applied to edits: the UI and API only compare resolution ids, so a resolution with the same text as another cell can be selected.
- Editing a cell does not refresh the leaderboard, so a completed cell that was edited stays counted until the owner's next leaderboard refresh.
