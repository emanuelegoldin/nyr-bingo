# 05 — Bingo Card Generation

## Purpose
Define the rules for generating each player's bingo card (spec 16) when a game is started, or when a member joins a team with a started game.

## User Stories Covered
- Cards generated automatically at start
- Joker in the middle (fixed center cell)
- Other cells chosen from other team members' provided resolutions
- A member who proposed nothing is replaced by an easy prepared resolution
- Each cell holds its own copy of the resolution, so progress is tracked per cell
- Missing resolutions filled randomly from the user's own resolution list
- If not enough resolutions, fill with difficult prepared resolutions at game start
- If still not enough, fill with "empty" non-checkable cells

## Assumptions
- Card is an N×N grid, where N is the game's grid size (spec 16): 3, 5 or 9. Every card of a game has the game's size.
- Cell positions are numbered 0 to N²−1, left to right, top to bottom.
- The center cell is position (N²−1)/2: 4 on a 3×3 card, 12 on a 5×5 card, 40 on a 9×9 card.
- A card has N²−1 stored cells: 8, 24 or 80.

## Inputs
- The game's team goal resolution (`scope = team`)
- The game's member-provided resolutions targeted to the card owner (`scope = member_provided`)
- Card owner's personal resolutions (`scope = personal`), used as fallback
- The prepared resolutions pool (spec 17), used as fallback at game start

## Data Model Notes
- When generated, every non-empty cell stores a snapshot (a copy) of the resolution's definition: `bingo_cells.title`, `description`, `resolution_type` and `number_of_repetition`, plus its subtasks in `bingo_cell_subtasks` (`cell_id`, `subtask_index`, `title`, `description`, `completed`).
- The cell also holds the progress: `bingo_cells.completed_times` (the iterative counter, starting at 0) and each subtask's `completed` flag (starting false). Cell `state` is unchanged by this and starts as `pending`.
- `bingo_cells.resolution_id` stays as a nullable link to the source resolution (ON DELETE SET NULL). It is used only to avoid duplicates during generation and card editing, never to read content. It is `NULL` for `prepared` and `empty` cells.
- Snapshot, no propagation: editing or deleting a resolution after the card was generated does not change the cell (spec 03). A cell changes content only through card editing (spec 09).
- Two cells generated from the same resolution, on the same or on different cards, have independent progress.
- `source_user_id` holds the author of a `member_provided` cell and the card owner for a `personal` cell. It is `NULL` for `team`, `prepared` and `empty` cells.
- A `prepared` cell is snapshotted directly from its entry in the `prepared_resolutions` pool (spec 17). No row is created in `resolutions`, and `resolution_id` is `NULL`.
- `is_empty` is a generated column: true when `source_type = 'empty'`.
- The Joker is always the center position and is not stored in the database. It is added to the card when the card is read, with id `joker:<cardId>`.
- The Joker is shown as a plain cell with a purple outline star in its centre and no visible text. Its accessible name is "Joker". It does not display team goal text.

## Generation Rules
1. Create an N×N grid with the Joker in the center, leaving N²−1 cells to fill.
2. Add the team goal as a normal, checkable `team` cell. It always gets a cell.
3. Add the member-provided resolutions targeted to the owner, in random order. When they do not all fit, the ones that fit are picked at random and the rest are left out.
4. For each other player who has no member-provided resolution for the owner, add one random `short` prepared resolution, while cells are left.
5. Fill remaining cells by randomly selecting from the owner's personal resolutions.
6. Fill remaining cells with random `long` prepared resolutions and, once those run out, `medium` ones.
7. Fill anything still remaining with `empty` cells.
8. Shuffle the N²−1 cells across the non-center positions.
9. Every stored cell starts in state `pending`.

Generation runs in a transaction. Cards are generated once: at game start for all players, and at join time for a member joining a team, in each of its started games. A user has at most one card per game, and cards are never regenerated.

Steps 4 and 6 apply only at game start. A card generated at join time uses no prepared resolutions, so it can contain `empty` cells; its owner can fill them through card editing (spec 09).

## Duplicate Handling
- Generation rejects duplicates by text. A resolution's text is its description or, without one, its title, compared case-insensitively.
- The team goal's text is reserved first, so a member-provided, personal or prepared resolution with the same text is left out.
- A rejected resolution is simply skipped and its slot goes to a later source. The same applies when the `short` category has no usable entry left.
- There is no flow for reporting duplicates after generation.

## Constraints
- Joker cell is always present and immutable.
- `empty` cells cannot be marked completed.
- Generation requires the game to be `started` and its team goal to exist.

## Acceptance Criteria
- Starting the game generates a card for each player.
- Joining a team generates a card for the new member in each of its started games.
- A card has the grid size of its game: 3×3, 5×5 or 9×9.
- Center cell is the Joker.
- The team goal is on every card, whatever its size.
- When the member-provided resolutions for a card do not all fit, the ones on the card are picked at random.
- Remaining cells follow selection and fallback rules.
- At game start, a card gets one `short` prepared resolution for each other member who proposed nothing for its owner.
- At game start, cells that would be empty get `long` prepared resolutions, then `medium` ones.
- A card generated at join time contains no prepared resolutions.
- Each non-empty cell stores a snapshot of the definition, with progress at zero and every subtask uncompleted.
- Two cells copied from the same resolution or pool entry have independent progress.
- Editing or deleting a resolution after generation does not change the generated cards.
- Prepared cells create no `resolutions` rows.
- A generated card contains no duplicate resolution text.
- If insufficient content, "empty" non-checkable cells are used.
