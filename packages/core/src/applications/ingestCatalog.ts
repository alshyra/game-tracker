import type { CatalogEntry } from "../domain/catalog";
import type { CatalogSourcePort, CatalogStorePort, CoverStorePort } from "../domain/catalogPorts";

/** Groupe de séries éditeur formant un univers cohérent (ex. Terres d'Arran). */
export interface SeriesGroup {
  /** Slug canonique (clé de regroupement). */
  canonical: string;
  /** Nom lisible de la série. */
  label: string;
  /** Univers de rattachement (ex. « Les Terres d'Arran »). */
  collection: string;
  /** Slugs éditeur à scanner (un nom de série peut être scindé en plusieurs). */
  slugs: string[];
}

/** Univers « Les Terres d'Arran » (Éditions Soleil). */
export const TERRES_D_ARRAN: SeriesGroup[] = [
  {
    canonical: "elfes",
    label: "Elfes",
    collection: "Les Terres d'Arran",
    slugs: ["elfes", "les-terres-d-arran-elfes"],
  },
  {
    canonical: "nains",
    label: "Nains",
    collection: "Les Terres d'Arran",
    slugs: ["nains", "les-terres-d-arran-nains"],
  },
  {
    canonical: "mages",
    label: "Mages",
    collection: "Les Terres d'Arran",
    slugs: ["mages", "les-terres-d-arran-mages"],
  },
  {
    canonical: "orcs-et-gobelins",
    label: "Orcs & Gobelins",
    collection: "Les Terres d'Arran",
    slugs: ["orcs-et-gobelins", "les-terres-d-arran-orcs-et-gobelins"],
  },
  {
    canonical: "guerres-d-arran",
    label: "Guerres d'Arran",
    collection: "Les Terres d'Arran",
    slugs: ["guerres-d-arran", "les-terres-d-arran-guerres-d-arran"],
  },
];

export interface IngestProgress {
  phase: "album" | "cover";
  series: string;
  url: string;
  ok: boolean;
  done: number;
}

export interface IngestCatalogOptions {
  groups?: SeriesGroup[];
  /** Écrit réellement (sinon simulation). */
  apply?: boolean;
  /** Télécharge aussi les couvertures compressées. */
  withCovers?: boolean;
  /** Callback de progression (journalisation). */
  onProgress?: (progress: IngestProgress) => void;
}

export interface IngestCatalogResult {
  albums: number;
  entries: CatalogEntry[];
  covers: number;
  failed: number;
  written: boolean;
}

function eanFromCover(coverUrl: string | null): string | null {
  const match = coverUrl?.match(/\/covers\/(\d+)\.webp$/);
  return match?.[1] ?? null;
}

function isEditionNb(url: string): boolean {
  return url.includes("-edition-nb");
}

/** Clé canonique : `soleil:<serie>-t<NN>` quand le tome est connu. */
function canonicalKey(group: SeriesGroup, entry: CatalogEntry): string {
  if (entry.tome !== null) {
    return `soleil:${group.canonical}-t${String(entry.tome).padStart(2, "0")}`;
  }
  return `soleil:${group.canonical}:${entry.key.replace(/^soleil:/, "")}`;
}

/**
 * Construit/actualise le catalogue BD local : énumère les albums d'un univers
 * chez l'éditeur, extrait leurs métadonnées, **écrit le catalogue**, puis
 * télécharge les couvertures compressées. Idempotent (upsert par clé canonique).
 *
 * Le catalogue est écrit avant les couvertures : si le téléchargement des
 * couvertures échoue ou est interrompu, les métadonnées restent persistées.
 */
export async function ingestCatalog(
  deps: { source: CatalogSourcePort; store: CatalogStorePort; covers?: CoverStorePort },
  options: IngestCatalogOptions = {},
): Promise<IngestCatalogResult> {
  const groups = options.groups ?? TERRES_D_ARRAN;
  const byKey = new Map<string, CatalogEntry>();
  let failed = 0;
  let done = 0;

  for (const group of groups) {
    for (const slug of group.slugs) {
      let urls: string[] = [];
      try {
        urls = await deps.source.listSeriesAlbums(slug);
      } catch {
        failed += 1;
        continue;
      }
      // Les éditions numérotées (nb) passent en dernier : une édition normale
      // déjà présente n'est pas écrasée par son homologue collector.
      const ordered = [...urls].sort((a, b) => Number(isEditionNb(a)) - Number(isEditionNb(b)));
      for (const url of ordered) {
        try {
          const entry = await deps.source.fetchAlbum(url);
          done += 1;
          options.onProgress?.({ phase: "album", series: group.label, url, ok: !!entry, done });
          if (!entry) {
            failed += 1;
            continue;
          }
          const cKey = canonicalKey(group, entry);
          const existing = byKey.get(cKey);
          if (existing && isEditionNb(url)) continue;
          const normalized: CatalogEntry = {
            ...entry,
            key: cKey,
            series: group.label,
            series_slug: group.canonical,
            collection: group.collection,
          };
          if (!existing || (entry.cover_url && !existing.cover_url)) {
            byKey.set(cKey, normalized);
          }
        } catch {
          done += 1;
          failed += 1;
          options.onProgress?.({ phase: "album", series: group.label, url, ok: false, done });
        }
      }
    }
  }

  const entries = [...byKey.values()];

  // 1. Catalogue d'abord (métadonnées = l'essentiel).
  let written = false;
  if (options.apply) {
    const existing = await deps.store.readCatalog();
    for (const entry of entries) existing.set(entry.key, entry);
    await deps.store.writeCatalog([...existing.values()]);
    written = true;
  }

  // 2. Couvertures ensuite (best-effort, idempotent).
  let covers = 0;
  if (options.withCovers && deps.covers) {
    const coverStore = deps.covers;
    for (const entry of entries) {
      const ean = eanFromCover(entry.cover_url);
      if (!ean) continue;
      try {
        if (await coverStore.hasCover(ean)) {
          covers += 1;
          continue;
        }
        const bytes = await deps.source.fetchCover(ean);
        if (bytes) {
          await coverStore.writeCover(ean, bytes);
          covers += 1;
        }
        options.onProgress?.({
          phase: "cover",
          series: entry.series,
          url: ean,
          ok: !!bytes,
          done: covers,
        });
      } catch {
        failed += 1;
        options.onProgress?.({
          phase: "cover",
          series: entry.series,
          url: ean,
          ok: false,
          done: covers,
        });
      }
    }
  }

  return { albums: entries.length, entries, covers, failed, written };
}
