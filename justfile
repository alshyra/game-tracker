set shell := ["bash", "-cu"]

# Installe les dépendances du monorepo
install:
    bun install

# Serveur Elysia (watch) + Vite en parallèle
dev:
    bun run dev

# Serveur seul (API + SPA buildée)
serve:
    bun run start

# Build du front
build:
    bun run build:web

# Synchronisation Steam (simulation)
sync:
    bun run cli sync

# Synchronisation Steam (écriture réelle)
sync-apply:
    bun run cli sync --apply

# État de la collection par statut
status:
    bun run cli status

# Détecte les jeux en ligne (simulation)
online:
    bun run cli online

# Marque les jeux en ligne détectés (MMO + multijoueur seul)
online-apply:
    bun run cli online --apply

# Lint + format (Biome)
check:
    bunx biome check .

fmt:
    bunx biome check --write .

# Typage (tsc + vue-tsc)
typecheck:
    bun run typecheck

# Tests
test:
    bun test
