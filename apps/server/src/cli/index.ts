#!/usr/bin/env bun
import { type Game, STATUSES, type Status, SteamPrivacyError } from "@gameshelf/core";
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

await program.parseAsync(process.argv);
