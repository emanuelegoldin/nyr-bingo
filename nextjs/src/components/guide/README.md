# Guided tours (spec 26, proof of concept)

Step-by-step tours that explain the app on **demo content**, listed on the
Guides page (`/guides`, linked from the sidebar). They evaluate
[Intro.js](https://introjs.com/) as the tour library.

## Layout

| Path | Role |
|------|------|
| `types.ts` | `GuideTourProps` (`{ onEnd }`), the contract of every tour component, and `GuideDefinition`. |
| `guides.ts` | Registry of the guides shown on the Guides page, in order. |
| `guide-list.tsx` | Renders the registry as `GuideEntry` items (used by `app/(app)/guides`). |
| `guide-entry.tsx` | Reusable entry: title, expandable description and Play. Play mounts the tour until it calls `onEnd`. |
| `engine/` | Library side, shared by every tour. |
| `engine/intro-adapter.ts` | **The only file that imports Intro.js.** `startTour()` runs a list of `GuideStep`s. |
| `engine/guide-theme.css` | Maps the Intro.js tooltip colours to the theme tokens (light and dark). |
| `engine/use-guided-tour.ts` | Hook that loads the adapter, starts the tour on mount, stops it on unmount, and returns `{ stepIndex, next }`. |
| `engine/tour-selector.ts` | `tourSelector()`: the selector of a `data-tour` target. |
| `sandbox/` | Demo pieces any tour can reuse. |
| `sandbox/sandbox-layer.tsx` | Full-screen portal layer with a "this is a demo" notice. |
| `sandbox/demo-cells.ts`, `sandbox/demo-grid.tsx` | Sample 3x3 cards and their grid, drawn with `CardGrid`, `CellFace` and `JokerCell`; the stamp or hourglass animates in when a cell changes. |
| `sandbox/demo-game-tabs.tsx` | The game page's tab bar with one tab selected, to show where a feature is. |
| `sandbox/demo-thread.tsx`, `sandbox/demo-vote.tsx` | A review thread (reusing `ThreadFiles` and `ThreadMessages`) with sample content, and its vote section. |
| `bingo-card/` | The bingo tour and everything only it uses. |
| `bingo-card/bingo-tour.tsx` | Its steps, and the demo state derived from the current step. |
| `bingo-card/demo-card.tsx` | The demo card, reusing `CardGrid`, `CellFace` and `JokerCell`. |
| `bingo-card/demo-cell-detail.tsx` | Details of the target cell with Mark Complete, mimicking the cell detail dialog. |
| `bingo-card/demo-data.ts` | Sample cells and the `data-tour` markers the steps highlight. |
| `leaderboard/` | Leaderboard tour, on the real podium and table with sample players. |
| `progress/` | Progress tour, on the real chart with sample points. Its action steps go on when a click lands inside the highlighted element. |
| `request-proof/` | Request-proof tour: the user's and a teammate's card, the Request Proof dialog and the new thread. |
| `proof-thread-owner/`, `proof-thread-voter/` | The review thread seen by the card owner (no action) and by a teammate (votes). |

Texts live in the `Guide` namespace (`i18n/messages/*/Guide.json`): `page`,
`play` and `nav` are shared, `sandbox` holds the texts of the shared demo pieces
(notice, sample resolutions, thread messages), and each guide owns a subtree
named after its id (`bingoCard`, `leaderboard`, ...) with at least `title` and
`description`. Keep step texts to one short sentence.

## Adding a guide

1. Create `<guide-name>/` with a component taking `GuideTourProps`. Build its
   steps (memoised) and call `useGuidedTour({ steps, onEnd })`; render any demo
   content inside `SandboxLayer`, marking targets with `data-tour`.
2. Add `<id>: { title, description, ... }` to `Guide.json` in every locale. The
   `GuideId` type only accepts ids that have a title and description.
3. List `{ id, Tour }` in `guides.ts`.
4. Move anything a second tour needs from a tour folder to `sandbox/` (demo
   pieces) or `engine/` (library side).

## How it works

- Tours never touch real data. Demo content is local React state and calls no
  API, so it sends no notifications or real-time signals.
- A tour's demo state comes from the current step index. Going back undoes it,
  and it disappears when the tour component unmounts at the end of the tour
  (finished, skipped or closed). The next run starts from the initial state.
- On **action steps** the user continues by clicking the highlighted element:
  the adapter hides Next and lets clicks through, and the demo calls `next()`.
  Because the sandbox layer is its own stacking context, below the Intro.js
  overlay, the adapter sets `guide-action-step` on `<html>` during those steps
  so the overlay ignores clicks (`engine/guide-theme.css`).
- Every highlighted element is rendered from the start (the bingo cell details
  are only hidden with `invisible`), so Intro.js can find and measure them when
  the tour starts.
- The sandbox layer is a plain portal into `document.body`, not a Radix dialog,
  because a dialog's focus trap and `pointer-events: none` would block the
  tooltip.
- `engine/intro-adapter.ts` (with the library and its CSS) is loaded with a
  dynamic `import()` only when a tour starts.

## Licensing

Intro.js is **AGPL-3.0**, and a **paid license** is required for commercial
use. See `docs/external_deps/nextjs-npm.md` ("Intro.js (AGPL-3.0)") and point 7
of `docs/external_deps/README.md`.

## Replacing the library

Rewrite `engine/intro-adapter.ts` so it keeps the same `startTour(options)`
signature (steps with text, optional title, target selector and `action` flag,
labels, `onStepChange`, `onEnd`, a handle with `next()` and `stop()`), and
rewrite `engine/guide-theme.css`. Nothing else imports the library. Then swap
the package in `nextjs/package.json` and update `docs/external_deps/`.

## Removing the tours

1. Delete this folder and `app/(app)/guides/`.
2. Remove the Guides item from `components/app-sidebar.tsx` and `guides` from
   `i18n/messages/*/Nav.json`.
3. Delete `i18n/messages/{en,it,de}/Guide.json` and their entries in
   `i18n/messages/index.ts`.
4. Remove `intro.js` from `nextjs/package.json` and the lockfile, and its entries
   in `docs/external_deps/`.
5. Delete or archive `specs/26-guided-tour.md`, update spec 14, then run
   `python3 scripts/codemap.py`.
