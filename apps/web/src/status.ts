import type { Status } from "@gameshelf/core";

export interface StatusMeta {
  label: string;
  badge: string;
  dot: string;
}

export const STATUS_META: Record<Status, StatusMeta> = {
  backlog: {
    label: "Backlog",
    badge: "bg-zinc-950/75 text-zinc-200 ring-zinc-400/30",
    dot: "bg-zinc-400",
  },
  en_cours: {
    label: "En cours",
    badge: "bg-zinc-950/75 text-emerald-300 ring-emerald-400/40",
    dot: "bg-emerald-400",
  },
  en_pause: {
    label: "En pause",
    badge: "bg-zinc-950/75 text-amber-300 ring-amber-400/40",
    dot: "bg-amber-400",
  },
  termine: {
    label: "Terminé",
    badge: "bg-zinc-950/75 text-sky-300 ring-sky-400/40",
    dot: "bg-sky-400",
  },
  abandonne: {
    label: "Abandonné",
    badge: "bg-zinc-950/75 text-rose-300 ring-rose-400/40",
    dot: "bg-rose-400",
  },
  wishlist: {
    label: "Wishlist",
    badge: "bg-zinc-950/75 text-violet-300 ring-violet-400/40",
    dot: "bg-violet-400",
  },
};

export const STATUS_ORDER: readonly Status[] = [
  "backlog",
  "en_cours",
  "en_pause",
  "termine",
  "abandonne",
  "wishlist",
];

export function formatHours(minutes: number): string {
  if (minutes <= 0) return "0 h";
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return hours >= 100 ? `${Math.round(hours)} h` : `${hours.toFixed(1)} h`;
}
