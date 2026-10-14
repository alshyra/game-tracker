# AGENTS.md

Self-hosted Steam game tracker. Bun monorepo, no database — `games.yaml` is the
local source of truth, `data/steam-snapshot.json` is a disposable Steam cache.

## Commands

```bash
bun install
cp .env.example .env            # set STEAM_API_KEY (never commit .env)

bun run dev                    # API :3000 + Vite :5173 (proxies /api)
bun run cli sync --apply        # import Steam library (dry-run without --apply)
bun run cli online --apply      # mark online games (dry-run without --apply)

bun run check                   # Biome lint + format
bun run typecheck               # tsc (core, server, mcp) + vue-tsc (web)
bun test                        # all tests
bun test packages/core/test/merge.test.ts   # single test file
```

`just` mirrors every npm script (`just dev`, `just sync-apply`, `just check`, …).

## Architecture

Hexagonal — `packages/core` knows nothing about HTTP, CLI, or `Bun.serve`:

- `packages/core/src/domain/` — TypeBox schemas, ports, merge/online rules
- `packages/core/src/applications/` — use cases (sync, list, setLocal, detectOnline)
- `packages/core/src/adapters/` — Steam API + YAML store implementations
- `apps/server/` — Elysia HTTP + CLI (commander); the only composition root
- `apps/web/` — Vue 3 + Vite; imports only the `App` type from server (Eden Treaty)
- `apps/mcp/` — MCP server (stdio + Streamable HTTP), same use cases as CLI

## Data model

- `games.yaml` — **local data only** (status, rating, notes, online, title/cover
  overrides). Written by the UI, versioned, human-readable. Atomic writes.
- `data/steam-snapshot.json` — Steam API cache (playtime, covers, genres).
  Gitignorable, disposable, rebuilt by `sync`.
- **Per-field source of truth**: local fields are NEVER overwritten by Steam data.
  Steam never writes to `games.yaml`.
- Game key = `steam_appid` (string) or `manual:<slug>` for non-Steam games.

## Conventions

- **Dry-run by default**: every write command (sync, online, set_status) is a
  simulation. Pass `--apply` to actually write. Idempotent — safe to re-run.
- `GAMESHELF_ROOT` — data directory. Defaults to repo root in dev, `/data` in Docker.
- `DEV_NO_AUTH=true` — injects a fake user when the Authentik header is absent.
  **Required for local dev** (no Traefik). Never enable in production.
- `MCP_TOKEN` — bearer token for `POST /mcp` (Streamable HTTP). Empty = MCP disabled.
  This endpoint must be exempted from Authentik forward-auth in Traefik.
- Biome (not ESLint/Prettier), 2-space indent, double quotes, semicolons.
- TypeBox is the single source of types — Eden Treaty generates the web client
  from the server's `App` type. No codegen step.

## Auth model

- **Public read-only**: `GET /api/health`, `GET /api/games`, `GET /api/me` are
  always accessible — the UI is viewable without login.
- **Authenticated write**: `PATCH /api/games/:key` and `POST /api/sync` require
  the `x-authentik-username` header (injected by Traefik/Authentik).
- **Auth check**: `GET /api/auth/check` is protected by Authentik forward-auth in
  Traefik. The front fetches it with `redirect: "manual"` to detect login state.
  The "Login" button navigates to `/api/auth/check`, triggering the Authentik flow.
- When read-only: no drag-and-drop, no status select, no online toggle, no sync button.
- `DEV_NO_AUTH=true` bypasses auth entirely (local dev only).

## Deploy

Single Docker container (`compose.yml`). Elysia serves both `/api/*` and the
built SPA. Traefik + Authentik forward-auth protects the UI; `/mcp` is exempted
(bearer token instead). Data on a named volume, never in the image.
