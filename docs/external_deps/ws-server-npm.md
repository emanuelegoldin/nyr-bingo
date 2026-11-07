# WebSocket server: npm dependencies

Source: `ws-server/package.json` and `ws-server/pnpm-lock.yaml`.

| Package | Section | Declared | Resolved | License | Purpose |
|---------|---------|----------|----------|---------|---------|
| `ws` | dependencies | ^8.19.0 | 8.19.0 | MIT | WebSocket server implementation used by `server.ts` for real-time updates. |
| `@types/ws` | dependencies | ^8.18.1 | 8.18.1 | MIT | Type definitions for `ws`. Only needed at compile time; it could move to `devDependencies`. |
| `typescript` | devDependencies | ^5.9.3 | 5.9.3 | Apache-2.0 | Compiles `server.ts` to `dist/`. |
| `vitest` | devDependencies | 5.1.0 | 5.1.0 | MIT | Tests of the server (`pnpm test`, `ws-server/tests/`). Development only; not in the runtime image, which installs `--prod`. Pulls in Vite 8 and `lightningcss` (MPL-2.0). |

There are 42 packages in total including transitive ones (34 MIT,
3 Apache-2.0, 3 MPL-2.0, 1 BSD-3-Clause, 1 ISC). The MPL-2.0 ones are
`lightningcss` 1.33.0 and its two linux-x64 binaries, reached through
`vitest` → `vite`: development only, never shipped, and unmodified, so MPL
asks nothing of us. No other copyleft licenses.

## Notes

- `ws-server/package.json` declares `"license": "ISC"`. This is the
  `npm init` default and was probably never chosen on purpose. Align it with
  the license chosen for the project (see [README.md](README.md)).
- The runtime image is built from `node:lts-slim`; see
  [container-images.md](container-images.md).
