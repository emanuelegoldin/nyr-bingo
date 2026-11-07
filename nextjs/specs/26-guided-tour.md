# 26 — Guided Tour (Proof of Concept)

## Purpose

Show new users how the application works with a short, step-by-step guided tour that highlights parts of the interface.

This specification is a **proof of concept**. It covers a single tour that explains the bingo game, and it is meant to evaluate whether a tour library (Intro.js) fits the project. It may be extended, replaced or removed.

---

## User Stories Covered

- As a new user, learn how the bingo game works without reading documentation
- Start the explanation whenever I want, from any page
- Try the explanation without changing my real card or bothering my teammates

---

## In Scope

- One tour: how the bingo game works
- A control that starts the tour
- A demo card that the tour operates on
- Translation and theming of the tour

---

## Out of Scope

- Tours for other pages or features
- Starting a tour automatically (for example on first login)
- Remembering whether a user has already seen a tour
- Using the user's real card or real resolutions in the tour

---

## Functional Requirements

### Trigger

- A **help button** (a question-mark icon) appears in the application header, right before the theme switcher (spec 25), on every authenticated page.
- Selecting it starts the bingo tour. The button has a translated accessible label and tooltip.

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

### Ending the Tour

- When the tour ends, whether it finished, was skipped or closed, the demo card is removed and its state is reset to its initial content. Starting the tour again begins from the same initial card.

### Translation and Theme

- Every text of the tour, the demo card's sample resolutions and the navigation buttons are translated in every locale (spec 15).
- The tour's tooltips use the theme tokens and are readable in light and dark themes (spec 25).
- The tour and the demo card fit narrow screens without horizontal scrolling (spec 20).

### Module Boundary

- The tour lives in its own folder. Only that folder uses the tour library, so the library can be replaced or the whole tour removed without changing other features.

---

## Acceptance Criteria

- A help button appears in the application header on every authenticated page and starts the bingo tour.
- The tour shows, in order: an overview, the card, one cell, the cell's details, and marking the cell as complete.
- The user opens the cell's details by clicking the cell, and marks it as complete by clicking Mark Complete. Those two steps have no Next button.
- Marking the cell as complete in the tour shows it with the completed stamp on the demo card.
- No request is sent to the server during the tour, and the user's real cards are unchanged.
- After the tour ends (finished, skipped or closed), the demo card disappears, and a new tour starts from the initial card.
- All tour texts are translated in every locale, and the tour is readable in both themes and on narrow screens.
- The tour library is used only inside the tour's folder.
