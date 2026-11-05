# WebSocket server: npm dependencies

Source: `ws-server/package.json` and `ws-server/pnpm-lock.yaml`.

| Package | Section | Declared | Resolved | License | Purpose |
|---------|---------|----------|----------|---------|---------|
| `ws` | dependencies | ^8.19.0 | 8.19.0 | MIT | WebSocket server implementation used by `server.ts` for real-time updates. |
| `@types/ws` | dependencies | ^8.18.1 | 8.18.1 | MIT | Type definitions for `ws`. Only needed at compile time; it could move to `devDependencies`. |
| `typescript` | devDependencies | ^5.9.3 | 5.9.3 | Apache-2.0 | Compiles `server.ts` to `dist/`. |

There are 5 packages in total including transitive ones (4 MIT, 1
Apache-2.0). No copyleft licenses.

## Notes

- `ws-server/package.json` declares `"license": "ISC"`. This is the
  `npm init` default and was probably never chosen on purpose. Align it with
  the license chosen for the project (see [README.md](README.md)).
- The runtime image is built from `node:lts-slim`; see
  [container-images.md](container-images.md).
