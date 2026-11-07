# Next.js application: npm dependencies

Source: `nextjs/package.json` and `nextjs/pnpm-lock.yaml`. "Declared" is the
range in `package.json`. "Resolved" is the version locked and installed.

## Runtime dependencies (`dependencies`)

These are shipped in the production Docker image (Next.js `standalone`
output). Code that runs in the browser is also sent to users.

### Framework and core

| Package | Declared | Resolved | License | Purpose |
|---------|----------|----------|---------|---------|
| `next` | 15.5.9 | 15.5.9 | MIT | React framework: routing, server rendering, API routes, build, `standalone` server. |
| `react` | ^19.2.1 | 19.2.3 | MIT | UI library. |
| `react-dom` | ^19.2.1 | 19.2.3 | MIT | React renderer for the DOM. |
| `next-intl` | ^4.8.3 | 4.8.3 | MIT | Internationalization (i18n): translated messages and locale routing. See `docs/nextjs/i18n_app_routing.md`. |

### Data, auth, email, files

| Package | Declared | Resolved | License | Purpose |
|---------|----------|----------|---------|---------|
| `mysql2` | ^3.16.0 | 3.16.0 | MIT | MariaDB/MySQL client used by the repositories in `src/lib/db/`. |
| `bcryptjs` | ^3.0.2 | 3.0.3 | BSD-3-Clause | Password hashing (pure JS, no native build). |
| `nodemailer` | ^7.0.12 | 7.0.12 | MIT-0 | Sends emails (verification, notifications) over SMTP (`src/lib/email.ts`). |
| `sharp` | ^0.34.5 | 0.34.5 | Apache-2.0 | Converts uploaded images to WebP (`src/lib/uploads-processing.ts`). Bundles native **libvips**, see below. |
| `uuid` | ^11.1.0 | 11.1.0 | MIT | Generates unique identifiers. |
| `zod` | ^3.24.2 | 3.25.76 | MIT | Schema validation of form and request data. |

### Forms and UI

| Package | Declared | Resolved | License | Purpose |
|---------|----------|----------|---------|---------|
| `react-hook-form` | ^7.54.2 | 7.70.0 | MIT | Form state management. |
| `@hookform/resolvers` | ^4.1.3 | 4.1.3 | MIT | Connects `zod` schemas to `react-hook-form`. |
| `@radix-ui/react-alert-dialog` | ^1.1.6 | 1.1.15 | MIT | Accessible primitive behind `components/ui/alert-dialog.tsx`. |
| `@radix-ui/react-avatar` | ^1.1.3 | 1.1.11 | MIT | Primitive behind `components/ui/avatar.tsx`. |
| `@radix-ui/react-dialog` | ^1.1.6 | 1.1.15 | MIT | Primitive behind `components/ui/dialog.tsx` and `sheet.tsx`. |
| `@radix-ui/react-dropdown-menu` | ^2.1.6 | 2.1.16 | MIT | Primitive behind `components/ui/dropdown-menu.tsx`. |
| `@radix-ui/react-label` | ^2.1.2 | 2.1.8 | MIT | Primitive behind `components/ui/label.tsx` and `form.tsx`. |
| `@radix-ui/react-progress` | ^1.1.2 | 1.1.8 | MIT | Primitive behind `components/ui/progress.tsx`. |
| `@radix-ui/react-select` | ^2.1.6 | 2.2.6 | MIT | Primitive behind `components/ui/select.tsx`. |
| `@radix-ui/react-separator` | ^1.1.2 | 1.1.8 | MIT | Primitive behind `components/ui/separator.tsx`. |
| `@radix-ui/react-slot` | ^1.2.3 | 1.2.4 | MIT | `asChild` composition used by `button.tsx`, `form.tsx`, `sidebar.tsx`. |
| `@radix-ui/react-switch` | ^1.1.3 | 1.2.6 | MIT | Primitive behind `components/ui/switch.tsx`. |
| `@radix-ui/react-tabs` | ^1.1.3 | 1.1.13 | MIT | Primitive behind `components/ui/tabs.tsx`. |
| `@radix-ui/react-toast` | ^1.2.6 | 1.2.15 | MIT | Primitive behind `components/ui/toast.tsx`. |
| `@radix-ui/react-tooltip` | ^1.1.8 | 1.2.8 | MIT | Primitive behind `components/ui/tooltip.tsx`. |
| `class-variance-authority` | ^0.7.1 | 0.7.1 | Apache-2.0 | Defines component style variants (e.g. button sizes and colours). |
| `clsx` | ^2.1.1 | 2.1.1 | MIT | Builds conditional `className` strings. |
| `tailwind-merge` | ^3.0.1 | 3.4.0 | MIT | Merges conflicting Tailwind classes (used in the `cn()` helper). |
| `tailwindcss-animate` | ^1.0.7 | 1.0.7 | MIT | Tailwind plugin for animation utilities. Only used at build time, despite being listed under `dependencies`. |
| `lucide-react` | ^0.475.0 | 0.475.0 | ISC | Icon set (configured as the shadcn `iconLibrary`). Some icons come from Feather Icons (MIT); both notices are in the package's `LICENSE`. |
| `canvas-confetti` | 1.9.3 | 1.9.3 | ISC | Confetti animation on bingo (`src/components/confetti.ts`). |
| `recharts` | ^3.10.1 | 3.10.1 | MIT | Line chart of the game's Progress tab (`src/components/progress/`, spec 23). Brings in MIT/ISC/BSD-3-Clause transitive packages: `d3-*` and `internmap` (ISC; `d3-ease` BSD-3-Clause), `victory-vendor` (MIT AND ISC AND BSD-3-Clause), `@reduxjs/toolkit`, `react-redux`, `redux`, `redux-thunk`, `reselect`, `immer`, `es-toolkit`, `decimal.js-light`, `eventemitter3`, `tiny-invariant` (MIT). |

