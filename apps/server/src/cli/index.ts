#!/usr/bin/env bun
import {
  type Game,
  type OnlineCandidate,
  STATUSES,
  type Status,
  SteamPrivacyError,
} from "@gameshelf/core";
import { Command } from "commander";
import pc from "picocolors";
import { buildContainer } from "../container";

const STATUS_LABELS: Record<Status, string> = {
  backlog: "backlog",
  en_cours: "en cours",
  en_pause: "en pause",
  termine: "terminé",
  abandonne: "abandonné",
  wishlist: "wishlist",
};

const STATUS_COLORS: Record<Status, (s: string) => string> = {
  backlog: pc.gray,
  en_cours: pc.green,
  en_pause: pc.yellow,
  termine: pc.blue,
  abandonne: pc.red,
  wishlist: pc.magenta,
};

function hours(minutes: number): string {
  return `${(minutes / 60).toFixed(1)} h`;
}

function printGames(games: Game[]): void {
  const counts = new Map<Status, number>();
  for (const status of STATUSES) counts.set(status, 0);
  for (const game of games) counts.set(game.status, (counts.get(game.status) ?? 0) + 1);

  console.log(pc.bold(`\n${games.length} jeux`));
  for (const status of STATUSES) {
    const color = STATUS_COLORS[status];
    console.log(`  ${color("●")} ${STATUS_LABELS[status].padEnd(10)} ${counts.get(status)}`);
  }

  console.log("");
  for (const game of games) {
    const color = STATUS_COLORS[game.status];
    const title = game.title.length > 44 ? `${game.title.slice(0, 43)}…` : game.title;
    console.log(
      `  ${title.padEnd(44)} ${hours(game.playtime_forever_min).padStart(9)}  ${color(
        STATUS_LABELS[game.status],
      )}`,
    );
  }
}

const program = new Command()
  .name("gameshelf")
  .description("Tracker de jeux self-hosté — Steam + champs locaux")
  .version("0.1.0");

program
  .command("sync")
  .description("Synchronise la bibliothèque Steam dans le snapshot local")
  .option("--apply", "écrit réellement (sans ce flag : simulation)", false)
  .action(async (options: { apply: boolean }) => {
    const container = buildContainer();
    try {
      const result = await container.sync({ apply: options.apply });
      console.log(pc.bold(options.apply ? "Synchronisation" : "Simulation"));
      console.log(`  total Steam      : ${result.total}`);
      console.log(`  nouveaux         : ${result.added}`);
      console.log(`  disparus         : ${result.removed}`);
      console.log(`  temps de jeu     : ${hours(result.playtime_min)}`);
      if (!options.apply) {
        console.log(pc.dim("\n  Simulation : rien n'a été écrit. Relance avec --apply."));
      } else {
        console.log(pc.green("\n  Snapshot écrit."));
      }
    } catch (error) {
      if (error instanceof SteamPrivacyError) {
        console.error(pc.red(`\n${error.message}`));
        process.exit(2);
      }
      throw error;
    }
  });

program
  .command("status")
  .description("Affiche la collection et sa répartition par statut")
  .action(async () => {
    const container = buildContainer();
    const games = await container.listGames();
    if (games.length === 0) {
      console.log(pc.yellow("Aucun jeu. Lance `gameshelf sync --apply` d'abord."));
      return;
    }
    printGames(games);
  });

program
  .command("online")
  .description("Détecte les jeux en ligne (hors kanban) via les métadonnées du magasin Steam")
  .option("--apply", "marque réellement les jeux en ligne détectés", false)
  .option("--include-mixed", "inclut aussi les jeux solo+multi (à confirmer)", false)
  .action(async (options: { apply: boolean; includeMixed: boolean }) => {
    const container = buildContainer();
    console.log(pc.bold(options.apply ? "Détection + application" : "Détection (simulation)"));
    console.log(pc.dim("  appdetails Steam, ~1 s par jeu…\n"));

    const result = await container.detectOnline({
      apply: options.apply,
      includeMixed: options.includeMixed,
    });

    const groups: { label: string; tier: OnlineCandidate["tier"] }[] = [
      { label: "MMO", tier: "mmo" },
      { label: "Multijoueur seul", tier: "multiplayer_only" },
      { label: "Solo + multi (à confirmer)", tier: "mixed" },
    ];

    for (const { label, tier } of groups) {
      const list = result.candidates.filter((candidate) => candidate.tier === tier);
      if (list.length === 0) continue;
      console.log(pc.bold(`${label} (${list.length})`));
      for (const candidate of list) {
        const flag = candidate.alreadyOnline ? pc.green("déjà ") : "     ";
        console.log(
          `  ${flag}${candidate.title.slice(0, 44).padEnd(44)} ${pc.dim(candidate.reasons.join(", "))}`,
        );
      }
      console.log("");
    }

    console.log(`  scannés : ${result.scanned}   échecs : ${result.failed}`);
    if (options.apply) {
      console.log(pc.green(`  ${result.marked} jeu(x) marqué(s) en ligne.`));
    } else {
      console.log(
        pc.dim(
          "  Simulation : rien écrit. Relance avec --apply " +
            "(ajoute --include-mixed pour le 3e groupe).",
        ),
      );
    }
  });

