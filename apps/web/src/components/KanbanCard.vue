<script setup lang="ts">
import type { Game } from "@gameshelf/core";
import { computed, ref } from "vue";
import { formatHours } from "../status";

const props = defineProps<{
  game: Game;
  updating: boolean;
}>();

const emit = defineEmits<(event: "toggle-online", key: string, online: boolean) => void>();

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
</script>

<template>
  <article
    :data-key="game.key"
    class="group flex cursor-grab select-none gap-2.5 rounded-xl bg-zinc-900 p-2 ring-1 ring-white/5 transition hover:ring-white/15 active:cursor-grabbing"
    :class="updating ? 'opacity-60' : ''"
  >
    <div class="h-14 w-11 shrink-0 overflow-hidden rounded-md bg-zinc-800">
      <img
        v-if="cover"
        :src="cover"
        :alt="game.title"
        loading="lazy"
        draggable="false"
        class="h-full w-full"
        :class="fallbackActive ? 'object-contain' : 'object-cover'"
        @error="onImageError"
      />
    </div>
    <div class="flex min-w-0 flex-1 flex-col py-0.5">
      <h4 class="line-clamp-2 text-xs font-medium leading-snug text-zinc-100" :title="game.title">
        {{ game.title }}
      </h4>
      <div class="mt-auto flex items-center justify-between gap-1">
        <p class="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <span>{{ formatHours(game.playtime_forever_min) }}</span>
          <span v-if="game.playtime_2weeks_min" class="text-emerald-400">
            · +{{ formatHours(game.playtime_2weeks_min) }}
          </span>
        </p>
        <button
          type="button"
          class="no-drag rounded-md px-1.5 py-0.5 text-[11px] text-zinc-500 opacity-0 transition hover:bg-white/5 hover:text-teal-300 group-hover:opacity-100"
          title="Jeu en ligne — le retirer du kanban"
          @click="emit('toggle-online', game.key, true)"
        >
          ∞
        </button>
      </div>
    </div>
  </article>
</template>
