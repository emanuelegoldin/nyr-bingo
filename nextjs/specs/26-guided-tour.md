# 26 — Guided Tour (Proof of Concept)

## Purpose

Show new users how the application works with a short, step-by-step guided tour that highlights parts of the interface.

This specification is a **proof of concept**. It covers a few short tours (the bingo game, the leaderboard, the progress chart and proof review), and it is meant to evaluate whether a tour library (Intro.js) fits the project. It may be extended, replaced or removed.

---

## User Stories Covered

- As a new user, learn how the bingo game works without reading documentation
- Find every available guide in one place, and start the one I want whenever I want
- Try the explanation without changing my real card or bothering my teammates

---

## In Scope

- The tours listed under Tour Steps and Other Tours
- A Guides page that lists the available tours and starts them
- Demo content (cards, leaderboard, chart, threads) that the tours operate on
- Translation and theming of the tour

---

## Out of Scope

- Tours for pages or features not listed in this spec
- Starting a tour automatically (for example on first login)
- Remembering whether a user has already seen a tour
- Using the user's real card or real resolutions in the tour

---

## Functional Requirements

### Guides Page

- `/guides` is an authenticated page of the application shell (spec 14), linked from the sidebar as **Guides**, with a translated page title.
- It lists every available guide as an entry that shows only the guide's title.
- Selecting an entry's title expands it to show a short description and a **Play** button; selecting it again collapses it. Entries expand independently, and the expand control works with the keyboard and announces whether it is expanded.
- **Play** starts that guide's tour. While the tour runs, its Play button is disabled.
- When the tour ends, the user is back on the Guides page as they left it, and Play can start the tour again.
- The page lists, in order: the bingo tour ("How the bingo game works"), Leaderboard, Progress, Request a proof, Proof thread (your cell) and Proof thread (a teammate's cell).
- The application header has no button that starts a tour.

### Demo Card

- The tour runs on a **demo card**, not on the user's cards. The demo card is shown above the current page while the tour runs and is removed when it ends.
- The demo card is as wide as a real card on larger screens, so the cell titles are not cut short, and it fits the screen width on phones.
- The demo card is a 3×3 card with sample resolutions, using the same look as a real card (spec 06 - Card Display Rules): a joker in the centre, pending cells, and one completed cell with its stamp.
- The demo card never calls the server. Nothing the user does during the tour creates, changes or deletes data, sends notifications or real-time signals, or affects the leaderboard.

### Tour Steps

The tour shows these steps in order. Each step has a short translated text and, except for the first, highlights one element.

1. **Overview** — one sentence explaining the game: you complete your resolutions to mark cells on your card, and a full row, column or diagonal is a bingo.
2. **Your card** — highlights the demo card.
3. **A cell** — highlights one pending cell, explains that each cell holds one resolution, and asks the user to open it. The user continues by **clicking the cell**, which opens its details (no Next button on this step).
4. **Cell details** — the details of that cell (title, state, and the Mark Complete action) are shown over the demo card, like the real cell dialog, and are highlighted.
5. **Mark as complete** — highlights the Mark Complete action and asks the user to use it. The user continues by **clicking Mark Complete** (no Next button on this step). The details close, and the cell shows its stamp with the usual animation. A last step highlights the stamped cell.

- On the steps that ask for a click, only the highlighted element reacts. Elsewhere, the demo card cannot be used.
- The user can go back, skip or close the tour at any step (Back, Done, close button or Escape), and go forward with Next on the steps that do not ask for a click. Keyboard navigation can also go forward on any step.
- Going back to the details step from the completion step shows the cell as pending again.

### Other Tours

Every tour runs on demo content with sample data (players, cells, chart points, files and messages), shown above the page like the demo card and under the same rules: it never calls the server and is reset when the tour ends. Where a tour shows where to find a feature, it shows the game page's tabs (spec 12) with that tab highlighted. Texts are one short sentence per step.

- **Leaderboard**: the game page's Leaderboard tab; the podium; the **Completed** column (cells completed or accomplished); the **First Bingo** column (when the player first scored a bingo, which ranks first).
- **Progress**: the game page's Progress tab; the chart; the **Day / Month** toggle, which the user uses to continue; the legend, where the user selects a player to highlight them and continue.
- **Request a proof**: two 3×3 demo cards, the user's and a teammate's. The user selects a completed cell of the teammate's card, which opens the Request Proof dialog, and confirms it with **Request Proof** (no Next button on these two steps). The review thread is then shown briefly (it has its own tours), and a last step highlights the cell, which now shows the hourglass.
- **Proof thread (your cell)**: the thread seen by the card owner, with no action asked at any step: a one-sentence overview; the header (which resolution, and the thread's status); uploading files; the messages.
- **Proof thread (a teammate's cell)**: the thread seen by a teammate: voting with Accept or Deny, which the user uses to continue; that the thread closes once everyone has voted or after 2 days; that closed threads are kept in the game page's Threads tab. Going back to the voting step removes the demo vote.

### Ending the Tour

- When the tour ends, whether it finished, was skipped or closed, the demo content is removed and its state is reset to its initial content. Starting the tour again begins from the same initial content.

### Translation and Theme

- Every text of the tours, the demo content's sample resolutions and the navigation buttons are translated in every locale (spec 15).
- The tour's tooltips use the theme tokens and are readable in light and dark themes (spec 25).
- The tour and the demo card fit narrow screens without horizontal scrolling (spec 20).

### Module Boundary

- The tours live in their own folder. Only that folder uses the tour library, so the library can be replaced or the tours removed without changing other features.
- Inside it, each tour keeps the files only it uses in its own subfolder, and pieces used by several tours live in shared subfolders.
- Starting a tour does not depend on which tour it is: the Guides page starts any listed tour the same way.

---

## Acceptance Criteria

- The sidebar links to the Guides page, which lists every tour by its title.
- Selecting the title expands the entry with a description and a Play button, and Play starts the bingo tour.
- The application header has no help button.
- The tour shows, in order: an overview, the card, one cell, the cell's details, and marking the cell as complete.
- The user opens the cell's details by clicking the cell, and marks it as complete by clicking Mark Complete. Those two steps have no Next button.
- Marking the cell as complete in the tour shows it with the completed stamp on the demo card.
- No request is sent to the server during the tour, and the user's real cards are unchanged.
- After the tour ends (finished, skipped or closed), the demo card disappears, and a new tour starts from the initial card.
- All tour texts are translated in every locale, and the tour is readable in both themes and on narrow screens.
- The Leaderboard, Progress, Request a proof and both Proof thread tours show the steps listed under Other Tours, on demo content, and send no request to the server.
- The tour library is used only inside the tours' folder.
