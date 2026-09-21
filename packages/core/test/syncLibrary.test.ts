import { describe, expect, test } from "bun:test";
import { syncLibrary } from "../src/applications/syncLibrary";
import type { LibraryEntry, Snapshot, SteamPort, StorePort } from "../src/domain/ports";

const entry: LibraryEntry = {
  appid: 1,
  title: "Skyrim",
  header_url: "h",
  cover_url: "c",
  playtime_forever_min: 100,
  playtime_2weeks_min: null,
  last_played_at: null,
};

function fakeStore(initial: Snapshot | null) {
  let snapshot = initial;
  const store: StorePort = {
    readLocal: async () => new Map(),
    writeLocalFields: async () => {},
    readSnapshot: async () => snapshot,
    writeSnapshot: async (next) => {
      snapshot = next;
    },
  };
  return { store, get: () => snapshot };
}

const steam: SteamPort = { fetchLibrary: async () => [entry] };

describe("syncLibrary", () => {
  test("simulation par défaut : rien n'est écrit", async () => {
    const { store, get } = fakeStore(null);
    const result = await syncLibrary({ steam, store });

    expect(result.applied).toBe(false);
    expect(result.added).toBe(1);
    expect(get()).toBeNull();
  });

  test("--apply écrit le snapshot", async () => {
    const { store, get } = fakeStore(null);
    await syncLibrary({ steam, store }, { apply: true });
    expect(get()?.entries).toHaveLength(1);
  });

  test("idempotent : second passage, aucun ajout", async () => {
    const { store } = fakeStore(null);
    const first = await syncLibrary({ steam, store }, { apply: true });
    const second = await syncLibrary({ steam, store }, { apply: true });

    expect(first.added).toBe(1);
    expect(second.added).toBe(0);
    expect(second.removed).toBe(0);
    expect(second.total).toBe(1);
  });
});
