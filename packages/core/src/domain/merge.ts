import type { Game } from "./game";
import type { LibraryEntry, LocalRecord } from "./ports";
import { defaultStatusFor } from "./status";

/**
 * Fusion API + local. Règle cardinale : un champ local n'est jamais écrasé par
 * une valeur venue de l'API. Les jaquettes/titres locaux priment (overrides).
 */
export function buildGames(
  entries: LibraryEntry[],
  local: Map<string, LocalRecord>,
  snapshotAt: string | null,
): Game[] {
  const seen = new Set<string>();
  const games: Game[] = [];

  for (const entry of entries) {
    const key = String(entry.appid);
    seen.add(key);
    const rec = local.get(key) ?? null;
    games.push(mergeOne(entry, rec, key, snapshotAt));
  }

  for (const rec of local.values()) {
    if (seen.has(rec.key)) continue;
    games.push(manualGame(rec, snapshotAt));
  }

  return games.sort(byPlaytimeDescThenTitle);
}

function mergeOne(
  entry: LibraryEntry,
  rec: LocalRecord | null,
  key: string,
  snapshotAt: string | null,
): Game {
  return {
    key,
    steam_appid: entry.appid,
    title: rec?.title ?? entry.title,
    cover_url: rec?.cover_url ?? entry.cover_url,
    header_url: rec?.header_url ?? entry.header_url,
    release_date: null,
    genres: [],
    playtime_forever_min: entry.playtime_forever_min,
    playtime_2weeks_min: entry.playtime_2weeks_min,
    last_played_at: entry.last_played_at,
    status: rec?.status ?? defaultStatusFor(entry.playtime_forever_min),
    rating: rec?.rating ?? null,
    notes: rec?.notes ?? null,
    source: "steam",
    created_at: rec?.created_at ?? snapshotAt,
    updated_at: rec?.updated_at ?? snapshotAt,
  };
}

function manualGame(rec: LocalRecord, snapshotAt: string | null): Game {
  return {
    key: rec.key,
    steam_appid: rec.steam_appid,
    title: rec.title ?? `Jeu #${rec.steam_appid ?? rec.key}`,
    cover_url: rec.cover_url,
    header_url: rec.header_url,
    release_date: null,
    genres: [],
    playtime_forever_min: 0,
    playtime_2weeks_min: null,
    last_played_at: null,
    status: rec.status,
    rating: rec.rating,
    notes: rec.notes,
    source: rec.source,
    created_at: rec.created_at ?? snapshotAt,
    updated_at: rec.updated_at ?? snapshotAt,
  };
}

function byPlaytimeDescThenTitle(a: Game, b: Game): number {
  if (b.playtime_forever_min !== a.playtime_forever_min) {
    return b.playtime_forever_min - a.playtime_forever_min;
  }
  return a.title.localeCompare(b.title);
}
