import type { CatalogEntry } from "./catalog";

/** Source externe d'un catalogue (site/API d'un éditeur). */
export interface CatalogSourcePort {
  /**
   * Découvre les URLs d'albums d'une série (ex. via un sitemap).
   * Renvoie des URLs absolues, sans doublon.
   */
  listSeriesAlbums(seriesSlug: string): Promise<string[]>;
  /** Récupère l'entrée d'un album depuis l'URL de sa page éditeur. */
  fetchAlbum(url: string): Promise<CatalogEntry | null>;
  /** Télécharge la couverture compressée d'un album (par EAN), si disponible. */
  fetchCover(ean: string): Promise<Uint8Array | null>;
}

/** Persistance locale du catalogue (`data/catalog.json`). */
export interface CatalogStorePort {
  readCatalog(): Promise<Map<string, CatalogEntry>>;
  /** Écrit le catalogue complet (écriture atomique). */
  writeCatalog(entries: CatalogEntry[]): Promise<void>;
}

/** Stockage local des couvertures (`data/covers/<ean>.webp`). */
export interface CoverStorePort {
  hasCover(ean: string): Promise<boolean>;
  writeCover(ean: string, bytes: Uint8Array): Promise<void>;
}
