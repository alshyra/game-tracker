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
  source: BookSource;
  created_at: string | null;
  updated_at: string | null;
}

export type BookPatch = Partial<
  Pick<
    BookRecord,
    "title" | "authors" | "kind" | "cover_url" | "status" | "rating" | "notes" | "isbn" | "year"
  >
>;

/** Résultat de recherche Open Library. */
export interface BookSearchResult {
  /** Identifiant Open Library de l'œuvre (ex. `OL12345W`), ou slug local. */
  olKey: string | null;
  title: string;
  authors: string[];
  year: number | null;
  cover_url: string | null;
}

export interface BookSearchPort {
  searchBooks(term: string): Promise<BookSearchResult[]>;
}

export interface BookStorePort {
  readBooks(): Promise<Map<string, BookRecord>>;
  writeBookFields(key: string, patch: BookPatch): Promise<void>;
}
