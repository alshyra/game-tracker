import { describe, expect, test } from "bun:test";
import { classifyOnline } from "../src/domain/online";
import type { AppDetails } from "../src/domain/ports";

function details(over: Partial<AppDetails>): AppDetails {
  return { genres: [], categories: [], release_date: null, ...over };
}

describe("classifyOnline", () => {
  test("genre Massively Multiplayer => mmo, en ligne", () => {
    const check = classifyOnline(details({ genres: ["Action", "Massively Multiplayer"] }));
    expect(check.tier).toBe("mmo");
    expect(check.online).toBe(true);
  });

  test("catégorie MMO sans mode solo => mmo", () => {
    const check = classifyOnline(details({ categories: ["Multi-player", "MMO"] }));
    expect(check.tier).toBe("mmo");
    expect(check.online).toBe(true);
  });

  test("multijoueur sans solo => multiplayer_only, en ligne", () => {
    const check = classifyOnline(details({ categories: ["Multi-player", "Co-op"] }));
    expect(check.tier).toBe("multiplayer_only");
    expect(check.online).toBe(true);
  });

  test("solo + multi => mixed, non appliqué automatiquement", () => {
    const check = classifyOnline(
      details({ genres: ["RPG"], categories: ["Single-player", "Multi-player"] }),
    );
    expect(check.tier).toBe("mixed");
    expect(check.online).toBe(false);
  });

  test("solo seul => solo", () => {
    const check = classifyOnline(details({ genres: ["RPG"], categories: ["Single-player"] }));
    expect(check.tier).toBe("solo");
    expect(check.online).toBe(false);
  });

  test("co-op local seul (sans online) => solo", () => {
    const check = classifyOnline(
      details({ categories: ["Single-player", "Co-op", "Shared/Split Screen Co-op"] }),
    );
    expect(check.tier).toBe("solo");
    expect(check.online).toBe(false);
  });
});
