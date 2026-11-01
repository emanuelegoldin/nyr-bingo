# 14 — Dashboard and Navigation

## Purpose

Define the public landing page, the authenticated application shell, and the dashboard where a user works on their own bingo cards.

---

## User Stories Covered

- Discover the application and reach login or registration
- Move between the main sections of the application
- See my own bingo card for every started game in one place
- See the games I am playing
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
- The app name, the language selector (spec 15), and login and register links
- A hero section and three feature cards
- A footer with the version from `NEXT_PUBLIC_APP_VERSION`

### Application Shell

Pages under `/dashboard`, `/games`, `/teams`, `/profile` and `/resolutions` share a shell:
- **Sidebar**: links to Dashboard, Games, Teams, Profile and Resolutions, plus the language selector.
- **Header**: the current page title and a user menu.
- **User menu**: username, email, links to Profile and Teams, and Logout. When no user is loaded it shows a Login button instead.

### Access to Pages

There is no route middleware.
- The dashboard, profile and resolutions pages, the game page and the team page check the session on the server and redirect to `/login`.
- `/games` and `/teams` are client pages, and `/join/[inviteCode]` runs outside the shell. They rely on API responses.

### Dashboard

`/dashboard` is the destination after login. It shows the current user's card for **each started game**.

- Each card loads independently, with its own loading state, so one slow or failed card does not affect the others.
- A card shows the game name, an **Edit Card** button (spec 09) and the same interactive cells as the owner's card on the game page (spec 06).
- The card's title and description are translated (spec 15).
- A game without a card for this user shows a "none available" message.

Empty states, with a **Get Started** button:
- The user has no team
- The user has teams, but no game has started

---

## Acceptance Criteria

- Logged-out visitors can reach login and registration from `/`.
- Authenticated users can navigate between Dashboard, Games, Teams, Profile and Resolutions.
- The dashboard shows one card per started game.
- A failed card does not prevent the other cards from rendering.
- Users can log out from the user menu.
