<script setup lang="ts">
import type { GameSearchResult, Status } from "@gameshelf/core";
import { useMutation } from "@tanstack/vue-query";
import { useDebounceFn } from "@vueuse/core";
import { computed, ref, watch } from "vue";
import { api } from "../api";
import { STATUS_META, STATUS_ORDER } from "../status";

const emit = defineEmits<{ (event: "added"): void; (event: "close"): void }>();

const title = ref("");
const status = ref<Status>("wishlist");
const results = ref<GameSearchResult[]>([]);
const searching = ref(false);
const searched = ref(false);
const error = ref<string | null>(null);

function extractError(err: unknown, fallback: string): string {
  if (err && typeof err === "object") {
    const value = "value" in err ? (err as { value?: unknown }).value : undefined;
    if (value && typeof value === "object" && "error" in value) {
      const message = (value as { error?: unknown }).error;
      if (typeof message === "string") return message;
    }
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

const runSearch = useDebounceFn(async (term: string) => {
  const q = term.trim();
  if (q.length < 2) {
    results.value = [];
    searched.value = false;
    return;
  }
  searching.value = true;
  try {
    const { data, error: searchError } = await api.api.games.search.get({ query: { q } });
    if (searchError) throw searchError;
    results.value = (data ?? []) as GameSearchResult[];
    searched.value = true;
  } catch {
    results.value = [];
  } finally {
    searching.value = false;
  }
}, 350);

watch(title, (value) => {
  void runSearch(value);
});

const addMutation = useMutation({
  mutationFn: async (payload: { title: string; appid?: number; status: Status }) => {
    const { data, error: addError } = await api.api.games.post(payload);
    if (addError) throw addError;
    return data;
  },
  onSuccess: () => emit("added"),
  onError: (err) => {
    error.value = extractError(err, "Ajout impossible.");
  },
});

const canSubmit = computed(() => title.value.trim().length > 0 && !addMutation.isPending.value);

function addManual(): void {
  error.value = null;
  addMutation.mutate({ title: title.value.trim(), status: status.value });
}

function addResult(result: GameSearchResult): void {
  error.value = null;
  addMutation.mutate({ title: result.title, appid: result.appid, status: status.value });
}
</script>

<template>
  <div class="rounded-2xl border border-white/10 bg-zinc-900/80 p-4 shadow-xl shadow-black/40">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-semibold text-zinc-100">Ajouter un jeu</h2>
      <button
        type="button"
        class="text-xs text-zinc-500 transition hover:text-zinc-300"
        @click="emit('close')"
      >
        Fermer
      </button>
    </div>

    <div class="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
      <label class="flex-1">
        <span class="mb-1 block text-xs text-zinc-500">Titre</span>
        <input
          v-model="title"
          type="text"
          placeholder="ex. Elden Ring"
          class="w-full rounded-lg border border-white/10 bg-zinc-800/80 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 hover:border-white/20 focus:border-emerald-400/50"
        />
      </label>
      <label>
        <span class="mb-1 block text-xs text-zinc-500">Statut</span>
        <select
          v-model="status"
          class="rounded-lg border border-white/10 bg-zinc-800/80 px-3 py-2 text-sm text-zinc-200 outline-none transition hover:border-white/20 focus:border-emerald-400/50"
        >
          <option v-for="s in STATUS_ORDER" :key="s" :value="s">
            {{ STATUS_META[s].label }}
          </option>
        </select>
      </label>
    </div>

    <p
      v-if="error"
      class="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
    >
      {{ error }}
    </p>

    <div class="mt-3">
      <p v-if="searching" class="text-xs text-zinc-500">Recherche…</p>
      <template v-else-if="results.length > 0">
        <p class="mb-2 text-xs text-zinc-500">
          Résultats Steam — clique pour ajouter (métadonnées et jaquette auto) :
        </p>
        <ul class="flex flex-col gap-1.5">
          <li v-for="r in results.slice(0, 8)" :key="r.appid">
            <button
              type="button"
              :disabled="addMutation.isPending.value"
              class="flex w-full items-center gap-3 rounded-lg border border-white/5 bg-zinc-800/50 px-2 py-1.5 text-left transition hover:border-white/20 hover:bg-zinc-800 disabled:opacity-50"
              @click="addResult(r)"
            >
              <img
                v-if="r.tiny_image"
                :src="r.tiny_image"
                :alt="r.title"
                class="h-8 w-20 shrink-0 rounded object-cover"
              />
              <span class="min-w-0 flex-1 truncate text-sm text-zinc-200">{{ r.title }}</span>
              <span v-if="r.metascore" class="shrink-0 text-xs text-emerald-400">
                {{ r.metascore }}
              </span>
            </button>
          </li>
        </ul>
      </template>
      <p v-else-if="searched && title.trim().length >= 2" class="text-xs text-zinc-500">
        Aucun résultat Steam — tu peux quand même
        <button type="button" class="text-emerald-400 underline" @click="addManual">
          ajouter « {{ title.trim() }} » manuellement</button
        >.
      </p>
    </div>

    <div class="mt-4 flex justify-end gap-2">
      <button
        type="button"
        :disabled="!canSubmit"
        class="rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/25 disabled:opacity-50"
        @click="addManual"
      >
        {{ addMutation.isPending.value ? "Ajout…" : "Ajouter" }}
      </button>
    </div>
  </div>
</template>
