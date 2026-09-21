import {
  type LibraryEntry,
  SteamAuthError,
  type SteamPort,
  SteamPrivacyError,
  SteamRateLimitError,
} from "../../domain/ports";

const API = "https://api.steampowered.com";
const CDN = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps";

/** La convention CDN Steam dérive ces deux images de l'appid, sans appel API. */
export function headerUrl(appid: number): string {
  return `${CDN}/${appid}/header.jpg`;
}

export function coverUrl(appid: number): string {
  return `${CDN}/${appid}/library_600x900.jpg`;
}

type OwnedGame = {
  appid?: number;
  name?: string;
  playtime_forever?: number;
  playtime_2weeks?: number;
  rtime_last_played?: number;
};

type OwnedGamesResponse = {
  response?: { game_count?: number; games?: OwnedGame[]; eresult?: number };
};

type RecentGamesResponse = {
  response?: { games?: OwnedGame[] };
};

/** Signature minimale de fetch : évite de dépendre du type global de Bun dans les tests. */
export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface SteamClientOptions {
  key: string;
  steamId: string;
  paceMs?: number;
  fetchImpl?: FetchLike;
}

export class SteamHttpClient implements SteamPort {
  private readonly key: string;
  private readonly steamId: string;
  private readonly paceMs: number;
  private readonly doFetch: FetchLike;

  constructor(options: SteamClientOptions) {
    this.key = options.key.trim();
    this.steamId = options.steamId.trim();
    this.paceMs = options.paceMs ?? 1500;
    this.doFetch = options.fetchImpl ?? fetch;
  }

  async fetchLibrary(): Promise<LibraryEntry[]> {
    const owned = await this.getOwnedGames();
    if (owned.length === 0) {
      throw new SteamPrivacyError();
    }
    const recent = await this.getRecentlyPlayed();
    const recentByAppid = new Map(recent.map((g) => [g.appid, g]));

    return owned.map((game) => {
      const appid = game.appid as number;
      const r = recentByAppid.get(appid);
      const twoWeeks = r?.playtime_2weeks ?? game.playtime_2weeks ?? null;
      const lastPlayed = r?.rtime_last_played ?? game.rtime_last_played ?? null;
      return {
        appid,
        title: game.name ?? `App ${appid}`,
        header_url: headerUrl(appid),
        cover_url: coverUrl(appid),
        playtime_forever_min: game.playtime_forever ?? 0,
        playtime_2weeks_min: twoWeeks,
        last_played_at: lastPlayed ? new Date(lastPlayed * 1000).toISOString() : null,
      } satisfies LibraryEntry;
    });
  }

  private async getOwnedGames(): Promise<OwnedGame[]> {
    const payload = await this.callJson<OwnedGamesResponse>(
      `${API}/IPlayerService/GetOwnedGames/v1/`,
      {
        key: this.key,
        steamid: this.steamId,
        include_appinfo: 1,
        include_played_free_games: 1,
      },
    );
    const inner = payload.response ?? {};
    this.assertNoRateLimit(inner.eresult);
    return (inner.games ?? []).filter((g): g is OwnedGame & { appid: number } => {
      return typeof g.appid === "number";
    });
  }

  private async getRecentlyPlayed(): Promise<OwnedGame[]> {
    try {
      const payload = await this.callJson<RecentGamesResponse>(
        `${API}/IPlayerService/GetRecentlyPlayedGames/v1/`,
        { key: this.key, steamid: this.steamId, count: 20 },
      );
      return payload.response?.games ?? [];
    } catch (error) {
      if (error instanceof SteamRateLimitError) throw error;
      return [];
    }
  }

  private assertNoRateLimit(eresult: number | undefined): void {
    if (eresult === 25 || eresult === 84) {
      throw new SteamRateLimitError();
    }
  }

  private async callJson<T>(base: string, params: Record<string, string | number>): Promise<T> {
    const url = new URL(base);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }

    let delay = 2000;
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await this.doFetch(url, {
        redirect: "follow",
        headers: { "User-Agent": "gameshelf" },
      });

      if (res.status === 429) {
        await Bun.sleep(delay);
        delay *= 2;
        continue;
      }
      if (res.status === 401 || res.status === 403) {
        throw new SteamAuthError();
      }
      if (!res.ok) {
        throw new Error(`Steam a répondu HTTP ${res.status} sur ${url.pathname}`);
      }
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("json")) {
        throw new Error(
          `Réponse non-JSON de Steam (${contentType || "sans content-type"}) sur ${url.pathname}`,
        );
      }
      return (await res.json()) as T;
    }
    throw new SteamRateLimitError();
  }
}
