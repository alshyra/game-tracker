import { treaty } from "@elysiajs/eden";
import type { App } from "@gameshelf/server/http";

/**
 * Client typé de bout en bout (Eden Treaty). En dev, Vite proxifie /api vers le
 * serveur Elysia ; en prod, tout est servi par le même conteneur.
 */
export const api = treaty<App>(window.location.origin);
