import type { Snapshot, SteamPort, StorePort } from "../domain/ports";

export interface SyncDeps {
  steam: SteamPort;
  store: StorePort;
}

export interface SyncResult {
  applied: boolean;
  total: number;
  added: number;
  removed: number;
  playtime_min: number;
  fetched_at: string;
  previous_fetched_at: string | null;
}

export interface SyncOptions {
  /** Simulation par défaut : rien n'est écrit tant que `apply` est faux. */
  apply?: boolean;
}

/**
 * Récupère la bibliothèque Steam et met à jour le snapshot. Idempotent : un
 * second passage ne crée aucun doublon et n'écrase aucun champ local.
 */
export async function syncLibrary(deps: SyncDeps, options: SyncOptions = {}): Promise<SyncResult> {
  const apply = options.apply ?? false;
  const entries = await deps.steam.fetchLibrary();
  const previous = await deps.store.readSnapshot();

  const previousEntries = previous?.entries ?? [];
  const previousIds = new Set(previousEntries.map((e) => e.appid));
  const nextIds = new Set(entries.map((e) => e.appid));

  const added = entries.filter((e) => !previousIds.has(e.appid)).length;
  const removed = previousEntries.filter((e) => !nextIds.has(e.appid)).length;
  const fetchedAt = new Date().toISOString();

  if (apply) {
    const snapshot: Snapshot = { fetched_at: fetchedAt, entries };
    await deps.store.writeSnapshot(snapshot);
  }

  return {
    applied: apply,
    total: entries.length,
    added,
    removed,
    playtime_min: entries.reduce((sum, e) => sum + e.playtime_forever_min, 0),
    fetched_at: fetchedAt,
    previous_fetched_at: previous?.fetched_at ?? null,
  };
}
