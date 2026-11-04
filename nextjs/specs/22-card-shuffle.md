# 22 — Card Shuffle

## Purpose

Let a card owner rearrange the cells of their bingo card at random until they are happy with the layout, and then lock it so it can no longer be rearranged.

## User Stories Covered

- Shuffle the cells of my card
- Lock my card once I like the layout

## Spec References

- 05-bingo-card-generation.md (grid, Joker position, generation shuffle)
- 06-bingo-gameplay.md (cell states)
- 09-bingo-card-editing.md (edit mode on the dashboard)
- 11-real-time-card-updates.md (card room signals)
- 12-team-tabs.md (bingo lines)
- 14-dashboard-and-navigation.md (dashboard card)
- 16-games.md (ended games)
- 21-authorization.md (`card.arrange` permission)

## In Scope

- Shuffling the positions of a card's cells
- Locking a card against further shuffles
- The **Shuffle** and **Lock** buttons on the dashboard card

## Out of Scope

- Moving a single cell to a chosen position
- Unlocking a card
- Shuffling from the game page

## Definitions

- **Done cell**: a cell in state `completed`, `pending_review` or `accomplished`. A `failed` cell is not done (spec 06).
- **Locked card**: a card whose `bingo_cards.locked_at` is set.

## Functional Requirements

### Shuffle

- A shuffle gives the 24 stored cells of the card a new random arrangement over the non-center positions. The Joker stays at position 12.
- Every stored cell takes part in the shuffle, including the team goal cell, empty cells and `failed` cells. A cell may land on its old position.
- A cell keeps its id, content, state, review threads and `updated_at`. Only its `position` changes.
- A card can be shuffled any number of times while it is unlocked and has no done cell. Bingo lines depend on positions (spec 12), so a done cell must not be moved into a line.

### Lock

- Locking sets `locked_at` to the current time. It cannot be undone.
- A locked card cannot be shuffled. Everything else on it (gameplay, proof review, card editing) works as on an unlocked card.
- Locking is allowed whatever the state of the cells.
- Every card starts unlocked: cards generated at game start or join time, and cards that already exist when this feature is introduced.

### Dashboard UI

- The dashboard card (spec 14) shows **Shuffle** and **Lock** next to **Edit Card** while the card is unlocked and not in edit mode. Once the card is locked, neither button is shown.
- **Shuffle** is disabled while the card has a done cell, with a hint that a card with completed cells can no longer be shuffled.
- **Lock** asks for confirmation, warning that the card can no longer be shuffled afterwards.
- After a shuffle or a lock the card shows the new state without a page reload.

### Permissions & Safety

- Only the card owner can shuffle or lock their card. The routes act on the caller's own card and take no card id.
- The routes need the `card.arrange` game permission (spec 21), held by every player, and follow the game route rules: `404` for a missing or ended game, `403` for a non-player.
- Shuffling a locked card, or a card with a done cell, fails with `400`.
- A player without a card in the game gets `404`.
- A shuffle runs in one transaction that locks the card's rows, so it cannot interleave with a concurrent completion or lock: either the completion or lock happens first and the shuffle is refused, or the shuffle happens first and the cell is completed at its new position.

## Backend Rules

### `POST /api/games/[gameId]/card/shuffle`

- Auth required.
- Validation: running game, caller is a player, caller has a card, card is unlocked, card has no done cell.
- Effects: assigns the new positions and signals the team's card room (spec 11).
- Returns `{ card }`, the shuffled card in the shape of `GET /api/games/[gameId]/cards?userId=`.

### `POST /api/games/[gameId]/card/lock`

- Auth required.
- Validation: running game, caller is a player, caller has a card. Locking a card that is already locked succeeds and keeps its first `locked_at`.
- Effects: sets `locked_at` and signals the team's card room.
- Returns `{ card }`.

## Data Model

| Column | Type | Notes |
| ------ | ---- | ----- |
| `bingo_cards.locked_at` | DATETIME | NULL while the card can be shuffled |

The card read by the API carries it as `lockedAt` (`null` when unlocked).

**Migration:** `V5_8_0__card_lock.sql` adds `locked_at`, `NULL` for every existing card.

## Acceptance Criteria

- The card owner can shuffle an unlocked card with no done cell from the dashboard, any number of times.
- A shuffle keeps the Joker at the center and moves the other 24 cells, team goal included, with their content and state.
- A card with a done cell cannot be shuffled (UI disables the button, API returns `400`).
- The card owner can lock their card after confirming; a locked card cannot be shuffled (UI hides the buttons, API returns `400`).
- Locking does not change gameplay, proof review or card editing.
- Existing and newly generated cards start unlocked.
- Only the card owner can shuffle or lock their card; ended games return `404`.
- Other viewers of the card see the new layout through the card room signal.
