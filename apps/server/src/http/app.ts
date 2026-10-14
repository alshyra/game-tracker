import { StatusSchema } from "@gameshelf/core";
import { Elysia, t } from "elysia";
import type { Container } from "../container";
import { createMcpHandler } from "./mcp";

const LocalPatchBody = t.Partial(
  t.Object({
    status: StatusSchema,
    rating: t.Union([t.Number(), t.Null()]),
    notes: t.Union([t.String(), t.Null()]),
    title: t.Union([t.String(), t.Null()]),
    online: t.Boolean(),
  }),
);

const AddGameBody = t.Object({
  title: t.String({ minLength: 1 }),
  appid: t.Optional(t.Number()),
  status: t.Optional(StatusSchema),
});

/**
 * Interface HTTP (driving adapter). Ne contient aucune logique métier : elle
 * traduit les requêtes en appels de cas d'usage et mappe les erreurs du domaine.
 *
 * Routes publiques (lecture seule) : /api/health, /api/games, /api/games/search, /api/me
 * Routes protégées (écriture) : POST /api/games, PATCH /api/games/:key, POST /api/sync
 */
export function createApp(container: Container) {
  const mcpHandler = createMcpHandler(container, container.config.mcpToken);

  // Garde d'écriture : exige l'en-tête Authentik (forward-auth Traefik).
  const requireAuth = ({
    request,
    set,
  }: { request: Request; set: { status?: number | string } }) => {
    if (container.config.devNoAuth) return;
    const user = request.headers.get("x-authentik-username");
    if (!user) {
      set.status = 401;
      return { error: "Authentification requise" };
    }
  };

  return new Elysia()
    .onError(({ code, error, set }) => {
      const name = error instanceof Error ? error.name : "";
      const message = error instanceof Error ? error.message : "Erreur inattendue";
      if (name === "SteamPrivacyError") {
        set.status = 422;
        return { error: message, code: name };
      }
      if (name === "SteamAuthError") {
        set.status = 502;
        return { error: message, code: name };
      }
      if (name === "SteamRateLimitError") {
        set.status = 429;
        return { error: message, code: name };
      }
      if (code === "VALIDATION") {
        set.status = 400;
        return { error: "Requête invalide" };
      }
      set.status = 500;
      return { error: message };
    })
    .all("/mcp", ({ request }) => mcpHandler(request))
    .group("/api", (app) =>
      app
        .get("/health", () => ({ ok: true }))
        .get("/games", () => container.listGames())
        .get("/games/search", ({ query }) => container.searchGames(query.q), {
          query: t.Object({ q: t.String({ minLength: 1 }) }),
        })
        .get("/me", ({ request }) => {
          if (container.config.devNoAuth) return { authenticated: true, user: "dev" };
          const user = request.headers.get("x-authentik-username");
          return { authenticated: !!user, user: user ?? null };
        })
        .get("/auth/check", ({ request }) => {
          const user = request.headers.get("x-authentik-username");
          return { authenticated: !!user, user: user ?? null };
        })
        .post("/games", ({ body }) => container.addGame(body), {
          body: AddGameBody,
          beforeHandle: requireAuth,
        })
        .patch(
          "/games/:key",
          async ({ params, body }) => {
            await container.setGameLocal(params.key, body);
            return { ok: true };
          },
          {
            params: t.Object({ key: t.String() }),
            body: LocalPatchBody,
            beforeHandle: requireAuth,
          },
        )
        .post("/sync", ({ body }) => container.sync({ apply: body?.apply ?? false }), {
          body: t.Optional(t.Object({ apply: t.Boolean() })),
          beforeHandle: requireAuth,
        }),
    );
}

export type App = ReturnType<typeof createApp>;
