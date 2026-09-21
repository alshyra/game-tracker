<script setup lang="ts">
import type { Status } from "@gameshelf/core";
import { computed } from "vue";
import { STATUS_META, STATUS_ORDER } from "../status";

const props = defineProps<{
  active: Status | "all";
  counts: Record<Status, number>;
  total: number;
}>();

const emit = defineEmits<(event: "change", value: Status | "all") => void>();

const options = computed(() => [
  { value: "all" as const, label: "Tous", dot: "bg-zinc-300", count: props.total },
  ...STATUS_ORDER.map((status) => ({
    value: status,
    label: STATUS_META[status].label,
    dot: STATUS_META[status].dot,
    count: props.counts[status],
  })),
]);
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition"
      :class="
        active === option.value
          ? 'border-white/20 bg-white/10 text-zinc-100'
          : 'border-white/5 bg-zinc-900/60 text-zinc-400 hover:border-white/15 hover:text-zinc-200'
      "
      @click="emit('change', option.value)"
    >
      <span class="h-2 w-2 rounded-full" :class="option.dot" />
      {{ option.label }}
      <span :class="active === option.value ? 'text-zinc-300' : 'text-zinc-600'">
        {{ option.count }}
      </span>
    </button>
  </div>
</template>
