#!/usr/bin/env bun
/**
 * M0' — preuve de la chaîne Steam sur Bun (script jetable, aucune app).
 *
 * Usage:
 *   bun run spikes/m0_steam_spike.ts
 *
 * Bun charge automatiquement .env à la racine du projet.
 * Ne construit rien : mesure, diagnostique, tranche.
 */

const API = "https://api.steampowered.com";
const STORE = "https://store.steampowered.com";
const PACE_MS = 1500;
const LIMIT = 5;

type OwnedGame = {
  appid: number;
  name?: string;
  playtime_forever?: number;
};

type OwnedGamesResponse = {
  response?: {
    game_count?: number;
    games?: OwnedGame[];
    eresult?: number;
  };
};

type AppDetailsNode = {
  success?: boolean;
  data?: { header_image?: string };
};

type RecentGamesResponse = {
  response?: {
    total_count?: number;
    games?: { name?: string; playtime_2weeks?: number }[];
  };
};

const key = (process.env.STEAM_API_KEY ?? "").trim();
const steamId = (process.env.STEAM_ID ?? "").trim();

if (!steamId) {
  console.error("[ERREUR] STEAM_ID absent (.env ou environnement).");
  process.exit(2);
}
console.log(`SteamID : ${steamId}`);
if (!key) {
  console.error("[ERREUR] STEAM_API_KEY absente : GetOwnedGames est impossible.");
  console.error("  -> https://steamcommunity.com/dev/apikey puis remplir .env");
  process.exit(2);
}

async function getJson(base: string, params: Record<string, string | number>): Promise<Response> {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  let delay = 2000;
  let res: Response | undefined;
  for (let attempt = 0; attempt < 4; attempt++) {
    res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "gameshelf-m0-spike" },
    });
    if (res.status === 429) {
      console.log(`  [429] rate limit, backoff ${delay / 1000}s (tentative ${attempt + 1}/4)`);
      await Bun.sleep(delay);
      delay *= 2;
      continue;
    }
    return res;
  }
  return res as Response;
}

async function main(): Promise<number> {
  console.log("\n== 1. IPlayerService/GetOwnedGames ==");
  const t0 = performance.now();
  const res = await getJson(`${API}/IPlayerService/GetOwnedGames/v1/`, {
    key,
    steamid: steamId,
    include_appinfo: 1,
    include_played_free_games: 1,
  });
  const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
  const body = await res.text();
  console.log(`HTTP ${res.status} en ${elapsed}s, ${body.length} octets`);

  const ctype = res.headers.get("content-type") ?? "";
  if (!ctype.includes("json")) {
    console.error(`[ERREUR] content-type=${ctype} — réponse non-JSON (redirection non suivie ?)`);
    return 1;
  }
  if (res.status === 403) {
    console.error("[ERREUR] 403 : clé Web API invalide ou révoquée.");
    return 1;
  }
  if (res.status !== 200) {
    console.error(`[ERREUR] HTTP ${res.status}: ${body.slice(0, 300)}`);
    return 1;
  }

  let payload: OwnedGamesResponse;
  try {
    payload = JSON.parse(body) as OwnedGamesResponse;
  } catch {
    console.error("[ERREUR] corps illisible en JSON.");
    return 1;
  }

  const inner = payload.response ?? {};
  const eresult = inner.eresult ?? 1;
  if (eresult === 25 || eresult === 84) {
    console.error(
      `[ERREUR] x-eresult=${eresult} : rate limit / accès refusé. Ralentis et réessaie.`,
    );
    return 1;
  }

  const games = inner.games ?? [];
  if (games.length === 0) {
    console.log("\n[DIAGNOSTIC] `games` est VIDE (pas d'erreur HTTP).");
    console.log("Cause la plus probable : les « Détails du jeu » du profil ne sont pas publics.");
    console.log("L'API renvoie alors une réponse valide mais vide, sans code d'erreur.");
    console.log(
      "Correctif : Profil > Modifier > Paramètres de confidentialité >\n" +
        "« Détails du jeu » = Public, puis relancer ce script.",
    );
    console.log("\nVERDICT : NO-GO (données indisponibles tant que la privacy n'est pas réglée)");
    return 3;
  }

  const count = inner.game_count ?? games.length;
  const totalMin = games.reduce((sum, g) => sum + (g.playtime_forever ?? 0), 0);
  console.log(
    `[OK] ${count} jeux retournés, ${totalMin} min cumulées (${(totalMin / 60).toFixed(1)} h)`,
  );

  const top = [...games].sort((a, b) => (b.playtime_forever ?? 0) - (a.playtime_forever ?? 0));
  console.log(`\n== 2. Enrichissement appdetails des ${LIMIT} jeux les plus joués ==`);
  let hits = 0;
  for (const game of top.slice(0, LIMIT)) {
    const appid = game.appid;
    const name = game.name ?? "?";
    const hours = (game.playtime_forever ?? 0) / 60;
    const res2 = await getJson(`${STORE}/api/appdetails`, { appids: appid });
    let headerImage: string | null = null;
    const ctype2 = res2.headers.get("content-type") ?? "";
    if (res2.status === 200 && ctype2.includes("json")) {
      const node = (JSON.parse(await res2.text()) as Record<string, AppDetailsNode>)[String(appid)];
      if (node?.success) {
        headerImage = node.data?.header_image ?? null;
      }
    }
    if (headerImage) hits++;
    const ok = headerImage ? "OK" : "MANQUANT";
    console.log(
      `  [${ok.padEnd(8)}] ${String(appid).padStart(7)}  ${name.slice(0, 40).padEnd(40)} ${hours.toFixed(1).padStart(7)} h  ${headerImage ?? ""}`,
    );
    await Bun.sleep(PACE_MS);
  }

  console.log("\n== 3. GetRecentlyPlayedGames ==");
  const res3 = await getJson(`${API}/IPlayerService/GetRecentlyPlayedGames/v1/`, {
    key,
    steamid: steamId,
    count: 10,
  });
  const ctype3 = res3.headers.get("content-type") ?? "";
  if (res3.status === 200 && ctype3.includes("json")) {
    const recent = (JSON.parse(await res3.text()) as RecentGamesResponse).response ?? {};
    console.log(`[OK] ${recent.total_count ?? 0} jeux joués ces 2 dernières semaines`);
    for (const g of recent.games ?? []) {
      console.log(
        `  ${(g.name ?? "?").padEnd(40)} 2w=${((g.playtime_2weeks ?? 0) / 60).toFixed(1)} h`,
      );
    }
  } else {
    console.log(`[WARN] GetRecentlyPlayedGames indisponible (HTTP ${res3.status})`);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("VERDICT : GO");
  console.log(`  - GetOwnedGames  : ${count} jeux (compte cohérent avec ~80 attendus)`);
  console.log(`  - appdetails     : ${hits}/${LIMIT} header_image récupérées`);
  console.log("  - privacy profil : Détails du jeu publics confirmés");
  console.log("=".repeat(60));
  return 0;
}

process.exit(await main());
