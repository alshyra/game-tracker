import { mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { type Document, YAMLMap, isMap, isScalar, parseDocument } from "yaml";
import type {
  LibraryEntry,
  LocalPatch,
  LocalRecord,
  Snapshot,
  StorePort,
} from "../../domain/ports";
import type { Status } from "../../domain/status";
import { isStatus } from "../../domain/status";

const EMPTY_DOC = "version: 1\ngames: {}\n";

type RawLocal = {
  steam_appid?: unknown;
  title?: unknown;
  cover_url?: unknown;
  header_url?: unknown;
  status?: unknown;
  rating?: unknown;
  notes?: unknown;
  source?: unknown;
  online?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
 * Persistance locale : `games.yaml` est la source de vérité, réécrite via l'API
 * Document de `yaml` pour préserver commentaires et ordre. Le snapshot Steam est
 * un cache jetable. Écritures atomiques et sérialisées.
 */
export class YamlStore implements StorePort {
  private readonly gamesPath: string;
  private readonly snapshotPath: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(gamesPath: string, snapshotPath: string) {
    this.gamesPath = gamesPath;
    this.snapshotPath = snapshotPath;
  }

  private run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  async readLocal(): Promise<Map<string, LocalRecord>> {
    const file = Bun.file(this.gamesPath);
    const text = (await file.exists()) ? await file.text() : EMPTY_DOC;
    const doc = parseDocument(text);
    const games = (doc.toJS() as { games?: Record<string, RawLocal> }).games ?? {};

    const records = new Map<string, LocalRecord>();
    for (const [key, raw] of Object.entries(games)) {
      if (raw === null || typeof raw !== "object") continue;
      const steamAppid = asNumber(raw.steam_appid) ?? (/^\d+$/.test(key) ? Number(key) : null);
      const status: Status = isStatus(raw.status) ? raw.status : "backlog";
      const source = raw.source === "manual" || steamAppid === null ? "manual" : "steam";
      records.set(key, {
        key,
        steam_appid: steamAppid,
        title: asString(raw.title),
        cover_url: asString(raw.cover_url),
        header_url: asString(raw.header_url),
        status,
        rating: asNumber(raw.rating),
        notes: asString(raw.notes),
        source,
        online: raw.online === true,
        created_at: asString(raw.created_at),
        updated_at: asString(raw.updated_at),
      });
    }
    return records;
  }

  async writeLocalFields(key: string, patch: LocalPatch): Promise<void> {
    await this.run(async () => {
      const file = Bun.file(this.gamesPath);
      const text = (await file.exists()) ? await file.text() : EMPTY_DOC;
      const doc = parseDocument(text);
      if (!isMap(doc.get("games", true))) doc.set("games", new YAMLMap());
      const games = doc.get("games", true);
      if (isMap(games)) games.flow = false;
      const now = new Date().toISOString();

      if (!doc.hasIn(["games", key])) {
        const steamAppid = /^\d+$/.test(key) ? Number(key) : undefined;
        if (steamAppid !== undefined) doc.setIn(["games", key, "steam_appid"], steamAppid);
        doc.setIn(["games", key, "created_at"], now);
      }

      for (const [field, value] of Object.entries(patch)) {
        if (value === undefined) continue;
        setField(doc, ["games", key, field], value);
      }
      setField(doc, ["games", key, "updated_at"], now);

      const entry = doc.getIn(["games", key], true);
      if (isMap(entry)) entry.flow = false;

      await atomicWrite(this.gamesPath, doc.toString());
    });
  }

  async readSnapshot(): Promise<Snapshot | null> {
    const file = Bun.file(this.snapshotPath);
    if (!(await file.exists())) return null;
    try {
      const parsed = (await file.json()) as Snapshot;
      if (!Array.isArray(parsed.entries)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  async writeSnapshot(snapshot: Snapshot): Promise<void> {
    await this.run(async () => {
      await atomicWrite(this.snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
    });
  }
}

export type { LibraryEntry };