// ── Catalogue BD local ──────────────────────────────────────────

program
  .command("catalog-ingest")
  .description("Scrape le catalogue BD (Éditions Soleil) → data/catalog.json")
  .option("--apply", "écrit réellement le catalogue", false)
  .option("--covers", "télécharge aussi les couvertures compressées", false)
  .option("--delay <ms>", "délai entre requêtes (ms)", "400")
  .action(async (options: { apply: boolean; covers: boolean; delay: string }) => {
    const container = buildContainer();
    console.log(pc.bold("Catalogue — Terres d'Arran (Éditions Soleil)"));
    console.log(pc.dim(`  sitemap + JSON-LD, ${options.delay} ms entre requêtes…\n`));
    const result = await container.ingestCatalog({
      apply: options.apply,
      withCovers: options.covers,
      onProgress: (p) => {
        if (p.phase === "album") {
          const mark = p.ok ? pc.green("✓") : pc.red("✗");
          const slug = p.url.split("/album-")[1] ?? p.url;
          process.stdout.write(`  ${mark} ${slug}\n`);
        } else {
          const mark = p.ok ? pc.green("✓") : pc.red("✗");
          process.stdout.write(`  cover ${mark} ${p.url} (${p.done})\n`);
        }
      },
    });
    const bySeries = new Map<string, number>();
    for (const entry of result.entries) {
      bySeries.set(entry.series, (bySeries.get(entry.series) ?? 0) + 1);
    }
    console.log("");
    for (const [series, count] of bySeries) {
      console.log(`  ${series.padEnd(20)} ${String(count).padStart(3)} albums`);
    }
    console.log("");
    console.log(`  albums   : ${result.albums}`);
    if (options.covers) console.log(`  covers   : ${result.covers}`);
    console.log(`  échecs   : ${result.failed}`);
    if (result.written) {
      console.log(pc.green("\n  Catalogue écrit (data/catalog.json)."));
    } else {
      console.log(pc.dim("\n  Simulation : rien écrit. Relance avec --apply."));
    }
  });

program
  .command("catalog-search")
  .description("Cherche dans le catalogue BD local")
  .argument("<terme>", "terme de recherche (titre, série, auteur…)")
  .action(async (term: string) => {
    const container = buildContainer();
    const results = await container.searchCatalog(term, 20);
    if (results.length === 0) {
      console.log(pc.yellow(`Aucun résultat pour « ${term} ».`));
      return;
    }
    console.log(pc.bold(`\n${results.length} résultat(s)`));
    for (const entry of results) {
      const tome = entry.tome ? ` t${String(entry.tome).padStart(2, "0")}` : "";
      console.log(`  ${entry.series}${tome} — ${entry.title} ${pc.dim(entry.isbn ?? "")}`);
    }
  });

program
  .command("catalog-seed")
  .description("Préremplit books.yaml depuis le catalogue (Elfes t01–t10 possédés, reste wishlist)")
  .option("--apply", "écrit réellement books.yaml", false)
  .action(async (options: { apply: boolean }) => {
    const container = buildContainer();
    const result = await container.seedBooks({ apply: options.apply });
    const counts = new Map<string, number>();
    for (const entry of result.entries) {
      counts.set(entry.status, (counts.get(entry.status) ?? 0) + 1);
    }
    console.log(pc.bold("Préremplissage books.yaml"));
    for (const [status, count] of counts) {
      console.log(`  ${status.padEnd(12)} ${count}`);
    }
    console.log(`\n  créés    : ${result.created}`);
    console.log(`  ignorés  : ${result.skipped} (déjà présents)`);
    if (result.written) {
      console.log(pc.green("\n  books.yaml écrit."));
    } else {
      console.log(pc.dim("\n  Simulation : rien écrit. Relance avec --apply."));
    }
  });

await program.parseAsync(process.argv);
