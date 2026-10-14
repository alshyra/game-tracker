import type { BookSearchPort, BookSearchResult } from "../../domain/bookPorts";
import type { FetchLike } from "../steam/client";

const OL = "https://openlibrary.org";
const COVERS = "https://covers.openlibrary.org/b/id";

type RawDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
};

export interface OpenLibraryClientOptions {
  fetchImpl?: FetchLike;
}

/**
 * Recherche Open Library : publique, sans clé. `search.json` renvoie des
 * documents avec titre, auteurs, année et identifiant de couverture.
 */
export class OpenLibraryClient implements BookSearchPort {
  private readonly doFetch: FetchLike;

  constructor(options: OpenLibraryClientOptions = {}) {
    this.doFetch = options.fetchImpl ?? fetch;
  }

  async searchBooks(term: string): Promise<BookSearchResult[]> {
    const query = term.trim();
    if (!query) return [];

    const url = new URL(`${OL}/search.json`);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "8");
    url.searchParams.set("fields", "key,title,author_name,first_publish_year,cover_i");

    const res = await this.doFetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "gameshelf" },
    });
    if (!res.ok) return [];
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) return [];

    const payload = (await res.json()) as { docs?: RawDoc[] };
    const results: BookSearchResult[] = [];
    for (const doc of payload.docs ?? []) {
      if (typeof doc.title !== "string" || doc.title.length === 0) continue;
      const workKey = typeof doc.key === "string" ? doc.key.replace(/^\/works\//, "") : null;
      results.push({
        olKey: workKey,
        title: doc.title,
        authors: Array.isArray(doc.author_name)
          ? doc.author_name.filter((a): a is string => typeof a === "string")
          : [],
        year: typeof doc.first_publish_year === "number" ? doc.first_publish_year : null,
        cover_url: typeof doc.cover_i === "number" ? `${COVERS}/${doc.cover_i}-L.jpg` : null,
      });
    }
    return results;
  }
}
