import { join, resolve } from "node:path";
import {
  type DetectOnlineOptions,
  type DetectOnlineResult,
  type Game,
  type LocalPatch,
  SteamHttpClient,
  SteamStoreClient,
  type SyncOptions,
  type SyncResult,
  YamlStore,
  detectOnline as detectOnlineUseCase,
  listGames as listGamesUseCase,
  setGameLocal as setGameLocalUseCase,
  syncLibrary as syncLibraryUseCase,
} from "@gameshelf/core";

export interface Config {
  root: string;
  port: number;
  devNoAuth: boolean;
  steamApiKey: string;
  steamId: string;
  gamesPath: string;
  snapshotPath: string;
  webDist: string;
}

export function loadConfig(): Config {
  const root = process.env.GAMESHELF_ROOT ?? resolve(import.meta.dir, "../../..");
  return {
    root,
    port: Number(process.env.PORT ?? 3000),
    devNoAuth: process.env.DEV_NO_AUTH === "true",
    steamApiKey: (process.env.STEAM_API_KEY ?? "").trim(),
    steamId: (process.env.STEAM_ID ?? "").trim(),
    gamesPath: join(root, "games.yaml"),
    snapshotPath: join(root, "data/steam-snapshot.json"),
    webDist: join(root, "apps/web/dist"),
  };
}

export interface Container {
  config: Config;
  listGames(): Promise<Game[]>;
  setGameLocal(key: string, patch: LocalPatch): Promise<void>;
  sync(options?: SyncOptions): Promise<SyncResult>;
  detectOnline(options?: DetectOnlineOptions): Promise<DetectOnlineResult>;
}

/** Composition root : le seul endroit qui branche les adapters au domaine. */
export function buildContainer(config: Config = loadConfig()): Container {
  const steam = new SteamHttpClient({ key: config.steamApiKey, steamId: config.steamId });
  const steamStore = new SteamStoreClient();
  const store = new YamlStore(config.gamesPath, config.snapshotPath);

  return {
    config,
    listGames: () => listGamesUseCase(store),
    setGameLocal: (key, patch) => setGameLocalUseCase(store, key, patch),
    sync: (options) => syncLibraryUseCase({ steam, store }, options),
    detectOnline: (options) => detectOnlineUseCase({ store, steamStore }, options),
  };
}
