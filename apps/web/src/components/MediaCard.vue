<script setup lang="ts">
import type { Book, Game } from "@gameshelf/core";
import BookCard from "./BookCard.vue";
import GameCard from "./GameCard.vue";

type MediaKind = "game" | "livre" | "bd";

const props = defineProps<{
  type: MediaKind;
  game?: Game;
  book?: Book;
  /** Affiche un badge de type au-dessus de la carte (mode mixte). */
  showTypeBadge: boolean;
}>();

const LABELS: Record<MediaKind, string> = {
  game: "Jeu vidéo",
  livre: "Livre",
  bd: "BD",
};

const BADGES: Record<MediaKind, string> = {
  game: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
  livre: "bg-sky-500/15 text-sky-300 ring-sky-400/30",
  bd: "bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-400/30",
};
</script>

<template>
  <div class="flex h-full flex-col gap-1.5">
    <span
      v-if="showTypeBadge"
      class="w-fit rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1"
      :class="BADGES[type]"
    >
      {{ LABELS[type] }}
    </span>
    <div class="min-h-0 flex-1 [&>article]:h-full">
      <GameCard v-if="type === 'game' && game" :game="game" :updating="false" :read-only="true" />
      <BookCard v-else-if="book" :book="book" :updating="false" :read-only="true" />
    </div>
  </div>
</template>
