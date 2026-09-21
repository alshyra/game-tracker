<script setup lang="ts">
import type { Game, Status } from "@gameshelf/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, ref } from "vue";
import { api } from "./api";
import FilterBar from "./components/FilterBar.vue";
import GameCard from "./components/GameCard.vue";
import KanbanBoard from "./components/KanbanBoard.vue";
import { STATUS_ORDER, formatHours } from "./status";

type View = "kanban" | "grid";

function extractError(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const value = "value" in error ? (error as { value?: unknown }).value : undefined;
    if (value && typeof value === "object" && "error" in value) {
      const message = (value as { error?: unknown }).error;
      if (typeof message === "string") return message;
    }
    if (typeof error === "string") return error;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

const queryClient = useQueryClient();
const view = ref<View>("kanban");
const filter = ref<Status | "all">("all");
const search = ref("");

const {
  data: gamesData,
  isLoading,
  isError: gamesFailed,
  error: gamesError,
} = useQuery({
  queryKey: ["games"],
  queryFn: async (): Promise<Game[]> => {
    const { data, error } = await api.api.games.get();
    if (error) throw new Error(extractError(error, "Impossible de charger la collection."));
    return (data ?? []) as Game[];
  },
});

const {
  mutate: runSync,
  isPending: syncPending,
  data: syncData,
  isError: syncFailed,
  error: syncError,
} = useMutation({
  mutationFn: async () => {
    const { data, error } = await api.api.sync.post({ apply: true });
    if (error) throw new Error(extractError(error, "La synchronisation a échoué."));
    return data;
  },
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["games"] }),
});

const {
  mutate: setStatus,
  isPending: statusPending,
  variables: statusVariables,
} = useMutation({
  mutationFn: async ({ key, status }: { key: string; status: Status }) => {
    const { error } = await api.api.games({ key }).patch({ status });
    if (error) throw new Error(extractError(error, "Mise à jour impossible."));
  },
  onMutate: async ({ key, status }) => {
    await queryClient.cancelQueries({ queryKey: ["games"] });
    const previous = queryClient.getQueryData<Game[]>(["games"]);
    queryClient.setQueryData<Game[]>(["games"], (old) =>
      old?.map((game) => (game.key === key ? { ...game, status } : game)),
    );
    return { previous };
  },
  onError: (_error, _variables, context) => {
    if (context?.previous) queryClient.setQueryData(["games"], context.previous);
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: ["games"] }),
});

const games = computed<Game[]>(() => gamesData.value ?? []);

const searched = computed(() => {
  const query = search.value.trim().toLowerCase();
  if (query === "") return games.value;
  return games.value.filter((game) => game.title.toLowerCase().includes(query));
});

const counts = computed(() => {
  const base = Object.fromEntries(STATUS_ORDER.map((status) => [status, 0])) as Record<
    Status,
    number
  >;
  for (const game of games.value) base[game.status] += 1;
  return base;
});

const visible = computed(() =>
  filter.value === "all"
    ? searched.value
    : searched.value.filter((game) => game.status === filter.value),
);

const totalPlaytime = computed(() =>
  games.value.reduce((sum, game) => sum + game.playtime_forever_min, 0),
);

const updatingKey = computed(() =>
  statusPending.value ? (statusVariables.value?.key ?? null) : null,
);

/**
 * Key du board : force un remontage propre après chaque changement de données.
 * SortableJS déplace des nœuds DOM ; cette clé évite que Vue patche son virtual
 * DOM par-dessus un DOM déjà réorganisé (cartes dupliquées entre colonnes).
 */
const boardKey = computed(() =>
  searched.value.map((game) => `${game.key}:${game.status}`).join("|"),
);

const syncSummary = computed(() => {
  const raw = syncData.value;
  return raw && typeof raw === "object" && "total" in raw ? raw : null;
});

const syncErrorMessage = computed(() =>
  syncFailed.value ? extractError(syncError.value, "Échec de la synchronisation.") : null,
);
const gamesErrorMessage = computed(() =>
  gamesFailed.value ? extractError(gamesError.value, "Impossible de charger la collection.") : null,
);

function onFilter(value: Status | "all"): void {
  filter.value = value;
}

function onStatusChange(key: string, status: Status): void {
  setStatus({ key, status });
}
</script>

<template>
  <div class="mx-auto max-w-[1800px] px-6 py-10">
    <header class="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-3xl font-semibold tracking-tight text-zinc-50">Gameshelf</h1>
        <p class="mt-1 text-sm text-zinc-400">
          {{ games.length }} jeux · {{ formatHours(totalPlaytime) }} cumulées
        </p>
      </div>
      <button
        type="button"
        :disabled="syncPending"
        class="rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:border-emerald-400/50 hover:bg-emerald-500/25 disabled:opacity-50"
        @click="runSync()"
      >
        {{ syncPending ? "Synchronisation…" : "Synchroniser Steam" }}
      </button>
    </header>

    <div
      v-if="syncErrorMessage"
      class="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
    >
      {{ syncErrorMessage }}
    </div>
    <div
      v-else-if="syncSummary"
      class="mb-6 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300"
    >
      Synchronisé : {{ syncSummary.total }} jeux ({{ syncSummary.added }} nouveaux,
      {{ syncSummary.removed }} disparus).
    </div>

    <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <FilterBar
        v-if="view === 'grid'"
        :active="filter"
        :counts="counts"
        :total="games.length"
        @change="onFilter"
      />
      <p v-else class="text-sm text-zinc-400">
        Glisse une carte vers une colonne pour changer son statut.
      </p>

      <div class="flex items-center gap-3">
        <div class="flex rounded-full border border-white/10 p-0.5">
          <button
            type="button"
            class="rounded-full px-3 py-1 text-xs font-medium transition"
            :class="view === 'kanban' ? 'bg-white/10 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'"
            @click="view = 'kanban'"
          >
            Kanban
          </button>
          <button
            type="button"
            class="rounded-full px-3 py-1 text-xs font-medium transition"
            :class="view === 'grid' ? 'bg-white/10 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'"
            @click="view = 'grid'"
          >
            Grille
          </button>
        </div>
        <input
          v-model="search"
          type="search"
          placeholder="Rechercher…"
          class="w-56 rounded-full border border-white/10 bg-zinc-900/60 px-4 py-1.5 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-600 hover:border-white/20 focus:border-emerald-400/50"
        />
      </div>
    </div>

    <p v-if="isLoading" class="py-20 text-center text-sm text-zinc-500">Chargement…</p>

    <div
      v-else-if="gamesFailed"
      class="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
    >
      {{ gamesErrorMessage }}
    </div>

    <div
      v-else-if="games.length === 0"
      class="rounded-2xl border border-dashed border-white/10 py-24 text-center"
    >
      <p class="text-sm text-zinc-400">Aucun jeu pour l'instant.</p>
      <p class="mt-2 text-xs text-zinc-600">
        Lance une synchronisation Steam pour importer ta bibliothèque.
      </p>
    </div>

    <KanbanBoard
      v-else-if="view === 'kanban'"
      :key="boardKey"
      :games="searched"
      :updating-key="updatingKey"
      @status-change="onStatusChange"
    />

    <div
      v-else-if="visible.length === 0"
      class="rounded-2xl border border-dashed border-white/10 py-24 text-center"
    >
      <p class="text-sm text-zinc-400">Aucun jeu ne correspond à ce filtre.</p>
    </div>

    <div
      v-else
      class="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
    >
      <GameCard
        v-for="game in visible"
        :key="game.key"
        :game="game"
        :updating="updatingKey === game.key"
        @status-change="onStatusChange"
      />
    </div>
  </div>
</template>
