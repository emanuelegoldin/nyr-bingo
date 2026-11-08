# 14 — Dashboard and Navigation

## Purpose

Define the public landing page, the authenticated application shell, and the dashboard where a user works on their own bingo cards.

---

## User Stories Covered

- Discover the application and reach login or registration
- Move between the main sections of the application
- See my own bingo card for every started game in one place
- See the games I am playing
- Open a game from its card on the dashboard
- Edit my card content from the dashboard
- Log out

---

## In Scope

- Landing page
- Application shell (sidebar and header)
- Dashboard page

---

## Functional Requirements

### Landing Page

`/` is public and shows:
- The app name, the language switcher (spec 15), and login and register links
- A hero section and three feature cards
- A footer with the version from `NEXT_PUBLIC_APP_VERSION`

### Application Shell

Pages under `/dashboard`, `/games`, `/teams`, `/profile`, `/resolutions`, `/archive` and `/guides` share a shell:
- **Sidebar**: links to Dashboard, Games, Teams, Profile, Resolutions, Archive and Guides (spec 26). The Resolutions page is obsolete and read-only until it is removed after 8 May 2027 (spec 03, Legacy Personal Resolutions).
- **Header**: the current page title, the language switcher (spec 15), the notification bell (spec 19) and a user menu.
- **User menu**: username, email, links to Profile and Teams, and Logout. When no user is loaded it shows a Login button instead.

### Access to Pages

There is no route middleware.
- The dashboard, profile, resolutions and guides pages, the game page, the team page and the archived game page check the session on the server and redirect to `/login`.
- `/games`, `/teams` and `/archive` are client pages, and `/join/[inviteCode]` runs outside the shell. They rely on API responses.

### Dashboard

`/dashboard` is the destination after login. It shows the current user's card for **each started game**.

- Each card loads independently, with its own loading state, so one slow or failed card does not affect the others.
- A card shows the game name as a clickable tag that opens the game page, an **Edit Card** button (spec 09), the **Shuffle** and **Lock** buttons while the card is unlocked (spec 22) and the same interactive cells as the owner's card on the game page (spec 06).
- The tag is styled so it reads as interactive (an icon and a chevron, with a hover state), and it is also shown on the loading, failed and missing placeholders.
- A game without a card for this user shows a "none available" message.

Empty states, with a **Get Started** button:
- The user has no team
- The user has teams, but no game has started

---

## Acceptance Criteria

- Logged-out visitors can reach login and registration from `/`.
- Authenticated users can navigate between Dashboard, Games, Teams, Profile, Resolutions, Archive and Guides.
- The dashboard shows one card per started game.
- A failed card does not prevent the other cards from rendering.
- Clicking the game tag of a dashboard card opens that game's page, including while the card is loading, failed or missing.
- Users can log out from the user menu.
