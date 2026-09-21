import { timingSafeEqual } from "node:crypto";
import type { CoreServices } from "@gameshelf/core";
import { createGameshelfMcpServer } from "@gameshelf/mcp/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

function tokenMatches(header: string | null, token: string): boolean {
  if (!header) return false;
  const expected = Buffer.from(`Bearer ${token}`);
  const actual = Buffer.from(header);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/**
 * Transport MCP **Streamable HTTP** pour un agent distant (ex. OpenClaw sur le
 * NAS). Même serveur d'outils que le mode stdio. Authentification par jeton
 * bearer : cet endpoint doit être exempté du forward-auth Authentik côté Traefik.
 */
export function createMcpHandler(services: CoreServices, token: string) {
  return async (request: Request): Promise<Response> => {
    if (!token) {
      return Response.json({ error: "MCP désactivé" }, { status: 404 });
    }
    if (!tokenMatches(request.headers.get("authorization"), token)) {
      return Response.json({ error: "Non autorisé" }, { status: 401 });
    }

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    const server = createGameshelfMcpServer(services);
    await server.connect(transport);
    return transport.handleRequest(request);
  };
}
