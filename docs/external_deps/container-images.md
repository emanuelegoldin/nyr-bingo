# Container images and server software

Base images used by the Dockerfiles. CI (`.github/workflows/main.yml`) builds
an image from each one and pushes it to `ghcr.io/<owner>/<image_name>`.

| Our image | Dockerfile | Base image (tag) | Software | License | Purpose |
|-----------|------------|------------------|----------|---------|---------|
| `nextjs-app` | `nextjs/docker/Dockerfile.nextjs` | `node:lts-slim` | Node.js (current LTS) on Debian slim | Node.js: MIT. Debian packages: mixed (GPL, LGPL, BSD, MIT, ...) | Runtime for the Next.js `standalone` server. |
| `ws-server` | `ws-server/Dockerfile` | `node:lts-slim` | Node.js (current LTS) on Debian slim | same as above | Runtime for the WebSocket server. |
| `mariadb` | `database/docker/Dockerfile.mariadb` | `mariadb:11` | MariaDB Server 11.x | **GPL-2.0** | Relational database. Runs the init scripts in `database/mariadb-init/`. |
| `nginx` | `nginx/docker/Dockerfile.nginx` | `nginx:1.29.4` | Nginx 1.29.4 | BSD-2-Clause | Reverse proxy in front of Next.js and the WebSocket server; caching (`nyr-bingo_nginx.conf`). |
| `flyway` | `database-migrations/docker/Dockerfile.flyway` | `flyway/flyway:12.1.0` | Redgate Flyway 12.1.0 | Community edition: **Apache-2.0**. Paid editions: Redgate EULA | Applies the SQL migrations in `database-migrations/`. |

The database tests reuse `mariadb:11` and the `flyway` Dockerfile in
`database/test/docker-compose.test.yml`, which builds a throwaway test database.
Nothing new is added, and those images are not published.

The Node.js images also install **pnpm** globally (`npm install -g pnpm`, MIT)
to install dependencies at build time. The installed version is not pinned.

## Licensing notes

### Tags are not pinned

`node:lts-slim` and `mariadb:11` are floating tags. The software version (and
its license) can change on rebuild. Pin to a specific version (or digest) for
reproducible builds and a stable license inventory.

### MariaDB (GPL-2.0)

- Using MariaDB as a database server for a commercial or closed-source app is
  allowed and free. The GPL covers the server, not the applications that talk
  to it over the network.
- Our driver, `mysql2`, is MIT and does not link to MariaDB code, so the
  MariaDB client-library licensing questions (LGPL Connector/C) do not apply.
- We do not modify MariaDB. We only add SQL init scripts, which are our data
  and not a derivative work.
- If the `mariadb` image is **published publicly**, we are redistributing GPL
  software. Because the image is upstream's unmodified official image, linking
  to the upstream source (https://github.com/MariaDB/server and
  https://github.com/MariaDB/mariadb-docker) is generally considered enough.
- "MariaDB" is a trademark of the MariaDB Foundation. Do not imply that the
  product is endorsed by them.

### Nginx (BSD-2-Clause)

Free for commercial use. Keep the copyright notice if we redistribute it (it
is already inside the image). "NGINX" is a trademark of F5, Inc.

### Flyway (Redgate)

- Since Flyway 10, Redgate ships one distribution (the `flyway/flyway`
  image) that contains Community, Teams and Enterprise features. **Without a
  license key it runs as Community edition**, which is free, open source
  (Apache-2.0, https://github.com/flyway/flyway) and allowed for commercial
  use.
- Paid features (e.g. undo migrations, dry runs, some database-specific
  extras) need a paid Redgate subscription. We only use plain versioned
  migrations, so Community is enough.
- Recent Flyway versions may send anonymous usage data to Redgate. Set
  `REDGATE_DISABLE_TELEMETRY=true` if you want to turn it off.
- Re-check Redgate's licensing page whenever Flyway is upgraded, since
  Redgate has changed its edition and licensing model before:
  https://www.red-gate.com/products/flyway/

### Node.js / Debian base

Node.js is MIT. It bundles OpenSSL (Apache-2.0), ICU (Unicode License), libuv
(MIT), V8 (BSD-3-Clause) and others, all permissive. The Debian base contains
GPL/LGPL system packages. These are unmodified and run as separate programs,
so they do not affect our code. If the images are published, the source of
those packages is available from Debian (an upstream link is enough for
unmodified packages).

### Docker Hub

Base images are pulled from Docker Hub. Pulls are subject to Docker Hub rate
limits and terms of service. This is not a license cost, but CI may need to
authenticate if pulls start failing.
