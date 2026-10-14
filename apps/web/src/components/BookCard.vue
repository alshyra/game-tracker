<script setup lang="ts">
import type { Book, BookStatus } from "@gameshelf/core";
import { computed, ref } from "vue";
import { BOOK_STATUS_META, BOOK_STATUS_ORDER } from "../bookStatus";

const props = defineProps<{
  book: Book;
  updating: boolean;
  readOnly: boolean;
}>();

const emit = defineEmits<(event: "status-change", key: string, status: BookStatus) => void>();

const cover = computed(() => props.book.cover_url ?? "");
const failed = ref(false);

function onChange(event: Event): void {
  emit("status-change", props.book.key, (event.target as HTMLSelectElement).value as BookStatus);
}
</script>

<template>
  <article
    class="group flex flex-col overflow-hidden rounded-2xl bg-zinc-900/80 shadow-lg shadow-black/40 ring-1 ring-white/5 transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/60 hover:ring-white/15"
  >
    <div class="relative aspect-[2/3] overflow-hidden bg-zinc-800">
      <img
        v-if="cover && !failed"
        :src="cover"
        :alt="book.title"
        loading="lazy"
        class="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        @error="failed = true"
      />
      <div
        v-else
        class="flex h-full flex-col items-center justify-center gap-1 p-4 text-center"
      >
        <span class="text-3xl">{{ book.kind === "bd" ? "💬" : "📖" }}</span>
        <span class="text-xs text-zinc-500">{{ book.title }}</span>
      </div>
      <div class="absolute left-2 top-2 flex flex-col gap-1">
        <span
          :class="[
            'rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 backdrop-blur',
            BOOK_STATUS_META[book.status].badge,
          ]"
        >
          {{ BOOK_STATUS_META[book.status].label }}
        </span>
      </div>
      <span
        v-if="book.kind === 'bd'"
        class="absolute right-2 top-2 rounded-full bg-fuchsia-500/90 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-950"
      >
        BD
      </span>
    </div>

    <div class="flex flex-1 flex-col gap-2 p-3">
      <h3 class="line-clamp-2 text-sm font-medium leading-snug text-zinc-100" :title="book.title">
        {{ book.title }}
      </h3>
      <p class="line-clamp-1 text-xs text-zinc-500">
        {{ book.authors.length > 0 ? book.authors.join(", ") : "Auteur inconnu" }}
        <span v-if="book.year"> · {{ book.year }}</span>
      </p>
      <label v-if="!readOnly" class="sr-only" :for="`bstatus-${book.key}`">
        Statut de {{ book.title }}
      </label>
      <select
        v-if="!readOnly"
        :id="`bstatus-${book.key}`"
        :value="book.status"
        :disabled="updating"
        class="mt-auto w-full cursor-pointer rounded-lg border border-white/10 bg-zinc-800/80 px-2 py-1.5 text-xs text-zinc-200 outline-none transition hover:border-white/20 focus:border-emerald-400/50 disabled:opacity-50"
        @change="onChange"
      >
        <option v-for="status in BOOK_STATUS_ORDER" :key="status" :value="status">
          {{ BOOK_STATUS_META[status].label }}
        </option>
      </select>
    </div>
  </article>
</template>
