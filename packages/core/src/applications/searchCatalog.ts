import type { CatalogEntry } from "../domain/catalog";
import type { CatalogStorePort } from "../domain/catalogPorts";

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Recherche dans le catalogue BD local : titre, série, univers, auteurs, ISBN.
 * Insensible à la casse et aux accents. Renvoie au plus `limit` entrées, triées
 * par pertinence puis série/tome.
 */
export async function searchCatalog(
  store: CatalogStorePort,
  term: string,
  limit = 20,
): Promise<CatalogEntry[]> {
  const needle = normalize(term.trim());
  if (!needle) return [];

  const entries = await store.readCatalog();
  const scored: { entry: CatalogEntry; score: number }[] = [];

  for (const entry of entries.values()) {
    const haystack = normalize(
      [entry.title, entry.series, entry.collection ?? "", ...entry.authors, entry.isbn ?? ""].join(
        " ",
      ),
    );
    if (!haystack.includes(needle)) continue;
    const title = normalize(entry.title);
    const series = normalize(entry.series);
    let score = 0;
    if (title.startsWith(needle)) score += 3;
    if (series.includes(needle)) score += 2;
    if (title.includes(needle)) score += 1;
    scored.push({ entry, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const s = a.entry.series.localeCompare(b.entry.series);
    if (s !== 0) return s;
    return (a.entry.tome ?? 0) - (b.entry.tome ?? 0);
  });

  return scored.slice(0, limit).map((s) => s.entry);
}
