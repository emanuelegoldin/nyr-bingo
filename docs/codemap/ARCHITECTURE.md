# Architecture

Hand-written overview of how the pieces connect. Update it when the wiring changes.
For "which file implements X", use the generated maps in this folder (see `README.md`).
Paths are relative to `nextjs/src/` unless stated otherwise.

## Components (orchestrated by `docker-compose.yml`)

| Component | Source | Role |
|---|---|---|
| Nginx | `nginx/nyr-bingo_nginx.conf` | Reverse proxy. `/ws` goes to ws-server:8888, everything else to Next.js |
| Next.js | `nextjs/` | UI and REST API (App Router) |
| WebSocket server | `ws-server/server.ts` | WebSocket rooms. Holds no data and never touches the DB |
| MariaDB + Flyway | `database/`, `database-migrations/` | Schema and migrations (index: `migrations.md`) |

## Request flow (mutations)

```
page / component  ──apiFetch()──▶  app/api/**/route.ts  ──▶  lib/db/*-repository.ts  ──▶  MariaDB
 (lib/api-client.ts)                withAuth() + authz          query / execute / withTransaction
                                          │
                                          └─▶ after commit: lib/team-signals.ts  (refetch hints)
                                                            lib/notifications    (user notifications)
```

- **Client calls** go through `apiFetch` in `lib/api-client.ts`, which returns `ApiResult<T>`. Errors are shown with `hooks/use-api-error-toast.ts`.
- **Routes** are wrapped in `withAuth` from `app/api/utils.ts`, which supplies `{ params, currentUser }`. Errors are returned with `errorResponse`.
- **Authorization** lives in `lib/authz/` (spec 21), with roles, permissions, ownership and the `requirePermission` / `requirePagePermission` helpers. Access checks used across a whole resource sit next to its routes: `app/api/games/game-access.ts`, `app/api/threads/thread-access.ts` and `app/api/cells/card-owner.ts`.
- **DB access** is only in `lib/db/`, and callers import it from the `lib/db/index.ts` barrel. `connection.ts` provides `query`, `execute` and `withTransaction`. Entity types are in `lib/db/types.ts`. The `*-rows.ts` files are internal mappers and are not exported from the barrel.
- **Shared client/server logic** (no DB access) is in `lib/shared/`: bingo lines, shuffle, resolution types, dates and WS message types.

## Real-time updates (spec 11)

```
route ─▶ lib/team-signals.ts ─▶ lib/ws-notify.ts ──POST /internal/notify (x-ws-secret)──▶ ws-server
                                                                                            │ broadcast to room
browser ◀── hooks/use-ws-room.ts ◀── components/team-ws-provider.tsx ◀── lib/ws-client.ts ◀──┘
```

- Rooms are `{ type: 'card' | 'thread' | 'user', id }` (`WsRoom` in `lib/shared/ws-messages.ts`).
- Messages only tell clients to refetch. They never carry data, and a failed signal never fails the request.
- To join a room, the client gets a signed token from `app/api/ws-token/route.ts`, which uses `lib/ws-token.ts`. ws-server checks it with the shared secret.
- ws-server has its own copies of the message types in `ws-server/messages/`, so they **must stay in sync** with `lib/shared/ws-messages.ts`.

## Notifications (spec 19)

- `lib/notifications/index.ts` exports the `notifications` publisher, which is backed by the database (`db-publisher.ts`), and `announceCellChanges`.
- Events stay pending for a short delay, so they can be cancelled or batched. `dispatcher.ts` releases them and signals each recipient's `user` room.
- UI: `components/notifications/*` and `hooks/use-notification-socket.ts`.

## Background jobs (`instrumentation.ts`)

Run once at Node startup:
- An hourly sweep that ends expired games (`lib/game-ending.ts`, which also archives them) and closes review threads past their deadline.
- A loop every few seconds that releases due notifications.

## Review thread lifecycle (specs 07, 18)

