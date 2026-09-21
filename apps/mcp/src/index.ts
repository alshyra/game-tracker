#!/usr/bin/env bun
/**
 * Adapter MCP (stdio) de Gameshelf.
 *
 * Ce n'est qu'une interface « driving » de plus : il appelle les mêmes cas
 * d'usage que la CLI et l'API HTTP, via `@gameshelf/core`. Aucune API dédiée.
 *
 * Lancement par OpenClaw (ou tout client MCP) :
 *   bun apps/mcp/src/index.ts
 * Le répertoire de travail doit être la racine du repo (GAMESHELF_ROOT sinon),
 * pour que Bun charge `.env` et que le store trouve `games.yaml`.
 */
import { type Game, STATUSES, type Status, createCoreServices } from "@gameshelf/core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const root = process.env.GAMESHELF_ROOT ?? process.cwd();

const StatusEnum = z.enum([...STATUSES] as [Status, ...Status[]]);

const services = createCoreServices({
  root,
  steamApiKey: (process.env.STEAM_API_KEY ?? "").trim(),
  steamId: (process.env.STEAM_ID ?? "").trim(),
});

const server = new McpServer(
  { name: "gameshelf", version: "0.1.0" },
  {
    instructions:
      "Gameshelf : bibliothèque de jeux Steam + champs locaux (statut, note, en ligne). " +
      "Utilise list_games/get_stats pour lire, et set_status/set_online pour modifier. " +
      `Statuts possibles : ${STATUSES.join(", ")}.`,
  },
);

function text(value: string, isError = false) {
  return { content: [{ type: "text" as const, text: value }], isError };
}

function json(value: unknown, isError = false) {
  return text(JSON.stringify(value, null, 2), isError);
}

function slim(game: Game) {
  return {
    appid: game.steam_appid,
    title: game.title,
    status: game.status,
    online: game.online,
    playtime_hours: Number((game.playtime_forever_min / 60).toFixed(1)),
    last_played: game.last_played_at,
  };
}

type Resolution = { key: string; title: string } | { ambiguous: Game[] } | { missing: string };

/** Résout un jeu par appid ou titre, sans jamais deviner en cas d'ambiguïté. */
function resolveGame(games: Game[], query: string): Resolution {
  const trimmed = query.trim();
  const needle = trimmed.toLowerCase();

  const byKey = games.find((game) => game.key === trimmed);
  if (byKey) return { key: byKey.key, title: byKey.title };

  const exact = games.filter((game) => game.title.toLowerCase() === needle);
  if (exact.length === 1 && exact[0]) return { key: exact[0].key, title: exact[0].title };

  const partial = games.filter((game) => game.title.toLowerCase().includes(needle));
  if (partial.length === 1 && partial[0]) {
    return { key: partial[0].key, title: partial[0].title };
  }
  if (partial.length > 1) return { ambiguous: partial.slice(0, 10) };
  return { missing: trimmed };
}

function resolutionError(resolution: Resolution) {
  if ("ambiguous" in resolution) {
    return json(
      {
        error: "Plusieurs jeux correspondent, précise le titre exact.",
        matches: resolution.ambiguous.map((game) => game.title),
      },
      true,
    );
  }
  if ("missing" in resolution) {
    return json({ error: `Aucun jeu trouvé pour « ${resolution.missing} ».` }, true);
  }
  return null;
}

