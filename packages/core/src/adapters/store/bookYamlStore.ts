import { mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { type Document, YAMLMap, isMap, isScalar, parseDocument } from "yaml";
import { type BookKind, type BookSource, type BookStatus, isBookStatus } from "../../domain/book";
import type { BookPatch, BookRecord, BookStorePort } from "../../domain/bookPorts";

const EMPTY_DOC = "version: 1\nbooks: {}\n";

type RawBook = {
  title?: unknown;
  authors?: unknown;
  kind?: unknown;
  cover_url?: unknown;
  status?: unknown;
  rating?: unknown;
  notes?: unknown;
  isbn?: unknown;
  year?: unknown;
  series?: unknown;
  tome?: unknown;
  source?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asAuthors(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((a): a is string => typeof a === "string" && a.length > 0);
}

function asSource(value: unknown): BookSource {
  if (value === "openlibrary") return "openlibrary";
  if (value === "catalog") return "catalog";
  return "manual";
}

async function atomicWrite(path: string, data: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
  await Bun.write(tmp, data);
  await rename(tmp, path);
}

/** Met à jour une valeur sans remplacer le nœud, pour préserver les commentaires. */
function setField(doc: Document, path: (string | number)[], value: unknown): void {
  const existing = doc.getIn(path, true);
  if (isScalar(existing)) {
    existing.value = value;
  } else {
    doc.setIn(path, value);
  }
}

/**
 * Persistance locale des livres/BD : `books.yaml` est la source de vérité,
 * réécrite via l'API Document de `yaml` (commentaires et ordre préservés).
 * Écritures atomiques et sérialisées.
 */
export class BookYamlStore implements BookStorePort {
  private readonly path: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(path: string) {
    this.path = path;
  }

  private run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  async readBooks(): Promise<Map<string, BookRecord>> {
    const file = Bun.file(this.path);
    const text = (await file.exists()) ? await file.text() : EMPTY_DOC;
    const doc = parseDocument(text);
    const books = (doc.toJS() as { books?: Record<string, RawBook> }).books ?? {};

    const records = new Map<string, BookRecord>();
    for (const [key, raw] of Object.entries(books)) {
      if (raw === null || typeof raw !== "object") continue;
      const kind: BookKind = raw.kind === "bd" ? "bd" : "livre";
      const status: BookStatus = isBookStatus(raw.status) ? raw.status : "a_lire";
      records.set(key, {
        key,
        title: asString(raw.title) ?? key,
        authors: asAuthors(raw.authors),
        kind,
        cover_url: asString(raw.cover_url),
        status,
        rating: asNumber(raw.rating),
        notes: asString(raw.notes),
        isbn: asString(raw.isbn),
        year: asNumber(raw.year),
        series: asString(raw.series),
        tome: asNumber(raw.tome),
        source: asSource(raw.source),
        created_at: asString(raw.created_at),
        updated_at: asString(raw.updated_at),
      });
    }
    return records;
  }

  async writeBookFields(key: string, patch: BookPatch): Promise<void> {
    await this.run(async () => {
      const file = Bun.file(this.path);
      const text = (await file.exists()) ? await file.text() : EMPTY_DOC;
      const doc = parseDocument(text);
      if (!isMap(doc.get("books", true))) doc.set("books", new YAMLMap());
      const books = doc.get("books", true);
      if (isMap(books)) books.flow = false;
      const now = new Date().toISOString();

      if (!doc.hasIn(["books", key])) {
        doc.setIn(["books", key, "created_at"], now);
      }

      for (const [field, value] of Object.entries(patch)) {
        if (value === undefined) continue;
        setField(doc, ["books", key, field], value);
      }
      setField(doc, ["books", key, "updated_at"], now);

      const entry = doc.getIn(["books", key], true);
      if (isMap(entry)) entry.flow = false;

      await atomicWrite(this.path, doc.toString());
    });
  }
}
