<script setup lang="ts">
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "../auth";

const router = useRouter();
const { isAuthenticated, refresh, login } = useAuth();

onMounted(() => {
  void refresh();
});

function openWishlist(): void {
  void router.push("/wishlist");
}

function openTracker(): void {
  void router.push("/app");
}
</script>

<template>
  <main
    class="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-16"
  >
    <div
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgb(16_185_129_/_0.12),_transparent_55%)]"
    />
    <div class="relative flex w-full max-w-md flex-col items-center text-center">
      <span
        class="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-3xl ring-1 ring-emerald-400/20"
      >
        🎮
      </span>
      <h1 class="text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">Gameshelf</h1>
      <p class="mt-4 text-sm leading-relaxed text-zinc-400">
        Ma collection de jeux vidéo — backlog, en cours, terminés, et ma
        <span class="text-zinc-200">wishlist publique</span>.
      </p>

      <div class="mt-10 flex w-full flex-col gap-3">
        <button
          type="button"
          class="rounded-xl bg-emerald-500/15 px-5 py-3 text-sm font-medium text-emerald-200 ring-1 ring-emerald-400/30 transition hover:bg-emerald-500/25 hover:ring-emerald-400/50"
          @click="openWishlist"
        >
          Voir la wishlist
        </button>
        <button
          v-if="!isAuthenticated"
          type="button"
          class="rounded-xl bg-white/5 px-5 py-3 text-sm font-medium text-zinc-200 ring-1 ring-white/15 transition hover:bg-white/10 hover:ring-white/25"
          @click="login"
        >
          Se connecter
        </button>
        <button
          v-else
          type="button"
          class="rounded-xl bg-white/5 px-5 py-3 text-sm font-medium text-zinc-200 ring-1 ring-white/15 transition hover:bg-white/10 hover:ring-white/25"
          @click="openTracker"
        >
          Ouvrir mon tracker
        </button>
      </div>

      <p class="mt-6 text-xs text-zinc-600">
        Wishlist publique · édition réservée au propriétaire
      </p>
    </div>
  </main>
</template>
