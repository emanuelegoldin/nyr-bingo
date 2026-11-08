# 03 — Personal Resolutions and Resolution Types

## Purpose
Allow each player to write their own resolutions for a game, which fill their bingo card, and define the resolution types shared by personal, team and member-provided resolutions. A resolution is a definition only. Progress is tracked on the bingo cells that were generated from it (spec 06).

Resolutions exist only within a game. A player writes their personal resolutions for a game in its **Personal** tab (spec 12), mostly during the game's preparation phase (spec 16). The former app-wide list of personal resolutions is kept read-only for a transition period (Legacy Personal Resolutions).

## User Stories Covered
- Add, update, and delete my resolutions for a game
- Choose between a simple, a checklist and a repeatable resolution
- See how many resolutions I still need to fill my card

## In Scope
- CRUD for a player's personal resolutions of a game
- Resolution types and their type-specific data
- Resolution scopes
- The read-only transition of legacy personal resolutions

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
| `personal` | A player's own resolution for one game | The player | `teamId`, `gameId` |
| `team` | The team goal; one per game (spec 16) | The Team Admin | `teamId`, `gameId` |
| `member_provided` | Written by one member for another, for one game (spec 16) | The author | `teamId`, `gameId`, `toUserId` |

Every type is available in every scope.

Prepared fallbacks on a card (specs 05, 17) have no scope and no resolution row: they are copied straight from the prepared pool onto the cell.

## Functional Requirements
### Create and Update
`POST /api/resolutions/save`

- Without `id` the request creates a resolution; with `id` it updates one.
- Body: `type`, `title`, optional `text`, `subtasks` (compound), `numberOfRepetition` (iterative), `previousType` (when changing type), `scope`, `gameId`, and `toUserId` for `member_provided`. The team is taken from the game.
- `scope` defaults to `personal`.
- Every scope requires `gameId` (`400` otherwise). The game must be running (`404` otherwise) and the caller must be one of its players (`403` otherwise, permission `game.propose`, spec 21).
- A personal resolution can be created and changed in the preparation phase and after the game has started (spec 16). One created after the start is not added to the card automatically: the player can place it through card editing (spec 09).
- A legacy personal resolution (no `gameId`) cannot be updated (`400`).

Updating without changing type:
- `compound`: subtasks are replaced by the submitted list.
- `iterative`: the target is replaced by the submitted `numberOfRepetition`.

Changing type (a save whose `type` differs from the stored type):
- Title, description and the type-specific data are rewritten.

Saving a resolution never changes any bingo cell. Cells hold a snapshot of the definition taken when the card was generated or the cell was edited (specs 05, 09), so existing cards keep the old title, description, type, target and subtasks.

### Read
- The game page loads the caller's personal resolutions of the game on the server and shows them in the Personal tab (spec 12), newest first, with a type badge. It shows definitions only: no progress, no subtask checking, no repetition counter and no history.
- `GET /api/games/[gameId]/personal-resolutions` returns the caller's personal resolutions of that game, newest first, to its players only (`403` otherwise). Card editing uses it (spec 09).

### Personal Target
The Personal tab shows a counter `y/target`: `y` is the number of the caller's personal resolutions of the game and `target` is the number of cells left for them on the card:

`target = X − N − 1`, where `X` is the number of positions on the card (`grid_size²`) and `N` is the number of players. The Joker takes one position, the team goal one cell, and each of the other `N − 1` players is expected to provide one resolution. The target is never below `0`.

Example: a 5×5 game with 4 players has a target of `25 − 4 − 1 = 20`.

Writing fewer resolutions than the target is allowed: the missing cells are filled with prepared resolutions (spec 05). Writing more is allowed too: the card takes a random selection.

### Create Dialog
- The **Add resolution** button of the Personal tab opens the resolution dialog with an empty form and the `base` (Common) type selected.
- After a successful save, the dialog is back in that initial state the next time it opens, whatever was entered before. The same applies to every use of the dialog (team goal, member-provided and personal): opening it to create shows an empty form, and opening it to edit shows the resolution being edited.

### Delete
- `DELETE /api/resolutions?id=<id>`.
- Bingo cells generated from it are not changed: they keep their snapshot, their progress, their history and their state. Only the link to the source resolution is lost (`resolution_id` is set to `NULL`).

### Progress
Resolutions have no progress endpoints. Subtasks and counters are changed on the bingo cell, through `/api/cells/[cellId]/...` (spec 06).

## Legacy Personal Resolutions (transition until 2027-05-08)
Before this change, personal resolutions belonged to the user and not to a game. These rows (`scope = personal`, `game_id IS NULL`) are kept, so users can copy the ones they want to keep, until the `/resolutions` page is removed after **8 May 2027**.

- `/resolutions` lists them, newest first, with a type badge and the subtask count or target. The page loads them on the server.
- At the top, a notice explains that the page is obsolete and read-only, that players now write their resolutions in a game's preparation phase, and that the page will be removed after 8 May 2027.
- The page offers no way to create or edit a resolution, and no **Browse ideas** button. Each row keeps its **Delete** button, which uses `DELETE /api/resolutions?id=<id>`.
- Legacy rows are never used to fill a card, are not offered in card editing, and cannot be updated.
- The sidebar keeps the Resolutions link during the transition (spec 14).
- Code that only exists for this transition is marked `LEGACY-PERSONAL-RESOLUTIONS` so it can be found and removed.

## Permissions
- Only the owner can update or delete a resolution.
- Only a player of the game can create a resolution for it.
- Progress is not a permission of the resolution: it belongs to the owner of the card holding the cell (spec 06).
- Resolutions of an ended game cannot be saved or deleted (spec 16).

## Constraints
- Title must be non-empty. It is trimmed and truncated to 255 characters.
- Description is optional. For `base` resolutions it defaults to the title.
- `compound` requires at least one subtask, each with a non-empty title.
- `iterative` requires `numberOfRepetition >= 2`. The form additionally requires an integer.

## Acceptance Criteria
- A player can create, edit, delete, and list their own resolutions of every type for a game.
- A player can change the type of a resolution.
- The Personal tab shows a counter of the player's resolutions over the target `X − N − 1`, which goes up on create and down on delete.
- After creating a resolution, opening the dialog again shows an empty form with the Common type.
- The Personal tab shows definitions only, with no progress, subtask checking, repetition counter or history.
- Editing or deleting a resolution does not change existing cards.
- User cannot modify someone else's resolutions.
- A personal resolution cannot be created without a game, or for a game the caller does not play.
- `/resolutions` shows legacy personal resolutions read-only, with Delete and the obsolescence notice, and offers no create, edit or Browse ideas action.

## Known Gaps
- The team goal can be deleted through the API, although the UI offers no such action. Existing cards keep their snapshot of it.
