# Guided tour (spec 26, proof of concept)

A step-by-step tour that explains the bingo game on a **demo card**. It evaluates
[Intro.js](https://introjs.com/) as the tour library.

## Files

| File | Role |
|------|------|
| `guide-button.tsx` | Help (?) button in the app header. Mounts `BingoTour` while the tour runs. |
| `bingo-tour.tsx` | The bingo tour: its steps, and the demo state derived from the current step. |
| `demo-card.tsx` | Full-screen layer with the demo card, reusing `CardGrid`, `CellFace` and `JokerCell`. |
| `demo-cell-detail.tsx` | Details of the target cell with its Mark Complete action, mimicking the cell detail dialog. |
| `demo-data.ts` | Sample cells and the `data-tour` markers the steps highlight. |
| `intro-adapter.ts` | **The only file that imports Intro.js.** `startTour()` runs a list of `GuideStep`s. |
| `guide-theme.css` | Maps the Intro.js tooltip colours to the theme tokens (light and dark). |

## How it works

- The tour never touches real cards. The demo card is local React state and
  calls no API, so it sends no notifications or real-time signals.
- The demo state comes from the current step index. Going back undoes it, and it
  disappears when `BingoTour` unmounts at the end of the tour (finished, skipped
  or closed). The next tour starts from the initial card.
- Every highlighted element is rendered from the start, and the cell details are
  only hidden (`invisible`), so Intro.js can find and measure them when the tour
  starts.
- The demo layer is a plain portal into `document.body`, not a Radix dialog,
  because a dialog's focus trap and `pointer-events: none` would block the
  tooltip. The portal also escapes the header's `backdrop-blur`, which would
  otherwise contain a `fixed` child.
- `intro-adapter.ts` (with the library and its CSS) is loaded with a dynamic
  `import()` only when a tour starts.

## Licensing

Intro.js is **AGPL-3.0**, and a **paid license** is required for commercial
use. See `docs/external_deps/nextjs-npm.md` ("Intro.js (AGPL-3.0)") and point 7
of `docs/external_deps/README.md`.

## Replacing the library

Rewrite `intro-adapter.ts` so it keeps the same `startTour(options)` signature
(steps with text, optional title and target selector, labels, `onStepChange`,
`onEnd`, a handle with `stop()`), and rewrite `guide-theme.css`. Nothing else
imports the library. Then swap the package in `nextjs/package.json` and update
`docs/external_deps/`.

## Removing the tour

1. Delete this folder.
2. Remove `<GuideButton />` and its import from `components/app-header.tsx`.
3. Delete `i18n/messages/{en,it,de}/Guide.json` and their entries in
   `i18n/messages/index.ts`.
4. Remove `intro.js` from `nextjs/package.json` and the lockfile, and its entries
   in `docs/external_deps/`.
5. Delete or archive `specs/26-guided-tour.md`, then run `python3 scripts/codemap.py`.
