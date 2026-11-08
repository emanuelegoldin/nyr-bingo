# 12 — Game Tabs & Leaderboard

## Purpose

Organise the game page (spec 16) into distinct tabs for better navigation and
separation of concerns: **Cards**, **Leaderboard**, **Threads**, **Progress**,
**Personal** and **Teammates**. The members list is on
the team page only (spec 04): it is also reachable from the game's leaderboard.

---

## User Stories Covered

- View all bingo cards of a game in a dedicated "Cards" tab.
- View a leaderboard of bingo results in a "Leaderboard" tab.
- Click on any member's avatar to view their profile.
- See a confetti animation when a bingo line is completed.
- See how many resolutions each player has accomplished in the leaderboard.
- Read the game's closed review threads in a "Threads" tab.
- Follow each player's progress over time in a "Progress" tab (spec 23).
- Write my own resolutions for a game in a "Personal" tab (spec 03).
- Write a resolution for each teammate in a "Teammates" tab (spec 16).

---

## In Scope

- Game page tab structure
- Leaderboard podium and table backed by the `team_leaderboard` DB table
- Clickable user avatars linking to profile pages
- Clickable source-user badges in bingo card cells
- Confetti celebration animation on bingo completion

---

## Tab Structure

The game page header (spec 16) remains above the tabs. The page is available
to team members only; others get a not-found page. Which tabs are rendered
depends on the game's phase:

| Phase (spec 16) | Tabs, in order | Selected by default |
| --------------- | -------------- | ------------------- |
| Preparation (`forming`) | Personal, Teammates | Personal |
| Started | Cards, Leaderboard, Threads, Progress, Personal, Teammates | Cards |

When the game starts, an open page re-renders with the started tabs and selects
Cards.

### 1. Cards Tab

- Shows every team member's bingo card.
- Owner's card is interactive (mark completed, undo, typed progress).
  Card editing is only available on the dashboard (spec 09).
- Other members' cards are view-only, apart from proof review actions.
- **Confetti animation:** When a card goes from having no bingo line to having
  one, a confetti animation shoots from both bottom corners of the screen. The
  pieces rise, slow down, then fall while fading out.
  - It is evaluated in the viewer's browser on every card rendered there,
    including other members' cards, whenever that card's cells change.
  - Cards that already have a bingo when first rendered do not play it.
  - A line counts when all its cells are `completed` or `accomplished`, so a
    `completed → pending_review` transition cannot complete a line. See Known
    Gaps for the false positive that can still fire on this transition.
  - If the line is lost and completed again, it plays again.
  - The confetti is canvas-based, is loaded on demand at the first bingo so it
    does not slow down page load, and removes itself after ~4-5 seconds.
  - It does not play when the user's system prefers reduced motion.
- **Clickable source-user badges:** On each cell, the badge showing the
  resolution source user (for `member_provided` cells) is a link to that
  user's profile page. A provider who is no longer a player shows as
  "Former Teammates", without a link.

### 2. Leaderboard Tab

- **Podium:** positions 1–3 are shown as cards above the table.
  - Position 1 is centred at the top and shows a trophy icon. Positions 2
    (left) and 3 (right) sit side by side below it, forming a triangle.
  - Each card shows the position number, the player's avatar (clickable) and
    name (as in the Player column below), the completed count and the
    first-bingo datetime, or "—" if not yet scored.
  - Card accents are gold for position 1, silver for 2 and bronze for 3.
  - With fewer than three players, only the existing positions are shown.
- **Table:** positions 4 and below are listed in a table with four columns:
  1. **#** — Position number (1-indexed, so the first row is 4).
  2. **Player** — Avatar (clickable) + display name, if `displayNamePublic` is
     true, otherwise username.
  3. **Completed** — The number of completed resolutions (cells with state
     `completed` or `accomplished`).
  4. **First Bingo** — The datetime when the player first completed a bingo
     line, or "—" if not yet scored.
  The table is not shown when there are three players or fewer.
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

