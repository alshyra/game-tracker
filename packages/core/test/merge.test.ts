import { describe, expect, test } from "bun:test";
import { buildGames } from "../src/domain/merge";
import type { LibraryEntry, LocalRecord } from "../src/domain/ports";

function entry(over: Partial<LibraryEntry> & { appid: number }): LibraryEntry {
  return {
    title: `Game ${over.appid}`,
    header_url: `header-${over.appid}`,
    cover_url: `cover-${over.appid}`,
    playtime_forever_min: 0,
    playtime_2weeks_min: null,
    last_played_at: null,
    ...over,
  };
}

function local(over: Partial<LocalRecord> & { key: string }): LocalRecord {
  return {
    steam_appid: /^\d+$/.test(over.key) ? Number(over.key) : null,
    title: null,
    cover_url: null,
    header_url: null,
    status: "backlog",
    rating: null,
    notes: null,
    source: "steam",
    created_at: null,
    updated_at: null,
    ...over,
  };
}

describe("buildGames", () => {
  test("les champs locaux priment et l'API ne les écrase jamais", () => {
    const entries = [entry({ appid: 1, title: "Skyrim", playtime_forever_min: 15384 })];
    const store = new Map([
      ["1", local({ key: "1", title: "Skyrim (moddé)", status: "termine", rating: 9 })],
    ]);

    const [game] = buildGames(entries, store, "2026-01-01T00:00:00.000Z");

    expect(game?.title).toBe("Skyrim (moddé)");
    expect(game?.status).toBe("termine");
    expect(game?.rating).toBe(9);
    expect(game?.playtime_forever_min).toBe(15384);
    expect(game?.source).toBe("steam");
  });

  test("statut par défaut backlog sans donnée locale", () => {
    const [game] = buildGames([entry({ appid: 2 })], new Map(), null);
    expect(game?.status).toBe("backlog");
    expect(game?.cover_url).toBe("cover-2");
  });

  test("inclut les jeux manuels et wishlist absents de Steam", () => {
    const store = new Map([
      [
        "manual:siyuan",
        local({ key: "manual:siyuan", title: "Un jeu indé", status: "wishlist", source: "manual" }),
      ],
    ]);
    const games = buildGames([entry({ appid: 1 })], store, null);
    const manual = games.find((g) => g.key === "manual:siyuan");
    expect(manual?.status).toBe("wishlist");
    expect(manual?.source).toBe("manual");
    expect(manual?.steam_appid).toBeNull();
  });

  test("trie par temps de jeu décroissant", () => {
    const games = buildGames(
      [
        entry({ appid: 1, playtime_forever_min: 10 }),
        entry({ appid: 2, playtime_forever_min: 100 }),
      ],
      new Map(),
      null,
    );
    expect(games.map((g) => g.key)).toEqual(["2", "1"]);
  });
});
