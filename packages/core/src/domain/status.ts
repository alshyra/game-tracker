import { type Static, Type } from "@sinclair/typebox";

export const StatusSchema = Type.Union([
  Type.Literal("backlog"),
  Type.Literal("en_cours"),
  Type.Literal("en_pause"),
  Type.Literal("termine"),
  Type.Literal("abandonne"),
  Type.Literal("wishlist"),
]);

export type Status = Static<typeof StatusSchema>;

export const STATUSES: readonly Status[] = [
  "backlog",
  "en_cours",
  "en_pause",
  "termine",
  "abandonne",
  "wishlist",
];

export const DEFAULT_STATUS: Status = "backlog";

/** Une heure jouée : en dessous, un jeu non touché reste « backlog ». */
export const MIN_PLAYTIME_FOR_IN_PROGRESS = 60;

/**
 * Statut par défaut d'un jeu Steam sans statut local. Un jeu déjà joué plus
 * d'une heure n'est plus « backlog » : il est au moins « en cours ». Le statut
 * local, lui, est toujours prioritaire.
 */
export function defaultStatusFor(playtimeForeverMin: number): Status {
  return playtimeForeverMin > MIN_PLAYTIME_FOR_IN_PROGRESS ? "en_cours" : DEFAULT_STATUS;
}

export function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}
