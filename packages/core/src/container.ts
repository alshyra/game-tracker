import { join } from "node:path";
import { SoleilClient } from "./adapters/catalog/soleilClient";
import { OpenLibraryClient } from "./adapters/openlibrary/client";
import { SteamHttpClient } from "./adapters/steam/client";
import { SteamStoreClient } from "./adapters/steam/storeClient";
import { BookYamlStore } from "./adapters/store/bookYamlStore";
import { CatalogJsonStore } from "./adapters/store/catalogStore";
import { CoverFileStore } from "./adapters/store/coverStore";
import { YamlStore } from "./adapters/store/yamlStore";
import { type AddBookInput, type AddBookResult, addBook } from "./applications/addBook";
import { type AddGameInput, type AddGameResult, addGame } from "./applications/addGame";
import {
  type DetectOnlineOptions,
  type DetectOnlineResult,
  detectOnline,
} from "./applications/detectOnline";
import {
  type IngestCatalogOptions,
  type IngestCatalogResult,
  ingestCatalog,
} from "./applications/ingestCatalog";
import { listBooks } from "./applications/listBooks";
import { listGames } from "./applications/listGames";
import { searchCatalog } from "./applications/searchCatalog";
import {
  type SeedBooksOptions,
  type SeedBooksResult,
  seedBooksFromCatalog,
} from "./applications/seedBooks";
import { setBookLocal } from "./applications/setBookLocal";
import { setGameLocal } from "./applications/setGameLocal";
import { type SyncOptions, type SyncResult, syncLibrary } from "./applications/syncLibrary";
import type { Book } from "./domain/book";
import type { BookPatch, BookSearchResult } from "./domain/bookPorts";
import type { CatalogEntry } from "./domain/catalog";
import type { Game } from "./domain/game";
import type { GameSearchResult, LocalPatch } from "./domain/ports";

/** Configuration minimale pour brancher les adapters au domaine. */
export interface CoreConfig {
  root: string;
  steamApiKey: string;
  steamId: string;
}

/** Les cas d'usage exposés à tout adapter « driving » (CLI, HTTP, MCP…). */
export interface CoreServices {
  listGames(): Promise<Game[]>;
  setGameLocal(key: string, patch: LocalPatch): Promise<void>;
  sync(options?: SyncOptions): Promise<SyncResult>;
  detectOnline(options?: DetectOnlineOptions): Promise<DetectOnlineResult>;
  searchGames(term: string): Promise<GameSearchResult[]>;
  addGame(input: AddGameInput): Promise<AddGameResult>;
  // Livres / BD
  listBooks(): Promise<Book[]>;
  setBookLocal(key: string, patch: BookPatch): Promise<void>;
  searchBooks(term: string): Promise<BookSearchResult[]>;
  addBook(input: AddBookInput): Promise<AddBookResult>;
  // Catalogue BD local
  searchCatalog(term: string, limit?: number): Promise<CatalogEntry[]>;
  ingestCatalog(options?: IngestCatalogOptions): Promise<IngestCatalogResult>;
  seedBooks(options?: SeedBooksOptions): Promise<SeedBooksResult>;
  /** Chemin du dossier des couvertures téléchargées (servies par le serveur). */
  coversDir: string;
}

/**
 * Composition root partagé : branche les adapters (Steam, Open Library, Soleil,
 * stores) sur les cas d'usage. Ne connaît ni HTTP ni CLI.
 */
export function createCoreServices(config: CoreConfig): CoreServices {
  const steam = new SteamHttpClient({ key: config.steamApiKey, steamId: config.steamId });
  const steamStore = new SteamStoreClient();
  const store = new YamlStore(
    join(config.root, "games.yaml"),
    join(config.root, "data/steam-snapshot.json"),
  );

  const openLibrary = new OpenLibraryClient();
  const bookStore = new BookYamlStore(join(config.root, "books.yaml"));

  const soleil = new SoleilClient();
  const catalogStore = new CatalogJsonStore(join(config.root, "data/catalog.json"));
  const coversDir = join(config.root, "data/covers");
  const coverStore = new CoverFileStore(coversDir);

  return {
    listGames: () => listGames(store),
    setGameLocal: (key, patch) => setGameLocal(store, key, patch),
    sync: (options) => syncLibrary({ steam, store }, options),
    detectOnline: (options) => detectOnline({ store, steamStore }),
    searchGames: (term) => steamStore.searchGames(term),
    addGame: (input) => addGame({ store, search: steamStore }, input),
    listBooks: () => listBooks(bookStore),
    setBookLocal: (key, patch) => setBookLocal(bookStore, key, patch),
    searchBooks: (term) => openLibrary.searchBooks(term),
    addBook: (input) => addBook({ store: bookStore, search: openLibrary }, input),
    searchCatalog: (term, limit) => searchCatalog(catalogStore, term, limit),
    ingestCatalog: (options) =>
      ingestCatalog({ source: soleil, store: catalogStore, covers: coverStore }, options),
    seedBooks: (options) =>
      seedBooksFromCatalog({ catalog: catalogStore, store: bookStore }, options),
    coversDir,
  };
}
