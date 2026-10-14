import type { BookKind, BookStatus } from "../domain/book";
import type {
  BookPatch,
  BookSearchPort,
  BookSearchResult,
  BookStorePort,
} from "../domain/bookPorts";
import { slugify } from "../domain/slug";

export interface AddBookInput {
  title: string;
  kind?: BookKind;
  status?: BookStatus;
  /** Métadonnées fournies par un résultat de recherche (choix explicite). */
  authors?: string[];
  cover_url?: string | null;
  year?: number | null;
  olKey?: string | null;
}

export interface AddBookResult {
  key: string;
  title: string;
  status: BookStatus;
  created: boolean;
}

function pickBest(results: BookSearchResult[], title: string): BookSearchResult | null {
  if (results.length === 0) return null;
  const needle = title.trim().toLowerCase();
  const exact = results.find((r) => r.title.toLowerCase() === needle);
  return exact ?? results[0] ?? null;
}

/**
 * Ajoute un livre/BD : recherche Open Library par titre (sauf métadonnées déjà
 * fournies), récupère couverture/auteurs/année, crée une entrée locale. Sans
 * match → entrée `manual:<slug>`.
 */
export async function addBook(
  deps: { store: BookStorePort; search: BookSearchPort },
  input: AddBookInput,
): Promise<AddBookResult> {
  const title = input.title.trim();
  if (!title) throw new Error("Un titre est requis.");
  const kind: BookKind = input.kind ?? "livre";
  const status: BookStatus = input.status ?? "wishlist";

  let authors = input.authors ?? [];
  let cover = input.cover_url ?? null;
  let year = input.year ?? null;
  let olKey = input.olKey ?? null;
  let finalTitle = title;

  const provided = input.authors !== undefined || input.olKey !== undefined;
  if (!provided) {
    const match = pickBest(await deps.search.searchBooks(title), title);
    if (match) {
      finalTitle = match.title;
      authors = match.authors;
      cover = match.cover_url;
      year = match.year;
      olKey = match.olKey;
    }
  }

  const key = olKey ? `ol:${olKey}` : `manual:${slugify(title)}`;

  const local = await deps.store.readBooks();
  if (local.has(key)) {
    return { key, title: finalTitle, status, created: false };
  }

  const patch: BookPatch = {
    title: finalTitle,
    authors,
    kind,
    status,
    cover_url: cover,
    year,
  };
  await deps.store.writeBookFields(key, patch);
  return { key, title: finalTitle, status, created: true };
}
