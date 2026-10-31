FROM node:lts-slim AS base
WORKDIR /app
RUN npm install -g pnpm
COPY package.json ./
COPY pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY . .
# Outputs to `dist/`
RUN pnpm run build

FROM node:lts-slim AS runner
WORKDIR /app
RUN corepack enable pnpm
RUN groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -m -d /app -s /bin/false appuser
COPY --from=base /app/package.json ./
COPY --from=base /app/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder --chown=appuser:appgroup /app/dist ./
ENV NODE_ENV=production
USER appuser
ENTRYPOINT ["node", "server.js"]
