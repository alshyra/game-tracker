<script setup lang="ts">
import type { Game } from "@gameshelf/core";
import { useQuery } from "@tanstack/vue-query";
import { computed, onMounted } from "vue";
import { RouterLink } from "vue-router";
import { api } from "../api";
import { useAuth } from "../auth";
import GameCard from "../components/GameCard.vue";

const { isAuthenticated, refresh } = useAuth();

onMounted(() => {
  void refresh();
});

const {
  data: gamesData,
  isLoading,
  isError,
} = useQuery({
  queryKey: ["games"],
  queryFn: async (): Promise<Game[]> => {
    const { data, error } = await api.api.games.get();
    if (error) throw new Error("Impossible de charger la wishlist.");
    return (data ?? []) as Game[];
  },
});

const wishlist = computed(() =>
  (gamesData.value ?? [])
    .filter((game) => game.status === "wishlist")
    .sort((a, b) => a.title.localeCompare(b.title)),
);
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
          {{ wishlist.length }} jeux à surveiller
        </p>
      </div>
      <RouterLink
        :to="isAuthenticated ? '/app' : '/'"
        class="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-white/25 hover:bg-white/10"
      >
        {{ isAuthenticated ? "Ouvrir mon tracker" : "Se connecter" }}
      </RouterLink>
    </header>

    <p v-if="isLoading" class="py-20 text-center text-sm text-zinc-500">Chargement…</p>

    <div
      v-else-if="isError"
      class="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
    >
      Impossible de charger la wishlist.
    </div>

    <div
      v-else-if="wishlist.length === 0"
      class="rounded-2xl border border-dashed border-white/10 py-24 text-center"
    >
      <p class="text-sm text-zinc-400">La wishlist est vide pour l'instant.</p>
    </div>

    <div
      v-else
      class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
    >
      <GameCard
        v-for="game in wishlist"
        :key="game.key"
        :game="game"
        :updating="false"
        :read-only="true"
      />
    </div>
  </main>
</template>
