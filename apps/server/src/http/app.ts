import { StatusSchema } from "@gameshelf/core";
import { Elysia, t } from "elysia";
import type { Container } from "../container";

const LocalPatchBody = t.Partial(
  t.Object({
    status: StatusSchema,
    rating: t.Union([t.Number(), t.Null()]),
    notes: t.Union([t.String(), t.Null()]),
    title: t.Union([t.String(), t.Null()]),
    online: t.Boolean(),
  }),
);

/**
 * Interface HTTP (driving adapter). Ne contient aucune logique métier : elle
 * traduit les requêtes en appels de cas d'usage et mappe les erreurs du domaine.
 */
export function createApp(container: Container) {
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
    .group("/api", (app) =>
      app
        .onBeforeHandle(({ request, set }) => {
          if (container.config.devNoAuth) return;
          const user = request.headers.get("x-authentik-username");
          if (!user) {
            set.status = 401;
            return { error: "Authentification requise" };
          }
        })
        .get("/health", () => ({ ok: true }))
        .get("/games", () => container.listGames())
        .patch(
          "/games/:key",
          async ({ params, body }) => {
            await container.setGameLocal(params.key, body);
            return { ok: true };
          },
          { params: t.Object({ key: t.String() }), body: LocalPatchBody },
        )
        .post("/sync", ({ body }) => container.sync({ apply: body?.apply ?? false }), {
          body: t.Optional(t.Object({ apply: t.Boolean() })),
        }),
    );
}

export type App = ReturnType<typeof createApp>;
