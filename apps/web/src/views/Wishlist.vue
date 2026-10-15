<script setup lang="ts">
import type { Book, Game } from "@gameshelf/core";
import { useQuery } from "@tanstack/vue-query";
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { api } from "../api";
import { useAuth } from "../auth";
import MediaCard from "../components/MediaCard.vue";

type MediaKind = "game" | "livre" | "bd";
type MediaFilter = "all" | MediaKind;

interface MediaItem {
  id: string;
  type: MediaKind;
  title: string;
  sortKey: string;
  game?: Game;
  book?: Book;
}

const { isAuthenticated, refresh } = useAuth();
const filter = ref<MediaFilter>("all");
const search = ref("");

onMounted(() => {
  void refresh();
});

const gamesQuery = useQuery({
  queryKey: ["games"],
  queryFn: async (): Promise<Game[]> => {
    const { data, error } = await api.api.games.get();
    if (error) throw new Error("Impossible de charger les jeux.");
    return (data ?? []) as Game[];
  },
});

const booksQuery = useQuery({
  queryKey: ["books"],
  queryFn: async (): Promise<Book[]> => {
    const { data, error } = await api.api.books.get();
    if (error) throw new Error("Impossible de charger les livres.");
    return (data ?? []) as Book[];
  },
});

const isLoading = computed(() => gamesQuery.isLoading.value || booksQuery.isLoading.value);
const isError = computed(() => gamesQuery.isError.value || booksQuery.isError.value);

/** Éléments en wishlist, tous médias confondus. */
const items = computed<MediaItem[]>(() => {
  const out: MediaItem[] = [];
  for (const game of gamesQuery.data.value ?? []) {
    if (game.status !== "wishlist") continue;
    out.push({ id: game.key, type: "game", title: game.title, sortKey: game.title, game });
  }
  for (const book of booksQuery.data.value ?? []) {
    if (book.status !== "wishlist") continue;
    out.push({
      id: book.key,
      type: book.kind === "bd" ? "bd" : "livre",
      title: book.title,
      sortKey: book.title,
      book,
    });
  }
  return out.sort((a, b) => a.sortKey.localeCompare(b.sortKey, "fr"));
});

const counts = computed(() => {
  const base: Record<MediaFilter, number> = { all: items.value.length, game: 0, livre: 0, bd: 0 };
  for (const item of items.value) base[item.type] += 1;
  return base;
});

const visible = computed(() => {
  const query = search.value.trim().toLowerCase();
  return items.value.filter((item) => {
    if (filter.value !== "all" && item.type !== filter.value) return false;
    if (query && !item.title.toLowerCase().includes(query)) return false;
    return true;
  });
});

const FILTERS: { key: MediaFilter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "game", label: "Jeux vidéo" },
  { key: "livre", label: "Livres" },
  { key: "bd", label: "BD" },
];
</script>

<template>
  <main class="mx-auto max-w-[1800px] px-4 py-8 sm:px-6 sm:py-12">
    <header class="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <RouterLink
          to="/"
          class="text-xs font-medium text-zinc-500 transition hover:text-zinc-300"
        >
          ← Accueil
        </RouterLink>
        <h1 class="mt-2 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
          Wishlist
        </h1>
        <p class="mt-1 text-sm text-zinc-400">
          {{ counts.all }} éléments · {{ counts.game }} jeux · {{ counts.livre + counts.bd }}
          livres/BD
        </p>
      </div>
      <RouterLink
        :to="isAuthenticated ? '/app' : '/'"
        class="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-white/25 hover:bg-white/10"
      >
        {{ isAuthenticated ? "Ouvrir mon tracker" : "Se connecter" }}
      </RouterLink>
    </header>

    <div class="mb-6 flex flex-wrap items-center gap-3">
      <div class="flex rounded-full border border-white/10 p-0.5">
        <button
          v-for="f in FILTERS"
          :key="f.key"
          type="button"
          class="rounded-full px-3 py-1 text-xs font-medium transition"
          :class="filter === f.key ? 'bg-white/10 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'"
          @click="filter = f.key"
        >
          {{ f.label }}
          <span :class="filter === f.key ? 'text-zinc-300' : 'text-zinc-600'">{{ counts[f.key] }}</span>
        </button>
      </div>
      <input
        v-model="search"
        type="search"
        placeholder="Rechercher…"
        class="w-full rounded-full border border-white/10 bg-zinc-900/60 px-4 py-1.5 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-600 hover:border-white/20 focus:border-emerald-400/50 sm:ml-auto sm:w-56"
      />
    </div>

    <p v-if="isLoading" class="py-20 text-center text-sm text-zinc-500">Chargement…</p>

    <div
      v-else-if="isError"
      class="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
    >
      Impossible de charger la wishlist.
    </div>

    <div
      v-else-if="items.length === 0"
      class="rounded-2xl border border-dashed border-white/10 py-24 text-center"
    >
      <p class="text-sm text-zinc-400">La wishlist est vide pour l'instant.</p>
    </div>

    <div
      v-else-if="visible.length === 0"
      class="rounded-2xl border border-dashed border-white/10 py-24 text-center"
    >
      <p class="text-sm text-zinc-400">Aucun élément ne correspond à ce filtre.</p>
    </div>

    <div
      v-else
      class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
    >
      <MediaCard
        v-for="item in visible"
        :key="item.id"
        :type="item.type"
        :game="item.game"
        :book="item.book"
        :show-type-badge="filter === 'all'"
      />
    </div>
  </main>
</template>
