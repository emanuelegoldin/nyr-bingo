## Undefined Store

When executing install or add commands with pnpm, it was creating a pnpm-store folder at the root of the project instead of updating the package.json in the `nextjs/` fodler.

If we tried to run:

```sh
pnpm config get store-dir
```

**undefined** was returned.

Solution: set the store-dir to point to `nextjs/.pnpm-store`

```sh
# From nextjs/
pnpm config set store-dir ".pnpm-store"
```