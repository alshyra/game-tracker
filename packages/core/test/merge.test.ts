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
    online: false,
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

  test("plus d'une heure jouée => au moins en cours, pas backlog", () => {
    const games = buildGames(
      [
        entry({ appid: 3, playtime_forever_min: 61 }),
        entry({ appid: 4, playtime_forever_min: 60 }),
      ],
      new Map(),
      null,
    );
    const byKey = new Map(games.map((game) => [game.key, game.status]));
    expect(byKey.get("3")).toBe("en_cours");
    expect(byKey.get("4")).toBe("backlog");
  });

  test("le statut local reste prioritaire même avec du temps de jeu", () => {
    const [game] = buildGames(
      [entry({ appid: 5, playtime_forever_min: 600 })],
      new Map([["5", local({ key: "5", status: "backlog" })]]),
      null,
    );
    expect(game?.status).toBe("backlog");
  });

  test("le marqueur online vient du local et vaut false par défaut", () => {
    const games = buildGames(
      [entry({ appid: 6 }), entry({ appid: 7 })],
      new Map([["7", local({ key: "7", online: true })]]),
      null,
    );
    const byKey = new Map(games.map((game) => [game.key, game.online]));
    expect(byKey.get("6")).toBe(false);
    expect(byKey.get("7")).toBe(true);
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
