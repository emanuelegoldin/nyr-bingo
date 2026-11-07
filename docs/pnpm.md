## Undefined Store

When executing install or add commands with pnpm, it was creating a pnpm-store folder at the root of the project instead of updating the package.json in the `nextjs/` fodler.

If we tried to run:

```sh
pnpm config get store-dir
```

**undefined** was returned.

Solution: set the store-dir in your **user-level** pnpm config, with an absolute path:

```sh
pnpm config set --location=global store-dir "$HOME/.local/share/pnpm/store"
```

Do not commit a project-level `.npmrc` with `store-dir` (e.g. `nextjs/.npmrc` with `store-dir=.pnpm-store`).
In CI, `actions/setup-node` (`cache: pnpm`) resolves the store path from the repository root, where a package-level `.npmrc` does not apply.
The cached path then differs from the store `pnpm install` actually uses, the store is never cached, and the job's post step fails with
`Path Validation Error: Path(s) specified in the action for caching do(es) not exist`.
