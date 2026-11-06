# 25 — Theming

## Purpose

Let users choose between a light and a dark look for the application, and keep every colour consistent with the chosen theme.

---

## User Stories Covered

- Switch between a light and a dark theme from any page, through a control in the page header
- Let the application follow my operating system's light or dark setting
- Keep my theme across visits
- Read every screen comfortably in either theme

---

## In Scope

- Supported themes
- Theme selection and persistence
- Theme tokens (colours)

---

## Functional Requirements

### Themes

- Supported themes: `light`, `dark` and `system`.
- `system` follows the operating system's preference (`prefers-color-scheme`). When the preference changes while a page is open, the page follows it without a reload.
- The default theme is `system`. It applies when no valid theme is stored.

### Selection and Persistence

- The **theme switcher** is a compact button showing the icon of the active theme: a sun for `light`, a moon for `dark`, a monitor for `system`. It opens a menu listing Light, Dark and System, each with its icon, with a check mark on the active one.
- It appears wherever the language switcher appears (spec 15), right before it:
  - the application header
  - the landing page header
  - the top right of the login, registration, invitation (`/join/...`) and email verification pages
- Selecting a theme stores it in the `theme` cookie for one year and applies it immediately, without a reload. The rest of the page state is kept.
- The server reads the cookie on each request and renders the page in the stored theme, so a page never flashes the other theme while loading. For `system`, the page applies the operating system's preference before it is first painted.
- The switcher's labels, including its accessible label, are translated (spec 15).

### Theme Tokens

- Every colour of the interface comes from a CSS variable (token) defined in `globals.css` for both themes. Switching the theme only switches the token values.
- Besides the existing tokens (`background`, `foreground`, `card`, `primary`, `muted`, `destructive`, …), the semantic tokens `success` and `warning`, each with a `foreground`, express positive and cautionary states (for example a completed subtask, a verified email, an approve vote, a missing verification).
- Components use tokens instead of fixed palette colours to express meaning.
- Exceptions, which keep fixed colours because they already define their own light and dark pairs or read well on both backgrounds:
  - the cell state colours and icons (spec 06)
  - the game status badge
  - the leaderboard medal colours
  - the reaction icons (spec 24)
  - the progress chart series (spec 23), which already use per-theme variables
- Text and status colours stay readable on the card and page backgrounds in both themes.

---

## Acceptance Criteria

- A user can switch between Light, Dark and System from the application header, the landing page, and the login, registration, invitation and verification pages.
- The switcher shows the icon of the active theme and marks the active option in its menu.
- The selected theme applies immediately, without a reload, and persists across visits.
- With System, the page follows the operating system's preference, also when it changes while the page is open.
- A page loaded with a stored Dark theme (or System on a dark operating system) does not flash the light theme.
- An unknown or missing theme falls back to System.
- Status text and controls (votes, checklists, counters, verification messages) are readable in both themes.
- The switcher's labels are translated in every locale.
