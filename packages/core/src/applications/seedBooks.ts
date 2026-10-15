import type { BookKind, BookStatus } from "../domain/book";
import type { BookPatch, BookStorePort } from "../domain/bookPorts";
import type { CatalogEntry } from "../domain/catalog";
import type { CatalogStorePort } from "../domain/catalogPorts";
import { slugify } from "../domain/slug";

/** Sélection de tomes d'une série à préremplir. */
export interface SeedRule {
  /** Slug canonique de série (ex. `elfes`). */
  series_slug: string;
  /** Tome de début (inclus). */
  from?: number;
  /** Tome de fin (inclus). */
  to?: number;
  /** Statut attribué aux tomes de la plage. */
  status: BookStatus;
}

export interface SeedBooksOptions {
  rules?: SeedRule[];
  /** Écrit réellement (sinon simulation). */
  apply?: boolean;
  kind?: BookKind;
}

export interface SeedBooksResult {
  created: number;
  skipped: number;
  entries: { key: string; title: string; status: BookStatus }[];
  written: boolean;
}

/**
 * Préremplissage par défaut : Elfes t01–t10 = collection possédée ; tout le
 * reste de l'univers = wishlist.
 */
export const DEFAULT_SEED_RULES: SeedRule[] = [{ series_slug: "elfes", to: 10, status: "a_lire" }];

/** Statut par défaut pour les tomes non couverts par une règle explicite. */
const DEFAULT_STATUS: BookStatus = "wishlist";

function matches(rule: SeedRule, entry: CatalogEntry): boolean {
  if (entry.series_slug !== rule.series_slug) return false;
  if (entry.tome === null) return rule.from === undefined && rule.to === undefined;
  if (rule.from !== undefined && entry.tome < rule.from) return false;
  if (rule.to !== undefined && entry.tome > rule.to) return false;
  return true;
}

function statusFor(rules: SeedRule[], entry: CatalogEntry): BookStatus {
  for (const rule of rules) {
    if (matches(rule, entry)) return rule.status;
  }
  return DEFAULT_STATUS;
}

/**
 * Préremplit `books.yaml` depuis le catalogue : crée une entrée par album, en
 * attribuant un statut selon les règles (défaut : Elfes t01–t10 possédés, le
 * reste en wishlist). Idempotent : les clés déjà présentes ne sont pas touchées.
 */
export async function seedBooksFromCatalog(
  deps: { catalog: CatalogStorePort; store: BookStorePort },
  options: SeedBooksOptions = {},
): Promise<SeedBooksResult> {
  const rules = options.rules ?? DEFAULT_SEED_RULES;
  const kind: BookKind = options.kind ?? "bd";
  const catalog = await deps.catalog.readCatalog();
  const existing = await deps.store.readBooks();

  const entries: { key: string; title: string; status: BookStatus }[] = [];
  let created = 0;
  let skipped = 0;

  const ordered = [...catalog.values()].sort((a, b) => {
    const s = a.series.localeCompare(b.series);
    if (s !== 0) return s;
    return (a.tome ?? 0) - (b.tome ?? 0);
  });

  for (const entry of ordered) {
    const status = statusFor(rules, entry);
    const key = `catalog:${entry.key.replace(/^soleil:/, "soleil-")}`;
    entries.push({ key, title: entry.title, status });
    if (existing.has(key)) {
      skipped += 1;
      continue;
    }
    if (options.apply) {
      const patch: BookPatch = {
        title: entry.title,
        authors: entry.authors,
        kind,
        status,
        cover_url: entry.cover_url,
        isbn: entry.isbn,
        year: entry.year,
      };
      await deps.store.writeBookFields(key, patch);
    }
    created += 1;
  }

  return { created, skipped, entries, written: options.apply === true };
}

/** Rendu `manual:<slug>` pour un album sans tome (fallback). */
export function fallbackKey(title: string): string {
  return `manual:${slugify(title)}`;
}