server.registerTool(
  "list_games",
  {
    title: "Lister les jeux",
    description:
      "Liste les jeux de la collection. Filtres optionnels : statut, jeu en ligne, recherche " +
      "sur le titre, limite (tri par temps de jeu décroissant).",
    inputSchema: {
      status: StatusEnum.optional(),
      online: z.boolean().optional(),
      search: z.string().optional(),
      limit: z.number().int().min(1).max(300).optional(),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async ({ status, online, search, limit }) => {
    const games = await services.listGames();
    const needle = search?.trim().toLowerCase();
    const filtered = games.filter(
      (game) =>
        (status === undefined || game.status === status) &&
        (online === undefined || game.online === online) &&
        (needle === undefined || game.title.toLowerCase().includes(needle)),
    );
    const limited = limit ? filtered.slice(0, limit) : filtered;
    return json({ count: filtered.length, games: limited.map(slim) });
  },
);

server.registerTool(
  "get_stats",
  {
    title: "Statistiques de la collection",
    description: "Répartition par statut, nombre de jeux en ligne, temps de jeu total, top 5.",
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async () => {
    const games = await services.listGames();
    const counts = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<
      Status,
      number
    >;
    for (const game of games) counts[game.status] += 1;
    const top = [...games]
      .sort((a, b) => b.playtime_forever_min - a.playtime_forever_min)
      .slice(0, 5)
      .map((game) => ({
        title: game.title,
        hours: Number((game.playtime_forever_min / 60).toFixed(1)),
      }));
    return json({
      total: games.length,
      online: games.filter((game) => game.online).length,
      total_hours: Number(
        (games.reduce((sum, g) => sum + g.playtime_forever_min, 0) / 60).toFixed(1),
      ),
      by_status: counts,
      top_by_playtime: top,
    });
  },
);

server.registerTool(
  "set_status",
  {
    title: "Changer le statut d'un jeu",
    description:
      `Définit le statut local d'un jeu (identifié par appid ou titre). ` +
      `Statuts : ${STATUSES.join(", ")}.`,
    inputSchema: {
      game: z.string().describe("appid Steam ou titre du jeu"),
      status: StatusEnum,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  async ({ game, status }) => {
    const games = await services.listGames();
    const resolution = resolveGame(games, game);
    const error = resolutionError(resolution);
    if (error) return error;
    if (!("key" in resolution)) return text("Résolution impossible.", true);

    await services.setGameLocal(resolution.key, { status });
    return json({ ok: true, title: resolution.title, status });
  },
);

server.registerTool(
  "set_online",
  {
    title: "Marquer un jeu en ligne / hors ligne",
    description:
      "Un jeu « en ligne » (sans fin) est exclu du kanban. Identifié par appid ou titre.",
    inputSchema: {
      game: z.string().describe("appid Steam ou titre du jeu"),
      online: z.boolean(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  async ({ game, online }) => {
    const games = await services.listGames();
    const resolution = resolveGame(games, game);
    const error = resolutionError(resolution);
    if (error) return error;
    if (!("key" in resolution)) return text("Résolution impossible.", true);

    await services.setGameLocal(resolution.key, { online });
    return json({ ok: true, title: resolution.title, online });
  },
);

server.registerTool(
  "sync",
  {
    title: "Synchroniser la bibliothèque Steam",
    description:
      "Récupère la bibliothèque Steam. Simulation par défaut ; `apply: true` écrit le snapshot. " +
      "N'écrase jamais les champs locaux.",
    inputSchema: { apply: z.boolean().optional() },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  async ({ apply }) => {
    try {
      const result = await services.sync({ apply: apply ?? false });
      return json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return text(message, true);
    }
  },
);

server.registerTool(
  "detect_online",
  {
    title: "Détecter les jeux en ligne",
    description:
      "Analyse les métadonnées Steam (appdetails) pour repérer les jeux en ligne. " +
      "Simulation par défaut ; `apply: true` les marque. LENT (~1 s par jeu).",
    inputSchema: { apply: z.boolean().optional(), include_mixed: z.boolean().optional() },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  async ({ apply, include_mixed }) => {
    const result = await services.detectOnline({
      apply: apply ?? false,
      includeMixed: include_mixed ?? false,
    });
    return json({
      applied: result.applied,
      scanned: result.scanned,
      marked: result.marked,
      failed: result.failed,
      candidates: result.candidates.map((candidate) => ({
        title: candidate.title,
        tier: candidate.tier,
        reasons: candidate.reasons,
        already_online: candidate.alreadyOnline,
      })),
    });
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[gameshelf-mcp] prêt (root=${root})`);
