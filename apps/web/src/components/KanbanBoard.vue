<script setup lang="ts">
import type { Game, Status } from "@gameshelf/core";
import { ref, watch } from "vue";
import { type DraggableEvent, VueDraggable } from "vue-draggable-plus";
import { STATUS_META, STATUS_ORDER } from "../status";
import KanbanCard from "./KanbanCard.vue";

const props = defineProps<{
  games: Game[];
  updatingKey: string | null;
}>();

const emit = defineEmits<(event: "status-change", key: string, status: Status) => void>();

const columns = ref(STATUS_ORDER.map((status) => ({ status, games: [] as Game[] })));

watch(
  () => props.games,
  (list) => {
    for (const column of columns.value) {
      column.games = list.filter((game) => game.status === column.status);
    }
  },
  { immediate: true },
);

function onAdd(event: DraggableEvent<Game>, status: Status): void {
  const key = event.item?.dataset?.key;
  if (key) emit("status-change", key, status);
}
</script>

<template>
  <div class="flex items-start gap-4 overflow-x-auto pb-4">
    <section
      v-for="column in columns"
      :key="column.status"
      class="flex max-h-[72vh] w-72 shrink-0 flex-col rounded-2xl bg-zinc-900/50 ring-1 ring-white/5"
    >
      <header class="flex items-center justify-between px-3 py-2.5">
        <div class="flex items-center gap-2">
          <span class="h-2 w-2 rounded-full" :class="STATUS_META[column.status].dot" />
          <span class="text-xs font-semibold uppercase tracking-wide text-zinc-300">
            {{ STATUS_META[column.status].label }}
          </span>
        </div>
        <span class="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-zinc-400">
          {{ column.games.length }}
        </span>
      </header>
      <VueDraggable
        v-model="column.games"
        group="games"
        :sort="false"
        :animation="150"
        ghost-class="opacity-40"
        drag-class="rotate-1"
        class="flex min-h-32 flex-1 flex-col gap-2 overflow-y-auto p-2 pt-0"
        :data-status="column.status"
        @add="(event) => onAdd(event, column.status)"
      >
        <KanbanCard
          v-for="game in column.games"
          :key="game.key"
          :game="game"
          :updating="updatingKey === game.key"
        />
      </VueDraggable>
    </section>
  </div>
</template>
