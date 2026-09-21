# Gameshelf

Tracker de jeux vidéo self-hosté. Importe une bibliothèque Steam, l'affiche en
grille de jaquettes et laisse saisir un statut local (backlog, en cours, en
pause, terminé, abandonné, wishlist).

- Stack : Bun + Elysia + TypeBox + React/Vite/Tailwind, 1 conteneur Docker
  derrière Traefik + Authentik (forward-auth).
- Pas de base de données : `games.yaml` est la source de vérité locale.
- Le brief complet et les décisions d'architecture sont dans
  [`docs/BRIEF.md`](docs/BRIEF.md).

## État

- **M0 — validé.** Chaîne Steam prouvée deux fois (Python puis Bun) :
  `GetOwnedGames` → **88 jeux**, 108 323 min cumulées ; `appdetails` → **5/5**
  `header_image` ; `GetRecentlyPlayedGames` → 1 jeu sur 2 semaines (*Solasta:
  Crown of the Magister*, 9,7 h). Profil confirmé public.
- **M1 — à venir** : sync idempotent, API, grille React, Docker/Traefik.

## M0' — revalidation sur Bun

```bash
cp .env.example .env   # renseigner STEAM_API_KEY (jamais commité)
bun run spikes/m0_steam_spike.ts
```

Si `games` revient vide sans erreur HTTP, c'est la confidentialité du profil :
« Détails du jeu » doit être **Public** (Profil > Modifier > Paramètres de
confidentialité).
