#!/usr/bin/env bun
/**
 * Entrée MCP **stdio** de Gameshelf (agent local, même machine).
 *
 * Ce n'est qu'une interface « driving » de plus : les outils viennent de
 * `createGameshelfMcpServer` et appellent les cas d'usage de `@gameshelf/core`.
 *
 * Pour un agent distant (OpenClaw sur une autre machine), utilisez le transport
 * Streamable HTTP exposé par l'app sur `POST /mcp`.
 *
 * Le répertoire de travail doit être la racine du repo (GAMESHELF_ROOT sinon),
 * pour que Bun charge `.env` et que le store trouve `games.yaml`.
 */
import { createCoreServices } from "@gameshelf/core";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createGameshelfMcpServer } from "./server";

const root = process.env.GAMESHELF_ROOT ?? process.cwd();
const services = createCoreServices({
  root,
  steamApiKey: (process.env.STEAM_API_KEY ?? "").trim(),
  steamId: (process.env.STEAM_ID ?? "").trim(),
});

const server = createGameshelfMcpServer(services);
await server.connect(new StdioServerTransport());
console.error(`[gameshelf-mcp] prêt (stdio, root=${root})`);
