import { join } from "node:path";
import { SteamHttpClient } from "./adapters/steam/client";
import { SteamStoreClient } from "./adapters/steam/storeClient";
import { YamlStore } from "./adapters/store/yamlStore";
import {
  type DetectOnlineOptions,
  type DetectOnlineResult,
  detectOnline,
} from "./applications/detectOnline";
import { listGames } from "./applications/listGames";
import { setGameLocal } from "./applications/setGameLocal";
import { type SyncOptions, type SyncResult, syncLibrary } from "./applications/syncLibrary";
import type { Game } from "./domain/game";
import type { LocalPatch } from "./domain/ports";

/** Configuration minimale pour brancher les adapters au domaine. */
export interface CoreConfig {
  root: string;
  steamApiKey: string;
  steamId: string;
}

/** Les cas d'usage exposés à tout adapter « driving » (CLI, HTTP, MCP…). */
export interface CoreServices {
  listGames(): Promise<Game[]>;
  setGameLocal(key: string, patch: LocalPatch): Promise<void>;
  sync(options?: SyncOptions): Promise<SyncResult>;
  detectOnline(options?: DetectOnlineOptions): Promise<DetectOnlineResult>;
}

/**
 * Composition root partagé : branche les adapters (Steam, store YAML) sur les
 * cas d'usage. Ne connaît ni HTTP ni CLI — chaque interface l'enveloppe.
 */
export function createCoreServices(config: CoreConfig): CoreServices {
  const steam = new SteamHttpClient({ key: config.steamApiKey, steamId: config.steamId });
  const steamStore = new SteamStoreClient();
  const store = new YamlStore(
    join(config.root, "games.yaml"),
    join(config.root, "data/steam-snapshot.json"),
  );

  return {
    listGames: () => listGames(store),
    setGameLocal: (key, patch) => setGameLocal(store, key, patch),
    sync: (options) => syncLibrary({ steam, store }, options),
    detectOnline: (options) => detectOnline({ store, steamStore }, options),
  };
}
