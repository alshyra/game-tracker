import { beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { YamlStore } from "../src/adapters/store/yamlStore";

let dir: string;
let gamesPath: string;
let store: YamlStore;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "gameshelf-test-"));
  gamesPath = join(dir, "games.yaml");
  store = new YamlStore(gamesPath, join(dir, "steam-snapshot.json"));
});

describe("YamlStore", () => {
  test("écrit puis relit des champs locaux", async () => {
    await store.writeLocalFields("72850", { status: "en_cours", rating: 9 });
    const local = await store.readLocal();
    const record = local.get("72850");

    expect(record?.status).toBe("en_cours");
    expect(record?.rating).toBe(9);
    expect(record?.steam_appid).toBe(72850);
    expect(record?.source).toBe("steam");
  });

  test("préserve les commentaires du fichier", async () => {
    await Bun.write(gamesPath, '# ma collection\ngames:\n  "1":\n    status: backlog # à jouer\n');
    await store.writeLocalFields("1", { status: "termine" });
    const text = await Bun.file(gamesPath).text();

    expect(text).toContain("# ma collection");
    expect(text).toContain("# à jouer");
    expect((await store.readLocal()).get("1")?.status).toBe("termine");
  });

  test("un second passage ne crée pas de doublon", async () => {
    await store.writeLocalFields("1", { status: "en_cours" });
    await store.writeLocalFields("1", { status: "termine" });
    const local = await store.readLocal();

    expect(local.size).toBe(1);
    expect(local.get("1")?.status).toBe("termine");
  });

  test("snapshot : écriture puis lecture, fichier absent renvoie null", async () => {
    expect(await store.readSnapshot()).toBeNull();
    await store.writeSnapshot({
      fetched_at: "2026-01-01T00:00:00.000Z",
      entries: [
        {
          appid: 1,
          title: "A",
          header_url: null,
          cover_url: null,
          playtime_forever_min: 5,
          playtime_2weeks_min: null,
          last_played_at: null,
        },
      ],
    });
    const snap = await store.readSnapshot();
    expect(snap?.entries).toHaveLength(1);
  });
});
