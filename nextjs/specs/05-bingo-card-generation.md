# 05 — Bingo Card Generation

## Purpose
Define the rules for generating each team member's bingo card when a game is started, or when a member joins a team with a started game.

## User Stories Covered
- Cards generated automatically at start
- Joker in the middle (fixed center cell)
- Other cells chosen from other team members' provided resolutions
- A member who proposed nothing is replaced by an easy prepared resolution
- Missing resolutions filled randomly from the user's own resolution list
- If not enough resolutions, fill with difficult prepared resolutions at game start
- If still not enough, fill with "empty" non-checkable cells

## Assumptions
- Card is a 5x5 grid.
- Cell positions are numbered 0–24, left to right, top to bottom.
- The center cell is position 12.

## Inputs
- The game's team goal resolution (`scope = team`)
- The game's member-provided resolutions targeted to the card owner (`scope = member_provided`)
- Card owner's personal resolutions (`scope = personal`), used as fallback
- The prepared resolutions pool (spec 17), used as fallback at game start

## Data Model Notes
- When generated, every non-empty cell references a row of the `resolutions` table through `bingo_cells.resolution_id`, whatever its source. `bingo_cells.resolution_type` holds that resolution's type. The reference is lost if the resolution is later deleted (spec 03).
- Storing references (instead of duplicating text) ensures that when a resolution is edited, all cards displaying it reflect the update.
- `source_user_id` holds the author of a `member_provided` cell and the card owner for a `personal` cell. It is `NULL` for `team`, `prepared` and `empty` cells.
- A `prepared` cell references a copy of a pool entry, in the `resolutions` table with `scope = prepared` (spec 03). Each cell gets its own copy, because progress is stored on the resolution. The copy has the entry's type, title, description and type-specific data, and is not a personal resolution of the card owner.
- `is_empty` is a generated column: true when `resolution_id` is `NULL` and `source_type = 'empty'`.
- The Joker is always position 12 and is not stored in the database. It is added to the card when the card is read, with id `joker:<cardId>`.
- The Joker's displayed text is a fixed "Joker" label; it does not display team goal text.

## Generation Rules
1. Create a 5x5 grid with the Joker in the center, leaving 24 cells to fill.
2. Add the member-provided resolutions targeted to the owner.
3. For each other team member who has no member-provided resolution for the owner, add one random `short` prepared resolution.
4. If there is still space, add the team goal as a normal, checkable `team` cell.
5. Fill remaining cells by randomly selecting from the owner's personal resolutions.
6. Fill remaining cells with random `long` prepared resolutions and, once those run out, `medium` ones.
7. Fill anything still remaining with `empty` cells.
8. Shuffle the 24 cells across the non-center positions.
9. Every stored cell starts in state `pending`.

Generation runs in a transaction. Cards are generated once: at game start for all members, and at join time for a member joining a team, in each of its started games. A user has at most one card per game, and cards are never regenerated.

Steps 3 and 6 apply only at game start. A card generated at join time uses no prepared resolutions, so it can contain `empty` cells; its owner can fill them through card editing (spec 09).

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
- Starting the game generates a card for each team member.
- Joining a team generates a card for the new member in each of its started games.
- Center cell is the Joker.
- Remaining cells follow selection and fallback rules.
- At game start, a card gets one `short` prepared resolution for each other member who proposed nothing for its owner.
- At game start, cells that would be empty get `long` prepared resolutions, then `medium` ones.
- A card generated at join time contains no prepared resolutions.
- Two cards using the same pool entry have independent progress.
- A generated card contains no duplicate resolution text.
- If insufficient content, "empty" non-checkable cells are used.