## Development dependencies (`devDependencies`)

Used only for development, build, lint and tests. Not shipped to users.

| Package | Declared | Resolved | License | Purpose |
|---------|----------|----------|---------|---------|
| `typescript` | ^5 | 5.9.3 | Apache-2.0 | Type checking (`pnpm typecheck`) and TS compilation. |
| `eslint` | 9.39.2 | 9.39.2 | MIT | Linter. |
| `eslint-config-next` | 16.1.1 | 16.1.1 | MIT | Next.js ESLint rules. Pulls in `axe-core` (MPL-2.0) through `eslint-plugin-jsx-a11y`. |
| `tailwindcss` | ^3.4.1 | 3.4.19 | MIT | Utility-first CSS framework. |
| `postcss` | ^8 | 8.5.6 | MIT | CSS processing pipeline used by Tailwind. |
| `@playwright/test` | ^1.58.2 | 1.58.2 | Apache-2.0 | End-to-end tests (`pnpm test:e2e`). Browsers are downloaded separately and have their own licenses (Chromium BSD, Firefox MPL-2.0, WebKit LGPL/BSD). They are used only locally and in CI. |
| `vitest` | 5.1.0 | 5.1.0 | MIT | Database tests (`pnpm test:db`, `tests/db/`). Pulls in Vite 8 and `lightningcss` (MPL-2.0). |
| `@types/node` | ^20 | 20.19.27 | MIT | Type definitions. |
| `@types/react` | ^19.2.1 | 19.2.7 | MIT | Type definitions. |
| `@types/react-dom` | ^19.2.1 | 19.2.3 | MIT | Type definitions. |
| `@types/bcryptjs` | ^2.4.6 | 2.4.6 | MIT | Type definitions. |
| `@types/canvas-confetti` | 1.9.0 | 1.9.0 | MIT | Type definitions. |
| `@types/nodemailer` | ^7.0.4 | 7.0.4 | MIT | Type definitions. Pulls in `@aws-sdk/client-sesv2` (Apache-2.0) as a type dependency, which is why the AWS SDK shows up in the lockfile. We do **not** use AWS SES. |

## Transitive dependencies

There are about 640 packages in total (direct and transitive, prod and dev),
counted from the installed `node_modules` and cross-checked with the lockfile:

| License | Count | Notes |
|---------|-------|-------|
| MIT | ~436 | |
| Apache-2.0 | ~108 | Includes AWS SDK (dev, types only), `@swc/core` binaries (via `next-intl`), `@img/sharp-*` binaries. |
| ISC | ~20 | |
| BSD-2-Clause | 7 | |
| BSD-3-Clause | 4 | |
| Apache-2.0 AND MIT | 2 | `@swc/core-linux-x64-gnu`, `@swc/core-linux-x64-musl` |
| **LGPL-3.0-or-later** | 2 | `@img/sharp-libvips-linux-x64`, `@img/sharp-libvips-linuxmusl-x64` 1.2.4 (see below) |
| MPL-2.0 | 4 | `axe-core` 4.11.1 (dev only); `lightningcss` and its two linux-x64 binaries (dev only, via `vitest` → `vite`) |
| CC-BY-4.0 | 1 | `caniuse-lite` (browser support data, used at build time) |
| CC0-1.0 | 1 | `language-subtag-registry` (dev, ESLint a11y plugin) |
| Python-2.0 | 1 | `argparse` 2.0.1 (dev, YAML parsing in tooling). Permissive. |
| 0BSD | 1 | `tslib` |
| MIT-0 | 1 | `nodemailer` |
| (missing field) | 1 | `seq-queue` 0.0.5 (via `mysql2`). Its bundled LICENSE file is MIT. |

No GPL, AGPL, SSPL, BUSL or other copyleft/source-available license that
would affect our own code was found among the npm packages.

Next.js also bundles many libraries inside `next/dist/compiled/`, all under
permissive licenses. Their notices ship inside the `next` package.

### sharp and libvips (LGPL-3.0-or-later)

`sharp` (Apache-2.0) loads a prebuilt **libvips** shared library from
`@img/sharp-libvips-<platform>`. libvips and several libraries bundled with it
(glib, librsvg, ...) are LGPL. That is acceptable for a commercial product
because:

- libvips is dynamically linked, so our code is not affected by the LGPL;
- we do not modify libvips.

When the Docker image is **distributed** (e.g. a public GHCR image) we must
keep the LGPL text and the libvips third-party notices that ship in the
`@img/sharp-libvips-*` package (they are already inside `node_modules` in the
image), and point to the libvips source (https://github.com/libvips/libvips
and https://github.com/lovell/sharp-libvips). If the app is only hosted,
nothing extra is required.

Note: `nextjs/pnpm-workspace.yaml` lists `sharp` under
`ignoredBuiltDependencies`. Its install script is skipped and the prebuilt
platform binaries above are used.

### Stale packages in `node_modules`

`node_modules/.pnpm` on the dev machine contains `satori@0.61.0` (MPL-2.0),
which is **not** referenced in `pnpm-lock.yaml`. It is a leftover from an
earlier install and is not part of the build. Run `pnpm install` (or
`pnpm store prune`) to clean it up.
