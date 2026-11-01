# 02 — User Profile and Privacy

## Purpose

Allow users to manage their profile information, configure field-level privacy, and view **email verification status**, including the ability to request a new verification email.

---

## User Stories Covered

- Edit my profile information
- Configure which profile fields are public
- See whether my account is verified
- Request a new verification email if needed
- View other users' public profile information

---

## In Scope

- View/edit own profile
- Configure per-field visibility
- View other users' public profiles
- Display and manage verification status

---

## Functional Requirements

### Profile Data

| Field | Editable | Default visibility |
| ----- | -------- | ------------------ |
| Username | No | Always public |
| Email | No | Visible to the owner only |
| Display name | Yes | Public (`displayNamePublic = true`) |
| Bio | Yes | Private (`bioPublic = false`) |
| Avatar URL | API only | Public (`avatarPublic = true`) |

- The display name defaults to the username at registration.
- The profile page edits the display name, the bio and their visibility toggles.
- `avatarUrl` and `avatarPublic` are accepted by the API but have no UI. Avatars are rendered as the first letter of the user's name everywhere; `avatarUrl` is never displayed.

---

### API

- `GET /api/profile` — the caller's own profile, plus `{ id, username, email, emailVerified }`.
- `GET /api/profile?userId=<id>` — the public profile of another user; `404` when the user does not exist. Passing the caller's own id returns their own profile.
- `PUT /api/profile` — updates the caller's profile. Accepted fields: `displayName`, `bio`, `avatarUrl`, `displayNamePublic`, `bioPublic`, `avatarPublic`.

All endpoints require authentication.

---

### Notifications

The profile page has a switch that turns notifications on or off (spec 19).

---

### Privacy Settings

- Display name, bio and avatar URL can each be marked public or private.
- A public profile exposes the username plus each optional field only when that field is public. Private fields are returned as `null`.

---

### Verification Status

- The profile page displays:
  - `Verified`
  - `Not verified`
- If the user is **not verified**, the page also displays:
  - A notice that verification is required to create or join teams
  - A **Resend Verification Email** action (`POST /api/auth/resend-verification`). A new token invalidates the user's earlier tokens. Tokens are limited to 3 per user per hour, counting the one from registration; beyond that the API returns `429`.
- A resent verification link expires after 24 hours.

---

## Permissions

- `PUT /api/profile` and `POST /api/auth/resend-verification` always act on the authenticated user; there is no way to target another user.
- Other users can only view public profile data.

---

## Errors & Edge Cases

- User makes all optional fields private → the username remains as minimal public identity
- Requesting a verification email when already verified → rejected with `400`

---

## Public Profile Page

A dedicated page at `/profile/[userId]` displays a read-only view of another user's profile:

- **Username** is always visible.
- **Display name** is shown only if `displayNamePublic` is true.
- **Bio** is shown only if `bioPublic` is true.
- If the currently logged-in user visits their own public profile URL, they are redirected to the editable profile page at `/profile`.
- Unauthenticated visitors are redirected to `/login`.
- Avatars on the team page (cards, Members tab, Leaderboard tab) link to `/profile/[userId]`.

---

## Acceptance Criteria

- Users can edit their own profile.
- Users can configure which fields are public.
- Users can see their verification status.
- Users can turn notifications on and off.
- Unverified users can request a new verification email.
- Other users only see public profile fields.

---

## Known Gaps

- The profile page has a **Password** tab with a form, but its button has no handler and no password-change endpoint exists.
