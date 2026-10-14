import { coverUrl, headerUrl } from "../adapters/steam/client";
import type { GameSearchPort, GameSearchResult, LocalPatch, StorePort } from "../domain/ports";
import type { Status } from "../domain/status";

export interface AddGameInput {
  title: string;
  /** Appid Steam choisi explicitement (résultat de recherche). Sinon : recherche par titre. */
  appid?: number;
  status?: Status;
}

export interface AddGameResult {
  key: string;
  title: string;
  appid: number | null;
  status: Status;
  /** false si l'entrée existait déjà (aucune écriture). */
  created: boolean;
}

/** Slug stable pour la clé `manual:<slug>` (titre sans accents, kebab-case). */
function slugify(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "jeu";
}

/** Match exact (insensible à la casse) sinon le premier résultat (pertinence Steam). */
function pickBest(results: GameSearchResult[], title: string): GameSearchResult | null {
  if (results.length === 0) return null;
  const needle = title.trim().toLowerCase();
  const exact = results.find((r) => r.title.toLowerCase() === needle);
  return exact ?? results[0] ?? null;
}

/**
 * Ajoute un jeu (souvent hors bibliothèque Steam) : résout le meilleur match
 * Steam par titre (ou utilise l'appid fourni), dérive les jaquettes CDN, et
 * crée une entrée locale. Sans match Steam → entrée `manual:<slug>`.
 */
export async function addGame(
  deps: { store: StorePort; search: GameSearchPort },
  input: AddGameInput,
): Promise<AddGameResult> {
  const title = input.title.trim();
  if (!title) throw new Error("Un titre est requis.");
  const status: Status = input.status ?? "wishlist";

  let appid = typeof input.appid === "number" ? input.appid : null;
  let finalTitle = title;

  if (appid === null) {
    const match = pickBest(await deps.search.searchGames(title), title);
    if (match) {
      appid = match.appid;
      finalTitle = match.title;
    }
  }

  const key = appid !== null ? String(appid) : `manual:${slugify(title)}`;

  const local = await deps.store.readLocal();
  if (local.has(key)) {
    return { key, title: finalTitle, appid, status, created: false };
  }

  const patch: LocalPatch = { title: finalTitle, status };
  if (appid !== null) {
    patch.cover_url = coverUrl(appid);
    patch.header_url = headerUrl(appid);
  }
  await deps.store.writeLocalFields(key, patch);
  return { key, title: finalTitle, appid, status, created: true };
}
