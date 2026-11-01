# 12 — Game Tabs, Members List & Leaderboard

## Purpose

Organise the game page (spec 16) into distinct tabs for better navigation and
separation of concerns: **Cards**, **Members**, and **Leaderboard**.

---

## User Stories Covered

- View all bingo cards of a game in a dedicated "Cards" tab.
- View a simple list of team members in a "Members" tab.
- View a leaderboard of bingo results in a "Leaderboard" tab.
- Click on any member's avatar to view their profile.
- See a confetti animation when a bingo line is completed.
- See how many resolutions each player has accomplished in the leaderboard.

---

## In Scope

- Game page tab structure
- Members list UI
- Leaderboard table backed by the `team_leaderboard` DB table
- Clickable user avatars linking to profile pages
- Clickable source-user badges in bingo card cells
- Confetti celebration animation on bingo completion

---

## Tab Structure

The game page header (spec 16) remains above the tabs. Below it, three tabs are
rendered. **Cards** is selected by default. The page is available to team
members only; others get a not-found page.

### 1. Cards Tab

- Shows every team member's bingo card.
- Owner's card is interactive (mark completed, undo, typed progress).
  Card editing is only available on the dashboard (spec 09).
- Other members' cards are view-only, apart from proof review actions.
- If the game has not started, a placeholder message is shown.
- **Confetti animation:** When a card goes from having no bingo line to having
  one, a confetti animation plays from the top of the screen.
  - It is evaluated in the viewer's browser on every card rendered there,
    including other members' cards, whenever that card's cells change.
  - Cards that already have a bingo when first rendered do not play it.
  - A line counts when all its cells are `completed` or `accomplished`, so a
    `completed → pending_review` transition cannot complete a line. See Known
    Gaps for the false positive that can still fire on this transition.
  - If the line is lost and completed again, it plays again.
  - The confetti is CSS-based and self-destructs after ~3.5 seconds.
- **Clickable source-user badges:** On each cell, the badge showing the
  resolution source user (for `member_provided` cells) is a link to that
  user's profile page.

### 2. Members Tab

- A simple list of all team members.
- Each row contains:
  - **Avatar** on the left (clickable → navigates to the member's profile).
  - **Display name**, or the username when no public display name exists.
  - A "Leader" badge for the team leader.
- The current user's entry is annotated with "(You)".

### 3. Leaderboard Tab

- A table with four columns:
  1. **#** — Position number (1-indexed). Position 1 is gold-coloured, 2 is
     silver, 3 is bronze.
  2. **Player** — Avatar (clickable) + display name, if `displayNamePublic` is
     true, otherwise username.
  3. **Completed** — The number of completed resolutions (cells with state
     `completed` or `accomplished`).
  4. **First Bingo** — The datetime when the player first completed a bingo
     line, or "—" if not yet scored.
- A placeholder message is shown when there are no rows.
- **Sorting rules (applied in order):**
  1. Users who have scored a bingo appear before those who have not.
  2. Among users with a bingo, order by earliest `first_bingo_at` ascending.
  3. Ties (same `first_bingo_at`, or both NULL) are broken by `completed_tasks`
     descending (more completed resolutions = higher rank).
  4. Final tiebreaker: alphabetical by username ascending.
- **Data source:** All values are read from the persisted `team_leaderboard`
  table (see _Database Impact_ below), not computed on the fly. The game page
  loads them on the server when it renders; there is no leaderboard API.
- **Updates:** The game page re-renders from the server, keeping the selected
  tab, when it receives `refresh-card` or catches up (spec 11). This applies on
  every tab of the page.

---

## Clickable Avatars & Public Profile

- Clicking a member's avatar anywhere in the game page (Cards, Members,
  Leaderboard tabs) or the team page navigates to `/profile/[userId]`.
- Clicking the source-user badge on a bingo card cell (for `member_provided`
  resolutions) also navigates to `/profile/[userId]`.
- The public profile page is defined in spec 02.

---

## Database Impact

### `team_leaderboard` table

Persists per-user, per-game leaderboard data for efficient retrieval.

| Column           | Type         | Notes                                    |
| ---------------- | ------------ | ---------------------------------------- |
| `user_id`        | VARCHAR(36)  | FK → `users.id` ON DELETE CASCADE        |
| `team_id`        | VARCHAR(36)  | FK → `teams.id` ON DELETE CASCADE        |
| `game_id`        | VARCHAR(36)  | FK → `games.id` ON DELETE CASCADE        |
| `first_bingo_at` | DATETIME     | NULL until the user scores a bingo       |
| `completed_tasks`| INT          | Count of cells in state `completed` or `accomplished` |
| `updated_at`     | DATETIME     | Auto-updated on change                   |

- **Unique key:** `(user_id, game_id)`
- **Migrations:** `V2_0_3__team_leaderboard_table.sql`, `V5_0_0__separate_games_from_teams.sql`

#### When rows are written

- **Game start** (`POST /api/games/[gameId]/start`): bulk-inserts a row for
  every team member with `completed_tasks = 0` and `first_bingo_at = NULL`.
- **Late join** (`ensureBingoCardForUser`): adds a row for the new member when
  their card is generated.
- `refreshLeaderboardEntry` recalculates `completed_tasks` and `first_bingo_at`
  from `bingo_cells` and upserts the row after:
  - **Cell state change** (`updateCellState`, `undoCompletion`, `updateCellContent`).
  - **Automatic completion** (`autoTransitionCellState`, spec 06).
  - **Proof request** (`requestProof` — `completed → pending_review`), because
    `pending_review` does not count toward `completed_tasks`.
  - **Vote resolution** (`submitVote` — thread closes).
  - **Thread closed by the completing user** (`closeThread`).
  - **Deadline closure** (`closeExpiredThreads`, spec 07).
  - **Game end** (spec 16), for each thread it closes.

#### Bingo detection logic

- A "bingo" is a complete row, column, or diagonal on the 5×5 grid.
- A cell counts as "done" when its state is `completed` or `accomplished`.
- Position 12 (the Joker) always counts as done, whether or not a row exists
  for it, and adds no timestamp to its line.
- The first-bingo time equals the latest `updated_at` among the cells of the
  earliest completed line.
- The value is recalculated on each refresh, not frozen: if the line is undone,
  `first_bingo_at` moves or returns to `NULL`.

---

## Acceptance Criteria

- [ ] Game page renders three tabs: Cards, Members, Leaderboard.
- [ ] Cards tab contains the bingo-card layout.
- [ ] Members tab lists all team members with avatar and name.
- [ ] Leaderboard tab shows a ranked table with first-bingo datetime.
- [ ] Leaderboard tab shows a "Completed" column counting cells with state
      `completed` or `accomplished`.
- [ ] Leaderboard sorts by: bingo-holders first (earliest bingo), then by
      completed tasks descending, then alphabetically.
- [ ] A completed line through the center (row 3, column 3 or either diagonal)
      sets the first-bingo datetime.
- [ ] The leaderboard updates without a page reload, for the acting player and
      for teammates, when a card change is signalled.
- [ ] Positions 1 / 2 / 3 are coloured gold / silver / bronze.
- [ ] Clicking any avatar on the game page navigates to the member's profile.
- [ ] Clicking a source-user badge in a bingo cell navigates to the profile.
- [ ] Confetti animation plays when a card gains a bingo line, using the same
      lines as the leaderboard.
