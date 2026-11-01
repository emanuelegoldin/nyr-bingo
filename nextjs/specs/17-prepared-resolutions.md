# 17 — Prepared Resolutions

## Purpose
Offer a shared pool of ready-made resolutions, so that users do not have to come up with every resolution on their own.

## User Stories Covered
- Browse prepared resolutions by how long they take
- Add a prepared resolution to my personal resolutions

## In Scope
- The pool and its categories
- Browsing the pool and copying entries into personal resolutions

## Out of Scope
- Managing the pool from the application. Entries are added through database migrations.
- Translating the pool. Entries are in English only.

## Data Model
The pool lives in the `prepared_resolutions` table, separate from `resolutions`.

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | VARCHAR(36) | Fixed by the migration that adds the entry |
| `category` | ENUM | `short`, `medium`, `long` |
| `resolution_type` | ENUM | `base`, `compound`, `iterative` |
| `title` | VARCHAR(255) | Required |
| `description` | TEXT | Optional |
| `subtasks` | JSON | `compound` only |
| `number_of_repetition` | INT | `iterative` only |
| `created_at` | DATETIME | |

An entry has no owner and no progress. Users only ever receive a copy of it, so any number of users can use the same entry and changing a copy never affects the pool or other copies.

### Categories
| Category | Meaning | Example |
| -------- | ------- | ------- |
| `short` | Can be completed in days, with no preparation | Call an old friend |
| `medium` | Completed in weeks, or more demanding but scoped in days | Hike a mountain trail |
| `long` | Months up to the whole year | Do not drink alcohol for the whole year |

A goal is categorized by the total effort it takes, not by the length of its last step: running a marathon happens in a day but takes months of preparation, so it is `long`.

## Functional Requirements

### Browsing the Pool
`GET /api/resolutions/prepared` returns every entry, grouped in a stable order by category.

On `/resolutions`, the **Browse ideas** button next to the add button opens a dialog with one tab per category. Each entry shows its title, description and type, and an **Add** button. An entry whose text matches one of the user's personal resolutions shows **Added** instead, and its button is disabled.

### Adding to Personal Resolutions
`POST /api/resolutions/prepared/[id]/add`

- Creates a resolution with `scope = 'personal'` owned by the caller, with the entry's type, title, description and type-specific data. Progress starts at zero.
- The copy is an ordinary personal resolution (spec 03): the user can edit or delete it, and it fills cards like any other.
- Returns `201` with the id of the copy.
- Returns `404` for an unknown entry.
- Returns `409` if the caller already has a personal resolution with the same text, compared as in spec 05. A user who changes the text of a copy can add the entry again.

## Permissions
- Both endpoints require authentication.
- Both are available to unverified users, like personal resolutions (spec 03).

## Acceptance Criteria
- A user can browse the pool by category from `/resolutions`.
- A user can add an entry, which appears in their personal resolutions.
- Two users can add the same entry, and each gets an independent copy.
- Adding an entry the user already has fails with `409` and creates nothing, and the dialog shows such an entry as added.
