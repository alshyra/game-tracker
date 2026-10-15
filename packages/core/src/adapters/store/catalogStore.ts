import { mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";
import type { CatalogEntry } from "../../domain/catalog";
import type { CatalogStorePort } from "../../domain/catalogPorts";

async function atomicWrite(path: string, data: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
  await Bun.write(tmp, data);
  await rename(tmp, path);
}

function sanitize(raw: unknown): CatalogEntry | null {
  if (raw === null || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.key !== "string" || typeof value.title !== "string") return null;
  return {
    key: value.key,
    series: typeof value.series === "string" ? value.series : "",
    series_slug: typeof value.series_slug === "string" ? value.series_slug : "",
    collection: typeof value.collection === "string" ? value.collection : null,
    tome: typeof value.tome === "number" ? value.tome : null,
    title: value.title,
    authors: Array.isArray(value.authors)
      ? value.authors.filter((a): a is string => typeof a === "string")
      : [],
    isbn: typeof value.isbn === "string" ? value.isbn : null,
    year: typeof value.year === "number" ? value.year : null,
    pages: typeof value.pages === "number" ? value.pages : null,
    publisher: typeof value.publisher === "string" ? value.publisher : null,
    cover_url: typeof value.cover_url === "string" ? value.cover_url : null,
    description: typeof value.description === "string" ? value.description : null,
    url: typeof value.url === "string" ? value.url : "",
    source: typeof value.source === "string" ? value.source : "",
  };
}

/**
 * Catalogue BD local (`data/catalog.json`). Fichier indépendant de
 * `books.yaml` : le catalogue est un index reconstructible, jamais une donnée
 * utilisateur.
 */
export class CatalogJsonStore implements CatalogStorePort {
  private readonly path: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(path: string) {
    this.path = path;
  }

  async readCatalog(): Promise<Map<string, CatalogEntry>> {
    const file = Bun.file(this.path);
    if (!(await file.exists())) return new Map();
    try {
      const parsed = (await file.json()) as { entries?: unknown[] };
      const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
      const map = new Map<string, CatalogEntry>();
      for (const raw of entries) {
        const entry = sanitize(raw);
        if (entry) map.set(entry.key, entry);
      }
      return map;
    } catch {
      return new Map();
    }
  }

  async writeCatalog(entries: CatalogEntry[]): Promise<void> {
    const next = this.queue.then(async () => {
      const sorted = [...entries].sort((a, b) => {
        const s = a.series.localeCompare(b.series);
        if (s !== 0) return s;
        return (a.tome ?? 0) - (b.tome ?? 0);
      });
      const payload = JSON.stringify({ version: 1, entries: sorted }, null, 2);
      await atomicWrite(this.path, payload);
    });
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    await next;
  }
}
