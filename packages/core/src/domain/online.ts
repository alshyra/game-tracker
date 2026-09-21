import type { AppDetails } from "./ports";

export type OnlineTier = "mmo" | "multiplayer_only" | "mixed" | "solo";

export interface OnlineCheck {
  tier: OnlineTier;
  /** true si le jeu est en ligne « sans fin » et doit sortir du kanban. */
  online: boolean;
  reasons: string[];
}

/**
 * Catégories Steam qui signalent le multijoueur *en ligne*. « Co-op » seul est
 * volontairement exclu : il peut s'agir de coop local, pas forcément en ligne.
 */
const ONLINE_CATEGORIES = [
  "Multi-player",
  "Online Co-op",
  "Online PvP",
  "Cross-Platform Multiplayer",
  "PvP",
  "MMO",
];

/**
 * Classe un jeu à partir des métadonnées du magasin.
 * - `mmo` : genre Massively Multiplayer ou catégorie MMO → en ligne.
 * - `multiplayer_only` : multijoueur sans mode solo → en ligne.
 * - `mixed` : solo + multi → à confirmer (non appliqué automatiquement).
 * - `solo` : pas de signal multijoueur.
 */
export function classifyOnline(details: AppDetails): OnlineCheck {
  const reasons: string[] = [];
  const genres = details.genres.map((genre) => genre.toLowerCase());
  const categories = details.categories;

  const isMmo = genres.includes("massively multiplayer") || categories.includes("MMO");
  if (isMmo) reasons.push("MMO");

  const onlineCategories = categories.filter(
    (category) => ONLINE_CATEGORIES.includes(category) && category !== "MMO",
  );
  reasons.push(...onlineCategories);

  const hasSingle = categories.includes("Single-player");

  if (isMmo) return { tier: "mmo", online: true, reasons };
  if (onlineCategories.length > 0 && !hasSingle) {
    return { tier: "multiplayer_only", online: true, reasons };
  }
  if (onlineCategories.length > 0 && hasSingle) {
    return { tier: "mixed", online: false, reasons };
  }
  return { tier: "solo", online: false, reasons };
}
