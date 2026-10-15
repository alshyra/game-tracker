import type { BookKind, BookSource, BookStatus } from "./book";

/** Enregistrement local d'un livre/BD (books.yaml). */
export interface BookRecord {
  key: string;
  title: string;
  authors: string[];
  kind: BookKind;
  cover_url: string | null;
  status: BookStatus;
  rating: number | null;
  notes: string | null;
  isbn: string | null;
  year: number | null;
  series: string | null;
  tome: number | null;
  source: BookSource;
  created_at: string | null;
  updated_at: string | null;
}

export type BookPatch = Partial<
  Pick<
    BookRecord,
    | "title"
    | "authors"
    | "kind"
    | "cover_url"
    | "status"
    | "rating"
    | "notes"
    | "isbn"
    | "year"
    | "series"
    | "tome"
    | "source"
  >
>;

/** Résultat de recherche (Open Library ou catalogue BD local). */
export interface BookSearchResult {
  /** Identifiant Open Library de l'œuvre (ex. `OL12345W`), ou null. */
  olKey: string | null;
  title: string;
  authors: string[];
  year: number | null;
  cover_url: string | null;
  /** Provenance : `openlibrary` (défaut) ou `catalog`. */
  source?: BookSource;
  isbn?: string | null;
  /** Série (BD) — ex. `Elfes`. */
  series?: string | null;
  /** Tome dans la série (BD). */
  tome?: number | null;
  /** Clé du catalogue local (ex. `soleil:elfes-t11`), si applicable. */
  catalogKey?: string | null;
}

export interface BookSearchPort {
  searchBooks(term: string): Promise<BookSearchResult[]>;
}

export interface BookStorePort {
  readBooks(): Promise<Map<string, BookRecord>>;
  writeBookFields(key: string, patch: BookPatch): Promise<void>;
}