### 3. Threads Tab

- Lists the game's archived review threads and opens them read-only, as
  defined in spec 07 (Archived Threads). Admins of the game can delete one.
- It is one component, shared with the archived game page (spec 18).

### 4. Progress Tab

- Shows a chart of each player's completed count over time, as defined in
  spec 23. It is one component, shared with the archived game page (spec 18).

### 5. Personal Tab

The caller's own resolutions for the game (spec 03):
- A counter `y/target` at the top: `y` is the number of the caller's personal
  resolutions of the game and `target` is `X − N − 1` (spec 03, Personal
  Target). It goes up when a resolution is added and down when one is deleted.
- An **Add resolution** button, which opens the resolution dialog (spec 03,
  Create Dialog), and a **Browse ideas** button, which opens the prepared
  resolutions dialog (spec 17).
- The list of the caller's personal resolutions of the game, newest first.
  Each row shows the title, a type badge, the subtask count or target, an
  **Edit** button (opens the dialog with the resolution) and a **Delete**
  button.
- A placeholder message when the list is empty.

The list and the counter are loaded on the server with the page and re-render
after every change.

### 6. Teammates Tab

The resolutions the caller writes for the other players (spec 16,
Member-Provided Resolutions):
- One row per other player of the game: "For {name}", then the caller's
  resolution for them with its type badge, or "No resolution proposed yet".
- Each row has a button that opens the resolution dialog for that player, to
  write the resolution or edit the existing one.
- A placeholder message when the caller is the only player.

---

## Clickable Avatars & Public Profile

- Clicking a member's avatar anywhere in the game page (Cards and Leaderboard
  tabs) or the team page navigates to `/profile/[userId]`.
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

- A "bingo" is a complete row, column, or diagonal on the card's N×N grid (spec 05). A line has N cells.
- A cell counts as "done" when its state is `completed` or `accomplished`.
- The center position (the Joker) always counts as done, whether or not a row exists
  for it, and adds no timestamp to its line.
- The first-bingo time equals the latest `updated_at` among the cells of the
  earliest completed line.
- The value is recalculated on each refresh, not frozen: if the line is undone,
  `first_bingo_at` moves or returns to `NULL`.

---

## Acceptance Criteria

- [ ] During the preparation phase the game page renders only the Personal
      and Teammates tabs, with Personal selected.
- [ ] Once started, the game page renders Cards, Leaderboard, Threads,
      Progress, Personal and Teammates, with Cards selected; it has no
      Members tab.
- [ ] The Personal tab shows the counter `y/target`, the caller's resolutions
      with Edit and Delete, and the Add resolution and Browse ideas buttons.
- [ ] The Teammates tab lists every other player with the caller's resolution
      for them and a button to write or edit it.
- [ ] Threads tab lists the game's archived threads (spec 07).
- [ ] Cards tab contains the bingo-card layout.
- [ ] Leaderboard tab shows positions 1–3 as podium cards: 1 at the top with
      a trophy, 2 and 3 side by side below it.
- [ ] Leaderboard tab lists positions 4 and below in a table with
      first-bingo datetime, shown only when there are more than three players.
- [ ] Podium cards and table rows show the completed count, counting cells
      with state `completed` or `accomplished`.
- [ ] Leaderboard sorts by: bingo-holders first (earliest bingo), then by
      completed tasks descending, then alphabetically.
- [ ] A completed line through the center (the middle row, the middle column
      or either diagonal) sets the first-bingo datetime, on every card size.
- [ ] The leaderboard updates without a page reload, for the acting player and
      for teammates, when a card change is signalled.
- [ ] Podium cards 1 / 2 / 3 are accented gold / silver / bronze.
- [ ] Clicking any avatar on the game page navigates to the member's profile.
- [ ] Clicking a source-user badge in a bingo cell navigates to the profile.
- [ ] Confetti animation plays when a card gains a bingo line, using the same
      lines as the leaderboard.
