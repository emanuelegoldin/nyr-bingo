# Tooling, CI/CD and development environment

These are used to build, test and release the app. None of them ship inside
the product, so their licenses do not create obligations for the published
app. They are listed for completeness and because some are services with
usage terms.

## Package manager and runtime

| Tool | Version | License | Purpose |
|------|---------|---------|---------|
| pnpm | 10.28.0 (`packageManager` field). Unpinned `latest` in Dockerfiles | MIT | Package manager for `nextjs/` and `ws-server/`. See `docs/pnpm.md`. |
| Node.js | LTS (Dockerfiles, `node-version: 'lts/*'`), 22 (CI, dev container) | MIT | JavaScript runtime. |
| Turbopack | bundled with Next.js 15.5.9 | MIT | Dev-server bundler (`next dev --turbopack`). |

## GitHub Actions (`.github/workflows/`)

| Action | Version(s) | License | Purpose |
|--------|-----------|---------|---------|
| `actions/checkout` | v4, v6 | MIT | Checks out the repository. |
| `actions/setup-node` | v4, v6 | MIT | Installs Node.js. |
| `actions/upload-artifact` | v4 | MIT | Shares build output between jobs. |
| `actions/download-artifact` | v4 | MIT | Same as above. |
| `pnpm/action-setup` | v4 | MIT | Installs pnpm in CI. |
| `docker/login-action` | v3 | Apache-2.0 | Logs in to GHCR. |
| `docker/metadata-action` | v5 | Apache-2.0 | Computes image tags and labels. |
| `docker/build-push-action` | v6 | Apache-2.0 | Builds and pushes the 5 images. |
| `cycjimmy/semantic-release-action` | v6 | MIT | Runs semantic-release on `main`. |

Workflows: `main.yml` (release and image publishing), `nextjs-app-build.yml`,
`websocket-server-build.yml`, `node-build-reusable-workflow.yml`,
`docker-build-and-push.yml`, `pr-title.yml`, `db-tests.yml` (DB tests against the throwaway MariaDB of `database/test/`; no new actions).

Actions are pinned to major tags, not commit SHAs. For supply-chain hardening,
consider pinning third-party actions (`cycjimmy/*`, `pnpm/*`) to a full SHA.

## Release tooling (`.releaserc.json`)

| Package | License | Purpose |
|---------|---------|---------|
| `semantic-release` (via the action) | MIT | Picks the version from commit messages (`[MAJOR]`/`[MINOR]`/`[PATCH]`/`[NO-RELEASE]`). |
| `@semantic-release/commit-analyzer` | MIT | Analyzes commits to pick the release type. |
| `@semantic-release/release-notes-generator` | MIT | Generates release notes. |
| `@semantic-release/github` | MIT | Publishes GitHub releases. |

## Hosted services used by the pipeline

| Service | Purpose | Terms |
|---------|---------|-------|
| GitHub (repo, Actions, Releases) | Source hosting and CI/CD | GitHub Terms of Service. Actions minutes are free for public repos and have a free quota for private ones. |
| GitHub Container Registry (`ghcr.io`) | Hosts the 5 Docker images | Free for public packages. Storage and transfer quotas apply to private ones. |
| Docker Hub | Source of base images (`node`, `mariadb`, `nginx`, `flyway/flyway`) | Docker Hub ToS. Rate limits apply to anonymous pulls. |

## Development environment

| Item | Version | License | Purpose |
|------|---------|---------|---------|
| Dev container image `mcr.microsoft.com/devcontainers/typescript-node` | `1-22-bookworm` | MIT (image definition). Debian contents mixed | VS Code dev container (`.devcontainer/devcontainer.json`). |
| Dev container feature `ghcr.io/devcontainers/features/docker-outside-of-docker` | 1 | MIT | Uses the host Docker daemon from inside the dev container. |
| VS Code extension `ms-playwright.playwright` | latest | Apache-2.0 | Runs Playwright tests from the editor. |
| Git hook `.githooks/commit-msg` | in-repo | ours | Enforces the commit message format. Adapted from the Pro Git book (CC BY-NC-SA 3.0). The hook is a short adaptation of a documented idea. |
| Playwright browsers | match `@playwright/test` 1.58.2 | Chromium: BSD-3-Clause. Firefox: MPL-2.0. WebKit: LGPL-2.1/BSD | Downloaded for E2E tests only. |
