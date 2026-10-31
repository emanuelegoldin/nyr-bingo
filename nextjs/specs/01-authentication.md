# 01 — Authentication

## Purpose

Provide secure user registration, login, and **email verification**, ensuring that only verified users can participate in team-based gameplay while still allowing basic account setup for unverified users.

---

## User Stories Covered

- Register creating a profile with username/email + password
- Log in to see my profile
- Log out
- Confirm identity through email
- See whether my account is verified
- Be restricted from team-based gameplay until verified
- Be the only one capable of modifying my personal data

---

## In Scope

- Registration
- Login and logout
- Email verification workflow
- Verification-based access control
- Session-based authentication

---

## Functional Requirements

### Registration

`POST /api/auth/register`

- User submits:
  - Username
  - Email
  - Password
- System validates:
  - All three fields are present
  - Password is at least **8 characters**
  - Email has a valid format
  - Username and email are unique
- The registration form additionally requires a username of at least 3 characters. This rule is enforced client-side only.
- System creates the user in **unverified** state, together with a default profile whose display name is the username.
- System sends a verification email containing a single-use verification link (`<APP_BASE_URL>/verify?token=<token>`).
- A failure to send the email does not fail registration; the user can request a new email later.
- When SMTP is not configured, the token and link are logged to the console instead. Outside production the token is also returned in the API response.

---

### Email Verification

`POST /api/auth/verify` — no session required.

- Verification link:
  - Is single-use
  - Expires **24 hours** after creation
- When the user opens the link, the `/verify` page submits the token:
  - Token is validated
  - Token is marked as used
  - User account is marked as verified (`emailVerifiedAt` is set)
- Expired or invalid tokens:
  - Show a clear failure message
  - Point the user to the profile page, where a new verification email can be requested

---

### Login

`POST /api/auth/login`

- User submits **email** + password. Login by username is not supported.
- System authenticates credentials.
- Login is **allowed for both verified and unverified users**.
- On success the system creates a session and sets a `session_token` cookie:
  - `httpOnly`, `sameSite=lax`, `secure` in production
  - Sessions expire after **7 days**
- The client then navigates to `/dashboard`.

---

### Logout

`POST /api/auth/logout`

- Deletes the session and clears the cookie.

---

### Verification-Based Access Control

Unverified users **may**:
- Log in
- View and edit their own profile
- Write and manage personal resolutions (inputs for bingo)

Unverified users **may not**:
- Create a team
- Join a team
- Accept team invitations
- Start bingo games

Verified users:
- Have full access to all team and gameplay features

Enforcement:
- `POST /api/teams`, `POST /api/join` and `POST /api/teams/[teamId]/start` reject unverified users with `403`.
- Other team actions require team membership. Membership can only be obtained through team creation or joining, and verification is never revoked, so every team member is verified.
- The exception is the team goal progress routes, which check neither membership nor verification (spec 03, Known Gaps).

---

## Errors & Edge Cases

- Registration with existing email or username → reject with `409` and a clear message
- Login with invalid credentials → reject with `401`
- Verification token expired → allow regeneration
- Verification token reused → reject
- Requesting a new verification email when already verified → reject with `400`
- Unauthenticated request to a protected API → `401`

---

## Acceptance Criteria

- A new user can register and receives a verification email.
- Verification link expires after 24 hours.
- Opening a valid verification link marks the account as verified.
- Users can log in with email and password, and log out.
- Unverified users are blocked from team-based gameplay.
- Verified users can create, join, and participate in teams.
- A user cannot modify another user's data.

---

## Notes

- SMTP is used as the email provider; the host defaults to `smtp.soho.com`.
- `.env.example` documents the required email settings.
- Passwords are hashed with bcrypt. `PASSWORD_SALT_ROUNDS` accepts 10–15 and defaults to 12.
- Clarity and maintainability are prioritized over cleverness.
