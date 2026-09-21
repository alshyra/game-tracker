import { join, resolve } from "node:path";
import { type CoreServices, createCoreServices } from "@gameshelf/core";

export interface Config {
  root: string;
  port: number;
  devNoAuth: boolean;
  steamApiKey: string;
  steamId: string;
  /** Jeton bearer protégeant `POST /mcp`. Vide ⇒ MCP désactivé. */
  mcpToken: string;
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
    mcpToken: (process.env.MCP_TOKEN ?? "").trim(),
    gamesPath: join(root, "games.yaml"),
    snapshotPath: join(root, "data/steam-snapshot.json"),
    webDist: join(root, "apps/web/dist"),
  };
}

export type Container = CoreServices & { config: Config };

/** Composition root de l'interface HTTP/CLI : config + services du domaine. */
export function buildContainer(config: Config = loadConfig()): Container {
  return {
    config,
    ...createCoreServices({
      root: config.root,
      steamApiKey: config.steamApiKey,
      steamId: config.steamId,
    }),
  };
}
