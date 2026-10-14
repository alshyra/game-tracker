import { BookKindSchema, BookStatusSchema, StatusSchema } from "@gameshelf/core";
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

const BookPatchBody = t.Partial(
  t.Object({
    title: t.String(),
    authors: t.Array(t.String()),
    kind: BookKindSchema,
    status: BookStatusSchema,
    rating: t.Union([t.Number(), t.Null()]),
    notes: t.Union([t.String(), t.Null()]),
    isbn: t.Union([t.String(), t.Null()]),
    year: t.Union([t.Number(), t.Null()]),
    cover_url: t.Union([t.String(), t.Null()]),
  }),
);

const AddBookBody = t.Object({
  title: t.String({ minLength: 1 }),
  kind: t.Optional(BookKindSchema),
  status: t.Optional(BookStatusSchema),
  authors: t.Optional(t.Array(t.String())),
  cover_url: t.Optional(t.Union([t.String(), t.Null()])),
  year: t.Optional(t.Union([t.Number(), t.Null()])),
  olKey: t.Optional(t.Union([t.String(), t.Null()])),
});

/**
 * Interface HTTP (driving adapter). Aucune logique métier : elle traduit les
 * requêtes en appels de cas d'usage et mappe les erreurs du domaine.
 *
 * Routes publiques (lecture seule) : /api/health, /api/games, /api/games/search,
 *   /api/books, /api/books/search, /api/me
 * Routes protégées (écriture) : POST /api/games, PATCH /api/games/:key, POST /api/sync,
 *   POST /api/books, PATCH /api/books/:key
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

  const me = ({ request }: { request: Request }) => {
    if (container.config.devNoAuth) return { authenticated: true, user: "dev" };
    const user = request.headers.get("x-authentik-username");
    return { authenticated: !!user, user: user ?? null };
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
        .get("/me", me)
        .get("/auth/check", me)
        // ── Jeux ──────────────────────────────────────────────
        .get("/games", () => container.listGames())
        .get("/games/search", ({ query }) => container.searchGames(query.q), {
          query: t.Object({ q: t.String({ minLength: 1 }) }),
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
        })
        // ── Livres / BD ───────────────────────────────────────
        .get("/books", () => container.listBooks())
        .get("/books/search", ({ query }) => container.searchBooks(query.q), {
          query: t.Object({ q: t.String({ minLength: 1 }) }),
        })
        .post("/books", ({ body }) => container.addBook(body), {
          body: AddBookBody,
          beforeHandle: requireAuth,
        })
        .patch(
          "/books/:key",
          async ({ params, body }) => {
            await container.setBookLocal(params.key, body);
            return { ok: true };
          },
          {
            params: t.Object({ key: t.String() }),
            body: BookPatchBody,
            beforeHandle: requireAuth,
          },
        ),
    );
}

export type App = ReturnType<typeof createApp>;
