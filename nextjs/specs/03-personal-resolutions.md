# 03 — Personal Resolutions and Resolution Types

## Purpose
Allow users to manage a list of personal resolutions that can be used to fill their bingo card, and define the resolution types shared by personal, team and member-provided resolutions. A resolution is a definition only. Progress is tracked on the bingo cells that were generated from it (spec 06).

## User Stories Covered
- Add, update, and delete resolutions
- Choose between a simple, a checklist and a repeatable resolution

## In Scope
- CRUD for a user's personal resolutions
- Resolution types and their type-specific data
- Resolution scopes

## Resolution Model
All resolutions live in the `resolutions` table.

### Types
| Type | UI label | Type-specific data | Completion on a card cell (spec 06) |
| ---- | -------- | ------------------ | ----------------------------------- |
| `base` | Common | none | Set manually on the card |
| `compound` | Complex | `subtasks`: `{ title, description }[]` | Complete when every subtask of the cell is completed |
| `iterative` | Iterative | `numberOfRepetition` | Complete when the cell's `completed_times >= numberOfRepetition` |

A resolution holds no progress: it has no `completed_times` and its subtasks have no `completed` flag. The progress is stored on each bingo cell (spec 05).
### Scopes
| Scope | Meaning | Owner (`ownerUserId`) | Extra fields |
| ----- | ------- | --------------------- | ------------ |
| `personal` | The user's own resolution | The user | none |
| `team` | The team goal; one per game (spec 16) | The team leader | `teamId`, `gameId` |
| `member_provided` | Written by one member for another, for one game (spec 16) | The author | `teamId`, `gameId`, `toUserId` |

Every type is available in every scope.

Prepared fallbacks on a card (specs 05, 17) have no scope and no resolution row: they are copied straight from the prepared pool onto the cell.

## Functional Requirements
### Create and Update
`POST /api/resolutions/save`

- Without `id` the request creates a resolution; with `id` it updates one.
- Body: `type`, `title`, optional `text`, `subtasks` (compound), `numberOfRepetition` (iterative), `previousType` (when changing type), and `scope`, `gameId`, `toUserId` for non-personal scopes. The team is taken from the game.
- `scope` defaults to `personal`.

Updating without changing type:
- `compound`: subtasks are replaced by the submitted list.
- `iterative`: the target is replaced by the submitted `numberOfRepetition`.

Changing type (a save whose `type` differs from the stored type):
- Title, description and the type-specific data are rewritten.

Saving a resolution never changes any bingo cell. Cells hold a snapshot of the definition taken when the card was generated or the cell was edited (specs 05, 09), so existing cards keep the old title, description, type, target and subtasks.

### Read
- `GET /api/resolutions/all` lists the caller's personal resolutions of every type, newest first. `/resolutions` shows this list with a type badge. It shows definitions only: no progress, no subtask checking, no counter and no history.
- `GET /api/resolutions/compound` and `GET /api/resolutions/iterative` list the caller's personal resolutions of that type.
- With `?id=<id>` those two endpoints return a single resolution of the caller, as a definition only. Another user's resolution returns `404`, and so does one of another type.

### Delete
- `DELETE /api/resolutions?id=<id>`, `DELETE /api/resolutions/compound?id=<id>` and `DELETE /api/resolutions/iterative?id=<id>`.
- Bingo cells generated from it are not changed: they keep their snapshot, their progress, their history and their state. Only the link to the source resolution is lost (`resolution_id` is set to `NULL`).

### Progress
Resolutions have no progress endpoints. Subtasks and counters are changed on the bingo cell, through `/api/cells/[cellId]/...` (spec 06).

## Permissions
- Only the owner can update or delete a resolution.
- Progress is not a permission of the resolution: it belongs to the owner of the card holding the cell (spec 06).
- Personal resolutions are available to unverified users.
- The team goal and member-provided resolutions of an ended game cannot be saved or deleted (spec 16).

## Constraints
- Title must be non-empty. It is trimmed and truncated to 255 characters.
- Description is optional. For `base` resolutions it defaults to the title.
- `compound` requires at least one subtask, each with a non-empty title.
- `iterative` requires `numberOfRepetition >= 2`. The form additionally requires an integer.

## Acceptance Criteria
- User can create, edit, delete, and list their own resolutions of every type.
- User can change the type of a resolution.
- The personal resolutions page shows definitions only, with no progress, subtask checking, counter or history.
- Editing or deleting a resolution does not change existing cards.
- User cannot modify someone else's resolutions.

## Known Gaps
- The team goal can be deleted through the API, although the UI offers no such action. Existing cards keep their snapshot of it.
