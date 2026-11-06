# 20 — Mobile Layout

## Purpose

Make the application usable on phones. The authenticated pages, their dialogs and the bingo card must fit a narrow screen and behave as expected with touch.

---

## User Stories Covered

- Navigate between sections on my phone without closing the menu by hand
- Read and manage my resolutions on my phone
- Open any dialog on my phone and reach all of its content and buttons
- Read the resolutions on my bingo card on my phone

---

## In Scope

- Layout of the application shell (spec 14) on narrow screens
- Layout of pages, dialogs and the bingo card on narrow screens

---

## Out of Scope

- A native mobile application
- Installable app (PWA) features, offline use and push notifications
- New navigation patterns, such as a bottom tab bar
- Changes to the layout on screens 768px wide and wider

---

## Functional Requirements

### Screen Sizes

- Pages must work on screens from **360px** wide.
- A screen narrower than **768px** counts as mobile. This is the existing sidebar breakpoint (`useIsMobile`).

### Navigation Drawer

- On mobile the sidebar opens as a drawer from the header's menu button (spec 14).
- Choosing any link in the drawer, including the app logo, navigates **and closes the drawer**.
- The drawer still closes when you tap outside it or press Escape.

### Header

- A long page title is truncated so it cannot push the notification bell or the user menu off the screen.

### Page Layout

- No page in the shell scrolls horizontally at 360px. Content that is wider by nature, such as the leaderboard table, scrolls inside its own container.
- When a page or card header has a title and action buttons, the actions wrap under the title when they don't fit beside it.
- On mobile, the title of a list row with action buttons, such as a resolution on the Resolutions page, wraps onto more lines instead of being cut to a few characters.

### Dialogs

- On mobile, a dialog (including a confirmation dialog) leaves a margin on each side of the screen.
- A dialog is never taller than the screen. When its content is taller, the dialog scrolls inside, so every field and button can be reached.

### Bingo Card

- A card fits the width of the screen without horizontal scrolling, whatever its size (spec 16). This applies to live cards (dashboard, game page) and archived cards.
- On mobile, a cell of a 3×3 or 5×5 card shows up to three lines of the resolution title in a smaller font, instead of a single truncated line. A 9×9 cell is too narrow for that: it shows as much of the title as fits, and tapping it opens the full details as on any card.
- The joker cell's icon and label fit inside the cell. On a 9×9 card on mobile the joker shows only its icon, with the label kept for screen readers.

---

## Acceptance Criteria

- At 360px, tapping a link in the drawer opens that page and the drawer is closed.
- At 360px, no page in the shell (Dashboard, Games, Game, Teams, Team, Profile, public Profile, Resolutions, Archive, archived Game) scrolls horizontally.
- At 360px, the landing page does not scroll horizontally and its header buttons are fully visible.
- At 360px, the title, description and actions of the Resolutions page are all fully visible, and each resolution title can be read in full.
- At 360px, every dialog fits in the screen with a side margin, and its last button can be reached by scrolling inside it.
- At 360px, the bingo card fits the screen, whatever its size, and the cell titles of 3×3 and 5×5 cards show up to three lines.
- At 768px and wider, the layout is the same as before this spec.

---

## Relation to Other Specs

- Spec 14 defines the application shell this spec adapts.
- Specs 06, 09 and 18 define the cards and cells whose layout this spec adapts.
