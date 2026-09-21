<script setup lang="ts">
import type { Game, Status } from "@gameshelf/core";
import { computed, ref } from "vue";
import { STATUS_META, STATUS_ORDER, formatHours } from "../status";
import StatusBadge from "./StatusBadge.vue";

const props = defineProps<{
  game: Game;
  updating: boolean;
}>();

const emit = defineEmits<(event: "status-change", key: string, status: Status) => void>();

const cover = computed(() => props.game.cover_url ?? props.game.header_url ?? "");
const fallback = computed(() => props.game.header_url ?? "");
const fallbackActive = ref(false);

function onImageError(event: Event): void {
  const image = event.currentTarget as HTMLImageElement;
  if (fallback.value && image.src !== fallback.value) {
    fallbackActive.value = true;
    image.src = fallback.value;
  }
}

function onChange(event: Event): void {
  emit("status-change", props.game.key, (event.target as HTMLSelectElement).value as Status);
}
</script>

<template>
  <article
    class="group flex flex-col overflow-hidden rounded-2xl bg-zinc-900/80 shadow-lg shadow-black/40 ring-1 ring-white/5 transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/60 hover:ring-white/15"
  >
    <div class="relative aspect-[2/3] overflow-hidden bg-zinc-800">
      <img
        v-if="cover"
        :src="cover"
        :alt="game.title"
        loading="lazy"
        class="h-full w-full transition duration-500 group-hover:scale-[1.03]"
        :class="fallbackActive ? 'object-contain opacity-90' : 'object-cover'"
        @error="onImageError"
      />
      <div
        v-else
        class="flex h-full items-center justify-center p-4 text-center text-sm text-zinc-600"
      >
        {{ game.title }}
      </div>
      <div class="absolute left-2 top-2">
        <StatusBadge :status="game.status" />
      </div>
      <span
        v-if="game.playtime_2weeks_min"
        class="absolute right-2 top-2 rounded-full bg-emerald-500/90 px-2 py-1 text-[11px] font-semibold text-emerald-950"
      >
        +{{ formatHours(game.playtime_2weeks_min) }}
      </span>
    </div>

    <div class="flex flex-1 flex-col gap-2 p-3">
      <h3
        class="line-clamp-2 text-sm font-medium leading-snug text-zinc-100"
        :title="game.title"
      >
        {{ game.title }}
      </h3>
      <div class="mt-auto flex items-center justify-between text-xs text-zinc-500">
        <span>{{ formatHours(game.playtime_forever_min) }}</span>
        <span v-if="game.source === 'manual'" class="text-zinc-600">manuel</span>
      </div>
      <select
        :value="game.status"
        :disabled="updating"
        :aria-label="`Statut de ${game.title}`"
        class="w-full cursor-pointer rounded-lg border border-white/10 bg-zinc-800/80 px-2 py-1.5 text-xs text-zinc-200 outline-none transition hover:border-white/20 focus:border-emerald-400/50 disabled:opacity-50"
        @change="onChange"
      >
        <option v-for="status in STATUS_ORDER" :key="status" :value="status">
          {{ STATUS_META[status].label }}
        </option>
      </select>
    </div>
  </article>
</template>
