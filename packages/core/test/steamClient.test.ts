import { describe, expect, test } from "bun:test";
import { type FetchLike, SteamHttpClient } from "../src/adapters/steam/client";
import { SteamAuthError, SteamPrivacyError } from "../src/domain/ports";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const owned = {
  response: {
    game_count: 1,
    games: [{ appid: 72850, name: "Skyrim", playtime_forever: 15384 }],
  },
};
const recent = {
  response: {
    games: [
      { appid: 72850, name: "Skyrim", playtime_2weeks: 120, rtime_last_played: 1_700_000_000 },
    ],
  },
};

describe("SteamHttpClient", () => {
  test("fusionne owned + recently played et dérive les jaquettes", async () => {
    const fetchImpl: FetchLike = async (input) => {
      const url = String(input);
      if (url.includes("GetOwnedGames")) return jsonResponse(owned);
      return jsonResponse(recent);
    };
    const client = new SteamHttpClient({ key: "k", steamId: "1", fetchImpl });

    const [game] = await client.fetchLibrary();
    expect(game?.appid).toBe(72850);
    expect(game?.playtime_forever_min).toBe(15384);
    expect(game?.playtime_2weeks_min).toBe(120);
    expect(game?.cover_url).toContain("/72850/library_600x900.jpg");
    expect(game?.last_played_at).toBe(new Date(1_700_000_000 * 1000).toISOString());
  });

  test("bibliothèque vide => SteamPrivacyError explicite", async () => {
    const fetchImpl: FetchLike = async () => jsonResponse({ response: { games: [] } });
    const client = new SteamHttpClient({ key: "k", steamId: "1", fetchImpl });

    expect(client.fetchLibrary()).rejects.toBeInstanceOf(SteamPrivacyError);
  });

  test("403 => SteamAuthError", async () => {
    const fetchImpl: FetchLike = async () => new Response("nope", { status: 403 });
    const client = new SteamHttpClient({ key: "k", steamId: "1", fetchImpl });

    expect(client.fetchLibrary()).rejects.toBeInstanceOf(SteamAuthError);
  });
});
