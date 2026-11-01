# 00 — System Overview

## Goal
New Year Resolution Bingo is an application where users maintain resolutions, join teams, and play bingo games with their team. Each game is generated from a team goal, peer-provided resolutions and personal resolutions.

## How to Read These Specs
- Each spec describes the behavior of the application as it is currently implemented.
- A **Known Gaps** section, where present, lists current behavior that diverges from the apparent intent of the feature. Those entries are facts about the code, not requirements to preserve.

## Spec Index
| Spec | Topic |
| ---- | ----- |
| 01 | Authentication and email verification |
| 02 | User profile and privacy |
| 03 | Personal resolutions and resolution types |
| 04 | Bingo teams |
| 05 | Bingo card generation |
| 06 | Bingo gameplay |
| 07 | Proof and approval |
| 08 | Visibility and updates |
| 09 | Bingo card editing |
| 10 | Voting mechanic (`VoteBar`) |
| 11 | Real-time updates and conflict resolution |
| 12 | Game tabs, members list and leaderboard |
| 13 | Resolution history and progress |
| 14 | Dashboard and navigation |
| 15 | Internationalization |
| 16 | Games |

## Scope
In scope:
- User accounts: register, login, logout, email verification
- User profile: manage personal data and decide what is public
- Resolutions: personal CRUD; `base`, `compound` and `iterative` types; history timeline
- Bingo teams: create team, invite/join
- Bingo games: the leader creates any number of games for a team; each has one team goal, members create resolutions for each other, and the leader starts and ends it
- Bingo card generation (joker in the center, text de-duplication, personal fallback, empty filler cells)
- Gameplay marking (complete / undo), automatic completion for typed resolutions, viewing other members' cards
- Card editing by the card owner
- Proof review: requested by a teammate, discussed in a thread, decided by votes or by a deadline
- Game leaderboard
- WebSocket-based real-time signals
- Language selection (English, German, Italian)

Out of scope (not implemented):
- Payments, achievements, analytics, notifications beyond email verification
- Social features beyond team invites and viewing
- Admin console
- Leaving a team, removing a member, transferring team leadership
- Viewing ended games

## Key Roles
- **User**: owns a profile, manages personal resolutions, participates in teams.
- **Team leader**: the user who created the team; can invite users, delete the team, create, start, end and delete its games, and set their team goals.
- **Team member**: a user who joined through an invitation; can create resolutions for other members, request proof and vote on reviews. The leader is also a team member.

## Core Concepts / Data (logical)
- **User**
  - id, username, email, passwordHash, emailVerifiedAt
- **UserProfile**
  - userId, displayName, bio, avatarUrl
  - displayNamePublic, bioPublic, avatarPublic
- **Session**
  - userId, token, expiresAt
- **Resolution** (one table for every type and scope)
  - id, ownerUserId, title, description
  - resolutionType: `base` | `compound` | `iterative`
  - scope: `personal` | `team` | `member_provided`
  - teamId, gameId, toUserId (set according to scope)
  - subtasks, numberOfRepetition, completedTimes (set according to type)
- **Team**
  - id, name, leaderUserId
- **Game** (see spec 16)
  - id, teamId, name, status: `forming` | `started` | `ended`, deadline (optional), endedAt
  - The team goal is the resolution with `scope = team` for that game. `teamResolutionText` is derived from it on read and is not stored on the game.
- **TeamMembership**
  - teamId, userId, role (`leader` or `member`), joinedAt
- **TeamInvitation**
  - teamId, inviteCode, invitedEmail, invitedUserId, status, expiresAt
- **BingoCard** (one per game per user)
  - id, gameId, teamId, userId, gridSize (always 5)
- **BingoCell** (24 stored cells; the center Joker is not stored)
  - id, cardId, position (0–24)
  - resolutionId, resolutionType
  - sourceType: `team` | `member_provided` | `personal` | `empty`
  - sourceUserId, isEmpty (generated)
  - state: `pending` | `completed` | `pending_review` | `accomplished`
- **ReviewThread**, **ReviewMessage**, **ReviewFile**, **ReviewVote** (see spec 07)
- **TeamLeaderboard** (see spec 12)
- **ResolutionHistoryEntry** (see spec 13)

The tables `cell_proofs`, `proof_reviews` and `duplicate_reports` still exist in the schema but belong to removed flows. No code reads or writes them.

## Security & Permissions (high level)
- Authentication is required for any user-specific operation.
- A user can modify only:
  - their own profile and privacy settings
  - their own personal resolutions
  - their own bingo card (mark complete/undo, edit content, upload proof to threads about their cells)
- Other members' actions can still change a cell's state: a proof request moves a cell to review, votes decide its outcome, and progress on a typed team goal moves that goal's cell on every card (spec 06).
- Team leader can:
  - invite, delete the team, create, start, end and delete games, set their team goals
- Any team member can:
  - view other team members' bingo cards
  - create and update resolutions for other members
  - request proof on another member's completed cell, post in review threads and vote

## Primary Flows
1. Register → email verification → login
2. Create/update profile + choose public fields
3. Personal resolutions: add/update/delete, track progress, keep a history
4. Team lifecycle: create team → invite/join members
   Game lifecycle: leader creates a game → sets its team goal → members provide resolutions for each other → leader starts bingo → leader ends it, and can create the next one with the same team
5. Card gameplay: mark completed / undo, or complete automatically through typed progress
6. Proof review: a teammate requests proof → the owner uploads proof → members discuss and vote → the cell becomes `accomplished` or returns to `pending`
7. Visibility: view others' cards and the team leaderboard

## Non-Functional Requirements
- Data integrity: generated cards do not contain duplicate texts; the concurrent cell mutations listed in spec 11 are guarded.
- Auditability: resolutions record who wrote them, cells record their source user, votes record the voter, and resolution history records progress events.
- Privacy: honor per-field public/private settings for profile data.
