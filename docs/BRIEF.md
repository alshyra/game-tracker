# Gameshelf — brief v2

Tracker de jeux vidéo self-hosté, mono-utilisateur. Importe la bibliothèque
Steam, la présente en grille de jaquettes, et laisse saisir un statut local.

Ce document remplace le brief v1 (Python/FastAPI). La stack est désormais
**full TypeScript sur Bun**.

## Objectif produit

1. Importer automatiquement la bibliothèque Steam (jeux possédés, temps de jeu,
   dernière session).
2. Afficher une grille de cartes avec jaquettes, filtrable par statut.
   Vue principale : **kanban drag & drop** (une colonne par statut) ; la grille
   reste disponible en bascule. Les **jeux en ligne / sans fin** (champ local
   `online`) sont exclus du kanban, qui ne sert qu'aux jeux solo qui se finissent.
3. Laisser définir un statut par jeu : `backlog`, `en cours`, `en pause`,
   `terminé`, `abandonné`, `wishlist`.
4. Se déployer en Docker derrière Traefik avec Authentik (forward-auth).

## Non-objectifs (v1)

- Pas de launcher, pas de gestion ni de téléchargement de fichiers de jeu.
- Pas de multi-utilisateur, pas d'inscription publique.
- Pas d'import GOG ni Epic (aucune API publique officielle).
- Pas de fonctionnalités sociales (amis, partage, notes publiques).

## Stack

| Rôle | Choix |
|---|---|
| Runtime / gestionnaire de paquets | Bun |
| API HTTP | Elysia |
| Schémas / validation | TypeBox (`t.*`, `Static<>`) — source unique des types |
| Client HTTP sortant | `fetch` natif (Bun), `redirect: "follow"` explicite |
| Persistance | `games.yaml` (source de vérité locale) + `data/steam-snapshot.json` (cache jetable) |
| Frontend | React + Vite + Tailwind CSS v4 + TanStack Query |
| Types front | Eden Treaty (aucun codegen) |
| CLI | `commander` + `picocolors` / `ora` |
| Tests | `bun test` |
| Lint / format | Biome |
| Typage | `tsc --noEmit` |
| Monorepo | Bun workspaces |
| Déploiement | Dockerfile multi-stage, image épinglée, labels Traefik |

**Pas de base de données en v1.** Pour 80–200 jeux (~200 Ko), SQLite est de la
cérémonie inutile. On persiste dans un fichier YAML lisible et versionné. Une
base ne reviendra que si l'on veut un historique de playtime ou du multi-source,
derrière un port, sans toucher au domaine.

## Architecture hexagonale

```
packages/core/            # le cœur — ne connaît ni Elysia, ni le FS, ni Bun.serve
  src/domain/             # modèles TypeBox, ports (interfaces), règles de merge/matching
  src/applications/       # cas d'usage : syncLibrary, setStatus, listGames
  src/adapters/
    steam/                # GetOwnedGames, appdetails, recently played
    store/                # games.yaml + snapshot

apps/server/              # interface (driving adapters)
  src/http/               # routes Elysia
  src/cli/                # commandes commander
  src/container.ts        # composition root : branche les adapters
  src/index.ts

apps/web/                 # React + Vite ; n'importe du serveur que le type App
```

Le domaine ne dépend que de TypeBox. `adapters/` implémente les ports du
domaine. `apps/server` est le seul endroit qui assemble le tout.

## Modèle de données

```
Game
  steam_appid          number, unique (null si jeu purement manuel)
  title                string
  cover_url            string | null   # jaquette verticale 600x900
  header_url           string | null   # bannière horizontale
  release_date         string | null
  genres               string[]
  playtime_forever_min number          # API
  playtime_2weeks_min  number | null   # API
  last_played_at       string | null   # API
  status               Status          # LOCAL
  rating               number | null   # LOCAL
  notes                string | null   # LOCAL
  online               boolean         # LOCAL — jeu en ligne, exclu du kanban
  source               "steam" | "manual"
  created_at, updated_at
```

`Status` = `backlog | en_cours | en_pause | termine | abandonne | wishlist`.

**Règle cardinale — `source_of_truth` par champ.** Un champ est soit `api`,
soit `local`. Un champ local n'est **jamais** réécrit par une valeur venue de
l'API. Steam ne connaît pas « en pause » et `playtime_forever` est cumulatif :
le statut, la note et les notes sont des données locales.

