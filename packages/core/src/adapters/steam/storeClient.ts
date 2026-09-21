import {
  type AppDetails,
  SteamAuthError,
  SteamRateLimitError,
  type SteamStorePort,
} from "../../domain/ports";
import type { FetchLike } from "./client";

const STORE = "https://store.steampowered.com";

type RawNode = {
  success?: boolean;
  data?: {
    genres?: { description?: string }[];
    categories?: { description?: string }[];
    release_date?: { date?: string };
  };
};

export interface SteamStoreClientOptions {
  paceMs?: number;
  fetchImpl?: FetchLike;
}

/**
 * Client du magasin Steam (`appdetails`) : public, sans clé. Un appel par jeu,
 * l'API ne supportant pas le multi-appid. Requêtes espacées.
 */
export class SteamStoreClient implements SteamStorePort {
  private readonly paceMs: number;
  private readonly doFetch: FetchLike;

  constructor(options: SteamStoreClientOptions = {}) {
    this.paceMs = options.paceMs ?? 1000;
    this.doFetch = options.fetchImpl ?? fetch;
  }

  async fetchAppDetails(appid: number): Promise<AppDetails> {
    const url = new URL(`${STORE}/api/appdetails`);
    url.searchParams.set("appids", String(appid));
    url.searchParams.set("filters", "basic,genres,categories,release_date");

    const empty: AppDetails = { genres: [], categories: [], release_date: null };
    let delay = 2000;
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await this.doFetch(url, {
        redirect: "follow",
        headers: { "User-Agent": "gameshelf" },
      });
      await Bun.sleep(this.paceMs);

      if (res.status === 429) {
        await Bun.sleep(delay);
        delay *= 2;
        continue;
      }
      if (res.status === 401 || res.status === 403) throw new SteamAuthError();
      if (!res.ok) return empty;

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("json")) return empty;

      const payload = (await res.json()) as Record<string, RawNode>;
      const node = payload[String(appid)];
      if (!node?.success || !node.data) return empty;
      return {
        genres: (node.data.genres ?? [])
          .map((g) => g.description)
          .filter((g): g is string => typeof g === "string"),
        categories: (node.data.categories ?? [])
          .map((c) => c.description)
          .filter((c): c is string => typeof c === "string"),
        release_date: node.data.release_date?.date ?? null,
      };
    }
    throw new SteamRateLimitError();
  }
}
