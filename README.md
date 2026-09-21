# Gameshelf

Tracker de jeux vidéo self-hosté. Importe une bibliothèque Steam, l'affiche en
grille de jaquettes et laisse saisir un statut local (backlog, en cours, en
pause, terminé, abandonné, wishlist).

- Stack : Bun + Elysia + TypeBox + Eden Treaty, front Vue 3 + Vite + Tailwind v4
  + TanStack Query, 1 conteneur Docker derrière Traefik + Authentik
  (forward-auth).
- Pas de base de données : `games.yaml` est la source de vérité locale, le
  snapshot Steam est un cache jetable.
- Le brief complet et les décisions d'architecture sont dans
  [`docs/BRIEF.md`](docs/BRIEF.md).

## État

- **M0 — validé.** Chaîne Steam prouvée : `GetOwnedGames` → **88 jeux**,
  108 323 min cumulées ; `appdetails` → **5/5** `header_image` ;
  `GetRecentlyPlayedGames` → 1 jeu sur 2 semaines. Profil confirmé public.
- **M1 — en cours.** Sync idempotent, CLI, API, grille/filtres/statut et tests
  sont en place. Reste le déploiement Docker/Traefik/Authentik.

## Démarrage

```bash
cp .env.example .env     # renseigner STEAM_API_KEY (jamais commité)
bun install
bun run cli sync --apply # importe la bibliothèque Steam
bun run dev              # API sur :3000, front Vite sur :5173 (proxy /api)
```

Pour servir la SPA buildée par le serveur (une seule URL) :

```bash
bun run build:web && bun run start   # http://localhost:3000
```

Un `justfile` expose les mêmes commandes : `just dev`, `just sync-apply`,
`just check`, `just typecheck`, `just test`.

## Architecture

```
packages/core/     cœur hexagonal : domain / applications / adapters
apps/server/       Elysia (API + static) + CLI + composition root
apps/web/          Vue 3 + Vite ; n'importe du serveur que le type App (Eden)
```

Le domaine ne dépend que de TypeBox ; `adapters/` implémente les ports
(Steam, store YAML). Un champ local (statut, note, notes) n'est jamais écrasé
par une valeur venue de l'API.

## Données

- `games.yaml` — source de vérité locale, écrite par l'UI (commentaires
  préservés), versionnée.
- `data/steam-snapshot.json` — cache jetable de la bibliothèque Steam,
  gitignoré.

## Qualité

```bash
bun run check      # Biome (lint + format)
bun run typecheck  # tsc + vue-tsc
bun test           # bun test
```

## M0' — revalidation du spike sur Bun

```bash
bun run spikes/m0_steam_spike.ts
```

Si `games` revient vide sans erreur HTTP, c'est la confidentialité du profil :
« Détails du jeu » doit être **Public** (Profil > Modifier > Paramètres de
confidentialité).
