# 05 — Bingo Card Generation

## Purpose
Define the rules for generating each team member's bingo card when the team game is started, or when a member joins a started game.

## User Stories Covered
- Cards generated automatically at start
- Joker in the middle (fixed center cell)
- Other cells chosen from other team members' provided resolutions
- Missing resolutions filled randomly from the user's own resolution list
- If not enough resolutions, fill with "empty" non-checkable cells

## Assumptions
- Card is a 5x5 grid.
- Cell positions are numbered 0–24, left to right, top to bottom.
- The center cell is position 12.

## Inputs
- Team goal resolution (`scope = team`)
- Member-provided resolutions targeted to the card owner (`scope = member_provided`)
- Card owner's personal resolutions (`scope = personal`), used as fallback

## Data Model Notes
- When generated, every non-empty cell references a row of the `resolutions` table through `bingo_cells.resolution_id`, whatever its source. `bingo_cells.resolution_type` holds that resolution's type. The reference is lost if the resolution is later deleted (spec 03).
- Storing references (instead of duplicating text) ensures that when a resolution is edited, all cards displaying it reflect the update.
- `source_user_id` holds the author of a `member_provided` cell and the card owner for a `personal` cell. It is `NULL` for `team` and `empty` cells.
- `is_empty` is a generated column: true when `resolution_id` is `NULL` and `source_type = 'empty'`.
- The Joker is always position 12 and is not stored in the database. It is added to the card when the card is read, with id `joker:<cardId>`.
- The Joker's displayed text is a fixed "Joker" label; it does not display team goal text.

## Generation Rules
1. Create a 5x5 grid with the Joker in the center, leaving 24 cells to fill.
2. Add the member-provided resolutions targeted to the owner.
3. If there is still space, add the team goal as a normal, checkable `team` cell.
4. Fill remaining cells by randomly selecting from the owner's personal resolutions.
5. Fill anything still remaining with `empty` cells.
6. Shuffle the 24 cells across the non-center positions.
7. Every stored cell starts in state `pending`.

Generation runs in a transaction. Cards are generated once: at game start for all members, and at join time for a member joining a started game. A user has at most one card per team, and cards are never regenerated.

## Duplicate Handling
- Generation rejects duplicates by text. A resolution's text is its description or, without one, its title, compared case-insensitively.
- The team goal's text is reserved first, so a member-provided or personal resolution with the same text is left out.
- A rejected resolution is simply skipped and its slot goes to a later source.
- There is no flow for reporting duplicates after generation.

## Constraints
- Joker cell is always present and immutable.
- `empty` cells cannot be marked completed.
- Generation requires the team to be `started` and the team goal to exist.

## Acceptance Criteria
- Starting the game generates a card for each team member.
- Joining a started team generates a card for the new member.
- Center cell is the Joker.
- Remaining cells follow selection and fallback rules.
- A generated card contains no duplicate resolution text.
- If insufficient content, "empty" non-checkable cells are used.
