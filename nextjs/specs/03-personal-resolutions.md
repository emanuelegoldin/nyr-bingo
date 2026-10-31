# 03 — Personal Resolutions and Resolution Types

## Purpose
Allow users to manage a list of personal resolutions that can be used to fill their bingo card, and define the resolution types shared by personal, team and member-provided resolutions.

## User Stories Covered
- Add, update, and delete resolutions
- Choose between a simple, a checklist and a repeatable resolution
- Track progress on checklist and repeatable resolutions

## In Scope
- CRUD for a user's personal resolutions
- Resolution types and their progress mechanics
- Resolution scopes

## Resolution Model
All resolutions live in the `resolutions` table.

### Types
| Type | UI label | Type-specific data | Progress |
| ---- | -------- | ------------------ | -------- |
| `base` | Common | none | None; completion is set manually on the card (spec 06) |
| `compound` | Complex | `subtasks`: `{ title, description, completed }[]` | Complete when every subtask is completed |
| `iterative` | Iterative | `numberOfRepetition`, `completedTimes` | Complete when `completedTimes >= numberOfRepetition` |

### Scopes
| Scope | Meaning | Owner (`ownerUserId`) | Extra fields |
| ----- | ------- | --------------------- | ------------ |
| `personal` | The user's own resolution | The user | none |
| `team` | The team goal; one per team (spec 04) | The team leader | `teamId` |
| `member_provided` | Written by one member for another (spec 04) | The author | `teamId`, `toUserId` |

Every type is available in every scope.

## Functional Requirements
### Create and Update
`POST /api/resolutions/save`

- Without `id` the request creates a resolution; with `id` it updates one.
- Body: `type`, `title`, optional `text`, `subtasks` (compound), `numberOfRepetition` (iterative), `previousType` (when changing type), and `scope`, `teamId`, `toUserId` for non-personal scopes.
- `scope` defaults to `personal`.

Updating without changing type:
- `compound`: subtasks are replaced by the submitted list, including their `completed` flags.
- `iterative`: `completedTimes` is preserved.

Changing type (a save whose `type` differs from the stored type):
- Title, description and the type-specific data are rewritten, and progress resets (`completedTimes = 0`).
- `bingo_cells.resolution_type` is updated on every cell referencing the resolution.
- Cell states are not changed.

### Read
- `GET /api/resolutions/all` lists the caller's personal resolutions of every type, newest first. `/resolutions` shows this list with a type badge and progress.
- `GET /api/resolutions/compound` and `GET /api/resolutions/iterative` list the caller's personal resolutions of that type.
- With `?id=<id>` those two endpoints return a single resolution, under the visibility rules of spec 13.

### Delete
- `DELETE /api/resolutions?id=<id>`, `DELETE /api/resolutions/compound?id=<id>` and `DELETE /api/resolutions/iterative?id=<id>`.
- The resolution's history entries are deleted with it.
- Bingo cells referencing it keep their source type and state but lose the reference (`resolution_id` is set to `NULL`).

### Progress
- `PATCH /api/resolutions/compound/[id]/toggle` with `{ subtaskIndex }` toggles one subtask. An index that is not an existing subtask's position returns `400`.
- `PATCH /api/resolutions/iterative/[id]/increment` adds one to `completedTimes`. There is no upper limit, so the counter can exceed the target.
- `PATCH /api/resolutions/iterative/[id]/decrement` subtracts one, with a floor of 0.
- Each change logs a history event (spec 13) and updates linked bingo cells (spec 06).
- Progress is stored on the resolution, so it is shared by every cell referencing that resolution.

## Permissions
- Only the owner can update or delete a resolution.
- Progress on a `personal` resolution can only be changed by its owner.
- Progress on a `member_provided` resolution can only be changed by its recipient (`toUserId`), not by its author.
- Personal resolutions are available to unverified users.

## Constraints
- Title must be non-empty. It is trimmed and truncated to 255 characters.
- Description is optional. For `base` resolutions it defaults to the title.
- `compound` requires at least one subtask, each with a non-empty title.
- `iterative` requires `numberOfRepetition >= 2`. The form additionally requires an integer.

## Acceptance Criteria
- User can create, edit, delete, and list their own resolutions of every type.
- User can change the type of a resolution, which resets its progress.
- Compound subtasks can be toggled and iterative counters can be changed.
- User cannot modify someone else's resolutions.

## Known Gaps
- Deleting a resolution that is on a bingo card leaves a blank, non-empty cell that keeps its source and has no text. A `base` cell still opens an empty dialog. A `compound` or `iterative` cell is clickable but nothing opens. The team goal can be deleted this way through the API, although the UI offers no such action.
- Saving a resolution with a changed type or target does not re-evaluate its cells, so a cell can stay `completed` after its goal was raised, or `pending` after it was lowered.