- Open threads live in `review_threads`, with messages, files and votes (`lib/db/review-thread-repository.ts`, `review-file-repository.ts`). Closing one, by votes, the completing user, undo or the deadline, keeps everything and sets `outcome`: the thread is now an archived thread.
- `lib/db/closed-thread-repository.ts` reads a running game's closed threads and deletes one (files from disk first). `lib/db/archived-thread-repository.ts` copies them into `archived_thread*` tables when `archiveGame` runs, and reads and deletes them there. Both map to `ArchivedThread` through `archived-thread-rows.ts`.
- A proof file on disk is content-addressed and can be named by `review_files` and `archived_thread_files` rows; `deleteStoredFileUnlessShared` removes it only when no other row in either table names it.
- Both game pages load the threads on the server and render `components/threads/archived-threads-tab.tsx`.

## Progress history (spec 23)

- `refreshLeaderboardEntry` (`lib/db/leaderboard-repository.ts`) logs a `leaderboard_progress` row whenever a player's completed count changes; `initializeGameLeaderboard` writes the `0` points at game start. `archiveGame` copies them into `archived_progress` through `lib/db/archived-progress-repository.ts`.
- Both game pages load the points on the server and render `components/progress/progress-tab.tsx`, which builds one `ProgressData` and renders the views listed in `components/progress/views.ts`. A new progress view is a component taking `ProgressViewProps` plus one entry there.

## Cell reactions (spec 24)

- Reactions live in `cell_reactions` (`lib/db/cell-reaction-repository.ts`) and are read with the cards in `bingo-card-repository.ts`. The pool is `lib/shared/reactions.ts`, and each id has an SVG in `components/cell/reaction-icon.tsx`.
- Every write that can move a cell out of `completed` or `accomplished` calls `clearUnstampedCellReactions` after its `UPDATE`. A new state transition must call it too.
- `archiveGame` copies them into `archived_cell_reactions` with `saveReactionSnapshot`.

## UI structure

- `app/(app)/*` holds the pages behind login, and `app/(auth)/*` holds login and register. Each route has a server `page.tsx` and a `*-client.tsx` component. Pieces used by only one route go in that route's `_components/`.
- Reusable components are in `components/`, grouped by area (cell, bingo-card, dialogs, team, archive, threads, progress, notifications). Primitives come from `components/ui/` (shadcn/ui), so reuse them.
- The page title and other app state come from `hooks/AppContext.tsx` (see `docs/nextjs/context_provider.md`).

## i18n (spec 15)

- next-intl reads the locale from the `locale` cookie in `i18n/request.ts`. Configuration is in `i18n/config.ts` (see `docs/nextjs/i18n_app_routing.md`).
- Strings live in `i18n/messages/{en,it,de}/<Namespace>.json`, with one file per namespace. Every key must exist in all three languages.
- Use `useTranslations('<Namespace>')` in client components and `getTranslations` on the server.

## Theme (spec 25)

- The `theme` cookie (`light`, `dark` or `system`; settings in `lib/theme/config.ts`) is read by `lib/theme/get-theme.ts` in `app/layout.tsx`. That file sets the `dark` class on `<html>` for an explicit theme, or renders `components/theme/theme-script.tsx` to resolve `system` before paint.
- `components/theme/theme-provider.tsx` holds the theme on the client. `useTheme()` returns `{ theme, setTheme }`. `setTheme` writes the cookie and applies the class without a reload. The provider follows OS changes while the theme is `system`. The switcher is `components/theme/theme-switcher.tsx`.
- Colours come from the tokens in `app/globals.css` (`:root` and `.dark`), mapped in `tailwind.config.ts`. Use `success`, `warning` and `destructive` for status colours, not fixed palette classes.

## Where new things go

| Adding… | Put it in |
|---|---|
| a DB query | the matching `lib/db/*-repository.ts`, then export it from `lib/db/index.ts` |
| a schema change | a new `database-migrations/V*.sql` file, then a line in `docs/database/migrations.md` |
| an API endpoint | `app/api/<resource>/.../route.ts`, wrapped in `withAuth` and checked through `lib/authz` |
| a permission | `lib/authz/` (spec 21) |
| a real-time refresh | a call to a `lib/team-signals.ts` helper after the commit |
| UI text | a key in all three `i18n/messages/*/<Namespace>.json` files |
| a colour | a token in `app/globals.css`, defined in both `:root` and `.dark`, plus `tailwind.config.ts` |
| an external package | an update to `docs/external_deps/` in the same change |

Start every new file with a header docblock, so `scripts/codemap.py` can map it:

```ts
/**
 * Short purpose line
 * Spec Reference: NN-spec-name.md - Section Heading
 */
```
