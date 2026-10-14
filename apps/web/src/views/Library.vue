<script setup lang="ts">
import type { Book, BookStatus } from "@gameshelf/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { api } from "../api";
import { useAuth } from "../auth";
import { BOOK_STATUS_META, BOOK_STATUS_ORDER } from "../bookStatus";
import AddBook from "../components/AddBook.vue";
import BookCard from "../components/BookCard.vue";

type KindFilter = "all" | "livre" | "bd";

function extractError(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const value = "value" in error ? (error as { value?: unknown }).value : undefined;
    if (value && typeof value === "object" && "error" in value) {
      const message = (value as { error?: unknown }).error;
      if (typeof message === "string") return message;
    }
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

const queryClient = useQueryClient();
const { isAuthenticated, refresh, login } = useAuth();
const showAdd = ref(false);
const kindFilter = ref<KindFilter>("all");
const statusFilter = ref<BookStatus | "all">("all");
const search = ref("");

onMounted(() => {
  void refresh();
});

const readOnly = computed(() => !isAuthenticated.value);

const {
  data: booksData,
  isLoading,
  isError,
} = useQuery({
  queryKey: ["books"],
  queryFn: async (): Promise<Book[]> => {
    const { data, error } = await api.api.books.get();
    if (error) throw new Error(extractError(error, "Impossible de charger la bibliothèque."));
    return (data ?? []) as Book[];
  },
});

const {
  mutate: patchBook,
  isPending: statusPending,
  variables: statusVariables,
} = useMutation({
  mutationFn: async ({ key, status }: { key: string; status: BookStatus }) => {
    const { error } = await api.api.books({ key }).patch({ status });
    if (error) throw new Error(extractError(error, "Mise à jour impossible."));
  },
  onMutate: async ({ key, status }) => {
    await queryClient.cancelQueries({ queryKey: ["books"] });
    const previous = queryClient.getQueryData<Book[]>(["books"]);
    queryClient.setQueryData<Book[]>(["books"], (old) =>
      old?.map((book) => (book.key === key ? { ...book, status } : book)),
    );
    return { previous };
  },
  onError: (_error, _variables, context) => {
    if (context?.previous) queryClient.setQueryData(["books"], context.previous);
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: ["books"] }),
});

const books = computed<Book[]>(() => booksData.value ?? []);

const counts = computed(() => {
  const base = Object.fromEntries(BOOK_STATUS_ORDER.map((s) => [s, 0])) as Record<
    BookStatus,
    number
  >;
  for (const book of books.value) base[book.status] += 1;
  return base;
});

const visible = computed(() => {
  const query = search.value.trim().toLowerCase();
  return books.value.filter((book) => {
    if (kindFilter.value !== "all" && book.kind !== kindFilter.value) return false;
    if (statusFilter.value !== "all" && book.status !== statusFilter.value) return false;
    if (query) {
      const haystack = `${book.title} ${book.authors.join(" ")}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
});

const updatingKey = computed(() =>
  statusPending.value ? (statusVariables.value?.key ?? null) : null,
);

function onStatusChange(key: string, status: BookStatus): void {
  patchBook({ key, status });
}

function onAdded(): void {
  showAdd.value = false;
  queryClient.invalidateQueries({ queryKey: ["books"] });
}
</script>

<template>
  <div class="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 sm:py-10">
    <header class="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <RouterLink to="/" class="text-xs font-medium text-zinc-500 transition hover:text-zinc-300">
          ← Accueil
        </RouterLink>
        <h1 class="mt-2 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
          Bibliothèque
        </h1>
        <p class="mt-1 text-sm text-zinc-400">{{ books.length }} ouvrages</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <RouterLink
          to="/wishlist"
          class="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-white/25 hover:bg-white/10"
        >
          Wishlist
        </RouterLink>
        <button
          v-if="isAuthenticated"
          type="button"
          class="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-white/25 hover:bg-white/10"
          @click="showAdd = !showAdd"
        >
          ＋ Ajouter
        </button>
        <button
          v-if="!isAuthenticated"
          type="button"
          class="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-white/25 hover:bg-white/10"
          @click="login"
        >
          Se connecter
        </button>
      </div>
    </header>

    <div v-if="showAdd && isAuthenticated" class="mb-6">
      <AddBook @added="onAdded" @close="showAdd = false" />
    </div>

    <div class="mb-6 flex flex-wrap items-center gap-3">
      <div class="flex rounded-full border border-white/10 p-0.5">
        <button
          v-for="k in (['all', 'livre', 'bd'] as const)"
          :key="k"
          type="button"
          class="rounded-full px-3 py-1 text-xs font-medium transition"
          :class="kindFilter === k ? 'bg-white/10 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'"
          @click="kindFilter = k"
        >
          {{ k === "all" ? "Tous" : k === "livre" ? "Livres" : "BD" }}
        </button>
      </div>
      <button
        v-for="s in BOOK_STATUS_ORDER"
        :key="s"
        type="button"
        class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition"
        :class="
          statusFilter === s
            ? 'border-white/20 bg-white/10 text-zinc-100'
            : 'border-white/5 bg-zinc-900/60 text-zinc-400 hover:border-white/15 hover:text-zinc-200'
        "
        @click="statusFilter = statusFilter === s ? 'all' : s"
      >
        <span class="h-2 w-2 rounded-full" :class="BOOK_STATUS_META[s].dot" />
        {{ BOOK_STATUS_META[s].label }}
        <span :class="statusFilter === s ? 'text-zinc-300' : 'text-zinc-600'">
          {{ counts[s] }}
        </span>
      </button>
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
      Impossible de charger la bibliothèque.
    </div>

    <div
      v-else-if="books.length === 0"
      class="rounded-2xl border border-dashed border-white/10 py-24 text-center"
    >
      <p class="text-sm text-zinc-400">Aucun ouvrage pour l'instant.</p>
      <p class="mt-2 text-xs text-zinc-600">
        {{ isAuthenticated ? "Ajoute un livre ou une BD par titre." : "Connecte-toi pour gérer la bibliothèque." }}
      </p>
    </div>

    <div
      v-else-if="visible.length === 0"
      class="rounded-2xl border border-dashed border-white/10 py-24 text-center"
    >
      <p class="text-sm text-zinc-400">Aucun ouvrage ne correspond à ce filtre.</p>
    </div>

    <div
      v-else
      class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
    >
      <BookCard
        v-for="book in visible"
        :key="book.key"
        :book="book"
        :updating="updatingKey === book.key"
        :read-only="readOnly"
        @status-change="onStatusChange"
      />
    </div>
  </div>
</template>