**Statut par défaut.** Un jeu Steam sans statut local et déjà joué **plus d'une
heure** est au moins « en cours », jamais « backlog ». Le statut local reste
prioritaire dans tous les cas.

## Sources de données et pièges vérifiés

1. `IPlayerService/GetOwnedGames` (clé Web API gratuite). Paramètres : `key`,
   `steamid`, `include_appinfo=1`, `include_played_free_games=1`.
   **Si les « Détails du jeu » du profil ne sont pas publics, l'API renvoie un
   objet `games` VIDE sans erreur.** Ce cas doit produire un message explicite,
   pas un écran vide.
2. `IPlayerService/GetRecentlyPlayedGames` pour `playtime_2weeks`.
3. Repli sans clé : `store.steampowered.com/api/appdetails?appids=<id>` renvoie
   `header_image`, nom, date de sortie, genres. Public, aucune clé.
4. Enrichissement (plus tard) : IGDB (OAuth2 client_credentials, 4 req/s) pour
   les métadonnées ; SteamGridDB pour les jaquettes verticales 600x900.
5. `fetch` suit les redirections par défaut, mais on l'écrit explicitement
   (`redirect: "follow"`) : sinon on reçoit du HTML qui ressemble à une panne.
6. Rate limit : HTTP 429 ou `x-eresult` 25/84. On pace les requêtes et on gère
   un backoff exponentiel. Jamais de boucle serrée.

## Matching — piège des homonymes

Cas rencontrés : « Maltavern » → Malaventurado, « Kendirvi » → Kendrick Lamar.
Règle : score sur le **nom entier** (pas `partial_ratio` seul), seuil élevé, et
**jamais de correspondance automatique non affichée**. Mieux vaut une jaquette
manquante qu'une jaquette fausse.

## Conventions de travail

- CLI en plus de l'API : `gameshelf sync`, `gameshelf status`. Sortie colorée.
- **Simulation par défaut** pour toute commande qui écrit ; `--apply` pour
  exécuter. Idempotence obligatoire : un second passage ne crée aucun doublon.
- `games.yaml` = source de vérité rejouable (jeux manuels, overrides de titre ou
  de jaquette, et champs locaux écrits par l'UI via l'API `Document` du paquet
  `yaml`, commentaires préservés).
- Écritures **atomiques** (fichier temporaire + `rename`) et sérialisées : un
  seul process Bun écrit.
- Secrets dans `.env`, jamais commité. Le repo est **public**.
- En dev hors Traefik, l'en-tête d'auth est absent : `DEV_NO_AUTH=true` injecte
  un utilisateur fictif. Interdit en production.

## Déploiement

- **Un seul conteneur** : Elysia sert `/api/*` et le build statique de Vite.
- Auth : **forward-auth Authentik via Traefik**. L'app fait confiance à
  `X-authentik-username`, injecté exclusivement par Traefik (jamais par le
  client).
- `games.yaml` et `data/` sur un **volume nommé**, jamais dans l'image.
- Image épinglée (jamais `:latest`), labels Traefik, pas de CI/CD : sync par git.
- `docker compose up` doit suffire (critère M1).

## Direction visuelle

Thème sombre, cartes arrondies, jaquette verticale en grand, badges de statut
colorés (backlog gris, en cours vert, en pause orange, terminé bleu, abandonné
rouge, wishlist violet), survol discret qui soulève la carte, typographie sobre.
La jaquette est l'élément principal : la grille doit être agréable à parcourir,
pas dense.

## Jalons

### M0 — spike Steam (validé)

Script jetable : appel `GetOwnedGames`, diagnostic de privacy si `games` est
vide, enrichissement `appdetails` des 5 premiers jeux, verdict go/no-go.
Premier passage en Python (v1), revalidé en Bun (M0') après le pivot.

Résultats réels obtenus (voir README) : **88 jeux**, 5/5 `header_image`.

### M1 — MVP

- [ ] `gameshelf sync` remplit la base depuis Steam, sans doublon au 2e passage.
- [ ] La page affiche une grille de cartes (jaquette, titre, temps de jeu, statut).
- [ ] Le statut est modifiable depuis l'interface et persiste.
- [ ] Les filtres par statut fonctionnent.
- [ ] Un profil Steam privé produit un message d'erreur explicite.
- [ ] `biome check`, `tsc --noEmit` et `bun test` passent.
- [ ] L'app tourne via `docker compose up` derrière Traefik + Authentik.
