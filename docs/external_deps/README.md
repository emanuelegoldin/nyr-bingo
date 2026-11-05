# External Dependencies

Inventory of the third-party libraries, tools, container images, assets and
services used by the project, with their versions, why we use them and their
licenses.

Snapshot taken on **2026-11-05** from the `dev` branch (commit `fd0e69c`).

## Files

| File | Contents |
|------|----------|
| [nextjs-npm.md](nextjs-npm.md) | npm packages of the Next.js application (`nextjs/`) |
| [ws-server-npm.md](ws-server-npm.md) | npm packages of the WebSocket server (`ws-server/`) |
| [container-images.md](container-images.md) | Docker base images and the services they run (MariaDB, Nginx, Flyway, Node.js) |
| [tooling-ci.md](tooling-ci.md) | Package manager, GitHub Actions, release tooling, dev container |
| [assets-and-services.md](assets-and-services.md) | Fonts, copied source code (shadcn/ui), static media, external services |

## License summary

None of the dependencies needs a paid commercial license. All of them can be
used in a commercial product. The obligations below are what remains.

| License | Where | Payment? | What it asks of us |
|---------|-------|----------|--------------------|
| MIT, ISC, BSD-2-Clause, BSD-3-Clause, 0BSD, MIT-0 | Most npm packages, Nginx | No | Keep the copyright and license text when we **redistribute** the code (MIT-0 and 0BSD do not even ask for that). BSD-3-Clause also forbids using the authors' names to endorse our product. |
| Apache-2.0 | sharp, class-variance-authority, TypeScript, Playwright, Flyway Community, many transitive packages | No | Keep the license text and any `NOTICE` file when redistributing. State changes if we modify the code. Includes a patent grant. |
| LGPL-3.0-or-later | `@img/sharp-libvips-*` (native libvips bundled with sharp) | No | When redistributing: ship the license text, say libvips is used, and let users swap the library (met because it is loaded as a separate shared library). |
| GPL-2.0 | MariaDB server (Docker image) | No | We run MariaDB unmodified as a separate process, and our code talks to it over the network through the MIT `mysql2` driver, so our code is **not** affected by the GPL. If we publish the `mariadb` image we must make the source of the GPL parts available; pointing to the upstream sources is enough for unmodified upstream images. |
| MPL-2.0 | `axe-core` (dev only, via ESLint) | No | Applies only to changes made to MPL files. Not shipped. |
| SIL OFL-1.1 | Inter and Space Grotesk fonts | No | Free to use. The fonts may not be sold on their own. Not a concern because they are served by Google Fonts. |
| CC-BY-4.0 | `caniuse-lite` (build-time data) | No | Attribution if redistributed. It is only used at build time and not shipped to users. |

### Attribution: do we need to credit the authors?

- **Hosted web app only (SaaS):** server-side code that is not handed to users
  is not "distributed", so permissive licenses ask nothing more. The
  JavaScript sent to browsers **is** distributed. Next.js keeps license
  comments in the bundles, but adding a public "Open-source licenses" /
  "Credits" page is a cheap and widely used good practice.
- **Publishing Docker images or the source code publicly:** this counts as
  redistribution. Every MIT/ISC/BSD/Apache component must keep its license
  text, and LGPL (libvips) and GPL (MariaDB) source must be available. The
  usual answer is a `THIRD_PARTY_NOTICES` file generated from the lockfile
  (for example with `pnpm licenses list --prod`) and published next to the
  images.

### Points to check before publishing

1. **The project has no license.** There is no `LICENSE` file in the
   repository, and the `ws-server/package.json` default says `"ISC"`. Pick a
   license (or "all rights reserved") on purpose before going public.
2. **Public GHCR images.** CI pushes 5 images to
   `ghcr.io/<owner>/{nextjs-app,mariadb,nginx,flyway,ws-server}`. If these
   packages are public, the redistribution duties above apply (notices for
   everything, a source offer for MariaDB and libvips).
3. **Google Fonts CDN and GDPR.** Fonts are loaded from `fonts.googleapis.com`,
   which sends visitors' IP addresses to Google. A German court ruled in 2022
   (LG München I, 3 O 17493/20) that doing this without consent breaks the
   GDPR. If EU users are targeted, consider self-hosting the fonts (the
   license allows it). See [assets-and-services.md](assets-and-services.md).
4. **Static media of unknown origin.** The provenance of
   `nextjs/public/media/logo.webp` and `home-it.webp` is not documented.
   Confirm that we own them or have a license for them.
5. **Flyway edition.** The `flyway/flyway` image contains Redgate's combined
   distribution. Without a license key it runs the free Community edition
   (Apache-2.0). Do not enable paid (Teams/Enterprise) features without a
   subscription. See [container-images.md](container-images.md).
6. **`seq-queue`** (a transitive dependency of `mysql2`) has no `license` field
   in its `package.json`. Its bundled `LICENSE` file is MIT, so it is fine.
   Automatic license scanners may flag it as "unknown".

## How this inventory was produced

- Direct npm dependencies: declared ranges from `package.json`, resolved
  versions and license fields from the installed `node_modules`, checked
  against `pnpm-lock.yaml`.
- Transitive npm dependencies: license fields of every package in
  `nextjs/node_modules/.pnpm` that appears in `pnpm-lock.yaml`.
- Images and tools: `Dockerfile`s, `.github/workflows/`, `.devcontainer/`,
  `.releaserc.json`.
- `docker-compose.yml` could not be read during this analysis (access
  restricted), so it was not inspected. It is expected to reference the same
  images built from the Dockerfiles above.

## Maintaining this inventory

Whenever you add, remove, upgrade (across a major version) or start using
anything external that is not already tracked, update the matching file here
**in the same change**. This includes:

- npm packages (direct dependencies, and transitive ones with a non-permissive
  or unusual license)
- Docker base images and server software
- CLI tools, GitHub Actions, release tooling
- fonts, icons, images and other assets
- code copied from third parties
- external services and APIs

Use the existing file for the area (see [Files](#files)). Create a new file
only for a new area, and link it from the table above.

For each entry record:

- **Name**
- **Version**: both the declared range and the resolved version from the
  lockfile, or the image tag
- **License**: as an SPDX identifier
- **Purpose**: why we use it, and where (file/module)
- **Scope**: runtime (shipped to users or in production images) vs
  development/build only

Check the license before adopting a dependency, and report it to the user if
it:

- requires payment for commercial use, or has paid editions/features (e.g.
  Flyway Teams)
- is copyleft (GPL, LGPL, AGPL, MPL) or source-available (SSPL, BUSL,
  Elastic, ...)
- requires attribution or crediting the author beyond keeping the license
  text (e.g. CC-BY)
- restricts use of the authors' names or trademarks
- sends user data to a third party (privacy/GDPR, e.g. CDNs, analytics)
- is missing or unknown

Record these obligations in the entry and, if they affect publishing, in
[Points to check before publishing](#points-to-check-before-publishing).

Never add a dependency with an AGPL, SSPL, BUSL or unknown license, or one
that requires a paid license, without explicit user approval.

Useful commands (run in `nextjs/` or `ws-server/`):

```sh
pnpm list --depth 0          # direct dependencies and resolved versions
pnpm licenses list --prod    # licenses of everything shipped to production
pnpm licenses list           # including dev dependencies
```

> This document is a technical inventory, not legal advice. Have the license
> position reviewed before a commercial launch.
