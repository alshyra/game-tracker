# syntax=docker/dockerfile:1

# ── Build : dépendances + front ─────────────────────────────
FROM oven/bun:1.3.14 AS build
WORKDIR /app

COPY package.json bun.lock tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY apps/server/package.json apps/server/
COPY apps/mcp/package.json apps/mcp/
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile

COPY . .
RUN bun run --cwd apps/web build

# ── Runtime : Bun sert l'API + la SPA buildée ───────────────
FROM oven/bun:1.3.14-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    GAMESHELF_ROOT=/data \
    PORT=3000

COPY --from=build /app /app
RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 3000

CMD ["bun", "apps/server/src/index.ts"]
