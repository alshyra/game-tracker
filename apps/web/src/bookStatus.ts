import type { BookStatus } from "@gameshelf/core";

export interface BookStatusMeta {
  label: string;
  badge: string;
  dot: string;
}

export const BOOK_STATUS_META: Record<BookStatus, BookStatusMeta> = {
  a_lire: {
    label: "À lire",
    badge: "bg-zinc-950/75 text-zinc-200 ring-zinc-400/30",
    dot: "bg-zinc-400",
  },
  en_cours: {
    label: "En cours",
    badge: "bg-zinc-950/75 text-emerald-300 ring-emerald-400/40",
    dot: "bg-emerald-400",
  },
  lu: {
    label: "Lu",
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

export const BOOK_STATUS_ORDER: readonly BookStatus[] = [
  "a_lire",
  "en_cours",
  "lu",
  "abandonne",
  "wishlist",
];
